import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
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
  PermissionsAndroid,
  Platform,
  StatusBar,
  Modal as RNModal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal'; // Add this import for bottom sheet modal
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
import { useAlert } from '../../context/AlertContext';
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
// Removed SafeAreaView to allow full control over StatusBar area
import SupplierSelector from '../../components/SupplierSelector';
import { useSupplierContext } from '../../context/SupplierContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { getStatusBarSpacerHeight } from '../../utils/statusBarManager';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import StableStatusBar from '../../components/StableStatusBar';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { uiColors, uiFonts } from '../../config/uiSizing';
import {
  generateNextDocumentNumber,
  getDocumentNumberStorageKey,
} from '../../utils/autoNumberGenerator';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { parseInvoiceVoiceText } from '../../utils/voiceParser';
import { profileUpdateManager } from '../../utils/profileUpdateManager';

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PAYMENT_LIST_PAGE_SIZE = 25;

const PaymentScreen: React.FC<FolderProp> = ({ folder }) => {
  const { showAlert } = useAlert();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const folderName = folder?.title || 'Payment';

  // Simple StatusBar configuration - let ForceStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  // Add safety check and logging
  console.log(
    'PaymentScreen render - folder:',
    folder,
    'folderName:',
    folderName,
  );

  // Test function to verify scrolling works (can be removed in production)
  const testScrollToField = (fieldName: string) => {
    console.log(`Testing scroll to field: ${fieldName}`);
    scrollToErrorField('test', fieldName);
  };

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
  const [errors, setErrors] = useState<{
    supplierPhone?: string;
    supplierAddress?: string;
    supplierInput?: string;
    [key: string]: string | undefined;
  }>({});
  const [searchText, setSearchText] = useState('');
  const [openDropdown, setOpenDropdown] = useState<
    'method' | 'category' | null
  >(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const paymentMethodInputRef = useRef<TextInput>(null);
  // Add loading state
  const [loadingSave, setLoadingSave] = useState(false);

  // Helper function to format date as YYYY-MM-DD using local time (no timezone conversion)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to parse YYYY-MM-DD string to Date without timezone issues
  const parseDateLocal = (dateString: string): Date => {
    if (!dateString || dateString.trim() === '') {
      return new Date();
    }
    // Parse YYYY-MM-DD format directly to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const [apiPayments, setApiPayments] = useState<any[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [visiblePaymentCount, setVisiblePaymentCount] = useState(
    PAYMENT_LIST_PAGE_SIZE,
  );
  const [isPaymentPaginating, setIsPaymentPaginating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key for FlatList
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  // FIX: Add the missing state variable and its setter function
  const [paymentNumber, setPaymentNumber] = useState('');
  // Track the selected supplier to persist partyId and default contact details
  const [selectedSupplier, setSelectedSupplier] = useState<{
    id?: number;
    name?: string;
    partyName?: string;
    phoneNumber?: string;
    address?: string;
  } | null>(null);

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

  const scrollRef = useRef<KeyboardAwareScrollView>(null);

  const paymentDateRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const supplierPhoneRef = useRef<TextInput>(null);
  const supplierAddressRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const supplierInputRef = useRef<TextInput>(null);
  const categoryRef = useRef<View>(null);
  const paymentMethodRef = useRef<View>(null);
  const [syncYN, setSyncYN] = useState('N');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Helper: fetch with timeout to avoid long-hanging network calls
  const fetchWithTimeout = useCallback(
    async (
      url: string,
      options: RequestInit = {},
      timeoutMs: number = 15000,
    ) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    },
    [],
  );

  // Helper: run async task in background without blocking the main flow
  const runInBackground = useCallback((task: Promise<any>) => {
    task.catch(() => {});
  }, []);

  // Enhanced validation helpers
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

  // Field refs mapping for error scrolling
  const fieldRefs = {
    paymentDate: paymentDateRef,
    supplierInput: supplierInputRef,
    supplierPhone: supplierPhoneRef,
    supplierAddress: supplierAddressRef,
    amount: amountRef,
    paymentMethod: paymentMethodRef,
    category: categoryRef,
    notes: notesRef,
  };

  // Enhanced function to scroll to error field with improved reliability
  const scrollToErrorField = useCallback(
    (errorType?: string, fieldName?: string) => {
      console.log('scrollToErrorField called with:', { errorType, fieldName });
      if (!scrollRef.current) {
        console.log('scrollRef.current is null, cannot scroll');
        return;
      }

      // Field positions for reliable scrolling (in pixels from top)
      const fieldScrollPositions = {
        paymentDate: 100,
        supplierInput: 200,
        supplierPhone: 300,
        supplierAddress: 400,
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
          'paymentDate',
          'supplierInput',
          'supplierPhone',
          'supplierAddress',
          'amount',
          'paymentMethod',
          'category',
        ];

        for (const field of fieldPriority) {
          const ref = fieldRefs[field as keyof typeof fieldRefs];
          let hasError = false;

          // Check field-specific validation
          switch (field) {
            case 'paymentDate':
              hasError = !paymentDate;
              break;
            case 'supplierInput':
              hasError = !supplierInput;
              break;
            case 'supplierPhone':
              hasError =
                !supplierPhone ||
                (supplierPhone
                  ? isFieldInvalid(supplierPhone, 'phone')
                  : false);
              break;
            case 'supplierAddress':
              hasError =
                !supplierAddress ||
                (supplierAddress
                  ? isFieldInvalid(supplierAddress, 'address')
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
        } catch (error) {
          console.log('scrollToEnd failed:', error);
        }
      }
    },
    [
      paymentDate,
      supplierInput,
      supplierPhone,
      supplierAddress,
      amount,
      paymentMethod,
      category,
      isFieldInvalid,
    ],
  );

  // Validation helpers to avoid overwriting supplier with empty/placeholder data
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

  // Helper: persist extended party info via backend enrichment endpoint
  const persistSupplierAddInfo = useCallback(
    async (
      customerId?: number,
      name?: string,
      phone?: string,
      address?: string,
    ) => {
      try {
        if (!customerId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const addInfoPayload: any = {
          customerId,
          partyName: name || '',
          partyType: 'Supplier',
        };
        if (isValidPhoneValue(phone))
          addInfoPayload.phoneNumber = String(phone).replace(/\D/g, '');
        if (isValidAddressValue(address)) {
          addInfoPayload.address = address;
          addInfoPayload.addressLine1 = address;
          addInfoPayload.addresses = [
            { type: 'billing', flatBuildingNumber: address },
          ];
        }
        if (addInfoPayload.phoneNumber || addInfoPayload.address) {
          await unifiedApi.post('/customers/add-info', addInfoPayload);
        }
      } catch {}
    },
    [],
  );

  // Final fallback: patch /customers/:id directly if fields still missing
  const persistSupplierDirectPatch = useCallback(
    async (
      customerId?: number,
      name?: string,
      phone?: string,
      address?: string,
    ) => {
      try {
        if (!customerId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const payload: any = {};
        if (name && String(name).trim()) {
          const trimmed = String(name).trim();
          payload.name = trimmed;
          payload.partyName = trimmed; // ensure both fields update on backend
        }
        if (isValidPhoneValue(phone))
          payload.phone = String(phone).replace(/\D/g, '');
        if (isValidAddressValue(address)) {
          payload.address = address;
          payload.addressLine1 = address;
          payload.addresses = [
            { type: 'billing', flatBuildingNumber: address },
          ];
        }
        if (Object.keys(payload).length === 0) return;
        await unifiedApi.patch(`/customers/${customerId}`, payload);
      } catch {}
    },
    [],
  );

  // Ensure backend actually stores phone/address before proceeding
  const verifySupplierFields = useCallback(
    async (
      customerId?: number,
      desiredPhone?: string,
      desiredAddress?: string,
    ) => {
      try {
        if (!customerId) return false;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return false;
        const res = (await unifiedApi.get(`/customers/${customerId}`)) as {
          data: any;
          status: number;
          headers: Headers;
        };
        // unifiedApi returns { data, status, headers } structure
        if (res.status < 200 || res.status >= 300) return false;
        const raw = res.data || res;
        const detail = raw?.data || raw || {};
        const phoneVal = String(
          detail?.phoneNumber || detail?.phone || detail?.phone_number || '',
        );
        const addrVal =
          detail?.address ||
          detail?.addressLine1 ||
          detail?.address_line1 ||
          (Array.isArray(detail?.addresses)
            ? detail.addresses[0]?.addressLine1 ||
              detail.addresses[0]?.address_line1
            : '') ||
          '';
        const phoneOk = desiredPhone
          ? phoneVal.replace(/\D/g, '') ===
            String(desiredPhone).replace(/\D/g, '')
          : true;
        const addrOk = desiredAddress
          ? String(addrVal).trim() === String(desiredAddress).trim()
          : true;
        return phoneOk && addrOk;
      } catch {
        return false;
      }
    },
    [],
  );

  const persistAndConfirmSupplier = useCallback(
    async (
      supplierId?: number,
      name?: string,
      phone?: string,
      address?: string,
    ) => {
      if (!supplierId) return;
      // Persist via both helper paths
      await persistSupplierAddInfo(supplierId, name, phone, address);
      await persistSupplierDirectPatch(supplierId, name, phone, address);
      // Poll until backend reflects fields (max 3 tries)
      for (let i = 0; i < 3; i++) {
        const ok = await verifySupplierFields(supplierId, phone, address);
        if (ok) {
          try {
            const raw =
              (await AsyncStorage.getItem('supplierOverrides')) || '{}';
            const map = JSON.parse(raw);
            map[String(supplierId)] = {
              phoneNumber: phone || '',
              address: address || '',
              updatedAt: Date.now(),
            };
            await AsyncStorage.setItem(
              'supplierOverrides',
              JSON.stringify(map),
            );
          } catch {}
          return;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    },
    [persistSupplierAddInfo, persistSupplierDirectPatch, verifySupplierFields],
  );

  // Helper: load supplier detail from backend if list lacks phone/address
  const loadSupplierDetailAndFill = useCallback(
    async (supplierId?: number) => {
      try {
        if (!supplierId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const res = (await unifiedApi.get(`/customers/${supplierId}`)) as {
          data: any;
          status: number;
          headers: Headers;
        };
        // unifiedApi returns { data, status, headers } structure
        if (res.status < 200 || res.status >= 300) return;
        const raw = res.data || res;
        const detail = raw?.data || raw || {};
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
        if (!isValidPhoneValue(supplierPhone) && isValidPhoneValue(phoneVal))
          setSupplierPhone(normalizePhoneForUI(String(phoneVal)));
        if (
          !isValidAddressValue(supplierAddress) &&
          isValidAddressValue(addrVal)
        )
          setSupplierAddress(String(addrVal));
      } catch {}
    },
    [supplierPhone, supplierAddress],
  );

  // Add filter state
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterAmount, setFilterAmount] = useState<'none' | 'asc' | 'desc'>(
    'none',
  );
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'complete' | 'overdue'
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
          if (parsed.supplierPhone)
            setSupplierPhone(normalizePhoneForUI(parsed.supplierPhone));
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
          if (parsed.supplierPhone)
            setSupplierPhone(normalizePhoneForUI(parsed.supplierPhone));
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
        setTimeout(() => scrollToErrorField('file'), 100);
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
        setTimeout(() => scrollToErrorField('file'), 100);
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
        setTimeout(() => scrollToErrorField('file'), 100);
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
        setTimeout(() => scrollToErrorField('file'), 100);
        return;
      }

      // Only show generic error for unexpected errors
      console.error('❌ Unexpected error details:', {
        message: err?.message || 'Unknown error',
        code: err?.code || 'No code',
        stack: err?.stack || 'No stack trace',
      });
      setError('Failed to process the file. Please try again.');
      setTimeout(() => scrollToErrorField('file'), 100);
    }
  };

  const {
    suppliers,
    add: addSupplierCtx,
    fetchAll: fetchSuppliersCtx,
    update: updateSupplierCtx,
  } = useSupplierContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup, getServiceStatus } =
    useTransactionLimit();

  // Function to close dropdowns when clicking outside
  const handleOutsideClick = useCallback(() => setOpenDropdown(null), []);

  // Move fetchPayments to top-level so it can be called from handleSubmit
  // Prevent overlapping fetches
  const isFetchingPaymentsRef = useRef(false);

  const fetchPayments = async () => {
    if (isFetchingPaymentsRef.current) return;
    isFetchingPaymentsRef.current = true;
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const currentSuppliersAny: any[] = (suppliers as any[]) || [];
      console.log('📊 Suppliers data:', {
        totalSuppliers: currentSuppliersAny.length,
        sampleSupplier: currentSuppliersAny[0] || 'No suppliers',
        supplierFields: currentSuppliersAny[0]
          ? Object.keys(currentSuppliersAny[0])
          : [],
      });

      // Use unified API with pagination - optimized!
      const response = (await unifiedApi.getPayments(1, 20)) as {
        data: any;
        status: number;
        headers: Headers;
      }; // Paginated for better performance
      const data = response?.data || response || {};
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

      // Payments screen should always expect 'debit' transactions
      const expectedType = 'debit';

      // Merge supplier data with vouchers
      const enrichedPayments = vouchers
        .filter((v: any) => {
          const typeMatches = String(v.type).toLowerCase() === expectedType;
          // Payments are debit without line items. Purchases have items
          const isPaymentLike =
            !Array.isArray(v.items) ||
            (Array.isArray(v.items) && v.items.length === 0);
          // Do not filter by method; payments may have method like Cash/UPI/etc.
          const matches = typeMatches && isPaymentLike;
          if (!matches) {
            console.log('❌ Voucher filtered out:', {
              id: v.id,
              type: v.type,
              expectedType,
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
            party = currentSuppliersAny.find(
              (s: any) =>
                s.name?.toLowerCase() === voucher.partyName?.toLowerCase(),
            );
            if (party) {
              console.log('✅ Matched by exact partyName:', party.name);
            }
          }

          // Strategy 2: Try partial name matching if exact match didn't work
          if (!party && voucher.partyName) {
            party = currentSuppliersAny.find((s: any) => {
              const sName = s.name?.toLowerCase() || '';
              const vName = voucher.partyName?.toLowerCase() || '';
              return sName.includes(vName) || vName.includes(sName);
            });
            if (party) {
              console.log('✅ Matched by partial partyName:', party.name);
            }
          }

          // Strategy 3: Try to match by partyId as fallback (if it exists)
          if (!party && voucher.partyId) {
            party = currentSuppliersAny.find(
              (s: any) => s.id === voucher.partyId,
            );
            if (party) {
              console.log('✅ Matched by partyId:', party.name);
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
            // Prefer the supplier's latest name first; fallback to transaction data only if supplier not found
            partyName:
              (party as any)?.name ||
              (party as any)?.partyName ||
              voucher.partyName ||
              'Unknown Party',
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
            category: voucher.category || voucher.Category || voucher.cat || '',
            notes: voucher.notes || voucher.note || voucher.remarks || '',
            partyType: 'supplier',
            // Add debug info
            _debug: {
              matched: !!party,
              matchedPartyId: party?.id,
              matchedPartyName: (party as any)?.name,
              originalPartyName: voucher.partyName,
            },
            // keep original response for edit-time fallback
            _raw: voucher,
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
      isFetchingPaymentsRef.current = false;
      setLoadingApi(false);
    }
  };

  const didInitialLoadRef = useRef(false);
  const previousSuppliersRef = useRef<string>('');

  useEffect(() => {
    (async () => {
      try {
        // Load suppliers and payments in parallel to reduce total load time
        await Promise.all([fetchSuppliersCtx(''), fetchPayments()]);
      } catch (e) {
        // If one fails, try to at least fetch payments
        try {
          await fetchPayments();
        } catch {}
      } finally {
        didInitialLoadRef.current = true;
      }
    })();
    // Initialize payment number with preview (don't store until transaction is saved)
    const initializePaymentNumber = async () => {
      try {
        // Preview only - don't store until transaction is saved
        const nextNumber = await generateNextDocumentNumber(
          folderName.toLowerCase(),
          false, // Don't store - this is just a preview
        );
        setPaymentNumber(nextNumber);
      } catch (error) {
        console.error('Error initializing payment number:', error);
        // Generator fallback will return 'PAY-001' for new users
        setPaymentNumber('PAY-001');
      }
    };
    initializePaymentNumber();
  }, []);

  // Listen for profile update events (e.g., when supplier is updated in AddPartyScreen)
  useEffect(() => {
    const handleProfileUpdate = async () => {
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
      console.log(
        '📢 PaymentScreen: Profile update event received, refreshing suppliers...',
      );
      console.log(
        '📢 PaymentScreen: Current apiPayments count:',
        apiPayments.length,
      );
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
      try {
        // Invalidate cache to ensure fresh supplier data
        unifiedApi.invalidateCachePattern('.*/customers.*');
        unifiedApi.invalidateCachePattern('.*/customers/suppliers.*');
        unifiedApi.invalidateCachePattern('.*/transactions.*');
        // Reset supplier hash to force update check
        previousSuppliersRef.current = '';

        // Step 1: Fetch fresh suppliers via unifiedApi (bypasses cache after invalidation)
        console.log(
          '🔄 PaymentScreen: Fetching fresh suppliers via unifiedApi...',
        );
        const suppliersResponse = (await unifiedApi.getSuppliers('')) as any;
        const refreshedSuppliers = Array.isArray(suppliersResponse)
          ? suppliersResponse
          : Array.isArray(suppliersResponse?.data)
          ? suppliersResponse.data
          : [];

        console.log(
          '✅ PaymentScreen: Fetched',
          refreshedSuppliers.length,
          'fresh suppliers',
        );

        // Step 2: Update supplier context FIRST so fetchPayments() uses updated data
        try {
          await fetchSuppliersCtx('');
          console.log('✅ PaymentScreen: Supplier context updated');
          // Small delay to ensure context state has propagated
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.warn('⚠️ PaymentScreen: Error updating supplier context:', e);
        }

        // Step 3: ALWAYS refresh payments from server after supplier update
        // Skip the complex matching logic - just fetch fresh data from server
        // This ensures we get the latest payment data with updated supplier names from the backend
        console.log(
          '🔄 PaymentScreen: Refreshing payments from server to get latest supplier data...',
        );

        // Invalidate transactions cache to force fresh fetch
        unifiedApi.invalidateCachePattern('.*/transactions.*');

        // Fetch fresh payments and enrich with fresh supplier data
        try {
          const token = await AsyncStorage.getItem('accessToken');
          const response = (await unifiedApi.getPayments(1, 20)) as {
            data: any;
            status: number;
            headers: Headers;
          };
          const data = response?.data || response || {};
          const vouchers = Array.isArray(data) ? data : data.data || [];

          // Filter and enrich payments with FRESH supplier data
          const expectedType = 'debit';
          const enrichedPayments = vouchers
            .filter((v: any) => {
              const typeMatches = String(v.type).toLowerCase() === expectedType;
              const isPaymentLike =
                !Array.isArray(v.items) ||
                (Array.isArray(v.items) && v.items.length === 0);
              return typeMatches && isPaymentLike;
            })
            .map((voucher: any) => {
              // Use FRESH supplier data to enrich payment
              let party = null;

              // Try to match by partyId first (most reliable)
              // Check all possible ID fields
              const voucherPartyId =
                voucher.partyId ||
                voucher.customer_id ||
                voucher._raw?.partyId ||
                voucher._raw?.customer_id;

              if (voucherPartyId) {
                party = refreshedSuppliers.find(
                  (s: any) => Number(s.id) === Number(voucherPartyId),
                );

                if (party) {
                  console.log('✅ [SERVER REFRESH] Matched payment by ID:', {
                    paymentId: voucher.id,
                    voucherPartyId: voucherPartyId,
                    supplierId: party.id,
                    supplierName: party.name || party.partyName,
                  });
                }
              }

              // Fallback to name matching (but this might fail if name was updated)
              if (!party && voucher.partyName) {
                party = refreshedSuppliers.find((s: any) => {
                  const supplierName = (s.name || s.partyName || '')
                    .toLowerCase()
                    .trim();
                  const paymentName = (voucher.partyName || '')
                    .toLowerCase()
                    .trim();
                  return supplierName === paymentName && supplierName !== '';
                });
              }

              // Enrich with fresh supplier data
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
                  '🔄 [SERVER REFRESH] Enriching payment with fresh supplier:',
                  {
                    paymentId: voucher.id,
                    paymentNumber: voucher.billNumber || voucher.paymentNumber,
                    oldName: voucher.partyName,
                    newName: newName,
                    matchedBy:
                      voucher.partyId || voucher.customer_id ? 'ID' : 'Name',
                    supplierId: party.id,
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

          // Update state with enriched payments
          console.log(
            `✅ PaymentScreen: Setting ${enrichedPayments.length} enriched payments from server`,
          );
          if (enrichedPayments.length > 0) {
            console.log('🔄 PaymentScreen: Sample enriched payment:', {
              id: enrichedPayments[0]?.id,
              partyName: enrichedPayments[0]?.partyName,
              partyId: enrichedPayments[0]?.partyId,
              _lastUpdated: enrichedPayments[0]?._lastUpdated,
            });
          }

          // Force state update by creating a new array reference
          setApiPayments([...enrichedPayments]);
          // Update refresh key to force FlatList re-render
          setRefreshKey(prev => prev + 1);
          console.log(
            '🔄 PaymentScreen: Refresh key updated to:',
            refreshKey + 1,
          );
        } catch (fetchError) {
          console.error(
            '❌ PaymentScreen: Error refreshing payments from server:',
            fetchError,
          );
          // Fallback to regular fetchPayments
          await fetchPayments();
          // Still update refresh key even on error
          setRefreshKey(prev => prev + 1);
        }

        console.log(
          '✅ PaymentScreen: Suppliers and payments refreshed after profile update',
        );
      } catch (error) {
        console.error(
          '❌ PaymentScreen: Error refreshing suppliers on profile update:',
          error,
        );
      }
    };

    profileUpdateManager.onProfileUpdate(handleProfileUpdate);
    console.log('📢 PaymentScreen: Registered profile update listener');

    return () => {
      profileUpdateManager.offProfileUpdate(handleProfileUpdate);
      console.log('📢 PaymentScreen: Unregistered profile update listener');
    };
  }, [fetchSuppliersCtx]);

  // Refresh data when screen regains focus to avoid stale supplier/payment info
  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Avoid duplicating the initial load
        if (!didInitialLoadRef.current) return;

        // Don't refresh while editing
        if (showCreateForm || editingItem) {
          console.log('🔄 PaymentScreen: Skipping refresh - in edit mode');
          return;
        }

        console.log('🔄 PaymentScreen: Screen focused, refreshing data...');
        // Invalidate cache to ensure fresh data
        unifiedApi.invalidateCachePattern('.*/customers.*');
        unifiedApi.invalidateCachePattern('.*/customers/suppliers.*');
        unifiedApi.invalidateCachePattern('.*/transactions.*');

        // Reset supplier hash to force update check
        previousSuppliersRef.current = '';

        // Refresh suppliers first to get latest names
        const freshSuppliers = await fetchSuppliersCtx('');

        // ALWAYS refresh payments from server when screen comes into focus
        // This ensures we get the latest data even if supplier was updated while screen was in background
        console.log(
          '🔄 PaymentScreen: Refreshing payments from server on focus...',
        );
        try {
          const response = (await unifiedApi.getPayments(1, 20)) as {
            data: any;
            status: number;
            headers: Headers;
          };
          const data = response?.data || response || {};
          const vouchers = Array.isArray(data) ? data : data.data || [];

          // Filter and enrich payments with FRESH supplier data
          const expectedType = 'debit';
          const enrichedPayments = vouchers
            .filter((v: any) => {
              const typeMatches = String(v.type).toLowerCase() === expectedType;
              const isPaymentLike =
                !Array.isArray(v.items) ||
                (Array.isArray(v.items) && v.items.length === 0);
              return typeMatches && isPaymentLike;
            })
            .map((voucher: any) => {
              // Use FRESH supplier data to enrich payment
              let party = null;

              // Try to match by partyId first (most reliable)
              const voucherPartyId =
                voucher.partyId ||
                voucher.customer_id ||
                voucher._raw?.partyId ||
                voucher._raw?.customer_id;

              if (voucherPartyId) {
                party = freshSuppliers.find(
                  (s: any) => Number(s.id) === Number(voucherPartyId),
                );
              }

              // Enrich with fresh supplier data
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

              return {
                ...voucher,
                _lastUpdated: Date.now(),
              };
            });

          // Update state with enriched payments
          console.log(
            `✅ PaymentScreen: Setting ${enrichedPayments.length} enriched payments from server on focus`,
          );
          if (enrichedPayments.length > 0) {
            console.log('🔄 PaymentScreen: Sample enriched payment (focus):', {
              id: enrichedPayments[0]?.id,
              partyName: enrichedPayments[0]?.partyName,
              partyId: enrichedPayments[0]?.partyId,
              _lastUpdated: enrichedPayments[0]?._lastUpdated,
            });
          }

          // Force state update by creating a new array reference
          setApiPayments([...enrichedPayments]);
        } catch (fetchError) {
          console.error(
            '❌ PaymentScreen: Error refreshing payments on focus:',
            fetchError,
          );
          // Fallback to regular fetchPayments
          await fetchPayments();
        }

        console.log('✅ PaymentScreen: Data refreshed on focus');
      })();
      return () => {};
    }, [showCreateForm, editingItem]),
  );

  // Update payment entries when suppliers are updated (e.g., name changes)
  useEffect(() => {
    try {
      if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
        console.log(
          '🔄 [SUPPLIER UPDATE] No suppliers available, skipping update',
        );
        return;
      }

      // Create a hash of supplier names/phones/addresses to detect changes
      const suppliersHash = suppliers
        .map(
          (s: any) =>
            `${s.id}:${s.name || s.partyName}:${s.phoneNumber || s.phone}:${
              s.address || s.addressLine1
            }`,
        )
        .join('|');

      console.log('🔄 [SUPPLIER UPDATE] Checking supplier changes:', {
        suppliersCount: suppliers.length,
        previousHash: previousSuppliersRef.current.substring(0, 50) + '...',
        currentHash: suppliersHash.substring(0, 50) + '...',
        hasChanged: previousSuppliersRef.current !== suppliersHash,
      });

      // Skip if suppliers haven't actually changed (prevents unnecessary updates)
      if (previousSuppliersRef.current === suppliersHash) {
        console.log(
          '🔄 [SUPPLIER UPDATE] No changes detected, skipping update',
        );
        return;
      }

      console.log(
        '🔄 [SUPPLIER UPDATE] Changes detected, updating payment entries...',
      );
      previousSuppliersRef.current = suppliersHash;
      const currentSuppliersAny: any[] = suppliers as any[];

      // Update payment entries with latest supplier names
      setApiPayments(prev => {
        if (!prev || prev.length === 0) return prev;

        let hasUpdates = false;
        const updated = prev.map(payment => {
          // Find matching supplier by partyId
          const matchingSupplier = currentSuppliersAny.find(
            (s: any) =>
              s.id === payment.partyId || s.id === payment.customer_id,
          );

          if (matchingSupplier) {
            const newName =
              matchingSupplier.name || matchingSupplier.partyName || '';
            const newPhone =
              matchingSupplier.phoneNumber || matchingSupplier.phone || '';
            const newAddress =
              matchingSupplier.address || matchingSupplier.addressLine1 || '';

            // Only update if name/phone/address actually changed
            const nameChanged = newName && newName !== payment.partyName;
            const phoneChanged = newPhone && newPhone !== payment.partyPhone;
            const addressChanged =
              newAddress && newAddress !== payment.partyAddress;

            if (nameChanged || phoneChanged || addressChanged) {
              hasUpdates = true;
              console.log('🔄 [SUPPLIER UPDATE] Updating payment entry:', {
                paymentId: payment.id,
                oldName: payment.partyName,
                newName: newName,
                oldPhone: payment.partyPhone,
                newPhone: newPhone,
                oldAddress: payment.partyAddress,
                newAddress: newAddress,
              });

              return {
                ...payment,
                partyName: newName || payment.partyName,
                partyPhone: newPhone || payment.partyPhone,
                partyAddress: newAddress || payment.partyAddress,
                // Update _raw data as well for consistency
                _raw: {
                  ...(payment._raw || {}),
                  partyName: newName || payment._raw?.partyName,
                  partyPhone: newPhone || payment._raw?.partyPhone,
                  partyAddress: newAddress || payment._raw?.partyAddress,
                },
              };
            }
          }

          return payment;
        });

        // Only update state if there were actual changes
        return hasUpdates ? updated : prev;
      });
    } catch (e) {
      console.warn('Error updating payments from supplier changes:', e);
    }
  }, [suppliers]);

  // When supplier context updates, sync phone/address into the form promptly
  useEffect(() => {
    try {
      if (!selectedSupplier) return;
      const currentSuppliersAny: any[] = (suppliers as any[]) || [];
      const latest = currentSuppliersAny.find(
        (s: any) => s.id === (selectedSupplier as any)?.id,
      );
      if (!latest) {
        // If no selectedSupplier match, try resolve by typed name
        const typedName = (supplierInput || '').trim().toLowerCase();
        if (typedName) {
          const byName = currentSuppliersAny.find(
            (s: any) =>
              ((s.name || s.partyName || '') as string).trim().toLowerCase() ===
              typedName,
          );
          if (byName) {
            setSelectedSupplier(byName as any);
          }
        }
        return;
      }
      // If editing and the input still shows the old transaction partyName,
      // replace it with the latest supplier name from context so the field reflects updates
      try {
        const latestDisplayName =
          (latest as any).name || (latest as any).partyName || '';
        if (
          editingItem &&
          latestDisplayName &&
          String(supplierInput || '')
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
          setSupplierInput(latestDisplayName);
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

      // Always update phone and address when supplier data changes
      if (isValidPhoneValue(latestPhone)) {
        setSupplierPhone(normalizePhoneForUI(String(latestPhone)));
      }
      if (isValidAddressValue(latestAddress)) {
        setSupplierAddress(String(latestAddress));
      }
    } catch {}
  }, [suppliers, selectedSupplier]);

  // Immediate sync when selectedSupplier changes
  useEffect(() => {
    try {
      if (!selectedSupplier) return;
      const currentSuppliersAny: any[] = (suppliers as any[]) || [];
      const latest = currentSuppliersAny.find(
        (s: any) => s.id === (selectedSupplier as any)?.id,
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

      // Ensure the input field shows the latest supplier name during edit
      try {
        const latestDisplayName =
          (latest as any).name || (latest as any).partyName || '';
        if (
          editingItem &&
          latestDisplayName &&
          String(supplierInput || '')
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
          setSupplierInput(latestDisplayName);
        }
      } catch {}

      // Immediately update phone and address when supplier is selected
      if (isValidPhoneValue(latestPhone)) {
        setSupplierPhone(normalizePhoneForUI(String(latestPhone)));
      }
      if (isValidAddressValue(latestAddress)) {
        setSupplierAddress(String(latestAddress));
      }
    } catch {}
  }, [selectedSupplier?.id, suppliers, supplierInput]);

  // 1. Add deletePayment function
  const deletePayment = async (id: string) => {
    try {
      setLoadingSave(true);
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        setLoadingSave(false);
        return;
      }
      console.log('🗑️ [DELETE] Starting payment deletion:', id);
      const paymentId = Number(id) || parseInt(String(id), 10);

      // Optimistically remove from local state immediately (before API call)
      setApiPayments(prev => {
        const filtered = (prev || []).filter(
          p => String(p.id) !== String(id) && Number(p.id) !== paymentId,
        );
        console.log('🔄 [DELETE] Optimistic update - removed item:', {
          deletedId: id,
          remainingCount: filtered.length,
          previousCount: prev?.length || 0,
        });
        return filtered;
      });

      // Use unified API for delete
      // DELETE operations often return 204 No Content (empty response)
      const deleteResponse = (await unifiedApi.deleteTransaction(
        paymentId,
      )) as {
        data: any;
        status: number;
        headers: Headers;
      };
      console.log('✅ [DELETE] Payment deleted successfully:', {
        status: deleteResponse?.status,
        hasData: !!deleteResponse?.data,
      });

      // Clear cache and refresh from server to ensure consistency
      // Invalidate transactions cache to force fresh fetch
      unifiedApi.invalidateCachePattern('.*/transactions.*');
      // Add small delay to ensure server has processed the delete
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchPayments();

      // Close form and reset
      setShowCreateForm(false);
      setEditingItem(null);
      setLoadingSave(false);
    } catch (e: any) {
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
        e?.status === 204 ||
        e?.response?.status === 204 ||
        e?.statusCode === 204;

      if (isJsonParseError || is204Success) {
        // Empty response (204 No Content) means deletion was successful
        // Don't log as error - this is expected behavior for DELETE operations
        console.log(
          '✅ [DELETE] Payment deleted successfully (empty response treated as success)',
        );

        const paymentId = Number(id) || parseInt(String(id), 10);
        // Optimistically remove from local state
        setApiPayments(prev => {
          const filtered = (prev || []).filter(
            p => String(p.id) !== String(id) && Number(p.id) !== paymentId,
          );
          console.log(
            '🔄 [DELETE] Optimistic update (JSON parse) - removed item:',
            {
              deletedId: id,
              remainingCount: filtered.length,
              previousCount: prev?.length || 0,
            },
          );
          return filtered;
        });

        // Clear cache and refresh from server to ensure consistency
        // Invalidate transactions cache to force fresh fetch
        unifiedApi.invalidateCachePattern('.*/transactions.*');
        // Add small delay to ensure server has processed the delete
        await new Promise(resolve => setTimeout(resolve, 300));
        await fetchPayments();

        // Close form and reset
        setShowCreateForm(false);
        setEditingItem(null);
        setLoadingSave(false);
        return;
      }

      // Real error - log and show error message
      console.error('❌ [DELETE] Error deleting payment:', e);
      setLoadingSave(false);
      const errorMessage =
        e?.response?.data?.message ||
        e?.message ||
        'Failed to delete payment. Please try again.';
      setError(errorMessage);
      setShowModal(true);

      // Refresh list to restore state if delete failed
      await fetchPayments();
    }
  };

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
    setShowModal(false);
    setLoadingSave(false);
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
      // Show integer part only for amount when editing
      setAmount(
        editingItem.amount !== undefined && editingItem.amount !== null
          ? String(Math.trunc(Number(editingItem.amount) || 0))
          : '',
      );
      setPaymentMethod(editingItem.method || editingItem._raw?.method || '');
      setDescription(
        editingItem.description ||
          editingItem._raw?.description ||
          editingItem._raw?.narration ||
          '',
      );
      setReference(editingItem.reference || '');
      setCategory(
        editingItem.category ||
          editingItem._raw?.category ||
          editingItem._raw?.Category ||
          editingItem._raw?.cat ||
          '',
      );
      setPaymentNumber(editingItem.billNumber || '');
      setSupplierInput(editingItem.partyName || '');

      console.log('🔍 PaymentScreen: Setting form values for editing:', {
        editingItemPartyName: editingItem.partyName,
        editingItemPartyAddress: editingItem.partyAddress,
        editingItemPartyPhone: editingItem.partyPhone,
        rawData: editingItem._raw,
      });
      const prefillPhoneRaw =
        editingItem.partyPhone ||
        editingItem._raw?.partyPhone ||
        editingItem._raw?.phone ||
        editingItem._raw?.phoneNumber ||
        '';
      if (isValidPhoneValue(prefillPhoneRaw)) {
        setSupplierPhone(normalizePhoneForUI(prefillPhoneRaw));
      }
      const prefillAddressRaw =
        editingItem.partyAddress ||
        editingItem._raw?.partyAddress ||
        editingItem._raw?.address ||
        editingItem._raw?.addressLine1 ||
        editingItem._raw?.address_line1 ||
        editingItem._raw?.address1 ||
        '';
      if (isValidAddressValue(prefillAddressRaw)) {
        setSupplierAddress(prefillAddressRaw);
        console.log(
          '🔍 PaymentScreen: Set supplier address from editing item:',
          prefillAddressRaw,
        );
      } else {
        console.log(
          '🔍 PaymentScreen: Address not valid, not setting:',
          prefillAddressRaw,
        );
      }
      // Notes should not mirror description; only use explicit notes fields
      setNotes(editingItem.notes || editingItem._raw?.notes || '');

      // If phone/address missing or invalid (e.g., '+91'), fetch full supplier detail by id
      (async () => {
        try {
          const currentSuppliersAny: any[] = (suppliers as any[]) || [];
          const resolvedId =
            editingItem.partyId ||
            currentSuppliersAny.find(
              (s: any) =>
                (s.name || s.partyName || '').toLowerCase() ===
                (editingItem.partyName || '').toLowerCase(),
            )?.id;
          const needPhone = !isValidPhoneValue(prefillPhoneRaw);
          const needAddress = !isValidAddressValue(prefillAddressRaw);
          if ((needPhone || needAddress) && resolvedId) {
            await loadSupplierDetailAndFill(resolvedId);
          }
          // If still invalid after detail fetch, fall back to last typed values saved in voucher
          setSupplierPhone(prev =>
            isValidPhoneValue(prev)
              ? normalizePhoneForUI(prev)
              : isValidPhoneValue(
                  editingItem._raw?.partyPhone || editingItem._raw?.phone,
                )
              ? normalizePhoneForUI(
                  String(
                    editingItem._raw?.partyPhone || editingItem._raw?.phone,
                  ),
                )
              : prev,
          );
          setSupplierAddress(prev =>
            isValidAddressValue(prev)
              ? prev
              : isValidAddressValue(
                  editingItem._raw?.partyAddress ||
                    editingItem._raw?.address ||
                    editingItem._raw?.addressLine1,
                )
              ? String(
                  editingItem._raw?.partyAddress ||
                    editingItem._raw?.address ||
                    editingItem._raw?.addressLine1,
                )
              : prev,
          );
        } catch {}
      })();
      // Seed selected supplier if we can match from current supplier list
      try {
        const currentSuppliersAny: any[] = (suppliers as any[]) || [];
        const matched = currentSuppliersAny.find(
          (s: any) =>
            s.id === editingItem.partyId ||
            (s.name || s.partyName || '').toLowerCase() ===
              (editingItem.partyName || '').toLowerCase(),
        );
        if (matched) setSelectedSupplier(matched);
      } catch {}
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
      setSelectedSupplier(null);
    }
  }, [editingItem, showCreateForm]);

  const paymentMethods = [
    { name: 'Cash', icon: 'wallet', description: 'Physical cash payment' },
    {
      name: 'Bank Transfer',
      icon: 'bank',
      description: 'Direct bank transfer',
    },
    { name: 'UPI', icon: 'cellphone', description: 'UPI payment method' },
    { name: 'Cheque', icon: 'file-document', description: 'Cheque payment' },
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
  ];
  const categories = [
    { name: 'Supplier', icon: 'truck', description: 'Supplier payments' },
    { name: 'Expense', icon: 'receipt', description: 'General expenses' },
    { name: 'Salary', icon: 'account', description: 'Employee salary' },
    { name: 'Rent', icon: 'home', description: 'Rent payments' },
    { name: 'Utilities', icon: 'lightbulb', description: 'Utility bills' },
    { name: 'Maintenance', icon: 'wrench', description: 'Maintenance costs' },
    { name: 'Marketing', icon: 'bullhorn', description: 'Marketing expenses' },
    { name: 'Travel', icon: 'airplane', description: 'Travel expenses' },
    { name: 'Office Supplies', icon: 'desk', description: 'Office supplies' },
    { name: 'Other', icon: 'dots-horizontal', description: 'Other expenses' },
  ];

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
    setErrors({});
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
    const descMatch = text.match(/Description\s*[:\-]?\s*([A-Za-z0-9.-]+)/i);
    // Notes
    const notesMatch = text.match(/Notes\s*[:\-]?\s*([A-Za-z0-9.-]+)/i);
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
        setPaymentDate(formatDateLocal(dateObj));
      }
    }
    if (supplierMatch && supplierMatch[1])
      setSupplierInput(supplierMatch[1].trim());
    if (descMatch && descMatch[1]) setDescription(descMatch[1].trim());
    if (notesMatch && notesMatch[1]) setNotes(notesMatch[1].trim());
    if (paymentMethodMatch && paymentMethodMatch[1]) {
      const matchedMethod = paymentMethods.find(
        method =>
          method.name.toLowerCase() ===
          paymentMethodMatch[1].trim().toLowerCase(),
      );
      if (matchedMethod) {
        setPaymentMethod(matchedMethod.name);
      } else {
        setPaymentMethod(paymentMethodMatch[1].trim());
      }
    }
  };

  // Enhanced validation function that returns first invalid field
  const validatePayment = () => {
    const validationErrors: { field: string; message: string }[] = [];

    // Check required fields in order
    if (!paymentDate) {
      validationErrors.push({
        field: 'paymentDate',
        message: 'Date is required.',
      });
    }
    if (!supplierInput) {
      validationErrors.push({
        field: 'supplierInput',
        message: `${folderName} Supplier is required.`,
      });
    }
    if (!supplierPhone) {
      validationErrors.push({
        field: 'supplierPhone',
        message: 'Phone is required.',
      });
    }
    if (!supplierAddress) {
      validationErrors.push({
        field: 'supplierAddress',
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
    if (supplierPhone) {
      const phoneDigits = supplierPhone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 13) {
        return {
          field: 'supplierPhone',
          message: 'Phone number must be between 10-13 digits.',
        };
      }
      // Indian mobile number validation: must start with 6, 7, 8, or 9
      if (phoneDigits.length === 10) {
        const firstDigit = phoneDigits.charAt(0);
        if (!['6', '7', '8', '9'].includes(firstDigit)) {
          return {
            field: 'supplierPhone',
            message: 'Indian mobile number must start with 6, 7, 8, or 9',
          };
        }
      }
    }

    // Validate address length
    if (supplierAddress && !supplierAddress.trim()) {
      return {
        field: 'supplierAddress',
        message: 'Address is required.',
      };
    }

    return null;
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
      case 'supplierAddress':
        if (!supplierAddress) return 'Address is required';
        return '';
      default:
        return '';
    }
  };

  // API submit handler
  const handleSubmit = async (
    status: 'complete',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    const overallStartTime = Date.now();

    // Track all API call timings for final summary
    const apiTimings: Array<{
      name: string;
      duration: number;
      status: 'success' | 'failed' | 'skipped';
    }> = [];

    // Enhanced logging with console group for better visibility
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 [API TIMING] PaymentScreen - API CALL TIMING LOGS');
    console.log('📊 Watch this console for detailed API call timings!');
    console.log('⏱️  All API call durations will be shown below:');
    console.log('═══════════════════════════════════════════════════════════');
    console.group('🚀 [API] PaymentScreen - Starting Payment Creation/Update');
    console.log(
      '🔍 [TIMING] Starting payment creation/update process at',
      new Date().toISOString(),
    );
    console.log('📋 Current form state:', {
      paymentDate,
      supplierInput,
      supplierPhone,
      supplierAddress,
      amount,
      paymentMethod,
      category,
    });

    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);

    // Check transaction limits BEFORE making API call - BLOCK on error
    try {
      console.log('🔍 Checking transaction limits before payment creation...');
      await forceCheckTransactionLimit();
    } catch (limitError) {
      console.error('❌ Error checking transaction limits:', limitError);
      // Block transaction if limit check fails (security issue)
      await forceShowPopup();
      setError(
        'Transaction limit reached. Please upgrade your plan to continue.',
      );
      setTimeout(() => scrollToErrorField('api'), 100);
      return;
    }

    // Validate all required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      paymentDate,
      supplierInput,
      supplierPhone,
      supplierAddress,
      amount,
      paymentMethod,
      category,
    });

    // Use comprehensive validation function
    const validationResult = validatePayment();
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
      !paymentDate ||
      !supplierInput ||
      !supplierPhone ||
      !supplierAddress ||
      !amount ||
      !paymentMethod ||
      !category
    ) {
      const missingFields = [];
      if (!paymentDate) missingFields.push('Payment Date');
      if (!supplierInput) missingFields.push('Supplier Name');
      if (!supplierPhone) missingFields.push('Phone');
      if (!supplierAddress) missingFields.push('Address');
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

    const userIdPromise = getUserIdFromToken();
    const nextPaymentNumberPromise = generateNextDocumentNumber(
      folderName.toLowerCase(),
      true,
    ).catch(error => {
      console.error('Error generating payment number:', error);
      return null;
    });

    setLoadingSave(true);
    console.log('✅ All validation passed - proceeding with API call');
    let didRefreshSuppliers = false;
    try {
      // Check if supplier exists, if not, create
      let supplierNameToUse = supplierInput.trim();
      let existingSupplier = suppliers.find(
        s =>
          s.name?.trim().toLowerCase() === supplierNameToUse.toLowerCase() ||
          (editingItem && (s as any).id === (editingItem as any).partyId) ||
          (editingItem && (s as any).id === (editingItem as any).customer_id),
      );

      if (!existingSupplier && !editingItem) {
        console.log('🔍 PaymentScreen: Creating new supplier with data:', {
          name: supplierNameToUse,
          phoneNumber: supplierPhone,
          address: supplierAddress,
          isValidPhone: isValidPhoneValue(supplierPhone),
          isValidAddress: isValidAddressValue(supplierAddress),
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [API CALL] Creating Supplier');
        const supplierCreateStart = Date.now();
        console.log(
          '⏱️ [TIMING] Supplier creation start:',
          new Date().toISOString(),
        );
        const payloadSize = JSON.stringify({
          name: supplierNameToUse,
          partyName: supplierNameToUse,
          phoneNumber: isValidPhoneValue(supplierPhone)
            ? supplierPhone
            : undefined,
          address: isValidAddressValue(supplierAddress)
            ? supplierAddress
            : undefined,
        }).length;
        console.log(
          '📦 [PAYLOAD] Supplier creation payload size:',
          payloadSize,
          'bytes',
        );

        let newSupplier;
        try {
          newSupplier = await addSupplierCtx({
            name: supplierNameToUse,
            partyName: supplierNameToUse,
            phoneNumber: isValidPhoneValue(supplierPhone)
              ? supplierPhone
              : undefined,
            address: isValidAddressValue(supplierAddress)
              ? supplierAddress
              : undefined,
          } as any);

          const supplierCreateDuration = Date.now() - supplierCreateStart;
          apiTimings.push({
            name: 'Supplier Creation',
            duration: supplierCreateDuration,
            status: 'success',
          });
          console.log(
            `✅ [API CALL] Supplier creation completed in ${supplierCreateDuration}ms`,
          );
          if (supplierCreateDuration > 1000) {
            console.warn(
              `⚠️ [WARNING] Supplier creation took ${supplierCreateDuration}ms (slow)`,
            );
          }
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } catch (supplierError: any) {
          const supplierCreateDuration = Date.now() - supplierCreateStart;
          apiTimings.push({
            name: 'Supplier Creation',
            duration: supplierCreateDuration,
            status: 'failed',
          });
          console.error(
            `❌ [API CALL] Supplier creation failed after ${supplierCreateDuration}ms`,
          );
          console.error('❌ [ERROR] Supplier creation error:', supplierError);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          // Handle phone number specific errors
          const backendMsg =
            supplierError?.response?.data?.message ||
            supplierError?.response?.data?.error ||
            supplierError?.message ||
            '';
          const errorMsgStr = String(backendMsg).toLowerCase();

          if (
            supplierError?.response?.status === 400 ||
            supplierError?.response?.status === 500
          ) {
            if (
              errorMsgStr.includes('phone number already exists') ||
              errorMsgStr.includes('already exists') ||
              errorMsgStr.includes('duplicate')
            ) {
              setErrors(prev => ({
                ...prev,
                supplierPhone:
                  'This phone number is already used by another party.',
              }));
              setTimeout(
                () => scrollToErrorField('validation', 'supplierPhone'),
                100,
              );
              showAlert({
                title: 'Duplicate Phone Number',
                message:
                  'A party with this phone number already exists. Please use a different number.',
                type: 'error',
              });
              setLoadingSave(false);
              return;
            } else if (
              errorMsgStr.includes('invalid phone') ||
              errorMsgStr.includes('phone number format') ||
              errorMsgStr.includes('must start with 6, 7, 8, or 9') ||
              errorMsgStr.includes('expected 10 digits')
            ) {
              const phoneErrorMsg =
                backendMsg || 'Invalid phone number format.';
              setErrors(prev => ({
                ...prev,
                supplierPhone: String(phoneErrorMsg),
              }));
              setTimeout(
                () => scrollToErrorField('validation', 'supplierPhone'),
                100,
              );
              showAlert({
                title: 'Invalid Phone Number',
                message:
                  String(phoneErrorMsg) +
                  ' Please enter a valid 10-digit Indian mobile number.',
                type: 'error',
              });
              setLoadingSave(false);
              return;
            }
          }

          setError('Failed to create supplier. Please try again.');
          setTimeout(() => scrollToErrorField('api', 'supplierInput'), 100);
          return;
        }

        console.log('🔍 PaymentScreen: Created supplier result:', newSupplier);

        if (!newSupplier || !(newSupplier as any)?.id) {
          setError('Failed to create supplier. Please try again.');
          setTimeout(() => scrollToErrorField('api', 'supplierInput'), 100);
          return;
        }

        supplierNameToUse = newSupplier.name || '';
        existingSupplier = newSupplier as any;

        // Immediate UI sync: select newly created supplier and update fields
        try {
          setSelectedSupplier(existingSupplier as any);
          if (isValidPhoneValue(supplierPhone)) {
            setSupplierPhone(normalizePhoneForUI(String(supplierPhone)));
          }
          if (isValidAddressValue(supplierAddress)) {
            setSupplierAddress(String(supplierAddress));
          }
        } catch {}

        // OPTIMIZED: Supplier already created with phone/address in initial call
        // However, add a non-blocking safeguard update to ensure phone/address persist correctly
        // This handles edge cases where backend might not save address on initial creation
        if (
          (isValidPhoneValue(supplierPhone) ||
            isValidAddressValue(supplierAddress)) &&
          (newSupplier as any)?.id
        ) {
          runInBackground(
            (async () => {
              const safeguardStart = Date.now();
              try {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🚀 [API CALL] Safeguard Update for New Supplier');
                console.log(
                  '⏱️ [TIMING] Safeguard update start:',
                  new Date().toISOString(),
                );
                console.log(
                  '🔍 PaymentScreen: Safeguard update for newly created supplier:',
                  {
                    supplierId: (newSupplier as any).id,
                    hasPhone: isValidPhoneValue(supplierPhone),
                    hasAddress: isValidAddressValue(supplierAddress),
                  },
                );

                await persistSupplierDirectPatch(
                  (newSupplier as any).id,
                  undefined, // Don't update name, it's already correct
                  isValidPhoneValue(supplierPhone) ? supplierPhone : undefined,
                  isValidAddressValue(supplierAddress)
                    ? supplierAddress
                    : undefined,
                );

                const safeguardDuration = Date.now() - safeguardStart;
                apiTimings.push({
                  name: 'Supplier Safeguard Update',
                  duration: safeguardDuration,
                  status: 'success',
                });
                console.log(
                  `✅ [API CALL] Safeguard supplier update completed in ${safeguardDuration}ms`,
                );
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              } catch (safeguardError: any) {
                const safeguardDuration = Date.now() - safeguardStart;
                apiTimings.push({
                  name: 'Supplier Safeguard Update',
                  duration: safeguardDuration,
                  status: 'failed',
                });
                console.warn(
                  `⚠️ [API CALL] Safeguard supplier update failed after ${safeguardDuration}ms (non-critical)`,
                );
                console.warn(
                  '⚠️ PaymentScreen: Safeguard supplier update error:',
                  safeguardError,
                );
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                // Non-critical, don't block transaction
              }
            })(),
          );
        }
      }
      // OPTIMIZED: Single supplier update, only if changed, non-blocking
      // If user changed any of these fields from the selected supplier, push an update
      // This applies to both new payments and edits
      try {
        if (existingSupplier) {
          // Check name update - compare against both name and partyName fields
          const existingName =
            (existingSupplier as any).name?.trim() ||
            (existingSupplier as any).partyName?.trim() ||
            '';
          const needsNameUpdate =
            supplierNameToUse.trim().toLowerCase() !==
            existingName.toLowerCase();

          // Check phone update - normalize both for comparison
          const existingPhone =
            (existingSupplier as any).phoneNumber ||
            (existingSupplier as any).phone ||
            (existingSupplier as any).phone_number ||
            '';
          const normalizedExistingPhone = normalizePhoneForUI(existingPhone);
          const needsPhoneUpdate =
            isValidPhoneValue(supplierPhone) &&
            normalizePhoneForUI(supplierPhone) !== normalizedExistingPhone;

          // Check address update - compare against all possible address fields
          const existingAddress =
            (existingSupplier as any).address ||
            (existingSupplier as any).addressLine1 ||
            (existingSupplier as any).address_line1 ||
            (existingSupplier as any).address1 ||
            '';
          const needsAddressUpdate =
            isValidAddressValue(supplierAddress) &&
            supplierAddress.trim() !== existingAddress.trim();

          // Only update if something actually changed
          if (needsNameUpdate || needsPhoneUpdate || needsAddressUpdate) {
            // Run update in background to avoid blocking transaction creation
            runInBackground(
              (async () => {
                try {
                  console.log(
                    '🔍 PaymentScreen: Updating existing supplier (background):',
                    {
                      supplierId: (existingSupplier as any).id,
                      needsNameUpdate,
                      needsPhoneUpdate,
                      needsAddressUpdate,
                      currentName: supplierNameToUse,
                      existingName:
                        (existingSupplier as any).name ||
                        (existingSupplier as any).partyName,
                      currentAddress: supplierAddress,
                      existingAddress:
                        (existingSupplier as any).address ||
                        (existingSupplier as any).addressLine1,
                    },
                  );
                  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  console.log('🚀 [API CALL] Updating Existing Supplier');
                  const supplierUpdateStart = Date.now();
                  console.log(
                    '⏱️ [TIMING] Supplier update start:',
                    new Date().toISOString(),
                  );

                  try {
                    await persistSupplierDirectPatch(
                      (existingSupplier as any).id,
                      needsNameUpdate ? supplierNameToUse : undefined,
                      needsPhoneUpdate ? supplierPhone : undefined,
                      needsAddressUpdate ? supplierAddress : undefined,
                    );
                    const supplierUpdateDuration =
                      Date.now() - supplierUpdateStart;
                    apiTimings.push({
                      name: 'Supplier Update',
                      duration: supplierUpdateDuration,
                      status: 'success',
                    });
                    console.log(
                      `✅ [API CALL] Supplier update completed in ${supplierUpdateDuration}ms`,
                    );
                    if (supplierUpdateDuration > 1000) {
                      console.warn(
                        `⚠️ [WARNING] Supplier update took ${supplierUpdateDuration}ms (slow)`,
                      );
                    }
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                  } catch (updateErr: any) {
                    const supplierUpdateDuration =
                      Date.now() - supplierUpdateStart;
                    apiTimings.push({
                      name: 'Supplier Update',
                      duration: supplierUpdateDuration,
                      status: 'failed',
                    });
                    console.error(
                      `❌ [API CALL] Supplier update failed after ${supplierUpdateDuration}ms`,
                    );
                    console.error(
                      '❌ [ERROR] Supplier update error:',
                      updateErr,
                    );
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    // Log but don't throw - supplier update failure shouldn't block transaction
                  }

                  if (!didRefreshSuppliers) {
                    didRefreshSuppliers = true;
                    fetchSuppliersCtx('').catch(() => {});
                  }
                  // Immediate UI sync after update
                  try {
                    setSelectedSupplier(existingSupplier as any);
                    if (isValidPhoneValue(supplierPhone)) {
                      setSupplierPhone(
                        normalizePhoneForUI(String(supplierPhone)),
                      );
                    }
                    if (isValidAddressValue(supplierAddress)) {
                      setSupplierAddress(String(supplierAddress));
                    }
                  } catch {}
                } catch (updateError) {
                  console.error(
                    '❌ PaymentScreen: Background supplier update failed:',
                    updateError,
                  );
                }
              })(),
            );
          }
        }
      } catch {}

      // Opening balance creation temporarily disabled here to avoid extra
      // /transactions POSTs during Payment creation. If needed, we can
      // move this to a dedicated flow (e.g., AddParty) or enable behind a flag.
      const userId = await userIdPromise;
      if (!userId) {
        setError('User not authenticated. Please login again.');
        setTimeout(() => scrollToErrorField('api'), 100);
        return;
      }

      // Always regenerate document number on submit based on current backend state
      // This ensures accuracy even if other transactions were created since initialization
      let finalPaymentNumber = '';
      const generatedPaymentNumber = await nextPaymentNumberPromise;
      if (generatedPaymentNumber) {
        finalPaymentNumber = generatedPaymentNumber;
        setPaymentNumber(generatedPaymentNumber);
        console.log(
          '🔍 Generated paymentNumber on submit:',
          generatedPaymentNumber,
        );
      } else {
        // Fallback: use preview number if available, otherwise default to PAY-001
        finalPaymentNumber = paymentNumber || 'PAY-001';
      }
      // Map UI folder to backend transaction type (credit/debit)
      const transactionType = ['payment', 'purchase'].includes(
        (folderName || '').toLowerCase(),
      )
        ? 'debit'
        : 'credit';
      // Normalize status to requested values
      const statusToSend = 'Complete';

      // Resolve party/customer ids consistently
      const resolvedPartyId =
        (existingSupplier as any)?.id ||
        (selectedSupplier as any)?.id ||
        (editingItem as any)?.partyId ||
        (editingItem as any)?.customer_id;
      const resolvedCustomerId = resolvedPartyId
        ? Number(resolvedPartyId)
        : undefined;

      console.log('🔍 PaymentScreen: Resolved IDs:', {
        resolvedPartyId,
        resolvedCustomerId,
        existingSupplier: existingSupplier
          ? (existingSupplier as any).id
          : null,
        selectedSupplier: selectedSupplier
          ? (selectedSupplier as any).id
          : null,
      });

      // Ensure we have a valid customer ID before proceeding
      if (!resolvedCustomerId) {
        setError('Failed to create supplier. Please try again.');
        setTimeout(() => scrollToErrorField('api', 'supplierInput'), 100);
        return;
      }

      // OPTIMIZED: Removed redundant background supplier updates
      // Supplier updates are now handled above (lines 1946-1998) in a single, optimized path

      // API body - ensure paymentDate is preserved exactly as selected
      console.log(
        '📅 PaymentScreen: paymentDate state before API request:',
        paymentDate,
        'Type:',
        typeof paymentDate,
      );
      // Ensure paymentDate is a valid YYYY-MM-DD string, preserve as-is
      const finalPaymentDate =
        paymentDate || new Date().toISOString().split('T')[0];
      console.log(
        '📅 PaymentScreen: Final paymentDate to send in API:',
        finalPaymentDate,
      );

      try {
        const body = {
          user_id: userId,
          createdBy: userId,
          updatedBy: userId,
          type: transactionType,
          amount: Number(amount),
          date: finalPaymentDate, // keep as YYYY-MM-DD to preserve exact selected date
          transactionDate: finalPaymentDate,
          paymentDate: finalPaymentDate,
          // snake_case aliases
          transaction_date: finalPaymentDate,
          payment_date: finalPaymentDate,
          status: statusToSend,
          description: description || '',
          notes: notes || '',
          partyName: supplierInput.trim() || supplierNameToUse,
          partyId: resolvedPartyId,
          customer_id: resolvedCustomerId,
          partyPhone: supplierPhone || '',
          partyAddress: supplierAddress || '',
          method: paymentMethod,
          category: category || '',
          items: [],
          billNumber: finalPaymentNumber || '', // Include billNumber (payment number like "PAY-1336")
        };

        // Include user's primary role id for backend auditing/mapping (non-blocking with timeout)
        try {
          const roleIdPromise = (async () => {
            const { addRoleIdToBody } = await import('../../utils/roleHelper');
            return addRoleIdToBody(body);
          })();
          // Race against 200ms timeout to prevent blocking if AsyncStorage is slow
          await Promise.race([
            roleIdPromise,
            new Promise(resolve => setTimeout(resolve, 200)),
          ]);
        } catch (e) {
          console.warn('⚠️ PaymentScreen: Failed to add role ID:', e);
        }

        // Clean the body object to only include fields that exist in backend schema
        const cleanBody = {
          user_id: body.user_id,
          type: body.type,
          amount: body.amount,
          date: body.date, // Ensure exact selected date is preserved in POST
          transactionDate: body.transactionDate, // Include date mirrors for POST like PUT
          paymentDate: body.paymentDate,
          transaction_date: body.transaction_date,
          payment_date: body.payment_date,
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
          billNumber: body.billNumber, // Include billNumber for backend
          createdBy: body.createdBy,
          updatedBy: body.updatedBy,
        };
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) {
          setError('Authentication token not found. Please login again.');
          setTimeout(() => scrollToErrorField('api'), 100);
          return;
        }
        let res;
        // Declare variables outside if/else block for use in state update
        let updateResponse: any = null;
        let finalPaymentNumberForUpdate = '';
        if (editingItem) {
          // PUT update (backend supports PUT). Send all relevant fields to ensure updates persist.
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🚀 [API CALL] Updating Payment Transaction');
          const updateStart = Date.now();
          console.log(
            '⏱️ [TIMING] Payment update start:',
            new Date().toISOString(),
          );
          const updatePayloadSize = JSON.stringify({
            user_id: body.user_id,
            type: transactionType,
            date: paymentDate,
            amount: Number(body.amount),
            status: statusToSend,
            partyName: body.partyName,
            partyId: body.partyId,
            customer_id: body.customer_id,
            partyPhone: body.partyPhone,
            partyAddress: body.partyAddress,
          }).length;
          console.log(
            '📦 [PAYLOAD] Payment update payload size:',
            updatePayloadSize,
            'bytes',
          );
          console.log(
            '📅 PaymentScreen: Using paymentDate in PUT request:',
            paymentDate,
          );
          const putBody: any = {
            user_id: body.user_id,
            type: transactionType,
            date: paymentDate, // ensure exact selected date is persisted
            amount: Number(body.amount),
            status: statusToSend,
            // CRITICAL: Always include partyName and partyAddress from current form values
            partyName:
              supplierInput.trim() || supplierNameToUse || body.partyName || '',
            partyId: body.partyId,
            customer_id: body.customer_id,
            partyPhone: supplierPhone || body.partyPhone || '',
            partyAddress: supplierAddress || body.partyAddress || '',
            // include date mirrors
            transactionDate: paymentDate,
            paymentDate: paymentDate,
            transaction_date: paymentDate,
            payment_date: paymentDate,
          };

          console.log(
            '🔍 PaymentScreen PUT request data (unconditional fields):',
            {
              editingItemId: editingItem.id,
              formValues: {
                supplierInput: supplierInput,
                supplierAddress: supplierAddress,
                supplierPhone: supplierPhone,
                amount: amount,
                paymentMethod: paymentMethod,
                category: category,
                description: description,
                notes: notes,
              },
              bodyValues: {
                partyName: body.partyName,
                partyAddress: body.partyAddress,
                partyPhone: body.partyPhone,
              },
              putBody: {
                ...putBody,
                partyName: putBody.partyName,
                partyAddress: putBody.partyAddress,
                partyPhone: putBody.partyPhone,
              },
              originalEditingItem: {
                partyName: editingItem.partyName,
                partyAddress: editingItem.partyAddress,
                partyPhone: editingItem.partyPhone,
              },
            },
          );
          console.log(
            '✅ [PUT] Sending update with partyName:',
            putBody.partyName,
            'partyAddress:',
            putBody.partyAddress,
          );
          // Always include these optional fields too so edits persist consistently
          putBody.method = cleanBody.method;
          putBody.category = cleanBody.category;
          putBody.description = cleanBody.description;
          putBody.notes = cleanBody.notes;
          // Ensure paymentNumber is set for updates too
          finalPaymentNumberForUpdate =
            paymentNumber || editingItem.billNumber || '';
          if (
            !finalPaymentNumberForUpdate ||
            finalPaymentNumberForUpdate.trim() === ''
          ) {
            try {
              const nextNumber = await generateNextDocumentNumber(
                folderName.toLowerCase(),
              );
              finalPaymentNumberForUpdate = nextNumber;
              setPaymentNumber(nextNumber);
            } catch (error) {
              console.error(
                'Error generating payment number for update:',
                error,
              );
              // Fallback: use existing billNumber or generate new one
              finalPaymentNumberForUpdate = editingItem.billNumber || 'PAY-001';
            }
          }
          putBody.billNumber = finalPaymentNumberForUpdate; // Include billNumber for updates
          // Use unified API for update
          try {
            const response = (await unifiedApi.updateTransaction(
              editingItem.id,
              putBody,
            )) as {
              data: any;
              status: number;
              headers: Headers;
            };
            updateResponse = response?.data || response;
            const updateDuration = Date.now() - updateStart;
            apiTimings.push({
              name: 'Payment Update',
              duration: updateDuration,
              status: 'success',
            });
            console.log(
              `✅ [API CALL] Payment update completed in ${updateDuration}ms`,
            );
            console.log('📦 [RESPONSE] Update response:', updateResponse);
            if (updateDuration > 2000) {
              console.warn(
                `⚠️ [WARNING] Payment update took ${updateDuration}ms (slow)`,
              );
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          } catch (updateError: any) {
            const updateDuration = Date.now() - updateStart;
            apiTimings.push({
              name: 'Payment Update',
              duration: updateDuration,
              status: 'failed',
            });
            console.error(
              `❌ [API CALL] Payment update failed after ${updateDuration}ms`,
            );
            console.error('❌ [ERROR] Payment update error:', updateError);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            throw updateError;
          }
        } else {
          // POST create: send full body with all date fields
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🚀 [API CALL] Creating Payment Transaction');
          const createStart = Date.now();
          console.log(
            '⏱️ [TIMING] Payment creation start:',
            new Date().toISOString(),
          );
          const createPayloadSize = JSON.stringify(cleanBody).length;
          console.log(
            '📦 [PAYLOAD] Payment creation payload size:',
            createPayloadSize,
            'bytes',
          );
          console.log(
            '📅 PaymentScreen: POST request date field value:',
            cleanBody.date,
            'transactionDate:',
            cleanBody.transactionDate,
            'paymentDate:',
            cleanBody.paymentDate,
          );
          // Use unified API for create
          try {
            const newVoucher = (await unifiedApi.createTransaction(
              cleanBody,
            )) as {
              data: any;
              status: number;
              headers: Headers;
            };
            const createDuration = Date.now() - createStart;
            apiTimings.push({
              name: 'Payment Creation',
              duration: createDuration,
              status: 'success',
            });
            console.log(
              `✅ [API CALL] Payment creation completed in ${createDuration}ms`,
            );
            if (createDuration > 2000) {
              console.warn(
                `⚠️ [WARNING] Payment creation took ${createDuration}ms (slow)`,
              );
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            appendVoucher(newVoucher?.data || newVoucher);
          } catch (createError: any) {
            const createDuration = Date.now() - createStart;
            apiTimings.push({
              name: 'Payment Creation',
              duration: createDuration,
              status: 'failed',
            });
            console.error(
              `❌ [API CALL] Payment creation failed after ${createDuration}ms`,
            );
            console.error('❌ [ERROR] Payment creation error:', createError);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            throw createError;
          }
        }

        // Update local state with server response for immediate UI update
        try {
          if (editingItem) {
            // Use server response if available, otherwise use form data
            const serverData = updateResponse?.data || updateResponse || {};
            const updatedFields = {
              partyName:
                serverData.partyName ||
                cleanBody.partyName ||
                supplierInput.trim() ||
                '',
              partyAddress:
                serverData.partyAddress ||
                cleanBody.partyAddress ||
                supplierAddress ||
                '',
              partyPhone:
                serverData.partyPhone ||
                cleanBody.partyPhone ||
                supplierPhone ||
                '',
              method:
                serverData.method || cleanBody.method || paymentMethod || '',
              category:
                serverData.category || cleanBody.category || category || '',
              description:
                serverData.description ||
                cleanBody.description ||
                description ||
                '',
              notes: serverData.notes || cleanBody.notes || notes || '',
              amount:
                Number(serverData.amount) ||
                Number(cleanBody.amount || body.amount) ||
                0,
              date:
                serverData.date || serverData.paymentDate || body.date || '',
              status: serverData.status || statusToSend || 'Complete',
              partyId:
                serverData.partyId ||
                serverData.customer_id ||
                cleanBody.partyId ||
                body.partyId ||
                null,
              customer_id:
                serverData.customer_id ||
                serverData.partyId ||
                cleanBody.customer_id ||
                body.customer_id ||
                null,
              billNumber:
                serverData.billNumber ||
                (editingItem ? finalPaymentNumberForUpdate : '') ||
                paymentNumber ||
                '',
            } as any;

            console.log('🔄 Updating local state with:', {
              serverData: serverData,
              updatedFields: updatedFields,
              formData: {
                supplierInput,
                supplierAddress,
                supplierPhone,
              },
            });

            // Update local state immediately
            setApiPayments(prev =>
              (prev || []).map(p => {
                if (String(p.id) === String(editingItem.id)) {
                  return {
                    ...p,
                    ...updatedFields,
                    // Ensure partyName and partyAddress are always updated
                    partyName: updatedFields.partyName || p.partyName || '',
                    partyAddress:
                      updatedFields.partyAddress || p.partyAddress || '',
                    partyPhone: updatedFields.partyPhone || p.partyPhone || '',
                    _raw: {
                      ...(p._raw || {}),
                      ...serverData,
                      ...updatedFields,
                    },
                  };
                }
                return p;
              }),
            );
          }
        } catch (updateStateError) {
          console.error('❌ Error updating local state:', updateStateError);
        }

        // Refresh from server to ensure consistency (non-blocking for updates, blocking for creates)
        if (editingItem) {
          // For updates, refresh in background to get latest server state
          runInBackground(fetchPayments());
        } else {
          // For new payments, refresh from server (non-blocking)
          runInBackground(fetchPayments());
        }

        // Performance summary
        const overallDuration = Date.now() - overallStartTime;
        console.log(
          '═══════════════════════════════════════════════════════════',
        );
        console.log('⏱️ [TIMING] PaymentScreen - PERFORMANCE SUMMARY');
        console.log(`⏱️ [TIMING] Total duration: ${overallDuration}ms`);
        if (overallDuration > 3000) {
          console.warn(
            `⚠️ [WARNING] Total operation took ${overallDuration}ms (slow)`,
          );
        }
        console.table(apiTimings);
        console.log(
          '═══════════════════════════════════════════════════════════',
        );
        console.groupEnd();

        setEditingItem(null);
        setShowCreateForm(false);
        resetForm();
      } catch (apiError: any) {
        const overallDuration = Date.now() - overallStartTime;
        console.error(
          '⏱️ [TIMING] handleSubmit FAILED after',
          overallDuration,
          'ms',
        );
        console.error('❌ [ERROR] Error handling payment:', apiError);
        console.groupEnd();
        // Re-throw to outer catch
        throw apiError;
      }
    } catch (e: any) {
      const overallDuration = Date.now() - overallStartTime;
      console.error(
        '⏱️ [TIMING] handleSubmit FAILED after',
        overallDuration,
        'ms',
      );
      console.error('❌ [ERROR] Error handling payment:', e);
      console.groupEnd();
      // Import error handler
      const { handleApiError } = require('../../utils/apiErrorHandler');
      const errorInfo = handleApiError(e);

      // Check if it's a transaction limit error
      const errorMessage = e?.message || String(e) || 'Unknown error occurred';
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
        setTimeout(() => scrollToErrorField('api'), 100);
        return;
      }

      // Handle phone number specific errors (duplicate, invalid format, etc.)
      try {
        const backendMsg =
          errorInfo.message ||
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          '';
        const errorMsgStr = String(backendMsg).toLowerCase();

        console.log('🔍 [ERROR DEBUG] Checking phone errors:', {
          status: e?.response?.status,
          backendMsg,
          errorMsg: e?.message,
          responseData: e?.response?.data,
        });

        // Check for duplicate phone number (400 or 500 status)
        if (
          (e?.response?.status === 400 || e?.response?.status === 500) &&
          backendMsg &&
          (errorMsgStr.includes('phone number already exists') ||
            errorMsgStr.includes('already exists') ||
            errorMsgStr.includes('duplicate'))
        ) {
          setErrors(prev => ({
            ...prev,
            supplierPhone:
              'This phone number is already used by another party.',
          }));
          setTimeout(
            () => scrollToErrorField('validation', 'supplierPhone'),
            100,
          );
          showAlert({
            title: 'Duplicate Phone Number',
            message:
              'A party with this phone number already exists. Please use a different number.',
            type: 'error',
          });
          setLoadingSave(false);
          return;
        }

        // Check for invalid phone number format errors (400 or 500 status - sanitization errors can be 500)
        if (
          (e?.response?.status === 400 || e?.response?.status === 500) &&
          backendMsg &&
          (errorMsgStr.includes('invalid phone') ||
            errorMsgStr.includes('phone must be') ||
            errorMsgStr.includes('phone number format') ||
            errorMsgStr.includes('must start with 6, 7, 8, or 9') ||
            errorMsgStr.includes('expected 10 digits') ||
            errorMsgStr.includes('indian mobile number'))
        ) {
          // Extract specific error message or use default
          let phoneErrorMsg = 'Invalid phone number format.';
          if (backendMsg) {
            phoneErrorMsg = String(backendMsg);
          }

          setErrors(prev => ({
            ...prev,
            supplierPhone: phoneErrorMsg,
          }));
          setTimeout(
            () => scrollToErrorField('validation', 'supplierPhone'),
            100,
          );
          showAlert({
            title: 'Invalid Phone Number',
            message:
              phoneErrorMsg +
              ' Please enter a valid 10-digit Indian mobile number.',
            type: 'error',
          });
          setLoadingSave(false);
          return;
        }
      } catch (phoneError) {
        console.warn('Error parsing phone number error:', phoneError);
      }

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        showAlert({
          title: 'Access Denied',
          message: errorInfo.message,
          type: 'error',
        });
        setError(errorInfo.message);
        setTimeout(() => scrollToErrorField('api'), 100);
        return;
      }

      setError(errorInfo.message || 'An error occurred.');
      setShowModal(true);
      setTimeout(() => scrollToErrorField('api'), 100);
    } finally {
      setLoadingSave(false);
    }
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
  const filteredPayments = useMemo(
    () =>
      apiPayments.filter(pay => {
        // First, hide subscription/plan upgrade payments from this screen
        const rawCategory = (
          (pay as any).category ||
          (pay as any).Category ||
          (pay as any).cat ||
          ''
        ).toString();
        const category = rawCategory.toLowerCase();

        const rawInvoiceNumber =
          (pay as any).invoiceNumber ||
          (pay as any).billNumber ||
          (pay as any).paymentNumber ||
          '';
        const invoiceNumber = rawInvoiceNumber.toString().toUpperCase();

        const hasPlanId = !!(
          (pay as any).plan_id ||
          (pay as any).planId ||
          (pay as any).targetPlanId
        );

        const descriptionText = ((pay as any).description || '')
          .toString()
          .toLowerCase();

        const isSubscriptionPayment =
          category === 'subscription' ||
          invoiceNumber.startsWith('SUB-') ||
          hasPlanId ||
          descriptionText.includes('subscription payment');

        if (isSubscriptionPayment) {
          return false;
        }

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
          !searchFilter.paymentMethod ||
          pay.method === searchFilter.paymentMethod;
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
          fuzzyMatch(
            pay.description || pay.notes || '',
            searchFilter.description,
          );

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
      }),
    [apiPayments, searchFilter],
  );

  const orderedPayments = useMemo(
    () => [...filteredPayments].reverse(),
    [filteredPayments],
  );

  const paginatedPayments = useMemo(
    () => orderedPayments.slice(0, visiblePaymentCount),
    [orderedPayments, visiblePaymentCount],
  );

  const hasMorePayments = visiblePaymentCount < orderedPayments.length;

  useEffect(() => {
    setVisiblePaymentCount(PAYMENT_LIST_PAGE_SIZE);
  }, [filteredPayments]);

  // Map API status to badge color and label
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return '#28a745'; // Paid
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
    setErrors({});
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
        type: rawData.type || 'debit',
        amount: Number(rawData.amount || item.amount || 0),
        date:
          rawData.date ||
          rawData.paymentDate ||
          rawData.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transactionDate:
          rawData.transactionDate ||
          rawData.date ||
          rawData.paymentDate ||
          item.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        paymentDate:
          rawData.paymentDate ||
          rawData.date ||
          rawData.transactionDate ||
          item.paymentDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transaction_date:
          rawData.transaction_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        payment_date:
          rawData.payment_date ||
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
        category:
          rawData.category ||
          rawData.Category ||
          rawData.cat ||
          item.category ||
          '',
        items: rawData.items || item.items || [],
        billNumber:
          rawData.billNumber || item.billNumber || item.paymentNumber || '', // Include billNumber for sync
        syncYN: 'Y', // Set sync flag
      };

      // Use unified API for sync
      await unifiedApi.updateTransaction(item.id, putBody);
      await fetchPayments();
      console.log('✅ Payment synced successfully');
    } catch (e: any) {
      console.error('❌ Sync error:', e.message);
      // Optionally show error to user
      setError(e.message || 'Failed to sync payment.');
      setTimeout(() => scrollToErrorField('api'), 100);
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
          setInvoiceNumber: setPaymentNumber,
          setSelectedCustomer: setSupplierInput,
          setGstPct: () => {}, // Payments don't have GST
          setInvoiceDate: setPaymentDate,
          setNotes: setNotes,
          setItems: () => {}, // Payments don't have items
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

  // Ensure renderPaymentItem is defined before FlatList usage
  // IMPORTANT: Include apiPayments in dependencies so it re-renders when data updates
  const renderPaymentItem = useCallback(
    ({ item }: { item: any }) => (
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
          <Text
            style={styles.customerName}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.partyName || 'Unknown Supplier'}
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
    ),
    [apiPayments], // Include apiPayments so component re-renders when data changes
  );

  const handleLoadMorePayments = () => {
    if (!hasMorePayments || isPaymentPaginating) {
      return;
    }
    setIsPaymentPaginating(true);
    setTimeout(() => {
      setVisiblePaymentCount(prev =>
        Math.min(prev + PAYMENT_LIST_PAGE_SIZE, orderedPayments.length),
      );
      setIsPaymentPaginating(false);
    }, 200);
  };

  const renderPaymentListFooter = () => {
    if (!isPaymentPaginating) {
      return null;
    }
    return (
      <View style={styles.listFooterLoader}>
        <ActivityIndicator size="small" color="#4f8cff" />
      </View>
    );
  };

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
          {/* Payment Details Card */}
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
                    ref={paymentDateRef}
                    style={[
                      styles.input,
                      isFieldInvalid(paymentDate) && { borderColor: 'red' },

                      focusedField === 'paymentDate' && styles.inputFocused,
                    ]}
                    value={paymentDate}
                    editable={false}
                    pointerEvents="none"
                    onFocus={() => {
                      setFocusedField('paymentDate');
                      if (scrollRef.current && paymentDateRef.current) {
                        scrollRef.current.scrollToFocusedInput(
                          paymentDateRef.current,
                          120,
                        );
                      }
                    }}
                    onBlur={() => setFocusedField(null)}
                  />
                </TouchableOpacity>
                {triedSubmit && !paymentDate && (
                  <Text style={styles.errorTextField}>Date is required.</Text>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={parseDateLocal(paymentDate)}
                    mode="date"
                    display="default"
                    onChange={(event: unknown, date?: Date | undefined) => {
                      setShowDatePicker(false);
                      if (date) {
                        // Format date using local methods to preserve exact selected date (no timezone conversion)
                        const formattedDate = formatDateLocal(date);
                        setPaymentDate(formattedDate);
                        console.log('📅 Selected payment date:', formattedDate);
                        console.log(
                          '📅 DateTimePicker onChange - date object:',
                          date,
                        );
                        console.log(
                          '📅 DateTimePicker onChange - formatted:',
                          formattedDate,
                        );
                      }
                    }}
                  />
                )}
              </View>
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>
                {folderName} Supplier
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
                ref={supplierInputRef}
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
                <SupplierSelector
                  value={supplierInput}
                  onChange={(name, supplierObj) => {
                    // Always update the supplier input field
                    setSupplierInput(name);

                    // If a supplier object is provided (from dropdown selection), populate all fields
                    if (supplierObj) {
                      // Update all supplier-related fields immediately
                      const phoneValue =
                        (supplierObj as any).phoneNumber ||
                        (supplierObj as any).phone ||
                        (supplierObj as any).phone_number ||
                        '';
                      const addressValue =
                        (supplierObj as any).address ||
                        (supplierObj as any).addressLine1 ||
                        (supplierObj as any).address_line1 ||
                        (supplierObj as any).address1 ||
                        '';

                      setSupplierPhone(normalizePhoneForUI(phoneValue));
                      setSupplierAddress(addressValue);
                      setSelectedSupplier(supplierObj as any);
                    } else {
                      // If user is typing (no supplier object), clear selection and allow editing
                      if (
                        selectedSupplier &&
                        name.trim().toLowerCase() !==
                          (
                            selectedSupplier.name ||
                            selectedSupplier.partyName ||
                            ''
                          )
                            .trim()
                            .toLowerCase()
                      ) {
                        setSelectedSupplier(null);
                        // Only clear phone/address when creating new payment, not when editing
                        if (!editingItem) {
                          setSupplierPhone('');
                          setSupplierAddress('');
                        }
                        // During editing, preserve existing values when user types
                      }
                    }
                  }}
                  placeholder={`Search Supplier`}
                  scrollRef={scrollRef}
                  onSupplierSelect={async supplier => {
                    // This callback is called after onChange, so we don't need to duplicate the logic
                    // Just ensure the selected supplier is properly set
                    const selectedName =
                      supplier.name || supplier.partyName || '';

                    // Double-check that all fields are set correctly
                    setSupplierInput(selectedName);
                    setSupplierPhone(
                      normalizePhoneForUI(
                        (supplier as any).phoneNumber ||
                          (supplier as any).phone ||
                          (supplier as any).phone_number ||
                          '',
                      ),
                    );
                    setSupplierAddress(
                      (supplier as any).address ||
                        (supplier as any).addressLine1 ||
                        (supplier as any).address_line1 ||
                        (supplier as any).address1 ||
                        '',
                    );
                    setSelectedSupplier(supplier as any);
                    // If phone/address missing on selection, fetch full detail
                    if (
                      !(
                        (supplier as any).phoneNumber || (supplier as any).phone
                      ) ||
                      !(
                        (supplier as any).address ||
                        (supplier as any).addressLine1 ||
                        (supplier as any).address_line1 ||
                        (supplier as any).address1
                      )
                    ) {
                      await loadSupplierDetailAndFill((supplier as any).id);
                    }
                  }}
                />
              </View>
              {isFieldInvalid(supplierInput) && (
                <Text style={styles.errorTextField}>Supplier is required.</Text>
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
                ref={supplierPhoneRef}
                style={[
                  styles.input,
                  { color: '#333333' },
                  isFieldInvalid(supplierPhone, 'phone') && {
                    borderColor: 'red',
                  },
                  focusedField === 'supplierPhone' && styles.inputFocused,
                  editingItem && {
                    backgroundColor: '#f5f5f5',
                    color: '#666666',
                  },
                ]}
                value={supplierPhone}
                onChangeText={editingItem ? undefined : setSupplierPhone}
                placeholder="9876543210"
                placeholderTextColor="#666666"
                keyboardType="phone-pad"
                maxLength={10}
                editable={!editingItem}
                pointerEvents={editingItem ? 'none' : 'auto'}
                onFocus={() => {
                  if (!editingItem) {
                    setFocusedField('supplierPhone');
                    if (scrollRef.current && supplierPhoneRef.current) {
                      scrollRef.current.scrollToFocusedInput(
                        supplierPhoneRef.current,
                        120,
                      );
                    }
                  }
                }}
                onBlur={() => setFocusedField(null)}
              />
              {getFieldError('supplierPhone') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('supplierPhone')}
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
                ref={supplierAddressRef}
                style={[
                  styles.input,
                  { minHeight: 80, textAlignVertical: 'top', color: '#333333' },
                  isFieldInvalid(supplierAddress, 'address') && {
                    borderColor: 'red',
                  },
                  focusedField === 'supplierAddress' && styles.inputFocused,
                ]}
                value={supplierAddress}
                onChangeText={setSupplierAddress}
                placeholder="Supplier address"
                placeholderTextColor="#666666"
                multiline
                editable={true}
                pointerEvents="auto"
                onFocus={() => {
                  setFocusedField('supplierAddress');
                  if (scrollRef.current && supplierAddressRef.current) {
                    scrollRef.current.scrollToFocusedInput(
                      supplierAddressRef.current,
                      120,
                    );
                  }
                }}
                onBlur={() => setFocusedField(null)}
              />
              {getFieldError('supplierAddress') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('supplierAddress')}
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
                  isFieldInvalid(amount) && { borderColor: 'red' },
                  focusedField === 'amount' && styles.inputFocused,
                ]}
                value={amount}
                onChangeText={handleAmountChange}
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
              {triedSubmit && !amount && (
                <Text style={styles.errorTextField}>Amount is required.</Text>
              )}
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
                <Text style={styles.errorTextField}>Category is required.</Text>
              )}
            </View>
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={`Payment description`}
                placeholderTextColor="#666666"
              />
            </View>
            <View style={[styles.fieldWrapper, { marginBottom: scale(40) }]}>
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
                placeholderTextColor="#666666"
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

          {success && (
            <Text
              style={{
                color: 'green',
                textAlign: 'center',
                marginTop: 8,
                fontFamily: 'Roboto-Medium',
              }}
            >
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
                    fontSize: 24, // 22 + 2,
                    color: '#333333', // Modal title - black for better readability
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Choose File Type
                </Text>
                <Text
                  style={{
                    fontSize: 16, // 14 + 2
                    color: '#333', // Modal description - darker for better readability
                    textAlign: 'center',
                    lineHeight: 22, // 20 + 2
                    marginTop: 8,
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
                          fontSize: 18, // 16 + 2,
                          color: '#333333', // File type titles - black for better readability
                          marginBottom: 4,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Image
                      </Text>
                      <Text
                        style={{
                          fontSize: 16, // 14 + 2
                          color: '#333', // File type descriptions - darker for better readability
                          lineHeight: 22, // 20 + 2
                          fontFamily: 'Roboto-Medium',
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
                          fontSize: 18, // 16 + 2,
                          color: '#333333', // File type titles - black for better readability
                          marginBottom: 4,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        PDF Document
                      </Text>
                      <Text
                        style={{
                          fontSize: 16, // 14 + 2
                          color: '#333', // File type descriptions - darker for better readability
                          lineHeight: 22, // 20 + 2
                          fontFamily: 'Roboto-Medium',
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
                      fontSize: 18, // 16 + 2,
                      color: '#333333', // Example title - black for better readability
                      marginBottom: 12,
                      fontFamily: 'Roboto-Medium',
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
                        fontSize: 16, // 14 + 2,
                        color: '#333333', // Payment title - black for better readability
                        marginBottom: 8,
                        textAlign: 'center',
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Payment
                    </Text>
                    <View style={{ marginBottom: 8 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#333',
                          lineHeight: 18,
                          fontFamily: 'Roboto-Medium',
                        }} // Example text - darker for better readability
                      >
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Payment Number:
                        </Text>
                        <Text> PAY-76575{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Payment Date:
                        </Text>
                        <Text> 2025-07-15{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Supplier Name:
                        </Text>
                        <Text> Rajesh Singh{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Phone:
                        </Text>
                        <Text> 917865434576{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Address:
                        </Text>
                        <Text> 404 Jack Palace, Switzerland{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Amount:
                        </Text>
                        <Text> 800{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Payment Method:
                        </Text>
                        <Text> Cash{'\n'}</Text>
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Category:
                        </Text>
                        <Text> Sales</Text>
                      </Text>
                    </View>
                    {/* Description */}
                    <View style={{ marginBottom: 8 }}>
                      <Text
                        style={{
                          fontSize: 14, // 12 + 2,
                          color: '#333333',
                          marginBottom: 4,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Description
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          color: '#333',
                          lineHeight: 16,
                          fontFamily: 'Roboto-Medium',
                        }} // Example text - darker for better readability
                      >
                        That invoice is for basic thing that i sold
                      </Text>
                    </View>
                    {/* Notes */}
                    <View>
                      <Text
                        style={{
                          fontSize: 13,
                          color: '#333',
                          lineHeight: 16,
                          fontFamily: 'Roboto-Medium',
                        }} // Example text - darker for better readability
                      >
                        <Text
                          style={{
                            fontFamily: 'Roboto-Medium',
                          }}
                        >
                          Notes:
                        </Text>
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
                        fontSize: 14, // 12 + 2
                        color: '#856404',
                        marginLeft: 6,
                        flex: 1,
                        lineHeight: 20, // 18 + 2 // 16 + 2
                        fontFamily: 'Roboto-Medium',
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
                      fontSize: 18, // 16 + 2,
                      color: '#333', // Cancel button text - darker for better readability
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </KeyboardAwareScrollView>

        {/* Fixed Action Buttons at Bottom - matched to AddNewEntryScreen bottom buttons UI */}
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
                onPress={() => deletePayment(editingItem.id)}
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
                    Choose the payment category
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
                      <Text
                        style={{
                          fontSize: 14,
                          color: '#6b7280',
                          fontFamily: 'Roboto-Regular',
                        }}
                      >
                        {cat.description}
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
                        color: '#d32f2f', // Error title - darker red for better visibility,
                        fontSize: 18, // 16 + 2
                        marginBottom: 8,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Error
                    </Text>
                    <Text
                      style={{
                        color: '#333333', // Error message - black for better readability
                        fontSize: 18, // 16 + 2
                        marginBottom: 20,
                        textAlign: 'center',
                        fontFamily: 'Roboto-Medium',
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

      {/* Filter Bottom Sheet */}
      {/* In the Filter Bottom Sheet, update to control all advanced filter parameters */}
      {filterVisible && (
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
            onPress={() => setFilterVisible(false)}
          />
          <KeyboardAwareScrollView
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: scale(18),
              borderTopRightRadius: scale(18),
              height: '90%',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
            contentContainerStyle={{ padding: scale(20), flexGrow: 1 }}
            enableOnAndroid
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                position: 'absolute',
                left: scale(16),
                top: scale(16),
                zIndex: 10,
                padding: scale(8),
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: scale(20),
              }}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#333333"
              />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 18,
                marginBottom: scale(16),
                marginLeft: 0,
                textAlign: 'center',
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Filter Payments
            </Text>
            {/* Amount Range */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Amount Range
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: scale(16) }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
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
                  padding: scale(10),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
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
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                }}
                onPress={() => setShowDatePickerFrom(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateFrom ? '#333333' : '#666666',
                    fontSize: 14,
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
                  padding: scale(10),
                }}
                onPress={() => setShowDatePickerTo(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateTo ? '#333333' : '#666666',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
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
                  searchFilter.dateTo
                    ? new Date(searchFilter.dateTo)
                    : new Date()
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
                fontSize: 14,
                color: '#333333',
                marginBottom: scale(12),
                marginTop: scale(8),
                fontFamily: 'Roboto-Medium',
              }}
            >
              Payment Method
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: scale(20),
                gap: scale(10),
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
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scale(68),
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
                      fontSize: 13,
                      fontWeight:
                        searchFilter.paymentMethod === method ? '600' : '500',
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
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
                fontSize: 14,
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
                gap: scale(12),
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
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() =>
                    setSearchFilter(f => ({
                      ...f,
                      status: status || undefined,
                    }))
                  }
                >
                  <Text
                    style={{
                      color:
                        (status === '' && !searchFilter.status) ||
                        searchFilter.status === status
                          ? '#1f2937'
                          : '#6b7280',
                      fontSize: 13,
                      fontWeight:
                        (status === '' && !searchFilter.status) ||
                        searchFilter.status === status
                          ? '600'
                          : '500',
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
                fontSize: 14,
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
                gap: scale(10),
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
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scale(68),
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
                      fontSize: 13,
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
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
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
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
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
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
                justifyContent: 'center',
                marginBottom: scale(20),
                marginTop: scale(12),
                gap: scale(16),
              }}
            >
              <TouchableOpacity
                onPress={() => setSearchFilter({ searchText: '' })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#f8f9fa',
                  borderWidth: 1.5,
                  borderColor: '#dc3545',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
                }}
              >
                <Text
                  style={{
                    color: '#dc3545',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#4f8cff',
                  borderWidth: 1.5,
                  borderColor: '#4f8cff',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      )}
      {/* Payment List */}
      <View style={styles.listContainer}>
        {loadingApi ? (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 40 }}
          />
        ) : apiError ? (
          <Text
            style={{
              color: '#d32f2f',
              textAlign: 'center',
              marginTop: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {' '}
            {/* Error text - darker red */}
            {apiError}
          </Text>
        ) : filteredPayments.length === 0 ? (
          <Text
            style={{
              color: '#555', // No data message - darker for better readability
              textAlign: 'center',
              marginTop: scale(40),
              fontSize: scale(18),
              fontFamily: 'Roboto-Medium',
            }}
          >
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        ) : (
          <FlatList
            key={`payment-list-${refreshKey}`}
            data={paginatedPayments}
            renderItem={renderPaymentItem}
            keyExtractor={item =>
              `payment-${item.id}-${refreshKey}-${item._lastUpdated || 0}`
            }
            extraData={`${refreshKey}-${apiPayments.length}-${
              apiPayments[0]?._lastUpdated || 0
            }`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            onEndReached={handleLoadMorePayments}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderPaymentListFooter}
          />
        )}
      </View>
      {/* Add Payment Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => {
          setShowModal(false);
          setLoadingSave(false);
          setShowCreateForm(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// Global scale helper for UI scaling rule - increase all dimensions by 2 units
const SCALE = 0.75; // Base scale to match reference screens
const scale = (value: number) => Math.round(value * SCALE);

const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {
  container: {
    flex: 1,
    padding: scale(16),
    paddingBottom: scale(120), // Adequate space for fixed buttons
  },
  card: {
    // backgroundColor: '#fff',
    // borderRadius: 12,
    // padding: 16,
    // marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(16),
    // marginBottom: scale(44),
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
    fontSize: scale(14), // Match input field size
    color: '#333333', // Dropdown text - black for better readability
    fontFamily: 'Roboto-Medium',
  },

  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(36),
    paddingHorizontal: scale(30),
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
  // Bottom buttons UI (matched to AddNewEntryScreen)
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
  },
  modalTitle: {
    fontSize: scale(18),
    color: '#28a745', // Keep success color for modal titles
    marginBottom: scale(8),

    fontFamily: 'Roboto-Medium',
  },

  modalMessage: {
    fontSize: scale(14),
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
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
  },

  errorTextField: {
    color: '#d32f2f', // Error text - darker red for better visibility
    fontSize: scale(14), // 12 + 2
    marginTop: scale(4),

    fontFamily: 'Roboto-Medium',
  },

  fieldWrapper: {
    marginBottom: scale(8),
    width: '100%',
  },
});

export default PaymentScreen;
