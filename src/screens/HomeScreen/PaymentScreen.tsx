import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import { BASE_URL } from '../../api/index';
import { getToken, getUserIdFromToken } from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../../types/navigation';
import UploadDocument from '../../components/UploadDocument';
import { SafeAreaView } from 'react-native-safe-area-context';
import SupplierSelector from '../../components/SupplierSelector';
import { useSupplierContext } from '../../context/SupplierContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';
import StatusBadge from '../../components/StatusBadge';

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PaymentScreen: React.FC<FolderProp> = ({ folder }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const folderName = folder?.title || 'Payment';
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
  const [category, setCategory] = useState('Supplier');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
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
  const paymentMethodInputRef = useRef<TextInput>(null);
  // Add two loading states
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [apiPayments, setApiPayments] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const paymentNumberRef = useRef<TextInput>(null);
  const paymentDateRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
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

  const { suppliers, add, fetchAll } = useSupplierContext();

  // Move fetchPayments to top-level so it can be called from handleSubmit
  const fetchPayments = async () => {
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
      setApiPayments(filtered);
    } catch (e: any) {
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // 1. Add deletePayment function
  const deletePayment = async (id: string) => {
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
        throw new Error(err.message || 'Failed to delete payment.');
      }
      await fetchPayments();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
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
      setCategory(editingItem.category || 'Supplier');
      setPaymentNumber(editingItem.billNumber || '');
      setSupplierInput(editingItem.partyName || '');
      setNotes(editingItem.notes || '');
    } else {
      setPartyName('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setPaymentMethod('');
      setDescription('');
      setReference('');
      setCategory('Supplier');
      setPaymentNumber(''); // <-- Ensure empty for new
      setSupplierInput('');
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
  const handleBackToList = () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form data
    setPartyName('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('Cash');
    setDescription('');
    setNotes('');
    setReference('');
    setCategory('Supplier');
    setPaymentNumber(`PAY-${Date.now()}`);
    setSupplierInput('');
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
      !paymentNumber ||
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod
    ) {
      return 'Please fill in all required fields.';
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return 'Amount must be a positive number.';
    }
    return null;
  };

  // Validation helpers
  const isFieldInvalid = (field: string) => triedSubmit && !field;

  // Add a helper for field-specific error messages
  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'paymentNumber':
        return !paymentNumber ? `${folderName} Number is required.` : '';
      case 'paymentDate':
        return !paymentDate ? 'Date is required.' : '';
      case 'supplierInput':
        return !supplierInput ? `${folderName} Supplier is required.` : '';
      case 'amount':
        return !amount ? 'Amount is required.' : '';
      case 'paymentMethod':
        return !paymentMethod ? 'Payment method is required.' : '';
      default:
        return '';
    }
  };

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);
    // Validate required fields BEFORE showing loader or calling API
    if (
      !paymentNumber ||
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod
    ) {
      setError('Please fill all required fields.');
      // triedSubmit will trigger red borders and error messages below fields
      return;
    }
    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if supplier exists, if not, create
      let supplierNameToUse = supplierInput.trim();
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
        partyPhone: '',
        partyAddress: '',
        billNumber: paymentNumber, // <-- use billNumber
        invoiceNumber: '', // <-- clear invoiceNumber
        receiptNumber: '',
        method: paymentMethod,
        category: '',
        gstNumber: '',
        items: [],
        cGST: '',
        discount: '',
        documentDate: new Date(paymentDate).toISOString(),
        gstPct: '',
        iGST: '',
        sGST: '',
        shippingAmount: '',
        subTotal: '',
        totalAmount: parseFloat(amount).toFixed(2),
        syncYN: syncYNOverride || syncYN || 'N',
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
        if (body.description) patchBody.description = body.description;
        if (body.notes) patchBody.notes = body.notes;
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
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save payment.');
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
      !paymentNumber ||
      !paymentDate ||
      !supplierInput ||
      !amount ||
      !paymentMethod
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
  function inRange(num: number, min?: number, max?: number) {
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
  const resetForm = () => {
    setPartyName('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setNotes('');
    setReference('');
    setCategory('Supplier');
    setPaymentNumber(`PAY-${Date.now()}`);
    setSupplierInput('');
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
      if (!res.ok) throw new Error('Failed to sync');
      await fetchPayments();
    } catch (e) {
      // Optionally show error
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
            {formatCurrency(Number(item.amount))}
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
              console.log('Upload document pressed');
            }}
            onVoiceHelper={() => {
              console.log('Voice helper pressed');
            }}
            folderName={folderName}
          />
          {/* Payment Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{folderName} Details</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>{folderName} Number</Text>
                <TextInput
                  ref={paymentNumberRef}
                  style={[
                    styles.input,
                    isFieldInvalid(paymentNumber) && { borderColor: 'red' },
                  ]}
                  value={paymentNumber}
                  onChangeText={setPaymentNumber}
                  editable
                  placeholder={`Enter ${folderName.toLowerCase()} number`}
                  onFocus={() => {
                    if (scrollRef.current && paymentNumberRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        paymentNumberRef.current,
                        120,
                      );
                    }
                  }}
                />
                {triedSubmit && !paymentNumber ? (
                  <Text
                    style={styles.errorTextField}
                  >{`${folderName} Number is required`}</Text>
                ) : null}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
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
              <SupplierSelector
                value={supplierInput}
                onChange={(name, obj) => setSupplierInput(name)}
                placeholder={`Type or search supplier`}
                scrollRef={scrollRef}
              />
              {triedSubmit && !supplierInput && (
                <Text style={styles.errorTextField}>Supplier is required.</Text>
              )}
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
                  onPress={() =>
                    setShowPaymentMethodDropdown(!showPaymentMethodDropdown)
                  }
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
                      showPaymentMethodDropdown ? 'chevron-up' : 'chevron-down'
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
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#e0e0e0',
                      zIndex: 10,
                      shadowColor: '#000',
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 4,
                    }}
                  >
                    {[
                      'Cash',
                      'Bank Transfer',
                      'UPI',
                      'Credit Card',
                      'Debit Card',
                      'Cheque',
                    ].map(method => (
                      <TouchableOpacity
                        key={method}
                        onPress={() => {
                          setPaymentMethod(method);
                          setShowPaymentMethodDropdown(false);
                        }}
                        style={{
                          paddingVertical: 14,
                          paddingHorizontal: 24,
                          borderBottomWidth: method !== 'Cheque' ? 1 : 0,
                          borderBottomColor: '#f0f0f0',
                        }}
                      >
                        <Text style={{ fontSize: 16, color: '#222' }}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              {triedSubmit && !paymentMethod && (
                <Text style={styles.errorTextField}>
                  Payment method is required.
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
        style={{ justifyContent: 'flex-end', margin: 0 }}
      >
        <KeyboardAwareScrollView
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
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
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Payment Method</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 16,
              justifyContent: 'space-between',
            }}
          >
            {[
              '',
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
                  width: '48%',
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
                  marginBottom: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({
                    ...f,
                    paymentMethod: method || undefined,
                  }))
                }
              >
                <Text
                  style={{
                    color: '#222',
                    fontSize: searchFilter.paymentMethod === method ? 16 : 15,
                    fontWeight:
                      searchFilter.paymentMethod === method ? 'bold' : '500',
                  }}
                >
                  {method || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Status filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Status</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            {['', 'Paid', 'Pending'].map(status => (
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
                  marginRight: status !== 'Pending' ? 8 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, status: status || undefined }))
                }
              >
                <Text
                  style={{
                    color: '#222',
                    fontSize: searchFilter.status === status ? 16 : 15,
                    fontWeight: searchFilter.status === status ? 'bold' : '500',
                  }}
                >
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Category Filter */}
          <Text style={{ fontSize: 15, marginBottom: 6 }}>Category</Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            {['', 'Suppliers', 'Customers'].map(cat => (
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
                  marginRight: cat !== 'Customers' ? 8 : 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, category: cat || undefined }))
                }
              >
                <Text
                  style={{
                    color: '#222',
                    fontSize: searchFilter.category === cat ? 16 : 15,
                    fontWeight: searchFilter.category === cat ? 'bold' : '500',
                  }}
                >
                  {cat || 'All'}
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
              justifyContent: 'flex-end',
              marginTop: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => setSearchFilter({ searchText: '' })}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 8,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#dc3545',
                marginRight: 12,
              }}
            >
              <Text
                style={{ color: '#dc3545', fontWeight: 'bold', fontSize: 16 }}
              >
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 8,
                backgroundColor: '#4f8cff',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
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
    color: '#28a745',
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
