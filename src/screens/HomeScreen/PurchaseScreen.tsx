import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ViewStyle } from 'react-native';
import { RootStackParamList } from '../../types/navigation';
import UploadDocument from '../../components/UploadDocument';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUserIdFromToken } from '../../utils/storage';
import Modal from 'react-native-modal';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api/index';
import SupplierSelector from '../../components/SupplierSelector';
import { useSupplierContext } from '../../context/SupplierContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';

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
const GST_PLACEHOLDER = 'Select GST %';

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PurchaseScreen: React.FC<FolderProp> = ({ folder }) => {
  const folderName = folder?.title || 'Purchase';
  // Helper for pluralizing folder name
  const pluralize = (name: string) => {
    if (!name) return '';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
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
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      id: '1',
      description: 'Item 1',
      quantity: 1,
      rate: 1000,
      amount: 1000,
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
  const [gstPct, setGstPct] = useState(18); // default 18%
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  // Add two loading states
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

  const [apiPurchases, setApiPurchases] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);

  // 1. Add deletePurchase function
  const deletePurchase = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      let query = '';
      if (folderName)
        query += `?type=${encodeURIComponent(folderName.toLowerCase())}`;
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

  // Move fetchPurchases to top-level so it can be called from handleSubmit
  const fetchPurchases = async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      let query = `?type=${encodeURIComponent(folderName.toLowerCase())}`;
      const res = await fetch(`${BASE_URL}/vouchers${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            `Failed to fetch ${folderName.toLowerCase()}s: ${res.status}`,
        );
      }
      const data = await res.json();
      // Only filter by type
      const filtered = (data.data || []).filter(
        (v: any) => v.type === folderName.toLowerCase(),
      );
      setApiPurchases(filtered);
    } catch (e: any) {
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
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
          updatedItem.amount =
            (field === 'quantity'
              ? isNaN(numValue)
                ? 0
                : numValue
              : updatedItem.quantity) *
            (field === 'rate'
              ? isNaN(numValue)
                ? 0
                : numValue
              : updatedItem.rate);
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
    setItems(items.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateGST = () => {
    return calculateSubtotal() * (gstPct / 100); // Assuming 18% GST
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST();
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
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

  // Ensure renderPurchaseItem is defined before FlatList usage
  const renderPurchaseItem = ({ item }: { item: any }) => (
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
            {item.billNumber || `PUR-${item.id}`}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>
        <Text style={styles.customerName}>{item.partyName}</Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>{item.date?.slice(0, 10)}</Text>
          <Text style={styles.invoiceAmount}>
            {formatCurrency(Number(item.amount))}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.syncButton}
        onPress={() => handleSync(item)}
        activeOpacity={0.85}
      >
        <Text style={styles.syncButtonText}>Sync</Text>
      </TouchableOpacity>
    </View>
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete':
        return 'Paid';
      case 'draft':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  };

  // Add handleSync function
  const handleSync = (item: any) => {
    console.log('Sync pressed for', item);
    // Placeholder for sync logic
  };

  // 4. When closing the form, reset editingItem
  const handleBackToList = () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form data
    setSupplierName('');
    setSupplierPhone('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: 'Item 1',
        quantity: 1,
        rate: 1000,
        amount: 1000,
      },
    ]);
    setPurchaseNumber('');
    setNotes('');
    setSupplier('');
  };

  // Validation helpers
  const isFieldInvalid = (field: string) => triedSubmit && !field;

  // API submit handler
  const handleSubmit = async (status: 'complete' | 'draft') => {
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);
    // Validate required fields BEFORE showing loader or calling API
    if (!purchaseNumber || !purchaseDate || !supplier) {
      setError('Please fill all required fields.');
      // triedSubmit will trigger red borders and error messages below fields
      return;
    }
    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if supplier exists, if not, create
      let supplierNameToUse = supplier.trim();
      let existingSupplier = suppliers.find(
        s => s.name.trim().toLowerCase() === supplierNameToUse.toLowerCase(),
      );
      if (!existingSupplier) {
        const newSupplier = await add({ name: supplierNameToUse });
        if (newSupplier) {
          supplierNameToUse = newSupplier.name;
          await fetchAll('');
        }
      }
      const userId = await getUserIdFromToken();
      if (!userId) throw new Error('User not authenticated.');
      // Calculate GST, subtotal, total
      const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = subTotal * (gstPct / 100);
      const totalAmount = subTotal + gstAmount;
      // API body
      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: folderName.toLowerCase(),
        amount: totalAmount.toFixed(2),
        date: new Date(purchaseDate).toISOString(),
        status,
        notes: notes || '', // Only send notes
        partyName: supplierNameToUse,
        partyPhone: '',
        partyAddress: '',
        billNumber: purchaseNumber, // <-- use billNumber
        invoiceNumber: '', // <-- clear invoiceNumber
        receiptNumber: '',
        method: '',
        category: '',
        gstNumber: '',
        items: items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
        })),
        cGST: (gstAmount / 2).toFixed(2),
        discount: '',
        documentDate: new Date(purchaseDate).toISOString(),
        gstPct: gstPct.toFixed(2),
        iGST: '0.00',
        sGST: (gstAmount / 2).toFixed(2),
        shippingAmount: '',
        subTotal: subTotal.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
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
        if (body.method) patchBody.method = body.method;
        if (body.invoiceNumber) patchBody.invoiceNumber = body.invoiceNumber;
        if (body.billNumber) patchBody.billNumber = body.billNumber;
        if (body.receiptNumber) patchBody.receiptNumber = body.receiptNumber;
        if (body.notes) patchBody.notes = body.notes;
        // Always include items for update
        patchBody.items = items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
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
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save purchase.');
      }
      setSuccess(
        editingItem
          ? 'Purchase updated successfully!'
          : 'Purchase saved successfully!',
      );
      setShowModal(true);
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
  const resetForm = () => {
    setSupplierName('');
    setSupplierPhone('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: 'Item 1',
        quantity: 1,
        rate: 1000,
        amount: 1000,
      },
    ]);
    setPurchaseNumber('');
    setNotes('');
    setSupplier('');
    setGstPct(18);
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      setSupplierName(editingItem.partyName || '');
      setSupplierPhone(editingItem.partyPhone || '');
      setPurchaseDate(
        editingItem.date
          ? editingItem.date.slice(0, 10)
          : new Date().toISOString().split('T')[0],
      );
      setBillNumber(editingItem.billNumber || '');
      setItems(
        editingItem.items && editingItem.items.length > 0
          ? editingItem.items.map((it: any, idx: number) => ({
              id: String(idx + 1),
              description: it.description || '',
              quantity: it.qty || 1,
              rate: it.rate || 0,
              amount: (it.qty || 1) * (it.rate || 0),
            }))
          : [{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }],
      );
      setPurchaseNumber(editingItem.billNumber || ''); // <-- use billNumber
      setNotes(editingItem.notes || '');
      setSupplier(editingItem.partyName || '');
      setGstPct(Number(editingItem.gstPct) || 18);
    } else {
      // If not editing, reset to default
      setSupplierName('');
      setSupplierPhone('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setBillNumber('');
      setItems([{ id: '1', description: '', quantity: 1, rate: 0, amount: 0 }]);
      setPurchaseNumber('');
      setNotes('');
      setSupplier('');
      setGstPct(18);
    }
  }, [editingItem, showCreateForm]);

  const { suppliers, add, fetchAll } = useSupplierContext();

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const purchaseNumberRef = useRef<TextInput>(null);
  const purchaseDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  // For dynamic items, use an array of refs
  const itemRefs = useRef<{ [key: string]: TextInput | null }>({});

  // Add new search/filter state
  const [searchFilter, setSearchFilter] = useState<PaymentSearchFilterState>({
    searchText: '',
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const filterBadgeCount = [
    searchFilter.paymentNumber,
    searchFilter.supplierName,
    searchFilter.amountMin,
    searchFilter.amountMax,
    searchFilter.dateFrom,
    searchFilter.dateTo,
    searchFilter.paymentMethod,
    searchFilter.status,
    searchFilter.description,
    searchFilter.reference,
    searchFilter.category,
  ].filter(Boolean).length;
  const [filterVisible, setFilterVisible] = useState(false);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);

  const handleRecentSearchPress = (search: RecentSearch) => {
    setSearchFilter({ ...searchFilter, searchText: search.text });
  };

  // Utility: Fuzzy match helper
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }
  function inRange(num: number, min?: number, max?: number) {
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  }
  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }
  // Advanced fuzzy search and filter logic
  const filteredPurchases = apiPurchases.filter(pur => {
    const s = searchFilter.searchText?.trim().toLowerCase();
    const matchesFuzzy =
      !s ||
      [
        pur.billNumber,
        pur.purchaseNumber,
        pur.partyName,
        pur.supplierName,
        pur.amount?.toString(),
        pur.date,
        (pur as any).method || '',
        pur.status,
        (pur as any).description || '',
        (pur as any).notes || '',
        (pur as any).reference || '',
        (pur as any).category || '',
      ].some(field => field && field.toString().toLowerCase().includes(s));
    const matchesPurchaseNumber =
      !searchFilter.paymentNumber ||
      fuzzyMatch(
        pur.purchaseNumber || pur.billNumber || '',
        searchFilter.paymentNumber,
      );
    const matchesSupplier =
      !searchFilter.supplierName ||
      fuzzyMatch(
        pur.partyName || pur.supplierName || '',
        searchFilter.supplierName,
      );
    const matchesAmount = inRange(
      Number(pur.amount),
      searchFilter.amountMin,
      searchFilter.amountMax,
    );
    const matchesDate = inDateRange(
      pur.date,
      searchFilter.dateFrom,
      searchFilter.dateTo,
    );
    const matchesMethod =
      !searchFilter.paymentMethod ||
      (pur as any).method === searchFilter.paymentMethod;
    const matchesStatus =
      !searchFilter.status || pur.status === searchFilter.status;
    const matchesCategory =
      !searchFilter.category || (pur as any).category === searchFilter.category;
    const matchesReference =
      !searchFilter.reference ||
      [(pur as any).reference, pur.billNumber, pur.purchaseNumber].some(ref =>
        fuzzyMatch(ref || '', searchFilter.reference!),
      );
    const matchesDescription =
      !searchFilter.description ||
      fuzzyMatch(
        (pur as any).description || (pur as any).notes || '',
        searchFilter.description,
      );
    return (
      matchesFuzzy &&
      matchesPurchaseNumber &&
      matchesSupplier &&
      matchesAmount &&
      matchesDate &&
      matchesMethod &&
      matchesStatus &&
      matchesCategory &&
      matchesReference &&
      matchesDescription
    );
  });

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
            <Text style={styles.headerTitle}>
              {editingItem ? `Edit ${folderName}` : `Create ${folderName}`}
            </Text>
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
          <UploadDocument
            onUploadDocument={() => {
              // TODO: Implement document upload logic
              console.log('Upload document pressed');
            }}
            onVoiceHelper={() => {
              // TODO: Implement voice helper logic
              console.log('Voice helper pressed');
            }}
            folderName={folderName}
          />
          {/* Purchase Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{folderName} Details</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>{folderName} Number</Text>
                <TextInput
                  ref={purchaseNumberRef}
                  style={[
                    styles.input,
                    isFieldInvalid(purchaseNumber) && { borderColor: 'red' },
                  ]}
                  value={purchaseNumber}
                  onChangeText={setPurchaseNumber}
                  editable
                  placeholder={`Enter ${folderName.toLowerCase()} number`}
                  onFocus={() => {
                    if (scrollRef.current && purchaseNumberRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        purchaseNumberRef.current,
                        120,
                      );
                    }
                  }}
                />
                {triedSubmit && !purchaseNumber ? (
                  <Text
                    style={styles.errorTextField}
                  >{`${folderName} Number is required`}</Text>
                ) : null}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>{folderName} Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <TextInput
                    ref={purchaseDateRef}
                    style={[
                      styles.input,
                      isFieldInvalid(purchaseDate) && { borderColor: 'red' },
                    ]}
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
                {triedSubmit && !purchaseDate && (
                  <Text style={styles.errorTextField}>Date is required.</Text>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(purchaseDate)}
                    mode="date"
                    display="default"
                    onChange={(event: unknown, date?: Date | undefined) => {
                      setShowDatePicker(false);
                      if (date)
                        setPurchaseDate(date.toISOString().split('T')[0]);
                    }}
                  />
                )}
              </View>
            </View>
            {/* Supplier Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>{folderName} Supplier</Text>
              <SupplierSelector
                value={supplier}
                onChange={(name, obj) => setSupplier(name)}
                placeholder={`Type or search supplier`}
                scrollRef={scrollRef}
              />
              {triedSubmit && !supplier ? (
                <Text style={styles.errorTextField}>Supplier is required.</Text>
              ) : null}
            </View>
            {/* GST Dropdown */}
            <View style={[styles.fieldWrapper, { zIndex: 100 }]}>
              {' '}
              {/* zIndex for dropdown overlap */}
              <Text style={styles.inputLabel}>GST (%)</Text>
              <View>
                <TouchableOpacity
                  ref={gstFieldRef}
                  style={{
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    borderRadius: 12,
                    backgroundColor: '#fff',
                    paddingHorizontal: 16,
                    height: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 4,
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    if (
                      gstFieldRef.current &&
                      typeof gstFieldRef.current.measureInWindow === 'function'
                    ) {
                      gstFieldRef.current.measureInWindow(
                        (x, y, width, height) => {
                          setGstDropdownLayout({
                            x,
                            y: y + height,
                            width,
                            height,
                          });
                          setGstDropdownOpen(true);
                        },
                      );
                    } else {
                      setGstDropdownOpen(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: gstPct === null ? '#8a94a6' : '#222',
                      flex: 1,
                    }}
                  >
                    {gstPct === null ? GST_PLACEHOLDER : `${gstPct}%`}
                  </Text>
                  <MaterialCommunityIcons
                    name={gstDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#8a94a6"
                  />
                </TouchableOpacity>
                {gstDropdownOpen && (
                  <Modal
                    isVisible={gstDropdownOpen}
                    onBackdropPress={() => setGstDropdownOpen(false)}
                    style={{ justifyContent: 'flex-end', margin: 0 }}
                  >
                    <View
                      style={{
                        position: 'absolute',
                        top: (() => {
                          const screenHeight = Dimensions.get('window').height;
                          const dropdownHeight = GST_OPTIONS.length * 48 + 8;
                          if (
                            gstDropdownLayout.y + dropdownHeight >
                            screenHeight
                          ) {
                            return Math.max(
                              0,
                              gstDropdownLayout.y -
                                dropdownHeight -
                                gstDropdownLayout.height,
                            );
                          }
                          return gstDropdownLayout.y;
                        })(),
                        left: gstDropdownLayout.x,
                        width: gstDropdownLayout.width,
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        shadowColor: '#000',
                        shadowOpacity: 0.08,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 8,
                        zIndex: 9999,
                        paddingVertical: 4,
                      }}
                    >
                      {GST_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={{
                            paddingVertical: 14,
                            paddingHorizontal: 24,
                            borderBottomWidth:
                              opt !== GST_OPTIONS[GST_OPTIONS.length - 1]
                                ? 1
                                : 0,
                            borderBottomColor: '#f0f0f0',
                          }}
                          onPress={() => {
                            setGstPct(opt);
                            setGstDropdownOpen(false);
                          }}
                        >
                          <Text style={{ fontSize: 16, color: '#222' }}>
                            {opt}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Modal>
                )}
              </View>
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
            {items.map(item => (
              <View style={styles.itemCard} key={item.id}>
                <Text style={styles.itemTitle}>
                  Item {items.indexOf(item) + 1}
                </Text>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  ref={ref => {
                    itemRefs.current[item.id] = ref || null;
                  }}
                  style={styles.input}
                  value={item.description}
                  onChangeText={text =>
                    updateItem(item.id, 'description', text)
                  }
                  placeholder="Item description"
                  onFocus={() => {
                    const inputRef = itemRefs.current[item.id] || null;
                    if (scrollRef.current && inputRef) {
                      scrollRef.current.scrollToFocusedInput(inputRef, 120);
                    }
                  }}
                />
                <View style={styles.rowBetween}>
                  <View style={styles.flex1}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={item.quantity.toString()}
                      onChangeText={text =>
                        updateItem(item.id, 'quantity', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef = itemRefs.current[item.id] || null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    {' '}
                    {/* Rate */}
                    <Text style={styles.inputLabel}>Rate (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={item.rate.toString()}
                      onChangeText={text =>
                        updateItem(item.id, 'rate', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef = itemRefs.current[item.id] || null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    {' '}
                    {/* Amount */}
                    <Text style={styles.inputLabel}>Amount (₹)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                      value={item.amount.toFixed(2)}
                      editable={false}
                    />
                  </View>
                </View>
                {items.length > 1 && (
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
                )}
              </View>
            ))}
          </View>
          {/* Calculations Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Calculations</Text>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Subtotal:</Text>
              <Text style={styles.calcValue}>
                {formatCurrency(calculateSubtotal())}
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>GST ({gstPct}%):</Text>
              <Text style={styles.calcValue}>
                {formatCurrency(calculateGST())}
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.calcTotalLabel}>Total:</Text>
              <Text style={styles.calcTotalValue}>
                {formatCurrency(calculateTotal())}
              </Text>
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
              placeholder={`Additional notes or terms...`}
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
              <Text style={styles.primaryButtonText}>
                {loadingSave ? 'Saving...' : `Save ${folderName}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSubmit('draft')}
              disabled={loadingDraft}
            >
              <Text style={styles.secondaryButtonText}>
                {loadingDraft ? 'Saving...' : 'Draft'}
              </Text>
            </TouchableOpacity>
          </View>
          {editingItem && (
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
          )}
        </KeyboardAwareScrollView>
        {/* Error/Success Modal */}
        <Modal isVisible={showModal}>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              style={{ width: '100%' }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  padding: 28,
                  alignItems: 'center',
                  maxWidth: 340,
                  width: '90%',
                  minHeight: 120,
                  flexShrink: 1,
                  overflow: 'visible',
                  justifyContent: 'center',
                }}
              >
                {loadingSave || loadingDraft ? (
                  <ActivityIndicator size="large" color="#4f8cff" />
                ) : error ? (
                  <>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={48}
                      color="#dc3545"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={{
                        color: '#dc3545',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginBottom: 8,
                      }}
                    >
                      Error
                    </Text>
                    <Text
                      style={{
                        color: '#222',
                        fontSize: 16,
                        marginBottom: 20,
                        textAlign: 'center',
                      }}
                    >
                      {error}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        {
                          backgroundColor: '#dc3545',
                          borderColor: '#dc3545',
                          width: 120,
                        },
                      ]}
                      onPress={() => setShowModal(false)}
                    >
                      <Text style={styles.primaryButtonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : success ? (
                  <>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={48}
                      color="#28a745"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={{
                        color: '#28a745',
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginBottom: 8,
                      }}
                    >
                      Success
                    </Text>
                    <Text
                      style={{
                        color: '#222',
                        fontSize: 16,
                        marginBottom: 20,
                        textAlign: 'center',
                      }}
                    >
                      {success}
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryButton, { width: 120 }]}
                      onPress={() => {
                        setShowModal(false);
                        setShowCreateForm(false);
                        resetForm();
                      }}
                    >
                      <Text style={styles.primaryButtonText}>OK</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            </ScrollView>
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
          <Text style={styles.headerTitle}>{pluralize(folderName)}</Text>
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
        {loadingApi ? (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 40 }}
          />
        ) : apiError ? (
          <Text style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>
            {apiError}
          </Text>
        ) : filteredPurchases.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        ) : (
          <FlatList
            data={filteredPurchases}
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
      {/* Add the advanced filter modal (same as PaymentScreen, adapted for purchases) */}
      <Modal
        isVisible={filterVisible}
        onBackdropPress={() => setFilterVisible(false)}
        style={{ justifyContent: 'flex-end', margin: 0 }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 20,
          }}
        >
          <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
            Filter {pluralize(folderName)}
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
              value={
                searchFilter.amountMin !== undefined
                  ? String(searchFilter.amountMin)
                  : ''
              }
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
              value={
                searchFilter.amountMax !== undefined
                  ? String(searchFilter.amountMax)
                  : ''
              }
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
                style={{ color: searchFilter.dateFrom ? '#222' : '#8a94a6' }}
              >
                {searchFilter.dateFrom || 'From'}
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
              <Text style={{ color: searchFilter.dateTo ? '#222' : '#8a94a6' }}>
                {searchFilter.dateTo || 'To'}
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePickerFrom && (
            <DateTimePicker
              value={
                searchFilter.dateFrom
                  ? new Date(searchFilter.dateFrom)
                  : new Date()
              }
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
          )}
          {showDatePickerTo && (
            <DateTimePicker
              value={
                searchFilter.dateTo ? new Date(searchFilter.dateTo) : new Date()
              }
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
          )}
          {/* Payment Method Dropdown */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Payment Method</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            {[
              '',
              'Cash',
              'Bank Transfer',
              'UPI',
              'Credit Card',
              'Debit Card',
              'Cheque',
            ].map(method => (
              <TouchableOpacity
                key={method}
                style={{
                  flex: 1,
                  backgroundColor:
                    searchFilter.paymentMethod === method
                      ? '#e6f0ff'
                      : '#f6fafc',
                  borderColor:
                    searchFilter.paymentMethod === method
                      ? '#4f8cff'
                      : '#e0e0e0',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  marginRight: method !== 'Cheque' ? 8 : 0,
                  alignItems: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({
                    ...f,
                    paymentMethod: method || undefined,
                  }))
                }
              >
                <Text style={{ color: '#222' }}>{method || 'All'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Status Filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Status</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            {['', 'complete', 'draft', 'overdue'].map(status => (
              <TouchableOpacity
                key={status}
                style={{
                  flex: 1,
                  backgroundColor:
                    searchFilter.status === status ? '#e6f0ff' : '#f6fafc',
                  borderColor:
                    searchFilter.status === status ? '#4f8cff' : '#e0e0e0',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  marginRight: status !== 'overdue' ? 8 : 0,
                  alignItems: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, status: status || undefined }))
                }
              >
                <Text style={{ color: '#222', textTransform: 'capitalize' }}>
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Category Filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Category</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            {['', 'Supplier', 'Expense', 'Salary', 'Rent', 'Other'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={{
                  flex: 1,
                  backgroundColor:
                    searchFilter.category === cat ? '#e6f0ff' : '#f6fafc',
                  borderColor:
                    searchFilter.category === cat ? '#4f8cff' : '#e0e0e0',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  marginRight: cat !== 'Other' ? 8 : 0,
                  alignItems: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, category: cat || undefined }))
                }
              >
                <Text style={{ color: '#222' }}>{cat || 'All'}</Text>
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
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, reference: v || undefined }))
            }
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
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, description: v || undefined }))
            }
          />
          {/* Actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => {
                setSearchFilter({ searchText: '' });
              }}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: '#dc3545', fontWeight: 'bold' }}>
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilterVisible(false)}>
              <Text style={{ color: '#4f8cff', fontWeight: 'bold' }}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Dropdown style enhancements
const dropdownStyles = {
  dropdown: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dropdownFocused: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  placeholderStyle: {
    fontSize: 17,
    color: '#8a94a6',
    fontWeight: '500',
  },
  selectedTextStyle: {
    fontSize: 17,
    color: '#222',
    fontWeight: '600',
  },
  iconStyle: {
    width: 28,
    height: 28,
    tintColor: '#000',
  },
  inputSearchStyle: {
    height: 44,
    fontSize: 16,
    backgroundColor: '#f0f6ff',
    borderRadius: 12,
    paddingLeft: 36,
    color: '#222',
  },
  containerStyle: {
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginTop: 4,
  },
  itemContainerStyle: {
    borderRadius: 12,
    marginVertical: 2,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  itemTextStyle: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
  selectedItemStyle: {
    backgroundColor: '#f0f6ff',
  },
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
    padding: 16, // Match InvoiceScreen
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
    marginLeft: 12, // match InvoiceScreen
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    height: 52,
    justifyContent: 'center',
  },
  picker: {
    height: 52,
    width: '100%',
    marginTop: -4,
    marginBottom: -4,
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
  removeItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#dc3545', // Bootstrap red
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
  iconButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
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
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222', // Match InvoiceScreen primary button
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
  placeholderStyle: {
    fontSize: 16,
  },
  selectedTextStyle: {
    fontSize: 16,
  },
  inputSearchStyle: {
    height: 40,
    fontSize: 16,
  },
  iconStyle: {
    width: 20,
    height: 20,
  },
  // Add a fieldWrapper style
  fieldWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  errorTextField: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 30, // further increased height
    paddingHorizontal: 32,
    marginLeft: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default PurchaseScreen;
