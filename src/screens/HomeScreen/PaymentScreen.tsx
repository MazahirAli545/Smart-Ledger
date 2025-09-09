import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  ViewStyle,
  TextStyle,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal'; // Add this import for bottom sheet modal
import axios from 'axios';
import { BASE_URL } from '../../api';
import { getToken, getUserIdFromToken } from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import { OCRService } from '../../services/ocrService';

import { RootStackParamList } from '../../types/navigation';
import UploadDocument from '../../components/UploadDocument';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomerSelector from '../../components/CustomerSelector';
import { useCustomerContext } from '../../context/CustomerContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PaymentScreen: React.FC<FolderProp> = ({ folder }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const folderName = folder?.title || 'Payment';

  // Add safety check and logging
  console.log(
    'PaymentScreen render - folder:',
    folder,
    'folderName:',
    folderName,
  );
  // Helper for pluralizing folder name
  const pluralize = (name: string) => {
    if (!name) return '';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] =
    useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const paymentMethodInputRef = useRef<TextInput>(null);
  // Add two loading states
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [apiPayments, setApiPayments] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  // FIX: Add the missing state variable and its setter function
  const [paymentNumber, setPaymentNumber] = useState('');

  // OCR and file upload state variables
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState('');
  const [fileType, setFileType] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);

  const scrollRef = useRef<KeyboardAwareScrollView>(null);

  const paymentDateRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const supplierPhoneRef = useRef<TextInput>(null);
  const supplierAddressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const [syncYN, setSyncYN] = useState('N');

  // Add filter state
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterAmount, setFilterAmount] = useState<'none' | 'asc' | 'desc'>(
    'none',
  );
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'complete' | 'draft' | 'overdue'
  >('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<string | null>(null);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);

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

  // Handler for recent search chip click
  const handleRecentSearchPress = (search: RecentSearch) => {
    setSearchFilter({ ...searchFilter, searchText: search.text });
  };

  // File upload and OCR processing functions
  const handleUploadDocument = () => {
    console.log('🔍 Upload Document button pressed');
    setShowFileTypeModal(true);
  };

  const handleFileTypeSelection = async (type: string) => {
    console.log('🔍 File type selection started:', type);
    console.log('🔍 DocumentPickerTypes available:', DocumentPickerTypes);
    setShowFileTypeModal(false);
    if (!type) return;
    try {
      let file: any = null;
      if (type === 'image') {
        const result = await launchImageLibrary({ mediaType: 'photo' });
        if (result.assets && result.assets.length > 0) {
          file = result.assets[0];
        }
      } else if (type === 'pdf' || type === 'excel') {
        try {
          const result = await pick({
            type:
              type === 'pdf'
                ? [DocumentPickerTypes.pdf]
                : [DocumentPickerTypes.xlsx, DocumentPickerTypes.xls],
          });

          // DocumentPicker.pick returns an array, so we need to handle it properly
          if (result && result.length > 0) {
            file = result[0];
          }
        } catch (pickerError: any) {
          if (pickerError?.code === 'DOCUMENT_PICKER_CANCELED') {
            console.log('👤 User cancelled document picker');
            return;
          }
          throw pickerError;
        }
      }
      if (!file) {
        console.log('👤 No file selected - user likely cancelled');
        return; // Don't show error modal when no file is selected
      }

      console.log('📄 File selected:', {
        fileName: file.fileName || file.name,
        uri: file.uri,
        type: file.type,
        size: file.size,
      });

      setSelectedFile(file);
      setDocumentName(file.fileName || file.name || '');
      setFileType(type.toUpperCase());
      if (type === 'image') {
        setOcrLoading(true);
        setOcrError(null);

        try {
          // Use backend OCR API instead of MLKit
          const text = await OCRService.extractTextFromImage(
            file.uri,
            file.fileName || file.name || 'image.jpg',
          );

          // Robust parsing for payment fields
          const parsed = parsePaymentOcrText(text);

          console.log('🔍 OCR Parsing Results:', {
            paymentNumber: parsed.paymentNumber,
            supplierName: parsed.supplierName,
            supplierPhone: parsed.supplierPhone,
            supplierAddress: parsed.supplierAddress,
            paymentDate: parsed.paymentDate,
            amount: parsed.amount,
            paymentMethod: parsed.paymentMethod,
            category: parsed.category,
            description: parsed.description,
            notes: parsed.notes,
          });

          if (parsed.paymentNumber) setPaymentNumber(parsed.paymentNumber);
          if (parsed.supplierName) setSupplierInput(parsed.supplierName);
          if (parsed.supplierPhone) setSupplierPhone(parsed.supplierPhone);
          if (parsed.supplierAddress) {
            console.log('📍 Setting supplier address:', parsed.supplierAddress);
            setSupplierAddress(parsed.supplierAddress);
          }
          if (parsed.paymentDate) setPaymentDate(parsed.paymentDate);
          if (parsed.amount) setAmount(parsed.amount);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          if (parsed.category) setCategory(parsed.category);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.notes) setNotes(parsed.notes);

          // Success - no need to show popup since we have the processing banner
          console.log('✅ OCR processing completed successfully');
        } catch (ocrErr) {
          console.error('❌ OCR processing failed:', ocrErr);
          setOcrError(
            ocrErr instanceof Error ? ocrErr.message : 'OCR processing failed',
          );
        } finally {
          setOcrLoading(false);
        }
      } else if (type === 'pdf') {
        setOcrLoading(true);
        setOcrError(null);

        try {
          console.log(
            '📄 Starting PDF processing for file:',
            file.fileName || file.name,
          );
          console.log('📄 File URI:', file.uri);

          // Use backend OCR API for PDF
          const text = await OCRService.extractTextFromPDF(
            file.uri,
            file.fileName || file.name || 'document.pdf',
          );

          console.log(
            '📄 PDF OCR Text extracted:',
            text ? text.substring(0, 200) + '...' : 'No text',
          );

          // Use the same robust parsing logic as images
          const parsed = parsePaymentOcrText(text);

          console.log('🔍 PDF OCR Parsing Results:', {
            paymentNumber: parsed.paymentNumber,
            supplierName: parsed.supplierName,
            supplierPhone: parsed.supplierPhone,
            supplierAddress: parsed.supplierAddress,
            paymentDate: parsed.paymentDate,
            amount: parsed.amount,
            paymentMethod: parsed.paymentMethod,
            category: parsed.category,
            description: parsed.description,
            notes: parsed.notes,
          });

          if (parsed.paymentNumber) setPaymentNumber(parsed.paymentNumber);
          if (parsed.supplierName) setSupplierInput(parsed.supplierName);
          if (parsed.supplierPhone) setSupplierPhone(parsed.supplierPhone);
          if (parsed.supplierAddress) {
            console.log(
              '📍 Setting supplier address from PDF:',
              parsed.supplierAddress,
            );
            setSupplierAddress(parsed.supplierAddress);
          }
          if (parsed.paymentDate) setPaymentDate(parsed.paymentDate);
          if (parsed.amount) setAmount(parsed.amount);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          if (parsed.category) setCategory(parsed.category);
          if (parsed.description) setDescription(parsed.description);
          if (parsed.notes) setNotes(parsed.notes);

          // Success - no need to show popup since we have the processing banner
          console.log('✅ PDF OCR processing completed successfully');
        } catch (ocrErr: any) {
          console.error('❌ PDF OCR processing failed:', ocrErr);
          console.error('❌ Error details:', {
            message: ocrErr?.message || 'Unknown error',
            stack: ocrErr?.stack || 'No stack trace',
            file: file.fileName || file.name,
          });

          // More specific error message based on the error type
          let errorMessage = 'Failed to process the PDF. Please try again.';
          const errorMsg = ocrErr?.message || '';

          if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
            errorMessage =
              'Network error. Please check your connection and try again.';
          } else if (
            errorMsg.includes('permission') ||
            errorMsg.includes('access')
          ) {
            errorMessage =
              'Permission denied. Please check file access permissions.';
          } else if (
            errorMsg.includes('format') ||
            errorMsg.includes('invalid')
          ) {
            errorMessage =
              'Invalid PDF format. Please try a different PDF file.';
          }

          setOcrError(errorMessage);
        } finally {
          setOcrLoading(false);
        }
      } else if (type === 'excel') {
        const b64 = await RNFS.readFile(file.uri, 'base64');
        const wb = XLSX.read(b64, { type: 'base64' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        if (data.length > 0) {
          // TODO: Implement Excel data mapping for payments
          console.log('📊 Excel data:', data[0]);
        }
      }
    } catch (err: any) {
      console.error('❌ File processing error:', err);

      // Check for user cancellation scenarios
      if (
        err?.code === 'DOCUMENT_PICKER_CANCELED' ||
        err?.message?.includes('cancelled') ||
        err?.message?.includes('canceled') ||
        err?.message?.includes('user cancelled') ||
        err?.message?.includes('user canceled')
      ) {
        console.log('👤 User cancelled file selection');
        return; // Don't show error modal for user cancellation
      }

      // Check for permission denied scenarios
      if (
        err?.message?.includes('permission') ||
        err?.message?.includes('access') ||
        err?.code === 'PERMISSION_DENIED'
      ) {
        console.log('🔒 Permission denied');
        setError('Permission denied. Please check file access permissions.');
        return;
      }

      // Check for network errors
      if (
        err?.message?.includes('network') ||
        err?.message?.includes('fetch') ||
        err?.message?.includes('connection')
      ) {
        console.log('🌐 Network error');
        setError('Network error. Please check your connection and try again.');
        return;
      }

      // Check for file format errors
      if (
        err?.message?.includes('format') ||
        err?.message?.includes('invalid') ||
        err?.message?.includes('unsupported')
      ) {
        console.log('📄 File format error');
        setError('Invalid file format. Please try a different file.');
        return;
      }

      // Check for file size errors
      if (
        err?.message?.includes('size') ||
        err?.message?.includes('large') ||
        err?.message?.includes('too big')
      ) {
        console.log('📏 File size error');
        setError('File too large. Please try a smaller file.');
        return;
      }

      // Only show generic error for unexpected errors
      console.error('❌ Unexpected error details:', {
        message: err?.message || 'Unknown error',
        code: err?.code || 'No code',
        stack: err?.stack || 'No stack trace',
      });
      setError('Failed to process the file. Please try again.');
    }
  };

  const { customers, add, fetchAll } = useCustomerContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup, getServiceStatus } =
    useTransactionLimit();

  // Function to close dropdowns when clicking outside
  const handleOutsideClick = () => {
    setShowPaymentMethodDropdown(false);
    setShowCategoryDropdown(false);
  };

  // Test function to debug transaction limit popup
  const testTransactionLimitPopup = async () => {
    try {
      console.log('🧪 Testing transaction limit popup...');
      const status = await getServiceStatus();
      console.log('📊 Service status:', status);
      await forceShowPopup();
      console.log('✅ Force popup called');
    } catch (error) {
      console.error('❌ Test error:', error);
    }
  };

  // Move fetchPayments to top-level so it can be called from handleSubmit
  const fetchPayments = async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');

      // First, fetch customers/suppliers to get party information
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

      // Then fetch vouchers for payments
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
      const vouchers = data.data || [];

      console.log('📊 Raw vouchers data:', {
        totalVouchers: vouchers.length,
        sampleVoucher: vouchers[0] || 'No vouchers',
        voucherFields: vouchers[0] ? Object.keys(vouchers[0]) : [],
        firstVoucher: vouchers[0]
          ? {
              id: vouchers[0].id,
              partyName: vouchers[0].partyName,
              partyId: vouchers[0].partyId,
              type: vouchers[0].type,
              amount: vouchers[0].amount,
              date: vouchers[0].date,
            }
          : null,
      });

      // Debug: Check voucher types before filtering
      console.log('🔍 Voucher types found:', {
        folderName: folderName.toLowerCase(),
        allVoucherTypes: [...new Set(vouchers.map((v: any) => v.type))],
        vouchersBeforeFilter: vouchers.length,
      });

      // Filter customers to get suppliers for payments
      const suppliers = customers.filter(
        (c: any) => c.partyType === 'supplier' || c.voucherType === 'payment',
      );
      console.log('🔍 Suppliers found:', {
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length,
        supplierTypes: [...new Set(suppliers.map((s: any) => s.partyType))],
      });

      // Merge customer/supplier data with vouchers
      const enrichedPayments = vouchers
        .filter((v: any) => {
          const matches = v.type === folderName.toLowerCase();
          if (!matches) {
            console.log('❌ Voucher filtered out:', {
              id: v.id,
              type: v.type,
              expectedType: folderName.toLowerCase(),
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
            partyType: party?.partyType || 'customer',
            // Add debug info
            _debug: {
              matched: !!party,
              matchedPartyId: party?.id,
              matchedPartyName: party?.partyName,
              originalPartyName: voucher.partyName,
            },
          };
        });

      setApiPayments(enrichedPayments);
      console.log(
        '✅ Fetched payments with supplier data:',
        enrichedPayments.length,
      );
    } catch (e: any) {
      console.error('❌ Error fetching payments:', e);
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    // Initialize payment number with auto-generated value
    const initializePaymentNumber = async () => {
      try {
        const nextNumber = await generateNextDocumentNumber(
          folderName.toLowerCase(),
        );
        setPaymentNumber(nextNumber);
      } catch (error) {
        console.error('Error initializing payment number:', error);
        // Fallback to default format
        setPaymentNumber('PAY-001');
      }
    };
    initializePaymentNumber();
  }, []);

  // 1. Add deletePayment function
  const deletePayment = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const res = await fetch(`${BASE_URL}/vouchers/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(
          err.message || `Failed to delete payment. Status: ${res.status}`,
        );
      }
      await fetchPayments();
      setShowCreateForm(false);
      setEditingItem(null);
      console.log('✅ Payment deleted successfully');
    } catch (e: any) {
      console.error('❌ Error deleting payment:', e);
      setError(e.message || 'Failed to delete payment.');
      setShowModal(true);
    }
  };

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
    setShowModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    setEditingItem(item);
    setShowCreateForm(true);
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      setPartyName(editingItem.partyName || '');
      setPaymentDate(
        editingItem.date
          ? editingItem.date.slice(0, 10)
          : new Date().toISOString().split('T')[0],
      );
      setAmount(editingItem.amount ? String(editingItem.amount) : '');
      setPaymentMethod(editingItem.method || '');
      setDescription(editingItem.description || '');
      setReference(editingItem.reference || '');
      setCategory(editingItem.category || '');
      setPaymentNumber(editingItem.billNumber || '');
      setSupplierInput(editingItem.partyName || '');
      setSupplierPhone(editingItem.partyPhone || '');
      setSupplierAddress(editingItem.partyAddress || '');
      setNotes(editingItem.notes || '');
    } else {
      setPartyName('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setPaymentMethod('');
      setDescription('');
      setReference('');
      setCategory('');
      // FIX: Ensure setPaymentNumber is called for new payments
      setPaymentNumber('');
      setSupplierInput('');
      setSupplierPhone('');
      setSupplierAddress('');
      setNotes('');
    }
  }, [editingItem, showCreateForm]);

  const paymentMethods = [
    'Cash',
    'Bank Transfer',
    'UPI',
    'Cheque',
    'Credit Card',
  ];
  const categories = ['Supplier', 'Expense', 'Salary', 'Rent', 'Other'];

  // Mock data for past payments
  const pastPayments = [
    {
      id: '1',
      paymentNumber: 'PAY-001',
      supplier: 'Supplier A',
      date: '2024-01-10',
      amount: 12000,
      status: 'Paid',
    },
    {
      id: '2',
      paymentNumber: 'PAY-002',
      supplier: 'Supplier B',
      date: '2024-01-18',
      amount: 22000,
      status: 'Pending',
    },
    {
      id: '3',
      paymentNumber: 'PAY-003',
      supplier: 'Supplier C',
      date: '2024-01-22',
      amount: 9000,
      status: 'Overdue',
    },
  ];

  const formatCurrency = (amount: number) => {
    if (!amount) return '';
    // Remove all non-numeric characters
    const numericValue = amount.toString().replace(/[^0-9]/g, '');
    // Format with Indian currency notation
    return `₹${parseInt(numericValue || '0', 10).toLocaleString('en-IN')}`;
  };

  // 4. When closing the form, reset editingItem
  const handleBackToList = async () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form data
    setPartyName('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setNotes('');
    setReference('');
    setCategory('Supplier');

    setSupplierInput('');
    setSupplierPhone('');
    setSupplierAddress('');
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  const handleAmountChange = (text: string) => {
    // Keep only digits
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
  };

  const handleOcrExtracted = (data: { text: string }) => {
    const { text } = data;
    // Improved regex-based extraction for the provided receipt format
    // Amount: $1,000.00 or 1000.00
    const amountMatch = text.match(/Amount\s*[:\-]?\s*\$?([\d,]+\.?\d*)/i);
    // Date: July 7, 2025
    const dateMatch = text.match(/([A-Za-z]+\s+\d{1,2},\s*\d{4})/);
    // Customer or Supplier
    const supplierMatch = text.match(
      /(?:Customer|Supplier)\s*[:\-]?\s*([A-Za-z ]+)/i,
    );
    // Description
    const descMatch = text.match(/Description\s*[:\-]?\s*([A-Za-z0-9 ,.-]+)/i);
    // Notes
    const notesMatch = text.match(/Notes\s*[:\-]?\s*([A-Za-z0-9 ,.-]+)/i);
    // Payment Method
    const paymentMethodMatch = text.match(
      /Payment Method\s*[:\-]?\s*([A-Za-z ]+)/i,
    );

    if (amountMatch && amountMatch[1])
      setAmount(amountMatch[1].replace(/,/g, ''));
    if (dateMatch && dateMatch[1]) {
      // Convert 'July 7, 2025' to '2025-07-07'
      const dateObj = new Date(dateMatch[1]);
      if (!isNaN(dateObj.getTime())) {
        setPaymentDate(dateObj.toISOString().split('T')[0]);
      }
    }
    if (supplierMatch && supplierMatch[1])
      setSupplierInput(supplierMatch[1].trim());
    if (descMatch && descMatch[1]) setDescription(descMatch[1].trim());
    if (notesMatch && notesMatch[1]) setNotes(notesMatch[1].trim());
    if (paymentMethodMatch && paymentMethodMatch[1])
      setPaymentMethod(paymentMethodMatch[1].trim());
  };

  // Add validation function before handleSavePayment
  const validatePayment = () => {
    if (
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod ||
      !category
    ) {
      return 'Please fill in all required fields.';
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return 'Amount must be a positive number.';
    }
    return null;
  };

  // Enhanced validation helpers
  const isFieldInvalid = (field: string, fieldType?: string) => {
    if (!triedSubmit) return false;

    if (fieldType === 'phone') {
      // Phone validation: should be at least 10 digits and max 16 digits
      const phoneDigits = field.replace(/\D/g, '');
      return !field || phoneDigits.length < 10 || phoneDigits.length > 16;
    }

    if (fieldType === 'address') {
      // Address validation: should be at least 10 characters
      return !field || field.trim().length < 10;
    }

    // Default validation: field should not be empty
    return !field;
  };

  // Add a helper for field-specific error messages
  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'paymentDate':
        return !paymentDate ? 'Date is required.' : '';
      case 'supplierInput':
        return !supplierInput ? `${folderName} Supplier is required.` : '';
      case 'amount':
        return !amount ? 'Amount is required.' : '';
      case 'paymentMethod':
        return !paymentMethod ? 'Payment method is required.' : '';
      case 'category':
        return !category ? 'Category is required.' : '';
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

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);

    // Check transaction limits BEFORE making API call
    try {
      console.log('🔍 Checking transaction limits before payment creation...');
      await forceCheckTransactionLimit();
    } catch (limitError) {
      console.error('❌ Error checking transaction limits:', limitError);
      // Continue with API call if limit check fails
    }

    // Validate required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      paymentDate,
      supplierInput,
      amount,
      paymentMethod,
      category,
      supplierPhone,
      supplierAddress,
    });

    if (
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod ||
      !category
    ) {
      console.log('Required fields validation failed');
      setError('Please fill all required fields correctly.');
      // triedSubmit will trigger red borders and error messages below fields
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
      let supplierNameToUse = supplierInput.trim();
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
      if (!userId) {
        setError('User not authenticated. Please login again.');
        return;
      }
      // API body
      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: folderName.toLowerCase(),
        amount: parseFloat(amount).toFixed(2),
        date: new Date(paymentDate).toISOString(),
        status,
        description: description || '',
        notes: notes || '',
        partyName: supplierNameToUse,
        partyPhone: supplierPhone || '',
        partyAddress: supplierAddress || '',
        method: paymentMethod,
        category: category || '',
        items: [],
      };

      // Clean the body object to only include fields that exist in backend schema
      const cleanBody = {
        user_id: body.user_id,
        type: body.type,
        amount: body.amount,
        date: body.date,
        status: body.status,
        description: body.description,
        notes: body.notes,
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        method: body.method,
        category: body.category,
        items: body.items,
        createdBy: body.createdBy,
        updatedBy: body.updatedBy,
      };
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
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
        if (cleanBody.method) patchBody.method = cleanBody.method;
        if (cleanBody.category) patchBody.category = cleanBody.category;
        if (cleanBody.description)
          patchBody.description = cleanBody.description;
        if (cleanBody.notes) patchBody.notes = cleanBody.notes;
        res = await fetch(`${BASE_URL}/vouchers/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patchBody),
        });
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
        const err = await res
          .json()
          .catch(() => ({ message: 'Unknown error occurred' }));

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

        throw new Error(
          err.message || `Failed to save payment. Status: ${res.status}`,
        );
      }
      setSuccess(
        editingItem
          ? 'Payment updated successfully!'
          : 'Payment saved successfully!',
      );
      // After success, refresh list, reset editingItem, and close form
      await fetchPayments();
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

  const handlePreview = () => {
    setError(null);
    setSuccess(null);
    setTriedSubmit(true);
    if (
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod ||
      !category
    ) {
      setError('Please fill all required fields before previewing.');
      return;
    }
    setSuccess('Preview ready! (Implement preview logic here)');
  };

  // Utility: Fuzzy match helper
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }

  // Utility: Numeric range match
  function inRange(
    num: number | string,
    min?: number | string,
    max?: number | string,
  ) {
    const n = Number(num);
    const minN =
      min !== undefined && min !== null && min !== '' ? Number(min) : undefined;
    const maxN =
      max !== undefined && max !== null && max !== '' ? Number(max) : undefined;
    if (minN !== undefined && n < minN) return false;
    if (maxN !== undefined && n > maxN) return false;
    return true;
  }

  // Utility: Date range match
  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }

  // Helper: Parse OCR text from payment image
  interface ParsedPaymentData {
    paymentNumber: string;
    paymentDate: string;
    supplierName: string;
    supplierPhone: string;
    supplierAddress: string;
    amount: string;
    paymentMethod: string;
    category: string;
    description: string;
    notes: string;
  }

  function parsePaymentOcrText(text: string): ParsedPaymentData {
    console.log('🔍 Starting payment OCR parsing...');
    console.log('📄 Raw OCR text:', text);

    // Clean the text
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();

    console.log('🧹 Cleaned text:', cleaned);

    // Initialize variables
    let paymentNumber = '';
    let paymentDate = '';
    let supplierName = '';
    let supplierPhone = '';
    let supplierAddress = '';
    let amount = '';
    let paymentMethod = '';
    let category = '';
    let description = '';
    let notes = '';

    // 1. Extract Payment Number
    const paymentNumberPatterns = [
      /Payment\s*Number\s*[:\-]?\s*([A-Z0-9\-]+)/i,
      /Payment\s*[:\-]?\s*([A-Z0-9\-]+)/i,
      /([A-Z]{2,4}-\d{5,})/i,
    ];

    for (const pattern of paymentNumberPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        paymentNumber = match[1]?.trim() || '';
        console.log('📋 Found Payment Number:', paymentNumber);
        break;
      }
    }

    // 2. Extract Payment Date
    const datePatterns = [
      /Payment\s*Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
      /Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
      /(\d{4}-\d{2}-\d{2})/,
    ];

    for (const pattern of datePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        paymentDate = match[1]?.trim() || '';
        console.log('📅 Found Payment Date:', paymentDate);
        break;
      }
    }

    // 3. Extract Supplier Name
    const supplierNamePatterns = [
      /Supplier\s*Name\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Phone|Address|Amount|Payment|Category|$)/i,
      /Supplier\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Phone|Address|Amount|Payment|Category|$)/i,
    ];

    for (const pattern of supplierNamePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        supplierName = match[1]?.trim() || '';
        console.log('👤 Found Supplier Name:', supplierName);
        break;
      }
    }

    // 4. Extract Supplier Phone
    const phonePatterns = [/Phone\s*[:\-]?\s*(\d{10,})/i, /(\d{10,})/];

    for (const pattern of phonePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        supplierPhone = match[1]?.trim() || '';
        console.log('📞 Found Supplier Phone:', supplierPhone);
        break;
      }
    }

    // 5. Extract Supplier Address
    const addressPatterns = [
      /Address\s*[:\-]?\s*([A-Za-z0-9\s,.-]+?)(?=\n|Amount|Payment|Category|Description|Notes|$)/i,
      /Location\s*[:\-]?\s*([A-Za-z0-9\s,.-]+?)(?=\n|Amount|Payment|Category|Description|Notes|$)/i,
    ];

    for (const pattern of addressPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        supplierAddress = match[1]?.trim() || '';
        // Clean up any remaining artifacts
        supplierAddress = supplierAddress
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/[^\w\s,.-]/g, '') // Remove special characters except common address chars
          .trim();
        console.log('📍 Found Supplier Address:', supplierAddress);
        break;
      }
    }

    // 6. Extract Amount
    const amountPatterns = [
      /Amount\s*[:\-]?\s*(\d+(?:\.\d{2})?)/i,
      /(\d+(?:\.\d{2})?)/,
    ];

    for (const pattern of amountPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        amount = match[1]?.trim() || '';
        console.log('💰 Found Amount:', amount);
        break;
      }
    }

    // 7. Extract Payment Method
    const paymentMethodPatterns = [
      /Payment\s*Method\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Category|Description|Notes|$)/i,
      /Method\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Category|Description|Notes|$)/i,
    ];

    for (const pattern of paymentMethodPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        paymentMethod = match[1]?.trim() || '';
        console.log('💳 Found Payment Method:', paymentMethod);
        break;
      }
    }

    // 8. Extract Category
    const categoryPatterns = [
      /Category\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Description|Notes|$)/i,
    ];

    for (const pattern of categoryPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        category = match[1]?.trim() || '';
        console.log('📂 Found Category:', category);
        break;
      }
    }

    // 9. Extract Description
    const descriptionPatterns = [
      /Description\s*[:\-]?\s*([^]+?)(?=\n|Notes|$)/i,
    ];

    for (const pattern of descriptionPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        description = match[1]?.trim() || '';
        // Clean up OCR artifacts from description
        description = description
          .replace(/[^\w\s,.-]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/\s*,\s*/g, ', ') // Fix comma spacing
          .trim();
        console.log('📝 Found Description:', description);
        break;
      }
    }

    // 10. Extract Notes
    const notesPatterns = [
      /Notes\s*[:\-]?\s*([^]+?)(?=\n|$)/i,
      /Remarks\s*[:\-]?\s*([^]+?)(?=\n|$)/i,
    ];

    for (const pattern of notesPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        notes = match[1]?.trim() || '';
        // Clean up OCR artifacts from notes
        notes = notes
          .replace(/[^\w\s,.-]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/\s*,\s*/g, ', ') // Fix comma spacing
          .trim();
        console.log('📝 Found Notes:', notes);
        break;
      }
    }

    return {
      paymentNumber,
      paymentDate,
      supplierName,
      supplierPhone,
      supplierAddress,
      amount,
      paymentMethod,
      category,
      description,
      notes,
    };
  }

  // Advanced fuzzy search and filter logic
  const filteredPayments = apiPayments.filter(pay => {
    // Fuzzy search across all fields
    const s = searchFilter.searchText?.trim().toLowerCase();
    const matchesFuzzy =
      !s ||
      [
        pay.paymentNumber,
        pay.billNumber,
        pay.partyName,
        pay.supplierName,
        pay.amount?.toString(),
        pay.date,
        pay.method,
        pay.status,
        pay.description,
        pay.notes,
        pay.reference,
        pay.category,
      ].some(field => field && field.toString().toLowerCase().includes(s));

    // Individual field filters
    const matchesPaymentNumber =
      !searchFilter.paymentNumber ||
      fuzzyMatch(
        pay.paymentNumber || pay.billNumber || '',
        searchFilter.paymentNumber,
      );
    const matchesSupplier =
      !searchFilter.supplierName ||
      fuzzyMatch(
        pay.partyName || pay.supplierName || '',
        searchFilter.supplierName,
      );
    const matchesAmount = inRange(
      Number(pay.amount),
      searchFilter.amountMin,
      searchFilter.amountMax,
    );
    const matchesDate = inDateRange(
      pay.date,
      searchFilter.dateFrom,
      searchFilter.dateTo,
    );
    const matchesMethod =
      !searchFilter.paymentMethod || pay.method === searchFilter.paymentMethod;
    const matchesStatus =
      !searchFilter.status || pay.status === searchFilter.status;
    const matchesCategory =
      !searchFilter.category || pay.category === searchFilter.category;
    // Reference number can be in pay.reference, pay.billNumber, or pay.paymentNumber
    const matchesReference =
      !searchFilter.reference ||
      [pay.reference, pay.billNumber, pay.paymentNumber].some(ref =>
        fuzzyMatch(ref || '', searchFilter.reference!),
      );
    const matchesDescription =
      !searchFilter.description ||
      fuzzyMatch(pay.description || pay.notes || '', searchFilter.description);

    return (
      matchesFuzzy &&
      matchesPaymentNumber &&
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

  // Map API status to badge color and label
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return '#28a745'; // Paid
      case 'draft':
        return '#ffc107'; // Pending
      case 'overdue':
        return '#dc3545'; // Overdue
      default:
        return '#6c757d';
    }
  };
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

  // Add a helper to reset the form
  const resetForm = async () => {
    setPartyName('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setNotes('');
    setReference('');
    setCategory('');

    setSupplierInput('');
    setSupplierPhone('');
    setSupplierAddress('');
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  // Add handleSync function
  const handleSync = async (item: any) => {
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
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(err.message || `Failed to sync. Status: ${res.status}`);
      }
      await fetchPayments();
      console.log('✅ Payment synced successfully');
    } catch (e: any) {
      console.error('❌ Sync error:', e.message);
      // Optionally show error to user
      setError(e.message || 'Failed to sync payment.');
    }
  };

  // Ensure renderPaymentItem is defined before FlatList usage
  const renderPaymentItem = ({ item }: { item: any }) => (
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
            {item.billNumber || `PAY-${item.id}`}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.customerName}>{item.partyName}</Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>{item.date?.slice(0, 10)}</Text>
          <Text style={styles.invoiceAmount}>
            {`₹${Number(item.amount).toLocaleString('en-IN')}`}
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

  if (showCreateForm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
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
            onUploadDocument={handleUploadDocument}
            onVoiceHelper={() => {
              console.log('Voice helper pressed');
            }}
            folderName={folderName}
          />

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
          {/* Payment Details Card */}
          <TouchableWithoutFeedback onPress={handleOutsideClick}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{folderName} Details</Text>
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{folderName} Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    <TextInput
                      ref={paymentDateRef}
                      style={[
                        styles.input,
                        isFieldInvalid(paymentDate) && { borderColor: 'red' },
                      ]}
                      value={paymentDate}
                      editable={false}
                      pointerEvents="none"
                      onFocus={() => {
                        if (scrollRef.current && paymentDateRef.current) {
                          scrollRef.current.scrollToFocusedInput(
                            paymentDateRef.current,
                            120,
                          );
                        }
                      }}
                    />
                  </TouchableOpacity>
                  {triedSubmit && !paymentDate && (
                    <Text style={styles.errorTextField}>Date is required.</Text>
                  )}
                  {showDatePicker && (
                    <DateTimePicker
                      value={new Date(paymentDate)}
                      mode="date"
                      display="default"
                      onChange={(event: unknown, date?: Date | undefined) => {
                        setShowDatePicker(false);
                        if (date)
                          setPaymentDate(date.toISOString().split('T')[0]);
                      }}
                    />
                  )}
                </View>
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>{folderName} Supplier</Text>
                <View
                  style={{
                    borderWidth: 1,
                    zIndex: 999999999,
                    borderColor: isFieldInvalid(supplierInput)
                      ? 'red'
                      : '#e0e0e0',
                    borderRadius: 8,
                    // overflow: 'hidden',
                  }}
                >
                  <CustomerSelector
                    value={supplierInput}
                    onChange={(name, obj) => setSupplierInput(name)}
                    placeholder={`Type or search supplier`}
                    scrollRef={scrollRef}
                    onCustomerSelect={supplier => {
                      console.log(
                        '🔍 PaymentScreen: onCustomerSelect called with:',
                        supplier,
                      );
                      console.log(
                        '🔍 PaymentScreen: Setting supplierInput to:',
                        supplier.partyName,
                      );
                      console.log(
                        '🔍 PaymentScreen: Setting supplierPhone to:',
                        supplier.phoneNumber,
                      );
                      console.log(
                        '🔍 PaymentScreen: Setting supplierAddress to:',
                        supplier.address,
                      );

                      setSupplierInput(supplier.partyName || '');
                      setSupplierPhone(supplier.phoneNumber || '');
                      setSupplierAddress(supplier.address || '');
                    }}
                  />
                </View>
                {isFieldInvalid(supplierInput) && (
                  <Text style={styles.errorTextField}>
                    Supplier is required.
                  </Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  ref={supplierPhoneRef}
                  style={[
                    styles.input,
                    isFieldInvalid(supplierPhone, 'phone') && {
                      borderColor: 'red',
                    },
                  ]}
                  value={supplierPhone}
                  onChangeText={setSupplierPhone}
                  placeholder="+91 98765 43210"
                  keyboardType="phone-pad"
                  maxLength={16}
                  onFocus={() => {
                    if (scrollRef.current && supplierPhoneRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        supplierPhoneRef.current,
                        120,
                      );
                    }
                  }}
                />
                {getFieldError('supplierPhone') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('supplierPhone')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  ref={supplierAddressRef}
                  style={[
                    styles.input,
                    { minHeight: 80, textAlignVertical: 'top' },
                    isFieldInvalid(supplierAddress, 'address') && {
                      borderColor: 'red',
                    },
                  ]}
                  value={supplierAddress}
                  onChangeText={setSupplierAddress}
                  placeholder="Supplier address"
                  multiline
                  onFocus={() => {
                    if (scrollRef.current && supplierAddressRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        supplierAddressRef.current,
                        120,
                      );
                    }
                  }}
                />
                {getFieldError('supplierAddress') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('supplierAddress')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <TextInput
                  ref={amountRef}
                  style={[
                    styles.input,
                    isFieldInvalid(amount) && { borderColor: 'red' },
                  ]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  onFocus={() => {
                    if (scrollRef.current && amountRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        amountRef.current,
                        120,
                      );
                    }
                  }}
                />
                {triedSubmit && !amount && (
                  <Text style={styles.errorTextField}>Amount is required.</Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Payment Method</Text>
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isFieldInvalid(paymentMethod)
                        ? 'red'
                        : '#e0e0e0',
                      paddingHorizontal: 10,
                      height: 48,
                      marginTop: 4,
                      justifyContent: 'space-between',
                    }}
                    onPress={() => {
                      setShowCategoryDropdown(false);
                      setShowPaymentMethodDropdown(!showPaymentMethodDropdown);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: paymentMethod ? '#222' : '#8a94a6',
                        flex: 1,
                      }}
                    >
                      {paymentMethod ? paymentMethod : 'Select payment method'}
                    </Text>
                    <MaterialCommunityIcons
                      name={
                        showPaymentMethodDropdown
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={24}
                      color="#8a94a6"
                    />
                  </TouchableOpacity>
                  {showPaymentMethodDropdown && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 52,
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        zIndex: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 8,
                        maxHeight: 250,
                      }}
                    >
                      <ScrollView
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 8 }}
                      >
                        {[
                          'Cash',
                          'Bank Transfer',
                          'UPI',
                          'Credit Card',
                          'Debit Card',
                          'Cheque',
                        ].map((method, index) => (
                          <TouchableOpacity
                            key={method}
                            onPress={() => {
                              setPaymentMethod(method);
                              setShowPaymentMethodDropdown(false);
                            }}
                            style={{
                              paddingVertical: 16,
                              paddingHorizontal: 20,
                              borderBottomWidth: index < 5 ? 1 : 0,
                              borderBottomColor: '#f0f0f0',
                              backgroundColor:
                                paymentMethod === method
                                  ? '#f0f6ff'
                                  : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 16,
                                color:
                                  paymentMethod === method ? '#4f8cff' : '#222',
                                fontWeight:
                                  paymentMethod === method ? '600' : '400',
                              }}
                            >
                              {method}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                {isFieldInvalid(paymentMethod) && (
                  <Text style={styles.errorTextField}>
                    Payment method is required.
                  </Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isFieldInvalid(category) ? 'red' : '#e0e0e0',
                      paddingHorizontal: 10,
                      height: 48,
                      marginTop: 4,
                      justifyContent: 'space-between',
                    }}
                    onPress={() => {
                      setShowPaymentMethodDropdown(false);
                      setShowCategoryDropdown(!showCategoryDropdown);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: category ? '#222' : '#8a94a6',
                        flex: 1,
                      }}
                    >
                      {category ? category : 'Select category'}
                    </Text>
                    <MaterialCommunityIcons
                      name={
                        showCategoryDropdown ? 'chevron-up' : 'chevron-down'
                      }
                      size={24}
                      color="#8a94a6"
                    />
                  </TouchableOpacity>
                  {showCategoryDropdown && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 52,
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#e0e0e0',
                        zIndex: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.1,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 8,
                        maxHeight: 250,
                      }}
                    >
                      <ScrollView
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 8 }}
                      >
                        {[
                          'Supplier',
                          'Expense',
                          'Salary',
                          'Rent',
                          'Utilities',
                          'Maintenance',
                          'Marketing',
                          'Travel',
                          'Office Supplies',
                          'Other',
                        ].map((cat, index) => (
                          <TouchableOpacity
                            key={cat}
                            onPress={() => {
                              setCategory(cat);
                              setShowCategoryDropdown(false);
                            }}
                            style={{
                              paddingVertical: 16,
                              paddingHorizontal: 20,
                              borderBottomWidth: index < 9 ? 1 : 0,
                              borderBottomColor: '#f0f0f0',
                              backgroundColor:
                                category === cat ? '#f0f6ff' : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 16,
                                color: category === cat ? '#4f8cff' : '#222',
                                fontWeight: category === cat ? '600' : '400',
                              }}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                {isFieldInvalid(category) && (
                  <Text style={styles.errorTextField}>
                    Category is required.
                  </Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={`Payment description`}
                />
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  ref={notesRef}
                  style={[
                    styles.input,
                    { minHeight: 60, textAlignVertical: 'top' },
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={`Additional notes...`}
                  multiline
                  onFocus={() => {
                    if (scrollRef.current && notesRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        notesRef.current,
                        120,
                      );
                    }
                  }}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>

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

          {/* Test Button for Transaction Limit Popup */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: '#ff6b6b', marginTop: 10 },
            ]}
            onPress={testTransactionLimitPopup}
          >
            <Text style={styles.primaryButtonText}>
              🧪 Test Transaction Limit Popup
            </Text>
          </TouchableOpacity>
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
              onPress={() => deletePayment(editingItem.id)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Delete {folderName}
              </Text>
            </TouchableOpacity>
          )}
          {success && (
            <Text style={{ color: 'green', textAlign: 'center', marginTop: 8 }}>
              {success}
            </Text>
          )}

          {/* File Type Selection Modal */}
          <Modal
            isVisible={showFileTypeModal}
            onBackdropPress={() => setShowFileTypeModal(false)}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            style={{ justifyContent: 'center', margin: 8 }}
            backdropOpacity={0.6}
            useNativeDriver={true}
            propagateSwipe={true}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 20,
                maxHeight: '95%',
                minHeight: 600,
                width: '95%',
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
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                    onPress={() => handleFileTypeSelection('image')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: '#f0f6ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="image"
                        size={24}
                        color="#4f8cff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#222',
                          marginBottom: 4,
                        }}
                      >
                        Image
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#666',
                          lineHeight: 20,
                        }}
                      >
                        Upload payment images (JPG, PNG) for OCR processing
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={24}
                      color="#ccc"
                    />
                  </TouchableOpacity>

                  {/* PDF Option */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                      flexDirection: 'row',
                      alignItems: 'center',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                    onPress={() => handleFileTypeSelection('pdf')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: '#fff3cd',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="file-pdf-box"
                        size={24}
                        color="#ffc107"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#222',
                          marginBottom: 4,
                        }}
                      >
                        PDF Document
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#666',
                          lineHeight: 20,
                        }}
                      >
                        Upload PDF payments for text extraction and processing
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={24}
                      color="#ccc"
                    />
                  </TouchableOpacity>
                </View>

                {/* Payment Template Example */}
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
                    Real Payment Example:
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
                      Payment
                    </Text>
                    <View style={{ marginBottom: 8 }}>
                      <Text
                        style={{ fontSize: 12, color: '#666', lineHeight: 18 }}
                      >
                        <Text style={{ fontWeight: '600' }}>
                          Payment Number:
                        </Text>
                        <Text> PAY-76575{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>Payment Date:</Text>
                        <Text> 2025-07-15{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>
                          Supplier Name:
                        </Text>
                        <Text> Rajesh Singh{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>Phone:</Text>
                        <Text> 917865434576{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>Address:</Text>
                        <Text> 404 Jack Palace, Switzerland{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>Amount:</Text>
                        <Text> 800{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>
                          Payment Method:
                        </Text>
                        <Text> Cash{'\n'}</Text>
                        <Text style={{ fontWeight: '600' }}>Category:</Text>
                        <Text> Sales</Text>
                      </Text>
                    </View>
                    {/* Description */}
                    <View style={{ marginBottom: 8 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#222',
                          marginBottom: 4,
                        }}
                      >
                        Description
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: '#666', lineHeight: 16 }}
                      >
                        That invoice is for basic thing that i sold
                      </Text>
                    </View>
                    {/* Notes */}
                    <View>
                      <Text
                        style={{ fontSize: 11, color: '#666', lineHeight: 16 }}
                      >
                        <Text style={{ fontWeight: '600' }}>Notes:</Text>
                        <Text> Weather is Clean, and air is fresh</Text>
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
                      Tip: Clear, well-lit images or text-based PDFs work best
                      for OCR
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
                {error ? (
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
                ) : null}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main payment list view
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

      {/* Filter Bottom Sheet */}
      {/* In the Filter Bottom Sheet, update to control all advanced filter parameters */}
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
            Filter Payments
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
          {/* Date Pickers */}
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
                  backgroundColor:
                    searchFilter.paymentMethod === method
                      ? '#e5e7eb'
                      : '#ffffff',
                  borderColor:
                    searchFilter.paymentMethod === method
                      ? '#9ca3af'
                      : '#d1d5db',
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
                    color:
                      searchFilter.paymentMethod === method
                        ? '#1f2937'
                        : '#6b7280',
                    fontSize: 14,
                    fontWeight:
                      searchFilter.paymentMethod === method ? '600' : '500',
                    textAlign: 'center',
                  }}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Status filter */}
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
                  backgroundColor:
                    (status === '' && !searchFilter.status) ||
                    searchFilter.status === status
                      ? '#e5e7eb'
                      : '#ffffff',
                  borderColor:
                    (status === '' && !searchFilter.status) ||
                    searchFilter.status === status
                      ? '#9ca3af'
                      : '#d1d5db',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, status: status || undefined }))
                }
              >
                <Text
                  style={{
                    color:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '#1f2937'
                        : '#6b7280',
                    fontSize: 14,
                    fontWeight:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '600'
                        : '500',
                    textTransform: 'capitalize',
                    textAlign: 'center',
                  }}
                >
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Category Filter */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: 12,
            }}
          >
            Category
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
              'Supplier',
              'Expense',
              'Salary',
              'Rent',
              'Utilities',
              'Maintenance',
              'Marketing',
              'Travel',
              'Office Supplies',
              'Other',
            ].map((cat, idx) => (
              <TouchableOpacity
                key={cat}
                style={{
                  backgroundColor:
                    searchFilter.category === cat ? '#e5e7eb' : '#ffffff',
                  borderColor:
                    searchFilter.category === cat ? '#9ca3af' : '#d1d5db',
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
                    category: cat,
                  }))
                }
              >
                <Text
                  style={{
                    color:
                      searchFilter.category === cat ? '#1f2937' : '#6b7280',
                    fontSize: 14,
                    fontWeight: searchFilter.category === cat ? '600' : '500',
                    textAlign: 'center',
                  }}
                >
                  {cat}
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
          {/* Reset/Apply buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              marginBottom: 20,
              marginTop: 12,
              gap: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => setSearchFilter({ searchText: '' })}
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
      {/* Payment List */}
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
        ) : filteredPayments.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        ) : (
          <FlatList
            data={[...filteredPayments].reverse()}
            renderItem={renderPaymentItem}
            keyExtractor={item => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
      {/* Add Payment Button */}
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
    </SafeAreaView>
  );
};

const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    // backgroundColor: '#fff',
    // borderRadius: 12,
    // padding: 16,
    // marginBottom: 16,
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
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
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
    fontWeight: 'normal',
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 14,
    color: '#666',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
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
  },
  addInvoiceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  dropdownItem: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 30, // further increased height
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
};

const styles: StyleSheet.NamedStyles<any> = StyleSheet.create({
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

  ...invoiceLikeStyles,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#222',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
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
});

export default PaymentScreen;
