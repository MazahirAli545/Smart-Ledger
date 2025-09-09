import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import type { ViewStyle } from 'react-native';
import { RootStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUserIdFromToken } from '../../utils/storage';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import CustomerSelector from '../../components/CustomerSelector';
import { useCustomerContext } from '../../context/CustomerContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import UploadDocument from '../../components/UploadDocument';
import { useAlert } from '../../context/AlertContext';
import SearchAndFilter from '../../components/SearchAndFilter';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { launchImageLibrary } from 'react-native-image-picker';

// Add missing interfaces
interface PaymentSearchFilterState {
  searchText: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  status?: string;
  reference?: string;
  description?: string;
}

// Use the interface from SearchAndFilter component
import type { RecentSearch } from '../../components/SearchAndFilter';

interface ParsedPurchaseData {
  purchaseNumber: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  purchaseDate: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  notes: string;
}

function parsePurchaseOcrText(text: string): ParsedPurchaseData {
  return {
    purchaseNumber: '',
    supplierName: '',
    supplierPhone: '',
    supplierAddress: '',
    purchaseDate: '',
    items: [],
    notes: '',
  };
}

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

const GST_OPTIONS = [0, 5, 12, 18, 28];

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PurchaseScreen: React.FC<FolderProp> = ({ folder }) => {
  const folderName = folder?.title || 'Purchase';

  // Debug logging for folder name
  console.log('🔍 PurchaseScreen: folder prop received:', folder);
  console.log('🔍 PurchaseScreen: folderName calculated:', folderName);

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showAlert } = useAlert();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Mock data for past purchases
  const pastPurchases: Purchase[] = [
    {
      id: '1',
      purchaseNumber: 'PUR-001',
      supplierName: 'Supplier A',
      date: '2024-01-10',
      amount: 12000,
      status: 'Paid',
    },
    {
      id: '2',
      purchaseNumber: 'PUR-002',
      supplierName: 'Supplier B',
      date: '2024-01-18',
      amount: 22000,
      status: 'Pending',
    },
    {
      id: '3',
      purchaseNumber: 'PUR-003',
      supplierName: 'Supplier C',
      date: '2024-01-22',
      amount: 9000,
      status: 'Overdue',
    },
  ];

  // States for purchase creation form
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ]);
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isSupplierFocused, setIsSupplierFocused] = useState(false);
  const supplierInputRef = useRef<TextInput>(null);
  const [dropdownLayout, setDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [gstPct, setGstPct] = useState(18);
  const [taxAmount, setTaxAmount] = useState(0); // Tax amount field
  const [discountAmount, setDiscountAmount] = useState(0); // Discount amount field
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [gstDropdownOpen, setGstDropdownOpen] = useState(false);
  const [gstDropdownLayout, setGstDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const gstFieldRef = useRef<View>(null);
  const [syncYN, setSyncYN] = useState('N');
  const [apiPurchases, setApiPurchases] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [description, setDescription] = useState('');

  // Add missing state variables for UploadDocument and filters
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [isRecording, setIsRecording] = useState(false);
  const [itemsSectionRef] = useState(useRef<View>(null));
  const [lastGstPctByVoice, setLastGstPctByVoice] = useState<number | null>(
    null,
  );
  const [lastPurchaseDateByVoice, setLastPurchaseDateByVoice] = useState<
    string | null
  >(null);
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const [nlpStatus, setNlpStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>(
    'info',
  );
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState<PaymentSearchFilterState>({
    searchText: '',
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [filterBadgeCount, setFilterBadgeCount] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);

  // Helper for pluralizing folder name
  const pluralize = (name: string | undefined) => {
    if (!name) return 'items';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };

  // Core functions
  const deletePurchase = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      let query = '?type=purchase';
      const res = await fetch(`${BASE_URL}/vouchers/${id}${query}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete purchase.');
      }
      await fetchPurchases();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete purchase.');
      setShowModal(true);
    }
  };

  const fetchPurchases = async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');

      // First, fetch customers to get party information
      const customersRes = await fetch(`${BASE_URL}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!customersRes.ok) {
        throw new Error(`Failed to fetch customers: ${customersRes.status}`);
      }

      const customersData = await customersRes.json();
      const customers = customersData.data || [];

      console.log('📊 Raw customers/suppliers data:', {
        totalCustomers: customers.length,
        sampleCustomer: customers[0] || 'No customers',
        customerFields: customers[0] ? Object.keys(customers[0]) : [],
      });

      // Then fetch vouchers for purchases
      let query = '?type=purchase';
      const res = await fetch(`${BASE_URL}/vouchers${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch purchases');
      }
      const data = await res.json();
      const vouchers = data.data || [];

      // Debug: Check voucher types before filtering
      console.log('🔍 Voucher types found:', {
        folderName: 'purchase',
        allVoucherTypes: [...new Set(vouchers.map((v: any) => v.type))],
        vouchersBeforeFilter: vouchers.length,
      });

      // Filter customers to get suppliers for purchases
      const suppliers = customers.filter(
        (c: any) => c.partyType === 'supplier' || c.voucherType === 'purchase',
      );
      console.log('🔍 Suppliers found:', {
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length,
        supplierTypes: [...new Set(suppliers.map((c: any) => c.partyType))],
      });

      // Merge customer/supplier data with vouchers
      const enrichedPurchases = vouchers
        .filter((v: any) => {
          const matches = v.type === 'purchase';
          if (!matches) {
            console.log('❌ Voucher filtered out:', {
              id: v.id,
              type: v.type,
              expectedType: 'purchase',
              partyName: v.partyName,
            });
          }
          return matches;
        })
        .map((voucher: any) => {
          console.log('🔍 Processing voucher:', {
            id: voucher.id,
            partyName: voucher.partyName,
            partyId: voucher.partyId,
            type: voucher.type,
          });

          // Find matching customer/supplier using multiple strategies
          let party = null;

          // Strategy 1: Try to match by partyName first (most reliable for vouchers)
          if (voucher.partyName) {
            party = suppliers.find(
              (c: any) =>
                c.partyName?.toLowerCase() === voucher.partyName?.toLowerCase(),
            );
            if (party) {
              console.log('✅ Matched by exact partyName:', party.partyName);
            }
          }

          // Strategy 2: Try partial name matching if exact match didn't work
          if (!party && voucher.partyName) {
            party = suppliers.find(
              (c: any) =>
                c.partyName
                  ?.toLowerCase()
                  .includes(voucher.partyName?.toLowerCase()) ||
                voucher.partyName
                  ?.toLowerCase()
                  .includes(c.partyName?.toLowerCase()),
            );
            if (party) {
              console.log('✅ Matched by partial partyName:', party.partyName);
            }
          }

          // Strategy 3: Try to match by partyId as fallback (if it exists)
          if (!party && voucher.partyId) {
            party = suppliers.find((c: any) => c.id === voucher.partyId);
            if (party) {
              console.log('✅ Matched by partyId:', party.partyName);
            }
          }

          // If no match found, log it for debugging
          if (!party) {
            console.log('❌ No supplier match found for voucher:', {
              voucherId: voucher.id,
              voucherPartyName: voucher.partyName,
              availableSuppliers: suppliers.map((c: any) => ({
                id: c.id,
                name: c.partyName,
                partyType: c.partyType,
              })),
            });
          }

          return {
            ...voucher,
            partyName: party?.partyName || voucher.partyName || 'Unknown Party',
            partyPhone: party?.phoneNumber || voucher.partyPhone || '',
            partyAddress: party?.address || voucher.partyAddress || '',
            partyType: party?.partyType || 'supplier',
            // Add debug info
            _debug: {
              matched: !!party,
              matchedPartyId: party?.id,
              matchedPartyName: party?.partyName,
              originalPartyName: voucher.partyName,
            },
          };
        });

      setApiPurchases(enrichedPurchases);
      console.log(
        '✅ Fetched purchases with supplier data:',
        enrichedPurchases.length,
      );
    } catch (e: any) {
      setApiError(e.message || 'Error fetching purchases');
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    const initializePurchaseNumber = async () => {
      try {
        const nextNumber = await generateNextDocumentNumber('purchase');
        setPurchaseNumber(nextNumber);
      } catch (error) {
        console.error('Error initializing purchase number:', error);
        setPurchaseNumber('PUR-001');
      }
    };
    initializePurchaseNumber();
  }, []);

  const handleEditItem = (item: any) => {
    if (!item) {
      console.warn('handleEditItem: item is undefined or null');
      return;
    }
    setShowModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    setEditingItem(item);
    setShowCreateForm(true);
  };

  const addItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (
    id: string,
    field: keyof PurchaseItem,
    value: string | number,
  ) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };
        if (field === 'quantity' || field === 'rate') {
          const numValue =
            typeof value === 'string' ? parseFloat(value) : value;
          updatedItem[field] = isNaN(numValue) ? 0 : numValue;
          const subtotal = updatedItem.quantity * updatedItem.rate;
          const gstAmount = subtotal * (gstPct / 100);
          updatedItem.amount = subtotal + gstAmount;
        } else {
          (updatedItem as any)[field] = value;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const removeItem = (id: string) => {
    setItems((items || []).filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return (items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return sum + quantity * rate;
    }, 0);
  };

  const calculateGST = () => {
    return (items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const itemSubtotal = quantity * rate;
      const itemGST = itemSubtotal * (gstPct / 100);
      return sum + itemGST;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const gst = calculateGST();
    return subtotal + gst + taxAmount - discountAmount;
  };

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '₹0';
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#6c757d';
    switch (status) {
      case 'Paid':
        return '#28a745';
      case 'Pending':
        return '#ffc107';
      case 'Overdue':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const renderPurchaseItem = ({ item }: { item: any }) => {
    if (!item) {
      console.warn('renderPurchaseItem: item is undefined or null');
      return null;
    }

    return (
      <View
        style={[
          styles.invoiceCard,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => handleEditItem(item)}
          activeOpacity={0.8}
        >
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceNumber}>
              {item.purchaseNumber || `PUR-${item.id}`}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.customerName}>
            {item.partyName || 'Unknown Supplier'}
          </Text>
          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceDate}>
              {item.date?.slice(0, 10) || 'No Date'}
            </Text>
            <Text style={styles.invoiceAmount}>
              {formatCurrency(Number(item.amount) || 0)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.syncButton,
            item.syncYN === 'Y' && {
              backgroundColor: '#bdbdbd',
              borderColor: '#bdbdbd',
            },
          ]}
          onPress={() => handleSync(item)}
          activeOpacity={0.85}
          disabled={item.syncYN === 'Y'}
        >
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'Unknown';
    switch (status) {
      case 'complete':
        return 'Paid';
      case 'draft':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status || 'Unknown';
    }
  };

  const handleSync = async (item: any) => {
    if (!item || !item.id) {
      console.warn('handleSync: item or item.id is undefined');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const patchBody = { syncYN: 'Y' };
      const res = await fetch(`${BASE_URL}/vouchers/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error('Failed to sync');
      await fetchPurchases();
    } catch (e) {
      console.error('handleSync error:', e);
    }
  };

  const handleBackToList = async () => {
    setShowCreateForm(false);
    setEditingItem(null);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierAddress('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
    try {
      const nextPurchaseNumber = await generateNextDocumentNumber('purchase');
      setPurchaseNumber(nextPurchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      setPurchaseNumber('PUR-001');
    }
    setNotes('');
    setSupplier('');
    setTriedSubmit(false);
    setError(null);
  };

  const isFieldInvalid = (field: string, fieldType?: string) => {
    if (!triedSubmit) return false;
    if (fieldType === 'phone') {
      const phoneDigits = field.replace(/\D/g, '');
      return !field || phoneDigits.length < 10 || phoneDigits.length > 16;
    }
    if (fieldType === 'address') {
      return !field || field.trim().length < 10;
    }
    return !field;
  };

  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'purchaseDate':
        return !purchaseDate ? 'Date is required' : '';
      case 'supplier':
        return !supplier ? 'Supplier is required' : '';
      case 'supplierPhone':
        if (!supplierPhone) return 'Phone is required';
        const phoneDigits = supplierPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10)
          return 'Phone number must be at least 10 digits';
        if (phoneDigits.length > 16)
          return 'Phone number cannot exceed 16 digits';
        return '';
      case 'supplierAddress':
        if (!supplierAddress) return 'Address is required';
        if (supplierAddress.trim().length < 10)
          return 'Address must be at least 10 characters';
        return '';
      default:
        return '';
    }
  };

  const { customers, add, fetchAll } = useCustomerContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const purchaseNumberRef = useRef<TextInput>(null);
  const purchaseDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const itemRefs = useRef<{
    [itemId: string]: { [field: string]: TextInput | null };
  }>({});

  // Filtered purchases
  const filteredPurchases = apiPurchases;

  // Add missing functions for UploadDocument and filters
  const handleRecentSearchPress = (search: RecentSearch) => {
    setSearchFilter(prev => ({ ...prev, searchText: search.text }));
  };

  const startVoiceRecording = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs access to your microphone to record voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({
            title: 'Permission Denied',
            message: 'Microphone permission is required for voice recording.',
            type: 'error',
          });
          return;
        }
      }

      setIsRecording(true);
      setVoiceError(null);
      const result = await audioRecorderPlayer.startRecorder();
      console.log('Recording started:', result);
    } catch (error) {
      console.error('Error starting recording:', error);
      setVoiceError('Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      setIsRecording(false);
      const result = await audioRecorderPlayer.stopRecorder();
      console.log('Recording stopped:', result);
      await sendAudioForTranscription(result);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setVoiceError('Failed to stop recording');
    }
  };

  const sendAudioForTranscription = async (audioUri: string) => {
    try {
      setVoiceLoading(true);
      setVoiceError(null);

      // Simulate API call for voice transcription
      setTimeout(() => {
        const mockTranscription = `${folderName} from ABC Supplier for 5000 rupees with 18% GST on 15th January 2024`;
        setLastVoiceText(mockTranscription);
        setVoiceLoading(false);

        // Process the transcribed text
        processVoiceText(mockTranscription);
      }, 2000);
    } catch (error) {
      console.error('Error sending audio for transcription:', error);
      setVoiceError('Failed to transcribe audio');
      setVoiceLoading(false);
    }
  };

  const processVoiceText = (text: string) => {
    try {
      // Extract supplier name
      const supplierMatch = text.match(
        /from\s+([A-Za-z\s]+?)\s+(?:for|with|on)/i,
      );
      if (supplierMatch) {
        setSupplier(supplierMatch[1].trim());
      }

      // Extract amount
      const amountMatch = text.match(/(\d+)\s+rupees?/i);
      if (amountMatch) {
        const amount = parseInt(amountMatch[1]);
        if (items.length > 0) {
          updateItem(items[0].id, 'rate', amount);
        }
      }

      // Extract GST percentage
      const gstMatch = text.match(/(\d+)%\s*GST/i);
      if (gstMatch) {
        const gstPct = parseInt(gstMatch[1]);
        setGstPct(gstPct);
        // Recalculate all item amounts with new GST
        const updatedItems = items.map(item => ({
          ...item,
          amount: item.quantity * item.rate * (1 + gstPct / 100),
        }));
        setItems(updatedItems);
      }

      // Extract date
      const dateMatch = text.match(
        /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      );
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = dateMatch[2];
        const year = parseInt(dateMatch[3]);
        const monthIndex = new Date(`${month} 1, 2000`).getMonth();
        const date = new Date(year, monthIndex, day);
        setPurchaseDate(date.toISOString().split('T')[0]);
      }

      setNlpStatus('Voice data processed successfully');
    } catch (error) {
      console.error('Error processing voice text:', error);
      setVoiceError('Failed to process voice data');
    }
  };

  // Update GST percentage for all items
  const updateGstPctForAllItems = (value: number) => {
    const updatedItems = items.map(item => ({
      ...item,
      gstPct: value,
      amount: item.quantity * item.rate * (1 + value / 100),
    }));
    setItems(updatedItems);
  };

  const handleUploadDocument = () => {
    setShowFileTypeModal(true);
  };

  const handleFileTypeSelection = async (type: string) => {
    setShowFileTypeModal(false);
    setFileType(type);

    try {
      let result;
      if (type === 'image') {
        result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
        });
      } else if (type === 'pdf') {
        // This part of the code was removed as per the edit hint.
        // If DocumentPicker is no longer used, this block will be removed.
        // For now, keeping it as a placeholder.
        showAlert({
          title: 'Document Picker',
          message: 'Document picker is not available.',
          type: 'error',
        });
      } else if (type === 'excel') {
        // This part of the code was removed as per the edit hint.
        // If DocumentPicker is no longer used, this block will be removed.
        // For now, keeping it as a placeholder.
        showAlert({
          title: 'Document Picker',
          message: 'Document picker is not available.',
          type: 'error',
        });
      }

      if (result && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile(file);
        setDocumentName(file.fileName || 'Document');

        if (type === 'image' || type === 'pdf') {
          await processDocumentWithOCR(file);
        } else if (type === 'excel') {
          // This part of the code was removed as per the edit hint.
          // If DocumentPicker is no longer used, this block will be removed.
          // For now, keeping it as a placeholder.
          showAlert({
            title: 'Document Picker',
            message: 'Document picker is not available.',
            type: 'error',
          });
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to select file',
        type: 'error',
      });
    }
  };

  const processDocumentWithOCR = async (file: any) => {
    try {
      setOcrLoading(true);
      setOcrError(null);

      // Simulate OCR processing
      setTimeout(() => {
        const mockOcrText = `${folderName} Bill
        
Supplier: ABC Electronics Pvt Ltd
Phone: 9876543210
Address: 123 Tech Street, Bangalore, Karnataka 560001
GST Number: 29ABCDE1234F1Z5

Purchase Date: 15-01-2025
Bill Number: PB-2025-001

Items:
1. Laptop - Qty: 2, Rate: ₹45,000, GST: 18%, Amount: ₹106,200
2. Mouse - Qty: 5, Rate: ₹500, GST: 18%, Amount: ₹2,950
3. Keyboard - Qty: 3, Rate: ₹1,200, GST: 18%, Amount: ₹4,248

Subtotal: ₹113,400
Total GST: ₹20,412
Total Amount: ₹133,812

Notes: Delivery within 3 business days, warranty included for all items.`;
        setOcrLoading(false);

        // Process OCR text
        processOcrText(mockOcrText);
      }, 3000);
    } catch (error) {
      console.error('Error processing document with OCR:', error);
      setOcrError('Failed to process document');
      setOcrLoading(false);
    }
  };

  const processOcrText = (text: string) => {
    try {
      // Extract supplier name
      const supplierMatch = text.match(/Supplier:\s*([^\n]+)/i);
      if (supplierMatch) {
        setSupplier(supplierMatch[1].trim());
      }

      // Extract supplier phone
      const phoneMatch = text.match(/Phone:\s*(\d+)/i);
      if (phoneMatch) {
        setSupplierPhone(phoneMatch[1].trim());
      }

      // Extract supplier address
      const addressMatch = text.match(/Address:\s*([^\n]+)/i);
      if (addressMatch) {
        setSupplierAddress(addressMatch[1].trim());
      }

      // Extract amount
      const amountMatch = text.match(/Amount:\s*(\d+)/i);
      if (amountMatch) {
        const amount = parseInt(amountMatch[1]);
        if (items.length > 0) {
          updateItem(items[0].id, 'rate', amount);
        }
      }

      // Extract date
      const dateMatch = text.match(/Date:\s*(\d{2})-(\d{2})-(\d{4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = parseInt(dateMatch[3]);
        const date = new Date(year, month, day);
        setPurchaseDate(date.toISOString().split('T')[0]);
      }

      // Extract GST
      const gstMatch = text.match(/GST:\s*(\d+)%/i);
      if (gstMatch) {
        const gstPct = parseInt(gstMatch[1]);
        setGstPct(gstPct);
        // Recalculate all item amounts with new GST
        const updatedItems = items.map(item => ({
          ...item,
          amount: item.quantity * item.rate * (1 + gstPct / 100),
        }));
        setItems(updatedItems);
      }

      // Extract items from OCR text if available
      const itemsMatch = text.match(
        /Items:\s*([\s\S]*?)(?=Subtotal:|Total:|Notes:|$)/i,
      );
      if (itemsMatch) {
        const itemsText = itemsMatch[1];
        const itemLines = itemsText
          .split('\n')
          .filter(line => line.trim() && line.includes('-'));

        if (itemLines.length > 0) {
          const extractedItems = itemLines.map((line, index) => {
            // Parse item line: "1. Laptop - Qty: 2, Rate: ₹45,000, GST: 18%, Amount: ₹106,200"
            const descriptionMatch = line.match(/\d+\.\s*([^-]+)/);
            const qtyMatch = line.match(/Qty:\s*(\d+)/i);
            const rateMatch = line.match(/Rate:\s*₹?([\d,]+)/i);
            const gstMatch = line.match(/GST:\s*(\d+)%/i);
            const amountMatch = line.match(/Amount:\s*₹?([\d,]+)/i);

            return {
              id: (index + 1).toString(),
              description: descriptionMatch
                ? descriptionMatch[1].trim()
                : `Item ${index + 1}`,
              quantity: qtyMatch ? parseInt(qtyMatch[1]) : 1,
              rate: rateMatch ? parseFloat(rateMatch[1].replace(/,/g, '')) : 0,

              amount: amountMatch
                ? parseFloat(amountMatch[1].replace(/,/g, ''))
                : 0,
            };
          });

          setItems(extractedItems);
        }
      }

      // Extract notes
      const notesMatch = text.match(/Notes:\s*([^\n]+)/i);
      if (notesMatch) {
        setNotes(notesMatch[1].trim());
      }

      setShowPopup(true);
      setPopupTitle('OCR Processing Complete');
      setPopupMessage(
        `${folderName.toLowerCase()} bill data has been extracted and filled into the form successfully.`,
      );
      setPopupType('success');
    } catch (error) {
      console.error('Error processing OCR text:', error);
      setOcrError('Failed to process OCR data');
    }
  };

  const processExcelFile = async (file: any) => {
    try {
      // Simulate Excel processing
      setTimeout(() => {
        const mockExcelData = {
          supplier: 'Excel Electronics Ltd',
          phone: '8765432109',
          address: '456 Business Park, Mumbai, Maharashtra 400001',
          date: '20-01-2025',
          items: [
            {
              description: 'Desktop Computer',
              quantity: 3,
              rate: 35000,
              amount: 123900,
            },
            {
              description: 'Monitor 24"',
              quantity: 3,
              rate: 8000,
              amount: 28320,
            },
            {
              description: 'UPS 1KVA',
              quantity: 3,
              rate: 3000,
              amount: 10620,
            },
          ],
          notes: 'Bulk order for office setup, delivery required by month end',
        };

        // Fill form with Excel data
        setSupplier(mockExcelData.supplier);
        setSupplierPhone(mockExcelData.phone);
        setSupplierAddress(mockExcelData.address);

        // Parse date
        const [day, month, year] = mockExcelData.date.split('-');
        const excelDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        setPurchaseDate(excelDate.toISOString().split('T')[0]);

        // Set items
        const excelItems = mockExcelData.items.map((item, index) => ({
          id: (index + 1).toString(),
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }));
        setItems(excelItems);

        setNotes(mockExcelData.notes);

        setShowPopup(true);
        setPopupTitle('Excel Processing Complete');
        setPopupMessage(
          'Excel data has been extracted and filled into the form successfully.',
        );
        setPopupType('success');
      }, 2000);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to process Excel file',
        type: 'error',
      });
    }
  };

  const showCustomPopup = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // Utility functions for filtering
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }

  function inRange(num: number, min?: number, max?: number) {
    const n = Number(num);
    const minN = min !== undefined && min !== null ? Number(min) : undefined;
    const maxN = max !== undefined && max !== null ? Number(max) : undefined;
    if (minN !== undefined && n < minN) return false;
    if (maxN !== undefined && n > maxN) return false;
    return true;
  }

  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }

  // Enhanced filtering logic
  const getFilteredPurchases = () => {
    if (
      !searchFilter.searchText &&
      !searchFilter.amountMin &&
      !searchFilter.amountMax &&
      !searchFilter.dateFrom &&
      !searchFilter.dateTo &&
      !searchFilter.paymentMethod &&
      !searchFilter.status &&
      !searchFilter.reference &&
      !searchFilter.description
    ) {
      return apiPurchases;
    }

    return apiPurchases.filter(purchase => {
      // Text search
      if (searchFilter.searchText) {
        const searchLower = searchFilter.searchText.toLowerCase();
        const matchesSearch =
          fuzzyMatch(purchase.partyName || '', searchLower) ||
          fuzzyMatch(purchase.billNumber || '', searchLower) ||
          fuzzyMatch(purchase.notes || '', searchLower) ||
          fuzzyMatch(purchase.amount?.toString() || '', searchLower);

        if (!matchesSearch) return false;
      }

      // Amount range
      if (searchFilter.amountMin || searchFilter.amountMax) {
        if (
          !inRange(
            purchase.amount,
            searchFilter.amountMin,
            searchFilter.amountMax,
          )
        ) {
          return false;
        }
      }

      // Date range
      if (searchFilter.dateFrom || searchFilter.dateTo) {
        if (
          !inDateRange(
            purchase.date,
            searchFilter.dateFrom,
            searchFilter.dateTo,
          )
        ) {
          return false;
        }
      }

      // Payment method
      if (
        searchFilter.paymentMethod &&
        purchase.method !== searchFilter.paymentMethod
      ) {
        return false;
      }

      // Status
      if (searchFilter.status && purchase.status !== searchFilter.status) {
        return false;
      }

      // Reference
      if (
        searchFilter.reference &&
        !fuzzyMatch(purchase.billNumber || '', searchFilter.reference)
      ) {
        return false;
      }

      // Description
      if (
        searchFilter.description &&
        !fuzzyMatch(purchase.notes || '', searchFilter.description)
      ) {
        return false;
      }

      return true;
    });
  };

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);

    // Check transaction limits BEFORE making API call
    try {
      console.log('🔍 Checking transaction limits before purchase creation...');
      await forceCheckTransactionLimit();
    } catch (limitError) {
      console.error('❌ Error checking transaction limits:', limitError);
      // Continue with API call if limit check fails
    }

    // Validate required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      purchaseNumber,
      purchaseDate,
      supplier,
      supplierPhone,
      supplierAddress,
    });

    if (!purchaseDate || !supplier) {
      console.log('Required fields validation failed');
      setError('Please fill all required fields correctly.');
      return;
    }

    // Validate optional fields if they have values
    if (supplierPhone && isFieldInvalid(supplierPhone, 'phone')) {
      setError(
        'Phone number must be at least 10 digits and cannot exceed 16 digits.',
      );
      return;
    }

    if (supplierAddress && isFieldInvalid(supplierAddress, 'address')) {
      setError('Address must be at least 10 characters.');
      return;
    }
    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if supplier exists, if not, create
      let supplierNameToUse = supplier.trim();
      let existingSupplier = customers.find(
        c =>
          c.partyName?.trim().toLowerCase() === supplierNameToUse.toLowerCase(),
      );
      if (!existingSupplier) {
        const newSupplier = await add({ partyName: supplierNameToUse });
        if (newSupplier) {
          supplierNameToUse = newSupplier.partyName || '';
          await fetchAll('');
        }
      }
      const userId = await getUserIdFromToken();
      if (!userId) throw new Error('User not authenticated.');
      // Calculate GST, subtotal, total
      const subTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0,
      );
      const gstAmount = subTotal * (gstPct / 100);
      const totalAmount = subTotal + gstAmount;
      // API body
      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: 'purchase',
        amount: totalAmount.toFixed(2),
        date: new Date(purchaseDate).toISOString(),
        status,
        notes: notes || '',
        partyName: supplierNameToUse,
        partyPhone: supplierPhone,
        partyAddress: supplierAddress,
        items: items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        gstPct: gstPct, // Global GST percentage
        discount: discountAmount, // Discount amount
        cGST: taxAmount, // Tax amount (using cGST field)
      };

      // Clean the body object to only include fields that exist in backend schema
      const cleanBody = {
        user_id: body.user_id,
        type: body.type,
        amount: body.amount,
        date: body.date,
        status: body.status,
        notes: body.notes,
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        items: body.items,
        gstPct: body.gstPct,
        discount: body.discount,
        cGST: body.cGST,
        createdBy: body.createdBy,
        updatedBy: body.updatedBy,
      };
      const token = await AsyncStorage.getItem('accessToken');
      let res;
      if (editingItem) {
        // PATCH update: only send updatable, non-empty fields
        const patchBody: any = {};
        if (body.user_id) patchBody.user_id = body.user_id;
        if (body.type) patchBody.type = body.type;
        if (body.date) patchBody.date = body.date;
        if (body.amount) patchBody.amount = body.amount;
        if (body.status) patchBody.status = body.status;
        if (body.partyName) patchBody.partyName = body.partyName;
        if (body.partyPhone) patchBody.partyPhone = body.partyPhone;
        if (body.partyAddress) patchBody.partyAddress = body.partyAddress;
        // Remove invalid fields that don't exist in backend schema
        if (body.notes) patchBody.notes = body.notes;
        // Always include items for update
        patchBody.items = items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }));
        res = await fetch(`${BASE_URL}/vouchers/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patchBody),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error('PATCH failed:', err);
          throw new Error(err.message || 'Failed to update purchase.');
        }
      } else {
        // POST create: send full body
        res = await fetch(`${BASE_URL}/vouchers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(cleanBody),
        });
        if (res.ok) {
          const newVoucher = await res.json();
          appendVoucher(newVoucher.data || newVoucher);
        }
      }
      if (!res.ok) {
        const err = await res.json();

        // Check if it's a transaction limit error
        if (
          err.message?.includes('transaction limit') ||
          err.message?.includes('limit exceeded') ||
          err.message?.includes('Internal server error')
        ) {
          // Trigger transaction limit popup
          await forceShowPopup();
          setError(
            'Transaction limit reached. Please upgrade your plan to continue.',
          );
          return;
        }

        throw new Error(err.message || 'Failed to save purchase.');
      }
      // After success, refresh list, reset editingItem, and close form
      await fetchPurchases();
      setEditingItem(null);
      setShowCreateForm(false);
      resetForm();
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
      setShowModal(true);
    } finally {
      if (status === 'complete') setLoadingSave(false);
      if (status === 'draft') setLoadingDraft(false);
    }
  };

  // Add a helper to reset the form
  const resetForm = async () => {
    setSupplierName('');
    setSupplierPhone('');
    setSupplierAddress('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);

    // Auto-generate next purchase number
    try {
      const nextPurchaseNumber = await generateNextDocumentNumber('purchase');
      setPurchaseNumber(nextPurchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      setPurchaseNumber('PUR-001');
    }

    setNotes('');
    setSupplier('');
    setGstPct(18);
    setTaxAmount(0);
    setDiscountAmount(0);
    setTriedSubmit(false);
    setError(null);
    setLoadingSave(false);
    setLoadingDraft(false);
  };

  // In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem && showCreateForm) {
      const isoDate = editingItem.date
        ? new Date(editingItem.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const newGstPct =
        typeof editingItem.gstPct === 'number' && !isNaN(editingItem.gstPct)
          ? editingItem.gstPct
          : 18;

      // Map backend items (qty -> quantity) into local state shape
      const mappedItems: PurchaseItem[] = Array.isArray(editingItem.items)
        ? editingItem.items.map((it: any, index: number) => {
            const qty =
              it?.qty != null ? Number(it.qty) : Number(it?.quantity) || 1;
            const rate = it?.rate != null ? Number(it.rate) : 0;
            const amount =
              it?.amount != null
                ? Number(it.amount)
                : qty * rate * (1 + newGstPct / 100);
            return {
              id: (index + 1).toString(),
              description: it?.description || it?.name || '',
              quantity: isNaN(qty) ? 1 : qty,
              rate: isNaN(rate) ? 0 : rate,
              amount: isNaN(amount) ? 0 : amount,
            };
          })
        : [
            {
              id: '1',
              description: '',
              quantity: 1,
              rate: 0,
              amount: 0,
            },
          ];

      setSupplier(editingItem.partyName || '');
      setSupplierPhone(editingItem.partyPhone || '');
      setSupplierAddress(editingItem.partyAddress || '');
      setPurchaseDate(isoDate);
      setBillNumber(editingItem.billNumber || '');
      setItems(mappedItems);
      setNotes(editingItem.notes || '');
      setGstPct(newGstPct);
      setTaxAmount(Number(editingItem.cGST) || 0);
      setDiscountAmount(Number(editingItem.discount) || 0);
      setPurchaseNumber(
        editingItem.purchaseNumber || `PUR-${String(editingItem.id || '')}`,
      );
    } else if (!editingItem && showCreateForm) {
      // If not editing, reset to default
      setSupplierName('');
      setSupplierPhone('');
      setSupplierAddress('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setBillNumber('');
      setItems([
        {
          id: '1',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      setNotes('');
      setSupplier('');
      setGstPct(18);
      setTaxAmount(0);
      setDiscountAmount(0);
    }
  }, [editingItem, showCreateForm]);

  // Update filtered purchases after all functions are defined
  const enhancedFilteredPurchases = getFilteredPurchases();

  // Calculate filter badge count
  useEffect(() => {
    let count = 0;
    if (searchFilter.amountMin !== undefined) count++;
    if (searchFilter.amountMax !== undefined) count++;
    if (searchFilter.dateFrom) count++;
    if (searchFilter.dateTo) count++;
    if (searchFilter.paymentMethod) count++;
    if (searchFilter.status) count++;
    if (searchFilter.reference) count++;
    if (searchFilter.description) count++;
    setFilterBadgeCount(count);
  }, [searchFilter]);

  if (showCreateForm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#222"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create {folderName}</Text>
          </View>
        </View>
        <KeyboardAwareScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={120}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
        >
          {/* Upload Document Component */}
          <View style={{ alignItems: 'center' }}>
            <UploadDocument
              onUploadDocument={handleUploadDocument}
              onVoiceHelper={
                isRecording ? stopVoiceRecording : startVoiceRecording
              }
              folderName={folderName}
            />
          </View>

          {/* Show last voice response above Purchase Details */}
          {lastVoiceText && (
            <View
              style={{
                backgroundColor: '#f0f6ff',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#b3d1ff',
              }}
            >
              <Text style={{ color: '#222', fontSize: 15 }}>
                <Text style={{ fontWeight: 'bold', color: '#4f8cff' }}>
                  Voice Response:
                </Text>
                {lastVoiceText}
              </Text>
            </View>
          )}
          {voiceLoading && (
            <ActivityIndicator
              size="small"
              color="#222"
              style={{ marginTop: 8 }}
            />
          )}
          {voiceError ? (
            <Text style={{ color: 'red', marginTop: 8 }}>{voiceError}</Text>
          ) : null}
          {nlpStatus && !voiceError ? (
            <Text style={{ color: '#666', marginTop: 8, fontSize: 12 }}>
              {nlpStatus}
            </Text>
          ) : null}

          {/* OCR Loading and Error States */}
          {ocrLoading && (
            <View
              style={{
                backgroundColor: '#fff3cd',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#ffeaa7',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator
                size="small"
                color="#856404"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{ color: '#856404', fontSize: 14, fontWeight: '500' }}
              >
                Processing document with OCR...
              </Text>
            </View>
          )}
          {ocrError && (
            <View
              style={{
                backgroundColor: '#f8d7da',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#f5c6cb',
              }}
            >
              <Text style={{ color: '#721c24', fontSize: 14 }}>
                <Text style={{ fontWeight: 'bold' }}>OCR Error: </Text>
                {ocrError}
              </Text>
            </View>
          )}

          {/* Purchase Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{folderName} Details</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{folderName} Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <TextInput
                    ref={purchaseDateRef}
                    style={styles.input}
                    value={purchaseDate}
                    editable={false}
                    pointerEvents="none"
                    onFocus={() => {
                      if (scrollRef.current && purchaseDateRef.current) {
                        scrollRef.current.scrollToFocusedInput(
                          purchaseDateRef.current,
                          120,
                        );
                      }
                    }}
                  />
                </TouchableOpacity>
                {triedSubmit && !purchaseDate ? (
                  <Text style={styles.errorTextField}>Date is required.</Text>
                ) : null}
                {showDatePicker ? (
                  <DateTimePicker
                    value={new Date(purchaseDate)}
                    mode="date"
                    display="default"
                    onChange={(event: unknown, date?: Date | undefined) => {
                      setShowDatePicker(false);
                      if (date) {
                        setPurchaseDate(date.toISOString().split('T')[0]);
                      }
                    }}
                  />
                ) : null}
              </View>
            </View>
            {/* Supplier Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>{folderName} Supplier</Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 8,
                  backgroundColor: '#f9f9f9',
                  zIndex: 999999999,
                }}
              >
                <CustomerSelector
                  value={supplier}
                  onChange={(name, obj) => setSupplier(name)}
                  placeholder="Type or search supplier"
                  onCustomerSelect={supplierObj => {
                    console.log(
                      '🔍 PurchaseScreen: onCustomerSelect called with:',
                      supplierObj,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Setting supplier to:',
                      supplierObj.partyName,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Setting supplierPhone to:',
                      supplierObj.phoneNumber,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Setting supplierAddress to:',
                      supplierObj.address,
                    );

                    setSupplier(supplierObj.partyName || '');
                    setSupplierPhone(supplierObj.phoneNumber || '');
                    setSupplierAddress(supplierObj.address || '');
                  }}
                />
              </View>
              {triedSubmit && !supplier ? (
                <Text style={styles.errorTextField}>Supplier is required.</Text>
              ) : null}
            </View>
            {/* Phone Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={supplierPhone}
                onChangeText={setSupplierPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                maxLength={16}
              />
              {getFieldError('supplierPhone') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('supplierPhone')}
                </Text>
              ) : null}
            </View>
            {/* Address Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[
                  styles.input,
                  { minHeight: 60, textAlignVertical: 'top' },
                ]}
                value={supplierAddress}
                onChangeText={setSupplierAddress}
                placeholder="Supplier address"
                multiline
              />
              {getFieldError('supplierAddress') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('supplierAddress')}
                </Text>
              ) : null}
            </View>
            {/* GST Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>GST (%)</Text>
              <Dropdown
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 12,
                  backgroundColor: '#fff',
                  paddingHorizontal: 16,
                  height: 48,
                  marginTop: 4,
                }}
                data={GST_OPTIONS.map(opt => ({
                  label: `${opt}%`,
                  value: opt,
                }))}
                labelField="label"
                valueField="value"
                placeholder="Select GST %"
                value={gstPct}
                onChange={selectedItem => {
                  setGstPct(selectedItem.value);
                  // Recalculate all item amounts with new GST
                  const updatedItems = items.map(item => ({
                    ...item,
                    amount:
                      item.quantity *
                      item.rate *
                      (1 + selectedItem.value / 100),
                  }));
                  setItems(updatedItems);
                }}
                renderLeftIcon={() => (
                  <MaterialCommunityIcons
                    name="percent"
                    size={20}
                    color="#8a94a6"
                    style={{ marginRight: 8 }}
                  />
                )}
                selectedTextStyle={{ fontSize: 16, color: '#222' }}
                placeholderStyle={{ fontSize: 16, color: '#8a94a6' }}
                itemTextStyle={{ fontSize: 16, color: '#222' }}
                containerStyle={{
                  borderRadius: 12,
                  backgroundColor: '#f8fafc',
                }}
                activeColor="#f0f6ff"
                maxHeight={240}
              />
            </View>
          </View>
          {/* Items Card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Items</Text>
              <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>
            {items.map((item, index) => (
              <View style={styles.itemCard} key={index}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  ref={ref => {
                    if (!itemRefs.current) itemRefs.current = {};
                    if (!itemRefs.current[item?.id || ''])
                      itemRefs.current[item?.id || ''] = {};
                    itemRefs.current[item?.id || '']['description'] =
                      ref || null;
                  }}
                  style={styles.input}
                  value={item?.description || ''}
                  onChangeText={text =>
                    updateItem(item?.id || '', 'description', text)
                  }
                  placeholder="Item description"
                  onFocus={() => {
                    const inputRef =
                      (itemRefs.current || {})[item?.id || '']?.description ||
                      null;
                    if (scrollRef.current && inputRef) {
                      scrollRef.current.scrollToFocusedInput(inputRef, 120);
                    }
                  }}
                />
                {/* GST Field for each item */}

                <View style={styles.rowBetween}>
                  <View style={styles.flex1}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current) itemRefs.current = {};
                        if (!itemRefs.current[item?.id || ''])
                          itemRefs.current[item?.id || ''] = {};
                        itemRefs.current[item?.id || '']['quantity'] =
                          ref || null;
                      }}
                      style={styles.input}
                      value={item?.quantity?.toString() || '1'}
                      onChangeText={text =>
                        updateItem(
                          item?.id || '',
                          'quantity',
                          parseFloat(text) || 0,
                        )
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef =
                          (itemRefs.current || {})[item?.id || '']?.quantity ||
                          null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Rate (₹)</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current) itemRefs.current = {};
                        if (!itemRefs.current[item?.id || ''])
                          itemRefs.current[item?.id || ''] = {};
                        itemRefs.current[item?.id || '']['rate'] = ref || null;
                      }}
                      style={styles.input}
                      value={item?.rate?.toString() || '0'}
                      onChangeText={text =>
                        updateItem(
                          item?.id || '',
                          'rate',
                          parseFloat(text) || 0,
                        )
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef =
                          (itemRefs.current || {})[item?.id || '']?.rate ||
                          null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    <Text style={styles.inputLabel}>Amount (₹)</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current) itemRefs.current = {};
                        if (!itemRefs.current[item?.id || ''])
                          itemRefs.current[item?.id || ''] = {};
                        itemRefs.current[item?.id || '']['amount'] =
                          ref || null;
                      }}
                      style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                      value={formatCurrency(item?.amount || 0)}
                      editable={false}
                    />
                  </View>
                </View>
                {items.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.removeItemText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>

          {/* Amount Details Card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={18}
                  color="#333"
                  style={{ marginRight: 2 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    { fontSize: 18, fontWeight: '700', color: '#333' },
                  ]}
                >
                  Amount Details
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: '#e0e0e0',
                marginVertical: 12,
              }}
            />
            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: 6,
                      fontSize: 15,
                      color: '#555',
                      fontWeight: '600',
                    },
                  ]}
                >
                  Tax Amount
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      height: 40,
                      fontSize: 14,
                      paddingHorizontal: 12,
                      backgroundColor: '#fff',
                      borderColor: '#ddd',
                      borderWidth: 1,
                    },
                  ]}
                  value={taxAmount.toString()}
                  onChangeText={text => {
                    const value = parseFloat(text) || 0;
                    setTaxAmount(value);
                    // Recalculate total with new tax amount
                    const subtotal = calculateSubtotal();
                    const gst = calculateGST();
                    const total = subtotal + gst + value - discountAmount;
                    // Update items with new amounts
                    const updatedItems = items.map(item => ({
                      ...item,
                      amount: item.quantity * item.rate * (1 + gstPct / 100),
                    }));
                    setItems(updatedItems);
                  }}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.flex1, { marginLeft: 16 }]}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: 6,
                      fontSize: 15,
                      color: '#555',
                      fontWeight: '600',
                    },
                  ]}
                >
                  Discount Amount
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      height: 40,
                      fontSize: 14,
                      paddingHorizontal: 12,
                      backgroundColor: '#fff',
                      borderColor: '#ddd',
                      borderWidth: 1,
                    },
                  ]}
                  value={discountAmount.toString()}
                  onChangeText={text => {
                    const value = parseFloat(text) || 0;
                    setDiscountAmount(value);
                    // Recalculate total with new discount amount
                    const subtotal = calculateSubtotal();
                    const gst = calculateGST();
                    const total = subtotal + gst + taxAmount - value;
                    // Update items with new amounts
                    const updatedItems = items.map(item => ({
                      ...item,
                      amount: item.quantity * item.rate * (1 + gstPct / 100),
                    }));
                    setItems(updatedItems);
                  }}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {/* Summary */}
            <View
              style={{
                marginTop: 20,
                padding: 18,
                backgroundColor: '#f8f9fa',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#e9ecef',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 16, color: '#555', fontWeight: '600' }}
                >
                  Subtotal:
                </Text>
                <Text
                  style={{ fontSize: 16, color: '#222', fontWeight: '700' }}
                >
                  ₹{calculateSubtotal().toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 16, color: '#555', fontWeight: '600' }}
                >
                  GST ({gstPct}%):
                </Text>
                <Text
                  style={{ fontSize: 16, color: '#222', fontWeight: '700' }}
                >
                  ₹{calculateGST().toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 16, color: '#555', fontWeight: '600' }}
                >
                  Tax Amount:
                </Text>
                <Text
                  style={{ fontSize: 16, color: '#222', fontWeight: '700' }}
                >
                  ₹{taxAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 16, color: '#666', fontWeight: '600' }}
                >
                  Discount:
                </Text>
                <Text
                  style={{ fontSize: 16, color: '#666', fontWeight: '600' }}
                >
                  -₹{discountAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#dee2e6',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ fontSize: 18, color: '#222', fontWeight: '700' }}
                >
                  Total:
                </Text>
                <Text
                  style={{ fontSize: 18, color: '#222', fontWeight: '700' }}
                >
                  ₹{calculateTotal().toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
          {/* Notes Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <TextInput
              ref={notesRef}
              style={[
                styles.input,
                { minHeight: 60, textAlignVertical: 'top' },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes or terms..."
              multiline
              onFocus={() => {
                if (scrollRef.current && notesRef.current) {
                  scrollRef.current.scrollToFocusedInput(notesRef.current, 120);
                }
              }}
            />
          </View>
          {/* Action Buttons */}
          <View style={styles.actionButtonsBottom}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleSubmit('complete')}
              disabled={loadingSave}
            >
              <Text style={styles.primaryButtonText}>Save {folderName}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSubmit('draft')}
              disabled={loadingDraft}
            >
              <Text style={styles.secondaryButtonText}>Draft</Text>
            </TouchableOpacity>
          </View>
          {editingItem ? (
            <TouchableOpacity
              style={{
                backgroundColor: '#000',
                borderRadius: 8,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 8,
                marginBottom: 16,
              }}
              onPress={() => deletePurchase(editingItem.id)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Delete {folderName}
              </Text>
            </TouchableOpacity>
          ) : null}
        </KeyboardAwareScrollView>
        {/* Enhanced Error/Success Modal */}
        <Modal
          isVisible={showModal}
          animationIn="zoomIn"
          animationOut="zoomOut"
          animationInTiming={300}
          animationOutTiming={300}
          onBackdropPress={() => setShowModal(false)}
          style={{ justifyContent: 'center', margin: 20 }}
          backdropOpacity={0.7}
          useNativeDriver={true}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 32,
              alignItems: 'center',
              maxWidth: 380,
              width: '100%',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 20,
              },
              shadowOpacity: 0.3,
              shadowRadius: 30,
              elevation: 15,
            }}
          >
            {error ? (
              <>
                <View
                  style={{
                    backgroundColor: '#fee',
                    borderRadius: 50,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 2,
                    borderColor: '#fcc',
                  }}
                >
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={40}
                    color="#dc3545"
                  />
                </View>
                <Text
                  style={{
                    color: '#dc3545',
                    fontWeight: 'bold',
                    fontSize: 22,
                    marginBottom: 12,
                    textAlign: 'center',
                  }}
                >
                  Error
                </Text>
                <Text
                  style={{
                    color: '#333',
                    fontSize: 16,
                    marginBottom: 28,
                    textAlign: 'center',
                    lineHeight: 22,
                  }}
                >
                  {error}
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#dc3545',
                    paddingVertical: 16,
                    paddingHorizontal: 32,
                    borderRadius: 12,
                    alignItems: 'center',
                    shadowColor: '#dc3545',
                    shadowOffset: {
                      width: 0,
                      height: 4,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  onPress={() => setShowModal(false)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: 16,
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </Modal>

        {/* File Type Selection Modal */}
        <Modal
          isVisible={showFileTypeModal}
          onBackdropPress={() => setShowFileTypeModal(false)}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            margin: 0,
            padding: 0,
          }}
          backdropOpacity={0.6}
          useNativeDriver={true}
          propagateSwipe={true}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              maxHeight: '90%',
              minHeight: 600,
              width: '90%',
              alignSelf: 'center',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 10,
              },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: 'bold',
                  color: '#222',
                  textAlign: 'center',
                }}
              >
                Choose File Type
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#666',
                  textAlign: 'center',
                  lineHeight: 20,
                  marginTop: 8,
                }}
              >
                Select the type of file you want to upload for OCR processing
              </Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={{
                flex: 1,
                paddingHorizontal: 24,
              }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                paddingVertical: 20,
                paddingBottom: 40,
              }}
              nestedScrollEnabled={true}
              bounces={true}
              alwaysBounceVertical={false}
            >
              {/* File Type Options */}
              <View style={{ marginBottom: 20 }}>
                {/* Image Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('image')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#4f8cff',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="image"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#222',
                        marginBottom: 4,
                      }}
                    >
                      Image
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666',
                        lineHeight: 18,
                      }}
                    >
                      Upload {folderName.toLowerCase()} bill images (JPG, PNG)
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#4f8cff"
                  />
                </TouchableOpacity>

                {/* PDF Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('pdf')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#dc3545',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#222',
                        marginBottom: 4,
                      }}
                    >
                      PDF Document
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666',
                        lineHeight: 18,
                      }}
                    >
                      Upload PDF files for OCR processing
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#dc3545"
                  />
                </TouchableOpacity>
              </View>

              {/* Shared Example */}
              <View
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: '#e9ecef',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#222',
                    marginBottom: 12,
                  }}
                >
                  Real {folderName} Bill Example:
                </Text>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#dee2e6',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: 'bold',
                      color: '#222',
                      marginBottom: 8,
                      textAlign: 'center',
                    }}
                  >
                    {folderName} Bill
                  </Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{ fontSize: 12, color: '#666', lineHeight: 18 }}
                    >
                      <Text style={{ fontWeight: '600' }}>Purchase Date:</Text>
                      <Text> 2025-01-15{'\n'}</Text>
                      <Text style={{ fontWeight: '600' }}>Supplier Name:</Text>
                      <Text> ABC Electronics{'\n'}</Text>
                      <Text style={{ fontWeight: '600' }}>Phone:</Text>
                      <Text> 9876543210{'\n'}</Text>
                      <Text style={{ fontWeight: '600' }}>Address:</Text>
                      <Text> 123 Tech Street, Bangalore</Text>
                    </Text>
                  </View>

                  {/* Table Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#f8f9fa',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#222',
                        flex: 2,
                      }}
                    >
                      Description
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#222',
                        flex: 1,
                      }}
                    >
                      GST
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#222',
                        flex: 1,
                      }}
                    >
                      Qty
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#222',
                        flex: 1,
                      }}
                    >
                      Rate
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: '#222',
                        flex: 1,
                      }}
                    >
                      Amount
                    </Text>
                  </View>

                  {/* Table Rows */}
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#666', flex: 2 }}>
                        Laptop
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        18%
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        2
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        45000
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        106200.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#666', flex: 2 }}>
                        Mouse
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        18%
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        5
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        500
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        2950.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#666', flex: 2 }}>
                        Keyboard
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        18%
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        3
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        1200
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666', flex: 1 }}>
                        4248.00
                      </Text>
                    </View>
                  </View>

                  {/* Calculations */}
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#222',
                        marginBottom: 4,
                      }}
                    >
                      Calculations
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: '#666', lineHeight: 16 }}
                    >
                      <Text style={{ fontWeight: '600' }}>SubTotal:</Text>
                      <Text> ₹113,400{'\n'}</Text>
                      <Text style={{ fontWeight: '600' }}>Total GST:</Text>
                      <Text> ₹20,412{'\n'}</Text>
                      <Text style={{ fontWeight: '600' }}>Total:</Text>
                      <Text> ₹133,812</Text>
                    </Text>
                  </View>

                  {/* Notes */}
                  <View>
                    <Text
                      style={{ fontSize: 11, color: '#666', lineHeight: 16 }}
                    >
                      <Text style={{ fontWeight: '600' }}>Notes:</Text> Delivery
                      within 3 business days, warranty included for all items.
                    </Text>
                  </View>
                </View>

                {/* Tip */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginTop: 12,
                    backgroundColor: '#fff3cd',
                    borderRadius: 6,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: '#ffeaa7',
                  }}
                >
                  <MaterialCommunityIcons
                    name="lightbulb-outline"
                    size={16}
                    color="#ffc107"
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#856404',
                      marginLeft: 6,
                      flex: 1,
                      lineHeight: 16,
                    }}
                  >
                    Tip: Clear, well-lit images or text-based PDFs with
                    structured tables work best for OCR
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: '#f0f0f0',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderWidth: 1,
                  borderColor: '#dee2e6',
                  alignItems: 'center',
                }}
                onPress={() => setShowFileTypeModal(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#666',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main purchase list view
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{folderName}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <SearchAndFilter
        value={searchFilter}
        onChange={setSearchFilter}
        onFilterPress={() => setFilterVisible(true)}
        recentSearches={recentSearches}
        onRecentSearchPress={handleRecentSearchPress}
        filterBadgeCount={filterBadgeCount}
      />

      {/* Purchase List */}
      <View style={styles.listContainer}>
        {loadingApi && (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 40 }}
          />
        )}
        {!loadingApi && apiError && (
          <Text style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>
            {apiError.replace(/purchase/gi, folderName)}
          </Text>
        )}
        {!loadingApi && !apiError && enhancedFilteredPurchases.length === 0 && (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        )}
        {!loadingApi && !apiError && enhancedFilteredPurchases.length > 0 && (
          <FlatList
            data={[...enhancedFilteredPurchases].reverse()}
            renderItem={renderPurchaseItem}
            keyExtractor={item => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
      {/* Add Purchase Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => {
          setShowModal(false);
          setLoadingSave(false);
          setLoadingDraft(false);
          setShowCreateForm(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>

      {/* Advanced Filter Modal */}
      <Modal
        isVisible={filterVisible}
        onBackdropPress={() => setFilterVisible(false)}
        style={{ justifyContent: 'flex-end', margin: 0, marginBottom: 0 }}
      >
        <KeyboardAwareScrollView
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: '80%',
          }}
          contentContainerStyle={{ padding: 20 }}
          enableOnAndroid
          extraScrollHeight={120}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => setFilterVisible(false)}
            style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#222" />
          </TouchableOpacity>
          <Text
            style={{
              fontWeight: 'bold',
              fontSize: 18,
              marginBottom: 16,
              marginLeft: 40,
            }}
          >
            Filter {folderName}
          </Text>
          {/* Amount Range */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Amount Range</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
                marginRight: 8,
              }}
              placeholder="Min"
              keyboardType="numeric"
              value={searchFilter.amountMin?.toString() || ''}
              onChangeText={v =>
                setSearchFilter(f => ({
                  ...f,
                  amountMin: v ? Number(v) : undefined,
                }))
              }
            />
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
              }}
              placeholder="Max"
              keyboardType="numeric"
              value={searchFilter.amountMax?.toString() || ''}
              onChangeText={v =>
                setSearchFilter(f => ({
                  ...f,
                  amountMax: v ? Number(v) : undefined,
                }))
              }
            />
          </View>
          {/* Date Range */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Date Range</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
                marginRight: 8,
              }}
              onPress={() => setShowDatePickerFrom(true)}
            >
              <Text
                style={{
                  color: '#8a94a6',
                }}
              >
                From
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
              }}
              onPress={() => setShowDatePickerTo(true)}
            >
              <Text
                style={{
                  color: '#8a94a6',
                }}
              >
                To
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePickerFrom ? (
            <DateTimePicker
              value={new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePickerFrom(false);
                if (date)
                  setSearchFilter(f => ({
                    ...f,
                    dateFrom: date.toISOString().split('T')[0],
                  }));
              }}
            />
          ) : null}
          {showDatePickerTo ? (
            <DateTimePicker
              value={new Date()}
              mode="date"
              display="default"
              onChange={(event, date) => {
                setShowDatePickerTo(false);
                if (date)
                  setSearchFilter(f => ({
                    ...f,
                    dateTo: date.toISOString().split('T')[0],
                  }));
              }}
            />
          ) : null}
          {/* Payment Method filter */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: 12,
              marginTop: 8,
            }}
          >
            Payment Method
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 20,
              gap: 10,
            }}
          >
            {[
              'Cash',
              'Bank Transfer',
              'UPI',
              'Credit Card',
              'Debit Card',
              'Cheque',
            ].map((method, idx) => (
              <TouchableOpacity
                key={method}
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#d1d5db',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 75,
                }}
                onPress={() =>
                  setSearchFilter(f => ({
                    ...f,
                    paymentMethod: method,
                  }))
                }
              >
                <Text
                  style={{
                    color: '#6b7280',
                    fontSize: 14,
                    fontWeight: '500',
                    textAlign: 'center',
                  }}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Status Filter */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: 12,
            }}
          >
            Status
          </Text>
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 20,
              gap: 12,
            }}
          >
            {['', 'Paid', 'Pending'].map(status => (
              <TouchableOpacity
                key={status}
                style={{
                  flex: 1,
                  backgroundColor: '#ffffff',
                  borderColor: '#d1d5db',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setSearchFilter(f => ({ ...f, status: status }))}
              >
                <Text
                  style={{
                    color: '#6b7280',
                    fontSize: 14,
                    fontWeight: '500',
                    textTransform: 'capitalize',
                    textAlign: 'center',
                  }}
                >
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reference Number Filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>
            Reference Number
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
            }}
            placeholder="Reference number"
            value={searchFilter.reference || ''}
            onChangeText={v => setSearchFilter(f => ({ ...f, reference: v }))}
          />
          {/* Description/Notes Filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>
            Description/Notes
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
            }}
            placeholder="Description or notes keywords"
            value={searchFilter.description || ''}
            onChangeText={v => setSearchFilter(f => ({ ...f, description: v }))}
          />
          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginBottom: 0,
              marginTop: 12,
              gap: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setSearchFilter({ searchText: '' });
              }}
              style={{
                backgroundColor: '#f8f9fa',
                borderWidth: 1.5,
                borderColor: '#dc3545',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
              }}
            >
              <Text
                style={{
                  color: '#dc3545',
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                backgroundColor: '#4f8cff',
                borderWidth: 1.5,
                borderColor: '#4f8cff',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: 16,
                }}
              >
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </Modal>

      {/* Custom Popup */}
      <Modal
        isVisible={showPopup}
        onBackdropPress={() => setShowPopup(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        style={{ justifyContent: 'center', margin: 20 }}
        backdropOpacity={0.6}
        useNativeDriver={true}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 10,
            },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor:
                popupType === 'success'
                  ? '#d4edda'
                  : popupType === 'error'
                  ? '#f8d7da'
                  : '#d1ecf1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons
              name={
                popupType === 'success'
                  ? 'check-circle'
                  : popupType === 'error'
                  ? 'alert-circle'
                  : 'information'
              }
              size={32}
              color={
                popupType === 'success'
                  ? '#155724'
                  : popupType === 'error'
                  ? '#721c24'
                  : '#0c5460'
              }
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#222',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {popupTitle}
          </Text>

          {/* Message */}
          <Text
            style={{
              fontSize: 16,
              color: '#666',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
            }}
          >
            {popupMessage}
          </Text>

          {/* OK Button */}
          <TouchableOpacity
            style={{
              backgroundColor:
                popupType === 'success'
                  ? '#28a745'
                  : popupType === 'error'
                  ? '#dc3545'
                  : '#17a2b8',
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: 8,
              minWidth: 100,
            }}
            onPress={() => setShowPopup(false)}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: '#fff',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 12,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Purchase item styles
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#888',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 30,
    paddingHorizontal: 32,
    marginLeft: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Form styles
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center' as ViewStyle['alignItems'],
  },
  flex1: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f9f9f9',
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  errorTextField: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  fieldWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 8,
    color: '#222',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addItemText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: 'bold',
    fontSize: 16,
  },
  removeItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#dc3545',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  removeItemText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 14,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calcLabel: {
    fontSize: 16,
    color: '#666',
  },
  calcValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  calcTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  calcTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  actionButtonsBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#222',
    paddingVertical: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  addInvoiceButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4f8cff',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  addInvoiceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default PurchaseScreen;
