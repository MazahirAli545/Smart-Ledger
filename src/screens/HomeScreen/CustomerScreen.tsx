import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Modal,
  Animated,
  RefreshControl,
} from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
  DrawerActions,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { Dropdown } from 'react-native-element-dropdown';
import {
  businessTypes,
  businessSizes,
  industries,
  transactionVolumes,
} from '../../utils/dropdownOptions';

const { width } = Dimensions.get('window');

// 🎯 FIXED: Enhanced global cache with refresh state tracking
let globalCustomerCache: any = {
  customers: [],
  vouchers: [],
  userData: null,
  lastUpdated: 0,
  activeTab: null,
  isRefreshing: false, // Track if refresh is in progress
  isInitializing: false, // Track if initial data fetch is in progress
  isComponentInitialized: false, // Track if component has been initialized
  lastNavigationTime: 0, // Track when user navigated away
};
let globalCustomerCacheChecked = false;

// Cache TTL: 30 seconds (30,000 ms) - reduced for more responsive updates
const CACHE_TTL = 30 * 1000;

// 🎯 FIXED: Enhanced cache clearing with refresh state reset
export const clearCustomerCache = () => {
  globalCustomerCache = {
    customers: [],
    vouchers: [],
    userData: null,
    lastUpdated: 0,
    activeTab: null,
    isRefreshing: false,
    isInitializing: false,
    isComponentInitialized: false,
    lastNavigationTime: 0,
  };
  globalCustomerCacheChecked = false;
};

// Function to force refresh customer data
export const forceRefreshCustomerData = () => {
  clearCustomerCache();
  return true;
};

// Function to refresh customer data when returning from Add Customer/Supplier screens
export const refreshCustomerDataOnReturn = () => {
  console.log('🔄 CustomerScreen: External refresh triggered');
  clearCustomerCache();
  // This will be handled by the focus listeners
  return true;
};

