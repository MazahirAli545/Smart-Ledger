import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
  Linking,
  Keyboard,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { uiColors, uiFonts } from '../../config/uiSizing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserIdFromToken } from '../../utils/storage';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import AttachDocument from '../../components/AttachDocument';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { profileUpdateManager } from '../../utils/profileUpdateManager';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';

const { width } = Dimensions.get('window');

interface AddPartyScreenParams {
  contactData?: {
    name: string;
    phoneNumber: string;
  };
  partyType?: 'customer' | 'supplier';
  editMode?: boolean;
  customerData?: any;
}

const AddPartyScreen: React.FC = () => {
  // StatusBar like ProfileScreen for colored header
  const { statusBarSpacer } = useStatusBarWithGradient('AddParty', [
    '#4f8cff',
    '#4f8cff',
  ]);
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AddParty'>>();
  const params = route.params as AddPartyScreenParams;
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  const isEditMode = params?.editMode || false;
  const customerData = params?.customerData;
  const fromPaymentPhone = (params as any)?.fromPaymentPhone as
    | string
    | undefined;
  const fromPaymentAddress = (params as any)?.fromPaymentAddress as
    | string
    | undefined;

  const [partyName, setPartyName] = useState(
    isEditMode ? customerData?.name || '' : params?.contactData?.name || '',
  );
  const [countryCode, setCountryCode] = useState('+91');
  // Helper to normalize phone to 10 digits (drop +91 and other symbols). Returns '' if not valid
  const normalizePhone = (value: string | undefined | null): string => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length >= 11 && digits.startsWith('91'))
      return digits.slice(-10);
    if (digits.length === 10) return digits;
    // For any other length (e.g., just '91'), treat as empty to avoid showing partial codes
    return '';
  };

  // Helper to extract phone number from various supplier/customer data structures
  const extractPhoneFromData = (data: any): string => {
    if (!data) return '';
    return normalizePhone(
      data.phoneNumber ||
        data.phone ||
        data.phone_number ||
        data.partyPhone ||
        (data as any)?.partyPhone,
    );
  };

  // Helper to extract address from various supplier/customer data structures
  const extractAddressFromData = (data: any): string => {
    if (!data) return '';
    return (
      data.address ||
      data.addressLine1 ||
      data.address_line1 ||
      data.partyAddress ||
      (data as any)?.partyAddress ||
      (Array.isArray(data.addresses)
        ? data.addresses[0]?.addressLine1 || data.addresses[0]?.address_line1
        : '') ||
      ''
    );
  };

  const [phoneNumber, setPhoneNumber] = useState(
    isEditMode
      ? extractPhoneFromData(customerData)
      : normalizePhone(params?.contactData?.phoneNumber),
  );
  const [partyType, setPartyType] = useState<'customer' | 'supplier'>(
    isEditMode
      ? customerData?.partyType || 'customer'
      : params?.partyType || 'customer',
  );
  const [gstin, setGstin] = useState(
    isEditMode ? customerData?.gstNumber || '' : '',
  );
  const [address, setAddress] = useState(
    isEditMode ? extractAddressFromData(customerData) : '',
  );
  const [voucherType, setVoucherType] = useState<'payment' | 'receipt'>(
    isEditMode
      ? customerData?.voucherType || 'payment'
      : partyType === 'supplier'
      ? 'payment'
      : 'receipt',
  );
  const [openingBalance, setOpeningBalance] = useState(
    isEditMode ? (customerData?.openingBalance || 0).toString() : '',
  );
  const [attachedDocument, setAttachedDocument] = useState<{
    name: string;
    type: 'image' | 'pdf';
    uri: string;
    size?: number;
  } | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[] | null>(null);

  const imageScrollViewRef = React.useRef<KeyboardAwareScrollView>(null);
  const lastTapRef = React.useRef<number>(0);
  const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

  // TextInput refs for focus handling
  const partyNameRef = useRef<TextInput | null>(null);
  const phoneNumberRef = useRef<TextInput | null>(null);
  const addressRef = useRef<TextInput | null>(null);
  const gstinRef = useRef<TextInput | null>(null);
  const openingBalanceRef = useRef<TextInput | null>(null);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<{
    partyName?: string;
    phoneNumber?: string;
    address?: string;
    openingBalance?: string;
  }>({});
  const [rbacBlockedMsg, setRbacBlockedMsg] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(
    null,
  );

  // Helper: format and resolve an effective date (supports backdated params)
  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Accept optional backdated date via navigation params for voucher posting
  const getEffectiveDate = (): string => {
    const anyParams: any = params || {};
    const candidate: string | undefined =
      anyParams.voucherDate || anyParams.date || anyParams.openingBalanceDate;
    if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(String(candidate))) {
      return String(candidate);
    }
    // Fallback to today in local (no timezone shift)
    return formatDateLocal(new Date());
  };

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'error' | 'warning' | 'confirm',
    onConfirm: undefined as (() => void) | undefined,
    onCancel: undefined as (() => void) | undefined,
    confirmText: 'OK',
    cancelText: 'Cancel',
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' | 'confirm' = 'info',
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      onConfirm,
      onCancel,
      confirmText: confirmText || 'OK',
      cancelText: cancelText || 'Cancel',
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
  };

  // Load permissions once for RBAC-aware create/update
  useEffect(() => {
    (async () => {
      try {
        const permsJson = await AsyncStorage.getItem('userPermissions');
        if (permsJson) {
          const permissions = JSON.parse(permsJson);
          setUserPermissions(permissions);
          console.log('📋 Loaded user permissions:', permissions);
        }
        setRbacBlockedMsg(null);
      } catch (e) {
        console.warn('Failed to load userPermissions:', e);
        // Don't block user if permissions can't be loaded
        setUserPermissions([]);
      }
    })();
  }, []);

  // Re-evaluate permission message when partyType changes
  useEffect(() => {
    if (!Array.isArray(userPermissions)) return;

    const required =
      partyType === 'supplier' ? 'supplier:create' : 'customer:create';

    // Only show permission error if we have permissions loaded and the required one is missing
    if (
      userPermissions.length > 0 &&
      !hasPermission(userPermissions, required)
    ) {
      setRbacBlockedMsg(
        `You don't have permission to add a ${partyType}. Required: ${required}.`,
      );
    } else {
      setRbacBlockedMsg(null);
    }
  }, [partyType, userPermissions]);

  // Helper to normalize and check permissions from different naming styles
  const hasPermission = (
    permissions: string[] | null | undefined,
    required: string,
  ) => {
    if (!Array.isArray(permissions) || permissions.length === 0) return false;
    // Accept both mobile style (customer:create) and backend enum style (CUSTOMER_CREATE)
    const normalized = new Set(permissions.map(p => String(p).toLowerCase()));
    const alt = required.includes(':')
      ? required.split(':')[0].toUpperCase() +
        '_' +
        required.split(':')[1].toUpperCase()
      : required.replace('_', ':').toLowerCase();
    return (
      normalized.has(required.toLowerCase()) ||
      normalized.has(String(alt).toLowerCase())
    );
  };

  const ensurePermissions = async (
    accessToken: string,
  ): Promise<string[] | null> => {
    try {
      // If we already have permissions, return them
      if (Array.isArray(userPermissions) && userPermissions.length > 0) {
        return userPermissions;
      }

      // Try to get from storage first
      const permsJson = await AsyncStorage.getItem('userPermissions');
      if (permsJson) {
        const stored = JSON.parse(permsJson);
        setUserPermissions(stored);
        return stored;
      }

      // Fallback: fetch from backend if not present
      console.log('🔄 Fetching permissions from backend...');
      // Use unified API
      const permsResponse = (await unifiedApi.get('/rbac/me/permissions')) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const perms = Array.isArray(permsResponse.data)
        ? permsResponse.data
        : Array.isArray(permsResponse)
        ? permsResponse
        : [];
      if (Array.isArray(perms) && perms.length > 0) {
        setUserPermissions(perms);
        try {
          await AsyncStorage.setItem('userPermissions', JSON.stringify(perms));
        } catch (storageError) {
          console.warn('Failed to store permissions:', storageError);
        }
        return perms;
      }

      // Return empty array instead of null to allow proceeding
      return [];
    } catch (e) {
      console.warn('ensurePermissions error:', e);
      // Return empty array instead of null to allow proceeding
      return [];
    }
  };

  // Function to scroll to center the focused input field
  const scrollToInputCenter = (inputRef: React.RefObject<TextInput | null>) => {
    if (scrollViewRef.current && inputRef.current) {
      console.log('🔍 Attempting to scroll to input center');

      setTimeout(() => {
        try {
          // Use KeyboardAwareScrollView's scrollToFocusedInput method
          if (inputRef.current) {
            scrollViewRef.current?.scrollToFocusedInput(inputRef.current, 200);
            console.log('🔍 ScrollToFocusedInput completed successfully');
          }
        } catch (error) {
          console.log('🔍 Error scrolling:', error);
          // Fallback: try to scroll to a reasonable position using scrollToPosition
          try {
            scrollViewRef.current?.scrollToPosition(0, 250, true);
          } catch (fallbackError) {
            console.log('🔍 Fallback scroll also failed:', fallbackError);
            // Final fallback: measure and scroll manually
            try {
              inputRef.current?.measure((x, y, width, height, pageX, pageY) => {
                const screenHeight = Dimensions.get('window').height;
                const targetY = Math.max(
                  0,
                  pageY - screenHeight / 2 + height / 2,
                );
                scrollViewRef.current?.scrollToPosition(0, targetY, true);
              });
            } catch (measureError) {
              console.log('🔍 Measure scroll also failed:', measureError);
            }
          }
        }
      }, 200); // Slightly longer delay for better reliability
    }
  };

  const clearFieldError = (field: keyof typeof errors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePartyNameChange = (text: string) => {
    setPartyName(text);
    if (text.trim().length >= 2) {
      clearFieldError('partyName');
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    setPhoneNumber(text);
    if (text.trim().length >= 10 && /^\d+$/.test(text.trim())) {
      clearFieldError('phoneNumber');
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (text.trim().length > 0) {
      clearFieldError('address');
    }
  };

  const handleOpeningBalanceChange = (text: string) => {
    setOpeningBalance(text);
    if (text.trim() === '' || !isNaN(parseFloat(text))) {
      clearFieldError('openingBalance');
    }
  };

  // Ensure opening balance is always a valid number for API
  const getValidOpeningBalance = (): number => {
    if (!openingBalance.trim()) return 0.0;
    const balance = parseFloat(openingBalance);
    return isNaN(balance) ? 0.0 : balance;
  };

  const clearAllErrors = () => {
    if (
      partyName.trim().length >= 2 &&
      phoneNumber.trim().length >= 10 &&
      /^\d+$/.test(phoneNumber.trim()) &&
      address.trim().length > 0
    ) {
      setErrors({});
    }
  };

  useEffect(() => {
    if (partyName.trim().length >= 2) {
      clearFieldError('partyName');
    }
    if (phoneNumber.trim().length >= 10 && /^\d+$/.test(phoneNumber.trim())) {
      clearFieldError('phoneNumber');
    }
    if (address.trim().length > 0) {
      clearFieldError('address');
    }
  }, [partyName, phoneNumber, address]);

  useEffect(() => {
    if (isEditMode && customerData?.voucherType) {
      setVoucherType(customerData.voucherType);
      console.log(
        'Updated voucher type from customer data:',
        customerData.voucherType,
      );
    }
  }, [isEditMode, customerData?.voucherType]);

  // Show message about API timing logs on screen load
  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 [API TIMING] AddPartyScreen Loaded');
    console.log(
      '⏱️  API call timings will appear in the console when you submit the form',
    );
    console.log('🔍 Look for logs marked with [API CALL] and [TIMING]');
    console.log('📋 A summary of all API timings will be shown at the end');
    console.log('═══════════════════════════════════════════════════════════');
  }, []);

  // Consolidated effect to prefill customer/supplier details on edit
  useEffect(() => {
    if (!isEditMode || !customerData) return;

    const prefillData = async () => {
      try {
        // Step 1: Try immediate data from customerData and navigation params
        let normalizedPhone = fromPaymentPhone
          ? normalizePhone(fromPaymentPhone)
          : extractPhoneFromData(customerData);

        let navAddress =
          fromPaymentAddress && String(fromPaymentAddress).trim()
            ? String(fromPaymentAddress)
            : extractAddressFromData(customerData);

        // Step 2: Try local overrides from AsyncStorage
        try {
          const overridesRaw = await AsyncStorage.getItem('supplierOverrides');
          if (overridesRaw) {
            const map = JSON.parse(overridesRaw);
            const ov = map[String((customerData as any).id)];
            if (ov) {
              if (!normalizedPhone && ov.phoneNumber) {
                normalizedPhone = normalizePhone(ov.phoneNumber);
              }
              if ((!navAddress || !String(navAddress).trim()) && ov.address) {
                navAddress = String(ov.address);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to load local overrides:', e);
        }

        // Step 3: Try recent transactions as fallback
        if (!normalizedPhone || !navAddress || !String(navAddress).trim()) {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            const cid = (customerData as any)?.id;
            if (token && cid) {
              // Use unified API with server-side filtering
              const raw = (await unifiedApi.getTransactionsByCustomer(cid)) as {
                data: any;
                status: number;
                headers: Headers;
              };
              const rawData = raw?.data || raw || {};
              const rows: any[] = Array.isArray(rawData?.data)
                ? rawData.data
                : Array.isArray(rawData)
                ? rawData
                : [];
              if (rows.length > 0) {
                const latest = rows
                  .slice()
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.date || b.created_at || 0).getTime() -
                      new Date(a.date || a.created_at || 0).getTime(),
                  )[0];

                if (!normalizedPhone) {
                  const phoneFromTx = normalizePhone(
                    latest?.partyPhone || latest?.phone || latest?.phoneNumber,
                  );
                  if (phoneFromTx) normalizedPhone = phoneFromTx;
                }

                if (!navAddress || !String(navAddress).trim()) {
                  const addressFromTx =
                    latest?.partyAddress ||
                    latest?.address ||
                    latest?.addressLine1 ||
                    '';
                  if (addressFromTx) navAddress = String(addressFromTx);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to fetch from transactions:', e);
          }
        }

        // Step 4: Try API fetch for complete details
        try {
          const accessToken = await AsyncStorage.getItem('accessToken');
          if (accessToken && customerData.id) {
            // Use unified API with caching
            const raw = (await unifiedApi.getCustomerById(customerData.id)) as {
              data: any;
              status: number;
              headers: Headers;
            };
            const detail = raw?.data ?? raw ?? {};
            console.log('🔍 Prefill detail for customer:', detail);

            const nameVal =
              detail?.name || detail?.partyName || detail?.party_name;
            const phoneVal = extractPhoneFromData(detail);
            const addrVal = extractAddressFromData(detail);
            const gstVal =
              detail?.gstNumber ||
              detail?.gst ||
              detail?.gstin ||
              detail?.gst_number ||
              '';

            // Only update if we don't have values already
            if (nameVal && !partyName) setPartyName(String(nameVal));
            if (phoneVal && !normalizedPhone) normalizedPhone = phoneVal;
            if (addrVal && (!navAddress || !String(navAddress).trim()))
              navAddress = String(addrVal);
            if (gstVal) setGstin(String(gstVal));
          }
        } catch (e) {
          console.warn('Failed to fetch customer details from API:', e);
        }

        // Step 5: Set the final values
        if (normalizedPhone) setPhoneNumber(normalizedPhone);
        if (navAddress && String(navAddress).trim())
          setAddress(String(navAddress));
      } catch (e) {
        console.warn('Error in prefillData:', e);
      }
    };

    prefillData();
  }, [isEditMode, customerData]);

  const validateForm = (): boolean => {
    const newErrors: {
      partyName?: string;
      phoneNumber?: string;
      address?: string;
      openingBalance?: string;
    } = {};

    if (!partyName.trim()) {
      newErrors.partyName = 'Party name is required';
    } else if (partyName.trim().length < 2) {
      newErrors.partyName = 'Party name must be at least 2 characters';
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else {
      const phoneDigits = phoneNumber.trim().replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        newErrors.phoneNumber = 'Phone number must be at least 10 digits';
      } else {
        // Normalize phone number (handle 91 prefix or leading 0)
        const normalizedPhone =
          phoneDigits.length === 12 && phoneDigits.startsWith('91')
            ? phoneDigits.substring(2)
            : phoneDigits.length === 11 && phoneDigits.startsWith('0')
            ? phoneDigits.substring(1)
            : phoneDigits;

        if (normalizedPhone.length !== 10) {
          newErrors.phoneNumber = 'Phone number must be exactly 10 digits';
        } else if (!/^[6-9]/.test(normalizedPhone)) {
          newErrors.phoneNumber = 'Phone number must start with 6, 7, 8, or 9';
        } else if (!/^\d+$/.test(phoneNumber.trim())) {
          newErrors.phoneNumber = 'Phone number must contain only digits';
        }
      }
    }

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }

    // Validate opening balance - only when adding new party (not in edit mode)
    // Note: Opening balance is not sent to backend, so validation is not critical
    if (!isEditMode && openingBalance.trim()) {
      const balance = parseFloat(openingBalance);
      if (isNaN(balance)) {
        newErrors.openingBalance = 'Opening balance must be a valid number';
      }
      // Allow negative values for opening balance
    }

    setErrors(newErrors);

    // If there's a phone number error, scroll to it
    if (newErrors.phoneNumber) {
      setTimeout(() => {
        scrollToInputCenter(phoneNumberRef);
      }, 100);
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleAddParty = async () => {
    const overallStartTime = Date.now();
    setErrors({});

    // Track all API call timings for final summary
    const apiTimings: Array<{
      name: string;
      duration: number;
      status: 'success' | 'failed' | 'skipped';
    }> = [];

    // Enhanced logging with console group for better visibility
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 [API TIMING] AddPartyScreen - API CALL TIMING LOGS');
    console.log('📊 Watch this console for detailed API call timings!');
    console.log('⏱️  All API call durations will be shown below:');
    console.log('═══════════════════════════════════════════════════════════');
    console.group('🚀 [API] AddPartyScreen - Starting Party Creation/Update');
    console.log(
      '🔍 [TIMING] Starting party creation/update process at',
      new Date().toISOString(),
    );
    console.log('📋 Current form state:', {
      partyName,
      phoneNumber,
      address,
      partyType,
      voucherType,
      openingBalance,
    });
    // unifiedApi handles base URL internally

    const validationStartTime = Date.now();
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }
    console.log(
      '⏱️ [TIMING] Form validation took',
      Date.now() - validationStartTime,
      'ms',
    );
    console.log('✅ Form validation passed');
    try {
      // OPTIMIZATION: Show loading immediately for better UX
      setLoading(true);

      // OPTIMIZATION: Get access token first (needed for everything)
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        showCustomAlert(
          'Error',
          'Authentication required. Please login again.',
          'error',
        );
        setLoading(false);
        return;
      }

      // OPTIMIZATION: Start limit check in background (completely non-blocking)
      // Don't wait for it - proceed with POST call immediately
      // Backend will enforce limits, we just show popup if cached data shows limit reached
      (async () => {
        try {
          const limitCheckStartTime = Date.now();
          // Use unified API for transaction limits (cached for 2 minutes)
          const limitsData = (await unifiedApi.getTransactionLimits()) as {
            canCreate?: boolean;
          };
          const limitCheckDuration = Date.now() - limitCheckStartTime;
          console.log(
            '⏱️ [TIMING] Transaction limit check (background) took',
            limitCheckDuration,
            'ms',
          );
          if (limitsData && limitsData.canCreate === false) {
            try {
              await forceShowPopup();
            } catch {}
          }
        } catch (err) {
          console.warn('Transaction limit check error (non-blocking):', err);
        }
      })();

      // OPTIMIZATION: Fast permission check - use cache only, don't block
      const requiredPerm =
        partyType === 'supplier' ? 'supplier:create' : 'customer:create';

      // Fast path: Check cached permissions first (no API call)
      if (
        Array.isArray(userPermissions) &&
        userPermissions.length > 0 &&
        !hasPermission(userPermissions, requiredPerm)
      ) {
        const msg = `You don't have permission to add a ${partyType}. Required: ${requiredPerm}.`;
        setRbacBlockedMsg(msg);
        showCustomAlert('Create Error', msg, 'error');
        setLoading(false);
        return; // Prevent API call explicitly forbidden by RBAC
      }

      // OPTIMIZATION: Run permission check in background if not cached (non-blocking)
      if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
        ensurePermissions(accessToken)
          .then(perms => {
            if (
              Array.isArray(perms) &&
              perms.length > 0 &&
              !hasPermission(perms, requiredPerm)
            ) {
              console.warn(
                '⚠️ Permission check failed after API call started - backend will handle',
              );
            }
          })
          .catch(permErr => {
            console.warn('Permission check error (non-blocking):', permErr);
          });
        console.log(
          '⚠️ Permissions not cached, proceeding - backend will authorize',
        );
      } else {
        console.log(
          '✅ Permission check passed (from cache), proceeding with API call',
        );
      }
      if (isEditMode) {
        console.log('🔄 Edit mode detected, calling handleUpdateParty');
        const updateStartTime = Date.now();
        await handleUpdateParty(accessToken, apiTimings);
        const updateDuration = Date.now() - updateStartTime;
        apiTimings.push({
          name: 'handleUpdateParty (total)',
          duration: updateDuration,
          status: 'success',
        });
        console.log(
          '⏱️ [TIMING] handleUpdateParty completed in',
          updateDuration,
          'ms',
        );
      } else {
        console.log('🆕 Create mode detected, calling handleCreateParty');
        const createStartTime = Date.now();
        await handleCreateParty(accessToken, apiTimings);
        const createDuration = Date.now() - createStartTime;
        apiTimings.push({
          name: 'handleCreateParty (total)',
          duration: createDuration,
          status: 'success',
        });
        console.log(
          '⏱️ [TIMING] handleCreateParty completed in',
          createDuration,
          'ms',
        );
      }
      const overallDuration = Date.now() - overallStartTime;
      console.groupEnd();
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
      console.log('📊 [API TIMING SUMMARY] - ALL API CALLS');
      console.log(
        '═══════════════════════════════════════════════════════════',
      );

      // Display all API call timings
      if (apiTimings.length > 0) {
        console.log('📋 API Call Timings:');
        apiTimings.forEach((timing, index) => {
          const statusIcon =
            timing.status === 'success'
              ? '✅'
              : timing.status === 'failed'
              ? '❌'
              : '⏭️';
          const slowWarning = timing.duration > 2000 ? ' ⚠️ SLOW!' : '';
          console.log(
            `  ${index + 1}. ${statusIcon} ${timing.name}: ${
              timing.duration
            }ms${slowWarning}`,
          );
        });
        console.log('');
      }

      console.log(
        `⏱️  [TOTAL DURATION] Complete operation: ${overallDuration}ms`,
      );
      if (overallDuration > 5000) {
        console.warn('⚠️  [WARNING] Operation took longer than 5 seconds!');
      } else if (overallDuration > 3000) {
        console.warn('⚠️  [WARNING] Operation took longer than 3 seconds');
      } else {
        console.log('✅ [PERF] Operation completed within acceptable time');
      }
      console.log('✅ [SUCCESS] Party operation completed successfully');
      console.log(
        '═══════════════════════════════════════════════════════════',
      );
    } catch (error: any) {
      const overallDuration = Date.now() - overallStartTime;
      console.error(
        '⏱️ [TIMING] handleAddParty FAILED after',
        overallDuration,
        'ms',
      );
      console.error('❌ [ERROR] Error handling party:', error);
      console.error('❌ [ERROR] Error message:', error?.message);
      console.error('❌ [ERROR] Error response:', error?.response?.data);
      console.error('❌ [ERROR] Error status:', error?.response?.status);
      console.groupEnd();

      // Handle phone number specific errors (duplicate, invalid format, etc.)
      try {
        // Check for custom phone error flag first
        if ((error as any)?.isPhoneError) {
          const phoneErrorMsg =
            (error as any)?.phoneErrorMsg ||
            error?.message ||
            'Invalid phone number format.';
          setErrors(prev => ({
            ...prev,
            phoneNumber: phoneErrorMsg,
          }));

          // Scroll to phone number field to show the error
          setTimeout(() => {
            scrollToInputCenter(phoneNumberRef);
          }, 100);

          showCustomAlert(
            'Invalid Phone Number',
            phoneErrorMsg +
              ' Please enter a valid 10-digit Indian mobile number.',
            'error',
          );
          return;
        }

        // Get error message from all possible locations
        const backendMsg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          (Array.isArray(error?.response?.data?.message)
            ? error.response.data.message.join(', ')
            : '') ||
          '';
        const errorMsgStr = String(backendMsg || '').toLowerCase();

        console.log('🔍 [ERROR DEBUG] Checking phone errors:', {
          status: error?.response?.status,
          backendMsg,
          errorMsg: error?.message,
          responseData: error?.response?.data,
        });

        // Check for duplicate phone number (400 or 500 status)
        if (
          (error?.response?.status === 400 ||
            error?.response?.status === 500) &&
          backendMsg &&
          (errorMsgStr.includes('phone number already exists') ||
            errorMsgStr.includes('already exists') ||
            errorMsgStr.includes('duplicate'))
        ) {
          setErrors(prev => ({
            ...prev,
            phoneNumber: 'This phone number is already used by another party.',
          }));

          // Scroll to phone number field to show the error
          setTimeout(() => {
            scrollToInputCenter(phoneNumberRef);
          }, 100);

          showCustomAlert(
            'Duplicate Phone Number',
            'A party with this phone number already exists. Please use a different number.',
            'error',
          );
          return;
        }

        // Check for invalid phone number format errors (400 or 500 status - sanitization errors can be 500)
        if (
          (error?.response?.status === 400 ||
            error?.response?.status === 500) &&
          backendMsg &&
          (errorMsgStr.includes('invalid phone') ||
            errorMsgStr.includes('phone must be') ||
            errorMsgStr.includes('phone number format') ||
            errorMsgStr.includes('must start with 6, 7, 8, or 9') ||
            errorMsgStr.includes('expected 10 digits') ||
            errorMsgStr.includes('indian mobile number') ||
            (Array.isArray(error.response?.data?.message) &&
              error.response.data.message.some((msg: any) =>
                String(msg || '')
                  .toLowerCase()
                  .includes('phone'),
              )))
        ) {
          // Extract specific error message or use default
          let phoneErrorMsg = 'Invalid phone number format.';
          if (errorMsgStr.includes('must start with 6, 7, 8, or 9')) {
            phoneErrorMsg = 'Phone number must start with 6, 7, 8, or 9.';
          } else if (errorMsgStr.includes('expected 10 digits')) {
            phoneErrorMsg = 'Phone number must be exactly 10 digits.';
          } else if (errorMsgStr.includes('phone must be 10-13 digits')) {
            phoneErrorMsg = 'Phone number must be 10-13 digits.';
          } else if (backendMsg) {
            // Use the backend message if available
            phoneErrorMsg = String(backendMsg);
          }

          setErrors(prev => ({
            ...prev,
            phoneNumber: phoneErrorMsg,
          }));

          // Scroll to phone number field to show the error
          setTimeout(() => {
            scrollToInputCenter(phoneNumberRef);
          }, 100);

          showCustomAlert(
            'Invalid Phone Number',
            phoneErrorMsg +
              ' Please enter a valid 10-digit Indian mobile number.',
            'error',
          );
          return;
        }
      } catch (phoneError) {
        console.warn('Error parsing phone number error:', phoneError);
      }

      let errorMessage = isEditMode
        ? 'Failed to update party. Please try again.'
        : 'Failed to add party. Please try again.';

      try {
        if (error.response?.data?.message) {
          const message = error.response.data.message;
          if (Array.isArray(message)) {
            // Check if any message is about phone number
            const phoneError = message.find((msg: any) =>
              String(msg || '')
                .toLowerCase()
                .includes('phone'),
            );
            if (phoneError) {
              setErrors(prev => ({
                ...prev,
                phoneNumber: String(phoneError),
              }));

              // Scroll to phone number field to show the error
              setTimeout(() => {
                scrollToInputCenter(phoneNumberRef);
              }, 100);

              showCustomAlert(
                'Invalid Phone Number',
                String(phoneError) +
                  ' Please enter a valid 10-digit Indian mobile number.',
                'error',
              );
              return;
            }
            errorMessage = message.join(', ');
          } else if (typeof message === 'object') {
            errorMessage = JSON.stringify(message);
          } else {
            errorMessage = String(message);
          }
        } else if (error.response?.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (error.response?.status === 400) {
          errorMessage = 'Invalid data provided. Please check your inputs.';
        } else if (error.response?.status === 404) {
          errorMessage = isEditMode
            ? 'Party not found. The party may have been deleted or the ID is invalid.'
            : 'API endpoint not found. Please check the server configuration.';
        } else if (error.response?.status === 409) {
          errorMessage = 'Party already exists with this information.';
        } else if (error.response?.status >= 500) {
          errorMessage = `Server error (${error.response.status}). Please try again later.`;
          console.error('Server Error Details:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          });
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        errorMessage = 'An unexpected error occurred. Please try again.';
      }

      console.log('Error Response Status:', error.response?.status);
      console.log('Error Response Data:', error.response?.data);
      console.log('Error Response Headers:', error.response?.headers);

      const safeErrorMessage = String(
        errorMessage || 'An unexpected error occurred',
      );
      showCustomAlert('Error', safeErrorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateParty = async (
    accessToken: string,
    apiTimings?: Array<{
      name: string;
      duration: number;
      status: 'success' | 'failed' | 'skipped';
    }>,
  ) => {
    const startTime = Date.now();
    console.group('📤 [API] Creating Party - POST /customers');
    console.log(
      '🚀 [TIMING] handleCreateParty function entered at',
      new Date().toISOString(),
    );
    try {
      // Normalize phone to digits only for backend compatibility
      const phoneNormalized = phoneNumber.trim().replace(/\D/g, '');

      const isValidGstin = (value: string) =>
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value);

      const payloadStartTime = Date.now();
      const basicPayload = {
        partyName: partyName.trim(),
        // Redundant fields to satisfy backend DTO and any normalization logic
        name: partyName.trim(),
        partyType: partyType,
        // For DTO.phone, send digits-only
        phone: phoneNormalized,
        phoneNumber: phoneNormalized,
        address: address.trim(),
        addressLine1: address.trim(),
        // include alternate GST keys for broader backend compatibility
        gstNumber: gstin.trim() || null, // always send flat gst on create when present
        gst: gstin.trim() || null,
        gstin: gstin.trim() || null,
        // Conditionally include structured addresses for suppliers/customers
        ...(() => {
          const addr = address.trim();
          const gst = gstin.trim();
          const includeGstin = gst && isValidGstin(gst);
          if (!addr && !includeGstin) return {};
          return {
            addresses: [
              {
                type: 'billing',
                ...(addr ? { flatBuildingNumber: addr } : {}),
                ...(includeGstin ? { gstin: gst } : {}),
              },
            ],
          };
        })(),
        // voucherType intentionally omitted to prevent backend-side voucher creation
        openingBalance:
          openingBalance && !isNaN(parseFloat(openingBalance))
            ? parseFloat(openingBalance)
            : 0,
        // Optional currency; backend defaults to INR if not provided
        currency: 'INR',
      } as any;

      // Normalize party type casing for backend enum ('Customer' | 'Supplier')
      if (basicPayload.partyType) {
        const raw = String(basicPayload.partyType).toLowerCase();
        basicPayload.partyType = raw === 'supplier' ? 'Supplier' : 'Customer';
      }

      // OPTIMIZATION: Add role ID with timeout to avoid blocking POST call
      // If role ID fetch takes > 200ms, proceed without it (backend can handle)
      const roleIdStartTime = Date.now();
      try {
        const { addRoleIdToBody } = await import('../../utils/roleHelper');
        // Race between role ID fetch and timeout
        await Promise.race([
          addRoleIdToBody(basicPayload),
          new Promise(resolve => setTimeout(resolve, 200)),
        ]);
        console.log(
          '⏱️ [TIMING] Role ID added in',
          Date.now() - roleIdStartTime,
          'ms',
        );
      } catch (e) {
        console.warn(
          '⚠️ AddPartyScreen: Failed to add role ID to create payload:',
          e,
        );
      }
      console.log(
        '⏱️ [TIMING] Payload preparation took',
        Date.now() - payloadStartTime,
        'ms',
      );

      console.log('➕ Creating basic party record with payload:', basicPayload);
      // Use supplier-specific endpoint if creating a supplier
      const primaryCreateUrl =
        partyType === 'supplier' ? '/customers/suppliers' : '/customers';
      console.log('🔗 API Endpoint (primary):', primaryCreateUrl);

      let createResponse;
      const createStartTime = Date.now();
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📤 [API CALL] POST', primaryCreateUrl);
        console.log('⏱️ [TIMING] Starting at', new Date().toISOString());
        console.log(
          '📦 Payload size:',
          JSON.stringify(basicPayload).length,
          'bytes',
        );
        // OPTIMIZATION: Disable retries for faster response - backend should handle errors
        // Retries add exponential backoff delays (1s, 2s) which slow down the UI
        createResponse = (await unifiedApi.post(
          primaryCreateUrl,
          basicPayload,
          {
            retryOnTimeout: false, // Disable retries for faster response
            maxRetries: 0, // No retries
            logRequest: true, // Enable request logging
          },
        )) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const createDuration = Date.now() - createStartTime;
        if (apiTimings) {
          apiTimings.push({
            name: `POST ${primaryCreateUrl}`,
            duration: createDuration,
            status: 'success',
          });
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [API CALL] POST', primaryCreateUrl, 'COMPLETED');
        console.log(
          '⏱️ [TIMING] Duration:',
          createDuration,
          'ms',
          createDuration > 2000 ? '⚠️ SLOW!' : '✅ OK',
        );
        console.log(
          '📊 [PERF] Create customer API call duration:',
          createDuration,
          'ms',
        );
        console.log('📥 Response status:', createResponse.status);
      } catch (err: any) {
        const createDuration = Date.now() - createStartTime;
        if (apiTimings) {
          apiTimings.push({
            name: `POST ${primaryCreateUrl}`,
            duration: createDuration,
            status: 'failed',
          });
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [API CALL] POST', primaryCreateUrl, 'FAILED');
        console.error('⏱️ [TIMING] Failed after', createDuration, 'ms');
        console.error('❌ Error:', err?.message || err);
        console.error('❌ Error response:', err?.response?.data);
        console.error('❌ Error status:', err?.response?.status);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Check for phone number errors before throwing
        const errorMsg =
          err?.message ||
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          '';
        const errorMsgStr = String(errorMsg).toLowerCase();

        // Check for phone validation errors (even in 500 errors from sanitization)
        // Also check error.response.data for nested error messages
        const nestedErrorMsg =
          err?.response?.data?.error || err?.response?.data?.message || '';
        const allErrorText = (errorMsg + ' ' + nestedErrorMsg).toLowerCase();

        if (
          errorMsgStr.includes('invalid phone') ||
          errorMsgStr.includes('phone number format') ||
          errorMsgStr.includes('must start with 6, 7, 8, or 9') ||
          errorMsgStr.includes('expected 10 digits') ||
          errorMsgStr.includes('phone must be') ||
          allErrorText.includes('invalid phone') ||
          allErrorText.includes('phone number format') ||
          allErrorText.includes('must start with 6, 7, 8, or 9') ||
          allErrorText.includes('expected 10 digits') ||
          allErrorText.includes('phone must be')
        ) {
          let phoneErrorMsg = 'Invalid phone number format.';
          const sourceMsg = errorMsg || nestedErrorMsg || '';
          if (sourceMsg.includes('must start with 6, 7, 8, or 9')) {
            phoneErrorMsg = 'Phone number must start with 6, 7, 8, or 9.';
          } else if (sourceMsg.includes('expected 10 digits')) {
            phoneErrorMsg = 'Phone number must be exactly 10 digits.';
          } else if (sourceMsg.includes('phone must be 10-13 digits')) {
            phoneErrorMsg = 'Phone number must be 10-13 digits.';
          } else if (sourceMsg) {
            phoneErrorMsg = String(sourceMsg);
          }

          console.error(
            '📱 [PHONE ERROR] Detected phone validation error:',
            phoneErrorMsg,
          );

          // Throw a custom error that will be caught by the outer handler
          const phoneError = new Error(phoneErrorMsg);
          (phoneError as any).isPhoneError = true;
          (phoneError as any).phoneErrorMsg = phoneErrorMsg;
          throw phoneError;
        }

        throw err;
      }

      // unifiedApi returns { data, status, headers } structure
      const responseData = createResponse.data || createResponse;
      console.log('✅ Basic customer created:', responseData);

      const customerId = responseData.id;
      console.log('🆔 Customer ID received:', customerId);
      if (!customerId) {
        throw new Error('Failed to get customer ID from creation response');
      }

      // OPTIMIZATION: Removed redundant PATCH call - all data is already sent in POST
      // This eliminates an extra API call that was adding 1-2 seconds of delay
      console.log(
        '✅ Customer created successfully - skipping redundant update call',
      );

      console.log('📍 Reached opening balance check section');
      // Create opening balance voucher if amount is entered (positive or negative)
      console.log('🔍 Checking opening balance:', {
        openingBalance: openingBalance,
        trimmed: openingBalance.trim(),
        parsed: parseFloat(openingBalance),
        isNonZero: parseFloat(openingBalance) !== 0,
      });

      const shouldCreateVoucher =
        openingBalance.trim() && parseFloat(openingBalance) !== 0;
      console.log('🔍 Voucher creation condition:', {
        openingBalance: openingBalance,
        trimmed: openingBalance.trim(),
        hasOpeningBalance: !!openingBalance.trim(),
        parsedAmount: parseFloat(openingBalance),
        isNonZero: parseFloat(openingBalance) !== 0,
        shouldCreateVoucher: shouldCreateVoucher,
      });

      if (shouldCreateVoucher) {
        console.log(
          '💰 Opening balance detected, creating voucher for amount:',
          openingBalance,
        );
        console.log('📞 Calling createOpeningBalanceVoucher...');
        const voucherStartTime = Date.now();
        try {
          // Only create ONE voucher of the type selected in the UI
          await createOpeningBalanceVoucher(
            accessToken,
            customerId,
            apiTimings,
          );
          const voucherDuration = Date.now() - voucherStartTime;
          console.log(
            '⏱️ [TIMING] Voucher creation completed in',
            voucherDuration,
            'ms',
          );
          console.log('✅ createOpeningBalanceVoucher completed successfully');

          // OPTIMIZATION: Remove unnecessary 2-second delay
          // The backend should handle processing synchronously
          // If async processing is needed, use webhooks or polling instead of fixed delay
          // await new Promise(resolve => setTimeout(resolve, 2000));
          // console.log('⏳ Waited for voucher processing...');
          console.log(
            '⏱️ [TIMING] Skipped unnecessary 2-second delay (optimization)',
          );
        } catch (voucherError) {
          const voucherDuration = Date.now() - voucherStartTime;
          console.error(
            '⏱️ [TIMING] Voucher creation FAILED after',
            voucherDuration,
            'ms',
          );
          console.error('❌ Voucher creation failed:', voucherError);
          // Don't fail the entire party creation if voucher creation fails
        }
      } else {
        console.log('ℹ️ No opening balance entered, skipping voucher creation');
      }

      // Store the opening balance locally for CustomerScreen
      // Since the backend doesn't store opening balance in customer data, we need to store it locally
      if (shouldCreateVoucher) {
        const openingBalanceAmount = parseFloat(openingBalance);
        console.log(
          `💾 Storing opening balance ${openingBalanceAmount} for customer ${customerId}`,
        );

        // Store in AsyncStorage for the CustomerScreen to access
        try {
          const existingOpeningBalances = await AsyncStorage.getItem(
            'customerOpeningBalances',
          );
          const openingBalances = existingOpeningBalances
            ? JSON.parse(existingOpeningBalances)
            : {};
          openingBalances[customerId] = {
            amount: openingBalanceAmount,
            type: voucherType,
            timestamp: Date.now(),
            customerName: partyName,
          };
          await AsyncStorage.setItem(
            'customerOpeningBalances',
            JSON.stringify(openingBalances),
          );
          console.log('✅ Opening balance stored in AsyncStorage');
        } catch (storageError) {
          console.error(
            '❌ Failed to store opening balance in AsyncStorage:',
            storageError,
          );
        }
      }

      console.log(
        '🧭 Showing success popup after creation (no auto-navigation)',
      );

      // Emit profile update event to refresh user data in other screens
      console.log(
        '📢 AddPartyScreen: Emitting profile update event after party creation',
      );
      profileUpdateManager.emitProfileUpdate();

      // OPTIMIZATION: Reduce excessive refresh calls
      // Single refresh should be sufficient - backend should handle data consistency
      if (shouldCreateVoucher) {
        console.log(
          '🔄 AddPartyScreen: Refreshing customer data after voucher creation...',
        );
        // Immediate refresh only
        profileUpdateManager.emitProfileUpdate();
        console.log(
          '⏱️ [TIMING] Skipped excessive refresh delays (optimization)',
        );
      }

      // Directly navigate to list without showing success popup
      const totalDuration = Date.now() - startTime;
      console.log(
        '⏱️ [TIMING] Total handleCreateParty duration:',
        totalDuration,
        'ms',
      );
      console.log(
        '📊 [PERF] Complete party creation took:',
        totalDuration,
        'ms',
      );
      console.log('✅ [SUCCESS] Party creation completed successfully');
      console.groupEnd();

      navigation.navigate('Customer', {
        selectedTab: partyType,
        shouldRefresh: true,
      });
    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      console.error(
        '⏱️ [TIMING] handleCreateParty FAILED after',
        totalDuration,
        'ms',
      );
      console.error('❌ [ERROR] Error creating party:', error);
      console.groupEnd();

      // Handle permission error specifically
      if (
        error.response?.status === 403 &&
        error.response?.data?.message?.includes('Insufficient permissions')
      ) {
        const requiredPerm =
          partyType === 'supplier' ? 'supplier:create' : 'customer:create';
        const errorMessage = `You don't have permission to add a ${partyType}. Required: ${requiredPerm}. Please contact your administrator to assign the necessary role.`;

        showCustomAlert('Permission Required', errorMessage, 'error', () => {
          // Optionally navigate to contact admin or role request screen
          console.log('User needs to contact admin for role assignment');
        });
        return;
      }

      handleCreateError(error);
    }
  };

  const createOpeningBalanceVoucher = async (
    accessToken: string,
    customerId: string,
    apiTimings?: Array<{
      name: string;
      duration: number;
      status: 'success' | 'failed' | 'skipped';
    }>,
  ) => {
    const voucherStartTime = Date.now();
    console.log(
      '🚀 [TIMING] Starting opening balance voucher creation at',
      new Date().toISOString(),
    );
    try {
      const userIdStartTime = Date.now();
      const userId = await getUserIdFromToken();
      console.log(
        '⏱️ [TIMING] getUserIdFromToken took',
        Date.now() - userIdStartTime,
        'ms',
      );
      console.log('👤 User ID for voucher creation:', userId);
      if (!userId) {
        console.warn('User ID not found for voucher creation');
        return;
      }

      const amount = parseFloat(openingBalance);
      if (isNaN(amount) || amount === 0) {
        console.warn(
          '❌ Invalid opening balance amount for voucher creation:',
          openingBalance,
        );
        return;
      }
      console.log('✅ Valid amount for voucher creation:', amount);
      console.log('🎯 User selected voucher type:', voucherType);

      // Map UI selection to backend transaction type
      // UI: payment | receipt → Backend: debit | credit
      // Map strictly from user's selection (default Payment)
      const voucherTypeForVoucher: 'debit' | 'credit' =
        voucherType === 'receipt' ? 'credit' : 'debit';

      // Validate customerId
      const customerIdNumber = parseInt(customerId);
      if (isNaN(customerIdNumber)) {
        console.error('❌ Invalid customerId:', customerId);
        return;
      }

      // Idempotency: avoid duplicate opening balance vouchers (rapid double taps)
      const duplicateCheckStartTime = Date.now();
      const recentlyExists = await hasRecentOpeningBalanceVoucher(
        accessToken,
        customerIdNumber,
        Math.abs(amount),
        voucherTypeForVoucher,
      );
      const duplicateCheckDuration = Date.now() - duplicateCheckStartTime;
      console.log(
        '⏱️ [TIMING] Duplicate check took',
        duplicateCheckDuration,
        'ms',
      );
      if (recentlyExists) {
        console.log('ℹ️ Duplicate opening balance detected; skipping voucher.');
        return;
      }

      // Generate document number for opening balance voucher (starts at 001 for new users)
      let openingBalanceNumber = '';
      const docNumberStartTime = Date.now();
      try {
        if (voucherTypeForVoucher === 'debit') {
          // Payment - use billNumber
          openingBalanceNumber = await generateNextDocumentNumber(
            'payment',
            true,
          ); // Store - transaction being saved
        } else {
          // Receipt - use receiptNumber
          openingBalanceNumber = await generateNextDocumentNumber(
            'receipt',
            true,
          ); // Store - transaction being saved
        }
        console.log(
          '⏱️ [TIMING] Document number generation took',
          Date.now() - docNumberStartTime,
          'ms',
        );
      } catch (error) {
        console.error(
          '⏱️ [TIMING] Document number generation FAILED after',
          Date.now() - docNumberStartTime,
          'ms',
        );
        console.error(
          'Error generating opening balance document number:',
          error,
        );
        // Fallback: generator returns PREFIX-001 for new users
        openingBalanceNumber =
          voucherTypeForVoucher === 'debit' ? 'PAY-001' : 'REC-001';
      }

      // Compute effective (possibly backdated) date for voucher
      const effectiveDate = getEffectiveDate();
      // Use ISO 8601 midnight to satisfy strict DTO parsers expecting full datetime
      const effectiveIso = `${effectiveDate}T00:00:00`;

      // Define voucherPayload inside try block so it's accessible in catch block
      const voucherPayload: any = {
        customer_id: customerIdNumber, // Use customer_id as expected by backend
        type: voucherTypeForVoucher,
        amount: Math.abs(amount), // Backend expects number
        description: 'Opening Balance',
        partyName: partyName.trim(),
        partyPhone: phoneNumber.trim(),
        partyAddress: address.trim(),
        method: 'Opening Balance',
        gstNumber: gstin.trim() || '',
        status: 'complete',
        // Explicit dates to preserve past dates on backend (send full ISO)
        date: effectiveIso,
        documentDate: effectiveIso,
        transactionDate: effectiveIso,
        // snake_case aliases for maximum compatibility
        transaction_date: effectiveIso,
        document_date: effectiveIso,
        invoice_date: effectiveIso,
        // Also include payment/receipt specific aliases used by backend create()
        // This guarantees the service derives `date` from these when provided
        ...(voucherTypeForVoucher === 'debit'
          ? { paymentDate: effectiveIso, payment_date: effectiveIso }
          : { receiptDate: effectiveIso, receipt_date: effectiveIso }),
        // Include document number (starts at 001 for new users)
        ...(voucherTypeForVoucher === 'debit'
          ? { billNumber: openingBalanceNumber }
          : { receiptNumber: openingBalanceNumber }),
      };

      console.log('💰 Creating opening balance voucher:', voucherPayload);
      console.log('📋 Voucher payload details:', {
        customer_id: voucherPayload.customer_id,
        type: voucherPayload.type,
        amount: voucherPayload.amount,
        partyName: voucherPayload.partyName,
        partyPhone: voucherPayload.partyPhone,
      });
      console.log('🔍 DEBUG: Frontend voucherType:', voucherType);
      console.log(
        '🔍 DEBUG: Mapped voucherTypeForVoucher:',
        voucherTypeForVoucher,
      );
      console.log(
        '🔍 DEBUG: Voucher API will be called with type:',
        voucherTypeForVoucher,
      );
      const voucherUrl = '/transactions';
      console.log('🔗 API Endpoint:', voucherUrl);
      console.log('📤 Sending POST request to vouchers API...');

      let voucherResponse;
      const postStartTime = Date.now();
      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(
          '📤 [API CALL] POST',
          voucherUrl,
          '(Opening Balance Voucher)',
        );
        console.log('⏱️ [TIMING] Starting at', new Date().toISOString());
        console.log('💰 Amount:', voucherPayload.amount);
        // OPTIMIZATION: Disable retries for faster response
        voucherResponse = (await unifiedApi.post(voucherUrl, voucherPayload, {
          retryOnTimeout: false, // Disable retries for faster response
          maxRetries: 0, // No retries
          logRequest: true, // Enable request logging
        })) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const postDuration = Date.now() - postStartTime;
        if (apiTimings) {
          apiTimings.push({
            name: `POST ${voucherUrl} (Opening Balance)`,
            duration: postDuration,
            status: 'success',
          });
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [API CALL] POST', voucherUrl, 'COMPLETED');
        console.log(
          '⏱️ [TIMING] Duration:',
          postDuration,
          'ms',
          postDuration > 2000 ? '⚠️ SLOW!' : '✅ OK',
        );
        console.log(
          '📊 [PERF] Create voucher API call duration:',
          postDuration,
          'ms',
        );
        console.log('📥 Response status:', voucherResponse.status);
      } catch (postErr: any) {
        const postDuration = Date.now() - postStartTime;
        if (apiTimings) {
          apiTimings.push({
            name: `POST ${voucherUrl} (Opening Balance)`,
            duration: postDuration,
            status: 'failed',
          });
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [API CALL] POST', voucherUrl, 'FAILED');
        console.error('⏱️ [TIMING] Failed after', postDuration, 'ms');
        console.error('❌ Error:', postErr?.message || postErr);
        // unifiedApi throws errors for non-2xx responses
        if (postErr?.status === 404 || postErr?.response?.status === 404) {
          console.warn(
            'ℹ️ /transactions POST not available; skipping opening balance creation',
          );
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return;
        }
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        throw postErr;
      }
      // unifiedApi returns { data, status, headers } structure
      console.log('📥 Voucher API response received:', voucherResponse.status);

      const voucherData = voucherResponse.data || voucherResponse;
      console.log(
        '✅ Opening balance voucher created successfully:',
        voucherData,
      );
      console.log(
        '💰 Voucher created for amount:',
        openingBalance,
        'Type:',
        voucherTypeForVoucher,
      );
      console.log(
        '🎯 CRITICAL DEBUG: Voucher creation response:',
        JSON.stringify(voucherResponse.data, null, 2),
      );
      console.log(
        '🔍 DEBUG: Backend returned transaction type:',
        voucherResponse.data?.type,
      );
      console.log('🔍 DEBUG: Expected type was:', voucherTypeForVoucher);
      const totalVoucherDuration = Date.now() - voucherStartTime;
      console.log(
        '⏱️ [TIMING] Total voucher creation took',
        totalVoucherDuration,
        'ms',
      );
      console.log(
        '📊 [PERF] Complete voucher creation duration:',
        totalVoucherDuration,
        'ms',
      );
      console.log('🎉 Voucher creation completed successfully!');

      // OPTIMIZATION: Move transaction limit check to background (non-blocking)
      // This check doesn't need to block the success flow
      forceCheckTransactionLimit().catch(limitError => {
        console.error('❌ Error checking transaction limit:', limitError);
        // Don't fail the party creation if limit check fails
      });
    } catch (error: any) {
      const totalVoucherDuration = Date.now() - voucherStartTime;
      console.error(
        '⏱️ [TIMING] Voucher creation FAILED after',
        totalVoucherDuration,
        'ms',
      );
      console.error(
        '❌ CRITICAL ERROR: Opening balance voucher creation failed:',
        {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data,
          fullError: error,
        },
      );
      console.error(
        '❌ VOUCHER PAYLOAD THAT FAILED:',
        'Check error details above for more information',
      );

      // Check if it's specifically a transaction limit error
      if (
        error.response?.data?.message?.includes('transaction limit') ||
        error.response?.data?.message?.includes('limit exceeded') ||
        error.response?.data?.message?.includes('monthly limit') ||
        error.response?.data?.message?.includes('quota exceeded')
      ) {
        // Only trigger transaction limit popup for actual limit errors
        console.log('🚫 Transaction limit error detected, showing popup');
        await forceShowPopup();
        return;
      }

      // Don't fail the entire party creation if voucher creation fails; continue silently
    }
  };

  // Helper: check for a recent identical opening balance voucher for same customer
  const hasRecentOpeningBalanceVoucher = async (
    accessToken: string,
    customerId: number,
    amount: number,
    type: 'debit' | 'credit',
  ): Promise<boolean> => {
    const checkStartTime = Date.now();
    try {
      const url = `/transactions?customer_id=${customerId}&limit=5`;
      console.log(
        '⏱️ [TIMING] Starting duplicate check GET at',
        new Date().toISOString(),
      );
      const resp = (await unifiedApi.get(url, {
        cache: false, // Don't cache this check
      })) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const checkDuration = Date.now() - checkStartTime;
      console.log(
        '⏱️ [TIMING] Duplicate check GET completed in',
        checkDuration,
        'ms',
      );
      // unifiedApi returns { data, status, headers } structure
      const responseData = resp.data || resp;
      const rows = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : [];
      const now = Date.now();
      const windowMs = 3 * 60 * 1000; // 3 minutes window
      return rows.some((t: any) => {
        const ts = new Date(t.created_at || t.createdAt || 0).getTime();
        const close = Math.abs(now - ts) < windowMs;
        const sameDesc =
          String(t.description || '').toLowerCase() === 'opening balance';
        const sameAmt = Number(t.amount) === Number(amount);
        const sameType = String(t.type || '').toLowerCase() === String(type);
        const sameCustomer =
          Number(t.customer_id || t.customerId) === Number(customerId);
        return close && sameDesc && sameAmt && sameType && sameCustomer;
      });
    } catch (e) {
      const checkDuration = Date.now() - checkStartTime;
      console.warn(
        '⏱️ [TIMING] Duplicate check FAILED after',
        checkDuration,
        'ms',
      );
      console.warn('Opening balance idempotency check failed:', e);
      return false;
    }
  };

  const handleCreateError = async (error: any) => {
    // Import error handler
    const { handleApiError } = require('../../utils/apiErrorHandler');
    const errorInfo = handleApiError(error);

    // Handle 403 Forbidden errors with user-friendly message
    if (errorInfo.isForbidden) {
      showCustomAlert('Access Denied', errorInfo.message, 'error');
      return;
    }

    // Handle phone number specific errors first
    try {
      // Check for custom phone error flag first
      if ((error as any)?.isPhoneError) {
        const phoneErrorMsg =
          (error as any)?.phoneErrorMsg ||
          error?.message ||
          'Invalid phone number format.';
        setErrors(prev => ({
          ...prev,
          phoneNumber: phoneErrorMsg,
        }));

        // Scroll to phone number field to show the error
        setTimeout(() => {
          scrollToInputCenter(phoneNumberRef);
        }, 100);

        showCustomAlert(
          'Invalid Phone Number',
          phoneErrorMsg +
            ' Please enter a valid 10-digit Indian mobile number.',
          'error',
        );
        return;
      }

      const backendMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        '';
      const errorMsgStr = String(backendMsg || '').toLowerCase();

      // Check for duplicate phone number
      if (
        error?.response?.status === 400 &&
        backendMsg &&
        (errorMsgStr.includes('phone number already exists') ||
          errorMsgStr.includes('already exists'))
      ) {
        setErrors(prev => ({
          ...prev,
          phoneNumber: 'This phone number is already used by another party.',
        }));

        // Scroll to phone number field to show the error
        setTimeout(() => {
          scrollToInputCenter(phoneNumberRef);
        }, 100);

        showCustomAlert(
          'Duplicate Phone Number',
          'A party with this phone number already exists. Please use a different number.',
          'error',
        );
        return;
      }

      // Check for invalid phone number format errors
      if (
        error?.response?.status === 400 &&
        backendMsg &&
        (errorMsgStr.includes('invalid phone') ||
          errorMsgStr.includes('phone must be') ||
          errorMsgStr.includes('phone number format') ||
          errorMsgStr.includes('must start with 6, 7, 8, or 9') ||
          errorMsgStr.includes('expected 10 digits') ||
          (Array.isArray(error.response?.data?.message) &&
            error.response.data.message.some((msg: any) =>
              String(msg || '')
                .toLowerCase()
                .includes('phone'),
            )))
      ) {
        let phoneErrorMsg = 'Invalid phone number format.';
        if (errorMsgStr.includes('must start with 6, 7, 8, or 9')) {
          phoneErrorMsg = 'Phone number must start with 6, 7, 8, or 9.';
        } else if (errorMsgStr.includes('expected 10 digits')) {
          phoneErrorMsg = 'Phone number must be exactly 10 digits.';
        } else if (errorMsgStr.includes('phone must be 10-13 digits')) {
          phoneErrorMsg = 'Phone number must be 10-13 digits.';
        } else if (backendMsg) {
          phoneErrorMsg = String(backendMsg);
        }

        setErrors(prev => ({
          ...prev,
          phoneNumber: phoneErrorMsg,
        }));

        // Scroll to phone number field to show the error
        setTimeout(() => {
          scrollToInputCenter(phoneNumberRef);
        }, 100);

        showCustomAlert(
          'Invalid Phone Number',
          phoneErrorMsg +
            ' Please enter a valid 10-digit Indian mobile number.',
          'error',
        );
        return;
      }
    } catch (phoneError) {
      console.warn(
        'Error parsing phone number error in handleCreateError:',
        phoneError,
      );
    }

    let errorMessage =
      errorInfo.message || 'Failed to create party. Please try again.';
    let showRetry = false;

    // Check if it's specifically a transaction limit error
    if (
      error.response?.data?.message?.includes('transaction limit') ||
      error.response?.data?.message?.includes('limit exceeded') ||
      error.response?.data?.message?.includes('monthly limit') ||
      error.response?.data?.message?.includes('quota exceeded')
    ) {
      // Only trigger transaction limit popup for actual limit errors
      console.log(
        '🚫 Transaction limit error detected in create error, showing popup',
      );
      await forceShowPopup();
      return;
    }

    if (error.response?.status === 500 || errorInfo.status === 500) {
      errorMessage =
        'Server error occurred. This might be a temporary issue. Please try again in a few minutes.';
      showRetry = true;
    } else if (error.response?.status === 503 || errorInfo.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429 || errorInfo.status === 429) {
      errorMessage =
        'Too many requests. Please wait a moment before trying again.';
      showRetry = true;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage =
        'Request timed out. Please check your internet connection and try again.';
      showRetry = true;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage =
        'Network error. Please check your internet connection and try again.';
      showRetry = true;
    }

    const alertButtons: any[] = [{ text: 'OK', style: 'default' as const }];
    if (showRetry) {
      alertButtons.unshift({
        text: 'Retry',
        onPress: () => handleAddParty(),
      });
    }
    showCustomAlert('Create Error', errorMessage, 'error');
  };

  const handleUpdateParty = async (
    accessToken: string,
    apiTimings?: Array<{
      name: string;
      duration: number;
      status: 'success' | 'failed' | 'skipped';
    }>,
  ) => {
    try {
      const userId = await getUserIdFromToken();
      if (!userId) {
        showCustomAlert(
          'Error',
          'User ID not found. Please login again.',
          'error',
        );
        return;
      }
      // Backend PATCH /customers/:id accepts UpdateCustomerDto fields.
      // Map to expected keys and sanitize phone to digits only.
      const isValidGstin = (value: string) =>
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value);

      const payload: any = {
        // only include if non-empty (backend validates non-empty name when present)
        ...(partyName.trim() ? { name: partyName.trim() } : {}),
        // include phone only if it matches 10-13 digits rule
        ...(() => {
          const digits = phoneNumber.trim().replace(/\D/g, '');
          return /^\d{10,13}$/.test(digits) ? { phone: digits } : {};
        })(),
        partyType: partyType === 'supplier' ? 'Supplier' : 'Customer',
        // Provide addresses array only when we have valid address or valid GSTIN
        ...(() => {
          const addr = address.trim();
          const gst = gstin.trim();
          const includeGstin = gst && isValidGstin(gst);
          if (!addr && !includeGstin) return {};
          return {
            addresses: [
              {
                type: 'billing',
                ...(addr ? { flatBuildingNumber: addr } : {}),
                ...(includeGstin ? { gstin: gst } : {}),
              },
            ],
          };
        })(),
        // Also send flat fields (backend now persists these on update)
        ...(address.trim() ? { address: address.trim() } : {}),
        // Send gstNumber as provided to persist on customer even if not a valid GSTIN
        ...(gstin.trim() ? { gstNumber: gstin.trim() } : {}),
      };
      console.log('📝 Updating party with payload:', payload);
      // Endpoint handled inside unifiedApi
      console.log('🆔 Customer Data ID:', customerData.id);
      console.log('📋 Voucher Type:', voucherType);
      console.log('💰 Opening Balance (read-only):', openingBalance);
      const response = await updatePartyWithRetry(accessToken, payload);
      const responseData = (response as any)?.data || response;
      console.log('✅ Update API Response:', responseData);

      // Also update extended info (address/GST/phone format) via add-info helper
      try {
        const addInfoPayload = {
          customerId: customerData.id,
          partyName: partyName.trim(),
          partyType: partyType === 'supplier' ? 'Supplier' : 'Customer',
          phoneNumber: phoneNumber.trim().replace(/\D/g, ''),
          address: address.trim(),
          addressLine1: address.trim(),
          gstNumber: gstin.trim() || null,
          gst: gstin.trim() || null,
          gstin: gstin.trim() || null,
          // structured address if available
          ...(address.trim() || gstin.trim()
            ? {
                addresses: [
                  {
                    type: 'billing',
                    ...(address.trim()
                      ? { flatBuildingNumber: address.trim() }
                      : {}),
                    ...(gstin.trim() ? { gstin: gstin.trim() } : {}),
                  },
                ],
              }
            : {}),
        } as any;
        const addInfoResp = (await unifiedApi.post(
          '/customers/add-info',
          addInfoPayload,
        )) as {
          data: any;
          status: number;
          headers: Headers;
        };
        // unifiedApi returns { data, status, headers } structure
        if (addInfoResp.status < 200 || addInfoResp.status >= 300) {
          console.warn(
            'Optional /customers/add-info returned',
            addInfoResp.status,
          );
        }
      } catch (e) {
        console.warn('Optional /customers/add-info failed:', e);
      }

      // Update all related vouchers/transactions with the new customer data
      try {
        console.log(
          '🔄 AddPartyScreen: Updating related vouchers/transactions for customer:',
          customerData.id,
        );
        const updatedCustomerData = {
          partyName: partyName.trim(),
          partyPhone: phoneNumber.trim().replace(/\D/g, ''),
          partyAddress: address.trim(),
        };

        // Fetch all transactions for this customer
        const transactionsResponse =
          (await unifiedApi.getTransactionsByCustomer(customerData.id, {})) as {
            data: any;
            status: number;
            headers: Headers;
          };

        const transactions =
          transactionsResponse?.data?.data || transactionsResponse?.data || [];

        if (Array.isArray(transactions) && transactions.length > 0) {
          console.log(
            `📝 AddPartyScreen: Found ${transactions.length} transactions to update`,
          );

          // Update each transaction in the background (don't block UI)
          const updatePromises = transactions.map(async (transaction: any) => {
            try {
              // Use raw data if available (original transaction data), otherwise use enriched data
              const rawTransaction = transaction._raw || transaction;

              // Only update if the transaction actually references this customer
              const transactionCustomerId =
                rawTransaction.customer_id ||
                rawTransaction.partyId ||
                rawTransaction.customerId ||
                transaction.customer_id ||
                transaction.partyId ||
                transaction.customerId;
              if (
                transactionCustomerId &&
                Number(transactionCustomerId) === Number(customerData.id)
              ) {
                const updatePayload: any = {};
                let needsUpdate = false;

                // Update partyName if it's different
                const currentPartyName =
                  rawTransaction.partyName || transaction.partyName || '';
                if (
                  currentPartyName !== updatedCustomerData.partyName &&
                  updatedCustomerData.partyName
                ) {
                  updatePayload.partyName = updatedCustomerData.partyName;
                  needsUpdate = true;
                }

                // Update partyPhone if it's different and we have a valid phone
                const currentPartyPhone =
                  rawTransaction.partyPhone || transaction.partyPhone || '';
                if (
                  updatedCustomerData.partyPhone &&
                  currentPartyPhone !== updatedCustomerData.partyPhone
                ) {
                  updatePayload.partyPhone = updatedCustomerData.partyPhone;
                  needsUpdate = true;
                }

                // Update partyAddress if it's different and we have an address
                const currentPartyAddress =
                  rawTransaction.partyAddress || transaction.partyAddress || '';
                if (
                  updatedCustomerData.partyAddress &&
                  currentPartyAddress !== updatedCustomerData.partyAddress
                ) {
                  updatePayload.partyAddress = updatedCustomerData.partyAddress;
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  // Get userId for updatedBy field
                  const userId = await getUserIdFromToken();

                  // Build complete update payload with all required fields
                  // Backend requires type and amount, so we need to include existing transaction data
                  // Prefer rawTransaction data, fallback to transaction data
                  const completeUpdatePayload: any = {
                    // Required fields from existing transaction
                    type: rawTransaction.type || transaction.type || 'credit', // Default to credit if not specified
                    amount: Number(
                      rawTransaction.amount ||
                        rawTransaction.totalAmount ||
                        transaction.amount ||
                        transaction.totalAmount ||
                        0,
                    ),
                    date:
                      rawTransaction.date ||
                      rawTransaction.transactionDate ||
                      transaction.date ||
                      transaction.transactionDate ||
                      new Date().toISOString().split('T')[0],
                    transactionDate:
                      rawTransaction.transactionDate ||
                      rawTransaction.date ||
                      transaction.transactionDate ||
                      transaction.date ||
                      new Date().toISOString().split('T')[0],
                    status:
                      rawTransaction.status || transaction.status || 'Complete',
                    // Updated party fields
                    ...updatePayload,
                    // Preserve other important fields
                    partyId:
                      rawTransaction.partyId ||
                      rawTransaction.customer_id ||
                      transaction.partyId ||
                      transaction.customer_id ||
                      customerData.id,
                    customer_id:
                      rawTransaction.customer_id ||
                      rawTransaction.partyId ||
                      transaction.customer_id ||
                      transaction.partyId ||
                      customerData.id,
                    user_id:
                      rawTransaction.user_id || transaction.user_id || userId,
                    createdBy:
                      rawTransaction.createdBy ||
                      rawTransaction.user_id ||
                      transaction.createdBy ||
                      transaction.user_id ||
                      userId,
                    updatedBy: userId,
                    // Preserve description, notes, method, category if they exist
                    description:
                      rawTransaction.description ||
                      transaction.description ||
                      '',
                    notes: rawTransaction.notes || transaction.notes || '',
                    method: rawTransaction.method || transaction.method || '',
                    category:
                      rawTransaction.category || transaction.category || '',
                  };

                  // Include items if transaction has items
                  const transactionItems =
                    rawTransaction.items ||
                    rawTransaction.transactionItems ||
                    transaction.items ||
                    transaction.transactionItems;
                  if (transactionItems && Array.isArray(transactionItems)) {
                    completeUpdatePayload.items = transactionItems;
                    completeUpdatePayload.transactionItems = transactionItems;
                    completeUpdatePayload.voucherItems = transactionItems;
                  }

                  // Include financial fields if they exist
                  if (
                    rawTransaction.gstPct !== undefined ||
                    transaction.gstPct !== undefined
                  ) {
                    completeUpdatePayload.gstPct =
                      rawTransaction.gstPct || transaction.gstPct || 0;
                  }
                  if (
                    rawTransaction.discount !== undefined ||
                    transaction.discount !== undefined
                  ) {
                    completeUpdatePayload.discount =
                      rawTransaction.discount || transaction.discount || 0;
                  }
                  if (
                    rawTransaction.subTotal !== undefined ||
                    transaction.subTotal !== undefined
                  ) {
                    completeUpdatePayload.subTotal =
                      rawTransaction.subTotal || transaction.subTotal || 0;
                  }
                  if (
                    rawTransaction.totalAmount !== undefined ||
                    transaction.totalAmount !== undefined
                  ) {
                    completeUpdatePayload.totalAmount =
                      rawTransaction.totalAmount ||
                      transaction.totalAmount ||
                      0;
                  }

                  // Include document numbers if they exist
                  if (
                    rawTransaction.invoiceNumber ||
                    transaction.invoiceNumber
                  ) {
                    completeUpdatePayload.invoiceNumber =
                      rawTransaction.invoiceNumber || transaction.invoiceNumber;
                  }
                  if (rawTransaction.billNumber || transaction.billNumber) {
                    completeUpdatePayload.billNumber =
                      rawTransaction.billNumber || transaction.billNumber;
                  }
                  if (
                    rawTransaction.receiptNumber ||
                    transaction.receiptNumber
                  ) {
                    completeUpdatePayload.receiptNumber =
                      rawTransaction.receiptNumber || transaction.receiptNumber;
                  }
                  if (
                    rawTransaction.purchaseNumber ||
                    transaction.purchaseNumber
                  ) {
                    completeUpdatePayload.purchaseNumber =
                      rawTransaction.purchaseNumber ||
                      transaction.purchaseNumber;
                  }

                  await unifiedApi.updateTransaction(
                    transaction.id,
                    completeUpdatePayload,
                  );
                  console.log(
                    `✅ AddPartyScreen: Updated transaction ${transaction.id}`,
                  );
                }
              }
            } catch (error) {
              console.error(
                `❌ AddPartyScreen: Error updating transaction ${transaction.id}:`,
                error,
              );
              // Continue with other transactions even if one fails
            }
          });

          // Wait for all updates to complete (but don't block navigation)
          Promise.all(updatePromises)
            .then(() => {
              console.log(
                '✅ AddPartyScreen: All related transactions updated successfully',
              );
            })
            .catch(error => {
              console.error(
                '❌ AddPartyScreen: Some transaction updates failed:',
                error,
              );
            });
        } else {
          console.log(
            'ℹ️ AddPartyScreen: No transactions found for this customer',
          );
        }
      } catch (error) {
        console.error(
          '❌ AddPartyScreen: Error updating related transactions:',
          error,
        );
        // Don't block the success flow if transaction update fails
      }

      // Emit profile update event to refresh user data in other screens
      console.log(
        '📢 AddPartyScreen: Emitting profile update event after party update',
      );
      profileUpdateManager.emitProfileUpdate();

      // Navigate back to Customer list and force refresh so updated details appear immediately
      showCustomAlert(
        'Success',
        'Party updated successfully!',
        'success',
        () => {
          navigation.navigate('Customer', {
            selectedTab: partyType,
            shouldRefresh: true,
          });
        },
      );
    } catch (error: any) {
      console.error('Error updating party:', error);
      handleUpdateError(error);
    }
  };

  const updatePartyWithRetry = async (
    accessToken: string,
    payload: any,
    retryCount = 0,
  ): Promise<any> => {
    const maxRetries = 3;
    const retryDelay = 1000 * (retryCount + 1);
    try {
      console.log(
        `📝 Attempting to update party (attempt ${retryCount + 1}/${
          maxRetries + 1
        })`,
      );
      const updateUrl = `/customers/${customerData.id}`;
      console.log('🔗 Update URL:', updateUrl);
      const safePayload = {
        ...payload,
      };
      console.log('🆔 Party ID:', customerData.id);
      console.log('📋 Payload:', JSON.stringify(safePayload, null, 2));
      const response = (await unifiedApi.patch(updateUrl, safePayload)) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // unifiedApi returns { data, status, headers } structure
      const responseData = response.data || response;
      console.log('✅ Party update successful:', response.status, responseData);
      return response;
    } catch (error: any) {
      console.error(`❌ Party update attempt ${retryCount + 1} failed:`, {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          data: error.config?.data,
        },
      });
      if (error.response?.status === 400) {
        const backendMsg =
          error?.response?.data?.message || error?.response?.data?.error;
        if (
          backendMsg &&
          String(backendMsg)
            .toLowerCase()
            .includes('phone number already exists')
        ) {
          throw new Error('A party with this phone number already exists');
        }
        throw new Error('Invalid data provided. Please check your inputs.');
      }
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      }
      if (error.response?.status === 403) {
        throw new Error('Permission denied. You cannot update this party.');
      }
      if (error.response?.status === 404) {
        throw new Error('Party not found. It may have been deleted.');
      }
      if (error.response?.status === 409) {
        throw new Error(
          'Party update conflicts with existing data. Please check your inputs.',
        );
      }
      if (error.response?.status === 422) {
        const validationErrors = error.response?.data?.errors || [];
        const errorMessages = validationErrors
          .map((err: any) => err.message)
          .join('\n');
        throw new Error(`Validation failed:\n${errorMessages}`);
      }
      if (
        retryCount < maxRetries &&
        (error.response?.status >= 500 ||
          error.code === 'ECONNABORTED' ||
          error.code === 'NETWORK_ERROR' ||
          !error.response)
      ) {
        console.log(
          `🔄 Retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`,
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return updatePartyWithRetry(accessToken, payload, retryCount + 1);
      }
      throw error;
    }
  };

  const handleUpdateError = async (error: any) => {
    // Import error handler
    const { handleApiError } = require('../../utils/apiErrorHandler');
    const errorInfo = handleApiError(error);

    // Handle 403 Forbidden errors with user-friendly message
    if (errorInfo.isForbidden) {
      showCustomAlert('Access Denied', errorInfo.message, 'error');
      return;
    }

    let errorMessage =
      errorInfo.message || 'Failed to update party. Please try again.';
    let showRetry = false;

    // Early exit: duplicate phone number surfaced from retry layer
    try {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('phone number already exists')) {
        setErrors(prev => ({
          ...prev,
          phoneNumber: 'This phone number is already used by another party.',
        }));
        showCustomAlert(
          'Duplicate Phone Number',
          'A party with this phone number already exists. Please use a different number.',
          'error',
        );
        return;
      }
    } catch {}

    // Check if it's specifically a transaction limit error
    if (
      error.response?.data?.message?.includes('transaction limit') ||
      error.response?.data?.message?.includes('limit exceeded') ||
      error.response?.data?.message?.includes('monthly limit') ||
      error.response?.data?.message?.includes('quota exceeded')
    ) {
      // Only trigger transaction limit popup for actual limit errors
      console.log(
        '🚫 Transaction limit error detected in update error, showing popup',
      );
      await forceShowPopup();
      return;
    }

    if (error.response?.status === 500 || errorInfo.status === 500) {
      errorMessage = `Server Error (${
        error.response?.status || errorInfo.status
      }). There was an issue on the server. Please try again in a few minutes.`;
      showRetry = true;
    } else if (error.response?.status === 503 || errorInfo.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429 || errorInfo.status === 429) {
      errorMessage =
        'Too many requests. Please wait a moment before trying again.';
      showRetry = true;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage =
        'Request timed out. Please check your internet connection and try again.';
      showRetry = true;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage =
        'Network error. Please check your internet connection and try again.';
      showRetry = true;
    }

    const alertButtons: any[] = [{ text: 'OK', style: 'default' as const }];
    if (showRetry) {
      alertButtons.unshift({
        text: 'Retry',
        onPress: () => handleAddParty(),
      });
    }
    showCustomAlert('Update Error', errorMessage, 'error');
  };

  const handleDeleteParty = async () => {
    const checkRelatedVouchers = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        if (!accessToken) return 0;
        const response = (await unifiedApi.get('/vouchers')) as {
          data: any;
          status: number;
          headers: Headers;
        };
        // unifiedApi returns { data, status, headers } structure
        const responseData = response.data || response;
        const vouchers = Array.isArray(responseData?.data)
          ? responseData.data
          : Array.isArray(responseData)
          ? responseData
          : [];
        const relatedCount = vouchers.filter(
          (voucher: any) =>
            voucher.partyName === partyName ||
            voucher.supplierName === partyName ||
            voucher.customerName === partyName,
        ).length;
        return relatedCount;
      } catch (error) {
        console.error('Error checking related vouchers:', error);
        return 0;
      }
    };

    checkRelatedVouchers().then(relatedCount => {
      let message = `Are you sure you want to delete ${partyName}?`;
      if (relatedCount > 0) {
        message += `\n\nThis will also delete ${relatedCount} related transaction${
          relatedCount > 1 ? 's' : ''
        } including all invoices, payments, and receipts. This action cannot be undone.`;
      } else {
        message += '\n\nNo related transactions found.';
      }
      showCustomAlert(
        'Delete Confirmation',
        message,
        'confirm',
        async () => {
          try {
            setDeleting(true);
            const accessToken = await AsyncStorage.getItem('accessToken');
            if (!accessToken) {
              showCustomAlert(
                'Error',
                'Authentication required. Please login again.',
                'error',
              );
              return;
            }
            await deleteRelatedVouchers(accessToken);
            await deletePartyWithRetry(accessToken);
            showCustomAlert(
              'Deleted',
              `${partyName} and all related transactions have been deleted successfully`,
              'success',
              () =>
                navigation.navigate('Customer', {
                  selectedTab: partyType,
                }),
            );
          } catch (error: any) {
            console.error('Error handling party:', error);
            handleDeleteError(error);
          } finally {
            setDeleting(false);
          }
        },
        undefined,
        'Delete',
        'Cancel',
      );
    });
  };

  const deletePartyWithRetry = async (
    accessToken: string,
    retryCount = 0,
  ): Promise<any> => {
    const maxRetries = 3;
    const retryDelay = 1000 * (retryCount + 1);
    try {
      console.log(
        `🗑️ Attempting to delete party (attempt ${retryCount + 1}/${
          maxRetries + 1
        })`,
      );
      const deleteUrl = `/customers/${customerData.id}`;
      console.log('🔗 Delete URL:', deleteUrl);
      console.log('🆔 Party ID:', customerData.id);
      console.log('📝 Party Name:', partyName);
      const response = (await unifiedApi.delete(deleteUrl)) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // unifiedApi returns { data, status, headers } structure
      const responseData = response.data || response;
      console.log(
        '✅ Party deletion successful:',
        response.status,
        responseData,
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Party deletion attempt ${retryCount + 1} failed:`, {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        },
      });
      if (error.response?.status === 404) {
        console.log('ℹ️ Party not found - may have been already deleted');
        return { status: 404, data: { message: 'Party not found' } };
      }
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      }
      if (error.response?.status === 403) {
        throw new Error('Permission denied. You cannot delete this party.');
      }
      if (error.response?.status === 409) {
        throw new Error('Party cannot be deleted due to active dependencies.');
      }
      if (
        retryCount < maxRetries &&
        (error.response?.status >= 500 ||
          error.code === 'ECONNABORTED' ||
          error.code === 'NETWORK_ERROR' ||
          !error.response)
      ) {
        console.log(
          `🔄 Retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`,
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return deletePartyWithRetry(accessToken, retryCount + 1);
      }
      throw error;
    }
  };

  const handleDeleteError = (error: any) => {
    // Import error handler
    const { handleApiError } = require('../../utils/apiErrorHandler');
    const errorInfo = handleApiError(error);

    // Handle 403 Forbidden errors with user-friendly message
    if (errorInfo.isForbidden) {
      showCustomAlert('Access Denied', errorInfo.message, 'error');
      return;
    }

    let errorMessage =
      errorInfo.message || 'Failed to delete party. Please try again.';
    let showRetry = false;
    if (error.response?.status === 500 || errorInfo.status === 500) {
      errorMessage = `Server Error (${
        error.response?.status || errorInfo.status
      }). There was an issue on the server when trying to delete the party and its related transactions. Please try again later.`;
      showRetry = true;
    } else if (error.response?.status === 503 || errorInfo.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429 || errorInfo.status === 429) {
      errorMessage =
        'Too many requests. Please wait a moment before trying again.';
      showRetry = true;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage =
        'Request timed out. Please check your internet connection and try again.';
      showRetry = true;
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage =
        'Network error. Please check your internet connection and try again.';
      showRetry = true;
    }

    const alertButtons: any[] = [{ text: 'OK', style: 'default' as const }];
    if (showRetry) {
      alertButtons.unshift({
        text: 'Retry',
        onPress: () => handleDeleteParty(),
      });
    }
    showCustomAlert('Delete Error', errorMessage, 'error');
  };

  const deleteRelatedVouchers = async (accessToken: string) => {
    try {
      console.log('🗑️ Deleting related transactions for customer:', partyName);
      const listResp = (await unifiedApi.get(
        `/transactions?customer_id=${customerData?.id}`,
      )) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // unifiedApi returns { data, status, headers } structure
      const responseData = listResp.data || listResp;
      const transactions = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : [];
      console.log(
        '📊 Total transactions found for customer:',
        transactions.length,
      );
      if (transactions.length === 0) {
        console.log('ℹ️ No related transactions found for deletion');
        return;
      }
      const deletePromises = transactions.map(async (t: any, index: number) => {
        try {
          console.log(
            `🗑️ Deleting transaction ${index + 1}/${transactions.length}: ID ${
              t.id
            }, Type ${t.type}`,
          );
          await unifiedApi.delete(`/transactions/${t.id}`);
          console.log(`✅ Transaction ${t.id} deleted successfully.`);
          return { success: true, id: t.id };
        } catch (txnError: any) {
          console.error(`❌ Failed to delete transaction ${t.id}:`, txnError);
          return { success: false, id: t.id, error: txnError };
        }
      });
      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(
        result =>
          result.status === 'fulfilled' &&
          (result as PromiseFulfilledResult<any>).value?.success,
      ).length;
      const failed = results.filter(
        result =>
          result.status === 'fulfilled' &&
          !(result as PromiseFulfilledResult<any>).value?.success,
      ).length;
      console.log('📊 Transaction deletion results:', {
        successful,
        failed,
        total: transactions.length,
      });
      if (failed > 0) {
        showCustomAlert(
          'Warning',
          `Failed to delete ${failed} of ${transactions.length} related transactions. The party will still be deleted, but you may need to manually clean up these transactions.`,
          'warning',
        );
      }
      console.log('✅ Related transactions deletion completed');
    } catch (error: any) {
      console.error('❌ Error deleting related transactions:', error);
      showCustomAlert(
        'Warning',
        'Could not check for related transactions. The party will still be deleted. You may need to manually clean up transactions later.',
        'warning',
      );
    }
  };

  const renderRadioButton = (
    value: 'customer' | 'supplier',
    label: string,
    isSelected: boolean,
    iconName: string,
  ) => (
    <TouchableOpacity
      style={[styles.radioCard, isSelected ? styles.radioCardSelected : {}]}
      onPress={() => setPartyType(value)}
    >
      <View
        style={[
          styles.radioButton,
          isSelected ? styles.radioButtonSelected : {},
        ]}
      >
        {isSelected ? <View style={styles.radioButtonInner} /> : null}
      </View>
      <MaterialCommunityIcons
        name={iconName as any}
        size={20}
        color={isSelected ? '#4f8cff' : '#64748b'}
        style={styles.radioIcon}
      />
      <Text
        style={[styles.radioLabel, isSelected ? styles.radioLabelSelected : {}]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderInputField = (
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    error?: string,
    multiline: boolean = false,
    keyboardType: 'default' | 'phone-pad' | 'numeric' = 'default',
    prefix?: string,
    inputRef?: React.RefObject<TextInput | null>,
  ) => (
    <View style={styles.inputContainer}>
      <View style={styles.inputWrapper}>
        {prefix && (
          <View style={styles.inputPrefix}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        )}
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            multiline && styles.textInputMultiline,
            error && styles.textInputError,
            prefix && styles.textInputWithPrefix,
          ]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#666666"
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          keyboardType={keyboardType}
          onFocus={() => {
            if (inputRef) {
              console.log('🔍 Input focused, centering...');
              scrollToInputCenter(inputRef);
            }
          }}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  const renderAmountInput = (
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    error?: string,
    inputRef?: React.RefObject<TextInput | null>,
  ) => (
    <View style={styles.inputContainer}>
      <View
        style={[
          styles.amountInputWrapper,
          error ? styles.amountInputWrapperError : {},
        ]}
      >
        <View
          style={[styles.amountPrefix, error ? styles.amountPrefixError : {}]}
        >
          <Text style={styles.amountPrefixText}>₹</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={[styles.amountInput, error ? styles.amountInputError : {}]}
          placeholder="Enter amount (optional, +/-)"
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#666666"
          keyboardType="numeric"
          onFocus={() => {
            if (inputRef) {
              console.log('🔍 Amount input focused, centering...');
              scrollToInputCenter(inputRef);
            }
          }}
        />
        <TouchableOpacity
          style={[
            styles.voucherTypeButton,
            voucherType === 'receipt' ? styles.voucherTypeButtonReceipt : {},
            error ? styles.voucherTypeButtonError : {},
          ]}
          onPress={() =>
            setVoucherType(voucherType === 'payment' ? 'receipt' : 'payment')
          }
        >
          <MaterialCommunityIcons
            name={voucherType === 'payment' ? 'trending-down' : 'trending-up'}
            size={16}
            color={voucherType === 'payment' ? '#dc3545' : '#28a745'}
          />
          <Text
            style={[
              styles.voucherTypeText,
              voucherType === 'receipt' ? styles.voucherTypeTextReceipt : {},
            ]}
          >
            {voucherType === 'payment' ? 'Payment' : 'Receipt'}
          </Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View
        style={[
          styles.header,
          getSolidHeaderStyle(preciseStatusBarHeight || statusBarSpacer.height),
        ]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <TouchableOpacity
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            console.log(
              '🔄 AddPartyScreen: Back button pressed, navigating back with refresh',
            );
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Party' : 'Add Party'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Subscription Error Banner */}
      {subscriptionError && (
        <View style={styles.subscriptionErrorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#fff" />
          <Text style={styles.subscriptionErrorText}>{subscriptionError}</Text>
          <TouchableOpacity
            onPress={() => setSubscriptionError(null)}
            style={styles.dismissButton}
          >
            <MaterialCommunityIcons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={100}
        enableAutomaticScroll={true}
        enableResetScrollToCoords={false}
        keyboardOpeningTime={0}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        bounces={true}
        scrollEventThrottle={16}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Party Name<Text style={styles.required}> *</Text>
          </Text>
          {renderInputField(
            'Party Name',
            partyName,
            handlePartyNameChange,
            errors.partyName,
            false,
            'default',
            undefined,
            partyNameRef,
          )}
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Phone Number<Text style={styles.required}> *</Text>
          </Text>
          <View style={styles.phoneContainer}>
            <View style={styles.flagContainer}>
              <Text style={styles.flagEmoji}>🇮🇳</Text>
              <Text style={styles.countryCode}>+91</Text>
            </View>
            <View style={styles.phoneInputContainer}>
              <TextInput
                ref={phoneNumberRef}
                style={[
                  styles.phoneInput,
                  errors.phoneNumber ? styles.phoneInputError : {},
                ]}
                placeholder="Enter phone number"
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                keyboardType="phone-pad"
                placeholderTextColor="#666666"
                maxLength={10}
                onFocus={() => {
                  console.log('🔍 Phone number input focused, centering...');
                  scrollToInputCenter(phoneNumberRef);
                }}
              />
              {errors.phoneNumber ? (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.partyTypeContainer}>
          <Text style={styles.sectionLabel}>Who are they?</Text>
          <View style={styles.radioGroup}>
            {renderRadioButton(
              'customer',
              'Customer',
              partyType === 'customer',
              'account',
            )}
            {renderRadioButton(
              'supplier',
              'Supplier',
              partyType === 'supplier',
              'truck-delivery',
            )}
          </View>

          {/* Permission Status Indicator */}
          {rbacBlockedMsg && (
            <View style={styles.permissionWarning}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color="#ff9800"
              />
              <Text style={styles.permissionWarningText}>{rbacBlockedMsg}</Text>
            </View>
          )}
        </View>

        {/* Opening Balance - Show for reference but not sent to backend */}
        {!isEditMode ? (
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { marginTop: 6 }]}>
              Opening Balance (Optional)
            </Text>
            {renderAmountInput(
              'Enter amount (optional, +/-)',
              openingBalance,
              handleOpeningBalanceChange,
              errors.openingBalance,
              openingBalanceRef,
            )}
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>GSTIN (Optional)</Text>
          {renderInputField(
            '27AAAPA1234A1Z5',
            gstin,
            setGstin,
            undefined,
            false,
            'default',
            undefined,
            gstinRef,
          )}
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            Address<Text style={styles.required}> *</Text>
          </Text>
          {renderInputField(
            'Address',
            address,
            handleAddressChange,
            errors.address,
            true,
            'default',
            undefined,
            addressRef,
          )}
        </View>

        {/* Attach Document Section */}
        <View style={styles.inputContainer}>
          <AttachDocument
            attachedDocument={attachedDocument}
            onDocumentAttached={document => {
              console.log('📎 Document attached:', document);
              setAttachedDocument(document);
            }}
            onDocumentRemoved={() => {
              console.log('📎 Document removed');
              setAttachedDocument(null);
            }}
            label="Attach Document (Optional)"
            required={false}
          />
        </View>
      </KeyboardAwareScrollView>

      <View style={styles.buttonContainer}>
        {isEditMode ? (
          <View style={styles.editButtonContainer}>
            <TouchableOpacity
              style={[
                styles.updateButton,
                loading ? styles.buttonDisabled : {},
              ]}
              onPress={handleAddParty}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.updateButtonText}>
                  UPDATE {partyType.toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                loading || deleting ? styles.buttonDisabled : {},
              ]}
              onPress={handleDeleteParty}
              disabled={loading || deleting}
              testID="delete-button"
            >
              {deleting ? (
                <ActivityIndicator
                  size="small"
                  color="#fff"
                  testID="delete-loading"
                />
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
            style={[styles.addButton, loading ? styles.buttonDisabled : {}]}
            onPress={handleAddParty}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>
                ADD {partyType.toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Alert Modal */}
      {customAlert.visible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <View
              style={[
                styles.alertIconContainer,
                {
                  backgroundColor:
                    customAlert.type === 'success'
                      ? '#e8f5e8'
                      : customAlert.type === 'error'
                      ? '#fdeaea'
                      : customAlert.type === 'warning'
                      ? '#fff8e1'
                      : customAlert.type === 'confirm'
                      ? '#e1f5fe'
                      : '#f0f6ff',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  customAlert.type === 'success'
                    ? 'check-circle'
                    : customAlert.type === 'error'
                    ? 'close-circle'
                    : customAlert.type === 'warning'
                    ? 'alert-circle'
                    : customAlert.type === 'confirm'
                    ? 'help-circle'
                    : 'information'
                }
                size={40}
                color={
                  customAlert.type === 'success'
                    ? '#28a745'
                    : customAlert.type === 'error'
                    ? '#dc3545'
                    : customAlert.type === 'warning'
                    ? '#ff9800'
                    : customAlert.type === 'confirm'
                    ? '#2196f3'
                    : '#4f8cff'
                }
              />
            </View>

            {/* Alert Title */}
            <Text style={styles.alertTitle}>{customAlert.title}</Text>

            {/* Alert Message */}
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            {/* Alert Buttons */}
            <View style={styles.alertButtons}>
              {customAlert.type === 'confirm' && (
                <TouchableOpacity
                  style={styles.alertButtonCancel}
                  onPress={() => {
                    customAlert.onCancel?.();
                    hideCustomAlert();
                  }}
                >
                  <Text style={styles.alertButtonCancelText}>
                    {customAlert.cancelText}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.alertButtonConfirm,
                  {
                    backgroundColor:
                      customAlert.type === 'success'
                        ? '#28a745'
                        : customAlert.type === 'error'
                        ? '#dc3545'
                        : customAlert.type === 'warning'
                        ? '#ff9800'
                        : customAlert.type === 'confirm'
                        ? '#2196f3'
                        : '#4f8cff',
                  },
                ]}
                onPress={() => {
                  customAlert.onConfirm?.();
                  hideCustomAlert();
                }}
              >
                <Text style={styles.alertButtonConfirmText}>
                  {customAlert.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: uiColors.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 30,
  },
  headerBackButton: {
    padding: 10,
    borderRadius: 20,
  },
  headerTitle: {
    color: uiColors.textHeader,
    fontSize: 19,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    fontFamily: uiFonts.family,
  },

  headerRight: {
    width: 44,
  },
  subscriptionErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiColors.errorRed,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  subscriptionErrorText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,

    fontFamily: 'Roboto-Medium',
  },

  dismissButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  scrollContentContainer: {
    paddingBottom: 80,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPrefix: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: '#e0e0e0',
  },
  prefixText: {
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  textInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  textInputWithPrefix: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  textInputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,

    fontFamily: 'Roboto-Medium',
  },

  phoneContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCode: {
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  phoneInputContainer: {
    flex: 1,
  },
  phoneInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  phoneInputError: {
    borderColor: '#dc3545',
  },
  partyTypeContainer: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 10,
    marginTop: 6,

    fontFamily: 'Roboto-Medium',
  },

  radioGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  radioCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  radioCardSelected: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#4f8cff',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  radioIcon: {
    marginLeft: 4,
  },
  radioLabel: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },

  radioLabelSelected: {
    color: '#4f8cff',

    fontFamily: 'Roboto-Medium',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#ffcc02',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8,
  },
  permissionWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#e65100',
    lineHeight: 16,

    fontFamily: 'Roboto-Medium',
  },

  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'stretch',
  },
  addButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  addButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    fontFamily: uiFonts.family,
    fontWeight: '700',
  },

  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  amountInputWrapperError: {
    borderColor: '#dc3545',
  },
  amountPrefix: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  amountPrefixError: {
    borderRightColor: '#dc3545',
  },
  amountPrefixText: {
    fontSize: 16,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  amountInput: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',

    fontFamily: 'Roboto-Medium',
  },

  amountInputError: {
    borderColor: '#dc3545',
  },
  voucherTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  voucherTypeButtonReceipt: {
    backgroundColor: '#e0f2fe',
    borderLeftColor: '#4f8cff',
  },
  voucherTypeButtonError: {
    backgroundColor: '#fde6e6',
    borderLeftColor: '#dc3545',
  },
  voucherTypeText: {
    fontSize: 15,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  voucherTypeTextReceipt: {
    color: '#28a745',

    fontFamily: 'Roboto-Medium',
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    gap: 4.5,
    minWidth: 52.5,
    justifyContent: 'center',
  },
  flagEmoji: {
    fontSize: 16,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  editButtonContainer: {
    flexDirection: 'row',
    gap: 9,
    width: '100%',
  },
  updateButton: {
    flex: 2,
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  updateButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    fontFamily: uiFonts.family,
    fontWeight: '700',
  },

  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 6,
    gap: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    fontWeight: '700',
  },

  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  notSupportedNote: {
    fontSize: 12,
    color: '#666666',
    marginTop: 3,
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  required: {
    color: '#dc3545',

    fontFamily: 'Roboto-Medium',
  },

  // Custom Alert Styles
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 20,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 0,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    fontFamily: 'Roboto-Medium',
  },

  alertMessage: {
    fontSize: 15,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
    fontFamily: 'Roboto-Medium',
  },

  alertButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  alertButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  alertButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },

  alertButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },
});

export default AddPartyScreen;
