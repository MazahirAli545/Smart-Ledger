import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  ViewStyle,
  TextStyle,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
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
import { useAlert } from '../../context/AlertContext';

import { RootStackParamList } from '../../types/navigation';
// Removed SafeAreaView to allow full control over StatusBar area
import CustomerSelector from '../../components/CustomerSelector';
import { useCustomerContext } from '../../context/CustomerContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';
import Modal from 'react-native-modal';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { parseInvoiceVoiceText } from '../../utils/voiceParser';
import { profileUpdateManager } from '../../utils/profileUpdateManager';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { getStatusBarSpacerHeight } from '../../utils/statusBarManager';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import StableStatusBar from '../../components/StableStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uiColors, uiFonts } from '../../config/uiSizing';

interface Props {
  Onboarding: undefined;
  Dashboard: undefined;
  Invoice: undefined;
  Receipt: undefined;
  Payment: undefined;
  Purchase: undefined;
}

// Global scale helper for UI scaling rule - increase all dimensions by 2 units
const SCALE = 0.75; // Base scale to match reference screens
const scale = (value: number) => Math.round(value * SCALE);

const RECEIPT_LIST_PAGE_SIZE = 25;

const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {
  container: {
    flex: 1,
    padding: scale(16),
    paddingBottom: scale(120), // Adequate space for fixed buttons
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(16),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: scale(5),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  cardTitle: {
    fontSize: scale(23.5), // 18 + 2
    color: '#333333', // Card titles - black for maximum contrast
    marginBottom: scale(16),
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
    borderRadius: scale(8),
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    height: scale(52),
    justifyContent: 'center',
  },
  picker: {
    height: scale(52),
    width: '100%',
    marginTop: scale(-4),
    marginBottom: scale(-4),
  },
  actionButtonsContainer: {
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  fixedActionButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    paddingBottom: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  fullWidthButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  primaryButton: {
    backgroundColor: '#000',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: '#000',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: scale(22),
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginLeft: scale(8),
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    color: '#333333',
    fontSize: scale(18), // 16 + 2
  },

  iconButton: {
    backgroundColor: '#fff',
    padding: scale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(22),
    fontSize: scale(18),
    color: '#333333', // Input field text - black for better readability
    backgroundColor: '#f9f9f9',
    fontFamily: 'Roboto-Medium',
  },

  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: scale(8),
    fontFamily: 'Roboto-Medium',
  },

  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  invoiceNumber: {
    fontSize: scale(18), // 16 + 2
    color: '#333333', // Important text - black for maximum contrast
  },

  statusBadge: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(8),
    borderRadius: scale(5),
  },
  statusText: {
    color: '#fff',
    fontSize: scale(14), // 12 + 2
  },

  customerName: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
    marginBottom: scale(8),
    fontWeight: 'normal',
    fontFamily: 'Roboto-Medium',
    width: '85%',
  },

  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
  },

  invoiceAmount: {
    fontSize: scale(18), // 16 + 2

    color: '#333333', // Important text - black for maximum contrast
  },

  listContainer: {
    flex: 1,
    padding: scale(16),
  },
  listFooterLoader: {
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  addInvoiceButton: {
    position: 'absolute',
    bottom: scale(30),
    right: scale(30),
    backgroundColor: '#4f8cff',
    borderRadius: scale(28),
    paddingVertical: scale(16),
    paddingHorizontal: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: scale(8),
    shadowOffset: { width: 0, height: scale(4) },
  },
  addInvoiceText: {
    color: '#fff',
    fontSize: scale(18), // 16 + 2
    marginLeft: scale(8),
    fontWeight: '700',
  },

  dropdownItem: {
    padding: scale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOpacity: 0.15,
    shadowRadius: scale(6),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  dropdownItemText: {
    fontSize: scale(18),
    color: '#333333', // Dropdown text - black for better readability
    fontFamily: 'Roboto-Medium',
  },

  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(30), // further increased height
    paddingHorizontal: scale(32),
    marginLeft: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: scale(14),
  },
};