// Function to refresh specific data types
export const refreshCustomerData = async (
  dataType: 'customers' | 'userData' | 'all' = 'all',
) => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) return false;

    if (dataType === 'customers' || dataType === 'all') {
      const customersResult = await fetch(`${BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(res => res.json());

      if (customersResult) {
        globalCustomerCache.customers = customersResult;
        globalCustomerCache.lastUpdated = Date.now();
      }
    }

    if (dataType === 'userData' || dataType === 'all') {
      const userId = await getUserIdFromToken();
      if (userId) {
        const userDataResult = await fetch(`${BASE_URL}/user/${userId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then(res => res.json());

        if (userDataResult?.data) {
          globalCustomerCache.userData = userDataResult.data;
          globalCustomerCache.lastUpdated = Date.now();
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error refreshing customer data:', error);
    return false;
  }
};

// Function to check if cache is still valid
const isCacheValid = (activeTab: string) => {
  const now = Date.now();
  return (
    globalCustomerCache.lastUpdated > 0 &&
    now - globalCustomerCache.lastUpdated < CACHE_TTL &&
    globalCustomerCache.activeTab === activeTab
  );
};

interface Customer {
  id: string;
  name: string;
  location: string;
  lastInteraction: string;
  amount: number;
  type: 'give' | 'get'; // whether you'll give or get money
  avatar: string;
  phoneNumber?: string;
  gstNumber?: string;
  address?: string;
  openingBalance?: number;
  partyType?: string; // 'customer' or 'supplier'
}

// Enhanced FilterOptions interface
interface FilterOptions {
  sortBy: 'name' | 'amount' | 'date' | 'location';
  sortOrder: 'asc' | 'desc';
  amountRange: 'all' | '0-1000' | '1000-5000' | '5000-10000' | '10000+';
  type: 'all' | 'give' | 'get';
  location: string;
  hasPhone: 'all' | 'yes' | 'no';
  hasGST: 'all' | 'yes' | 'no';
}

const CustomerScreen: React.FC = () => {
  // Screen tracking hook
  useScreenTracking();

  // Error boundary state
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Global error handler for any uncaught errors
  const handleError = (error: any) => {
    console.error('CustomerScreen Error:', error);
    setHasError(true);
    setErrorDetails(error?.message || 'Unknown error occurred');
  };

  // Set up global error handling
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Check if it's a React Native rendering error
      if (
        args[0] &&
        typeof args[0] === 'string' &&
        args[0].includes(
          'Text strings must be rendered within a <Text> component',
        )
      ) {
        handleError(new Error('Text rendering error detected'));
      }
      // Call original console.error
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Enhanced SafeText component with strict validation
  const SafeText = ({ children, style, ...props }: any) => {
    try {
      // Handle null, undefined, false, empty string, and other falsy values
      if (children === null || children === undefined || children === false) {
        return null; // Don't render anything for falsy values
      }

      // Handle empty strings
      if (children === '') {
        return null; // Don't render empty strings
      }

      // Handle strings and numbers
      if (typeof children === 'string' || typeof children === 'number') {
        // Ensure the string is not just whitespace
        if (typeof children === 'string' && children.trim() === '') {
          return null;
        }
        return (
          <Text style={style} {...props}>
            {children}
          </Text>
        );
      }

      // If it's already a React element, return it directly
      if (React.isValidElement(children)) {
        return children;
      }

      // For any other type, don't render
      console.warn(
        'SafeText: Invalid children type:',
        typeof children,
        children,
      );
      return null;
    } catch (error) {
      console.error('SafeText error:', error);
      return null; // Don't render anything on error
    }
  };

  // Safe conditional renderer
  const SafeRender = ({
    condition,
    children,
    fallback = null,
  }: {
    condition: any;
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => {
    try {
      // Strict boolean check - only render if condition is explicitly true
      if (condition === true) {
        return <>{children}</>;
      }

      // For falsy values, return fallback or null
      return fallback;
    } catch (error) {
      console.error('SafeRender error:', error);
      return fallback;
    }
  };

  // Safe string renderer
  const SafeString = ({
    value,
    style,
    fallback = null,
    ...props
  }: {
    value: any;
    style?: any;
    fallback?: React.ReactNode;
  }) => {
    try {
      // Handle null, undefined, false
      if (value === null || value === undefined || value === false) {
        return fallback;
      }

      // Handle empty strings
      if (value === '') {
        return fallback;
      }

      // Handle strings and numbers
      if (typeof value === 'string' || typeof value === 'number') {
        // Ensure string is not just whitespace
        if (typeof value === 'string' && value.trim() === '') {
          return fallback;
        }
        return (
          <Text style={style} {...props}>
            {value}
          </Text>
        );
      }

      // For any other type, return fallback
      return fallback;
    } catch (error) {
      console.error('SafeString error:', error);
      return fallback;
    }
  };

  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'Customer'>>();
  const { isAuthenticated, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>(
    'customers',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allVouchers, setAllVouchers] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>('Loading...');
  const [userData, setUserData] = useState<any>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Custom Alert State
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    sortBy: 'name',
    sortOrder: 'asc',
    amountRange: 'all',
    type: 'all',
    location: '',
    hasPhone: 'all',
    hasGST: 'all',
  });
  const [refreshKey, setRefreshKey] = useState(0); // Force re-render key

  // Business Information Modal State
  const [showBusinessInfoModal, setShowBusinessInfoModal] = useState(false);
  const [businessInfoForm, setBusinessInfoForm] = useState({
    ownerName: '',
    businessName: '',
    businessType: '',
    businessSize: '',
    industry: '',
    monthlyTransactionVolume: '',
    currentAccountingSoftware: '',
  });
  const [businessInfoSaving, setBusinessInfoSaving] = useState(false);
  const [checkingBusinessInfo, setCheckingBusinessInfo] = useState(false);

  // Ref to track last button press time for debouncing
  const lastAddCustomerPressRef = useRef<number>(0);

  // Refs for form field focus management
  const ownerNameRef = useRef<TextInput>(null);
  const businessNameRef = useRef<TextInput>(null);
  const accountingSoftwareRef = useRef<TextInput>(null);

  // CSRF token state
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Fetch CSRF token
  const fetchCSRFToken = async (): Promise<string | null> => {
    try {
      console.log('🔄 Fetching CSRF token...');
      const response = await axios.get(`${BASE_URL}/api/csrf-token`, {
        withCredentials: true, // Important for session cookies
      });

      if (response.data?.token) {
        const token = response.data.token;
        setCsrfToken(token);
        console.log('✅ CSRF token fetched:', token.substring(0, 8) + '...');
        return token;
      } else {
        console.error('❌ No CSRF token in response:', response.data);
        return null;
      }
    } catch (error: any) {
      console.error('❌ Error fetching CSRF token:', error);
      return null;
    }
  };

  // Focus management functions
  const focusNextField = (nextRef: React.RefObject<TextInput | null>) => {
    if (nextRef.current) {
      nextRef.current.focus();
    }
  };

  const handleSubmitEditing = (nextRef?: React.RefObject<TextInput | null>) => {
    if (nextRef) {
      focusNextField(nextRef);
    }
  };

  // Handle dropdown selection and focus management
  const handleDropdownChange = (
    field: string,
    value: string,
    nextRef?: React.RefObject<TextInput | null>,
  ) => {
    handleBusinessInfoChange(field, value);
    // Focus next field after dropdown selection
    if (nextRef) {
      setTimeout(() => {
        focusNextField(nextRef);
      }, 100);
    }
  };

  // Validate JWT token
  const validateToken = async (): Promise<boolean> => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.log('❌ No access token found');
        return false;
      }

      // Try to decode the token to check if it's valid
      const userId = await getUserIdFromToken();
      console.log('🔍 Token validation - User ID:', userId);

      if (userId === null) {
        console.log('❌ Token validation failed - no user ID');
        return false;
      }

      // Log token details for debugging
      try {
        const tokenParts = accessToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔍 Token payload:', payload);

          // Check if token is expired
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp && currentTime >= payload.exp) {
            console.log('❌ Token is expired');
            return false;
          }
        }
      } catch (e) {
        console.log('⚠️ Could not decode token payload:', e);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return false;
    }
  };

  // Refresh access token using refresh token
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) {
        console.log('❌ No refresh token found');
        return null;
      }

      console.log('🔄 Refreshing access token...');

      const response = await axios.post(`${BASE_URL}/user/auth/refresh`, {
        refreshToken: refreshToken,
      });

      if (response.data?.success && response.data?.accessToken) {
        const newAccessToken = response.data.accessToken;
        await AsyncStorage.setItem('accessToken', newAccessToken);
        console.log('✅ Access token refreshed successfully');
        return newAccessToken;
      } else {
        console.log('❌ Failed to refresh token:', response.data);
        return null;
      }
    } catch (error: any) {
      console.error('❌ Error refreshing token:', error);
      return null;
    }
  };

  // Handle authentication error
  const handleAuthError = () => {
    showCustomAlert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      'error',
      async () => {
        // Use AuthContext logout function to properly handle logout
        try {
          await logout();
          console.log('✅ User logged out successfully after session expired');
        } catch (error) {
          console.error('❌ Error during logout:', error);
          // Fallback: clear tokens manually if logout fails
          await AsyncStorage.multiRemove([
            'accessToken',
            'refreshToken',
            'userMobileNumber',
          ]);
        }
      },
    );
  };

  // Test API endpoint (for debugging)
  const testAPIEndpoint = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      console.log('🧪 Testing API endpoint...');
      console.log('🔍 Full Token:', accessToken);
      console.log('🔍 Token length:', accessToken?.length);

      // Decode and log the full token payload
      if (accessToken) {
        try {
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log(
              '🔍 Full token payload:',
              JSON.stringify(payload, null, 2),
            );
            console.log('🔍 Token has id field:', 'id' in payload);
            console.log('🔍 Token id value:', payload.id);
            console.log('🔍 Token type:', payload.type);
            console.log('🔍 Token exp:', payload.exp);
            console.log('🔍 Current time:', Math.floor(Date.now() / 1000));
            console.log(
              '🔍 Token expired:',
              payload.exp && Math.floor(Date.now() / 1000) >= payload.exp,
            );
          }
        } catch (e) {
          console.log('❌ Error decoding token:', e);
        }
      }

      // Test with minimal data using ProfileScreen pattern
      const userId = await getUserIdFromToken();
      if (!userId) {
        throw new Error('No user ID found');
      }

      const testBody = {
        id: userId,
        ownerName: 'Test User',
        businessName: 'Test Business',
      };

      console.log('🔍 Test body:', testBody);
      console.log('🔍 API URL:', `${BASE_URL}/user/edit-profile`);

      // Fetch CSRF token for test
      const testCsrfToken = await fetchCSRFToken();
      if (!testCsrfToken) {
        throw new Error('Failed to obtain CSRF token for test');
      }

      const response = await axios.patch(
        `${BASE_URL}/user/edit-profile`,
        testBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-CSRF-Token': testCsrfToken,
          },
          withCredentials: true,
        },
      );

      console.log('✅ API test successful:', response.data);
      showCustomAlert('Success', 'API test successful!', 'success');
    } catch (error: any) {
      console.error('❌ API test failed:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error headers:', error.response?.headers);
      showCustomAlert('Error', `API test failed: ${error.message}`, 'error');
    }
  };

  // Debug: Monitor modal state changes
  useEffect(() => {
    console.log('🔍 Business Info Modal State Changed:', showBusinessInfoModal);
  }, [showBusinessInfoModal]);

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (showBusinessInfoModal) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        ownerNameRef.current?.focus();
      }, 300);
    }
  }, [showBusinessInfoModal]);

  // Fetch CSRF token when component mounts
  useEffect(() => {
    fetchCSRFToken();
  }, []);

  // Custom Alert Helper Function
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
      confirmText: confirmText || (type === 'confirm' ? 'Confirm' : 'OK'),
      cancelText: cancelText || 'Cancel',
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
  };

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  // 🎯 FIXED: Simplified data initialization with proper error handling
  useEffect(() => {
    console.log('🚀 CustomerScreen: Mount effect triggered');

    // Prevent multiple initializations
    if (globalCustomerCache.isInitializing) {
      console.log(
        '⏸️ CustomerScreen: Initialization already in progress, skipping',
      );
      return;
    }

    const initializeData = async () => {
      try {
        globalCustomerCache.isInitializing = true;
        setError(null);

        const accessToken = await AsyncStorage.getItem('accessToken');
        if (!accessToken) {
          throw new Error('Authentication required');
        }

        console.log('🔄 CustomerScreen: Fetching initial data...');

        // Fetch all data in parallel
        const [userDataResult, customersResult, vouchersResponse] =
          await Promise.all([
            fetchUserData(accessToken),
            fetchCustomersData(accessToken),
            fetch(`${BASE_URL}/vouchers`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
              .then(res => res.json())
              .then(data => data?.data || [])
              .catch(err => {
                console.warn('Vouchers fetch failed:', err);
                return [];
              }),
          ]);

        // Update cache with fresh data
        globalCustomerCache = {
          customers: customersResult,
          vouchers: vouchersResponse,
          userData: userDataResult,
          lastUpdated: Date.now(),
          activeTab: activeTab,
          isRefreshing: false,
          isInitializing: false,
          isComponentInitialized: true,
        };

        // Update state
        setCustomers(customersResult);
        setAllVouchers(vouchersResponse);
        setUserData(userDataResult);
        setBusinessName(
          userDataResult?.businessName || userDataResult?.ownerName || 'User',
        );

        console.log('✅ CustomerScreen: Initial data fetch completed');
      } catch (error) {
        console.error('❌ CustomerScreen: Initial data fetch error:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to load data',
        );
      } finally {
        globalCustomerCache.isInitializing = false;
      }
    };

    initializeData();
  }, []); // Only run once on mount

  // 🎯 RESTORED: Essential cache update for data persistence
  useEffect(() => {
    if (customers.length > 0) {
      globalCustomerCache.customers = customers;
      globalCustomerCache.lastUpdated = Date.now();
      globalCustomerCache.activeTab = activeTab;
    }
  }, [customers.length, activeTab]);

  // 🎯 FIXED: Optimized cached data check - prevent multiple API calls
  const checkCachedData = async () => {
    console.log('🔍 CustomerScreen: Checking cached data...');

    // Prevent multiple simultaneous initialization calls
    if (globalCustomerCache.isInitializing) {
      console.log(
        '⏸️ CustomerScreen: Initialization already in progress, skipping',
      );
      return;
    }

    // If we have valid cache for the current tab, use it immediately
    if (isCacheValid(activeTab)) {
      console.log('✅ CustomerScreen: Using valid cached data');
      setCustomers(globalCustomerCache.customers);
      setAllVouchers(globalCustomerCache.vouchers);
      setUserData(globalCustomerCache.userData);
      setBusinessName(
        globalCustomerCache.userData?.businessName ||
          globalCustomerCache.userData?.ownerName ||
          'User',
      );
      globalCustomerCacheChecked = true;

      // Only refresh in background if not already refreshing
      if (!globalCustomerCache.isRefreshing) {
        console.log('🔄 CustomerScreen: Starting background refresh...');
        setTimeout(() => {
          fetchDataInBackground();
        }, 100);
      } else {
        console.log(
          '⏸️ CustomerScreen: Background refresh already in progress, skipping',
        );
      }
      return;
    }

    // If no valid cache, fetch all data
    console.log('🔄 CustomerScreen: No valid cache, fetching fresh data...');
    globalCustomerCache.isInitializing = true;
    try {
      await fetchAllData();
    } finally {
      globalCustomerCache.isInitializing = false;
    }
  };

  // 🎯 FIXED: Enhanced fetchAllData with better error handling
  const fetchAllData = async () => {
    try {
      console.log('🔄 CustomerScreen: fetchAllData started...');

      // Prevent multiple simultaneous calls
      if (globalCustomerCache.isInitializing) {
        console.log('⏸️ fetchAllData already in progress, skipping...');
        return;
      }

      globalCustomerCache.isInitializing = true;
      setError(null);

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      // Fetch data in parallel to reduce total time
      const [userDataResult, customersResult, vouchersResponse] =
        await Promise.all([
          fetchUserData(accessToken),
          fetchCustomersData(accessToken),
          fetch(`${BASE_URL}/vouchers`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then(res => res.json())
            .then(data => data?.data || [])
            .catch(err => {
              console.warn('Vouchers fetch failed:', err);
              return [];
            }),
        ]);

      // Update cache with timestamp
      globalCustomerCache = {
        customers: customersResult,
        vouchers: vouchersResponse,
        userData: userDataResult,
        lastUpdated: Date.now(),
        activeTab: activeTab,
        isRefreshing: false,
        isInitializing: false,
        isComponentInitialized: true,
      };
      globalCustomerCacheChecked = true;

      // Don't filter here - let the getFilteredCustomers function handle filtering
      // This ensures all data is available for both tabs
      console.log(
        `📊 Fetched ${customersResult.length} total customers (preserving all data for both tabs)`,
      );

      // Debug: Log sample of all data
      if (customersResult.length > 0) {
        console.log(
          '📊 Sample of all customers:',
          customersResult.slice(0, 3).map(c => ({
            id: c.id,
            name: c.name || (c as any).partyName,
            partyType: c.partyType,
            type: c.type,
          })),
        );
      }

      // Update state with ALL data (no filtering)
      setCustomers(customersResult);
      setAllVouchers(vouchersResponse);
      setUserData(userDataResult);
      setBusinessName(
        userDataResult?.businessName || userDataResult?.ownerName || 'User',
      );

      console.log('✅ CustomerScreen: fetchAllData completed');
    } catch (err: any) {
      console.error('Error fetching customer data:', err);
      setError(err.message || 'Failed to load customer data');
    } finally {
      globalCustomerCache.isInitializing = false;
    }
  };

  // 🎯 FIXED: Enhanced background refresh with state tracking
  const fetchDataInBackground = async () => {
    try {
      console.log('🔄 CustomerScreen: Background refresh started...');
      globalCustomerCache.isRefreshing = true;

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        globalCustomerCache.isRefreshing = false;
        return;
      }

      // Only refresh customers data in background (most frequently changing data)
      const customersResult = await fetchCustomersData(accessToken);
      if (customersResult) {
        globalCustomerCache.customers = customersResult;
        globalCustomerCache.lastUpdated = Date.now();
        setCustomers(customersResult);
        console.log(
          '✅ CustomerScreen: Background refresh completed - Customers:',
          customersResult.length,
        );
      }
    } catch (error) {
      console.error('❌ CustomerScreen: Background refresh error:', error);
    } finally {
      globalCustomerCache.isRefreshing = false;
    }
  };

  // 🎯 FIXED: Focus listener with better data freshness logic and back navigation handling
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('🎯 CustomerScreen: Focus event triggered');

      // Check if user just returned from Add Customer screen (within last 30 seconds)
      const timeSinceNavigation =
        Date.now() - globalCustomerCache.lastNavigationTime;
      const justReturnedFromAddScreen =
        timeSinceNavigation < 30000 && timeSinceNavigation > 1000; // 1-30 seconds ago

      // Check if data is stale (more than 5 seconds) and not already refreshing
      const isDataStale = Date.now() - globalCustomerCache.lastUpdated > 5000; // 5 seconds
      const hasNoData =
        !globalCustomerCache.customers ||
        globalCustomerCache.customers.length === 0;

      // Always refresh when returning from Add Customer/Add Party screens or if data is stale
      const shouldRefresh =
        justReturnedFromAddScreen || isDataStale || hasNoData;

      console.log('🔍 Focus refresh check:', {
        justReturnedFromAddScreen,
        timeSinceNavigation,
        isDataStale,
        hasNoData,
        shouldRefresh,
        isRefreshing: globalCustomerCache.isRefreshing,
        isInitializing: globalCustomerCache.isInitializing,
      });

      if (
        shouldRefresh &&
        !globalCustomerCache.isRefreshing &&
        !globalCustomerCache.isInitializing
      ) {
        console.log('🔄 Data needs refresh, refreshing in background...');

        // Use the manual refresh function for consistency
        setTimeout(() => {
          handleManualRefresh();
        }, 100); // Small delay to prevent immediate refresh
      } else {
        console.log('✅ Data is fresh, skipping focus refresh');
      }
    });

    return unsubscribe;
  }, [navigation]);

  // 🎯 REMOVED: Duplicate data initialization - already handled in checkCachedData
  // This was causing multiple loading states

  // 🚨 REMOVED: All loading timeout mechanisms

  // 🎯 DISABLED: Debug effect to prevent additional renders
  // useEffect(() => {
  //   console.log('🔄 CustomerScreen data state changed:', {
  //     customersCount: customers.length,
  //     error,
  //     timestamp: new Date().toISOString(),
  //   });
  // }, [customers.length, error]);

  // Cleanup error state on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 CustomerScreen unmounting, cleaning up...');
      setError(null);
    };
  }, []);

  // 🎯 FIXED: Tab change handling with proper data filtering (NO API calls)
  useLayoutEffect(() => {
    console.log(`🎯 Tab change effect triggered for: ${activeTab}`);

    // Only process if tab actually changed
    if (activeTab && globalCustomerCache.activeTab !== activeTab) {
      console.log(
        `🔄 Tab changed from ${globalCustomerCache.activeTab} to ${activeTab}`,
      );

      // Update cache tab reference
      globalCustomerCache.activeTab = activeTab;

      // If we have cached data, update the state with all data
      // The getFilteredCustomers function will handle the filtering
      if (
        globalCustomerCache.customers &&
        globalCustomerCache.customers.length > 0
      ) {
        console.log(
          `✅ Using cached data for tab: ${activeTab} (${globalCustomerCache.customers.length} total items)`,
        );

        // Update state with all cached data - filtering will be handled by getFilteredCustomers
        setCustomers(globalCustomerCache.customers);
      } else {
        // If no cached data, trigger a data fetch only if we haven't fetched recently
        const timeSinceLastFetch = Date.now() - globalCustomerCache.lastUpdated;
        if (timeSinceLastFetch > CACHE_TTL) {
          console.log(
            '🔄 No cached data or data is stale, fetching fresh data...',
          );
          fetchAllData();
        }
      }
    }
  }, [activeTab]);

  // Note: We intentionally avoid another useEffect on activeTab that fetches,
  // to prevent duplicate API calls. Initial and tab-change fetch happens in
  // useLayoutEffect above.

  // 🎯 FIXED: Handle navigation from AddParty with selectedTab parameter and refresh data
  useEffect(() => {
    const selectedTab = route.params?.selectedTab;
    const shouldRefresh = route.params?.shouldRefresh;

    if (selectedTab) {
      console.log(`🎯 Route params changed: ${selectedTab}`);
      if (selectedTab === 'supplier') {
        setActiveTab('suppliers');
      } else if (selectedTab === 'customer') {
        setActiveTab('customers');
      }
      // Note: useLayoutEffect will handle data fetching when activeTab changes
    }

    // If we should refresh (e.g., after adding a new customer/supplier)
    if (shouldRefresh) {
      console.log(
        '🔄 Route params indicate refresh needed, clearing cache and refreshing...',
      );
      clearCustomerCache();
      setTimeout(() => {
        handleManualRefresh();
      }, 100);
    }
  }, [route.params?.selectedTab, route.params?.shouldRefresh]);

  // 🎯 ADDED: useFocusEffect for additional refresh trigger when returning from Add Customer
  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 CustomerScreen: useFocusEffect triggered');

      // Check if we need to refresh (e.g., after adding a customer)
      const shouldRefresh = route.params?.shouldRefresh;
      const isDataStale = Date.now() - globalCustomerCache.lastUpdated > 30000; // 30 seconds

      if (shouldRefresh) {
        console.log(
          '🔄 useFocusEffect: shouldRefresh=true, forcing immediate refresh...',
        );
        clearCustomerCache();
        setTimeout(() => {
          handleManualRefresh();
        }, 100);
      } else if (isDataStale) {
        console.log('🔄 useFocusEffect: Data is stale, refreshing...');
        clearCustomerCache();
        setTimeout(() => {
          handleManualRefresh();
        }, 200);
      }
    }, [route.params?.shouldRefresh]),
  );

  // 🎯 RESTORED: Animation effect for smooth data loading
  useEffect(() => {
    // Animate in when data loads
    if (Array.isArray(customers) && customers.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300, // Faster animation
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300, // Faster animation
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [customers.length]); // Only depend on length to prevent excessive animations

  const fetchUserData = async (accessToken?: string) => {
    try {
      const token = accessToken || (await AsyncStorage.getItem('accessToken'));
      const userId = await getUserIdFromToken();
      if (!userId) {
        setBusinessName('User');
        return null;
      }

      const res = await axios.get(`${BASE_URL}/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = res.data.data;
      setUserData(user);
      setBusinessName(user.businessName || user.ownerName || 'User');

      return user;
    } catch (err) {
      console.error('Error fetching user data:', err);
      setBusinessName('User');
      return null;
    }
  };

  const fetchCustomersData = async (
    accessToken?: string,
  ): Promise<Customer[]> => {
    try {
      console.log('📡 Fetching data for tab:', activeTab);
      console.log('📡 Current state before fetch:', {
        customersCount: customers.length,
        error,
      });

      setError(null);

      const token = accessToken || (await AsyncStorage.getItem('accessToken'));
      if (!token) {
        console.error('❌ No access token found');
        throw new Error('Authentication required');
      }

      // Validate token format
      if (token.length < 10) {
        console.error('❌ Token appears to be invalid (too short):', token);
        throw new Error('Invalid authentication token');
      }

      console.log('🔑 Using token:', token.substring(0, 20) + '...');
      console.log('🌐 Making API calls to:', BASE_URL);

      // Test API connectivity first
      try {
        console.log('🔍 Testing API connectivity...');
        const healthResponse = await axios.get(`${BASE_URL}/health`, {
          timeout: 5000,
        });
        console.log('✅ API health check passed:', healthResponse.status);
      } catch (healthError: any) {
        console.warn(
          '⚠️ API health check failed, but continuing with main calls:',
          healthError.message,
        );
      }

      // 🚨 REMOVED: API timeout wrapper

      console.log('🚀 Starting API calls...');
      console.log('📞 Calling customers endpoint:', `${BASE_URL}/customers`);
      console.log('💰 Calling vouchers endpoint:', `${BASE_URL}/vouchers`);

      // Debug: Test customers API first
      try {
        const debugResponse = await axios.get(`${BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
        console.log('🔍 DEBUG - Raw customers API response:', {
          status: debugResponse.status,
          data: debugResponse.data,
          isArray: Array.isArray(debugResponse.data),
          hasDataField: !!debugResponse.data?.data,
        });
      } catch (debugError: any) {
        console.log('🔍 DEBUG - Customers API error:', debugError.message);
      }

      // Retry mechanism with exponential backoff
      let retryCount = 0;
      const maxRetries = 2; // Reduced retries for faster failure
      let customersResponse: any;
      let vouchersResponse: any;

      while (retryCount <= maxRetries) {
        try {
          console.log(`🔄 Attempt ${retryCount + 1} of ${maxRetries + 1}`);

          // Fetch both customers and vouchers in parallel
          [customersResponse, vouchersResponse] = await Promise.all([
            axios.get(`${BASE_URL}/customers`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              timeout: 8000, // Reduced timeout
            }),
            axios.get(`${BASE_URL}/vouchers`, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              timeout: 8000, // Reduced timeout
            }),
          ]);

          console.log('✅ API calls completed successfully!');
          console.log('📊 Customers API Response:', customersResponse.data);
          console.log('💰 Vouchers API Response:', vouchersResponse.data);

          // If we get here, the calls succeeded, so break out of retry loop
          break;
        } catch (apiError: any) {
          retryCount++;
          console.error(
            `❌ API call attempt ${retryCount} failed:`,
            apiError.message,
          );

          if (retryCount > maxRetries) {
            console.error('❌ Max retries reached, giving up');
            throw apiError;
          }

          // Wait before retrying with exponential backoff
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Transform API response to our local format
      // Handle both direct array response and wrapped response
      const apiData =
        customersResponse.data?.data || customersResponse.data || [];
      const vouchersData = vouchersResponse.data?.data || [];
      console.log('📊 Raw customers data:', apiData.length, 'items');
      console.log('💰 Raw vouchers data:', vouchersData.length, 'items');
      console.log('📊 Customers API response structure:', {
        hasData: !!customersResponse.data,
        isArray: Array.isArray(customersResponse.data),
        hasDataField: !!customersResponse.data?.data,
        responseKeys: Object.keys(customersResponse.data || {}),
      });

      // Store all vouchers for summary calculation
      setAllVouchers(vouchersData);

      // Debug: Log sample API data to understand structure
      if (apiData.length > 0) {
        console.log('🔍 Sample customers API data structure:', {
          firstItem: {
            id: apiData[0].id,
            partyName: apiData[0].partyName,
            partyType: apiData[0].partyType,
            type: apiData[0].type,
            name: apiData[0].name,
            voucherType: apiData[0].voucherType,
            phoneNumber: apiData[0].phoneNumber,
            address: apiData[0].address,
            gstNumber: apiData[0].gstNumber,
          },
          allKeys: Object.keys(apiData[0] || {}),
        });
      } else {
        console.log('⚠️ No customers data received from API');
        console.log('📊 Full customers response:', customersResponse.data);
      }

      // If no customers data received, try to create customer data from vouchers as fallback
      if (apiData.length === 0) {
        console.log('ℹ️ No customers data received from API');
        console.log('📊 Customers API response:', customersResponse.data);

        // Fallback: Create customer data from vouchers if available
        if (vouchersData.length > 0) {
          console.log('🔄 Creating customer data from vouchers as fallback...');

          // Group vouchers by partyName AND partyType to create separate entries
          // This allows the same party to appear as both customer and supplier
          const customerMap = new Map();

          vouchersData.forEach((voucher: any) => {
            const partyName = voucher.partyName;

            // Determine party type based on voucher type
            let partyType = 'customer'; // Default
            if (voucher.type === 'Purchase') {
              // Purchase means you're buying from someone = supplier
              partyType = 'supplier';
            } else if (
              voucher.type === 'Sell' ||
              voucher.type === 'receipt' ||
              voucher.type === 'payment'
            ) {
              // Sell/Receipt/Payment means you're dealing with customers
              partyType = 'customer';
            }

            // Create unique key combining partyName and partyType
            const uniqueKey = `${partyName}_${partyType}`;

            if (!customerMap.has(uniqueKey)) {
              customerMap.set(uniqueKey, {
                id: voucher.customerId || `voucher_${voucher.id}_${partyType}`,
                partyName: partyName,
                partyType: partyType,
                phoneNumber: voucher.partyPhone,
                address: voucher.partyAddress,
                gstNumber: voucher.gstNumber,
                createdAt: voucher.created_at,
                updatedAt: voucher.updated_at,
              });
            }
          });

          // Convert map to array
          const fallbackCustomers = Array.from(customerMap.values());
          console.log(
            '🔄 Created fallback customers:',
            fallbackCustomers.length,
          );
          console.log(
            '🔄 Fallback customers details:',
            fallbackCustomers.map(c => ({
              name: c.partyName,
              partyType: c.partyType,
              id: c.id,
            })),
          );

          // Use fallback data - add it directly to apiData for processing
          // The main transformation logic will handle voucher calculations
          console.log(
            '🔄 Adding fallback customers to apiData:',
            fallbackCustomers.length,
          );
          console.log(
            '🔄 Fallback customers sample:',
            fallbackCustomers.slice(0, 2).map(c => ({
              name: c.partyName,
              partyType: c.partyType,
              id: c.id,
            })),
          );
          apiData.push(...fallbackCustomers);
        } else {
          console.log('ℹ️ No vouchers data either, showing empty state');
          setCustomers([]);
          return [];
        }
      }

      // Log sample voucher data for debugging
      if (vouchersData.length > 0) {
        console.log('💰 Sample voucher:', {
          id: vouchersData[0].id,
          type: vouchersData[0].type,
          amount: vouchersData[0].amount,
          partyName: vouchersData[0].partyName,
          customerId: vouchersData[0].customerId,
          date: vouchersData[0].date,
        });
      }

      // Calculate customer amounts from vouchers instead of static opening balance
      // This provides real-time balance based on actual transactions
      const calculateCustomerAmount = (customer: any) => {
        try {
          // Find all vouchers for this customer
          const customerVouchers = vouchersData.filter((voucher: any) => {
            // Match by customerId if available, otherwise by partyName
            if (voucher.customerId && customer.id) {
              return voucher.customerId === customer.id;
            }
            return voucher.partyName === customer.partyName;
          });

          console.log(
            `💰 Customer ${customer.partyName} has ${customerVouchers.length} vouchers`,
          );

          let totalAmount = 0;
          let paymentTotal = 0;
          let receiptTotal = 0;

          customerVouchers.forEach((voucher: any) => {
            const amount = Math.abs(parseFloat(voucher.amount) || 0);
            if (voucher.type === 'payment' || voucher.type === 'Purchase') {
              paymentTotal += amount; // Money going out (you give)
            } else if (voucher.type === 'receipt' || voucher.type === 'Sell') {
              receiptTotal += amount; // Money coming in (you get)
            }
          });

          // Calculate net balance: receipts - payments
          totalAmount = receiptTotal - paymentTotal;

          console.log(`💰 Customer ${customer.partyName} balance:`, {
            receipts: receiptTotal,
            payments: paymentTotal,
            netBalance: totalAmount,
            balanceType: totalAmount > 0 ? 'receipt' : 'payment',
          });

          return {
            totalAmount: Math.abs(totalAmount),
            type: totalAmount > 0 ? 'get' : 'give', // Simplified logic to match CustomerDetailScreen
            paymentTotal,
            receiptTotal,
            voucherCount: customerVouchers.length,
          };
        } catch (error) {
          console.error('Error calculating customer amount:', error);
          return {
            totalAmount: 0,
            type: 'give' as const,
            paymentTotal: 0,
            receiptTotal: 0,
            voucherCount: 0,
          };
        }
      };

      // ORDER LOGIC: API returns newest first (by createdAt timestamp)
      // - ID 148 (Customer Care) = 2025-08-13T07:45:52.246Z (newest)
      // - ID 146 (Aarav Patel) = 2025-08-13T06:31:08.297Z
      // - ID 143 (3I Guest House) = 2025-08-13T05:14:30.154Z
      // - ID 132 (vishal) = 2025-08-12T13:13:56.195Z
      // - ID 130 (Kunal) = 2025-08-12T13:04:15.050Z (oldest)
      // We preserve this order - newest entries appear at the top
      // Don't filter here - let fetchAllData handle tab-specific filtering
      const transformedCustomers: Customer[] = apiData
        .map((item: any, index: number) => {
          try {
            // Calculate real-time amount from vouchers
            const voucherAmounts = calculateCustomerAmount(item);

            // Use voucher amounts instead of opening balance
            const amount = voucherAmounts.totalAmount;
            const type = voucherAmounts.type;

            console.log(`💰 Customer ${item.partyName} final amounts:`, {
              amount,
              type,
              voucherCount: voucherAmounts.voucherCount,
              receipts: voucherAmounts.receiptTotal,
              payments: voucherAmounts.paymentTotal,
            });

            // Safely handle name and create avatar
            let partyName: string;
            try {
              partyName = String(
                item.partyName || item.name || 'Unknown',
              ).trim();
              if (!partyName || partyName === '') {
                partyName = 'Unknown';
              }
            } catch (error) {
              console.warn('Party name parsing error:', error);
              partyName = 'Unknown';
            }

            // Debug: Log item structure for fallback data
            if (item.id && item.id.toString().startsWith('voucher_')) {
              console.log('🔍 Processing fallback item:', {
                id: item.id,
                partyName: item.partyName,
                partyType: item.partyType,
                hasAddress: !!item.address,
                hasPhone: !!item.phoneNumber,
              });
            }

            let avatar: string;
            try {
              avatar = String(partyName.charAt(0) || 'U').toUpperCase();
            } catch (error) {
              console.warn('Avatar creation error:', error);
              avatar = 'U';
            }

            // Safely handle address
            let location: string;
            try {
              if (item.address && typeof item.address === 'string') {
                const addressParts = item.address.split(',');
                location = addressParts[0]?.trim() || 'India';
              } else {
                location = 'India';
              }
            } catch (error) {
              console.warn('Address parsing error:', error);
              location = 'India';
            }

            // Safely handle date formatting
            let lastInteraction: string;
            try {
              if (item.createdAt) {
                const date = new Date(item.createdAt);
                if (!isNaN(date.getTime())) {
                  lastInteraction = date.toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                } else {
                  lastInteraction = 'Recently';
                }
              } else {
                lastInteraction = 'Recently';
              }
            } catch (dateError) {
              console.warn('Date parsing error:', dateError);
              lastInteraction = 'Recently';
            }

            // Safely handle phone number and GST
            let phoneNumber: string | undefined;
            let gstNumber: string | undefined;
            try {
              phoneNumber = item.phoneNumber
                ? String(item.phoneNumber).trim()
                : undefined;
              gstNumber = item.gstNumber
                ? String(item.gstNumber).trim()
                : undefined;
            } catch (error) {
              console.warn('Phone/GST parsing error:', error);
              phoneNumber = undefined;
              gstNumber = undefined;
            }

            return {
              id: String(item.id || `temp_${index}`),
              name: partyName,
              location: location,
              lastInteraction: lastInteraction,
              amount: amount,
              type: type,
              avatar: avatar,
              phoneNumber: phoneNumber,
              gstNumber: gstNumber,
              address: item.address || undefined,
              openingBalance:
                voucherAmounts.receiptTotal - voucherAmounts.paymentTotal,
              // Preserve the original partyType from API for proper filtering
              partyType: item.partyType || item.type || 'customer',
            };
          } catch (error) {
            console.error('Customer transformation error:', error, item);
            // Return a safe fallback customer
            return {
              id: `fallback_${index}`,
              name: 'Error Customer',
              location: 'India',
              lastInteraction: 'Recently',
              amount: 0,
              type: 'give' as const,
              avatar: 'E',
              phoneNumber: undefined,
              gstNumber: undefined,
              address: undefined,
              openingBalance: 0,
              partyType: 'customer', // Default to customer for fallback
            };
          }
        })
        .filter((customer: any): customer is Customer => {
          // Additional validation to ensure we only have valid customers
          const isValid =
            customer &&
            typeof customer === 'object' &&
            typeof customer.id === 'string' &&
            typeof customer.name === 'string' &&
            typeof customer.location === 'string' &&
            typeof customer.lastInteraction === 'string' &&
            typeof customer.amount === 'number' &&
            (customer.type === 'give' || customer.type === 'get') &&
            typeof customer.avatar === 'string';

          if (!isValid) {
            console.warn('❌ Invalid customer data filtered out:', customer);
          }

          return isValid;
        });

      console.log(
        '✅ Transformed customers:',
        transformedCustomers.length,
        'items for tab:',
        activeTab,
      );

      // Add comprehensive filtering debug info
      console.log(`🔍 Filtering results for ${activeTab}:`, {
        totalApiData: apiData.length,
        filteredData: transformedCustomers.length,
        sampleItems: apiData.slice(0, 3).map((item: any) => ({
          id: item.id,
          name: item.partyName || item.name,
          partyType: item.partyType || item.type,
          isCustomer:
            (item.partyType || item.type) === 'customer' ||
            (item.partyType || item.type) === 'Customer',
          isSupplier:
            (item.partyType || item.type) === 'supplier' ||
            (item.partyType || item.type) === 'Supplier',
        })),
      });

      // Log summary of amounts calculated from vouchers
      const totalReceipts = transformedCustomers.reduce((sum, customer) => {
        return sum + (customer.type === 'get' ? customer.amount : 0);
      }, 0);
      const totalPayments = transformedCustomers.reduce((sum, customer) => {
        return sum + (customer.type === 'give' ? customer.amount : 0);
      }, 0);

      console.log('💰 Voucher-based amounts summary:', {
        totalCustomers: transformedCustomers.length,
        totalReceipts: `₹${totalReceipts.toFixed(2)}`,
        totalPayments: `₹${totalPayments.toFixed(2)}`,
        netBalance: `₹${(totalReceipts - totalPayments).toFixed(2)}`,
      });

      // Debug: Show order and voucher type mapping
      console.log('📋 FINAL ORDER (newest first):');
      transformedCustomers.forEach((customer, index) => {
        console.log(`📊 ${index + 1}. ${customer.name}:`, {
          voucherType: 'receipt', // This will be the actual voucher type from API
          calculatedType: customer.type,
          amount: customer.amount,
          color: customer.type === 'get' ? 'GREEN' : 'RED',
          position: index + 1,
        });
      });

      console.log(
        '✅ Data fetched successfully:',
        transformedCustomers.length,
        'items',
      );
      console.log(
        '📊 Transformed customers sample:',
        transformedCustomers.slice(0, 3).map(c => ({
          name: c.name,
          partyType: c.partyType,
          type: c.type,
          amount: c.amount,
        })),
      );
      setCustomers(transformedCustomers);

      // If no data found, show appropriate message
      if (transformedCustomers.length === 0) {
        console.log('ℹ️ No data found for tab:', activeTab);
      }

      return transformedCustomers;
    } catch (err: any) {
      console.error('❌ Error fetching customers:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        code: err.code,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          headers: err.config?.headers,
        },
      });

      let errorMessage = 'Failed to fetch data';
      if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        console.error('🔐 401 Unauthorized - Token may be invalid or expired');
      } else if (err.response?.status === 403) {
        errorMessage = 'Access forbidden. Please check your permissions.';
        console.error('🚫 403 Forbidden - User lacks required permissions');
      } else if (err.response?.status === 404) {
        errorMessage =
          'API endpoint not found. Please check the server configuration.';
        console.error('🔍 404 Not Found - API endpoint may be incorrect');
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
        console.error('💥 Server error:', err.response?.status);
      } else if (err.code === 'NETWORK_ERROR' || err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection.';
        console.error('🌐 Network error - Check internet connection');
      } else if (err.code === 'TIMEOUT_ERROR' || err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
        console.error('⏰ Request timeout - Server may be slow or unreachable');
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      // Clear customers on error but keep cache for potential retry
      setCustomers([]);
      return [];
    } finally {
      console.log('🏁 Fetch completed. Final state:', {
        customersCount: customers.length,
        error,
      });
    }
  };

  // Apply filters and search while preserving API order (newest first)
  const getFilteredCustomers = () => {
    try {
      // Safety check for customers array
      if (!Array.isArray(customers)) {
        console.warn('Customers is not an array:', customers);
        return [];
      }

      // Debug: Log current filtering state
      console.log(`🔍 getFilteredCustomers called for tab: ${activeTab}`, {
        totalCustomers: customers.length,
        searchQuery: searchQuery || 'none',
        filterOptions: filterOptions,
        customersSample: customers.slice(0, 3).map(c => ({
          id: c.id,
          name: c.name,
          partyType: c.partyType,
          type: c.type,
        })),
      });

      // First apply tab filter based on activeTab
      let filtered = customers.filter(customer => {
        // Safety check for each customer
        if (!customer || typeof customer !== 'object') {
          return false;
        }

        // Apply tab-specific filtering
        if (activeTab === 'customers') {
          // For customers tab, show only customers
          const partyType = customer.partyType || customer.type || 'customer';
          return (
            partyType === 'customer' ||
            partyType === 'Customer' ||
            !customer.partyType
          ); // Default to customer if no partyType specified
        } else if (activeTab === 'suppliers') {
          // For suppliers tab, show only suppliers
          const partyType = customer.partyType || customer.type || 'customer';
          return partyType === 'supplier' || partyType === 'Supplier';
        }

        return true; // Default to show all if no tab filter
      });

      // Then apply search filter
      if (searchQuery && searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filtered = filtered.filter(customer => {
          if (!customer || typeof customer !== 'object') {
            return false;
          }

          return (
            (customer.name &&
              customer.name.toLowerCase().includes(searchLower)) ||
            (customer.location &&
              customer.location.toLowerCase().includes(searchLower)) ||
            (customer.phoneNumber &&
              customer.phoneNumber.includes(searchQuery)) ||
            (customer.gstNumber && customer.gstNumber.includes(searchQuery))
          );
        });
      }

      // Apply type filter (use partyType instead of type)
      if (filterOptions.type !== 'all') {
        filtered = filtered.filter(customer => {
          if (!customer) return false;
          const partyType = customer.partyType || customer.type || 'customer';
          return partyType === filterOptions.type;
        });
      }

      // Apply amount range filter
      if (filterOptions.amountRange !== 'all') {
        filtered = filtered.filter(customer => {
          if (!customer) return false;

          const amount = Math.abs(customer.amount || 0);
          switch (filterOptions.amountRange) {
            case '0-1000':
              return amount >= 0 && amount <= 1000;
            case '1000-5000':
              return amount > 1000 && amount <= 5000;
            case '5000-10000':
              return amount > 5000 && amount <= 10000;
            case '10000+':
              return amount > 10000;
            default:
              return true;
          }
        });
      }

      // Apply location filter
      if (filterOptions.location && filterOptions.location.trim() !== '') {
        filtered = filtered.filter(customer => {
          return (
            customer &&
            customer.location
              .toLowerCase()
              .includes(filterOptions.location.toLowerCase())
          );
        });
      }

      // Apply phone number filter
      if (filterOptions.hasPhone !== 'all') {
        filtered = filtered.filter(customer => {
          if (filterOptions.hasPhone === 'yes') {
            return (
              customer &&
              customer.phoneNumber &&
              customer.phoneNumber.trim() !== ''
            );
          } else {
            // 'no'
            return (
              customer &&
              (!customer.phoneNumber || customer.phoneNumber.trim() === '')
            );
          }
        });
      }

      // Apply GST number filter
      if (filterOptions.hasGST !== 'all') {
        filtered = filtered.filter(customer => {
          if (filterOptions.hasGST === 'yes') {
            return (
              customer && customer.gstNumber && customer.gstNumber.trim() !== ''
            );
          } else {
            // 'no'
            return (
              customer &&
              (!customer.gstNumber || customer.gstNumber.trim() === '')
            );
          }
        });
      }

      // Apply sorting only if user explicitly chooses to sort
      if (
        filterOptions.sortBy !== 'name' ||
        filterOptions.sortOrder !== 'asc'
      ) {
        filtered.sort((a, b) => {
          if (!a || !b) return 0;

          let aValue: any, bValue: any;

          try {
            switch (filterOptions.sortBy) {
              case 'name':
                aValue = (a.name || '').toLowerCase();
                bValue = (b.name || '').toLowerCase();
                break;
              case 'amount':
                aValue = Math.abs(a.amount || 0);
                bValue = Math.abs(b.amount || 0);
                break;
              case 'date':
                aValue = new Date(a.lastInteraction || '');
                bValue = new Date(b.lastInteraction || '');
                break;
              case 'location':
                aValue = (a.location || '').toLowerCase();
                bValue = (b.location || '').toLowerCase();
                break;
              default:
                aValue = (a.name || '').toLowerCase();
                bValue = (b.name || '').toLowerCase();
            }

            if (filterOptions.sortOrder === 'asc') {
              return aValue > bValue ? 1 : -1;
            } else {
              return aValue < bValue ? 1 : -1;
            }
          } catch (sortError) {
            console.warn('Sorting error:', sortError);
            return 0;
          }
        });
      } else {
        // Default order: preserve API order (newest first)
        // API already returns: Customer Care (newest) → Aarav Patel → 502 Flat → 3I Guest House → vishal → Kunal (oldest)
        console.log('📅 Preserving API order - newest entries first');
      }

      // Debug: Log final filtering result
      console.log(`✅ getFilteredCustomers result:`, {
        originalCount: customers.length,
        filteredCount: filtered.length,
        activeTab: activeTab,
        searchQuery: searchQuery || 'none',
        sampleFiltered: filtered.slice(0, 3).map(c => ({
          name: c.name,
          partyType: c.partyType,
          type: c.type,
        })),
        allCustomers: customers.map(c => ({
          name: c.name,
          partyType: c.partyType,
          type: c.type,
        })),
      });

      return filtered;
    } catch (error) {
      console.error('Filter error:', error);
      return [];
    }
  };

  const filteredCustomers = getFilteredCustomers();

  // Debug logging
  console.log('🔍 Current state:', {
    activeTab,
    customersCount: customers.length,
    filteredCount: filteredCustomers.length,
    error,
    searchQuery: searchQuery || 'none',
    sampleCustomers: customers.slice(0, 2).map(c => ({
      name: c.name,
      partyType: c.partyType,
      type: c.type,
    })),
  });

  // Additional debug for supplier tab
  if (activeTab === 'suppliers') {
    console.log('🏭 Suppliers tab debug:', {
      totalCustomers: customers.length,
      suppliersOnly: customers.filter(c => c && c.type),
      sampleSuppliers: customers.slice(0, 3).map(c => ({
        name: c?.name,
        type: c?.type,
        amount: c?.amount,
      })),
    });
  }

  // Calculate summary data from all vouchers
  const summaryData = (() => {
    try {
      let totalPayment = 0;
      let totalReceipt = 0;
      let totalSell = 0;
      let totalPurchase = 0;

      allVouchers.forEach((voucher: any) => {
        const amount = Math.abs(parseFloat(voucher.amount) || 0);

        switch (voucher.type) {
          case 'payment':
            totalPayment += amount;
            break;
          case 'receipt':
            totalReceipt += amount;
            break;
          case 'Sell':
            totalSell += amount;
            break;
          case 'Purchase':
            totalPurchase += amount;
            break;
        }
      });

      console.log('💰 Summary totals from all vouchers:', {
        totalPayment,
        totalReceipt,
        totalSell,
        totalPurchase,
        totalVouchers: allVouchers.length,
      });

      return {
        payment: totalPayment,
        receipt: totalReceipt,
        sell: totalSell,
        purchase: totalPurchase,
      };
    } catch (error) {
      console.warn('Summary calculation error:', error);
      return { payment: 0, receipt: 0, sell: 0, purchase: 0 };
    }
  })();

  // Dynamic text based on active tab
  const getTabSpecificText = () => {
    if (activeTab === 'suppliers') {
      return {
        searchPlaceholder: 'Search Supplier',
        emptyText: 'No suppliers found',
        emptySubtext: 'Add your first supplier to get started',
        fabText: 'Add Supplier',
        itemType: 'supplier',
      };
    }
    return {
      searchPlaceholder: 'Search Customer',
      emptyText: 'No customers found',
      emptySubtext: 'Add your first customer to get started',
      fabText: 'Add Customer',
      itemType: 'customer',
    };
  };

  const tabText = getTabSpecificText();

  const handleTabChange = async (tab: 'customers' | 'suppliers') => {
    try {
      if (tab !== 'customers' && tab !== 'suppliers') {
        console.warn('Invalid tab value:', tab);
        return;
      }

      console.log(`🔄 Tab changing from ${activeTab} to ${tab}`);
      setActiveTab(tab);
      setSearchQuery('');
      setFilterOptions({
        sortBy: 'name',
        sortOrder: 'asc',
        amountRange: 'all',
        type: 'all',
        location: '',
        hasPhone: 'all',
        hasGST: 'all',
      });

      // Clear current data to show loading state
      setCustomers([]);
      setError(null);

      // Fetch fresh data for the new tab
      console.log(`🔄 Fetching fresh data for ${tab} tab...`);
      await fetchAllData();
    } catch (error) {
      console.error('Tab change error:', error);
    }
  };

  const handleAddCustomer = async () => {
    try {
      // Debounce rapid button presses (500ms)
      const now = Date.now();
      if (now - lastAddCustomerPressRef.current < 500) {
        console.log('⏸️ Button press too soon, debouncing...');
        return;
      }
      lastAddCustomerPressRef.current = now;

      // Prevent multiple rapid calls
      if (checkingBusinessInfo) {
        console.log('⏸️ Business info check already in progress, skipping...');
        return;
      }

      setCheckingBusinessInfo(true);

      // Check if user needs to complete business information first
      const shouldShowModal = await checkBusinessInfoCompletion();

      if (shouldShowModal) {
        console.log('📋 Showing business info modal before navigation');
        setCheckingBusinessInfo(false);
        return; // Don't navigate, modal will be shown
      }

      // Track navigation time for refresh logic
      globalCustomerCache.lastNavigationTime = Date.now();
      console.log(
        '🕐 Navigation time tracked:',
        globalCustomerCache.lastNavigationTime,
      );

      if (activeTab === 'suppliers') {
        navigation.navigate('AddParty', {
          partyType: 'supplier',
          shouldRefresh: true, // Tell the screen to refresh when returning
        });
      } else if (activeTab === 'customers') {
        navigation.navigate('AddCustomerFromContacts', {
          shouldRefresh: true, // Tell the screen to refresh when returning
        });
      } else {
        console.warn('Invalid active tab for adding customer:', activeTab);
      }
    } catch (error) {
      console.error('Add customer navigation error:', error);
      // Fallback: show alert or handle gracefully
    } finally {
      setCheckingBusinessInfo(false);
    }
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    try {
      console.log('🔄 CustomerScreen: Manual refresh triggered...');

      // Prevent multiple simultaneous refreshes
      if (globalCustomerCache.isRefreshing) {
        console.log('⏸️ Refresh already in progress, skipping...');
        return;
      }

      globalCustomerCache.isRefreshing = true;
      setError(null);
      setCustomers([]);

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      // Fetch fresh data in parallel
      const [customersResult, userDataResult, vouchersResponse] =
        await Promise.all([
          fetchCustomersData(accessToken),
          fetchUserData(accessToken),
          fetch(`${BASE_URL}/vouchers`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then(res => res.json())
            .then(data => data?.data || [])
            .catch(err => {
              console.warn('Vouchers refresh failed:', err);
              return globalCustomerCache.vouchers || [];
            }),
        ]);

      // Update cache with fresh data
      globalCustomerCache = {
        customers: customersResult,
        vouchers: vouchersResponse,
        userData: userDataResult,
        lastUpdated: Date.now(),
        activeTab: activeTab,
        isRefreshing: false,
        isInitializing: false,
        isComponentInitialized: true,
      };

      // Update state
      setCustomers(customersResult);
      setAllVouchers(vouchersResponse);
      setUserData(userDataResult);
      setBusinessName(
        userDataResult?.businessName || userDataResult?.ownerName || 'User',
      );

      console.log(
        '✅ CustomerScreen: Manual refresh completed - Customers:',
        customersResult.length,
      );
    } catch (error) {
      console.error('❌ CustomerScreen: Manual refresh error:', error);
      setError(error instanceof Error ? error.message : 'Refresh failed');
    } finally {
      globalCustomerCache.isRefreshing = false;
    }
  };

  const handleViewReport = () => {
    showCustomAlert(
      'View Report',
      'This will open the customer report',
      'info',
    );
  };

  const handleFilterPress = () => {
    setShowFilterModal(true);
  };

  // Check if user needs to fill business information (triggered by button clicks)
  const checkBusinessInfoCompletion = async () => {
    try {
      if (!userData) {
        console.log('⚠️ No userData available');
        return false;
      }

      // Check if user has default names that need to be changed
      const hasDefaultNames =
        userData.ownerName === 'User' ||
        userData.businessName === 'My Business' ||
        userData.businessName === 'User' ||
        !userData.ownerName ||
        !userData.businessName;

      console.log('🔍 Checking business info completion:', {
        ownerName: userData.ownerName,
        businessName: userData.businessName,
        hasDefaultNames,
      });

      if (!hasDefaultNames) {
        console.log('ℹ️ User has proper names, no modal needed');
        return false;
      }

      // Check 12-hour limit (once every 12 hours)
      const now = new Date().getTime();
      const twelveHoursAgo = now - 12 * 60 * 60 * 1000; // 12 hours in milliseconds

      const lastModalData = await AsyncStorage.getItem('lastModalShown');
      let lastModalTime = 0;

      if (lastModalData) {
        const data = JSON.parse(lastModalData);
        lastModalTime = data.timestamp || 0;
      }

      console.log(
        '🔍 Last modal shown:',
        new Date(lastModalTime).toLocaleString(),
      );
      console.log(
        '🔍 12 hours ago:',
        new Date(twelveHoursAgo).toLocaleString(),
      );
      console.log(
        '🔍 Time since last modal:',
        (now - lastModalTime) / (1000 * 60 * 60),
        'hours',
      );

      if (lastModalTime > twelveHoursAgo) {
        console.log('ℹ️ Modal shown within last 12 hours, not showing again');
        return false;
      }

      // Check if modal is already visible
      if (showBusinessInfoModal) {
        console.log('ℹ️ Modal already visible, not showing again');
        return false;
      }

      // Pre-fill form with existing data
      setBusinessInfoForm({
        ownerName: userData.ownerName || '',
        businessName: userData.businessName || '',
        businessType: userData.businessType || '',
        businessSize: userData.businessSize || '',
        industry: userData.industry || '',
        monthlyTransactionVolume: userData.monthlyTransactionVolume || '',
        currentAccountingSoftware: userData.currentAccountingSoftware || '',
      });

      // Save timestamp when modal is shown
      const modalData = {
        timestamp: now,
        date: new Date().toDateString(),
      };
      await AsyncStorage.setItem('lastModalShown', JSON.stringify(modalData));

      console.log('✅ Showing business info modal (12-hour limit)');

      setShowBusinessInfoModal(true);
      return true;
    } catch (error) {
      console.error('Error checking business info completion:', error);
      return false;
    }
  };

  // Handle business information form changes
  const handleBusinessInfoChange = (key: string, value: string) => {
    setBusinessInfoForm(prev => ({ ...prev, [key]: value }));
  };

  // Save business information
  const handleSaveBusinessInfo = async () => {
    // Validate required fields
    if (
      !businessInfoForm.ownerName.trim() ||
      !businessInfoForm.businessName.trim()
    ) {
      showCustomAlert(
        'Required Fields',
        'Please fill in your Full Name and Business Name.',
        'warning',
      );
      return;
    }

    setBusinessInfoSaving(true);

    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!accessToken || !userId) {
        throw new Error('Authentication required');
      }

      // Fetch CSRF token if not already available
      let currentCsrfToken = csrfToken;
      if (!currentCsrfToken) {
        currentCsrfToken = await fetchCSRFToken();
        if (!currentCsrfToken) {
          throw new Error('Failed to obtain CSRF token');
        }
      }

      // Use the same API pattern as ProfileScreen.tsx
      const allowedFields = [
        'ownerName',
        'businessName',
        'businessType',
        'businessSize',
        'industry',
        'monthlyTransactionVolume',
        'currentAccountingSoftware',
      ];

      const body: { id: any; [key: string]: any } = { id: userId };
      allowedFields.forEach(key => {
        if ((businessInfoForm as any)[key] !== undefined) {
          body[key] = (businessInfoForm as any)[key] || null;
        }
      });

      console.log('🔄 Saving business info with body:', body);
      console.log('🔍 Using token:', accessToken?.substring(0, 20) + '...');
      console.log('🔍 API URL:', `${BASE_URL}/user/edit-profile`);

      const response = await axios.patch(
        `${BASE_URL}/user/edit-profile`,
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-CSRF-Token': currentCsrfToken,
          },
          withCredentials: true, // Important for session cookies
        },
      );

      console.log('✅ Business info saved successfully:', response.data);

      // Update local user data (remove id from body before updating)
      const { id, ...userData } = body;
      setUserData((prev: any) => ({ ...prev, ...userData }));

      setShowBusinessInfoModal(false);
      setCheckingBusinessInfo(false);

      // Clear the modal timestamp since user completed the info
      await AsyncStorage.removeItem('lastModalShown');

      showCustomAlert(
        'Success',
        'Business information saved successfully!',
        'success',
      );
    } catch (error: any) {
      console.error('❌ Error saving business info:', error);

      let errorMessage =
        'Failed to save business information. Please try again.';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      showCustomAlert('Error', errorMessage, 'error');
    } finally {
      setBusinessInfoSaving(false);
    }
  };

  // Skip business information
  const handleSkipBusinessInfo = async () => {
    try {
      // Note: We don't set hasSeenBusinessInfo flag anymore since we use daily limits
      setShowBusinessInfoModal(false);
      setCheckingBusinessInfo(false);
    } catch (error) {
      console.error('Error skipping business info:', error);
    }
  };

  // Debug function to clear modal timestamp (for testing)
  const clearModalTimestamp = async () => {
    try {
      await AsyncStorage.removeItem('lastModalShown');
      console.log('✅ Modal timestamp cleared for testing');
    } catch (error) {
      console.error('Error clearing modal timestamp:', error);
    }
  };

  const applyFilters = (newFilters: FilterOptions) => {
    setFilterOptions(newFilters);
    setShowFilterModal(false);
  };

  // Enhanced filter modal with professional design
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#222"
              />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Filter Customers</Text>
              <Text style={styles.modalSubtitle}>
                Smart & organized filters
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Filter Content */}
          <View style={styles.modalBody}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalBodyContent}
              bounces={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Filters */}
              <View style={styles.quickFiltersSection}>
                <Text style={styles.sectionTitle}>Quick Filters</Text>
                <View style={styles.quickFiltersGrid}>
                  <TouchableOpacity
                    style={[
                      styles.quickFilterCard,
                      filterOptions.type === 'get' && styles.quickFilterActive,
                    ]}
                    onPress={() =>
                      setFilterOptions({ ...filterOptions, type: 'get' })
                    }
                  >
                    <View style={styles.quickFilterIcon}>
                      <MaterialCommunityIcons
                        name="arrow-down"
                        size={24}
                        color="#28a745"
                      />
                    </View>
                    <Text style={styles.quickFilterLabel}>Receipt</Text>
                    <Text style={styles.quickFilterSubtext}>
                      Receiving Money
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickFilterCard,
                      filterOptions.type === 'give' && styles.quickFilterActive,
                    ]}
                    onPress={() =>
                      setFilterOptions({ ...filterOptions, type: 'give' })
                    }
                  >
                    <View style={styles.quickFilterIcon}>
                      <MaterialCommunityIcons
                        name="arrow-up"
                        size={24}
                        color="#dc3545"
                      />
                    </View>
                    <Text style={styles.quickFilterLabel}>Payment</Text>
                    <Text style={styles.quickFilterSubtext}>Paying Money</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Amount Range */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Amount Range</Text>
                <View style={styles.amountRangeContainer}>
                  {[
                    { key: 'all', label: 'All', icon: 'filter-variant' },
                    { key: '0-1000', label: '₹0-1K', icon: 'currency-inr' },
                    { key: '1000-5000', label: '₹1K-5K', icon: 'currency-inr' },
                    {
                      key: '5000-10000',
                      label: '₹5K-10K',
                      icon: 'currency-inr',
                    },
                    { key: '10000+', label: '₹10K+', icon: 'currency-inr' },
                  ].map(range => (
                    <TouchableOpacity
                      key={range.key}
                      style={[
                        styles.amountRangeOption,
                        filterOptions.amountRange === range.key &&
                          styles.amountRangeActive,
                      ]}
                      onPress={() =>
                        setFilterOptions({
                          ...filterOptions,
                          amountRange: range.key as any,
                        })
                      }
                    >
                      <MaterialCommunityIcons
                        name={range.icon as any}
                        size={18}
                        color={
                          filterOptions.amountRange === range.key
                            ? '#fff'
                            : '#666'
                        }
                      />
                      <Text
                        style={[
                          styles.amountRangeText,
                          filterOptions.amountRange === range.key &&
                            styles.amountRangeTextActive,
                        ]}
                      >
                        {range.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Address Search */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Address Search</Text>
                <View style={styles.addressSearchContainer}>
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={18}
                    color="#666"
                    style={styles.addressIcon}
                  />
                  <TextInput
                    style={styles.addressSearchInput}
                    placeholder="Search by address..."
                    value={filterOptions.location}
                    onChangeText={text =>
                      setFilterOptions({ ...filterOptions, location: text })
                    }
                    placeholderTextColor="#8a94a6"
                  />
                  {filterOptions.location ? (
                    <TouchableOpacity
                      onPress={() =>
                        setFilterOptions({ ...filterOptions, location: '' })
                      }
                      style={styles.clearAddressButton}
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={18}
                        color="#8a94a6"
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Contact Info Filters */}
              <View style={styles.filterSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>

                <View style={styles.contactFilterGrid}>
                  {/* Phone Number Filter */}
                  <View style={styles.contactFilterCard}>
                    <View style={styles.contactFilterHeader}>
                      <MaterialCommunityIcons
                        name="phone"
                        size={20}
                        color="#666"
                      />
                      <Text style={styles.contactFilterTitle}>
                        Phone Number
                      </Text>
                    </View>
                    <View style={styles.contactFilterButtons}>
                      {[
                        { key: 'all', label: 'All', icon: 'filter-variant' },
                        { key: 'yes', label: 'Has Phone', icon: 'phone-check' },
                        { key: 'no', label: 'No Phone', icon: 'phone-off' },
                      ].map(option => (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.contactFilterButton,
                            filterOptions.hasPhone === option.key &&
                              styles.contactFilterButtonActive,
                          ]}
                          onPress={() =>
                            setFilterOptions({
                              ...filterOptions,
                              hasPhone: option.key as any,
                            })
                          }
                        >
                          <MaterialCommunityIcons
                            name={option.icon as any}
                            size={16}
                            color={
                              filterOptions.hasPhone === option.key
                                ? '#fff'
                                : '#666'
                            }
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.contactFilterButtonText,
                              filterOptions.hasPhone === option.key &&
                                styles.contactFilterButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* GST Number Filter */}
                  <View style={styles.contactFilterCard}>
                    <View style={styles.contactFilterHeader}>
                      <MaterialCommunityIcons
                        name="card-account-details"
                        size={20}
                        color="#666"
                      />
                      <Text style={styles.contactFilterTitle}>GST Number</Text>
                    </View>
                    <View style={styles.contactFilterButtons}>
                      {[
                        { key: 'all', label: 'All', icon: 'filter-variant' },
                        { key: 'yes', label: 'Has GST', icon: 'check-circle' },
                        { key: 'no', label: 'No GST', icon: 'close-circle' },
                      ].map(option => (
                        <TouchableOpacity
                          key={option.key}
                          style={[
                            styles.contactFilterButton,
                            filterOptions.hasGST === option.key &&
                              styles.contactFilterButtonActive,
                          ]}
                          onPress={() =>
                            setFilterOptions({
                              ...filterOptions,
                              hasGST: option.key as any,
                            })
                          }
                        >
                          <MaterialCommunityIcons
                            name={option.icon as any}
                            size={16}
                            color={
                              filterOptions.hasGST === option.key
                                ? '#fff'
                                : '#666'
                            }
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.contactFilterButtonText,
                              filterOptions.hasGST === option.key &&
                                styles.contactFilterButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setFilterOptions({
                  sortBy: 'date',
                  sortOrder: 'desc',
                  amountRange: 'all',
                  type: 'all',
                  location: '',
                  hasPhone: 'all',
                  hasGST: 'all',
                });
                setSearchQuery('');
              }}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={18}
                color="#dc3545"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilterModal(false)}
            >
              <MaterialCommunityIcons
                name="check"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Safety wrapper for filter modal
  const renderFilterModalSafely = () => {
    try {
      return renderFilterModal();
    } catch (error) {
      console.error('Error rendering filter modal:', error);
      return null; // Don't render modal if there's an error
    }
  };

  // Enhanced customer item renderer with strict text wrapping
  const renderCustomerItem = (customer: Customer, index: number) => {
    try {
      // Strict validation
      if (!customer || typeof customer !== 'object') {
        console.warn('Invalid customer data:', customer);
        return null;
      }

      // Validate all required fields
      const requiredFields = [
        'id',
        'name',
        'location',
        'lastInteraction',
        'amount',
        'type',
        'avatar',
      ] as const;
      for (const field of requiredFields) {
        if (customer[field] === undefined || customer[field] === null) {
          console.warn(`Missing required field: ${field}`, customer);
          return null;
        }
      }

      // Safe amount formatting
      let formattedAmount: string;
      try {
        const amount = Math.abs(Number(customer.amount) || 0);
        formattedAmount = amount === 0 ? '₹0' : `₹${amount.toLocaleString()}`;
      } catch (error) {
        console.warn('Amount formatting error:', error);
        formattedAmount = '₹0';
      }

      // COLOR LOGIC:
      // - "Receipt" = GREEN (#28a745) = Receiving money (good for business)
      // - "Payment" = RED (#dc3545) = Giving money away (cost for business)
      let amountColor: string;
      let amountLabel: string;
      try {
        if (customer.type === 'get') {
          amountColor = '#28a745'; // GREEN for "Receipt" (receiving money)
          amountLabel = 'Receipt';
        } else if (customer.type === 'give') {
          amountColor = '#dc3545'; // RED for "Payment" (giving money away)
          amountLabel = 'Payment';
        } else {
          amountColor = '#666';
          amountLabel = 'Unknown';
        }
      } catch (error) {
        console.warn('Type determination error:', error);
        amountColor = '#666';
        amountLabel = 'Unknown';
      }

      // Safe navigation handler
      const handleCustomerPress = () => {
        try {
          navigation.navigate('CustomerDetail', {
            customer: customer,
            partyType: activeTab === 'customers' ? 'customer' : 'supplier',
          });
        } catch (error) {
          console.error('Navigation error:', error);
          // Show alert or handle gracefully
        }
      };

      return (
        <TouchableOpacity
          key={`customer_${customer.id}_${index}`}
          onPress={handleCustomerPress}
        >
          <Animated.View
            style={[
              styles.customerItem,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.customerAvatar}>
              <Text style={styles.avatarText}>{customer.avatar || 'U'}</Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {customer.name || 'Unknown'}
              </Text>
              <Text style={styles.customerDate}>
                {customer.lastInteraction || 'Recently'}
              </Text>
              {/* Using ternary operator instead of && */}
              {!!customer.phoneNumber && customer.phoneNumber.trim() !== '' ? (
                <Text style={styles.customerPhone}>{customer.phoneNumber}</Text>
              ) : null}
            </View>
            <View style={styles.customerAmount}>
              <Text style={[styles.amountText, { color: amountColor }]}>
                {formattedAmount}
              </Text>
              <Text style={styles.amountLabel}>{amountLabel}</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Customer item rendering error:', error);
      return null;
    }
  };

  // Safety wrapper for rendering customer items
  const renderCustomerList = () => {
    try {
      if (!Array.isArray(filteredCustomers)) {
        console.warn('Filtered customers is not an array:', filteredCustomers);
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color="#dc3545"
            />
            <Text style={styles.emptyText}>Data Error</Text>
            <Text style={styles.emptySubtext}>Please refresh the screen</Text>
          </View>
        );
      }

      const validCustomers = filteredCustomers
        .filter(customer => customer && typeof customer === 'object')
        .map((customer, index) => renderCustomerItem(customer, index))
        .filter(Boolean); // Remove any null/undefined items

      if (validCustomers.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={
                activeTab === 'suppliers'
                  ? 'truck-delivery-outline'
                  : 'account-group-outline'
              }
              size={48}
              color="#666"
            />
            <Text style={styles.emptyText}>
              {tabText.emptyText || 'No items found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {tabText.emptySubtext || 'Add your first item to get started'}
            </Text>
          </View>
        );
      }

      return validCustomers;
    } catch (error) {
      console.error('Error rendering customer list:', error);
      return (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color="#dc3545"
          />
          <Text style={styles.errorText}>Rendering Error</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleManualRefresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  // Safety wrapper for summary section
  const renderSummarySection = () => {
    try {
      return (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Payment</Text>
              <Text style={[styles.summaryAmount, { color: '#dc3545' }]}>
                ₹{summaryData.payment.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Receipt</Text>
              <Text style={[styles.summaryAmount, { color: '#28a745' }]}>
                ₹{summaryData.receipt.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Sell and Purchase Data Display Row */}
          <View style={styles.dataDisplayRow}>
            <View style={styles.dataDisplayItem}>
              <Text style={styles.dataDisplayLabel}>Sell</Text>
              <Text style={[styles.dataDisplayAmount, { color: '#28a745' }]}>
                ₹{summaryData.sell.toLocaleString()}
              </Text>
            </View>
            <View style={styles.dataDisplayItem}>
              <Text style={styles.dataDisplayLabel}>Purchase</Text>
              <Text style={[styles.dataDisplayAmount, { color: '#dc3545' }]}>
                ₹{summaryData.purchase.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* View Report Button - Bottom */}
          <TouchableOpacity
            style={styles.bottomViewReportButton}
            onPress={handleViewReport}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={16}
              color="#4f8cff"
            />
            <Text style={styles.bottomViewReportText}>View Report</Text>
          </TouchableOpacity>
        </View>
      );
    } catch (error) {
      console.error('Error rendering summary section:', error);
      return (
        <View style={styles.summaryCard}>
          <Text style={styles.errorText}>Summary unavailable</Text>
        </View>
      );
    }
  };

  // Enhanced search and filter section with active filter count
  const renderSearchAndFilter = () => {
    try {
      const activeFilterCount = Object.values(filterOptions).filter(
        v => v !== 'date' && v !== 'desc' && v !== 'all' && v !== '',
      ).length;

      return (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color="#8a94a6" />
            <TextInput
              style={styles.searchInput}
              placeholder={
                tabText.searchPlaceholder ||
                'Search by name, location, phone, GST...'
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8a94a6"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color="#8a94a6"
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilterCount > 0 ? styles.filterButtonActive : {},
            ]}
            onPress={handleFilterPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color={activeFilterCount > 0 ? '#4f8cff' : '#8a94a6'}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      );
    } catch (error) {
      console.error('Error rendering search and filter:', error);
      return (
        <View style={styles.searchContainer}>
          <Text style={styles.errorText}>Search unavailable</Text>
        </View>
      );
    }
  };

  // Safety wrapper for header section
  const renderHeader = () => {
    try {
      return (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <MaterialCommunityIcons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={20}
              color="#fff"
            />
            <Text style={styles.headerText}>{businessName || 'User'}</Text>
          </View>
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => navigation.navigate('ProfileScreen', { user: {} })}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil" size={16} color="#fff" />
          </TouchableOpacity>

          <View style={{ width: 24 }} />
        </View>
      );
    } catch (error) {
      console.error('Error rendering header:', error);
      return (
        <View style={styles.header}>
          <Text style={styles.headerText}>Error</Text>
        </View>
      );
    }
  };

  // Safety wrapper for navigation tabs
  const renderNavigationTabs = () => {
    try {
      return (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'customers' ? styles.activeTab : {},
            ]}
            onPress={() => handleTabChange('customers')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'customers' ? styles.activeTabText : {},
              ]}
            >
              Customers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'suppliers' ? styles.activeTab : {},
            ]}
            onPress={() => handleTabChange('suppliers')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'suppliers' ? styles.activeTabText : {},
              ]}
            >
              Suppliers
            </Text>
          </TouchableOpacity>
        </View>
      );
    } catch (error) {
      console.error('Error rendering navigation tabs:', error);
      return (
        <View style={styles.tabContainer}>
          <Text style={styles.tabText}>Navigation Error</Text>
        </View>
      );
    }
  };

  // Safety wrapper for floating action button
  const renderFloatingActionButton = () => {
    try {
      return (
        <TouchableOpacity style={styles.fab} onPress={handleAddCustomer}>
          <MaterialCommunityIcons
            name={activeTab === 'suppliers' ? 'truck-plus' : 'account-plus'}
            size={24}
            color="#fff"
          />
          <Text style={styles.fabText}>{tabText.fabText || 'Add Item'}</Text>
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error rendering FAB:', error);
      return null; // Don't render FAB if there's an error
    }
  };

  // Main render function with error boundary
  const renderMainContent = () => {
    try {
      return (
        <>
          <StatusBar barStyle="light-content" backgroundColor="#4f8cff" />

          {/* Header */}
          {renderHeader()}

          {/* Navigation Tabs */}
          {renderNavigationTabs()}

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={globalCustomerCache.isRefreshing}
                onRefresh={async () => {
                  try {
                    console.log(
                      '🔄 CustomerScreen: Pull-to-refresh started...',
                    );

                    // Prevent multiple simultaneous refreshes
                    if (globalCustomerCache.isRefreshing) {
                      console.log(
                        '⏸️ Refresh already in progress, skipping...',
                      );
                      return;
                    }

                    globalCustomerCache.isRefreshing = true;
                    setError(null);

                    const accessToken = await AsyncStorage.getItem(
                      'accessToken',
                    );
                    if (!accessToken) {
                      throw new Error('Authentication required');
                    }

                    // Fetch fresh data in parallel
                    const [customersResult, userDataResult, vouchersResponse] =
                      await Promise.all([
                        fetchCustomersData(accessToken),
                        fetchUserData(accessToken),
                        fetch(`${BASE_URL}/vouchers`, {
                          headers: { Authorization: `Bearer ${accessToken}` },
                        })
                          .then(res => res.json())
                          .then(data => data?.data || [])
                          .catch(err => {
                            console.warn('Vouchers refresh failed:', err);
                            return globalCustomerCache.vouchers || [];
                          }),
                      ]);

                    // Update cache with fresh data
                    globalCustomerCache = {
                      customers: customersResult,
                      vouchers: vouchersResponse,
                      userData: userDataResult,
                      lastUpdated: Date.now(),
                      activeTab: activeTab,
                      isRefreshing: false,
                      isInitializing: false,
                      isComponentInitialized: true,
                    };

                    // Update state
                    setCustomers(customersResult);
                    setAllVouchers(vouchersResponse);
                    setUserData(userDataResult);
                    setBusinessName(
                      userDataResult?.businessName ||
                        userDataResult?.ownerName ||
                        'User',
                    );

                    console.log(
                      '✅ CustomerScreen: Pull-to-refresh completed - Customers:',
                      customersResult.length,
                    );
                  } catch (error) {
                    console.error(
                      '❌ CustomerScreen: Pull-to-refresh error:',
                      error,
                    );
                    setError(
                      error instanceof Error ? error.message : 'Refresh failed',
                    );
                  } finally {
                    globalCustomerCache.isRefreshing = false;
                  }
                }}
                colors={['#4f8cff']}
                tintColor="#4f8cff"
              />
            }
          >
            {/* Summary Card */}
            {renderSummarySection()}

            {/* Search and Filter */}
            {renderSearchAndFilter()}

            {/* Customer List */}
            <View style={styles.customerList}>
              {error ? (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={48}
                    color="#dc3545"
                  />
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleManualRefresh}
                  >
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : customers.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name={
                      activeTab === 'suppliers'
                        ? 'truck-delivery-outline'
                        : 'account-group-outline'
                    }
                    size={48}
                    color="#666"
                  />
                  <Text style={styles.emptyText}>
                    {tabText.emptyText || 'No items found'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {tabText.emptySubtext ||
                      'Add your first item to get started'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleManualRefresh}
                  >
                    <Text style={styles.retryButtonText}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                renderCustomerList()
              )}
            </View>
          </ScrollView>

          {/* Floating Action Button */}
          {renderFloatingActionButton()}

          {/* Filter Modal */}
          {renderFilterModalSafely()}

          {/* Business Information Modal */}
          {console.log(
            '🔍 Rendering Business Info Modal:',
            showBusinessInfoModal,
          )}
          <Modal
            visible={showBusinessInfoModal}
            transparent
            animationType="slide"
            onRequestClose={handleSkipBusinessInfo}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.businessInfoModalContent}>
                {/* Header */}
                <View style={styles.businessInfoModalHeader}>
                  <View style={styles.businessInfoModalTitleContainer}>
                    <View style={styles.businessInfoModalIconContainer}>
                      <MaterialCommunityIcons
                        name="briefcase"
                        size={24}
                        color="#4f8cff"
                      />
                    </View>
                    <View style={styles.businessInfoModalTitleTextContainer}>
                      <Text style={styles.businessInfoModalTitle}>
                        Business Information
                      </Text>
                      <Text style={styles.businessInfoModalSubtitle}>
                        Complete your profile to get personalized features and
                        better insights for your business.
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleSkipBusinessInfo}
                    style={styles.businessInfoModalCloseButton}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={24}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <ScrollView
                  style={styles.businessInfoModalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.businessInfoModalScrollContent}
                >
                  {/* Personal Information Section */}
                  <View style={styles.businessInfoSection}>
                    <View style={styles.businessInfoSectionHeader}>
                      <View style={styles.businessInfoSectionIconContainer}>
                        <MaterialCommunityIcons
                          name="account"
                          size={18}
                          color="#4f8cff"
                        />
                      </View>
                      <Text style={styles.businessInfoSectionTitle}>
                        Personal Information
                      </Text>
                    </View>

                    {/* Full Name */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Full Name *
                      </Text>
                      <TextInput
                        ref={ownerNameRef}
                        style={styles.businessInfoTextInput}
                        value={businessInfoForm.ownerName}
                        onChangeText={value =>
                          handleBusinessInfoChange('ownerName', value)
                        }
                        placeholder="Enter your full name"
                        placeholderTextColor="#8a94a6"
                        returnKeyType="next"
                        onSubmitEditing={() =>
                          handleSubmitEditing(businessNameRef)
                        }
                        blurOnSubmit={false}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>

                    {/* Business Name */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Business Name *
                      </Text>
                      <TextInput
                        ref={businessNameRef}
                        style={styles.businessInfoTextInput}
                        value={businessInfoForm.businessName}
                        onChangeText={value =>
                          handleBusinessInfoChange('businessName', value)
                        }
                        placeholder="Enter your business name"
                        placeholderTextColor="#8a94a6"
                        returnKeyType="next"
                        onSubmitEditing={() => {
                          // Focus will move to dropdowns, so we'll handle this differently
                          // For now, just blur the current field
                          businessNameRef.current?.blur();
                        }}
                        blurOnSubmit={true}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Business Information Section */}
                  <View style={styles.businessInfoSection}>
                    <View style={styles.businessInfoSectionHeader}>
                      <View style={styles.businessInfoSectionIconContainer}>
                        <MaterialCommunityIcons
                          name="briefcase"
                          size={18}
                          color="#4f8cff"
                        />
                      </View>
                      <Text style={styles.businessInfoSectionTitle}>
                        Business Information
                      </Text>
                    </View>

                    {/* Business Type */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Business Type
                      </Text>
                      <Dropdown
                        style={styles.businessInfoDropdown}
                        placeholderStyle={
                          styles.businessInfoDropdownPlaceholder
                        }
                        selectedTextStyle={
                          styles.businessInfoDropdownSelectedText
                        }
                        data={businessTypes.map(item => ({
                          label: item,
                          value: item,
                        }))}
                        maxHeight={200}
                        labelField="label"
                        valueField="value"
                        placeholder="Select business type"
                        value={businessInfoForm.businessType}
                        onChange={item =>
                          handleDropdownChange(
                            'businessType',
                            item.value,
                            accountingSoftwareRef,
                          )
                        }
                        containerStyle={styles.businessInfoDropdownContainer}
                      />
                    </View>

                    {/* Business Size */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Business Size
                      </Text>
                      <Dropdown
                        style={styles.businessInfoDropdown}
                        placeholderStyle={
                          styles.businessInfoDropdownPlaceholder
                        }
                        selectedTextStyle={
                          styles.businessInfoDropdownSelectedText
                        }
                        data={businessSizes.map(item => ({
                          label: item,
                          value: item,
                        }))}
                        maxHeight={200}
                        labelField="label"
                        valueField="value"
                        placeholder="Select business size"
                        value={businessInfoForm.businessSize}
                        onChange={item =>
                          handleDropdownChange(
                            'businessSize',
                            item.value,
                            accountingSoftwareRef,
                          )
                        }
                        containerStyle={styles.businessInfoDropdownContainer}
                      />
                    </View>

                    {/* Industry */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>Industry</Text>
                      <Dropdown
                        style={styles.businessInfoDropdown}
                        placeholderStyle={
                          styles.businessInfoDropdownPlaceholder
                        }
                        selectedTextStyle={
                          styles.businessInfoDropdownSelectedText
                        }
                        data={industries.map(item => ({
                          label: item,
                          value: item,
                        }))}
                        maxHeight={200}
                        labelField="label"
                        valueField="value"
                        placeholder="Select industry"
                        value={businessInfoForm.industry}
                        onChange={item =>
                          handleDropdownChange(
                            'industry',
                            item.value,
                            accountingSoftwareRef,
                          )
                        }
                        containerStyle={styles.businessInfoDropdownContainer}
                      />
                    </View>

                    {/* Monthly Transaction Volume */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Monthly Transaction Volume
                      </Text>
                      <Dropdown
                        style={styles.businessInfoDropdown}
                        placeholderStyle={
                          styles.businessInfoDropdownPlaceholder
                        }
                        selectedTextStyle={
                          styles.businessInfoDropdownSelectedText
                        }
                        data={transactionVolumes.map(item => ({
                          label: item,
                          value: item,
                        }))}
                        maxHeight={200}
                        labelField="label"
                        valueField="value"
                        placeholder="Select transaction volume"
                        value={businessInfoForm.monthlyTransactionVolume}
                        onChange={item =>
                          handleDropdownChange(
                            'monthlyTransactionVolume',
                            item.value,
                            accountingSoftwareRef,
                          )
                        }
                        containerStyle={styles.businessInfoDropdownContainer}
                      />
                    </View>

                    {/* Current Accounting Software */}
                    <View style={styles.businessInfoFormField}>
                      <Text style={styles.businessInfoFormLabel}>
                        Current Accounting Software
                      </Text>
                      <TextInput
                        ref={accountingSoftwareRef}
                        style={styles.businessInfoTextInput}
                        value={businessInfoForm.currentAccountingSoftware}
                        onChangeText={value =>
                          handleBusinessInfoChange(
                            'currentAccountingSoftware',
                            value,
                          )
                        }
                        placeholder="Enter your current accounting software"
                        placeholderTextColor="#8a94a6"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          // This is the last field, so we'll blur it
                          accountingSoftwareRef.current?.blur();
                        }}
                        blurOnSubmit={true}
                        autoCapitalize="words"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                </ScrollView>

                {/* Fixed Footer */}
                <View style={styles.businessInfoModalFooter}>
                  <TouchableOpacity
                    style={styles.businessInfoModalSkipButton}
                    onPress={handleSkipBusinessInfo}
                  >
                    <Text style={styles.businessInfoModalSkipText}>
                      Skip for now
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.businessInfoModalSaveButton,
                      businessInfoSaving &&
                        styles.businessInfoModalSaveButtonDisabled,
                    ]}
                    onPress={handleSaveBusinessInfo}
                    disabled={businessInfoSaving}
                  >
                    {businessInfoSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.businessInfoModalSaveText}>
                        Save Information
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Custom Alert Modal */}
          {customAlert.visible && (
            <View style={styles.alertOverlay}>
              <View style={styles.alertContainer}>
                {/* Alert Icon with Background Circle */}
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
                      activeOpacity={0.7}
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
                    activeOpacity={0.8}
                  >
                    <Text style={styles.alertButtonConfirmText}>
                      {customAlert.confirmText}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </>
      );
    } catch (error) {
      console.error('Main render error:', error);
      setHasError(true);
      setErrorDetails(
        error instanceof Error ? error.message : 'Unknown render error',
      );
      return null;
    }
  };

  // Nuclear option: Force all text to be wrapped
  const ForceText = ({ children, style, ...props }: any) => {
    try {
      // If it's already a Text component, return it
      if (React.isValidElement(children) && children.type === Text) {
        return children;
      }

      // If it's any other React element, wrap it in Text
      if (React.isValidElement(children)) {
        return (
          <Text style={style} {...props}>
            {children}
          </Text>
        );
      }

      // If it's a string, number, or any other primitive, wrap it
      if (children !== null && children !== undefined) {
        return (
          <Text style={style} {...props}>
            {String(children)}
          </Text>
        );
      }

      // If it's null/undefined, return null
      return null;
    } catch (error) {
      console.error('ForceText error:', error);
      return (
        <Text style={style} {...props}>
          Error
        </Text>
      );
    }
  };

  // Ultra-safe renderer that catches everything
  const UltraSafeRender = ({
    children,
    fallback = null,
  }: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => {
    try {
      // Recursively wrap all text content
      const wrapTextContent = (element: any): any => {
        if (!element) return element;

        if (typeof element === 'string' || typeof element === 'number') {
          return <Text>{String(element)}</Text>;
        }

        if (Array.isArray(element)) {
          return element.map((item, index) => wrapTextContent(item));
        }

        if (React.isValidElement(element)) {
          // If it's a Text component, return as is
          if (element.type === Text) {
            return element;
          }

          // If it has children, recursively wrap them
          if (element.props && (element.props as any).children) {
            const wrappedChildren = wrapTextContent(
              (element.props as any).children,
            );
            return React.cloneElement(element as any, {
              ...element.props,
              children: wrappedChildren,
            });
          }

          return element;
        }

        return element;
      };

      return wrapTextContent(children);
    } catch (error) {
      console.error('UltraSafeRender error:', error);
      return fallback;
    }
  };

  // Error state removed - no more "Content loading..." screen

  // 🚨 REMOVED: Loading screen completely

  return (
    <SafeAreaView style={styles.container} key={refreshKey}>
      {(() => {
        try {
          return renderMainContent();
        } catch (error) {
          console.error('Component render error:', error);
          setHasError(true);
          setErrorDetails(
            error instanceof Error ? error.message : 'Render error',
          );
          return (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={48}
                color="#dc3545"
              />
              <Text style={styles.errorText}>Render Error</Text>
              <Text style={styles.errorText}>
                {error instanceof Error ? error.message : 'Unknown error'}
              </Text>
            </View>
          );
        }
      })()}
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
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  editIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 12,
  },
  headerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4f8cff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  activeTabText: {
    color: '#4f8cff',
    fontWeight: '600',
  },
  supplierTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 4.5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 7.5,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  bottomViewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    marginTop: 12,
    marginHorizontal: 12,
    backgroundColor: '#f0f6ff',
    borderWidth: 1,
    borderColor: '#4f8cff',
    borderRadius: 6,
    gap: 6,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomViewReportText: {
    color: '#4f8cff',
    fontSize: 10.5,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  dataDisplayRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 0.5,
    borderTopColor: '#e5e5e5',
  },
  dataDisplayItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4.5,
  },
  dataDisplayLabel: {
    fontSize: 10.5,
    color: '#666',
    marginBottom: 3,
    fontWeight: '500',
  },
  dataDisplayAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  filterButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: '#4f8cff',
    borderWidth: 2,
    backgroundColor: '#f0f6ff',
  },
  customerList: {
    marginBottom: 60, // Space for FAB
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  customerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  customerDate: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  customerAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 9,
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  errorText: {
    marginTop: 9,
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 9,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  emptySubtext: {
    fontSize: 10.5,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: 37.5,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10.5,
    paddingBottom: 7.5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#222',
  },
  modalSubtitle: {
    fontSize: 7.5,
    color: '#666',
    marginTop: 0.75,
    textAlign: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    paddingBottom: 0,
    minHeight: 0,
  },
  modalBodyContent: {
    padding: 12,
    paddingBottom: 12,
  },
  closeButton: {
    padding: 3,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 11.25,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    minWidth: 63.75,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterOptionSelected: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  filterOptionText: {
    fontSize: 10.5,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10.5,
    paddingTop: 7.5,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10.5,
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#dc3545',
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resetButtonText: {
    color: '#dc3545',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f8cff',
    borderWidth: 2,
    borderColor: '#4f8cff',
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  locationInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 13.5,
    paddingVertical: 10.5,
    fontSize: 12,
    color: '#222',
    backgroundColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterBadge: {
    position: 'absolute',
    top: -4.5,
    right: -4.5,
    backgroundColor: '#e91e63',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  scrollIndicator: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  scrollIndicatorBar: {
    width: 30,
    height: 3,
    backgroundColor: '#d1d5db',
    borderRadius: 1.5,
  },
  scrollHint: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  scrollHintText: {
    fontSize: 10.5,
    color: '#666',
    marginTop: 3,
    textAlign: 'center',
  },
  quickFiltersSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 9,
    letterSpacing: -0.3,
  },
  quickFiltersGrid: {
    flexDirection: 'row',
    gap: 7.5,
  },
  quickFilterCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 9,
    padding: 9,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickFilterActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  quickFilterIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickFilterLabel: {
    fontSize: 9.75,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 1.5,
    textAlign: 'center',
  },
  quickFilterSubtext: {
    fontSize: 7.5,
    color: '#6b7280',
    textAlign: 'center',
  },
  amountRangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4.5,
  },
  amountRangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    minWidth: 52.5,
    justifyContent: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  amountRangeActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  amountRangeText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
  },
  amountRangeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  locationSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  locationIcon: {
    marginRight: 9,
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '500',
  },
  clearLocationButton: {
    padding: 3,
    marginLeft: 6,
  },
  addressSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 7.5,
    paddingHorizontal: 9,
    paddingVertical: 2.25,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressIcon: {
    marginRight: 7.5,
  },
  addressSearchInput: {
    flex: 1,
    fontSize: 10.5,
    color: '#1f2937',
    fontWeight: '500',
  },
  clearAddressButton: {
    padding: 3,
    marginLeft: 4.5,
  },
  contactFilterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  contactFilterItem: {
    flex: 1,
  },
  contactFilterLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  contactFilterOptions: {
    flexDirection: 'row',
    gap: 4.5,
  },
  contactFilterOption: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactFilterActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  contactFilterOptionText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
  },
  contactFilterOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  contactFilterGrid: {
    flexDirection: 'column',
    gap: 9,
  },
  contactFilterCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10.5,
    padding: 10.5,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  contactFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7.5,
    gap: 4.5,
  },
  contactFilterTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1f2937',
  },
  contactFilterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4.5,
  },
  contactFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7.5,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minWidth: 52.5,
  },
  contactFilterButtonActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  contactFilterButtonText: {
    fontSize: 8.25,
    color: '#6b7280',
    fontWeight: '600',
  },
  contactFilterButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  businessNameModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    maxWidth: 300,
  },
  businessNameModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessNameModalTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#222',
  },
  businessNameModalCloseButton: {
    padding: 3,
  },
  businessNameModalBody: {
    marginBottom: 18,
  },
  businessNameModalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  businessNameModalInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 9,
    fontSize: 12,
    color: '#222',
    backgroundColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  businessNameModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  businessNameModalCancelButton: {
    flex: 1,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#dc3545',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 6,
  },
  businessNameModalCancelText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  businessNameModalSaveButton: {
    flex: 1,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#28a745',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 6,
  },
  businessNameModalSaveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Business Information Modal Styles
  businessInfoModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    flex: 1,
    flexDirection: 'column',
  },
  businessInfoModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  businessInfoModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  businessInfoModalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  businessInfoModalTitleTextContainer: {
    flex: 1,
  },
  businessInfoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  businessInfoModalSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  businessInfoModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessInfoModalBody: {
    padding: 20,
    paddingTop: 12,
  },
  businessInfoModalScrollView: {
    flex: 1,
  },
  businessInfoModalScrollContent: {
    padding: 24,
    paddingBottom: 20,
  },
  businessInfoFormField: {
    marginBottom: 20,
  },
  businessInfoFormLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  businessInfoDropdown: {
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    minHeight: 48,
  },
  businessInfoDropdownPlaceholder: {
    color: '#8a94a6',
    fontSize: 14,
  },
  businessInfoDropdownSelectedText: {
    color: '#222',
    fontSize: 14,
  },
  businessInfoDropdownContainer: {
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  businessInfoTextInput: {
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#f8fafc',
    minHeight: 48,
  },
  businessInfoModalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafbfc',
    gap: 12,
  },
  businessInfoModalSkipButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  businessInfoModalSkipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  businessInfoModalSaveButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  businessInfoModalSaveButtonDisabled: {
    opacity: 0.7,
  },
  businessInfoModalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Enhanced Business Info Modal Styles
  businessInfoSection: {
    marginBottom: 24,
  },
  businessInfoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  businessInfoSectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  businessInfoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 15,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 24,
    marginHorizontal: 15,
    maxWidth: 255,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  alertIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 9,
    letterSpacing: 0.3,
  },
  alertMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  alertButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  alertButtonCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    letterSpacing: 0.2,
  },
  alertButtonConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
});

export default CustomerScreen;
