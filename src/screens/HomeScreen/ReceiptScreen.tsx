import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
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
import axios from 'axios';
import { BASE_URL } from '../../api/index';
import { getToken, getUserIdFromToken } from '../../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import Modal from 'react-native-modal';
import StatusBadge from '../../components/StatusBadge';

interface Props {
  Onboarding: undefined;
  Dashboard: undefined;
  Invoice: undefined;
  Receipt: undefined;
  Payment: undefined;
  Purchase: undefined;
}

// Add new styles for Invoice-style UI
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
    marginBottom: 16,
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
    fontSize: 18,
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
    color: '#555',
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
    elevation: 8,
  },
  addInvoiceText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
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
    elevation: 8,
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
  // Add a fieldWrapper style
  fieldWrapper: {
    marginBottom: 16,
    width: '100%',
  },
});

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
    tintColor: '#4f8cff',
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

const dropdown1 = {
  marginTop: 12,
  height: 50,
  width: '100%',
  backgroundColor: '#fff',
  paddingHorizontal: 16,
  borderRadius: 12,
  borderColor: '#e3e7ee',
  borderWidth: 1.5,
  fontSize: 16,
};
const placeholderStyle1 = {
  fontSize: 15,
  color: '#8a94a6',
};
const selectedTextStyle1 = {
  fontSize: 15,
  color: '#222',
};
const inputSearchStyle1 = {
  height: 40,
  fontSize: 15,
  color: '#222',
  backgroundColor: '#f8fafc',
  borderRadius: 8,
  paddingLeft: 8,
  borderBottomColor: '#e3e7ee',
  borderBottomWidth: 1,
};
const iconStyle1 = {
  width: 24,
  height: 24,
};
const containerStyle1 = {
  marginTop: 10,
  borderRadius: 12,
  borderColor: '#e3e7ee',
  borderWidth: 1,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
  zIndex: 1000,
};
const itemContainerStyle1 = {
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#f0f0f0',
};
const dropdownItem = {
  padding: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const dropdownItemText = {
  fontSize: 15,
  color: '#222',
};

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const ReceiptScreen: React.FC<FolderProp> = ({ folder }) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const folderName = folder?.title || 'Receipt';
  // Helper for pluralizing folder name
  const pluralize = (name: string) => {
    if (!name) return '';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };
  // 1. Receipt Number: Remove initial value, add placeholder, only set value when editing
  const [receiptNumber, setReceiptNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customerInput, setCustomerInput] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isCustomerFocused, setIsCustomerFocused] = useState(false);
  const [isPaymentMethodFocused, setIsPaymentMethodFocused] = useState(false);
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] =
    useState(false);
  const paymentMethodInputRef = useRef<TextInput>(null);
  // Add showCustomerDropdown state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  // Add two loading states
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [apiReceipts, setApiReceipts] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [syncYN, setSyncYN] = useState('N');

  const { customers, add, fetchAll } = useCustomerContext();

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const receiptNumberRef = useRef<TextInput>(null);
  const receiptDateRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

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
  // Update inRange and inDateRange logic to allow only min or only from date
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
  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }
  // Advanced fuzzy search and filter logic
  const filteredReceipts = apiReceipts.filter(rec => {
    const s = searchFilter.searchText?.trim().toLowerCase();
    const matchesFuzzy =
      !s ||
      [
        rec.receiptNumber,
        rec.partyName,
        rec.amount?.toString(),
        rec.date,
        rec.method,
        rec.status,
        rec.description,
        rec.notes,
        rec.reference,
        rec.category,
      ].some(field => field && field.toString().toLowerCase().includes(s));
    const matchesReceiptNumber =
      !searchFilter.paymentNumber ||
      fuzzyMatch(rec.receiptNumber || '', searchFilter.paymentNumber);
    const matchesCustomer =
      !searchFilter.supplierName ||
      fuzzyMatch(rec.partyName || '', searchFilter.supplierName);
    const matchesAmount = inRange(
      Number(rec.amount),
      searchFilter.amountMin,
      searchFilter.amountMax,
    );
    const matchesDate = inDateRange(
      rec.date,
      searchFilter.dateFrom,
      searchFilter.dateTo,
    );
    const matchesMethod =
      !searchFilter.paymentMethod || rec.method === searchFilter.paymentMethod;
    const matchesStatus =
      !searchFilter.status || rec.status === searchFilter.status;
    const matchesCategory =
      !searchFilter.category || rec.category === searchFilter.category;
    const matchesReference =
      !searchFilter.reference ||
      [rec.reference, rec.receiptNumber].some(ref =>
        fuzzyMatch(ref || '', searchFilter.reference!),
      );
    const matchesDescription =
      !searchFilter.description ||
      fuzzyMatch(rec.description || rec.notes || '', searchFilter.description);
    return (
      matchesFuzzy &&
      matchesReceiptNumber &&
      matchesCustomer &&
      matchesAmount &&
      matchesDate &&
      matchesMethod &&
      matchesStatus &&
      matchesCategory &&
      matchesReference &&
      matchesDescription
    );
  });

  // Add missing isFieldInvalid helper
  const isFieldInvalid = (field: string) => triedSubmit && !field;

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
    setShowSuccessModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    setEditingItem(item);
    setShowCreateForm(true);
  };

  // Add missing handleBackToList function
  const handleBackToList = () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form fields
    setReceiptNumber(`REC-${Date.now()}`);
    setCustomerInput('');
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setNotes('');
    setReference('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  // Mock data for past receipts
  const pastReceipts = [
    {
      id: '1',
      receiptNumber: 'REC-001',
      customer: 'Customer A',
      date: '2024-01-10',
      amount: 12000,
      status: 'Paid',
    },
    {
      id: '2',
      receiptNumber: 'REC-002',
      customer: 'Customer B',
      date: '2024-01-18',
      amount: 22000,
      status: 'Pending',
    },
    {
      id: '3',
      receiptNumber: 'REC-003',
      customer: 'Customer C',
      date: '2024-01-22',
      amount: 9000,
      status: 'Overdue',
    },
  ];

  // Remove: const [customers, setCustomers] = useState([...]); and all dropdown logic for customers
  // Remove: const paymentMethods = [...];
  // Remove: const getStatusColor = (status: string) => {...}; and getStatusLabel = (status: string) => {...};

  // Add a helper to reset the form
  const resetForm = () => {
    setReceiptNumber(`REC-${Date.now()}`);
    setCustomerInput('');
    setAmount('');
    setPaymentMethod('');
    setDescription('');
    setNotes('');
    setReference('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  // Update handleSubmit to support PATCH (edit) and POST (create)
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);
    // Validate required fields BEFORE showing loader or calling API
    if (
      !receiptNumber ||
      !receiptDate ||
      !customerInput ||
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
      // Check if customer exists, if not, create
      let customerNameToUse = customerInput.trim();
      let existingCustomer = customers.find(
        c => c.name.trim().toLowerCase() === customerNameToUse.toLowerCase(),
      );
      if (!existingCustomer) {
        const newCustomer = await add({ name: customerNameToUse });
        if (newCustomer) {
          customerNameToUse = newCustomer.name;
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
        date: new Date(receiptDate).toISOString(),
        status,
        description: description || '',
        notes: notes || '',
        partyName: customerNameToUse,
        partyPhone: '',
        partyAddress: '',
        invoiceNumber: '',
        billNumber: '',
        receiptNumber,
        method: paymentMethod,
        category: '',
        gstNumber: '',
        items: [],
        cGST: '',
        discount: '',
        documentDate: new Date(receiptDate).toISOString(),
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
        throw new Error(err.message || 'Failed to save receipt.');
      }
      setSuccess(
        editingItem
          ? 'Receipt updated successfully!'
          : 'Receipt saved successfully!',
      );
      // After success, refresh list, reset editingItem, and close form
      await fetchReceipts();
      setEditingItem(null);
      setShowCreateForm(false);
      resetForm();
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      if (status === 'complete') setLoadingSave(false);
      if (status === 'draft') setLoadingDraft(false);
    }
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      setReceiptNumber(editingItem.receiptNumber || '');
      setCustomerInput(editingItem.partyName || '');
      setAmount(editingItem.amount ? String(editingItem.amount) : '');
      setPaymentMethod(editingItem.method || '');
      setDescription(editingItem.description || '');
      setNotes(editingItem.notes || '');
      setReference(editingItem.reference || '');
      setReceiptDate(
        editingItem.date
          ? editingItem.date.slice(0, 10)
          : new Date().toISOString().split('T')[0],
      );
    } else {
      setReceiptNumber('');
      setCustomerInput('');
      setAmount('');
      setPaymentMethod('');
      setDescription('');
      setNotes('');
      setReference('');
      setReceiptDate(new Date().toISOString().split('T')[0]);
    }
  }, [editingItem, showCreateForm]);

  // 1. Add deleteReceipt function
  const deleteReceipt = async (id: string) => {
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
        throw new Error(err.message || 'Failed to delete receipt.');
      }
      await fetchReceipts();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete receipt.');
    }
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
      await fetchReceipts();
    } catch (e) {
      // Optionally show error
    }
  };

  // Ensure renderReceiptItem is defined before FlatList usage
  const renderReceiptItem = ({ item }: { item: any }) => (
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
            {item.receiptNumber || `REC-${item.id}`}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.customerName}>{item.partyName}</Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>{item.date?.slice(0, 10)}</Text>
          <Text style={styles.invoiceAmount}>{item.amount}</Text>
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

  // Fetch receipts from API using type only
  const fetchReceipts = async () => {
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
      setApiReceipts(filtered);
    } catch (e: any) {
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  if (showCreateForm) {
    // Render the existing form, but replace the header back button
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
          {/* Receipt Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{folderName} Details</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>{folderName} Number</Text>
                <TextInput
                  ref={receiptNumberRef}
                  style={[
                    styles.input,
                    isFieldInvalid(receiptNumber) && { borderColor: 'red' },
                  ]}
                  value={receiptNumber}
                  onChangeText={setReceiptNumber}
                  editable
                  placeholder={`Enter ${folderName.toLowerCase()} number`}
                  onFocus={() => {
                    if (scrollRef.current && receiptNumberRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        receiptNumberRef.current,
                        120,
                      );
                    }
                  }}
                />
                {isFieldInvalid(receiptNumber) && (
                  <Text
                    style={styles.errorTextField}
                  >{`${folderName} Number is required`}</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <TextInput
                    ref={receiptDateRef}
                    style={[
                      styles.input,
                      isFieldInvalid(receiptDate) && { borderColor: 'red' },
                    ]}
                    value={receiptDate}
                    editable={false}
                    pointerEvents="none"
                    onFocus={() => {
                      if (scrollRef.current && receiptDateRef.current) {
                        scrollRef.current.scrollToFocusedInput(
                          receiptDateRef.current,
                          120,
                        );
                      }
                    }}
                  />
                </TouchableOpacity>
                {isFieldInvalid(receiptDate) && (
                  <Text style={styles.errorTextField}>Date is required.</Text>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(receiptDate)}
                    mode="date"
                    display="default"
                    onChange={(event: unknown, date?: Date | undefined) => {
                      setShowDatePicker(false);
                      if (date)
                        setReceiptDate(date.toISOString().split('T')[0]);
                    }}
                  />
                )}
              </View>
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>Customer</Text>
              <CustomerSelector
                value={customerInput}
                onChange={(name, obj) => setCustomerInput(name)}
                placeholder={`Type or search customer`}
                scrollRef={scrollRef}
              />
              {isFieldInvalid(customerInput) && (
                <Text style={styles.errorTextField}>Customer is required.</Text>
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
              {isFieldInvalid(amount) && (
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
              {isFieldInvalid(paymentMethod) && (
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
              onPress={() => deleteReceipt(editingItem.id)}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                Delete {folderName}
              </Text>
            </TouchableOpacity>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  // In the main receipt list view, show loading/error states
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
      {/* Add the advanced filter modal (same as PaymentScreen, adapted for receipts) */}
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
            Filter Receipts
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
          {/* Payment Method Filter */}
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
          {/* Status Filter */}
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
                    textTransform: 'capitalize',
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
      {/* Receipt List */}
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
        ) : filteredReceipts.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        ) : (
          <FlatList
            data={[...filteredReceipts].reverse()}
            renderItem={renderReceiptItem}
            keyExtractor={item => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
      {/* Add Receipt Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => {
          setShowCreateForm(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default ReceiptScreen;