const styles: StyleSheet.NamedStyles<any> = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: '#4f8cff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: scale(12),
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    marginLeft: scale(12),
    fontFamily: 'Roboto-Medium',
  },

  ...invoiceLikeStyles,
  // Bottom buttons UI (matched to AddNewEntry/Payment)
  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
  },
  submitButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonFullWidth: {
    width: '100%',
    alignSelf: 'center',
    flex: 0,
    borderRadius: 8,
    marginLeft: 0,
    marginRight: 0,
  },
  updateButtonEdit: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  deleteButtonEdit: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: scale(4) },
    elevation: 8,
  },
  modalTitle: {
    fontSize: scale(18), // 16 + 2
    color: '#28a745', // Keep success color for modal titles
    marginBottom: scale(8),

    fontFamily: 'Roboto-Medium',
  },

  modalMessage: {
    fontSize: scale(14), // 12 + 2
    color: '#333333', // Modal content - black for better readability
    marginBottom: scale(20),
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  modalButton: {
    backgroundColor: '#28a745',
    borderRadius: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(32),
  },
  modalButtonText: {
    color: '#fff',
    fontSize: scale(14), // 12 + 2
    fontFamily: 'Roboto-Medium',
  },

  errorTextField: {
    color: '#d32f2f', // Error text - darker red for better visibility
    fontSize: scale(14), // 12 + 2
    marginTop: scale(4),

    fontFamily: 'Roboto-Medium',
  },

  // Add a fieldWrapper style
  fieldWrapper: {
    marginBottom: scale(16),
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
    fontSize: scale(18),
    color: '#666666',
    fontFamily: 'Roboto-Medium',
  },

  selectedTextStyle: {
    fontSize: scale(18),
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  iconStyle: {
    width: 28,
    height: 28,
    tintColor: '#4f8cff',
  },
  inputSearchStyle: {
    height: 44,
    fontSize: scale(18),
    backgroundColor: '#f0f6ff',
    borderRadius: 12,
    paddingLeft: 36,
    color: '#333333',
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
    fontSize: scale(18),
    color: '#333333',
    fontFamily: 'Roboto-Medium',
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
  fontSize: scale(18), // 16 + 2
  fontFamily: 'Roboto-Medium',
};
const placeholderStyle1 = {
  fontSize: scale(18), // 16 + 2
  color: '#666666',
  fontFamily: 'Roboto-Medium',
};
const selectedTextStyle1 = {
  fontSize: scale(18), // 16 + 2
  color: '#333333',
  fontFamily: 'Roboto-Medium',
};
const inputSearchStyle1 = {
  height: 40,
  fontSize: scale(18), // 16 + 2
  color: '#333333',
  backgroundColor: '#f8fafc',
  borderRadius: 8,
  paddingLeft: 8,
  borderBottomColor: '#e3e7ee',
  borderBottomWidth: 1,
  fontFamily: 'Roboto-Medium',
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
  fontSize: scale(18), // 16 + 2
  color: '#333333',
  fontFamily: 'Roboto-Medium',
};

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const ReceiptScreen: React.FC<FolderProp> = ({ folder }) => {
  const { showAlert } = useAlert();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const folderName = folder?.title || 'Receipt';

  // Simple StatusBar configuration - let ForceStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  // Add safety check and logging
  console.log(
    'ReceiptScreen render - folder:',
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
  // 1. Receipt Number: Remove initial value, add placeholder, only set value when editing
  const [receiptNumber, setReceiptNumber] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<
    'method' | 'category' | null
  >(null);
  const [customerInput, setCustomerInput] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  // Track the selected customer to persist customerId and default contact details
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id?: number;
    name?: string;
    partyName?: string;
    phoneNumber?: string;
    address?: string;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [category, setCategory] = useState('');
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
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const paymentMethodInputRef = useRef<TextInput>(null);
  // Add showCustomerDropdown state
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  // Add two loading states
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [apiReceipts, setApiReceipts] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [visibleReceiptCount, setVisibleReceiptCount] = useState(
    RECEIPT_LIST_PAGE_SIZE,
  );
  const [isReceiptPaginating, setIsReceiptPaginating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key for FlatList
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  const [syncYN, setSyncYN] = useState('N');

  // Voice OCR state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  // OCR and file upload state variables
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState('');
  const [fileType, setFileType] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);

  // Add refs for dropdown containers to handle outside clicks
  const paymentMethodDropdownRef = useRef<View>(null);
  const categoryDropdownRef = useRef<View>(null);

  const { customers, add, fetchAll } = useCustomerContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  const scrollRef = useRef<KeyboardAwareScrollView>(null);

  const receiptDateRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const customerInputRef = useRef<TextInput>(null);
  const customerPhoneRef = useRef<TextInput>(null);
  const customerAddressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const paymentMethodRef = useRef<View>(null);
  const categoryRef = useRef<View>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Field refs object for error handling and scrolling
  const fieldRefs = {
    receiptDate: receiptDateRef,
    customerInput: customerInputRef,
    customerPhone: customerPhoneRef,
    customerAddress: customerAddressRef,
    amount: amountRef,
    paymentMethod: paymentMethodRef,
    category: categoryRef,
    notes: notesRef,
  };

  // Payment methods and categories arrays to match PaymentScreen
  const paymentMethods = [
    { name: 'Cash', icon: 'cash', description: 'Physical cash payment' },
    {
      name: 'Bank Transfer',
      icon: 'bank-transfer',
      description: 'Direct bank transfer',
    },
    { name: 'UPI', icon: 'cellphone', description: 'UPI payment method' },
    {
      name: 'Credit Card',
      icon: 'credit-card',
      description: 'Credit card payment',
    },
    {
      name: 'Debit Card',
      icon: 'credit-card-outline',
      description: 'Debit card payment',
    },
    { name: 'Cheque', icon: 'checkbook', description: 'Cheque payment' },
  ];

  const categories = [
    { name: 'Sales', icon: 'sale' },
    { name: 'Services', icon: 'briefcase' },
    { name: 'Advance Payment', icon: 'arrow-up' },
    { name: 'Refund', icon: 'arrow-down' },
    { name: 'Other Income', icon: 'plus' },
  ];

  // Validation helpers to avoid overwriting customer with empty/placeholder data
  const isValidPhoneValue = (val?: string) => {
    if (!val) return false;
    const digits = String(val).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13; // Backend expects 10-13 digits
  };
  const isValidAddressValue = (val?: string) => {
    if (!val) return false;
    return String(val).trim().length >= 5;
  };

  // Normalize phone for UI display: prefer last 10 digits when available.
  const normalizePhoneForUI = useCallback((val?: string) => {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return '';
  }, []);

  // Helper: load customer detail from backend if list lacks phone/address
  const loadCustomerDetailAndFill = useCallback(
    async (customerId?: number) => {
      try {
        if (!customerId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        // Use unified API with caching
        const raw = await unifiedApi.getCustomerById(customerId);
        const detail = (raw as any)?.data || raw || {};
        const phoneVal =
          detail?.phoneNumber || detail?.phone || detail?.phone_number || '';
        const addrVal =
          detail?.address ||
          detail?.addressLine1 ||
          detail?.address_line1 ||
          detail?.address1 ||
          (Array.isArray(detail?.addresses)
            ? detail.addresses[0]?.addressLine1 ||
              detail.addresses[0]?.address_line1
            : '') ||
          '';
        if (!isValidPhoneValue(customerPhone) && isValidPhoneValue(phoneVal))
          setCustomerPhone(normalizePhoneForUI(String(phoneVal)));
        if (
          !isValidAddressValue(customerAddress) &&
          isValidAddressValue(addrVal)
        )
          setCustomerAddress(String(addrVal));
      } catch {}
    },
    [customerPhone, customerAddress],
  );

  // Helper: directly PATCH customer fields if user edited name/address during edit
  const persistCustomerDirectPatch = useCallback(
    async (customerId?: number, name?: string, address?: string) => {
      try {
        if (!customerId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const payload: any = {};
        if (name && String(name).trim()) {
          const trimmed = String(name).trim();
          payload.partyName = trimmed;
          payload.name = trimmed; // some backends use `name` instead of `partyName`
        }
        if (isValidAddressValue(address)) {
          payload.address = address;
          payload.addressLine1 = address;
          payload.addresses = [
            { type: 'billing', flatBuildingNumber: address },
          ];
        }
        if (Object.keys(payload).length === 0) return;
        // Use unified API for update
        await unifiedApi.updateCustomer(customerId, payload);
      } catch {}
    },
    [],
  );

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

  // File upload and OCR processing functions

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

          // Robust parsing for receipt fields
          const parsed = parseReceiptOcrText(text);

          console.log('🔍 OCR Parsing Results:', {
            receiptNumber: parsed.receiptNumber,
            customerName: parsed.customerName,
            customerPhone: parsed.customerPhone,
            customerAddress: parsed.customerAddress,
            receiptDate: parsed.receiptDate,
            amount: parsed.amount,
            paymentMethod: parsed.paymentMethod,
            category: parsed.category,
            description: parsed.description,
            notes: parsed.notes,
          });

          if (parsed.receiptNumber) setReceiptNumber(parsed.receiptNumber);
          if (parsed.customerName) setCustomerInput(parsed.customerName);
          if (parsed.customerPhone)
            setCustomerPhone(normalizePhoneForUI(parsed.customerPhone));
          if (parsed.customerAddress) {
            console.log('📍 Setting customer address:', parsed.customerAddress);
            setCustomerAddress(parsed.customerAddress);
          }
          if (parsed.receiptDate) setReceiptDate(parsed.receiptDate);
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
          const parsed = parseReceiptOcrText(text);

          console.log('🔍 PDF OCR Parsing Results:', {
            receiptNumber: parsed.receiptNumber,
            customerName: parsed.customerName,
            customerPhone: parsed.customerPhone,
            customerAddress: parsed.customerAddress,
            receiptDate: parsed.receiptDate,
            amount: parsed.amount,
            paymentMethod: parsed.paymentMethod,
            category: parsed.category,
            description: parsed.description,
            notes: parsed.notes,
          });

          if (parsed.receiptNumber) setReceiptNumber(parsed.receiptNumber);
          if (parsed.customerName) setCustomerInput(parsed.customerName);
          if (parsed.customerPhone)
            setCustomerPhone(normalizePhoneForUI(parsed.customerPhone));
          if (parsed.customerAddress) {
            console.log(
              '📍 Setting customer address from PDF:',
              parsed.customerAddress,
            );
            setCustomerAddress(parsed.customerAddress);
          }
          if (parsed.receiptDate) setReceiptDate(parsed.receiptDate);
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
          // TODO: Implement Excel data mapping for receipts
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

  // Function to close dropdowns when clicking outside
  const handleOutsideClick = () => {
    setShowPaymentMethodDropdown(false);
    setShowCategoryDropdown(false);
  };

  // Utility: Fuzzy match helper
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }
  // Update inRange and inDateRange logic to allow only min or only from date
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
  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }

  // Scroll to error field function to match PaymentScreen behavior
  const scrollToErrorField = useCallback(
    (errorType?: string, fieldName?: string) => {
      console.log('scrollToErrorField called with:', { errorType, fieldName });
      if (!scrollRef.current) {
        console.log('scrollRef.current is null, cannot scroll');
        return;
      }

      // Field positions for reliable scrolling (in pixels from top)
      const fieldScrollPositions = {
        receiptDate: 100,
        customerInput: 200,
        customerPhone: 300,
        customerAddress: 400,
        amount: 500,
        paymentMethod: 600,
        category: 700,
        notes: 800,
      };

      let targetFieldName = fieldName || '';
      let targetRef = null;

      // If specific field name is provided, use it
      if (fieldName && fieldRefs[fieldName as keyof typeof fieldRefs]) {
        targetRef = fieldRefs[fieldName as keyof typeof fieldRefs];
        targetFieldName = fieldName;
        console.log(
          `Target field specified: ${fieldName}, ref exists: ${!!targetRef}`,
        );
      } else {
        // Find first invalid field based on current form state
        const fieldPriority = [
          'receiptDate',
          'customerInput',
          'customerPhone',
          'customerAddress',
          'amount',
          'paymentMethod',
          'category',
        ];

        for (const field of fieldPriority) {
          const ref = fieldRefs[field as keyof typeof fieldRefs];
          let hasError = false;

          // Check field-specific validation
          switch (field) {
            case 'receiptDate':
              hasError = !receiptDate;
              break;
            case 'customerInput':
              hasError = !customerInput;
              break;
            case 'customerPhone':
              hasError =
                !customerPhone ||
                (customerPhone
                  ? isFieldInvalid(customerPhone, 'phone')
                  : false);
              break;
            case 'customerAddress':
              hasError =
                !customerAddress ||
                (customerAddress
                  ? isFieldInvalid(customerAddress, 'address')
                  : false);
              break;
            case 'amount':
              hasError =
                !amount || isNaN(Number(amount)) || Number(amount) <= 0;
              break;
            case 'paymentMethod':
              hasError = !paymentMethod;
              break;
            case 'category':
              hasError = !category;
              break;
          }

          if (hasError) {
            targetRef = ref;
            targetFieldName = field;
            console.log(`Found ${field} error: ${hasError}`);
            break;
          }
        }
      }

      // Scroll to the target field
      if (targetFieldName) {
        console.log(`Scrolling to field: ${targetFieldName}`);

        // Try to focus the field if it has a ref and is focusable
        if (targetRef && targetRef.current && 'focus' in targetRef.current) {
          try {
            (targetRef.current as any).focus();
          } catch (focusError) {
            console.log('Focus failed:', focusError);
          }
        }

        // Use measure to get exact position if ref is available
        if (targetRef && targetRef.current && 'measure' in targetRef.current) {
          try {
            (targetRef.current as any).measure(
              (
                x: number,
                y: number,
                width: number,
                height: number,
                pageX: number,
                pageY: number,
              ) => {
                console.log(`Field position: x=${x}, y=${y}, pageY=${pageY}`);
                if (scrollRef.current) {
                  const scrollY = Math.max(0, pageY - 150);
                  console.log(`Scrolling to position: ${scrollY}`);
                  scrollRef.current.scrollToPosition(0, scrollY, true);
                }
              },
            );
            return; // Success, exit early
          } catch (measureError) {
            console.log('Measure failed, using fallback:', measureError);
          }
        }

        // Fallback: use predefined positions
        const scrollY =
          fieldScrollPositions[
            targetFieldName as keyof typeof fieldScrollPositions
          ] || 200;
        console.log(`Using fallback scroll position: ${scrollY}`);
        try {
          scrollRef.current.scrollToPosition(0, scrollY, true);
        } catch (scrollError) {
          console.log('ScrollToPosition failed:', scrollError);
          // Final fallback: scroll to end
          try {
            scrollRef.current.scrollToEnd(true);
          } catch (endError) {
            console.log('ScrollToEnd also failed:', endError);
          }
        }
      } else {
        // No specific field found, scroll to end to show error message
        console.log('No specific field found, scrolling to end');
        try {
          scrollRef.current.scrollToEnd(true);
        } catch (endError) {
          console.log('ScrollToEnd failed:', endError);
        }
      }
    },
    [
      receiptDate,
      customerInput,
      customerPhone,
      customerAddress,
      amount,
      paymentMethod,
      category,
      fieldRefs,
    ],
  );

  // Helper: Parse OCR text from receipt image
  function parseReceiptOcrText(text: string) {
    console.log('🔍 Starting receipt OCR parsing...');
    console.log('📄 Raw OCR text:', text);

    // Clean the text
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, '\n')
      .trim();

    console.log('🧹 Cleaned text:', cleaned);

    // Initialize variables
    let receiptNumber = '';
    let receiptDate = '';
    let customerName = '';
    let customerPhone = '';
    let customerAddress = '';
    let amount = '';
    let paymentMethod = '';
    let category = '';
    let description = '';
    let notes = '';

    // 1. Extract Receipt Number
    const receiptNumberPatterns = [
      /Receipt\s*Number\s*[:\-]?\s*([A-Z0-9\-]+)/i,
      /Receipt\s*[:\-]?\s*([A-Z0-9\-]+)/i,
      /([A-Z]{2,4}-\d{5,})/i,
    ];

    for (const pattern of receiptNumberPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        receiptNumber = match[1]?.trim() || '';
        console.log('📋 Found Receipt Number:', receiptNumber);
        break;
      }
    }

    // 2. Extract Receipt Date
    const datePatterns = [
      /Receipt\s*Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
      /Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
      /(\d{4}-\d{2}-\d{2})/,
    ];

    for (const pattern of datePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        receiptDate = match[1]?.trim() || '';
        console.log('📅 Found Receipt Date:', receiptDate);
        break;
      }
    }

    // 3. Extract Customer Name
    const customerNamePatterns = [
      /Customer\s*Name\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Phone|Address|Amount|Payment|Category|$)/i,
      /Customer\s*[:\-]?\s*([A-Za-z\s]+?)(?=\n|Phone|Address|Amount|Payment|Category|$)/i,
    ];

    for (const pattern of customerNamePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        customerName = match[1]?.trim() || '';
        console.log('👤 Found Customer Name:', customerName);
        break;
      }
    }

    // 4. Extract Customer Phone
    const phonePatterns = [/Phone\s*[:\-]?\s*(\d{10,})/i, /(\d{10,})/];

    for (const pattern of phonePatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        customerPhone = match[1]?.trim() || '';
        console.log('📞 Found Customer Phone:', customerPhone);
        break;
      }
    }

    // 5. Extract Customer Address
    const addressPatterns = [
      /Address\s*[:\-]?\s*([A-Za-z0-9\s,.-]+?)(?=\n|Amount|Payment|Category|Description|Notes|$)/i,
      /Location\s*[:\-]?\s*([A-Za-z0-9\s,.-]+?)(?=\n|Amount|Payment|Category|Description|Notes|$)/i,
    ];

    for (const pattern of addressPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        customerAddress = match[1]?.trim() || '';
        // Clean up any remaining artifacts
        customerAddress = customerAddress
          .replace(/\s+/g, ' ') // Normalize spaces
          .replace(/[^\w\s,.-]/g, '') // Remove special characters except common address chars
          .trim();
        console.log('📍 Found Customer Address:', customerAddress);
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
      receiptNumber,
      receiptDate,
      customerName,
      customerPhone,
      customerAddress,
      amount,
      paymentMethod,
      category,
      description,
      notes,
    };
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

  const orderedReceipts = useMemo(
    () => [...filteredReceipts].reverse(),
    [filteredReceipts],
  );

  const paginatedReceipts = useMemo(
    () => orderedReceipts.slice(0, visibleReceiptCount),
    [orderedReceipts, visibleReceiptCount],
  );

  const hasMoreReceipts = visibleReceiptCount < orderedReceipts.length;

  useEffect(() => {
    setVisibleReceiptCount(RECEIPT_LIST_PAGE_SIZE);
  }, [filteredReceipts]);

  // Enhanced isFieldInvalid helper with specific validation
  const isFieldInvalid = (field: string, fieldType?: string) => {
    if (!triedSubmit) return false;

    if (fieldType === 'phone') {
      // Phone validation: should be at least 10 digits and max 16 digits
      const phoneDigits = field.replace(/\D/g, '');
      if (!field || phoneDigits.length < 10 || phoneDigits.length > 16) {
        return true;
      }
      // Indian mobile number validation: must start with 6, 7, 8, or 9
      if (phoneDigits.length === 10) {
        const firstDigit = phoneDigits.charAt(0);
        return !['6', '7', '8', '9'].includes(firstDigit);
      }
      return false;
    }

    if (fieldType === 'address') {
      // Address validation: should not be empty
      return !field;
    }

    // Default validation: field should not be empty
    return !field;
  };

  // Add a helper for field-specific error messages
  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'receiptDate':
        return !receiptDate ? 'Date is required.' : '';
      case 'customerInput':
        return !customerInput ? 'Customer is required.' : '';
      case 'amount':
        return !amount ? 'Amount is required.' : '';
      case 'paymentMethod':
        return !paymentMethod ? 'Payment method is required.' : '';
      case 'category':
        return !category ? 'Category is required.' : '';
      case 'customerPhone':
        if (!customerPhone) return 'Phone is required';
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10)
          return 'Phone number must be at least 10 digits';
        if (phoneDigits.length > 13)
          return 'Phone number cannot exceed 13 digits';
        // Indian mobile number validation: must start with 6, 7, 8, or 9
        if (phoneDigits.length === 10) {
          const firstDigit = phoneDigits.charAt(0);
          if (!['6', '7', '8', '9'].includes(firstDigit)) {
            return 'Indian mobile number must start with 6, 7, 8, or 9';
          }
        }
        return '';
      case 'customerAddress':
        if (!customerAddress) return 'Address is required';
        return '';
      default:
        return '';
    }
  };

  // Comprehensive validation function to match PaymentScreen behavior
  const validateReceipt = () => {
    const validationErrors: { field: string; message: string }[] = [];

    // Check required fields in order
    if (!receiptDate) {
      validationErrors.push({
        field: 'receiptDate',
        message: 'Date is required.',
      });
    }
    if (!customerInput) {
      validationErrors.push({
        field: 'customerInput',
        message: 'Customer is required.',
      });
    }
    if (!customerPhone) {
      validationErrors.push({
        field: 'customerPhone',
        message: 'Phone is required.',
      });
    }
    if (!customerAddress) {
      validationErrors.push({
        field: 'customerAddress',
        message: 'Address is required.',
      });
    }
    if (!amount) {
      validationErrors.push({
        field: 'amount',
        message: 'Amount is required.',
      });
    }
    if (!paymentMethod) {
      validationErrors.push({
        field: 'paymentMethod',
        message: 'Payment method is required.',
      });
    }
    if (!category) {
      validationErrors.push({
        field: 'category',
        message: 'Category is required.',
      });
    }

    // Return first error if any required fields are missing
    if (validationErrors.length > 0) {
      return {
        field: validationErrors[0].field,
        message: validationErrors[0].message,
      };
    }

    // Validate amount format
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return { field: 'amount', message: 'Amount must be a positive number.' };
    }

    // Validate phone number format
    if (customerPhone) {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 13) {
        return {
          field: 'customerPhone',
          message: 'Phone number must be between 10-13 digits.',
        };
      }
      // Indian mobile number validation: must start with 6, 7, 8, or 9
      if (phoneDigits.length === 10) {
        const firstDigit = phoneDigits.charAt(0);
        if (!['6', '7', '8', '9'].includes(firstDigit)) {
          return {
            field: 'customerPhone',
            message: 'Indian mobile number must start with 6, 7, 8, or 9',
          };
        }
      }
    }

    // Validate address length
    if (customerAddress && !customerAddress.trim()) {
      return {
        field: 'customerAddress',
        message: 'Address is required.',
      };
    }

    return null;
  };

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
    setShowSuccessModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    setEditingItem(item);
    setShowCreateForm(true);
  };

  // Add missing handleBackToList function
  const handleBackToList = async () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form fields

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
  const resetForm = async () => {
    setCustomerInput('');
    setCustomerPhone('');
    setCustomerAddress('');
    setAmount('');
    setPaymentMethod('');
    setCategory('');
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
    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);

    // Validate all required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      receiptDate,
      customerInput,
      customerPhone,
      customerAddress,
      amount,
      paymentMethod,
      category,
    });

    // Use comprehensive validation function
    const validationResult = validateReceipt();
    if (validationResult) {
      console.log('Validation failed:', validationResult);
      setError(validationResult.message);

      // Scroll to the first invalid field
      setTimeout(
        () => scrollToErrorField('validation', validationResult.field),
        200,
      );
      return;
    }

    // Final validation check before API call
    if (
      !receiptDate ||
      !customerInput ||
      !customerPhone ||
      !customerAddress ||
      !amount ||
      !paymentMethod ||
      !category
    ) {
      const missingFields = [];
      if (!receiptDate) missingFields.push('Receipt Date');
      if (!customerInput) missingFields.push('Customer Name');
      if (!customerPhone) missingFields.push('Phone');
      if (!customerAddress) missingFields.push('Address');
      if (!amount) missingFields.push('Amount');
      if (!paymentMethod) missingFields.push('Payment Method');
      if (!category) missingFields.push('Category');

      console.log(
        '❌ Final validation check failed - blocking API call. Missing fields:',
        missingFields,
      );
      setError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Additional validation checks before API call
    let amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    // Normalize amount precision to 2 decimals automatically instead of blocking
    const normalizedAmount = Number(
      parseFloat(String(amountNumber)).toFixed(2),
    );
    if (normalizedAmount !== amountNumber) {
      console.log('🔍 Normalizing amount to 2 decimals:', {
        original: amountNumber,
        normalized: normalizedAmount,
      });
      amountNumber = normalizedAmount;
      setAmount(String(normalizedAmount));
    }

    const userIdPromise = getUserIdFromToken();
    const nextReceiptNumberPromise = !editingItem
      ? generateNextDocumentNumber(folderName.toLowerCase(), true).catch(
          error => {
            console.error('Error generating receipt number:', error);
            return null;
          },
        )
      : Promise.resolve<string | null>(null);

    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if customer exists, if not, create
      let customerNameToUse = customerInput.trim();
      let existingCustomer = customers.find(
        c =>
          c.partyName?.trim().toLowerCase() ===
            customerNameToUse.toLowerCase() ||
          c.name?.trim().toLowerCase() === customerNameToUse.toLowerCase() ||
          (editingItem && c.id === editingItem.partyId) ||
          (editingItem && c.id === editingItem.customer_id),
      );

      console.log('🔍 ReceiptScreen: Customer lookup result:', {
        customerNameToUse,
        totalCustomers: customers.length,
        existingCustomer: existingCustomer
          ? {
              id: existingCustomer.id,
              partyName: existingCustomer.partyName,
              name: existingCustomer.name,
            }
          : null,
        editingItem: editingItem
          ? {
              partyId: editingItem.partyId,
              customer_id: editingItem.customer_id,
            }
          : null,
      });

      if (!existingCustomer) {
        console.log('🔍 ReceiptScreen: Creating new customer with data:', {
          name: customerNameToUse,
          phoneNumber: customerPhone,
          address: customerAddress,
          isValidPhone: isValidPhoneValue(customerPhone),
          isValidAddress: isValidAddressValue(customerAddress),
        });

        const newCustomer = await add({
          partyName: customerNameToUse,
          phoneNumber: isValidPhoneValue(customerPhone)
            ? customerPhone
            : undefined,
          address: isValidAddressValue(customerAddress)
            ? customerAddress
            : undefined,
        } as any);

        console.log('🔍 ReceiptScreen: Created customer result:', newCustomer);

        if (!newCustomer || !(newCustomer as any)?.id) {
          setError('Failed to create customer. Please try again.');
          return;
        }

        customerNameToUse = newCustomer.partyName || '';
        existingCustomer = newCustomer as any;

        console.log('🔍 ReceiptScreen: After customer creation:', {
          newCustomerId: (newCustomer as any)?.id,
          existingCustomerId: existingCustomer?.id,
          customerNameToUse,
          newCustomerFull: newCustomer,
          existingCustomerFull: existingCustomer,
        });

        fetchAll('').catch(() => {});
      }
      const userId = await userIdPromise;
      if (!userId) {
        setError('User not authenticated. Please login again.');
        return;
      }

      // Resolve customer ID consistently
      const resolvedCustomerId = existingCustomer
        ? Number(existingCustomer.id)
        : undefined;

      console.log('🔍 ReceiptScreen: Resolved customer ID:', {
        existingCustomer: existingCustomer ? existingCustomer.id : null,
        resolvedCustomerId,
        customerNameToUse,
        customerInput,
        editingItem: editingItem ? editingItem.id : null,
      });

      // If we still don't have a customer ID, something went wrong
      if (!resolvedCustomerId) {
        console.error('❌ ReceiptScreen: No customer ID resolved!', {
          existingCustomer,
          customerNameToUse,
          customerInput,
        });
        setError('Failed to resolve customer ID. Please try again.');
        return;
      }

      // Normalize status to requested values
      const statusToSend = status === 'complete' ? 'Complete' : 'Draft';

      // Always regenerate document number on submit for new transactions (not editing)
      // This ensures accuracy even if other transactions were created since initialization
      let finalReceiptNumber = receiptNumber || '';
      if (!editingItem) {
        const generatedReceiptNumber = await nextReceiptNumberPromise;
        if (generatedReceiptNumber) {
          finalReceiptNumber = generatedReceiptNumber;
          setReceiptNumber(generatedReceiptNumber);
          console.log(
            '🔍 Generated receiptNumber on submit:',
            generatedReceiptNumber,
          );
        } else {
          // Fallback: use preview number if available, otherwise default to REC-001
          finalReceiptNumber = receiptNumber || 'REC-001';
        }
      } else {
        // Editing - use existing number or preview number
        finalReceiptNumber = receiptNumber || editingItem.receiptNumber || '';
      }

      // If user changed name/address from the selected customer, push an update
      try {
        if (existingCustomer) {
          const needsNameUpdate =
            customerInput.trim() !==
            (
              (existingCustomer as any).partyName ||
              (existingCustomer as any).name ||
              ''
            ).trim();
          const needsAddressUpdate =
            isValidAddressValue(customerAddress) &&
            customerAddress !== ((existingCustomer as any).address || '');
          if (needsNameUpdate || needsAddressUpdate) {
            await persistCustomerDirectPatch(
              (existingCustomer as any).id,
              customerInput.trim(),
              needsAddressUpdate ? customerAddress : undefined,
            );
            fetchAll('').catch(() => {});
          }
        }
      } catch {}

      // API body
      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        // Receipts are credits in unified transactions API
        type: 'credit',
        amount: Number(parseFloat(amount).toFixed(2)),
        date: receiptDate, // keep as YYYY-MM-DD to preserve exact selected date
        transactionDate: receiptDate,
        receiptDate: receiptDate,
        // snake_case aliases
        transaction_date: receiptDate,
        receipt_date: receiptDate,
        status: statusToSend,
        description: description || '',
        notes: notes || '',
        partyName: customerInput.trim() || customerNameToUse,
        partyId: resolvedCustomerId,
        customer_id: resolvedCustomerId,
        partyPhone: customerPhone || '',
        partyAddress: customerAddress || '',
        method: paymentMethod,
        category: category || '',
        items: [],
        receiptNumber: finalReceiptNumber, // Include receiptNumber (receipt number like "REC-1333")
      };

      // Include user's primary role id for backend auditing/mapping
      try {
        const { addRoleIdToBody } = await import('../../utils/roleHelper');
        await addRoleIdToBody(body);
      } catch (e) {
        console.warn('⚠️ ReceiptScreen: Failed to add role ID:', e);
      }

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
        partyId: body.partyId,
        customer_id: body.customer_id,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        method: body.method,
        category: body.category,
        items: body.items,
        receiptNumber: body.receiptNumber, // Include receiptNumber for backend
        createdBy: body.createdBy,
        updatedBy: body.updatedBy,
      };
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
      let res;
      let serverResponse: any = null;
      try {
        if (editingItem) {
          // PUT update (backend supports PUT). Send only provided/changed fields.
          const putBody: any = {};
          if (body.user_id) putBody.user_id = body.user_id;
          if (body.type) putBody.type = body.type; // 'credit' for receipt
          if (body.date) putBody.date = body.date;
          if (body.amount !== undefined) putBody.amount = Number(body.amount);
          if (body.status) putBody.status = statusToSend;
          if (body.partyName) putBody.partyName = body.partyName;
          if (body.partyId) putBody.partyId = body.partyId;
          if (body.customer_id) putBody.customer_id = body.customer_id;
          if (body.partyPhone) putBody.partyPhone = body.partyPhone;
          if (body.partyAddress) putBody.partyAddress = body.partyAddress;

          console.log('🔍 ReceiptScreen PUT request data:', {
            editingItemId: editingItem.id,
            formValues: {
              customerInput: customerInput,
              customerAddress: customerAddress,
              customerPhone: customerPhone,
            },
            bodyValues: {
              partyName: body.partyName,
              partyAddress: body.partyAddress,
              partyPhone: body.partyPhone,
            },
            putBody: putBody,
          });
          if (cleanBody.method) putBody.method = cleanBody.method;
          if (cleanBody.category) putBody.category = cleanBody.category;
          if (cleanBody.description)
            putBody.description = cleanBody.description;
          if (cleanBody.notes) putBody.notes = cleanBody.notes;
          putBody.receiptNumber =
            finalReceiptNumber || editingItem.receiptNumber || ''; // Include receiptNumber for updates
          putBody.updatedBy = cleanBody.updatedBy;
          // Use unified API for update
          serverResponse = await unifiedApi.updateTransaction(
            editingItem.id,
            putBody,
          );
        } else {
          // POST create: send full body
          // Use unified API for create
          const newVoucher = await unifiedApi.createTransaction(cleanBody);
          serverResponse = newVoucher;
          appendVoucher((newVoucher as any)?.data || newVoucher);
        }
      } catch (error: any) {
        // Import error handler
        const { handleApiError } = require('../../utils/apiErrorHandler');
        const errorInfo = handleApiError(error);

        // Check if it's a transaction limit error
        const errorMessage =
          error?.message || String(error) || 'Unknown error occurred';
        if (
          errorMessage.includes('transaction limit') ||
          errorMessage.includes('limit exceeded') ||
          errorMessage.includes('Internal server error')
        ) {
          // Trigger transaction limit popup
          await forceShowPopup();
          setError(
            'Transaction limit reached. Please upgrade your plan to continue.',
          );
          return;
        }

        // Handle 403 Forbidden errors with user-friendly message
        if (errorInfo.isForbidden) {
          showAlert({
            title: 'Access Denied',
            message: errorInfo.message,
            type: 'error',
          });
          setError(errorInfo.message);
          return;
        }

        throw new Error(errorInfo.message || 'Failed to save receipt.');
      }

      // Optimistically update the local list so changes appear immediately
      try {
        if (editingItem) {
          const updatedFields = {
            partyName: cleanBody.partyName,
            partyAddress: cleanBody.partyAddress,
            partyPhone: cleanBody.partyPhone,
            method: cleanBody.method,
            category: cleanBody.category,
            description: cleanBody.description,
            notes: cleanBody.notes,
            amount: Number(cleanBody.amount || body.amount),
            date: body.date,
            status: statusToSend,
            partyId: cleanBody.partyId || body.partyId,
            customer_id: cleanBody.customer_id || body.customer_id,
          } as any;

          // If server returned the updated entity, use that data instead of our optimistic update
          const serverItem = serverResponse?.data || serverResponse;
          if (serverItem && serverItem.id) {
            setApiReceipts(prev =>
              (prev || []).map(p =>
                String(p.id) === String(editingItem.id)
                  ? {
                      ...p,
                      ...serverItem,
                      partyName:
                        serverItem.partyName ||
                        cleanBody.partyName ||
                        p.partyName ||
                        '',
                      partyAddress:
                        serverItem.partyAddress ||
                        cleanBody.partyAddress ||
                        p.partyAddress ||
                        '',
                      partyPhone:
                        serverItem.partyPhone ||
                        cleanBody.partyPhone ||
                        p.partyPhone ||
                        '',
                      _raw: { ...(p._raw || {}), ...serverItem },
                      _lastUpdated: Date.now(),
                    }
                  : p,
              ),
            );
            // Update refresh key to force FlatList re-render
            setRefreshKey(prev => prev + 1);
          } else {
            // Fallback to optimistic update if no server response
            setApiReceipts(prev =>
              (prev || []).map(p =>
                String(p.id) === String(editingItem.id)
                  ? {
                      ...p,
                      ...updatedFields,
                      _raw: { ...(p._raw || {}), ...updatedFields },
                      _lastUpdated: Date.now(),
                    }
                  : p,
              ),
            );
            // Update refresh key to force FlatList re-render
            setRefreshKey(prev => prev + 1);
          }
        }
      } catch {}

      // Success - no popup needed

      // For edits, don't refetch from server - use local state with latest customer info
      if (editingItem) {
        // Update the local state with the form data that was just saved
        setApiReceipts(prev =>
          (prev || []).map(p => {
            if (String(p.id) === String(editingItem.id)) {
              return {
                ...p,
                // Use the form data that was just saved (this is the updated data)
                partyName: cleanBody.partyName || p.partyName,
                partyAddress: cleanBody.partyAddress || p.partyAddress,
                partyPhone: cleanBody.partyPhone || p.partyPhone,
                method: cleanBody.method || p.method,
                category: cleanBody.category || p.category,
                description: cleanBody.description || p.description,
                notes: cleanBody.notes || p.notes,
                amount: Number(cleanBody.amount || body.amount) || p.amount,
                date: body.date || p.date,
                status: statusToSend || p.status,
                partyId: cleanBody.partyId || body.partyId || p.partyId,
                customer_id:
                  cleanBody.customer_id || body.customer_id || p.customer_id,
                // Update the raw data too
                _raw: {
                  ...(p._raw || {}),
                  partyName: cleanBody.partyName || p.partyName,
                  partyAddress: cleanBody.partyAddress || p.partyAddress,
                  partyPhone: cleanBody.partyPhone || p.partyPhone,
                },
                _lastUpdated: Date.now(),
              };
            }
            return p;
          }),
        );
        // Update refresh key to force FlatList re-render
        setRefreshKey(prev => prev + 1);
      } else {
        // For new receipts, refresh from server
        await fetchReceipts();
      }

      setEditingItem(null);
      setShowCreateForm(false);
      resetForm();
    } catch (e: any) {
      // Import error handler
      const { handleApiError } = require('../../utils/apiErrorHandler');
      const errorInfo = handleApiError(e);

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        showAlert({
          title: 'Access Denied',
          message: errorInfo.message,
          type: 'error',
        });
        setError(errorInfo.message);
      } else {
        setError(errorInfo.message || 'An error occurred.');
      }
    } finally {
      if (status === 'complete') setLoadingSave(false);
      if (status === 'draft') setLoadingDraft(false);
    }
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      // Ensure customers are loaded when editing
      if (customers.length === 0) {
        console.log('🔍 No customers loaded, fetching customers...');
        fetchAll('');
      }
      console.log('🔍 ReceiptScreen: Editing item data:', {
        id: editingItem.id,
        partyName: editingItem.partyName,
        partyId: editingItem.partyId,
        customer_id: editingItem.customer_id,
        _raw: editingItem._raw,
        allFields: Object.keys(editingItem),
      });

      console.log('🔍 ReceiptScreen: Available customers:', {
        totalCustomers: customers.length,
        customerIds: customers.map(c => c.id),
        customerNames: customers.map(c => c.partyName || c.name),
      });

      // Try to get the original customer name from _raw data if partyName is "Unknown Customer"
      let customerName = editingItem.partyName || '';
      console.log('🔍 ReceiptScreen: Customer name resolution:', {
        originalPartyName: editingItem.partyName,
        rawPartyName: editingItem._raw?.partyName,
        isUnknownCustomer: customerName === 'Unknown Customer',
        hasRawData: !!editingItem._raw,
      });

      if (customerName === 'Unknown Customer' && editingItem._raw?.partyName) {
        customerName = editingItem._raw.partyName;
        console.log('🔍 Using original partyName from _raw:', customerName);
      } else if (customerName === 'Unknown Customer') {
        console.log('❌ No _raw data available, trying to find customer by ID');

        // Try to find customer by partyId or customer_id
        const customerId = editingItem.partyId || editingItem.customer_id;
        if (customerId && customers.length > 0) {
          const foundCustomer = customers.find(c => c.id === customerId);
          if (foundCustomer) {
            customerName = foundCustomer.partyName || foundCustomer.name || '';
            console.log('🔍 Found customer by ID:', customerName);
          } else {
            console.log('❌ Customer not found by ID:', customerId);
            // Fallback: show customer ID if no name found
            customerName = `Customer ${customerId}`;
            console.log('🔍 Using fallback customer name:', customerName);
          }
        } else {
          console.log('❌ No customer ID available in editingItem');
        }
      }

      setCustomerInput(customerName);
      setCustomerPhone(normalizePhoneForUI(editingItem.partyPhone || ''));
      setCustomerAddress(editingItem.partyAddress || '');

      console.log('🔍 ReceiptScreen: Setting form values for editing:', {
        editingItemPartyName: editingItem.partyName,
        editingItemPartyAddress: editingItem.partyAddress,
        editingItemPartyPhone: editingItem.partyPhone,
        customerName: customerName,
        rawData: editingItem._raw,
      });
      setAmount(
        editingItem.amount ? parseFloat(editingItem.amount).toString() : '',
      );
      setPaymentMethod(editingItem.method || '');
      setCategory(editingItem.category || '');
      setDescription(editingItem.description || '');
      setNotes(editingItem.notes || '');
      setReference(editingItem.reference || '');
      setReceiptDate(
        editingItem.date
          ? editingItem.date.slice(0, 10)
          : new Date().toISOString().split('T')[0],
      );
    } else {
      setCustomerInput('');
      setCustomerPhone('');
      setCustomerAddress('');
      setAmount('');
      setPaymentMethod('');
      setCategory('');
      setDescription('');
      setNotes('');
      setReference('');
      setReceiptDate(new Date().toISOString().split('T')[0]);
    }
  }, [editingItem, showCreateForm]);

  // When customer context updates, sync phone/address into the form promptly
  useEffect(() => {
    try {
      if (!selectedCustomer) return;
      const currentCustomersAny: any[] = (customers as any[]) || [];
      const latest = currentCustomersAny.find(
        (c: any) => c.id === (selectedCustomer as any)?.id,
      );
      if (!latest) {
        // If no selectedCustomer match, try resolve by typed name
        const typedName = (customerInput || '').trim().toLowerCase();
        if (typedName) {
          const byName = currentCustomersAny.find(
            (c: any) =>
              ((c.name || c.partyName || '') as string).trim().toLowerCase() ===
              typedName,
          );
          if (byName) {
            setSelectedCustomer(byName as any);
          }
        }
        return;
      }
      // If editing and the input still shows the old transaction partyName,
      // replace it with the latest customer name from context so the field reflects updates
      try {
        const latestDisplayName =
          (latest as any).name || (latest as any).partyName || '';
        if (
          editingItem &&
          latestDisplayName &&
          String(customerInput || '')
            .trim()
            .toLowerCase() ===
            String(editingItem?.partyName || '')
              .trim()
              .toLowerCase() &&
          latestDisplayName.trim().toLowerCase() !==
            String(editingItem?.partyName || '')
              .trim()
              .toLowerCase()
        ) {
          setCustomerInput(latestDisplayName);
        }
      } catch {}
      const latestPhone =
        (latest as any).phoneNumber ||
        (latest as any).phone ||
        (latest as any).phone_number ||
        '';
      const latestAddress =
        (latest as any).address ||
        (latest as any).addressLine1 ||
        (latest as any).address_line1 ||
        (latest as any).address1 ||
        '';

      // Always update phone and address when customer data changes
      if (isValidPhoneValue(latestPhone)) {
        setCustomerPhone(normalizePhoneForUI(String(latestPhone)));
      }
      if (isValidAddressValue(latestAddress)) {
        setCustomerAddress(String(latestAddress));
      }
    } catch {}
  }, [customers, selectedCustomer]);

  // Immediate sync when selectedCustomer changes
  useEffect(() => {
    try {
      if (!selectedCustomer) return;
      const currentCustomersAny: any[] = (customers as any[]) || [];
      const latest = currentCustomersAny.find(
        (c: any) => c.id === (selectedCustomer as any)?.id,
      );
      if (!latest) return;

      const latestPhone =
        (latest as any).phoneNumber ||
        (latest as any).phone ||
        (latest as any).phone_number ||
        '';
      const latestAddress =
        (latest as any).address ||
        (latest as any).addressLine1 ||
        (latest as any).address_line1 ||
        (latest as any).address1 ||
        '';

      // Ensure the input field shows the latest customer name during edit
      try {
        const latestDisplayName =
          (latest as any).name || (latest as any).partyName || '';
        if (
          editingItem &&
          latestDisplayName &&
          String(customerInput || '')
            .trim()
            .toLowerCase() ===
            String(editingItem?.partyName || '')
              .trim()
              .toLowerCase() &&
          latestDisplayName.trim().toLowerCase() !==
            String(editingItem?.partyName || '')
              .trim()
              .toLowerCase()
        ) {
          setCustomerInput(latestDisplayName);
        }
      } catch {}

      // Immediately update phone and address when customer is selected
      if (isValidPhoneValue(latestPhone)) {
        setCustomerPhone(normalizePhoneForUI(String(latestPhone)));
      }
      if (isValidAddressValue(latestAddress)) {
        setCustomerAddress(String(latestAddress));
      }
    } catch {}
  }, [selectedCustomer?.id, customers, customerInput]);

  // 1. Add deleteReceipt function
  const deleteReceipt = async (id: string) => {
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      const token = await AsyncStorage.getItem('accessToken');
      // Use unified API for delete
      const numericId = typeof id === 'string' ? Number(id) : id;

      console.log('🗑️ [DELETE] Starting receipt deletion:', id);

      // Optimistic UI update - remove item immediately (before API call)
      setApiReceipts(prev => {
        const filtered = (prev || []).filter(
          p => String(p.id) !== String(id) && Number(p.id) !== numericId,
        );
        console.log('🔄 [DELETE] Optimistic update - removed item:', {
          deletedId: id,
          remainingCount: filtered.length,
          previousCount: prev?.length || 0,
        });
        return filtered;
      });

      // Update refresh key immediately to force FlatList re-render
      setRefreshKey(prev => prev + 1);

      // Invalidate cache to ensure fresh data
      unifiedApi.invalidateCachePattern('.*/transactions.*');

      // Use unified API for delete
      // DELETE operations often return 204 No Content (empty response)
      try {
        const deleteResponse = (await unifiedApi.deleteTransaction(
          numericId,
        )) as {
          data: any;
          status: number;
          headers: Headers;
        };
        console.log('✅ [DELETE] Receipt deleted successfully:', {
          status: deleteResponse?.status,
          hasData: !!deleteResponse?.data,
        });
      } catch (deleteError: any) {
        // Check if it's a JSON parse error from empty response (204 No Content)
        // This is actually a success case for DELETE operations
        const isJsonParseError =
          deleteError?.message?.includes('JSON Parse error') ||
          deleteError?.message?.includes('Unexpected end of input') ||
          deleteError?.message?.includes('JSON') ||
          deleteError?.name === 'SyntaxError' ||
          (deleteError?.message &&
            typeof deleteError.message === 'string' &&
            deleteError.message.includes('parse'));

        const is204Success =
          deleteError?.response?.status === 204 ||
          deleteError?.status === 204 ||
          deleteError?.statusCode === 204;

        // Handle 204 No Content and JSON parse errors as success
        if (is204Success || isJsonParseError) {
          console.log(
            '✅ ReceiptScreen: Delete successful (204 No Content or JSON parse error)',
          );
          // Don't re-throw - treat as success
        } else {
          // For other errors, re-throw to be caught by outer catch
          throw deleteError;
        }
      }

      // Small delay to ensure server has processed the delete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh from server to ensure consistency (but optimistic update already removed it from UI)
      // Only refresh if we need to sync with server, otherwise the optimistic update is sufficient
      try {
        await fetchReceipts();
      } catch (refreshError) {
        console.warn(
          '⚠️ [DELETE] Error refreshing receipts, but item already removed optimistically:',
          refreshError,
        );
      }

      setShowCreateForm(false);
      setEditingItem(null);
      // Update refresh key again after server refresh
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      console.error('❌ [DELETE] Error deleting receipt:', e);

      // Check if it's a JSON parse error from empty response (204 No Content)
      // This is actually a success case for DELETE operations
      const isJsonParseError =
        e?.message?.includes('JSON Parse error') ||
        e?.message?.includes('Unexpected end of input') ||
        e?.message?.includes('JSON') ||
        e?.name === 'SyntaxError' ||
        (e?.message &&
          typeof e.message === 'string' &&
          e.message.includes('parse'));

      const is204Success =
        e?.response?.status === 204 || e?.status === 204 || isJsonParseError;

      if (is204Success) {
        console.log(
          '✅ ReceiptScreen: Delete successful (204 No Content or JSON parse error)',
        );
        // Item already removed optimistically, just refresh to sync
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchReceipts();
          setRefreshKey(prev => prev + 1);
        } catch (refreshError) {
          console.warn(
            '⚠️ [DELETE] Error refreshing after 204, but item already removed:',
            refreshError,
          );
        }
      } else {
        // For real errors, refresh from server to restore correct state
        console.error(
          '❌ [DELETE] Real error occurred, restoring state from server',
        );
        await fetchReceipts();
        setError(e.message || 'Failed to delete receipt.');
      }
    }
  };

  // Add handleSync function
  const handleSync = async (item: any) => {
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Use PUT instead of PATCH - backend requires full transaction object
      // Get userId for the update
      const userId = await getUserIdFromToken();
      if (!userId) {
        throw new Error('User not authenticated. Please login again.');
      }

      // Use raw data if available (original transaction data), otherwise use enriched data
      const rawData = item._raw || item;

      // Build PUT body with all required fields plus syncYN
      const putBody: any = {
        user_id: rawData.user_id || userId,
        createdBy: rawData.createdBy || rawData.user_id || userId,
        updatedBy: userId,
        type: rawData.type || 'credit',
        amount: Number(rawData.amount || item.amount || 0),
        date:
          rawData.date ||
          rawData.receiptDate ||
          rawData.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transactionDate:
          rawData.transactionDate ||
          rawData.date ||
          rawData.receiptDate ||
          item.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        receiptDate:
          rawData.receiptDate ||
          rawData.date ||
          rawData.transactionDate ||
          item.receiptDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transaction_date:
          rawData.transaction_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        receipt_date:
          rawData.receipt_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        status: rawData.status || item.status || 'Complete',
        description: rawData.description || item.description || '',
        notes: rawData.notes || item.notes || '',
        partyName: rawData.partyName || item.partyName || '',
        partyId:
          rawData.partyId ||
          rawData.customer_id ||
          item.partyId ||
          item.customer_id ||
          null,
        customer_id:
          rawData.customer_id ||
          rawData.partyId ||
          item.customer_id ||
          item.partyId ||
          null,
        partyPhone:
          rawData.partyPhone ||
          rawData.phone ||
          rawData.phoneNumber ||
          item.partyPhone ||
          '',
        partyAddress:
          rawData.partyAddress ||
          rawData.address ||
          rawData.addressLine1 ||
          item.partyAddress ||
          '',
        method: rawData.method || item.method || '',
        category: rawData.category || item.category || '',
        items: rawData.items || item.items || [],
        receiptNumber: rawData.receiptNumber || item.receiptNumber || '', // Include receiptNumber for sync
        syncYN: 'Y', // Set sync flag
      };

      // Use unified API for sync
      await unifiedApi.updateTransaction(item.id, putBody);
      await fetchReceipts();
      // Update refresh key to force FlatList re-render
      setRefreshKey(prev => prev + 1);
    } catch (e: any) {
      console.error('Sync error:', e.message);
      // Optionally show error to user
      setError(e.message || 'Failed to sync receipt.');
    }
  };

  // Voice-to-Text: Start Recording
  const startVoiceRecording = async () => {
    setVoiceError(null);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setVoiceError(
            'Microphone permission is required for voice recording.',
          );
          return;
        }
      }

      setIsRecording(true);
      const result = await audioRecorderPlayer.startRecorder();
      console.log('Recording started:', result);
    } catch (error) {
      console.error('Error starting recording:', error);
      setVoiceError('Failed to start recording');
      setIsRecording(false);
    }
  };

  // Voice-to-Text: Stop Recording
  const stopVoiceRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      if (result) {
        await sendAudioForTranscription(result);
      }
    } catch (err) {
      setVoiceError(
        'Failed to stop recording: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsRecording(false);
    }
  };

  // Voice-to-Text: Send audio to backend
  const sendAudioForTranscription = async (
    uri: string,
    mimeType: string = 'audio/wav',
    fileName: string = 'audio.wav',
  ) => {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: mimeType,
      } as any);
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      const res = (await unifiedApi.post(
        '/api/whisper/transcribe',
        formData,
      )) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // unifiedApi returns { data, status, headers } structure
      const data = res.data || res;
      if (res.status < 200 || res.status >= 300) {
        throw new Error(data?.message || 'Speech recognition failed');
      }

      // Show last voice response
      setLastVoiceText(data.englishText || data.text || null);

      // Parse voice text and fill form fields
      if (data.englishText || data.text) {
        const voiceText = data.englishText || data.text;
        const setters = {
          setInvoiceNumber: setReceiptNumber,
          setSelectedCustomer: setCustomerInput,
          setGstPct: () => {}, // Receipts don't have GST
          setInvoiceDate: setReceiptDate,
          setNotes: setNotes,
          setItems: () => {}, // Receipts don't have items
          setDescription: setDescription,
        };

        const updatedFields = parseInvoiceVoiceText(voiceText, setters);
        console.log('Voice parsing updated fields:', updatedFields);
      }
    } catch (error: any) {
      console.error('Voice transcription error:', error);
      setVoiceError(error.message || 'Voice recognition failed');
    } finally {
      setVoiceLoading(false);
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
        <Text
          style={styles.customerName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.partyName}
        </Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>{item.date?.slice(0, 10)}</Text>
          <Text style={styles.invoiceAmount}>
            {`₹${Number(item.amount).toLocaleString('en-IN')}`}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Sync button hidden as requested */}
      {false && (
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
      )}
    </View>
  );

  const handleLoadMoreReceipts = () => {
    if (!hasMoreReceipts || isReceiptPaginating) {
      return;
    }
    setIsReceiptPaginating(true);
    setTimeout(() => {
      setVisibleReceiptCount(prev =>
        Math.min(prev + RECEIPT_LIST_PAGE_SIZE, orderedReceipts.length),
      );
      setIsReceiptPaginating(false);
    }, 200);
  };

  const renderReceiptFooter = () => {
    if (!isReceiptPaginating) {
      return null;
    }
    return (
      <View style={styles.listFooterLoader}>
        <ActivityIndicator size="small" color="#4f8cff" />
      </View>
    );
  };

  // Fetch receipts from API with customer data enrichment
  const fetchReceipts = async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');

      // Ensure we have latest customers list - wait for it to complete
      console.log('🔍 ReceiptScreen: Starting customer fetch...');
      const fetchedCustomers = await fetchAll('');
      console.log(
        '🔍 ReceiptScreen: Customer fetch completed, got:',
        fetchedCustomers.length,
        'customers',
      );

      // Use the freshly fetched customers instead of the context state
      const currentCustomersAny: any[] = fetchedCustomers || [];
      console.log('📊 Customers data:', {
        totalCustomers: currentCustomersAny.length,
        sampleCustomer: currentCustomersAny[0] || 'No customers',
        customerFields: currentCustomersAny[0]
          ? Object.keys(currentCustomersAny[0])
          : [],
      });

      // Then fetch transactions (map folder to valid transaction type)
      const mappedType = ['receipt', 'income'].includes(
        folderName.toLowerCase(),
      )
        ? 'credit'
        : 'debit';
      // Use unified API with pagination - optimized!
      const response = await unifiedApi.getReceipts(1, 20); // Paginated for better performance
      const data = (response as any)?.data || response || {};
      const vouchers = Array.isArray(data) ? data : data.data || [];

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

      // Map UI folder to backend transaction type
      const expectedType = ['receipt', 'income'].includes(
        folderName.toLowerCase(),
      )
        ? 'credit'
        : 'debit';

      // Merge customer data with vouchers
      const enrichedReceipts = vouchers
        .filter((v: any) => {
          const typeMatches = String(v.type).toLowerCase() === expectedType;
          // Receipts should not have line items; exclude invoice-like credits
          const isReceiptLike =
            !Array.isArray(v.items) ||
            (Array.isArray(v.items) && v.items.length === 0);
          // 🎯 FIXED: Exclude subscription transactions (plan upgrades)
          const isSubscription =
            String(v.category || '').toLowerCase() === 'subscription' ||
            String(v.method || '').toLowerCase() === 'subscription';
          // Do not filter by method; receipts may have Cash/UPI/etc. methods
          const matches = typeMatches && isReceiptLike && !isSubscription;
          if (!matches) {
            console.log('❌ Voucher filtered out:', {
              id: v.id,
              type: v.type,
              expectedType,
              partyName: v.partyName,
              isSubscription,
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

          // Find matching customer using multiple strategies
          let party = null;

          // Strategy 1: Try to match by partyName first (most reliable for vouchers)
          if (voucher.partyName) {
            party = currentCustomersAny.find(
              (c: any) =>
                c.partyName?.toLowerCase() ===
                  voucher.partyName?.toLowerCase() ||
                c.name?.toLowerCase() === voucher.partyName?.toLowerCase(),
            );
            if (party) {
              console.log(
                '✅ Matched by exact partyName:',
                party.partyName || party.name,
              );
            }
          }

          // Strategy 2: Try partial name matching if exact match didn't work
          if (!party && voucher.partyName) {
            party = currentCustomersAny.find((c: any) => {
              const cName = (c.partyName || c.name)?.toLowerCase() || '';
              const vName = voucher.partyName?.toLowerCase() || '';
              return cName.includes(vName) || vName.includes(cName);
            });
            if (party) {
              console.log(
                '✅ Matched by partial partyName:',
                party.partyName || party.name,
              );
            }
          }

          // Strategy 3: Try to match by partyId as fallback (if it exists)
          if (!party && voucher.partyId) {
            party = currentCustomersAny.find(
              (c: any) => c.id === voucher.partyId,
            );
            if (party) {
              console.log(
                '✅ Matched by partyId:',
                party.partyName || party.name,
              );
            }
          }

          // Strategy 4: Try to match by customer_id if partyId didn't work
          if (!party && voucher.customer_id) {
            party = currentCustomersAny.find(
              (c: any) => c.id === voucher.customer_id,
            );
            if (party) {
              console.log(
                '✅ Matched by customer_id:',
                party.partyName || party.name,
              );
            }
          }

          // If no match found, log it for debugging
          if (!party) {
            console.log('❌ No customer match found for voucher:', {
              voucherId: voucher.id,
              voucherPartyName: voucher.partyName,
              voucherPartyId: voucher.partyId,
              voucherCustomerId: voucher.customer_id,
              availableCustomers: currentCustomersAny.map((c: any) => ({
                id: c.id,
                partyName: c.partyName,
                name: c.name,
                partyType: c.partyType,
              })),
              totalCustomers: currentCustomersAny.length,
            });

            // If we have a partyName in the voucher but no match,
            // it means the customer lookup failed - use the original name
            if (voucher.partyName) {
              console.log(
                '🔍 Using original partyName from voucher:',
                voucher.partyName,
              );
            }
          } else {
            console.log('✅ Customer match found:', {
              voucherId: voucher.id,
              matchedCustomerId: party.id,
              matchedCustomerName: party.partyName || party.name,
              originalVoucherName: voucher.partyName,
            });
          }

          return {
            ...voucher,
            // Prefer the customer's latest name first; fallback to transaction data only if customer not found
            partyName:
              (party as any)?.name ||
              (party as any)?.partyName ||
              voucher.partyName ||
              'Unknown Customer',
            partyId: voucher.partyId || (party as any)?.id,
            partyPhone:
              (party as any)?.phoneNumber ||
              voucher.partyPhone ||
              voucher.phone ||
              voucher.phoneNumber ||
              '',
            partyAddress:
              (party as any)?.address ||
              voucher.partyAddress ||
              voucher.address ||
              '',
            partyType: party?.partyType || 'customer',
            // Add debug info
            _debug: {
              matched: !!party,
              matchedPartyId: party?.id,
              matchedPartyName: party?.partyName,
              originalPartyName: voucher.partyName,
            },
            // keep original response for edit-time fallback
            _raw: voucher,
            // Add timestamp to force re-render
            _lastUpdated: Date.now(),
          };
        });

      // Force state update by creating a new array reference
      setApiReceipts([...enrichedReceipts]);
      // Update refresh key to force FlatList re-render
      setRefreshKey(prev => prev + 1);
      console.log(
        '✅ Fetched receipts with customer data:',
        enrichedReceipts.length,
      );
    } catch (e: any) {
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Ensure customers are loaded before fetching receipts for better mapping
        console.log('🔍 ReceiptScreen: Initial load - fetching customers...');
        await fetchAll('');
        console.log(
          '🔍 ReceiptScreen: Initial load - customers fetched, now fetching receipts...',
        );
      } catch (e) {
        console.error('Error loading customers:', e);
      }
      await fetchReceipts();
    })();
    // Initialize receipt number with preview (don't store until transaction is saved)
    const initializeReceiptNumber = async () => {
      try {
        // Preview only - don't store until transaction is saved
        const nextNumber = await generateNextDocumentNumber(
          folderName.toLowerCase(),
          false, // Don't store - this is just a preview
        );
        setReceiptNumber(nextNumber);
      } catch (error) {
        console.error('Error initializing receipt number:', error);
        // Generator fallback will return 'REC-001' for new users
        setReceiptNumber('REC-001');
      }
    };
    initializeReceiptNumber();
  }, []);

  // Listen for profile update events (e.g., when customer is updated in AddPartyScreen)
  useEffect(() => {
    const handleProfileUpdate = async () => {
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
      console.log(
        '📢 ReceiptScreen: Profile update event received, refreshing customers...',
      );
      console.log(
        '📢 ReceiptScreen: Current apiReceipts count:',
        apiReceipts.length,
      );
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
      try {
        // Invalidate cache to ensure fresh customer data
        unifiedApi.invalidateCachePattern('.*/customers.*');
        unifiedApi.invalidateCachePattern('.*/transactions.*');

        // Step 1: Fetch fresh customers via unifiedApi (bypasses cache after invalidation)
        console.log(
          '🔄 ReceiptScreen: Fetching fresh customers via unifiedApi...',
        );
        const customersResponse = (await unifiedApi.getCustomers('')) as any;
        const refreshedCustomers = Array.isArray(customersResponse)
          ? customersResponse
          : Array.isArray(customersResponse?.data)
          ? customersResponse.data
          : [];

        console.log(
          '✅ ReceiptScreen: Fetched',
          refreshedCustomers.length,
          'fresh customers',
        );

        // Step 2: Update customer context FIRST so fetchReceipts() uses updated data
        try {
          await fetchAll('');
          console.log('✅ ReceiptScreen: Customer context updated');
          // Small delay to ensure context state has propagated
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.warn('⚠️ ReceiptScreen: Error updating customer context:', e);
        }

        // Step 3: ALWAYS refresh receipts from server after customer update
        console.log(
          '🔄 ReceiptScreen: Refreshing receipts from server to get latest customer data...',
        );

        // Invalidate transactions cache to force fresh fetch
        unifiedApi.invalidateCachePattern('.*/transactions.*');

        // Fetch fresh receipts and enrich with fresh customer data
        try {
          const response = (await unifiedApi.getReceipts(1, 20)) as {
            data: any;
            status: number;
            headers: Headers;
          };
          const data = response?.data || response || {};
          const vouchers = Array.isArray(data) ? data : data.data || [];

          // Filter and enrich receipts with FRESH customer data
          const expectedType = 'credit';
          const enrichedReceipts = vouchers
            .filter((v: any) => {
              const typeMatches = String(v.type).toLowerCase() === expectedType;
              const isReceiptLike =
                !Array.isArray(v.items) ||
                (Array.isArray(v.items) && v.items.length === 0);
              const isSubscription =
                String(v.category || '').toLowerCase() === 'subscription' ||
                String(v.method || '').toLowerCase() === 'subscription';
              return typeMatches && isReceiptLike && !isSubscription;
            })
            .map((voucher: any) => {
              // Use FRESH customer data to enrich receipt
              let party = null;

              // Try to match by partyId first (most reliable)
              const voucherPartyId =
                voucher.partyId ||
                voucher.customer_id ||
                voucher._raw?.partyId ||
                voucher._raw?.customer_id;

              if (voucherPartyId) {
                party = refreshedCustomers.find(
                  (c: any) => Number(c.id) === Number(voucherPartyId),
                );

                if (party) {
                  console.log('✅ [SERVER REFRESH] Matched receipt by ID:', {
                    receiptId: voucher.id,
                    voucherPartyId: voucherPartyId,
                    customerId: party.id,
                    customerName: party.name || party.partyName,
                  });
                }
              }

              // Fallback to name matching
              if (!party && voucher.partyName) {
                party = refreshedCustomers.find((c: any) => {
                  const customerName = (c.name || c.partyName || '')
                    .toLowerCase()
                    .trim();
                  const receiptName = (voucher.partyName || '')
                    .toLowerCase()
                    .trim();
                  return customerName === receiptName && customerName !== '';
                });
              }

              // Enrich with fresh customer data
              if (party) {
                const newName =
                  party.name || party.partyName || voucher.partyName || '';
                const newPhone =
                  (party as any).phoneNumber ||
                  (party as any).phone ||
                  voucher.partyPhone ||
                  '';
                const newAddress =
                  (party as any).address ||
                  (party as any).addressLine1 ||
                  voucher.partyAddress ||
                  '';

                console.log(
                  '🔄 [SERVER REFRESH] Enriching receipt with fresh customer:',
                  {
                    receiptId: voucher.id,
                    receiptNumber: voucher.receiptNumber || voucher.billNumber,
                    oldName: voucher.partyName,
                    newName: newName,
                    matchedBy:
                      voucher.partyId || voucher.customer_id ? 'ID' : 'Name',
                    customerId: party.id,
                  },
                );

                return {
                  ...voucher,
                  partyName: newName,
                  partyPhone: newPhone,
                  partyAddress: newAddress,
                  _raw: {
                    ...(voucher._raw || {}),
                    partyName: newName,
                    partyPhone: newPhone,
                    partyAddress: newAddress,
                  },
                  _lastUpdated: Date.now(),
                };
              }

              // No match found - return voucher as-is but with timestamp
              return {
                ...voucher,
                _lastUpdated: Date.now(),
              };
            });

          // Update state with enriched receipts
          console.log(
            `✅ ReceiptScreen: Setting ${enrichedReceipts.length} enriched receipts from server`,
          );
          if (enrichedReceipts.length > 0) {
            console.log('🔄 ReceiptScreen: Sample enriched receipt:', {
              id: enrichedReceipts[0]?.id,
              partyName: enrichedReceipts[0]?.partyName,
              partyId: enrichedReceipts[0]?.partyId,
              _lastUpdated: enrichedReceipts[0]?._lastUpdated,
            });
          }

          // Force state update by creating a new array reference
          setApiReceipts([...enrichedReceipts]);
          // Update refresh key to force FlatList re-render
          setRefreshKey(prev => prev + 1);
          console.log(
            '🔄 ReceiptScreen: Refresh key updated to:',
            refreshKey + 1,
          );
        } catch (fetchError) {
          console.error(
            '❌ ReceiptScreen: Error refreshing receipts from server:',
            fetchError,
          );
          // Fallback to regular fetchReceipts
          await fetchReceipts();
          // Still update refresh key even on error
          setRefreshKey(prev => prev + 1);
        }

        console.log(
          '✅ ReceiptScreen: Customers and receipts refreshed after profile update',
        );
      } catch (error) {
        console.error(
          '❌ ReceiptScreen: Error refreshing customers on profile update:',
          error,
        );
      }
    };

    profileUpdateManager.onProfileUpdate(handleProfileUpdate);
    console.log('📢 ReceiptScreen: Registered profile update listener');

    return () => {
      profileUpdateManager.offProfileUpdate(handleProfileUpdate);
      console.log('📢 ReceiptScreen: Unregistered profile update listener');
    };
  }, [fetchAll, fetchReceipts, apiReceipts]);

  // Refresh data when screen regains focus to avoid stale customer/receipt info
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Don't refresh while editing
      if (showCreateForm || editingItem) {
        console.log('🔄 ReceiptScreen: Skipping refresh - in edit mode');
        return;
      }

      console.log('🔄 ReceiptScreen: Screen focused, refreshing data...');
      // Invalidate cache to ensure fresh data
      unifiedApi.invalidateCachePattern('.*/customers.*');
      unifiedApi.invalidateCachePattern('.*/transactions.*');

      // Refresh customers and receipts when screen comes into focus
      fetchAll('')
        .then(() => {
          fetchReceipts();
        })
        .catch(e => {
          console.error('Error refreshing data on focus:', e);
          fetchReceipts(); // Still try to fetch receipts even if customers fail
        });
    });

    return unsubscribe;
  }, [navigation, showCreateForm, editingItem]);

  if (showCreateForm) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <StableStatusBar
          backgroundColor="#4f8cff"
          barStyle="light-content"
          translucent={false}
          animated={true}
        />
        {/* Header */}
        <View
          style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
        >
          <View style={{ height: HEADER_CONTENT_HEIGHT }} />
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleBackToList}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={25}
                color="#fff"
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
          contentContainerStyle={{ paddingBottom: openDropdown ? 300 : 100 }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={120}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
        >
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
                style={{
                  color: '#856404',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Processing document with OCR...
              </Text>
            </View>
          )}

          {/* Voice Loading and Error States */}
          {voiceLoading && (
            <View
              style={{
                backgroundColor: '#e3f2fd',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#90caf9',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator
                size="small"
                color="#1976d2"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: '#1976d2',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Processing voice input...
              </Text>
            </View>
          )}

          {voiceError && (
            <View
              style={{
                backgroundColor: '#ffebee',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#ffcdd2',
              }}
            >
              <Text
                style={{
                  color: '#c62828',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Voice Error: {voiceError}
              </Text>
            </View>
          )}

          {/* Show last voice response */}
          {lastVoiceText && (
            <View
              style={{
                backgroundColor: '#f0f6ff',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#4f8cff',
              }}
            >
              <Text
                style={{
                  color: '#1e40af',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Voice Input: {lastVoiceText}
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
              <Text
                style={{
                  color: '#721c24',
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                <Text style={{ fontFamily: 'Roboto-Medium' }}>OCR Error: </Text>
                {ocrError}
              </Text>
            </View>
          )}
          {/* Receipt Details Card */}
          <TouchableWithoutFeedback onPress={handleOutsideClick}>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>
                    {folderName} Date
                    <Text
                      style={{
                        color: '#d32f2f',
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      {' '}
                      *
                    </Text>{' '}
                    {/* Required asterisk - darker red */}
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    <TextInput
                      ref={receiptDateRef}
                      style={[
                        styles.input,
                        isFieldInvalid(receiptDate) && { borderColor: 'red' },

                        focusedField === 'receiptDate' && styles.inputFocused,
                      ]}
                      value={receiptDate}
                      editable={false}
                      pointerEvents="none"
                      onFocus={() => {
                        setFocusedField('receiptDate');
                        if (scrollRef.current && receiptDateRef.current) {
                          scrollRef.current.scrollToFocusedInput(
                            receiptDateRef.current,
                            120,
                          );
                        }
                      }}
                      onBlur={() => setFocusedField(null)}
                    />
                  </TouchableOpacity>
                  {triedSubmit && !receiptDate && (
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
                <Text style={styles.inputLabel}>
                  {folderName} Customer
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <View
                  ref={customerInputRef}
                  style={{
                    borderWidth: 1,
                    zIndex: 999999999,
                    borderColor: isFieldInvalid(customerInput)
                      ? 'red'
                      : '#e0e0e0',
                    borderRadius: 8,
                    // overflow: 'hidden',
                  }}
                >
                  <CustomerSelector
                    value={customerInput}
                    onChange={(name, customerObj) => {
                      // Always update the customer input field
                      setCustomerInput(name);

                      // If a customer object is provided (from dropdown selection), populate all fields
                      if (customerObj) {
                        // Update all customer-related fields immediately
                        const phoneValue =
                          (customerObj as any).phoneNumber ||
                          (customerObj as any).phone ||
                          (customerObj as any).phone_number ||
                          '';
                        const addressValue =
                          (customerObj as any).address ||
                          (customerObj as any).addressLine1 ||
                          (customerObj as any).address_line1 ||
                          (customerObj as any).address1 ||
                          '';

                        setCustomerPhone(normalizePhoneForUI(phoneValue));
                        setCustomerAddress(addressValue);
                        setSelectedCustomer(customerObj as any);
                      } else {
                        // If user is typing (no customer object), clear related fields if name doesn't match selected customer
                        if (
                          selectedCustomer &&
                          name.trim().toLowerCase() !==
                            (
                              selectedCustomer.partyName ||
                              selectedCustomer.name ||
                              ''
                            )
                              .trim()
                              .toLowerCase()
                        ) {
                          setSelectedCustomer(null);
                          setCustomerPhone('');
                          setCustomerAddress('');
                        }
                      }
                    }}
                    placeholder={`Search Customer`}
                    scrollRef={scrollRef}
                    onCustomerSelect={async customer => {
                      // This callback is called after onChange, so we don't need to duplicate the logic
                      // Just ensure the selected customer is properly set
                      const selectedName = customer.partyName || '';

                      // Double-check that all fields are set correctly
                      setCustomerInput(selectedName);
                      setCustomerPhone(
                        normalizePhoneForUI(
                          (customer as any).phoneNumber ||
                            (customer as any).phone ||
                            (customer as any).phone_number ||
                            '',
                        ),
                      );
                      setCustomerAddress(
                        (customer as any).address ||
                          (customer as any).addressLine1 ||
                          (customer as any).address_line1 ||
                          (customer as any).address1 ||
                          '',
                      );
                      setSelectedCustomer(customer as any);
                      // If phone/address missing on selection, fetch full detail
                      if (
                        !(
                          (customer as any).phoneNumber ||
                          (customer as any).phone
                        ) ||
                        !(
                          (customer as any).address ||
                          (customer as any).addressLine1 ||
                          (customer as any).address_line1 ||
                          (customer as any).address1
                        )
                      ) {
                        await loadCustomerDetailAndFill((customer as any).id);
                      }
                    }}
                  />
                </View>
                {isFieldInvalid(customerInput) && (
                  <Text style={styles.errorTextField}>
                    Customer is required.
                  </Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Phone
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <TextInput
                  ref={customerPhoneRef}
                  style={[
                    styles.input,
                    { color: '#333333' },
                    isFieldInvalid(customerPhone, 'phone') && {
                      borderColor: '#dc3545',
                      borderWidth: 2,
                    },
                    focusedField === 'customerPhone' && styles.inputFocused,
                    editingItem && {
                      backgroundColor: '#f5f5f5',
                      color: '#666666',
                    },
                  ]}
                  value={customerPhone}
                  onChangeText={editingItem ? undefined : setCustomerPhone}
                  placeholder="98765 43210"
                  placeholderTextColor="#666666"
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!editingItem}
                  pointerEvents={editingItem ? 'none' : 'auto'}
                  onFocus={() => {
                    if (!editingItem) {
                      setFocusedField('customerPhone');
                      if (scrollRef.current && customerPhoneRef.current) {
                        scrollRef.current.scrollToFocusedInput(
                          customerPhoneRef.current,
                          120,
                        );
                      }
                    }
                  }}
                  onBlur={() => setFocusedField(null)}
                />
                {getFieldError('customerPhone') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('customerPhone')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Address
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <TextInput
                  ref={customerAddressRef}
                  style={[
                    styles.input,
                    {
                      minHeight: scale(80),
                      textAlignVertical: 'top',
                      color: '#333333',
                    },
                    isFieldInvalid(customerAddress, 'address') && {
                      borderColor: '#dc3545',
                      borderWidth: 2,
                    },
                    focusedField === 'customerAddress' && styles.inputFocused,
                  ]}
                  value={customerAddress}
                  onChangeText={setCustomerAddress}
                  placeholder="Customer address"
                  placeholderTextColor="#666666"
                  multiline
                  onFocus={() => {
                    setFocusedField('customerAddress');
                    if (scrollRef.current && customerAddressRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        customerAddressRef.current,
                        120,
                      );
                    }
                  }}
                  onBlur={() => setFocusedField(null)}
                />
                {getFieldError('customerAddress') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('customerAddress')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Amount (₹)
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <TextInput
                  ref={amountRef}
                  style={[
                    styles.input,
                    isFieldInvalid(amount) && {
                      borderColor: '#dc3545',
                      borderWidth: 2,
                    },
                    focusedField === 'amount' && styles.inputFocused,
                  ]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0"
                  placeholderTextColor="#666666"
                  keyboardType="numeric"
                  onFocus={() => {
                    setFocusedField('amount');
                    if (scrollRef.current && amountRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        amountRef.current,
                        120,
                      );
                    }
                  }}
                  onBlur={() => setFocusedField(null)}
                />
                {getFieldError('amount') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('amount')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Payment Method
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <View ref={paymentMethodRef} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: scale(19),
                        marginTop: 4,
                      },
                      isFieldInvalid(paymentMethod) && {
                        borderColor: 'red',
                      },
                    ]}
                    onPress={() => setShowPaymentMethodModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: scale(18),
                        color: paymentMethod ? '#000' : '#666',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      {paymentMethod ? paymentMethod : 'Select payment method'}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={scale(24)}
                      color="#666666"
                    />
                  </TouchableOpacity>
                </View>
                {isFieldInvalid(paymentMethod) && (
                  <Text style={styles.errorTextField}>
                    Payment method is required.
                  </Text>
                )}
              </View>
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Category
                  <Text
                    style={{
                      color: '#dc3545',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {' '}
                    *
                  </Text>
                </Text>
                <View ref={categoryRef} style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: scale(19),
                        marginTop: 4,
                      },
                      isFieldInvalid(category) && {
                        borderColor: 'red',
                      },
                    ]}
                    onPress={() => setShowCategoryModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: scale(18),
                        color: category ? '#000' : '#666',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      {category ? category : 'Select category'}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={scale(24)}
                      color="#666666"
                    />
                  </TouchableOpacity>
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
                  style={[
                    styles.input,
                    focusedField === 'description' && styles.inputFocused,
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={`Payment description`}
                  placeholderTextColor="#666666"
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <View style={[styles.fieldWrapper, { marginBottom: scale(40) }]}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  ref={notesRef}
                  style={[
                    styles.input,
                    { minHeight: scale(60), textAlignVertical: 'top' },
                    focusedField === 'notes' && styles.inputFocused,
                  ]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={`Additional notes...`}
                  placeholderTextColor="#666666"
                  multiline
                  onFocus={() => {
                    setFocusedField('notes');
                    if (scrollRef.current && notesRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        notesRef.current,
                        120,
                      );
                    }
                  }}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAwareScrollView>

        {/* Bottom Action Buttons - matched to PaymentScreen/AddNewEntryScreen */}
        <View style={styles.buttonContainer}>
          {editingItem ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.updateButtonEdit,
                  loadingSave ? styles.buttonDisabled : {},
                ]}
                onPress={() => handleSubmit('complete')}
                disabled={loadingSave}
              >
                {loadingSave ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={styles.submitButtonText}
                  >{`Update ${folderName}`}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButtonEdit}
                onPress={() => deleteReceipt(editingItem.id)}
                disabled={loadingSave}
              >
                {loadingSave ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="delete"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.deleteButtonText}>DELETE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.submitButton,
                styles.submitButtonFullWidth,
                loadingSave ? styles.buttonDisabled : {},
              ]}
              onPress={() => handleSubmit('complete')}
              disabled={loadingSave}
            >
              {loadingSave ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={styles.submitButtonText}
                >{`Save ${folderName}`}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Method Modal */}
        {showPaymentMethodModal && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowPaymentMethodModal(false)}
            />
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 12,
                paddingBottom: 34,
                height: '80%',
                width: '100%',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              }}
            >
              {/* Drag Handle */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: '#d1d5db',
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                  flexShrink: 0,
                }}
              />

              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 24,
                  marginBottom: 24,
                  flexShrink: 0,
                }}
              >
                <TouchableOpacity
                  onPress={() => setShowPaymentMethodModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#f3f4f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '600',
                      color: '#111827',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Select Payment Method
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#6b7280',
                      marginTop: 4,
                      fontFamily: 'Roboto-Regular',
                    }}
                  >
                    Choose your preferred payment method
                  </Text>
                </View>
                <View style={{ width: 32 }} />
              </View>

              {/* Payment Methods List */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingBottom: 20,
                  flexGrow: 1,
                }}
                nestedScrollEnabled={true}
                scrollEnabled={true}
                bounces={true}
              >
                {paymentMethods.map((method, index) => (
                  <TouchableOpacity
                    key={method.name}
                    onPress={() => {
                      setPaymentMethod(method.name);
                      setShowPaymentMethodModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      marginBottom: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor:
                        paymentMethod === method.name ? '#3b82f6' : '#e5e7eb',
                      backgroundColor:
                        paymentMethod === method.name ? '#eff6ff' : '#fff',
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#3b82f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={method.icon as any}
                        size={20}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '500',
                          color: '#111827',
                          marginBottom: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {method.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#6b7280',
                          fontFamily: 'Roboto-Regular',
                        }}
                      >
                        {method.description}
                      </Text>
                    </View>
                    {paymentMethod === method.name && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color="#3b82f6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowCategoryModal(false)}
            />
            <View
              style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 12,
                paddingBottom: 34,
                height: '80%',
                width: '100%',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
              }}
            >
              {/* Drag Handle */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: '#d1d5db',
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 20,
                  flexShrink: 0,
                }}
              />

              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 24,
                  marginBottom: 24,
                  flexShrink: 0,
                }}
              >
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#f3f4f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '600',
                      color: '#111827',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Select Category
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#6b7280',
                      marginTop: 4,
                      fontFamily: 'Roboto-Regular',
                    }}
                  >
                    Choose the receipt category
                  </Text>
                </View>
                <View style={{ width: 32 }} />
              </View>

              {/* Categories List */}
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingBottom: 20,
                  flexGrow: 1,
                }}
                nestedScrollEnabled={true}
                scrollEnabled={true}
                bounces={true}
              >
                {categories.map((cat, index) => (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => {
                      setCategory(cat.name);
                      setShowCategoryModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      marginBottom: 8,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor:
                        category === cat.name ? '#3b82f6' : '#e5e7eb',
                      backgroundColor:
                        category === cat.name ? '#eff6ff' : '#fff',
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#3b82f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={20}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '500',
                          color: '#111827',
                          marginBottom: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {cat.name}
                      </Text>
                    </View>
                    {category === cat.name && (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color="#3b82f6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
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
              borderRadius: scale(20),
              maxHeight: '95%',
              minHeight: scale(600),
              width: '95%',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: scale(10),
              },
              shadowOpacity: 0.25,
              shadowRadius: scale(20),
              elevation: 10,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: scale(24),
                paddingTop: scale(24),
                paddingBottom: scale(16),
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text
                style={{
                  fontSize: scale(22),
                  color: '#333333',
                  textAlign: 'center',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Choose File Type
              </Text>
              <Text
                style={{
                  fontSize: scale(14),
                  color: '#666666',
                  textAlign: 'center',
                  lineHeight: scale(20),
                  marginTop: scale(8),
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Select the type of file you want to upload for OCR processing
              </Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={{
                flex: 1,
                paddingHorizontal: scale(24),
              }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                paddingVertical: scale(20),
                paddingBottom: scale(40),
              }}
              nestedScrollEnabled={true}
              bounces={true}
              alwaysBounceVertical={false}
            >
              {/* File Type Options */}
              <View style={{ marginBottom: scale(20) }}>
                {/* Image Option */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: scale(12),
                    padding: scale(20),
                    marginBottom: scale(12),
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: scale(2) },
                    shadowOpacity: 0.05,
                    shadowRadius: scale(4),
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('image')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: scale(48),
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: '#f0f6ff',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: scale(16),
                    }}
                  >
                    <MaterialCommunityIcons
                      name="image"
                      size={scale(24)}
                      color="#4f8cff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: scale(16),
                        color: '#333333',
                        marginBottom: scale(4),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Image
                    </Text>
                    <Text
                      style={{
                        fontSize: scale(14),
                        color: '#666666',
                        lineHeight: scale(20),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload receipt images (JPG, PNG) for OCR processing
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={scale(24)}
                    color="#ccc"
                  />
                </TouchableOpacity>

                {/* PDF Option */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: scale(12),
                    padding: scale(20),
                    marginBottom: scale(12),
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: scale(2) },
                    shadowOpacity: 0.05,
                    shadowRadius: scale(4),
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('pdf')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: scale(48),
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: '#fff3cd',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: scale(16),
                    }}
                  >
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={scale(24)}
                      color="#ffc107"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: scale(16),
                        color: '#333333',
                        marginBottom: scale(4),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      PDF Document
                    </Text>
                    <Text
                      style={{
                        fontSize: scale(14),
                        color: '#666666',
                        lineHeight: scale(20),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload PDF receipts for text extraction and processing
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={scale(24)}
                    color="#ccc"
                  />
                </TouchableOpacity>
              </View>

              {/* Receipt Template Example */}
              <View
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: scale(12),
                  padding: scale(16),
                  marginBottom: scale(24),
                  borderWidth: 1,
                  borderColor: '#e9ecef',
                }}
              >
                <Text
                  style={{
                    fontSize: scale(16), // 14 + 2
                    color: '#333333', // Important text - black for maximum contrast
                    marginBottom: scale(12),
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Real Receipt Example:
                </Text>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: scale(16),
                    borderWidth: 1,
                    borderColor: '#dee2e6',
                  }}
                >
                  <Text
                    style={{
                      fontSize: scale(14), // 12 + 2
                      color: '#333333', // Important text - black for maximum contrast
                      marginBottom: scale(8),
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Receipt
                  </Text>
                  <View style={{ marginBottom: scale(8) }}>
                    <Text
                      style={{
                        fontSize: scale(12), // 10 + 2
                        color: '#666666', // Card content - darker for better readability
                        lineHeight: scale(18),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Receipt Number:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        PUR-76575{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Receipt Date:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        2025-07-15{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Customer Name:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        Rajesh Singh{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Phone:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        917865434576{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Address:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        404 Jack Palace, Switzerland{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Amount:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        800{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Payment Method:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        Cash{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Category:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        Sales
                      </Text>
                    </Text>
                  </View>
                  {/* Description */}
                  <View style={{ marginBottom: scale(8) }}>
                    <Text
                      style={{
                        fontSize: scale(12), // 10 + 2
                        color: '#333333', // Important text - black for maximum contrast
                        marginBottom: scale(4),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Description
                    </Text>
                    <Text
                      style={{
                        fontSize: scale(11), // 9 + 2
                        color: '#666666', // Card content - darker for better readability
                        lineHeight: scale(16),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      That invoice is for basic thing that i sold
                    </Text>
                  </View>
                  {/* Notes */}
                  <View>
                    <Text
                      style={{
                        fontSize: scale(11), // 9 + 2
                        color: '#666666', // Card content - darker for better readability
                        lineHeight: scale(16),
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Notes:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        Weather is Clean, and air is fresh
                      </Text>
                    </Text>
                  </View>
                </View>
                {/* Tip */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginTop: scale(12),
                    backgroundColor: '#fff3cd',
                    borderRadius: scale(6),
                    padding: scale(8),
                    borderWidth: 1,
                    borderColor: '#ffeaa7',
                  }}
                >
                  <MaterialCommunityIcons
                    name="lightbulb-outline"
                    size={scale(16)}
                    color="#ffc107"
                    style={{ marginTop: scale(1) }}
                  />
                  <Text
                    style={{
                      fontSize: scale(12), // 10 + 2
                      color: '#856404',
                      marginLeft: scale(6),
                      flex: 1,
                      lineHeight: scale(16),
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Tip: Clear, well-lit images or text-based PDFs work best for
                    OCR
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: scale(24),
                paddingVertical: scale(16),
                borderTopWidth: 1,
                borderTopColor: '#f0f0f0',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: scale(12),
                  paddingVertical: scale(14),
                  paddingHorizontal: scale(24),
                  borderWidth: 1,
                  borderColor: '#dee2e6',
                  alignItems: 'center',
                }}
                onPress={() => setShowFileTypeModal(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: scale(16), // 14 + 2
                    color: '#666666',
                    fontFamily: 'Roboto-Medium',
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

  // In the main receipt list view, show loading/error states
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
      {/* Header */}
      <View
        style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
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
        inputTextColor="#333333"
        placeholderTextColor="#666666"
      />
      {/* Add the advanced filter modal (same as PaymentScreen, adapted for receipts) */}
      <Modal
        isVisible={filterVisible}
        onBackdropPress={() => setFilterVisible(false)}
        style={{ justifyContent: 'flex-end', margin: 0, marginBottom: 0 }}
      >
        <KeyboardAwareScrollView
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: scale(18),
            borderTopRightRadius: scale(18),
            maxHeight: '80%',
          }}
          contentContainerStyle={{ padding: scale(20) }}
          enableOnAndroid
          extraScrollHeight={120}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with close button */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: scale(20),
              paddingTop: scale(10),
            }}
          >
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                width: scale(40),
                height: scale(40),
                borderRadius: scale(20),
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: scale(16),
              }}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={scale(24)}
                color="#4f8cff"
              />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: scale(20), // 18 + 2
                color: '#333333',
                fontFamily: 'Roboto-Medium',
                fontWeight: '600',
                flex: 1,
              }}
            >
              Filter Receipts
            </Text>
          </View>
          {/* Amount Range */}
          <Text
            style={{
              fontSize: scale(15), // 13 + 2
              marginBottom: scale(6),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Amount Range
          </Text>
          <View
            style={{
              flexDirection: 'row',
              marginBottom: scale(16),
              gap: scale(8),
            }}
          >
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(12),
                fontSize: scale(16), // 14 + 2
                fontFamily: 'Roboto-Medium',
                backgroundColor: '#fff',
                minHeight: scale(48),
                color: '#333333',
              }}
              placeholder="Min"
              placeholderTextColor="#666666"
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
                borderRadius: scale(8),
                padding: scale(12),
                fontSize: scale(16), // 14 + 2
                fontFamily: 'Roboto-Medium',
                backgroundColor: '#fff',
                minHeight: scale(48),
                color: '#333333',
              }}
              placeholder="Max"
              placeholderTextColor="#666666"
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
          <Text
            style={{
              fontSize: scale(15), // 13 + 2
              marginBottom: scale(6),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Date Range
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: scale(16),
              gap: scale(8),
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(12),
                backgroundColor: '#fff',
                minHeight: scale(48),
                justifyContent: 'center',
              }}
              onPress={() => setShowDatePickerFrom(true)}
            >
              <Text
                style={{
                  color: searchFilter.dateFrom ? '#333333' : '#666666',
                  fontSize: scale(16), // 14 + 2
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {searchFilter.dateFrom || 'From'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(12),
                backgroundColor: '#fff',
                minHeight: scale(48),
                justifyContent: 'center',
              }}
              onPress={() => setShowDatePickerTo(true)}
            >
              <Text
                style={{
                  color: searchFilter.dateTo ? '#333333' : '#666666',
                  fontSize: scale(16), // 14 + 2
                  fontFamily: 'Roboto-Medium',
                }}
              >
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
          <Text
            style={{
              fontSize: scale(16), // 14 + 2
              color: '#333333',
              marginBottom: scale(12),
              marginTop: scale(8),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Payment Method
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: scale(20) }}
          >
            <View style={{ flexDirection: 'row', gap: scale(8) }}>
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
                        ? '#4f8cff'
                        : '#ffffff',
                    borderColor:
                      searchFilter.paymentMethod === method
                        ? '#4f8cff'
                        : '#e0e0e0',
                    borderWidth: 1,
                    borderRadius: scale(20),
                    paddingVertical: scale(10),
                    paddingHorizontal: scale(16),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scale(80),
                  }}
                  onPress={() =>
                    setSearchFilter(f => ({
                      ...f,
                      paymentMethod:
                        f.paymentMethod === method ? undefined : method,
                    }))
                  }
                >
                  <Text
                    style={{
                      color:
                        searchFilter.paymentMethod === method
                          ? '#ffffff'
                          : '#333333',
                      fontSize: scale(14), // 12 + 2
                      fontWeight: '500',
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {/* Status Filter */}
          <Text
            style={{
              fontSize: scale(16), // 14 + 2
              color: '#333333',
              marginBottom: scale(12),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Status
          </Text>
          <View
            style={{
              flexDirection: 'row',
              marginBottom: scale(20),
              gap: scale(8),
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
                      ? '#4f8cff'
                      : '#ffffff',
                  borderColor:
                    (status === '' && !searchFilter.status) ||
                    searchFilter.status === status
                      ? '#4f8cff'
                      : '#e0e0e0',
                  borderWidth: 1,
                  borderRadius: scale(20),
                  paddingVertical: scale(10),
                  paddingHorizontal: scale(16),
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
                        ? '#ffffff'
                        : '#333333',
                    fontSize: scale(14), // 12 + 2
                    fontWeight: '500',
                    textTransform: 'capitalize',
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
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
              fontSize: scale(16), // 14 + 2
              color: '#333333',
              marginBottom: scale(12),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Category
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: scale(20),
              gap: scale(8),
            }}
          >
            {[
              'Customer',
              'Client',
              'Vendor',
              'Partner',
              'Individual',
              'Business',
              'Other',
            ].map((cat, idx) => (
              <TouchableOpacity
                key={cat}
                style={{
                  backgroundColor:
                    searchFilter.category === cat ? '#4f8cff' : '#ffffff',
                  borderColor:
                    searchFilter.category === cat ? '#4f8cff' : '#e0e0e0',
                  borderWidth: 1,
                  borderRadius: scale(20),
                  paddingVertical: scale(10),
                  paddingHorizontal: scale(16),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(80),
                }}
                onPress={() =>
                  setSearchFilter(f => ({
                    ...f,
                    category: f.category === cat ? undefined : cat,
                  }))
                }
              >
                <Text
                  style={{
                    color:
                      searchFilter.category === cat ? '#ffffff' : '#333333',
                    fontSize: scale(14), // 12 + 2
                    fontWeight: searchFilter.category === cat ? '600' : '500',
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Reference Number Filter */}
          <Text
            style={{
              fontSize: scale(15), // 13 + 2
              marginBottom: scale(6),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Reference Number
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: scale(8),
              padding: scale(12),
              marginBottom: scale(16),
              fontSize: scale(16), // 14 + 2
              fontFamily: 'Roboto-Medium',
              backgroundColor: '#fff',
              minHeight: scale(48),
              color: '#333333',
            }}
            placeholder="Reference number"
            placeholderTextColor="#666666"
            value={searchFilter.reference || ''}
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, reference: v || undefined }))
            }
          />
          {/* Description/Notes Filter */}
          <Text
            style={{
              fontSize: scale(15), // 13 + 2
              marginBottom: scale(6),
              fontFamily: 'Roboto-Medium',
            }}
          >
            Description/Notes
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: scale(8),
              padding: scale(12),
              marginBottom: scale(16),
              fontSize: scale(16), // 14 + 2
              fontFamily: 'Roboto-Medium',
              backgroundColor: '#fff',
              minHeight: scale(48),
              color: '#333333',
            }}
            placeholder="Description or notes keywords"
            placeholderTextColor="#666666"
            value={searchFilter.description || ''}
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, description: v || undefined }))
            }
          />
          {/* Reset/Apply buttons */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: scale(20),
              marginTop: scale(12),
              gap: scale(16),
            }}
          >
            <TouchableOpacity
              onPress={() => setSearchFilter({ searchText: '' })}
              style={{
                flex: 1,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#dc3545',
                borderRadius: scale(8),
                paddingVertical: scale(12),
                paddingHorizontal: scale(16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#dc3545',
                  fontSize: scale(16), // 14 + 2
                  fontFamily: 'Roboto-Medium',
                  fontWeight: '500',
                }}
              >
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                flex: 1,
                backgroundColor: '#4f8cff',
                borderWidth: 1,
                borderColor: '#4f8cff',
                borderRadius: scale(8),
                paddingVertical: scale(12),
                paddingHorizontal: scale(16),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: scale(16), // 14 + 2
                  fontFamily: 'Roboto-Medium',
                  fontWeight: '500',
                }}
              >
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
            style={{ marginTop: scale(40) }}
          />
        ) : apiError ? (
          <Text
            style={{
              color: 'red',
              textAlign: 'center',
              marginTop: scale(40),
              fontFamily: 'Roboto-Medium',
            }}
          >
            {apiError}
          </Text>
        ) : filteredReceipts.length === 0 ? (
          <Text
            style={{
              color: '#555',
              textAlign: 'center',
              marginTop: scale(40),
              fontSize: scale(18), // 16 + 2
              fontFamily: 'Roboto-Medium',
            }}
          >
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        ) : (
          <FlatList
            key={`receipt-list-${refreshKey}`}
            data={paginatedReceipts}
            renderItem={renderReceiptItem}
            keyExtractor={item =>
              `receipt-${item.id}-${refreshKey}-${item._lastUpdated || 0}`
            }
            extraData={`${refreshKey}-${apiReceipts.length}-${
              apiReceipts[0]?._lastUpdated || 0
            }`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            onEndReached={handleLoadMoreReceipts}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderReceiptFooter}
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
        <MaterialCommunityIcons name="plus" size={scale(24)} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default ReceiptScreen;
