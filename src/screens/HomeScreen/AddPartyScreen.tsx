import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import axios from 'axios';
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserIdFromToken } from '../../utils/storage';
import AttachDocument from '../../components/AttachDocument';
import { useTransactionLimit } from '../../context/TransactionLimitContext';

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
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AddParty'>>();
  const params = route.params as AddPartyScreenParams;
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  const isEditMode = params?.editMode || false;
  const customerData = params?.customerData;

  const [partyName, setPartyName] = useState(
    isEditMode ? customerData?.name || '' : params?.contactData?.name || '',
  );
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState(
    isEditMode
      ? (customerData?.phoneNumber || '').replace(/^\+91-?/, '')
      : params?.contactData?.phoneNumber || '',
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
    isEditMode ? customerData?.address || '' : '',
  );
  const [voucherType, setVoucherType] = useState<'payment' | 'receipt'>(
    isEditMode ? customerData?.voucherType || 'payment' : 'payment',
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
    } else if (phoneNumber.trim().length < 10) {
      newErrors.phoneNumber = 'Phone number must be at least 10 digits';
    } else if (!/^\d+$/.test(phoneNumber.trim())) {
      newErrors.phoneNumber = 'Phone number must contain only digits';
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
    return Object.keys(newErrors).length === 0;
  };

  const handleAddParty = async () => {
    setErrors({});
    console.log('🔍 Starting party creation/update process...');
    console.log('📋 Current form state:', {
      partyName,
      phoneNumber,
      address,
      partyType,
      voucherType,
      openingBalance,
    });
    console.log('🔗 BASE_URL:', BASE_URL);

    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }
    console.log('✅ Form validation passed');
    try {
      setLoading(true);

      // Check transaction limit before API call
      await forceCheckTransactionLimit();

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        showCustomAlert(
          'Error',
          'Authentication required. Please login again.',
          'error',
        );
        return;
      }

      console.log('🔑 Access Token exists:', !!accessToken);
      console.log(
        '🔑 Access Token preview:',
        accessToken ? `${accessToken.substring(0, 20)}...` : 'None',
      );
      if (isEditMode) {
        console.log('🔄 Edit mode detected, calling handleUpdateParty');
        await handleUpdateParty(accessToken);
      } else {
        console.log('🆕 Create mode detected, calling handleCreateParty');
        await handleCreateParty(accessToken);
      }
    } catch (error: any) {
      console.error('Error handling party:', error);
      let errorMessage = isEditMode
        ? 'Failed to update party. Please try again.'
        : 'Failed to add party. Please try again.';

      try {
        if (error.response?.data?.message) {
          const message = error.response.data.message;
          if (Array.isArray(message)) {
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

  const handleCreateParty = async (accessToken: string) => {
    console.log('🚀 handleCreateParty function entered');
    try {
      const basicPayload = {
        partyName: partyName.trim(),
        partyType: partyType,
        phoneNumber: `${countryCode}-${phoneNumber.trim()}`,
        address: address.trim(),
        gstNumber: gstin.trim() || null,
        voucherType: voucherType,
        // openingBalance removed - backend doesn't accept it even for new customers
      };

      console.log(
        '➕ Creating basic customer record with payload:',
        basicPayload,
      );
      console.log('🔗 API Endpoint:', `${BASE_URL}/customers`);

      const createResponse = await axios.post(
        `${BASE_URL}/customers`,
        basicPayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      console.log('✅ Basic customer created:', createResponse.data);

      const customerId = createResponse.data.id;
      console.log('🆔 Customer ID received:', customerId);
      if (!customerId) {
        throw new Error('Failed to get customer ID from creation response');
      }

      const updatePayload = {
        customerId: customerId,
        partyName: partyName.trim(),
        partyType: partyType,
        phoneNumber: `${countryCode}-${phoneNumber.trim()}`,
        address: address.trim(),
        gstNumber: gstin.trim() || null,
        voucherType: voucherType,
        // openingBalance removed - backend doesn't accept it
      };

      console.log('📝 Updating customer info with payload:', updatePayload);
      console.log('🔗 API Endpoint:', `${BASE_URL}/customers/add-info`);

      const updateResponse = await axios.post(
        `${BASE_URL}/customers/add-info`,
        updatePayload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      console.log('✅ Customer info updated:', updateResponse.data);

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
        await createOpeningBalanceVoucher(accessToken, customerId);
        console.log('✅ createOpeningBalanceVoucher completed');
      } else {
        console.log('ℹ️ No opening balance entered, skipping voucher creation');
      }

      console.log('🧭 Navigating to Customer screen...');
      navigation.navigate('Customer', {
        selectedTab: partyType,
        shouldRefresh: true, // Tell the CustomerScreen to refresh data
      });
    } catch (error: any) {
      console.error('Error creating party:', error);
      handleCreateError(error);
    }
  };

  const createOpeningBalanceVoucher = async (
    accessToken: string,
    customerId: string,
  ) => {
    console.log('🚀 Starting opening balance voucher creation...');
    try {
      const userId = await getUserIdFromToken();
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

      // Use the user's selected voucher type from the button
      const voucherTypeForVoucher = voucherType;

      // Validate customerId
      const customerIdNumber = parseInt(customerId);
      if (isNaN(customerIdNumber)) {
        console.error('❌ Invalid customerId:', customerId);
        return;
      }

      const voucherPayload = {
        user_id: userId, // userId is already a number
        customerId: customerIdNumber, // Add customerId for relationship
        type: voucherTypeForVoucher,
        amount: Math.abs(amount).toFixed(2), // Backend expects string
        date: new Date().toISOString(),
        status: 'complete',
        description: 'Opening Balance',
        notes: `Opening balance for ${partyType} ${partyName.trim()}`,
        partyName: partyName.trim(),
        partyPhone: phoneNumber.trim(), // Send only the phone number without country code
        partyAddress: address.trim(),
        billNumber: '', // Opening Balance
        invoiceNumber: '',
        receiptNumber: '',
        method: 'Opening Balance',
        gstNumber: gstin.trim() || '',
        items: [], // Backend expects JSON array
        createdBy: userId,
        updatedBy: userId,
      };

      console.log('💰 Creating opening balance voucher:', voucherPayload);
      console.log('📋 Voucher payload details:', {
        user_id: voucherPayload.user_id,
        customerId: voucherPayload.customerId,
        type: voucherPayload.type,
        amount: voucherPayload.amount,
        partyName: voucherPayload.partyName,
        partyPhone: voucherPayload.partyPhone,
      });
      const voucherUrl = `${BASE_URL}/vouchers`;
      console.log('🔗 API Endpoint:', voucherUrl);
      console.log('📤 Sending POST request to vouchers API...');
      console.log('🔑 Auth headers:', {
        Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
        'Content-Type': 'application/json',
      });

      const voucherResponse = await axios.post(voucherUrl, voucherPayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
      console.log('📥 Voucher API response received:', voucherResponse.status);

      console.log(
        '✅ Opening balance voucher created successfully:',
        voucherResponse.data,
      );
      console.log(
        '💰 Voucher created for amount:',
        openingBalance,
        'Type:',
        voucherTypeForVoucher,
      );
      console.log('🎉 Voucher creation completed successfully!');

      // Check transaction limit after successful voucher creation
      try {
        console.log('🔍 Checking transaction limit after voucher creation...');
        await forceCheckTransactionLimit();
      } catch (limitError) {
        console.error('❌ Error checking transaction limit:', limitError);
        // Don't fail the party creation if limit check fails
      }
    } catch (error: any) {
      console.error('❌ Error creating opening balance voucher:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        statusText: error.response?.statusText,
      });

      // Check if it's a transaction limit error
      if (
        error.response?.data?.message?.includes('transaction limit') ||
        error.response?.data?.message?.includes('limit exceeded') ||
        error.response?.data?.message?.includes('Internal server error')
      ) {
        // Trigger transaction limit popup
        await forceShowPopup();
        return;
      }

      // Don't fail the entire party creation if voucher creation fails
      // Just log the error and continue
    }
  };

  const handleCreateError = async (error: any) => {
    let errorMessage = 'Failed to create party. Please try again.';
    let showRetry = false;

    // Check if it's a transaction limit error
    if (
      error.response?.data?.message?.includes('transaction limit') ||
      error.response?.data?.message?.includes('limit exceeded') ||
      error.response?.data?.message?.includes('Internal server error')
    ) {
      // Trigger transaction limit popup
      await forceShowPopup();
      return;
    }

    if (error.response?.status === 500) {
      errorMessage =
        'Server error occurred. This might be a temporary issue. Please try again in a few minutes.';
      showRetry = true;
    } else if (error.response?.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429) {
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
    } else if (error.response?.data?.message) {
      const message = error.response.data.message;
      if (Array.isArray(message)) {
        errorMessage = message.join(', ');
      } else if (typeof message === 'object') {
        errorMessage = JSON.stringify(message);
      } else {
        errorMessage = String(message);
      }
    } else if (error.message) {
      errorMessage = String(error.message);
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

  const handleUpdateParty = async (accessToken: string) => {
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
      const payload = {
        partyName: partyName.trim(),
        phoneNumber: `${countryCode}-${phoneNumber.trim()}`,
        partyType: partyType,
        gstNumber: gstin.trim() || null,
        address: address.trim(),
        voucherType: voucherType,
        // openingBalance is removed - backend UpdateCustomerDto doesn't allow it
      };
      console.log('📝 Updating party with payload:', payload);
      console.log(
        '🔗 API Endpoint:',
        `${BASE_URL}/customers/${customerData.id}`,
      );
      console.log('🆔 Customer Data ID:', customerData.id);
      console.log('📋 Voucher Type:', voucherType);
      console.log('💰 Opening Balance (read-only):', openingBalance);
      if (!payload.partyName || !payload.phoneNumber || !payload.address) {
        throw new Error('Required fields are missing');
      }
      if (
        !payload.voucherType ||
        !['payment', 'receipt'].includes(payload.voucherType)
      ) {
        console.warn(
          'Invalid voucher type, using default:',
          payload.voucherType,
        );
        payload.voucherType = 'payment';
      }
      const response = await updatePartyWithRetry(accessToken, payload);
      console.log('✅ Update API Response:', response.data);
      showCustomAlert(
        'Success',
        'Party updated successfully!',
        'success',
        () => {
          navigation.goBack();
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
      const updateUrl = `${BASE_URL}/customers/${customerData.id}`;
      console.log('🔗 Update URL:', updateUrl);
      console.log('🔑 Headers:', {
        Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
      });
      const safePayload = {
        ...payload,
      };
      console.log('🆔 Party ID:', customerData.id);
      console.log('📋 Payload:', JSON.stringify(safePayload, null, 2));
      const response = await axios.patch(updateUrl, safePayload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
        validateStatus: status => {
          return status >= 200 && status < 300;
        },
      });
      console.log(
        '✅ Party update successful:',
        response.status,
        response.data,
      );
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
    let errorMessage = 'Failed to update party. Please try again.';
    let showRetry = false;

    // Check if it's a transaction limit error
    if (
      error.response?.data?.message?.includes('transaction limit') ||
      error.response?.data?.message?.includes('limit exceeded') ||
      error.response?.data?.message?.includes('Internal server error')
    ) {
      // Trigger transaction limit popup
      await forceShowPopup();
      return;
    }

    if (error.response?.status === 500) {
      errorMessage = `Server Error (${error.response.status}). There was an issue on the server. Please try again in a few minutes.`;
      showRetry = true;
    } else if (error.response?.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429) {
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
    } else if (error.response?.data?.message) {
      const message = error.response.data.message;
      if (Array.isArray(message)) {
        errorMessage = message.join(', ');
      } else if (typeof message === 'object') {
        errorMessage = JSON.stringify(message);
      } else {
        errorMessage = String(message);
      }
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
        const response = await axios.get(`${BASE_URL}/vouchers`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });
        const vouchers = response.data?.data || [];
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
      const deleteUrl = `${BASE_URL}/customers/${customerData.id}`;
      console.log('🔗 Delete URL:', deleteUrl);
      console.log('🔑 Headers:', {
        Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
      });
      console.log('🆔 Party ID:', customerData.id);
      console.log('📝 Party Name:', partyName);
      const response = await axios.delete(deleteUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
        validateStatus: status => {
          return (status >= 200 && status < 300) || status === 404;
        },
      });
      console.log(
        '✅ Party deletion successful:',
        response.status,
        response.data,
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
    let errorMessage = 'Failed to delete party. Please try again.';
    let showRetry = false;
    if (error.response?.status === 500) {
      errorMessage = `Server Error (${error.response.status}). There was an issue on the server when trying to delete the party and its related transactions. Please try again later.`;
      showRetry = true;
    } else if (error.response?.status === 503) {
      errorMessage = 'Service temporarily unavailable. Please try again later.';
      showRetry = true;
    } else if (error.response?.status === 429) {
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
    } else if (error.response?.data?.message) {
      const message = error.response.data.message;
      if (Array.isArray(message)) {
        errorMessage = message.join(', ');
      } else if (typeof message === 'object') {
        errorMessage = JSON.stringify(message);
      } else {
        errorMessage = String(message);
      }
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
      console.log('🗑️ Deleting related vouchers for party:', partyName);
      const response = await axios.get(`${BASE_URL}/vouchers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const vouchers = response.data?.data || [];
      console.log('📊 Total vouchers found:', vouchers.length);
      const relatedVouchers = vouchers.filter((voucher: any) => {
        return (
          voucher.partyName === partyName ||
          voucher.supplierName === partyName ||
          voucher.customerName === partyName
        );
      });
      console.log('🔗 Related vouchers found:', relatedVouchers.length);
      if (relatedVouchers.length === 0) {
        console.log('ℹ️ No related vouchers found for deletion');
        return;
      }
      const deletePromises = relatedVouchers.map(
        async (voucher: any, index: number) => {
          try {
            console.log(
              `🗑️ Deleting voucher ${index + 1}/${relatedVouchers.length}: ID ${
                voucher.id
              }, Type ${voucher.type}`,
            );
            await axios.delete(`${BASE_URL}/vouchers/${voucher.id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            console.log(`✅ Voucher ${voucher.id} deleted successfully.`);
            return { success: true, id: voucher.id };
          } catch (voucherError: any) {
            console.error(
              `❌ Failed to delete voucher ${voucher.id}:`,
              voucherError,
            );
            return { success: false, id: voucher.id, error: voucherError };
          }
        },
      );
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
      console.log('📊 Voucher deletion results:', {
        successful,
        failed,
        total: relatedVouchers.length,
      });
      if (failed > 0) {
        showCustomAlert(
          'Warning',
          `Failed to delete ${failed} of ${relatedVouchers.length} related transactions. The party will still be deleted, but you may need to manually clean up these transactions.`,
          'warning',
        );
      }
      console.log('✅ Related vouchers deletion completed');
    } catch (error: any) {
      console.error('❌ Error deleting related vouchers:', error);
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
          placeholderTextColor="#666"
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
          placeholderTextColor="#666"
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4f8cff" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log(
              '🔄 AddPartyScreen: Back button pressed, navigating back with refresh',
            );
            navigation.goBack();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Party' : 'Add Party'}
        </Text>
        <View style={styles.headerRight} />
      </View>
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
          <Text style={styles.inputLabel}>Party Name *</Text>
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
          <Text style={styles.inputLabel}>Phone Number *</Text>
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
                placeholderTextColor="#999"
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
        </View>

        {/* Opening Balance - Show for reference but not sent to backend */}
        {!isEditMode ? (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Opening Balance (Optional)</Text>
            {renderAmountInput(
              'Enter amount (optional, +/-)',
              openingBalance,
              handleOpeningBalanceChange,
              errors.openingBalance,
              openingBalanceRef,
            )}
          </View>
        ) : null}

        {renderInputField(
          'GSTIN (Optional)',
          gstin,
          setGstin,
          undefined,
          false,
          'default',
          undefined,
          gstinRef,
        )}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Address *</Text>
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
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 24,
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
    marginBottom: 16,
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
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '500',
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
    fontSize: 10,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  phoneContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
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
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '500',
  },
  phoneInputError: {
    borderColor: '#dc3545',
  },
  partyTypeContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#4f8cff',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  radioIcon: {
    marginLeft: 4,
  },
  radioLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  radioLabelSelected: {
    color: '#4f8cff',
    fontWeight: '600',
  },
  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  addButton: {
    backgroundColor: '#4f8cff',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 12,
    color: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    fontWeight: '500',
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
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '500',
  },
  voucherTypeTextReceipt: {
    color: '#28a745',
  },
  inputLabel: {
    fontSize: 12,
    color: '#1e293b',
    marginBottom: 8,
    fontWeight: '600',
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
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  editButtonContainer: {
    flexDirection: 'row',
    gap: 9,
  },
  updateButton: {
    flex: 2,
    backgroundColor: '#4f8cff',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  notSupportedNote: {
    fontSize: 9,
    color: '#888',
    marginTop: 3,
    marginBottom: 6,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    letterSpacing: 0.3,
  },
  alertButtonConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

export default AddPartyScreen;
