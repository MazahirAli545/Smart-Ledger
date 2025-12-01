import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Modal,
  Animated,
  RefreshControl,
  StatusBar,
  Alert,
  Platform,
  DeviceEventEmitter,
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
import { useNotifications } from '../../context/NotificationContext';
import { useSubscription } from '../../context/SubscriptionContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { profileUpdateManager } from '../../utils/profileUpdateManager';
import {
  loadFromPersistentCache,
  saveToPersistentCache,
} from '../../utils/persistentCache';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import { Dropdown } from 'react-native-element-dropdown';
import {
  businessTypes,
  businessSizes,
  industries,
  transactionVolumes,
} from '../../utils/dropdownOptions';
import TopTabs from '../../components/TopTabs';
import PartyList, { PartyItem } from '../../components/PartyList';

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

// 🎯 FIXED: Rate limiting protection to prevent 429 errors
let isFetchingCustomers = false;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between API calls (reduced for better responsiveness)

// Cache TTL: 5 minutes (300,000 ms) - increased for better cold start performance
const CACHE_TTL = 5 * 60 * 1000;

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

export const clearVoucherCache = () => {
  console.log('🧹 Clearing voucher cache...');
  globalCustomerCache.vouchers = [];
  globalCustomerCache.lastUpdated = 0;
  console.log('✅ Voucher cache cleared');
};

// Function to mark cache as stale so it will be refetched
export const markCacheStale = () => {
  console.log('⏰ Marking cache as stale...');
  globalCustomerCache.lastUpdated = 0;
  globalCustomerCache.isRefreshing = false;
  console.log('✅ Cache marked as stale');
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
      // Use unified API with caching
      const customersResult = (await unifiedApi.getCustomers('', 1, 50)) as {
        data: any;
        status: number;
        headers: Headers;
      };

      if (customersResult) {
        // Backend returns a paginated shape { data, total, page, limit }
        const resultData = customersResult?.data || customersResult || {};
        const list = Array.isArray(resultData?.data)
          ? resultData.data
          : Array.isArray(resultData)
          ? resultData
          : Array.isArray(customersResult?.data)
          ? customersResult.data
          : [];
        globalCustomerCache.customers = list;
        globalCustomerCache.lastUpdated = Date.now();
      }
    }

    if (dataType === 'userData' || dataType === 'all') {
      const userId = await getUserIdFromToken();
      if (userId) {
        // Use unified API with caching
        const userDataResult = (await unifiedApi.getUserProfile()) as {
          data: any;
          status: number;
          headers: Headers;
        };

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

// Utility: STRICT De-duplicate customers by ID only
// This is critical to prevent React duplicate key errors
const dedupeCustomers = (list: Customer[]): Customer[] => {
  try {
    if (!Array.isArray(list)) return [];
    const seenIds = new Set<string | number>();
    const result: Customer[] = [];
    let duplicateCount = 0;

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;

      const id = item.id;
      // If item has an ID, check for duplicates strictly by ID
      if (id !== undefined && id !== null) {
        const idStr = String(id);
        if (seenIds.has(idStr)) {
          duplicateCount++;
          console.warn('⚠️ dedupeCustomers: Removed duplicate ID:', {
            id: id,
            name: item.name,
          });
          continue; // Skip duplicate - only keep first occurrence
        }
        seenIds.add(idStr);
      }
      // If no ID, allow it (will get unique key via index in rendering)
      result.push(item);
    }

    if (duplicateCount > 0) {
      console.log(
        `🔍 dedupeCustomers: Removed ${duplicateCount} duplicate(s) from ${list.length} items`,
      );
    }

    return result;
  } catch (e) {
    console.warn('Deduplication error:', e);
    return Array.isArray(list) ? list : [];
  }
};

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

const PAGE_SIZE = 20;

const CustomerScreen: React.FC = () => {
  // Screen tracking hook
  useScreenTracking();

  // Unique key generator - uses stable index + customer ID for stable but unique keys
  // Index is ALWAYS unique in array.map(), so this guarantees uniqueness
  const getUniqueKey = useCallback(
    (index: number, customerId: string | number | undefined | null) => {
      // CRITICAL: Index is ALWAYS unique in array.map() (0, 1, 2, 3...)
      // Use index as PRIMARY differentiator to guarantee absolute uniqueness
      const id =
        customerId !== undefined && customerId !== null
          ? String(customerId)
          : `no-id-${index}`;
      // Index first ensures uniqueness even if customer IDs are duplicated
      // Format: index-customerId (index guarantees uniqueness)
      return `idx-${index}-cust-${id}`;
    },
    [],
  );

  // Configure StatusBar like ProfileScreen: translucent with spacer for colored header
  const { statusBarSpacer } = useStatusBarWithGradient('Customer', [
    '#4f8cff',
    '#4f8cff',
  ]);
  const preciseStatusBarHeight = getStatusBarHeight(true);

  // Notification service for FCM token management
  const { notificationService } = useNotifications();

  // Error boundary state
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Global error handler for any uncaught errors
  const handleError = (error: any) => {
    console.error('CustomerScreen Error:', error);
    setHasError(true);
    setErrorDetails(error?.message || 'Unknown error occurred');
  };

  // Set up global error handling (limit to RN text-render errors; downgrade API errors)
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      try {
        const first = args[0];
        // Only trigger error UI for the specific RN render error
        if (
          first &&
          typeof first === 'string' &&
          first.includes(
            "Text strings must be rendered within a <Text style={{ fontFamily: 'Roboto-Medium',  }}> component",
          )
        ) {
          handleError(new Error('Text rendering error detected'));
          originalConsoleError.apply(console, args);
          return;
        }

        // Downgrade common API/axios errors so LogBox doesn't point to this override
        const looksLikeAxiosError =
          (typeof first === 'string' &&
            (first.includes('AxiosError') ||
              first.includes('Request failed with status code') ||
              first.includes('Network Error'))) ||
          args.some(
            a =>
              a &&
              typeof a === 'object' &&
              (a as any)?.response &&
              (a as any)?.response?.status,
          );

        if (looksLikeAxiosError) {
          // Use log instead of error to avoid red LogBox overlay
          console.log(...args);
          return;
        }

        // Fallback to original behavior for other errors
        originalConsoleError.apply(console, args);
      } catch (e) {
        // If anything goes wrong, avoid crashing the app
        originalConsoleError.apply(console, args);
      }
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
  const { currentSubscription, fetchSubscriptionData } = useSubscription();

  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>(
    'customers',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allVouchers, setAllVouchers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[] | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[] | null>(null);
  const [rbacBlocked, setRbacBlocked] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [headerKey, setHeaderKey] = useState<number>(0);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const headerFetchAttemptedRef = useRef<boolean>(false);

  // Minimal fallback fetch that bypasses axios interceptors
  const forceFetchProfileForHeader = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;
      // Use unified API - try primary endpoint first
      try {
        const body = (await unifiedApi.getUserProfile()) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const p = body?.data ?? body ?? {};
        const name =
          p.businessName ||
          p.business_name ||
          p.companyName ||
          p.company_name ||
          (p.business && (p.business.name || p.business.title)) ||
          (p.profile && p.profile.businessName) ||
          '';
        if (name && String(name).trim().length > 0) {
          updateBusinessNameIfPresent(String(name));
          // also persist a lightweight cache for next launch
          try {
            await AsyncStorage.setItem(
              'cachedUserData',
              JSON.stringify({ ...(p || {}), businessName: String(name) }),
            );
          } catch {}
          return;
        }
      } catch {}
    } catch {}
  };

  // Prevent overwriting a valid business name with an empty value during
  // background refreshes, cache loads, or transient fetch failures.
  const updateBusinessNameIfPresent = (maybeName?: string | null) => {
    const trimmed = (maybeName ?? '').trim();
    if (trimmed.length > 0) {
      setBusinessName(trimmed);
      setHeaderKey(prev => prev + 1);
    }
  };

  // Resolve the header title: show "My Business" while loading/unavailable, else real name
  const getHeaderDisplayName = (): string => {
    try {
      const fromUserData =
        (userData &&
          ((userData as any).businessName ||
            (userData as any).business_name ||
            (userData as any).companyName ||
            (userData as any).company_name ||
            ((userData as any).business &&
              (((userData as any).business as any).name ||
                ((userData as any).business as any).title)) ||
            ((userData as any).profile &&
              ((userData as any).profile as any).businessName))) ||
        '';

      const candidate = String(fromUserData || businessName || '').trim();

      const isLoading =
        globalCustomerCache.isInitializing ||
        (globalCustomerCache.isRefreshing && candidate.length === 0) ||
        (!userData && candidate.length === 0);

      return isLoading ? 'My Business' : candidate || 'My Business';
    } catch {
      return 'My Business';
    }
  };

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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [customers.length, activeTab]);

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ref to track last button press time for debouncing
  const lastAddCustomerPressRef = useRef<number>(0);

  // Refs for form field focus management
  const ownerNameRef = useRef<TextInput>(null);
  const businessNameRef = useRef<TextInput>(null);
  const accountingSoftwareRef = useRef<TextInput>(null);

  // Optional CSRF support: try common endpoints; proceed without if unavailable
  const [csrfToken] = useState<string | null>(null);
  const fetchCSRFToken = async (): Promise<string | null> => {
    try {
      const endpoints = ['/csrf-token', '/auth/csrf', '/user/csrf'];
      for (const endpoint of endpoints) {
        try {
          const res = (await unifiedApi.get(endpoint, {
            skipAuth: true, // CSRF token might not require auth
          })) as { data: any; status: number; headers: Headers };
          // unifiedApi returns { data, status, headers } structure
          if (res.status < 200 || res.status >= 300) continue;
          const headerTok = res.headers.get('x-csrf-token');
          if (headerTok && String(headerTok).trim()) return headerTok;
          const body = res.data || res;
          const tok =
            body?.csrfToken ||
            body?._csrf ||
            body?.token ||
            body?.data?.csrfToken;
          if (tok && String(tok).trim()) return String(tok);
        } catch {}
      }
    } catch {}
    return null;
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

      const response = (await unifiedApi.post('/user/auth/refresh', {
        refreshToken: refreshToken,
      })) as { data: any; status: number; headers: Headers };

      // unifiedApi returns { data, status, headers } structure
      const responseData = response.data || response;
      if (responseData?.success && responseData?.accessToken) {
        const newAccessToken = responseData.accessToken;
        await AsyncStorage.setItem('accessToken', newAccessToken);
        console.log('✅ Access token refreshed successfully');
        return newAccessToken;
      } else {
        console.log('❌ Failed to refresh token:', responseData);
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

      const response = (await unifiedApi.patch('/user/edit-profile', testBody, {
        headers: {
          'X-CSRF-Token': testCsrfToken,
        },
      })) as { data: any; status: number; headers: Headers };

      // unifiedApi returns { data, status, headers } structure
      const responseData = response.data || response;
      console.log('✅ API test successful:', responseData);
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

  // Load roles on mount for RBAC-aware UI/requests
  useEffect(() => {
    (async () => {
      try {
        const rolesJson = await AsyncStorage.getItem('userRoles');
        if (rolesJson) {
          const roles = JSON.parse(rolesJson);
          setUserRoles(roles);
          console.log(
            '🔐 CustomerScreen roles:',
            Array.isArray(roles) ? roles.map((r: any) => r?.name || r) : roles,
          );
        }
        const permsJson = await AsyncStorage.getItem('userPermissions');
        if (permsJson) {
          const perms = JSON.parse(permsJson);
          setUserPermissions(perms);
          console.log('🔐 CustomerScreen permissions:', perms);
        }
      } catch (e) {
        console.warn('Failed to load userRoles:', e);
      }
    })();
  }, []);

  // FCM Token Refresh - Refresh token when screen is focused
  useEffect(() => {
    const refreshFCMToken = async () => {
      try {
        console.log('🔄 CustomerScreen: Refreshing FCM token...');

        // First check if user is authenticated
        const accessToken = await AsyncStorage.getItem('accessToken');
        if (!accessToken) {
          console.warn(
            '⚠️ CustomerScreen: No access token available - user not authenticated',
          );
          return;
        }

        console.log(
          '✅ CustomerScreen: User is authenticated, proceeding with FCM token refresh',
        );

        // Check if user has declined notification permission
        const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
        if (neverAsk === 'true') {
          console.log(
            '⚠️ CustomerScreen: Notification permission declined - skipping all notification work',
          );
          return; // hard stop: do not init or refresh token
        } else {
          // Ensure notifications are initialized
          if (!notificationService.isServiceInitialized()) {
            // Check if user has declined before initializing
            const userDeclined =
              await notificationService.hasUserDeclinedNotifications();
            if (userDeclined) {
              console.log(
                '⚠️ CustomerScreen: User has declined notification permission - skipping initialization',
              );
            } else {
              console.log(
                '🔧 CustomerScreen: Initializing notification service...',
              );
              const initResult =
                await notificationService.initializeNotifications();
              console.log(
                '🔧 CustomerScreen: Notification service init result:',
                initResult,
              );
            }
          }
        }

        // Refresh FCM token (will not run if neverAsk is true above)
        console.log('🔧 CustomerScreen: Calling refreshFCMToken...');
        const token = await notificationService.refreshFCMToken();
        console.log(
          '🔧 CustomerScreen: Token received:',
          token ? `${token.substring(0, 20)}...` : 'null',
        );

        if (token) {
          console.log('✅ CustomerScreen: FCM token refreshed successfully');
          console.log('🔧 CustomerScreen: Full token length:', token.length);

          // Send token to backend using notification service
          try {
            console.log('🔧 CustomerScreen: Sending FCM token to backend...');
            const success = await notificationService.sendTokenToBackend(token);
            if (success) {
              console.log(
                '✅ CustomerScreen: FCM token sent to backend successfully',
              );
            } else {
              console.warn(
                '⚠️ CustomerScreen: Failed to send FCM token to backend',
              );
            }
          } catch (error) {
            console.error(
              '❌ CustomerScreen: Error sending FCM token to backend:',
              error,
            );
          }

          // Check if token was sent to backend by checking the notification service
          const currentToken = notificationService.getCurrentFCMToken();
          console.log(
            '🔧 CustomerScreen: Current cached token:',
            currentToken ? `${currentToken.substring(0, 20)}...` : 'null',
          );
        } else {
          console.warn('⚠️ CustomerScreen: No FCM token available');
        }
      } catch (error) {
        console.warn('❌ CustomerScreen: Error refreshing FCM token:', error);
        console.error('❌ CustomerScreen: Full error details:', error);
      }
    };

    refreshFCMToken();
  }, [notificationService]);

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

  // 🎯 OPTIMIZED: Load persistent cache immediately, then fetch fresh data in background
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

        // 🚀 OPTIMIZATION: Load persistent cache immediately for instant display
        console.log('📦 CustomerScreen: Loading persistent cache...');
        const cachedCustomers = await loadFromPersistentCache<Customer[]>(
          'customers',
          CACHE_TTL,
        );
        const cachedVouchers = await loadFromPersistentCache<any[]>(
          'vouchers',
          CACHE_TTL,
        );
        const cachedUserData = await loadFromPersistentCache<any>(
          'userData',
          CACHE_TTL,
        );

        // Show cached data immediately if available
        if (cachedCustomers && cachedCustomers.length > 0) {
          console.log(
            `✅ CustomerScreen: Loaded ${cachedCustomers.length} customers from persistent cache`,
          );
          setCustomers(cachedCustomers);
          globalCustomerCache.customers = cachedCustomers;
          globalCustomerCache.lastUpdated = Date.now();
        }
        if (cachedVouchers && cachedVouchers.length > 0) {
          setAllVouchers(cachedVouchers);
          globalCustomerCache.vouchers = cachedVouchers;
        }
        if (cachedUserData) {
          setUserData(cachedUserData);
          globalCustomerCache.userData = cachedUserData;
          updateBusinessNameIfPresent(cachedUserData?.businessName);
        }

        // Fetch fresh data in background (non-blocking)
        console.log('🔄 CustomerScreen: Fetching fresh data in background...');
        Promise.all([
          fetchUserData(accessToken),
          fetchCustomersData(accessToken),
          // Use unified API with caching
          unifiedApi
            .getTransactions({ limit: 50 })
            .then((data: any) => (data?.data || data || []) as any[])
            .catch(err => {
              console.warn('Vouchers fetch failed:', err);
              return [];
            }),
        ])
          .then(([userDataResult, customersResult, vouchersResponse]) => {
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

            // Update state with fresh data
            setCustomers(customersResult);
            setAllVouchers(vouchersResponse);
            setUserData(userDataResult);
            updateBusinessNameIfPresent(userDataResult?.businessName);

            // Save to persistent cache for next cold start
            saveToPersistentCache('customers', customersResult);
            saveToPersistentCache('vouchers', vouchersResponse);
            saveToPersistentCache('userData', userDataResult);

            console.log('✅ CustomerScreen: Fresh data loaded and cached');
          })
          .catch(error => {
            console.error('❌ CustomerScreen: Background fetch error:', error);
            // Don't show error if we have cached data
            if (!cachedCustomers || cachedCustomers.length === 0) {
              setError(
                error instanceof Error ? error.message : 'Failed to load data',
              );
            }
          })
          .finally(() => {
            globalCustomerCache.isInitializing = false;
          });
      } catch (error) {
        console.error('❌ CustomerScreen: Initial data fetch error:', error);
        setError(
          error instanceof Error ? error.message : 'Failed to load data',
        );
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
      updateBusinessNameIfPresent(globalCustomerCache.userData?.businessName);
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
          fetch(`${BASE_URL}/transactions`, {
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
      updateBusinessNameIfPresent(userDataResult?.businessName);

      // Save to persistent cache for next cold start
      saveToPersistentCache('customers', customersResult);
      saveToPersistentCache('vouchers', vouchersResponse);
      saveToPersistentCache('userData', userDataResult);

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
        // Save to persistent cache
        saveToPersistentCache('customers', customersResult);
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

      // Check if data is stale (more than 2 seconds) - more aggressive refresh
      const isDataStale = Date.now() - globalCustomerCache.lastUpdated > 2000; // 2 seconds
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
        lastUpdated: globalCustomerCache.lastUpdated,
        timeSinceLastUpdate: Date.now() - globalCustomerCache.lastUpdated,
      });

      // Always refresh on focus to ensure data is up-to-date
      // This is especially important when returning from AddPartyScreen or PurchaseScreen
      if (
        !globalCustomerCache.isRefreshing &&
        !globalCustomerCache.isInitializing
      ) {
        console.log('🔄 Triggering refresh on focus to ensure fresh data...');
        setTimeout(() => {
          handleManualRefresh();
        }, 100); // Small delay to prevent conflicts
      } else if (shouldRefresh) {
        // If refresh is in progress but data is stale, queue another refresh
        console.log(
          '⏸️ Refresh in progress, will refresh again when complete...',
        );
        setTimeout(() => {
          if (!globalCustomerCache.isRefreshing) {
            handleManualRefresh();
          }
        }, 1500);
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

  // Listen for profile update events (e.g., when customer/supplier is deleted in AddPartyScreen)
  useEffect(() => {
    const handleProfileUpdate = async () => {
      try {
        console.log(
          '📢 CustomerScreen: Profile update event received, forcing full refresh...',
        );

        // Clear cache immediately to force fresh data fetch
        clearCustomerCache();
        clearVoucherCache();

        // Mark cache as stale to trigger refresh
        globalCustomerCache.lastUpdated = 0;
        globalCustomerCache.isRefreshing = false;

        // Invalidate API cache to ensure fresh data
        unifiedApi.invalidateCachePattern('.*/customers.*');
        unifiedApi.invalidateCachePattern('.*/customers/suppliers.*');
        unifiedApi.invalidateCachePattern('.*/transactions.*');

        // Trigger immediate refresh using handleManualRefresh which properly updates state
        // This will refresh the customers list while preserving pagination state
        console.log(
          '🔄 CustomerScreen: Triggering manual refresh after profile update...',
        );

        // Use a small delay to ensure cache invalidation is processed
        setTimeout(() => {
          handleManualRefresh();
        }, 100);
      } catch (error) {
        console.warn(
          '⚠️ CustomerScreen: Failed to refresh on profile update:',
          error,
        );
        // Fallback: try manual refresh anyway
        setTimeout(() => {
          handleManualRefresh();
        }, 500);
      }
    };

    // Listen for profile update events
    profileUpdateManager.onProfileUpdate(handleProfileUpdate);

    // Cleanup listener on unmount
    return () => {
      profileUpdateManager.offProfileUpdate(handleProfileUpdate);
    };
    // Note: handleManualRefresh is stable and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure business name is always up to date when userData changes
  useEffect(() => {
    if (userData) {
      const displayName = userData.businessName || '';
      if (businessName !== displayName) {
        console.log(
          '🔄 CustomerScreen: Updating business name from userData change:',
          {
            old: businessName,
            new: displayName,
          },
        );
        updateBusinessNameIfPresent(displayName);
      }
    }
  }, [userData, businessName]);

  // 🎯 ADDED: Initialize with cached user data on mount
  useEffect(() => {
    const initializeWithCachedData = async () => {
      try {
        const cachedUserData = await AsyncStorage.getItem('cachedUserData');
        if (cachedUserData) {
          const userData = JSON.parse(cachedUserData);
          if (userData && (userData.businessName || userData.ownerName)) {
            console.log(
              '🔄 CustomerScreen: Initializing with cached user data:',
              {
                businessName: userData.businessName,
                ownerName: userData.ownerName,
              },
            );
            updateBusinessNameIfPresent(
              userData.businessName ||
                userData.companyName ||
                userData.company_name ||
                (userData.business &&
                  (userData.business.name || userData.business.title)) ||
                (userData.profile && userData.profile.businessName) ||
                '',
            );
            setUserData(userData);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error initializing with cached user data:', error);
      }
    };

    initializeWithCachedData();
  }, []);

  // Ensure business name shows on first visit without navigating to Profile
  useEffect(() => {
    (async () => {
      try {
        if (headerFetchAttemptedRef.current) return;
        // If header is blank, proactively fetch profile once
        const isBlank = !businessName || String(businessName).trim() === '';
        if (isBlank) {
          headerFetchAttemptedRef.current = true;
          await fetchUserData();
          // If still blank after a short delay, attempt a minimal fetch bypass
          setTimeout(async () => {
            if (!businessName || String(businessName).trim() === '') {
              await forceFetchProfileForHeader();
            }
          }, 400);
        }
      } catch (e) {
        // no-op; avoid blocking UI
      }
    })();
  }, [businessName]);

  // 🎯 ADDED: Check for cached user data changes on focus
  useFocusEffect(
    React.useCallback(() => {
      const checkCachedUserData = async () => {
        try {
          const cachedUserData = await AsyncStorage.getItem('cachedUserData');
          if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            if (userData && (userData.businessName || userData.ownerName)) {
              console.log(
                '🔄 CustomerScreen: Updating from cached user data:',
                {
                  businessName: userData.businessName,
                  ownerName: userData.ownerName,
                },
              );
              updateBusinessNameIfPresent(userData.businessName || '');
              setUserData(userData);
            }
          }
        } catch (error) {
          console.warn('⚠️ Error checking cached user data:', error);
        }
      };

      checkCachedUserData();
    }, []),
  );

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
        '🔄 Route params indicate refresh needed, refreshing in background without clearing UI...',
      );
      setTimeout(() => {
        handleManualRefresh();
      }, 100);
    }
  }, [route.params?.selectedTab, route.params?.shouldRefresh]);

  // 🎯 ADDED: useFocusEffect for additional refresh trigger when returning from Add Customer
  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 CustomerScreen: useFocusEffect triggered');

      // Refresh FCM token when screen is focused
      const refreshFCMTokenOnFocus = async () => {
        try {
          console.log('🔄 CustomerScreen: Refreshing FCM token on focus...');

          // First check if user is authenticated
          const accessToken = await AsyncStorage.getItem('accessToken');
          if (!accessToken) {
            console.warn(
              '⚠️ CustomerScreen: No access token available on focus - user not authenticated',
            );
            return;
          }

          console.log(
            '✅ CustomerScreen: User is authenticated on focus, proceeding with FCM token refresh',
          );

          // Check if user has declined notification permission
          const neverAskOnFocus = await AsyncStorage.getItem(
            'notificationsNeverAsk',
          );
          if (neverAskOnFocus === 'true') {
            console.log(
              '⚠️ CustomerScreen: Notification permission declined on focus - skipping all notification work',
            );
            return; // hard stop on focus as well
          } else {
            // Ensure notifications are initialized
            if (!notificationService.isServiceInitialized()) {
              console.log(
                '🔧 CustomerScreen: Initializing notification service on focus...',
              );
              const initResult =
                await notificationService.initializeNotifications();
              console.log(
                '🔧 CustomerScreen: Notification service init result on focus:',
                initResult,
              );
            }
          }

          // Refresh FCM token (will not run if neverAskOnFocus is true above)
          console.log('🔧 CustomerScreen: Calling refreshFCMToken on focus...');
          const token = await notificationService.refreshFCMToken();
          console.log(
            '🔧 CustomerScreen: Token received on focus:',
            token ? `${token.substring(0, 20)}...` : 'null',
          );

          if (token) {
            console.log('✅ CustomerScreen: FCM token refreshed on focus');
            console.log(
              '🔧 CustomerScreen: Full token length on focus:',
              token.length,
            );

            // Send token to backend using notification service
            try {
              console.log('🔧 CustomerScreen: Sending FCM token to backend...');
              const success = await notificationService.sendTokenToBackend(
                token,
              );
              if (success) {
                console.log(
                  '✅ CustomerScreen: FCM token sent to backend successfully',
                );
              } else {
                console.warn(
                  '⚠️ CustomerScreen: Failed to send FCM token to backend',
                );
              }
            } catch (error) {
              console.error(
                '❌ CustomerScreen: Error sending FCM token to backend:',
                error,
              );
            }

            // Check if token was sent to backend by checking the notification service
            const currentToken = notificationService.getCurrentFCMToken();
            console.log(
              '🔧 CustomerScreen: Current cached token on focus:',
              currentToken ? `${currentToken.substring(0, 20)}...` : 'null',
            );
          } else {
            console.warn('⚠️ CustomerScreen: No FCM token available on focus');
          }
        } catch (error) {
          console.warn(
            '❌ CustomerScreen: Error refreshing FCM token on focus:',
            error,
          );
          console.error(
            '❌ CustomerScreen: Full error details on focus:',
            error,
          );
        }
      };

      // Refresh FCM token
      refreshFCMTokenOnFocus();

      // Check if we need to refresh (e.g., after adding a customer)
      const shouldRefresh = route.params?.shouldRefresh;
      const isDataStale = Date.now() - globalCustomerCache.lastUpdated > 2000; // 2 seconds - more aggressive
      const isCacheForcedStale = globalCustomerCache.lastUpdated === 0; // Force refresh if cache cleared

      console.log('🔍 useFocusEffect refresh check:', {
        shouldRefresh,
        isDataStale,
        isCacheForcedStale,
        lastUpdated: globalCustomerCache.lastUpdated,
        timeSinceLastUpdate: Date.now() - globalCustomerCache.lastUpdated,
        isRefreshing: globalCustomerCache.isRefreshing,
      });

      // Always refresh if cache is forced stale, shouldRefresh is true, or data is stale
      if (shouldRefresh || isCacheForcedStale || isDataStale) {
        if (shouldRefresh || isCacheForcedStale) {
          console.log(
            '🔄 useFocusEffect: Forcing refresh (shouldRefresh or cache cleared)...',
            {
              shouldRefresh,
              isCacheForcedStale,
              lastUpdated: globalCustomerCache.lastUpdated,
            },
          );
          // Clear cache to ensure fresh data including new vouchers
          clearCustomerCache();
          clearVoucherCache();
        }

        // Trigger refresh if not already refreshing
        if (
          !globalCustomerCache.isRefreshing &&
          !globalCustomerCache.isInitializing
        ) {
          setTimeout(() => {
            handleManualRefresh();
          }, 100);
        }
      } else {
        // Even if data seems fresh, do a lightweight refresh to catch any updates
        // This ensures data is always up-to-date when screen comes into focus
        if (
          !globalCustomerCache.isRefreshing &&
          !globalCustomerCache.isInitializing
        ) {
          console.log(
            '🔄 useFocusEffect: Triggering background refresh to ensure fresh data...',
          );
          setTimeout(() => {
            handleManualRefresh();
          }, 300);
        }
      }
    }, [route.params?.shouldRefresh, notificationService]),
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
      // Do NOT require decoding user ID before calling profile API.
      // Some environments may not support atob/decoding; always hit the API.

      // Try unified API's getUserProfile method first (most reliable)
      let res: any = null;
      try {
        res = await unifiedApi.getUserProfile();
        if (res?.data || res) {
          console.log('🔍 Loaded profile from getUserProfile()');
        }
      } catch (e) {
        console.warn(
          '⚠️ getUserProfile() failed, trying fallback endpoints...',
          e,
        );
      }

      // Fallback: Try multiple profile endpoints for robustness
      if (!res) {
        const endpoints = ['/user/profile', '/users/profile', '/profile'];
        for (const endpoint of endpoints) {
          try {
            const r = (await unifiedApi.get(endpoint)) as {
              data: any;
              status: number;
              headers: Headers;
            };
            // unifiedApi returns { data, status, headers } structure
            if (r?.data || r?.status >= 200) {
              res = r;
              console.log('🔍 Loaded profile from', endpoint);
              break;
            }
          } catch (e) {
            // try next
            console.warn(`⚠️ Profile endpoint ${endpoint} failed:`, e);
          }
        }
      }

      // If all endpoints failed, log warning but don't throw error
      if (!res) {
        console.warn(
          '⚠️ Profile request failed on all endpoints - using cached data if available',
        );
        // Try to use cached data as fallback
        try {
          const cachedData = await AsyncStorage.getItem('cachedUserData');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            if (parsed && typeof parsed === 'object') {
              console.log('🔄 Using cached user data as fallback');
              setUserData(parsed);
              updateBusinessNameIfPresent(parsed.businessName || '');
              return parsed;
            }
          }
        } catch (cacheErr) {
          console.warn('⚠️ Failed to load cached user data:', cacheErr);
        }
        // Return null gracefully instead of throwing
        return null;
      }

      // Safely handle various response shapes
      const apiPayload: any = res?.data ?? null;
      // Robust extraction: support many shapes
      const rawUser: any =
        apiPayload?.data?.user ??
        apiPayload?.data?.data?.user ??
        apiPayload?.data?.data ??
        apiPayload?.user ??
        apiPayload?.data ??
        null;

      if (!rawUser || typeof rawUser !== 'object') {
        console.warn(
          '⚠️ fetchUserData: No user object in response. Payload:',
          apiPayload,
        );
        // Keep existing header/business name; do not clear on malformed payload
        return null;
      }

      // Normalize user data strictly for Business Name from profile GET API
      const normalizedBusinessName =
        rawUser.businessName ||
        rawUser.business_name ||
        rawUser.companyName ||
        rawUser.company_name ||
        (rawUser.business &&
          (rawUser.business.name || rawUser.business.title)) ||
        (rawUser.profile && rawUser.profile.businessName) ||
        '';

      const user = {
        ownerName:
          rawUser.ownerName || rawUser.name || rawUser.fullName || 'User',
        businessName: normalizedBusinessName || '',
        mobileNumber:
          rawUser.mobileNumber || rawUser.phone || rawUser.mobile || '',
        planType:
          rawUser.planType ||
          rawUser.plan ||
          rawUser.subscription?.planName ||
          'free',
        ...rawUser,
      };

      setUserData(user);
      // Show Business Name only (profile GET API)
      updateBusinessNameIfPresent(
        user?.businessName ||
          (user as any)?.business_name ||
          (user as any)?.companyName ||
          (user as any)?.company_name ||
          ((user as any)?.business &&
            (((user as any).business as any).name ||
              ((user as any).business as any).title)) ||
          ((user as any)?.profile &&
            ((user as any).profile as any).businessName) ||
          '',
      );
      console.log(
        '🔄 CustomerScreen: Updated business name to:',
        user?.businessName || '',
      );

      // Update global cache
      globalCustomerCache.userData = user;
      globalCustomerCache.lastUpdated = Date.now();

      // Persist a lightweight cache for other screens
      try {
        await AsyncStorage.setItem('cachedUserData', JSON.stringify(user));
      } catch (cacheErr) {
        console.warn('⚠️ Unable to cache user profile:', cacheErr);
      }

      return user;
    } catch (err) {
      console.error('Error fetching user data:', err);
      // Do not clear a previously shown valid name on error
      // Simply skip update
      return null;
    }
  };

  const fetchCustomersData = async (
    accessToken?: string,
  ): Promise<Customer[]> => {
    // 🎯 FIXED: Rate limiting protection to prevent 429 errors
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;

    // Prevent rapid successive calls
    if (isFetchingCustomers) {
      console.log('⏸️ CustomerScreen: Fetch already in progress, skipping...');
      // Return cached data if available
      if (globalCustomerCache.customers.length > 0) {
        return globalCustomerCache.customers;
      }
      // Wait for current fetch to complete
      while (isFetchingCustomers) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return globalCustomerCache.customers || [];
    }

    // Enforce minimum interval between API calls
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
      const waitTime = MIN_FETCH_INTERVAL - timeSinceLastFetch;
      console.log(
        `⏳ CustomerScreen: Rate limiting - waiting ${waitTime}ms before fetch...`,
      );
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    isFetchingCustomers = true;
    lastFetchTime = Date.now();

    try {
      // RBAC: Be lenient — normalize and attempt fetch; don't hard-block UI
      let perms: string[] | null = null;
      try {
        if (Array.isArray(userPermissions)) {
          perms = userPermissions as string[];
        } else {
          const permsJson = await AsyncStorage.getItem('userPermissions');
          perms = permsJson ? JSON.parse(permsJson) : null;
          if (perms) setUserPermissions(perms);
        }
      } catch (e) {
        console.warn('RBAC permissions load error:', e);
      }

      if (perms && Array.isArray(perms)) {
        const normalizedPerms = perms.map(p =>
          String(p).toLowerCase().replace(/_/g, ':'),
        );
        const required =
          activeTab === 'suppliers' ? 'supplier:read' : 'customer:read';
        if (!normalizedPerms.includes(required)) {
          console.warn(
            `🚫 Missing permission ${required}; proceeding anyway to let backend decide`,
          );
          setRbacBlocked(true);
          // Do NOT early-return; attempt the call and let backend return 403 if truly forbidden
        }
      }

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

      // Skip health check (endpoint not available)

      // 🚨 REMOVED: API timeout wrapper

      console.log('🚀 Starting API calls...');
      // New approach: single endpoint then split per tab
      const customersUrl = `${BASE_URL}/customers`;
      const suppliersUrl = `${BASE_URL}/customers/suppliers`;
      console.log('📞 Calling customers endpoint (single):', customersUrl);
      console.log('💼 Calling suppliers endpoint:', suppliersUrl);
      console.log('💰 Calling vouchers endpoint:', `${BASE_URL}/transactions`);

      // Skip server health check (endpoint not available)

      // Debug: Test customers API first
      try {
        const debugResponse = (await unifiedApi.get(
          '/customers?page=1&limit=50',
        )) as { data: any; status: number; headers: Headers };
        // unifiedApi returns { data, status, headers } structure
        const debugData = debugResponse.data || debugResponse;
        console.log('🔍 DEBUG - Raw customers API response:', {
          status: debugResponse.status,
          data: debugData,
          isArray: Array.isArray(debugData),
          hasDataField: !!debugResponse.data?.data,
        });
      } catch (debugError: any) {
        console.log('🔍 DEBUG - Customers API error:', {
          status: debugError.response?.status,
          statusText: debugError.response?.statusText,
          message: debugError.message,
          url: debugError.config?.url,
        });

        // Try alternative endpoints
        console.log('🔄 Trying alternative customers endpoints...');
        const alternatives: string[] = [];
        for (const altEndpoint of alternatives) {
          try {
            const altResponse = (await unifiedApi.get(altEndpoint)) as {
              data: any;
              status: number;
              headers: Headers;
            };
            // unifiedApi returns { data, status, headers } structure
            console.log(
              `✅ Alternative endpoint ${altEndpoint} works:`,
              altResponse.status,
            );
          } catch (altError: any) {
            console.log(
              `❌ Alternative endpoint ${altEndpoint} failed:`,
              altError.response?.status,
            );
          }
        }
      }

      // 🎯 FIXED: Retry mechanism with exponential backoff and 429-specific handling
      let retryCount = 0;
      const maxRetries = 2; // Allow 2 retries for 429 errors
      let customersResponseCustomers: any; // deprecated, keep var names for minimal diff
      let customersResponseSuppliers: any; // deprecated, keep var names for minimal diff
      let customersResponseAll: any;
      let vouchersResponse: any;

      while (retryCount <= maxRetries) {
        try {
          console.log(`🔄 Attempt ${retryCount + 1} of ${maxRetries + 1}`);

          // Fetch both customers and vouchers in parallel
          [customersResponseAll, vouchersResponse] = await Promise.all([
            axios
              .get(customersUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                params: {
                  page: 1,
                  limit: 100,
                },
                timeout: 8000,
              })
              .catch(err => {
                console.warn(
                  'Customers fetch failed, using empty list',
                  err?.response?.status,
                );
                return { data: [] } as any;
              })
              .then(async customersRes => {
                // Also attempt suppliers in parallel and merge into a single shape
                try {
                  const suppliersRes = (await unifiedApi.get(
                    suppliersUrl.includes('?')
                      ? suppliersUrl
                      : `${suppliersUrl}?page=1&limit=100`,
                  )) as { data: any; status: number; headers: Headers };
                  // unifiedApi returns { data, status, headers } structure
                  // Merge logic: normalize both to arrays then concat
                  const cRaw: any = customersRes?.data;
                  const sRaw: any = suppliersRes?.data || suppliersRes;
                  const cList: any[] = Array.isArray(cRaw?.data)
                    ? cRaw.data
                    : Array.isArray(cRaw)
                    ? cRaw
                    : Array.isArray(cRaw?.data?.data)
                    ? cRaw.data.data
                    : [];
                  const sList: any[] = Array.isArray(sRaw?.data)
                    ? sRaw.data
                    : Array.isArray(sRaw)
                    ? sRaw
                    : Array.isArray(sRaw?.data?.data)
                    ? sRaw.data.data
                    : [];
                  return { data: [...cList, ...sList] } as any;
                } catch (supErr: any) {
                  if (
                    supErr?.response?.status === 403 ||
                    supErr?.response?.status === 404
                  ) {
                    console.warn(
                      'Suppliers fetch unavailable; proceeding with customers only',
                    );
                    return customersRes;
                  }
                  console.warn(
                    'Suppliers fetch failed (non-fatal):',
                    supErr?.response?.status,
                  );
                  return customersRes;
                }
              }),
            axios
              .get(`${BASE_URL}/transactions`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                params: {
                  page: 1,
                  limit: 100,
                },
                timeout: 8000, // Reduced timeout
              })
              .catch(err => {
                if (err?.response?.status === 404) {
                  console.warn(
                    'ℹ️ /transactions not available; using empty vouchers list',
                  );
                  return { data: [] } as any;
                }
                throw err;
              }),
          ]);

          console.log('✅ API calls completed successfully!');
          console.log(
            '📊 Customers API Response (all):',
            customersResponseAll?.data,
          );
          console.log('💰 Vouchers API Response:', vouchersResponse.data);

          // If we get here, the calls succeeded, so break out of retry loop
          break;
        } catch (apiError: any) {
          retryCount++;
          const statusCode = apiError?.response?.status;
          const isRateLimitError = statusCode === 429;

          console.error(
            `❌ API call attempt ${retryCount} failed:`,
            apiError.message,
            statusCode ? `(Status: ${statusCode})` : '',
          );

          // 🎯 FIXED: Handle 429 errors with longer wait times
          if (isRateLimitError) {
            console.warn(
              '⚠️ Rate limit error (429) detected - using extended backoff',
            );

            if (retryCount > maxRetries) {
              console.error(
                '❌ Max retries reached for rate limit error, giving up',
              );
              setError(
                'Too many requests. Please wait a moment before trying again.',
              );
              isFetchingCustomers = false;
              // Return cached data if available
              if (globalCustomerCache.customers.length > 0) {
                return globalCustomerCache.customers;
              }
              throw apiError;
            }

            // For 429 errors, use longer exponential backoff: 5s, 10s, 20s
            const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
            console.log(
              `⏳ Rate limit detected - waiting ${waitTime}ms before retry...`,
            );
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // Update last fetch time to prevent immediate retry
            lastFetchTime = Date.now();
            continue; // Retry the request
          }

          // For other errors, check if we should retry
          if (retryCount > maxRetries) {
            console.error('❌ Max retries reached, giving up');
            setError(
              'Unable to connect to server. Please check your internet connection and try again.',
            );
            isFetchingCustomers = false;
            throw apiError;
          }

          // Wait before retrying with exponential backoff for non-429 errors
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // 🎯 FIXED: Ensure isFetchingCustomers is reset even if we break out of loop
      isFetchingCustomers = false;

      // Transform API response to our local format
      const rawCustomers = customersResponseAll?.data;
      const apiData: any[] = Array.isArray(rawCustomers?.data)
        ? rawCustomers.data
        : Array.isArray(rawCustomers)
        ? rawCustomers
        : rawCustomers?.data?.data && Array.isArray(rawCustomers?.data?.data)
        ? rawCustomers.data.data
        : [];
      const rawVouchers = vouchersResponse?.data;
      const vouchersData: any[] = Array.isArray(rawVouchers)
        ? rawVouchers
        : Array.isArray(rawVouchers?.data)
        ? rawVouchers.data
        : [];
      console.log('📊 Raw customers data (merged):', apiData.length, 'items');
      console.log('💰 Raw vouchers data:', vouchersData.length, 'items');
      console.log('📊 Customers API response structure (merged sources)');

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
            phone: apiData[0].phone,
            phone_number: apiData[0].phone_number,
            mobile: apiData[0].mobile,
            partyPhone: apiData[0].partyPhone,
            address: apiData[0].address,
            gstNumber: apiData[0].gstNumber,
          },
          allKeys: Object.keys(apiData[0] || {}),
          FULL_ITEM: apiData[0], // Show the complete item
        });
      } else {
        console.log('⚠️ No customers data received from API');
        console.log('📊 Full customers response:', customersResponseAll?.data);
      }

      // Debug: Log sample voucher data structure
      if (vouchersData.length > 0) {
        console.log('🔍 Sample vouchers data structure:', {
          firstVoucher: {
            id: vouchersData[0].id,
            type: vouchersData[0].type,
            voucherType: vouchersData[0].voucherType,
            amount: vouchersData[0].amount,
            partyName: vouchersData[0].partyName,
            customerId: vouchersData[0].customerId,
            partyType: vouchersData[0].partyType,
          },
          allKeys: Object.keys(vouchersData[0] || {}),
          totalVouchers: vouchersData.length,
        });
      } else {
        console.log('⚠️ No vouchers data received from API');
        console.log('💰 Full vouchers response:', vouchersResponse?.data);
      }

      // If no customers data received, try to create customer data from vouchers as fallback
      if (apiData.length === 0) {
        console.log('ℹ️ No customers data received from API');
        // removed stale log referencing previous variable name

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
          console.log('ℹ️ No vouchers data available, showing empty state');
          // Show empty state when no data is available
          const emptyCustomers: Customer[] = [];
          console.log('🔄 No data available, showing empty list');
          setCustomers(emptyCustomers);
          return emptyCustomers;
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
          customer_id: vouchersData[0].customer_id,
          party_id: vouchersData[0].party_id,
          date: vouchersData[0].date,
        });

        // Log voucher distribution by type
        const voucherTypes = vouchersData.reduce((acc: any, v: any) => {
          const type = v.type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        console.log('💰 Voucher types distribution:', voucherTypes);

        // Log voucher distribution by customer_id
        const customerIds = vouchersData.reduce((acc: any, v: any) => {
          const id = v.customer_id || v.customerId || 'no_id';
          acc[id] = (acc[id] || 0) + 1;
          return acc;
        }, {});
        console.log('💰 Voucher customer_id distribution:', customerIds);

        // Log all vouchers to see the complete data structure
        console.log(
          '📋 All vouchers data:',
          vouchersData.map(v => ({
            id: v.id,
            type: v.type,
            amount: v.amount,
            partyName: v.partyName,
            customer_id: v.customer_id,
            customerId: v.customerId,
            party_id: v.party_id,
            party_name: v.party_name,
            partyPhone: v.partyPhone,
            phone: v.phone,
          })),
        );
      } else {
        console.log('⚠️ No voucher data available for amount calculation');
      }

      // Calculate customer amounts from vouchers instead of static opening balance
      // This provides real-time balance based on actual transactions
      const calculateCustomerAmount = (customer: any) => {
        try {
          console.log(
            `🔍 Calculating amount for customer: ${
              customer.partyName || customer.party_name
            } (ID: ${customer.id})`,
          );
          console.log(`📊 Total vouchers available: ${vouchersData.length}`);
          console.log(
            `🏷️ Customer partyType: ${
              customer.partyType || customer.type || 'unknown'
            }`,
          );
          console.log(`🔍 Customer data structure:`, {
            id: customer.id,
            partyName: customer.partyName,
            party_name: customer.party_name,
            name: customer.name,
            partyType: customer.partyType,
            type: customer.type,
            openingBalance: customer.openingBalance,
          });

          // Find all vouchers for this customer
          const customerVouchers = vouchersData.filter((voucher: any) => {
            let isMatch = false;
            let matchReason = '';

            // Primary match: customer_id (most reliable)
            if (
              voucher.customer_id &&
              customer.id &&
              (voucher.customer_id.toString() === customer.id.toString() ||
                voucher.customer_id === parseInt(customer.id) ||
                parseInt(voucher.customer_id) === parseInt(customer.id))
            ) {
              isMatch = true;
              matchReason = `customer_id: ${voucher.customer_id} === ${customer.id}`;
            }
            if (
              !isMatch &&
              voucher.customerId &&
              customer.id &&
              (voucher.customerId.toString() === customer.id.toString() ||
                voucher.customerId === parseInt(customer.id) ||
                parseInt(voucher.customerId) === parseInt(customer.id))
            ) {
              isMatch = true;
              matchReason = `customerId: ${voucher.customerId} === ${customer.id}`;
            }

            // Secondary match: partyName (fallback)
            if (!isMatch) {
              const customerName =
                customer.partyName || customer.party_name || customer.name;
              const voucherPartyName = voucher.partyName || voucher.party_name;

              if (
                customerName &&
                voucherPartyName &&
                customerName.toString().trim() ===
                  voucherPartyName.toString().trim()
              ) {
                isMatch = true;
                matchReason = `name: "${customerName}" === "${voucherPartyName}"`;
              }
            }

            // Additional fallback: Check if voucher has party_id that matches customer id
            if (
              !isMatch &&
              voucher.party_id &&
              customer.id &&
              (voucher.party_id.toString() === customer.id.toString() ||
                voucher.party_id === parseInt(customer.id) ||
                parseInt(voucher.party_id) === parseInt(customer.id))
            ) {
              isMatch = true;
              matchReason = `party_id: ${voucher.party_id} === ${customer.id}`;
            }

            // Log the matching result for debugging
            if (isMatch) {
              console.log(`✅ Voucher matched: ${matchReason}`, {
                voucherId: voucher.id,
                voucherType: voucher.type,
                voucherAmount: voucher.amount,
                voucherPartyName: voucher.partyName,
              });
            }

            return isMatch;
          });

          console.log(
            `💰 Customer ${customer.partyName || customer.party_name} (ID: ${
              customer.id
            }) has ${customerVouchers.length} vouchers`,
          );

          // Debug: Check if vouchers are being filtered by party type
          if (customerVouchers.length === 0) {
            console.log(
              `❌ No vouchers found for customer ${
                customer.partyName || customer.party_name
              }`,
            );
            console.log(
              `🔍 Checking if vouchers are being filtered by party type...`,
            );

            // Check if there are any vouchers that might match but are being filtered out
            const allMatchingVouchers = vouchersData.filter((voucher: any) => {
              // Check all possible matching criteria without party type filtering
              const customerName =
                customer.partyName || customer.party_name || customer.name;
              const voucherPartyName = voucher.partyName || voucher.party_name;

              return (
                (voucher.customer_id &&
                  customer.id &&
                  voucher.customer_id.toString() === customer.id.toString()) ||
                (voucher.customerId &&
                  customer.id &&
                  voucher.customerId.toString() === customer.id.toString()) ||
                (voucher.party_id &&
                  customer.id &&
                  voucher.party_id.toString() === customer.id.toString()) ||
                (customerName &&
                  voucherPartyName &&
                  customerName.toString().trim() ===
                    voucherPartyName.toString().trim())
              );
            });

            console.log(
              `🔍 Found ${allMatchingVouchers.length} vouchers that match by ID/name but might be filtered by party type`,
            );
            if (allMatchingVouchers.length > 0) {
              console.log(`🔍 Sample matching voucher:`, {
                id: allMatchingVouchers[0].id,
                type: allMatchingVouchers[0].type,
                amount: allMatchingVouchers[0].amount,
                partyName: allMatchingVouchers[0].partyName,
                customer_id: allMatchingVouchers[0].customer_id,
                partyType: allMatchingVouchers[0].partyType,
              });
            }
          }

          // Enhanced debugging for voucher matching
          if (customerVouchers.length === 0) {
            console.log(
              `❌ No vouchers found for customer ${
                customer.partyName || customer.party_name
              }`,
            );
            console.log(`🔍 Customer details:`, {
              id: customer.id,
              partyName: customer.partyName,
              party_name: customer.party_name,
              name: customer.name,
            });

            // Log sample vouchers to understand the data structure
            if (vouchersData.length > 0) {
              console.log(`📋 Sample voucher structure:`, {
                id: vouchersData[0].id,
                customer_id: vouchersData[0].customer_id,
                customerId: vouchersData[0].customerId,
                party_id: vouchersData[0].party_id,
                partyName: vouchersData[0].partyName,
                party_name: vouchersData[0].party_name,
                type: vouchersData[0].type,
                amount: vouchersData[0].amount,
              });
            }
          } else {
            console.log(
              `✅ Found vouchers for customer:`,
              customerVouchers.map(v => ({
                id: v.id,
                type: v.type,
                amount: v.amount,
                customer_id: v.customer_id,
                partyName: v.partyName,
              })),
            );
          }

          // Debug: Log customer and voucher details for troubleshooting
          console.log(`🔍 Customer details:`, {
            id: customer.id,
            partyName: customer.partyName,
            party_name: customer.party_name,
            name: customer.name,
            partyType: customer.partyType,
          });

          if (customerVouchers.length > 0) {
            console.log(`🔍 Sample voucher details:`, {
              id: customerVouchers[0].id,
              customer_id: customerVouchers[0].customer_id,
              customerId: customerVouchers[0].customerId,
              party_id: customerVouchers[0].party_id,
              partyName: customerVouchers[0].partyName,
              party_name: customerVouchers[0].party_name,
              type: customerVouchers[0].type,
              amount: customerVouchers[0].amount,
            });
          } else {
            console.log(
              `⚠️ No vouchers found for customer ${
                customer.partyName || customer.party_name
              } (ID: ${customer.id})`,
            );
            console.log(
              `🔍 Available vouchers sample:`,
              vouchersData.slice(0, 5).map(v => ({
                id: v.id,
                customer_id: v.customer_id,
                customerId: v.customerId,
                party_id: v.party_id,
                partyName: v.partyName,
                party_name: v.party_name,
                type: v.type,
                amount: v.amount,
              })),
            );

            // Additional debugging: Check if any vouchers have matching party names
            const matchingByName = vouchersData.filter((v: any) => {
              const customerName =
                customer.partyName || customer.party_name || customer.name;
              const voucherPartyName = v.partyName || v.party_name;
              return (
                customerName &&
                voucherPartyName &&
                customerName.toString().trim() ===
                  voucherPartyName.toString().trim()
              );
            });

            if (matchingByName.length > 0) {
              console.log(
                `🔍 Found ${matchingByName.length} vouchers by name match:`,
                matchingByName.map(v => ({
                  id: v.id,
                  partyName: v.partyName,
                  party_name: v.party_name,
                  type: v.type,
                  amount: v.amount,
                })),
              );
            }
          }

          let totalAmount = 0;
          let paymentTotal = 0;
          let receiptTotal = 0;

          // If no vouchers found by ID, try to find by name as fallback
          let finalCustomerVouchers = customerVouchers;
          if (customerVouchers.length === 0) {
            const customerName =
              customer.partyName || customer.party_name || customer.name;
            const nameMatchedVouchers = vouchersData.filter((voucher: any) => {
              const voucherPartyName = voucher.partyName || voucher.party_name;
              return (
                customerName &&
                voucherPartyName &&
                customerName.toString().trim().toLowerCase() ===
                  voucherPartyName.toString().trim().toLowerCase()
              );
            });

            if (nameMatchedVouchers.length > 0) {
              console.log(
                `🔄 Fallback: Found ${nameMatchedVouchers.length} vouchers by name match for ${customerName}`,
              );
              finalCustomerVouchers = nameMatchedVouchers;
            }
          }

          // If still no vouchers found, check if customer has opening balance
          if (
            finalCustomerVouchers.length === 0 &&
            customer.openingBalance &&
            customer.openingBalance !== 0
          ) {
            console.log(
              `🔄 Using opening balance fallback for ${
                customer.partyName || customer.party_name
              }: ${customer.openingBalance}`,
            );
            // Create a virtual voucher entry for opening balance
            const virtualVoucher = {
              id: `opening_${customer.id}`,
              type: customer.openingBalance > 0 ? 'credit' : 'debit',
              amount: Math.abs(customer.openingBalance),
              customer_id: customer.id,
              partyName: customer.partyName || customer.party_name,
              description: 'Opening Balance',
              isVirtual: true,
            };
            finalCustomerVouchers = [virtualVoucher];
            console.log(
              `✅ Created virtual voucher for opening balance:`,
              virtualVoucher,
            );
          }

          // CRITICAL FIX: If still no vouchers found, check if this is a newly created customer
          // and use the opening balance directly from the customer data
          if (finalCustomerVouchers.length === 0) {
            console.log(
              `🔍 No vouchers found, checking for opening balance in customer data...`,
            );
            console.log(
              `🔍 Customer opening balance: ${customer.openingBalance}`,
            );
            console.log(
              `🔍 Customer opening_balance: ${customer.opening_balance}`,
            );

            // Check multiple possible opening balance fields
            const openingBalance =
              customer.openingBalance || customer.opening_balance || 0;
            if (openingBalance !== 0) {
              console.log(`🔄 Using direct opening balance: ${openingBalance}`);
              // Create a virtual voucher from the opening balance
              const virtualVoucher = {
                id: `direct_opening_${customer.id}`,
                type: openingBalance > 0 ? 'credit' : 'debit',
                amount: Math.abs(openingBalance),
                customer_id: customer.id,
                customerId: customer.id,
                party_id: customer.id,
                partyName:
                  customer.partyName || customer.party_name || customer.name,
                party_name:
                  customer.partyName || customer.party_name || customer.name,
                description: 'Opening Balance (Direct)',
                isVirtual: true,
              };
              finalCustomerVouchers = [virtualVoucher];
              console.log(
                `✅ Created direct opening balance voucher:`,
                virtualVoucher,
              );
            }
          }

          // Remove duplicates based on voucher ID to avoid double counting
          const uniqueVouchers = finalCustomerVouchers.filter(
            (voucher, index, self) =>
              index === self.findIndex(v => v.id === voucher.id),
          );

          if (uniqueVouchers.length !== finalCustomerVouchers.length) {
            console.log(
              `🔄 Removed ${
                finalCustomerVouchers.length - uniqueVouchers.length
              } duplicate vouchers`,
            );
            finalCustomerVouchers = uniqueVouchers;
          }

          finalCustomerVouchers.forEach((voucher: any) => {
            const amount = Math.abs(parseFloat(voucher.amount) || 0);
            const voucherType = (
              voucher.type ||
              voucher.voucherType ||
              ''
            ).toLowerCase();

            console.log(
              `🔍 Processing voucher for ${
                customer.partyName || customer.party_name
              }:`,
              {
                voucherId: voucher.id,
                type: voucherType,
                amount: amount,
                customerId: voucher.customer_id,
                partyName: voucher.partyName,
                fullVoucher: voucher, // Debug: show full voucher structure
              },
            );

            // Use the backend transaction types: 'credit' and 'debit'
            // CREDIT = Money coming in (you receive) = Receipt
            // DEBIT = Money going out (you give) = Payment
            if (voucherType === 'debit') {
              paymentTotal += amount; // Money going out (you give) = Payment
              console.log(`✅ Added to payments: ${amount} (DEBIT = Payment)`);
            } else if (voucherType === 'credit') {
              receiptTotal += amount; // Money coming in (you get) = Receipt
              console.log(`✅ Added to receipts: ${amount} (CREDIT = Receipt)`);
            } else {
              // Fallback for other type names (legacy support)
              if (voucherType === 'payment' || voucherType === 'purchase') {
                paymentTotal += amount; // Money going out (you give) = Payment
                console.log(
                  `✅ Added to payments: ${amount} (fallback PAYMENT/PURCHASE)`,
                );
              } else if (voucherType === 'receipt' || voucherType === 'sell') {
                receiptTotal += amount; // Money coming in (you get) = Receipt
                console.log(
                  `✅ Added to receipts: ${amount} (fallback RECEIPT/SELL)`,
                );
              } else {
                console.log(
                  `⚠️ Unknown voucher type: ${voucherType}, skipping`,
                );
              }
            }
          });

          // Calculate net balance: receipts - payments
          totalAmount = receiptTotal - paymentTotal;

          // Determine the display type based on the net balance
          // If totalAmount > 0: receipts > payments = you're getting money (Receipt)
          // If totalAmount < 0: payments > receipts = you're giving money (Payment)
          const displayType = totalAmount > 0 ? 'get' : 'give';
          const displayLabel = totalAmount > 0 ? 'Receipt' : 'Payment';

          console.log(
            `💰 Customer ${customer.partyName || customer.party_name} balance:`,
            {
              receipts: receiptTotal,
              payments: paymentTotal,
              netBalance: totalAmount,
              displayType,
              displayLabel,
              explanation:
                totalAmount > 0
                  ? 'Receipts > Payments = You are getting money (Receipt)'
                  : 'Payments > Receipts = You are giving money (Payment)',
              voucherCount: customerVouchers.length,
            },
          );

          // Additional debugging for the specific issue
          console.log(
            `🎯 FINAL CALCULATION for ${
              customer.partyName || customer.party_name
            }:`,
            {
              receiptTotal,
              paymentTotal,
              netBalance: totalAmount,
              displayType,
              displayLabel,
              voucherCount: finalCustomerVouchers.length,
              explanation:
                totalAmount > 0
                  ? 'Receipts > Payments = You are getting money (Receipt)'
                  : 'Payments > Receipts = You are giving money (Payment)',
            },
          );

          return {
            totalAmount: Math.abs(totalAmount),
            type: displayType,
            paymentTotal,
            receiptTotal,
            voucherCount: finalCustomerVouchers.length,
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
      const transformedCustomers: (Customer | null)[] = await Promise.all(
        apiData
          .filter((item: any) => {
            // Filter out invalid items
            return item && (item.id || item.partyName || item.party_name);
          })
          .map(async (item: any, index: number) => {
            try {
              // Calculate real-time amount from vouchers
              const voucherAmounts = calculateCustomerAmount(item);

              // Use voucher amounts instead of opening balance
              const amount = voucherAmounts.totalAmount;
              const type = voucherAmounts.type;

              // If no vouchers found and no amount, set to 0
              if (voucherAmounts.voucherCount === 0 && amount === 0) {
                console.log(
                  `ℹ️ Customer ${
                    item.partyName || item.party_name
                  } has no transactions, showing 0 balance`,
                );
              }

              // Additional validation to ensure no hardcoded amounts slip through
              if (amount > 0 && voucherAmounts.voucherCount === 0) {
                console.warn(
                  `⚠️ Customer ${
                    item.partyName || item.party_name
                  } has amount ${amount} but no vouchers - this might be incorrect data`,
                );
              }

              console.log(
                `💰 Customer ${
                  item.partyName || item.party_name
                } final amounts:`,
                {
                  amount,
                  type,
                  voucherCount: voucherAmounts.voucherCount,
                  receipts: voucherAmounts.receiptTotal,
                  payments: voucherAmounts.paymentTotal,
                  customerId: item.id,
                  partyName: item.partyName || item.party_name,
                },
              );

              // Safely handle name and create avatar
              let partyName: string;
              try {
                partyName = String(
                  item.partyName || item.name || item.party_name || 'Unknown',
                ).trim();
                if (!partyName || partyName === '') {
                  partyName = 'Unknown';
                }
              } catch (error) {
                console.warn('Party name parsing error:', error);
                partyName = 'Unknown';
              }

              // Skip creating customer entries for subscription-related transactions
              if (
                partyName.toLowerCase() === 'unknown' ||
                partyName.toLowerCase() === 'party 1' ||
                partyName.toLowerCase().includes('subscription') ||
                partyName.toLowerCase().includes('plan') ||
                partyName.toLowerCase().includes('upgrade') ||
                (partyName.toLowerCase().includes('payment') &&
                  partyName.toLowerCase().includes('system'))
              ) {
                console.log(
                  '🚫 Skipping subscription/system voucher entry:',
                  partyName,
                );
                return null; // Skip this voucher entry
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

              // Get phone number from vouchers FIRST (most reliable source)
              const customerIdForPhone = item.id;
              let phoneFromVoucher: string | undefined = undefined;
              if (vouchersData && Array.isArray(vouchersData)) {
                const customerVouchers = vouchersData.filter((v: any) => {
                  return (
                    (v.customer_id &&
                      v.customer_id.toString() ===
                        customerIdForPhone.toString()) ||
                    (v.customerId &&
                      v.customerId.toString() ===
                        customerIdForPhone.toString()) ||
                    (v.party_id &&
                      v.party_id.toString() ===
                        customerIdForPhone.toString()) ||
                    (v.partyName || v.party_name) ===
                      (item.partyName || item.party_name)
                  );
                });

                if (customerVouchers.length > 0) {
                  const latestVoucher = customerVouchers[0];
                  phoneFromVoucher =
                    latestVoucher.partyPhone || latestVoucher.phone;
                }
              }

              // Safely handle phone number and GST
              let phoneNumber: string | undefined;
              let gstNumber: string | undefined;
              try {
                // Debug: Log all phone-related fields and the full item structure
                const nameForLog =
                  item.partyName || item.party_name || 'Unknown';
                console.log(`📱 Phone fields for ${nameForLog}:`, {
                  phoneFromVoucher: phoneFromVoucher,
                  phoneNumber: item.phoneNumber,
                  phone: item.phone,
                  phone_number: item.phone_number,
                  partyPhone: item.partyPhone,
                  mobile: item.mobile,
                  contactNo: item.contactNo,
                  id: item.id,
                  allKeys: Object.keys(item).filter(
                    k =>
                      k.toLowerCase().includes('phone') ||
                      k.toLowerCase().includes('mobile') ||
                      k.toLowerCase().includes('contact'),
                  ),
                  fullItem: item, // Show complete item structure
                });

                // CRITICAL DEBUG: Log what we're getting
                console.log(`🔍 DEBUG ${nameForLog}:`, {
                  'item.phone': item.phone,
                  'item.phoneNumber': item.phoneNumber,
                  'item.phone_number': item.phone_number,
                  'typeof item.phone': typeof item.phone,
                  'typeof item.phoneNumber': typeof item.phoneNumber,
                });

                // Try multiple phone field combinations in priority order
                // Priority: phoneFromVoucher (from vouchers) > phone > phoneNumber > others
                let phoneSrc: any = undefined;

                const phoneFields = [
                  phoneFromVoucher, // Use voucher phone FIRST (most reliable)
                  item.phone, // Then check phone field
                  item.phoneNumber,
                  item.phone_number,
                  item.partyPhone,
                  item.mobile,
                  item.contactNo,
                  (item as any).party_phone,
                  (item as any).phone_Number,
                  (item as any).PhoneNumber,
                ];

                // Find the first non-empty, non-country-code-only phone field
                for (const field of phoneFields) {
                  const fieldStr = field ? String(field).trim() : '';
                  if (
                    fieldStr &&
                    fieldStr !== '+91' &&
                    fieldStr !== '91' &&
                    fieldStr.length >= 7
                  ) {
                    phoneSrc = field;
                    console.log(`📱 Found phone in field: "${field}"`);
                    break;
                  }
                }

                // Normalize phone number: remove country code and formatting
                if (phoneSrc) {
                  let normalized = String(phoneSrc).trim();
                  console.log(
                    `📱 Phone normalization - Before: "${normalized}"`,
                  );

                  // REMOVE "+91-" prefix if present
                  normalized = normalized.replace(/^\+?91-?/, '');
                  console.log(`📱 Phone after removing +91: "${normalized}"`);

                  // Handle case where only country code is present (like "+91")
                  // In this case, check if there's a separate number field
                  if (
                    normalized === '+91' ||
                    normalized === '91' ||
                    normalized.length <= 3
                  ) {
                    console.log(
                      `⚠️ Only country code found for ${partyName}, checking for alternative fields`,
                    );
                    // Try to find the actual phone number in other fields
                    const alternativeSource =
                      item.mobile ||
                      item.contactNo ||
                      (item as any).party_phone ||
                      (item as any).phoneNumber || // Try this too
                      (item as any).phone ||
                      (item as any).phone_number ||
                      '';

                    if (alternativeSource) {
                      normalized = String(alternativeSource).trim();
                      console.log(
                        `📱 Using alternative phone source: "${normalized}"`,
                      );
                    } else {
                      // Last resort: Check if countryCode field exists and has full number
                      const countryCodeField = (item as any).countryCode;
                      if (countryCodeField && countryCodeField.length > 3) {
                        normalized = String(countryCodeField).trim();
                        console.log(
                          `📱 Using countryCode field as phone: "${normalized}"`,
                        );
                      } else {
                        console.log(
                          `⚠️ No alternative phone found for ${partyName}`,
                        );
                        phoneNumber = undefined;
                      }
                    }
                  }

                  // Special case: If phone source has both country code and number (like "916666666666")
                  // Extract the actual number part
                  if (
                    normalized &&
                    normalized.length > 10 &&
                    normalized.startsWith('91')
                  ) {
                    normalized = normalized.substring(2); // Remove the "91" prefix
                    console.log(
                      `📱 Extracted phone from country code: "${normalized}"`,
                    );
                  }

                  if (
                    normalized &&
                    normalized !== '+91' &&
                    normalized !== '91'
                  ) {
                    // Remove country code prefix (+91, 91, +91-)
                    normalized = normalized.replace(/^\+?91-?/, '');
                    console.log(
                      `📱 Phone normalization - After removing +91: "${normalized}"`,
                    );
                    // Remove all non-digit characters after country code removal
                    normalized = normalized.replace(/\D/g, '');
                    console.log(
                      `📱 Phone normalization - Digits only: "${normalized}"`,
                    );
                    // Only take last 10 digits (standard Indian phone number length)
                    normalized = normalized.slice(-10);
                    console.log(
                      `📱 Phone normalization - Final (last 10): "${normalized}"`,
                    );

                    // Only set phone number if we have at least 7 digits
                    if (normalized.length >= 7) {
                      phoneNumber = normalized;
                      console.log(`✅ Phone for ${partyName}: ${phoneNumber}`);
                    } else {
                      console.log(
                        `⚠️ Phone number too short for ${partyName}: "${normalized}"`,
                      );
                      phoneNumber = undefined;
                    }
                  }
                }

                // If we still don't have a phone number, try vouchers as fallback
                if (!phoneNumber) {
                  console.log(
                    `⚠️ No phone found in item fields for ${partyName}, checking vouchers...`,
                  );
                  const customerId = item.id;
                  if (vouchersData && Array.isArray(vouchersData)) {
                    const customerVouchers = vouchersData.filter((v: any) => {
                      return (
                        (v.customer_id &&
                          v.customer_id.toString() === customerId.toString()) ||
                        (v.customerId &&
                          v.customerId.toString() === customerId.toString())
                      );
                    });

                    if (customerVouchers.length > 0) {
                      const voucherPhone =
                        customerVouchers[0]?.partyPhone ||
                        customerVouchers[0]?.phone;
                      if (
                        voucherPhone &&
                        String(voucherPhone).trim() &&
                        String(voucherPhone).trim() !== '+91'
                      ) {
                        console.log(
                          `📱 Using phone from voucher: "${voucherPhone}"`,
                        );
                        let normalized = String(voucherPhone)
                          .trim()
                          .replace(/^\+?91-?/, '')
                          .replace(/\D/g, '')
                          .slice(-10);
                        if (normalized.length >= 7) {
                          phoneNumber = normalized;
                          console.log(
                            `✅ Phone from voucher for ${partyName}: ${phoneNumber}`,
                          );
                        }
                      }
                    }
                  }

                  if (!phoneNumber) {
                    phoneNumber = undefined;
                  }
                }

                const gstSrc =
                  item.gstNumber !== undefined && item.gstNumber !== null
                    ? item.gstNumber
                    : item.gst_number;
                gstNumber = gstSrc ? String(gstSrc).trim() : undefined;
              } catch (error) {
                console.warn('Phone/GST parsing error:', error);
                phoneNumber = undefined;
                gstNumber = undefined;
              }

              // Normalize party type from various backend shapes
              let normalizedPartyType: 'customer' | 'supplier' = 'customer';
              try {
                const rawParty = String(
                  item.partyType !== undefined
                    ? item.partyType
                    : item.type !== undefined
                    ? item.type
                    : item.party_type,
                )
                  .toLowerCase()
                  .trim();
                if (rawParty === 'supplier') normalizedPartyType = 'supplier';
                if (rawParty === 'customer') normalizedPartyType = 'customer';
              } catch {}

              // Use the voucher-based calculation from calculateCustomerAmount function
              // No fallback amounts - show 0 if no real transactions exist
              let customerAmount = amount; // This comes from calculateCustomerAmount
              let customerType = type; // This comes from calculateCustomerAmount

              // Store opening balance for fallback calculation
              const openingBalance =
                item.openingBalance || item.opening_balance || 0;

              // CRITICAL FIX: If no amount calculated from vouchers but customer has opening balance,
              // use the opening balance directly
              if (customerAmount === 0 && openingBalance !== 0) {
                console.log(
                  `🔄 CRITICAL FIX: Using opening balance directly for ${partyName}: ${openingBalance}`,
                );
                customerAmount = Math.abs(openingBalance);
                customerType = openingBalance > 0 ? 'get' : 'give';
                console.log(
                  `✅ Set customer amount to ${customerAmount} (${customerType})`,
                );
              }

              // ADDITIONAL FIX: Check AsyncStorage for opening balance if still no amount
              if (customerAmount === 0) {
                try {
                  const storedOpeningBalances = await AsyncStorage.getItem(
                    'customerOpeningBalances',
                  );
                  if (storedOpeningBalances) {
                    const openingBalances = JSON.parse(storedOpeningBalances);
                    const customerOpeningBalance = openingBalances[item.id];
                    if (customerOpeningBalance) {
                      console.log(
                        `🔄 Found opening balance in AsyncStorage for ${partyName}: ${customerOpeningBalance.amount}`,
                      );
                      customerAmount = Math.abs(customerOpeningBalance.amount);
                      customerType =
                        customerOpeningBalance.type === 'receipt'
                          ? 'get'
                          : 'give';
                      console.log(
                        `✅ Set customer amount from AsyncStorage: ${customerAmount} (${customerType})`,
                      );
                    }
                  }
                } catch (error) {
                  console.error(
                    '❌ Error reading opening balance from AsyncStorage:',
                    error,
                  );
                }
              }

              // ADDITIONAL FIX: Check if this is a newly created customer with no vouchers yet
              // but the summary shows amounts (indicating vouchers exist but aren't being matched)
              if (customerAmount === 0 && voucherAmounts.voucherCount === 0) {
                console.log(
                  `🔍 Customer ${partyName} has no vouchers but summary shows amounts - checking for timing issue`,
                );

                // Check if there are any vouchers in the system that might belong to this customer
                const potentialVouchers = vouchersData.filter(
                  (voucher: any) => {
                    const customerName = partyName;
                    const voucherPartyName =
                      voucher.partyName || voucher.party_name;
                    return (
                      customerName &&
                      voucherPartyName &&
                      customerName.toString().trim().toLowerCase() ===
                        voucherPartyName.toString().trim().toLowerCase()
                    );
                  },
                );

                if (potentialVouchers.length > 0) {
                  console.log(
                    `🔄 Found ${potentialVouchers.length} potential vouchers by name match for ${partyName}`,
                  );
                  // Use the first matching voucher as a fallback
                  const fallbackVoucher = potentialVouchers[0];
                  customerAmount = Math.abs(fallbackVoucher.amount);
                  customerType =
                    fallbackVoucher.type === 'credit' ? 'get' : 'give';
                  console.log(
                    `✅ Using fallback voucher: ${customerAmount} (${customerType})`,
                  );
                }
              }

              console.log(`🔍 DEBUG: Customer ${partyName} (ID: ${item.id}):`, {
                finalAmount: customerAmount,
                finalType: customerType,
                voucherCount: voucherAmounts.voucherCount,
                receipts: voucherAmounts.receiptTotal,
                payments: voucherAmounts.paymentTotal,
                openingBalance: openingBalance,
              });

              return {
                id: String(item.id || `temp_${index}`),
                name: partyName,
                location: location,
                lastInteraction: lastInteraction,
                amount: customerAmount,
                type: customerType as 'give' | 'get',
                avatar: avatar,
                phoneNumber: phoneNumber,
                gstNumber: gstNumber,
                address: item.address || undefined,
                openingBalance: openingBalance, // Use the actual opening balance from API
                // Use normalized party type for proper tab filtering
                partyType: normalizedPartyType,
              };
            } catch (error) {
              console.error('Customer transformation error:', error, item);
              // Return a safe fallback customer
              return {
                id: `fallback_${index}`,
                name: 'Error Customer',
                location: 'India',
                lastInteraction: 'Recently',
                amount: 0, // No amount for error customers
                type: 'give' as const,
                avatar: 'E',
                phoneNumber: undefined,
                gstNumber: undefined,
                address: undefined,
                openingBalance: 0,
                partyType: 'customer', // Default to customer for fallback
              };
            }
          }),
      );

      const validCustomers: Customer[] = transformedCustomers.filter(
        (customer): customer is Customer => {
          // Filter out null values first
          if (!customer) return false;

          // Filter out "Party 1" and other system entries
          const customerName =
            customer.name || (customer as any).partyName || '';
          if (
            customerName.toLowerCase() === 'party 1' ||
            customerName.toLowerCase() === 'unknown' ||
            customerName.toLowerCase().includes('subscription') ||
            customerName.toLowerCase().includes('plan') ||
            customerName.toLowerCase().includes('upgrade') ||
            customerName === 'SKIP'
          ) {
            console.log('🚫 Filtering out system entry:', customerName);
            return false;
          }

          // Relax validation: only require minimal fields so items still render
          const isValid =
            customer &&
            typeof customer === 'object' &&
            typeof customer.id === 'string' &&
            typeof customer.name === 'string';

          if (!isValid) {
            console.warn('❌ Skipping malformed customer item:', customer);
          }

          return isValid;
        },
      );

      console.log(
        '✅ Transformed customers:',
        validCustomers.length,
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
      const totalReceipts = validCustomers.reduce((sum, customer) => {
        return sum + (customer.type === 'get' ? customer.amount : 0);
      }, 0);
      const totalPayments = validCustomers.reduce((sum, customer) => {
        return sum + (customer.type === 'give' ? customer.amount : 0);
      }, 0);

      console.log('💰 Voucher-based amounts summary:', {
        totalCustomers: validCustomers.length,
        totalReceipts: `₹${totalReceipts.toFixed(2)}`,
        totalPayments: `₹${totalPayments.toFixed(2)}`,
        netBalance: `₹${(totalReceipts - totalPayments).toFixed(2)}`,
        customersWithAmounts: validCustomers.filter(c => c.amount > 0).length,
        customersWithoutAmounts: validCustomers.filter(c => c.amount === 0)
          .length,
        customersByType: {
          customers: validCustomers.filter(c => c.partyType === 'customer')
            .length,
          suppliers: validCustomers.filter(c => c.partyType === 'supplier')
            .length,
        },
        customersWithAmountsByType: {
          customers: validCustomers.filter(
            c => c.partyType === 'customer' && c.amount > 0,
          ).length,
          suppliers: validCustomers.filter(
            c => c.partyType === 'supplier' && c.amount > 0,
          ).length,
        },
      });

      // Debug: Show order and voucher type mapping
      console.log('📋 FINAL ORDER (newest first):');
      validCustomers.forEach((customer, index) => {
        console.log(`📊 ${index + 1}. ${customer.name}:`, {
          voucherType: 'receipt', // This will be the actual voucher type from API
          calculatedType: customer.type,
          amount: customer.amount,
          color: customer.type === 'get' ? 'GREEN' : 'RED',
          position: index + 1,
        });
      });

      // Fallback: if strict transformation yields 0 but API has data, map minimally
      let finalCustomers = validCustomers;
      if (finalCustomers.length === 0 && apiData.length > 0) {
        console.log('🔁 Using minimal mapping fallback for customer list');
        finalCustomers = apiData.map((it: any, idx: number) => {
          const name = String(
            it.party_name || it.partyName || it.name || `Party ${idx + 1}`,
          );
          const ptRaw = String(
            it.party_type || it.partyType || '',
          ).toLowerCase();
          const normalizedPT = ptRaw === 'supplier' ? 'supplier' : 'customer';
          // Ensure unique ID - use actual ID if available, otherwise create truly unique fallback
          const uniqueId = it.id
            ? String(it.id)
            : `p_${idx}_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`;
          return {
            id: uniqueId,
            name,
            location: 'India',
            lastInteraction: it.createdAt
              ? new Date(it.createdAt).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Recently',
            amount: 0, // No amount for minimal mapping fallback
            type: 'give' as const,
            avatar: name.charAt(0)?.toUpperCase() || 'U',
            phoneNumber: it.phone_number || it.phoneNumber || '',
            gstNumber: it.gst_number || it.gstNumber || '',
            address: it.address || '',
            partyType: normalizedPT,
          };
        });
      }

      // Final safety: de-duplicate to avoid growing duplicates across refreshes
      const deduped = dedupeCustomers(finalCustomers);

      console.log('✅ Data ready for UI (deduped):', deduped.length, 'items');
      setCustomers(deduped);

      // If no data found, show appropriate message
      if (transformedCustomers.length === 0) {
        console.log('ℹ️ No data found for tab:', activeTab);
      }

      // 🎯 FIXED: Reset flag on successful completion
      isFetchingCustomers = false;
      return deduped;
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
      if (err.response?.status === 400) {
        errorMessage = 'Invalid request. Please check your data and try again.';
        console.error(
          '❌ 400 Bad Request - Invalid request parameters or validation failed',
        );
        console.error('❌ 400 Error details:', err.response?.data);
        console.error('❌ Request URL:', err.config?.url);
        console.error('❌ Request headers:', err.config?.headers);
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        console.error('🔐 401 Unauthorized - Token may be invalid or expired');
      } else if (err.response?.status === 403) {
        errorMessage = 'Access forbidden. Please check your permissions.';
        console.error('🚫 403 Forbidden - User lacks required permissions');
      } else if (err.response?.status === 404) {
        errorMessage =
          'API server is not available. Please check your internet connection or try again later.';
        console.error(
          '🔍 404 Not Found - API server may be down or endpoint incorrect',
        );
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
      // 🎯 FIXED: Always reset flag in finally block to prevent stuck state
      isFetchingCustomers = false;
      console.log('🏁 Fetch completed. Final state:', {
        customersCount: customers.length,
        error,
        isFetchingCustomers,
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

        // Filter out "Unknown" customers and subscription-related entries
        const customerName = customer.name || (customer as any).partyName || '';
        if (
          customerName.toLowerCase() === 'unknown' ||
          customerName.toLowerCase() === 'party 1' ||
          customerName.toLowerCase().startsWith('party ') ||
          customerName.toLowerCase().includes('subscription') ||
          customerName.toLowerCase().includes('plan') ||
          customerName.toLowerCase().includes('upgrade') ||
          (customerName.toLowerCase().includes('payment') &&
            customerName.toLowerCase().includes('system'))
        ) {
          console.log(
            '🚫 Filtering out system/subscription entry:',
            customerName,
          );
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

  // Get filtered customers and ensure they're deduplicated BEFORE rendering
  const rawFilteredCustomers = getFilteredCustomers();
  // Apply strict deduplication to prevent any duplicate IDs
  const filteredCustomers = dedupeCustomers(rawFilteredCustomers);

  useEffect(() => {
    setVisibleCount(prev =>
      Math.min(prev, filteredCustomers.length || PAGE_SIZE),
    );
  }, [filteredCustomers.length]);

  const paginatedCustomers = useMemo(
    () => filteredCustomers.slice(0, visibleCount),
    [filteredCustomers, visibleCount],
  );

  const hasMoreData = visibleCount < filteredCustomers.length;

  // Debug logging
  console.log('🔍 Current state:', {
    activeTab,
    customersCount: customers.length,
    filteredCount: filteredCustomers.length,
    visibleCount,
    paginatedCount: paginatedCustomers.length,
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

  // Calculate summary from the currently displayed rows for perfect visual consistency
  const summaryData = (() => {
    try {
      const list = filteredCustomers || customers || [];
      let payment = 0;
      let receipt = 0;
      list.forEach((c: any) => {
        const amt = Math.abs(parseFloat(c?.amount) || 0);
        if ((c?.type as string) === 'give') payment += amt;
        else if ((c?.type as string) === 'get') receipt += amt;
      });
      const finalSummary = { payment, receipt, sell: 0, purchase: 0 };
      console.log('✅ Final summary from rows:', finalSummary);
      return finalSummary;
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
      setVisibleCount(PAGE_SIZE);
      setFilterOptions({
        sortBy: 'name',
        sortOrder: 'asc',
        amountRange: 'all',
        type: 'all',
        location: '',
        hasPhone: 'all',
        hasGST: 'all',
      });

      // Force refresh right after tab change so list repopulates
      setTimeout(() => {
        handleManualRefresh();
      }, 50);

      // Do not clear current data; switch tabs instantly and refresh in background if needed
      setError(null);
      const timeSinceLastFetch = Date.now() - globalCustomerCache.lastUpdated;
      if (timeSinceLastFetch > CACHE_TTL || customers.length === 0) {
        console.log(`🔄 Background refresh for ${tab} tab...`);
        handleManualRefresh();
      }
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
        // For suppliers, first go via contacts screen and propagate intent
        navigation.navigate('AddCustomerFromContacts', {
          partyType: 'supplier',
          shouldRefresh: true,
        } as any);
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

      // Clear voucher cache to ensure fresh voucher data
      clearVoucherCache();

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      // Fetch fresh data in parallel
      const [customersResult, userDataResult, vouchersResponse] =
        await Promise.all([
          fetchCustomersData(accessToken),
          fetchUserData(accessToken),
          fetch(`${BASE_URL}/transactions`, {
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
      console.log('🔍 DEBUG: Setting allVouchers in fetchAllData:', {
        vouchersResponseLength: vouchersResponse.length,
        vouchersResponse: vouchersResponse.slice(0, 3), // Show first 3 vouchers
      });
      setAllVouchers(vouchersResponse);
      setUserData(userDataResult);
      updateBusinessNameIfPresent(userDataResult?.businessName);

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

  const handleViewReport = async () => {
    try {
      console.log('🔍 View Report - Checking user plan access...');

      // Always fetch fresh subscription data to get the latest plan information
      // This ensures we get the updated plan even if user just upgraded
      console.log('🔄 Fetching fresh subscription data for plan check...');

      // Fetch subscription data directly from API (same as SubscriptionContext does)
      let planType = 'free';
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const response = (await unifiedApi.get('/users/profile')) as {
            data: any;
            status: number;
            headers: Headers;
          };

          // unifiedApi returns { data, status, headers } structure
          if (response.status >= 200 && response.status < 300) {
            const result = response.data || response;
            const userData = result?.data ?? result;
            console.log('🔍 View Report - User data from API:', userData);

            // Get planType from user data (same logic as SubscriptionContext)
            planType = userData.planType?.toLowerCase() || 'free';

            // Map premium to professional (same as SubscriptionContext)
            if (planType === 'premium') {
              planType = 'professional';
            }

            console.log('🔍 View Report - Plan type from API:', planType);

            // Also update subscription context for future checks
            await fetchSubscriptionData();
          }
        }
      } catch (fetchError) {
        console.warn('⚠️ Error fetching subscription data:', fetchError);
        // Fallback to subscription context if API fails
        planType =
          currentSubscription?.planId ||
          currentSubscription?.planName?.toLowerCase() ||
          'free';
      }

      // If API fetch failed, try subscription context
      if (planType === 'free' && currentSubscription) {
        planType =
          currentSubscription.planId ||
          currentSubscription.planName?.toLowerCase() ||
          'free';
        console.log(
          '🔍 View Report - Using subscription context plan:',
          planType,
        );
      }

      const planLower = planType.toLowerCase().trim();

      console.log('🔍 View Report - Final plan check:', {
        planType,
        planLower,
        currentSubscription: currentSubscription,
        isProfessional: planLower === 'professional',
        isEnterprise: planLower === 'enterprise',
        hasAccess: planLower === 'professional' || planLower === 'enterprise',
      });

      // Check if user has Professional or Enterprise plan
      if (planLower === 'professional' || planLower === 'enterprise') {
        console.log('✅ User has access to Reports screen');
        navigation.navigate('Report');
      } else {
        console.log('❌ User does not have access - Plan:', planLower);
        showCustomAlert(
          'Access Restricted',
          'Reports feature is available only for Professional and Enterprise plans. Please upgrade your plan to access advanced reports.',
          'warning',
        );
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback to alert if navigation fails
      showCustomAlert(
        'View Report',
        'Unable to open reports. Please try again.',
        'error',
      );
    }
  };

  const handleFilterPress = () => {
    setShowFilterModal(true);
  };

  // Check if user needs to fill business information (triggered by button clicks)
  const checkBusinessInfoCompletion = async () => {
    try {
      // One-time gate per-user: if we've ever shown this modal for THIS user, don't show again
      let userScopedKey = 'businessInfoShownOnce';
      try {
        const uid = await getUserIdFromToken();
        if (uid) userScopedKey = `businessInfoShownOnce:${uid}`;
      } catch {}
      try {
        const shownOnceScoped = await AsyncStorage.getItem(userScopedKey);
        const shownOnceGlobal = await AsyncStorage.getItem(
          'businessInfoShownOnce',
        ); // backward compat
        if (shownOnceScoped === 'true' || shownOnceGlobal === 'true') {
          console.log(
            'ℹ️ Business info modal already shown once for this user. Skipping.',
          );
          return false;
        }
      } catch {}

      // If we don't yet have userData (brand new user / first open), fall back to cache
      let effectiveUserData = userData;
      if (!effectiveUserData) {
        try {
          const cached = await AsyncStorage.getItem('cachedUserData');
          if (cached) effectiveUserData = JSON.parse(cached);
        } catch {}
      }
      // If still no data, assume new user and show the modal once now
      if (!effectiveUserData) {
        console.log(
          '🆕 New user detected (no userData yet). Showing business info modal once.',
        );
        setBusinessInfoForm({
          ownerName: '',
          businessName: '',
          businessType: '',
          businessSize: '',
          industry: '',
          monthlyTransactionVolume: '',
          currentAccountingSoftware: '',
        });
        setShowBusinessInfoModal(true);
        try {
          await AsyncStorage.setItem(userScopedKey, 'true');
          await AsyncStorage.setItem('businessInfoShownOnce', 'true'); // backward compat
        } catch {}
        return true;
      }

      // Check if user has default names that need to be changed
      // Derive mobile last 4 digits to detect default auto-generated names like
      // Owner: "User 9090" and Business: "User9090"
      const rawMobile =
        (effectiveUserData as any)?.mobileNumber ||
        (effectiveUserData as any)?.phone ||
        (effectiveUserData as any)?.phoneNumber ||
        (await AsyncStorage.getItem('userMobile')) ||
        (await AsyncStorage.getItem('userMobileNumber')) ||
        '';
      const digitsOnly = String(rawMobile).replace(/\D/g, '');
      const last4 = digitsOnly.slice(-4);
      const defaultOwnerFromMobile = last4 ? `User ${last4}` : 'User';
      const defaultBusinessFromMobile = last4 ? `User${last4}` : 'User';

      const ownerName = String(effectiveUserData.ownerName || '').trim();
      const businessName = String(effectiveUserData.businessName || '').trim();

      const looksLikeDefaultPattern = (name: string) => {
        if (!name) return true;
        // Matches "User 1234" or "User1234"
        if (/^User\s?\d{4}$/.test(name)) return true;
        if (
          last4 &&
          (name === defaultOwnerFromMobile ||
            name === defaultBusinessFromMobile)
        )
          return true;
        return false;
      };

      const hasDefaultNames =
        ownerName === 'User' ||
        businessName === 'My Business' ||
        businessName === 'User' ||
        !ownerName ||
        !businessName ||
        looksLikeDefaultPattern(ownerName) ||
        looksLikeDefaultPattern(businessName);

      console.log('🔍 Checking business info completion:', {
        ownerName: ownerName,
        businessName: businessName,
        last4,
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
        ownerName: effectiveUserData.ownerName || '',
        businessName: effectiveUserData.businessName || '',
        businessType: effectiveUserData.businessType || '',
        businessSize: effectiveUserData.businessSize || '',
        industry: effectiveUserData.industry || '',
        monthlyTransactionVolume:
          effectiveUserData.monthlyTransactionVolume || '',
        currentAccountingSoftware:
          effectiveUserData.currentAccountingSoftware || '',
      });

      // Save timestamp when modal is shown (per-user key)
      const modalData = {
        timestamp: now,
        date: new Date().toDateString(),
      };
      const lastShownKey = userScopedKey.replace(
        'businessInfoShownOnce',
        'lastModalShown',
      );
      await AsyncStorage.setItem(lastShownKey, JSON.stringify(modalData));

      // Mark as shown once so we never show again
      try {
        await AsyncStorage.setItem(userScopedKey, 'true');
        await AsyncStorage.setItem('businessInfoShownOnce', 'true'); // backward compat
      } catch {}

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

      // Try to obtain CSRF token if backend provides one, but do not block if unavailable
      let currentCsrfToken = csrfToken;
      if (!currentCsrfToken) {
        currentCsrfToken = await fetchCSRFToken();
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
      body.status = 'complete';

      // Include user's primary role id for backend auditing/mapping
      try {
        const { getRoleId } = await import('../../utils/roleHelper');
        const roleId = await getRoleId();
        if (roleId !== null && roleId !== undefined) {
          (body as any).roleId = roleId;
          (body as any).role_id = roleId; // alias for alternate DTOs
          console.log(
            '✅ CustomerScreen: Added role ID to request body:',
            roleId,
          );
        }
      } catch (e) {
        console.warn('⚠️ CustomerScreen: Failed to add role ID:', e);
      }

      console.log('🔄 Saving business info with body:', body);
      console.log('🔍 Using token:', accessToken?.substring(0, 20) + '...');
      console.log('🔍 API URL:', `${BASE_URL}/user/edit-profile`);

      const headers: any = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      if (currentCsrfToken) headers['X-CSRF-Token'] = currentCsrfToken;
      // Try multiple methods and endpoints to maximize compatibility
      const endpoints: Array<{
        method: 'PATCH' | 'PUT' | 'POST';
        url: string;
      }> = [
        { method: 'PATCH', url: `${BASE_URL}/user/edit-profile` },
        { method: 'PUT', url: `${BASE_URL}/user/edit-profile` },
        { method: 'POST', url: `${BASE_URL}/user/edit-profile` },
        { method: 'PATCH', url: `${BASE_URL}/users/profile` },
        { method: 'PUT', url: `${BASE_URL}/users/profile` },
        { method: 'PATCH', url: `${BASE_URL}/user/profile` },
        { method: 'PUT', url: `${BASE_URL}/user/profile` },
        { method: 'PATCH', url: `${BASE_URL}/profile` },
        { method: 'PUT', url: `${BASE_URL}/profile` },
      ];

      const bodyVariants: any[] = [
        body,
        (() => {
          const b = { ...body };
          delete b.id;
          return b;
        })(),
      ];

      let lastError: any = null;
      let successResp: any = null;
      for (const variant of bodyVariants) {
        for (const ep of endpoints) {
          try {
            const resp = await axios({
              method: ep.method,
              url: ep.url,
              data: variant,
              headers,
              withCredentials: true,
              validateStatus: s => s >= 200 && s < 300,
            });
            successResp = resp;
            console.log('✅ Business info saved successfully:', {
              method: ep.method,
              url: ep.url,
              status: resp.status,
            });
            break;
          } catch (e: any) {
            lastError = {
              e,
              method: ep.method,
              url: ep.url,
              status: e?.response?.status,
            };
            console.log('⚠️ Profile update attempt failed:', lastError);
            continue;
          }
        }
        if (successResp) break;
      }

      if (!successResp) {
        throw new Error(
          lastError?.status
            ? `Profile update failed (${lastError.status}) at ${lastError.method} ${lastError.url}`
            : 'Profile update failed: no compatible endpoint (PATCH/PUT/POST)',
        );
      }

      // Update local user data (remove id from body before updating)
      const { id, ...userData } = body;
      setUserData((prev: any) => ({ ...prev, ...userData }));

      // Immediately update business name in header (profile API businessName only)
      const newBusinessName = userData.businessName || '';
      updateBusinessNameIfPresent(newBusinessName);
      console.log('🔄 Updated business name in header:', newBusinessName);

      // Cache the updated user data for persistence
      try {
        const updatedUserData = { ...userData, businessName: newBusinessName };
        await AsyncStorage.setItem(
          'cachedUserData',
          JSON.stringify(updatedUserData),
        );
        console.log('✅ Cached updated user data with business name');
      } catch (cacheError) {
        console.error('❌ Failed to cache updated user data:', cacheError);
      }

      // Emit event to update drawer header immediately
      try {
        const eventPayload = {
          name: userData.ownerName || '',
          mobile: userData.mobileNumber || userData.phoneNumber || '',
        };
        console.log(
          '📡 CUSTOMER: Emitting profile-updated event with payload:',
          eventPayload,
        );
        DeviceEventEmitter.emit('profile-updated', eventPayload);
        console.log('📡 CUSTOMER: Event emitted successfully');
      } catch (emitError) {
        console.error(
          '❌ CUSTOMER: Failed to emit profile-updated event:',
          emitError,
        );
      }

      setShowBusinessInfoModal(false);
      setCheckingBusinessInfo(false);

      // Clear the modal timestamp since user completed the info
      await AsyncStorage.removeItem('lastModalShown');
      // No popup on success per request
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
    setVisibleCount(PAGE_SIZE);
  };

  // Enhanced filter modal with professional design
  const renderFilterModal = () =>
    showFilterModal && (
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
          onPress={() => setShowFilterModal(false)}
        />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            height: '90%',
            width: '100%',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={28}
                color="#222"
              />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Filter</Text>
              <Text style={styles.modalSubtitle}>
                Smart & organized filters
              </Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Filter Content */}
          <View style={styles.modalBody}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                ...styles.modalBodyContent,
                flexGrow: 1,
                paddingBottom: 20,
              }}
              bounces={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
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
                        size={20}
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
                        size={20}
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
                        size={16}
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
                    placeholderTextColor="#666666"
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
                            size={14}
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
                            size={14}
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
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={16}
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
                size={16}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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

      // Only strictly require id and name; provide safe defaults for the rest
      if (customer.id === undefined || customer.id === null) return null;
      if (!customer.name || String(customer.name).trim() === '') return null;

      const safeLocation =
        (customer.location && String(customer.location)) || 'India';
      const safeLastInteraction =
        (customer.lastInteraction && String(customer.lastInteraction)) ||
        'Recently';
      const safeAmount = Math.abs(Number(customer.amount) || 0);
      const safeType = (customer.type as any) === 'get' ? 'get' : 'give';
      const safeAvatar = (customer.avatar && String(customer.avatar)) || 'U';

      // Debug: Log customer data for troubleshooting
      console.log(`🔍 DEBUG: Customer ${customer.name}:`, {
        originalAmount: customer.amount,
        safeAmount: safeAmount,
        type: customer.type,
        safeType: safeType,
        customer: customer,
      });

      // Safe amount formatting
      let formattedAmount: string;
      try {
        formattedAmount =
          safeAmount === 0 ? '₹0' : `₹${safeAmount.toLocaleString()}`;
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
        if (safeType === 'get') {
          amountColor = '#28a745'; // GREEN for "Receipt" (receiving money)
          amountLabel = 'Receipt';
        } else if (safeType === 'give') {
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

      // Use the unique key generator to ensure absolutely unique keys
      // This uses a counter that increments for each key, guaranteeing uniqueness
      const uniqueKey = getUniqueKey(index, customer.id);

      return (
        <TouchableOpacity key={uniqueKey} onPress={handleCustomerPress}>
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
              <Text style={styles.avatarText}>{safeAvatar}</Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>
                {customer.name || 'Unknown'}
              </Text>
              <Text style={styles.customerDate}>{safeLastInteraction}</Text>
              {/* Using ternary operator instead of && */}
              {(() => {
                const formatPhone = (phone: string | undefined): string => {
                  if (!phone) return '';
                  let digits = String(phone).replace(/\D/g, '');
                  // If includes country code, reduce to last 10
                  if (digits.length > 10) digits = digits.slice(-10);
                  if (digits.length === 10) return `+91-${digits}`;
                  return '';
                };
                const formattedPhone = formatPhone(customer.phoneNumber);
                return formattedPhone ? (
                  <Text style={styles.customerPhone}>{formattedPhone}</Text>
                ) : null;
              })()}
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
      if (!Array.isArray(paginatedCustomers)) {
        console.warn('Filtered customers is not an array:', paginatedCustomers);
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

      // STRICT Deduplication: Remove ALL duplicates by ID
      // This is critical to prevent React duplicate key errors
      const seenIds = new Set<string | number>();
      const uniqueCustomers: typeof paginatedCustomers = [];
      let duplicateCount = 0;

      paginatedCustomers.forEach((customer, originalIndex) => {
        if (!customer || typeof customer !== 'object') return;

        const id = customer.id;

        // If customer has an ID, check for duplicates strictly by ID only
        if (id !== undefined && id !== null) {
          const idStr = String(id);
          if (seenIds.has(idStr)) {
            duplicateCount++;
            console.warn('⚠️ Duplicate customer ID REMOVED:', {
              id: id,
              name: customer.name,
              originalIndex: originalIndex,
              totalDuplicates: duplicateCount,
            });
            return; // Skip duplicate - only keep first occurrence
          }
          seenIds.add(idStr);
        }
        // If no ID, allow it (will get unique key via index)

        uniqueCustomers.push(customer);
      });

      if (duplicateCount > 0) {
        console.log(
          `🔍 Removed ${duplicateCount} duplicate customer(s) to prevent key collisions`,
        );
      }

      // Final safeguard: ensure each customer gets a truly unique index
      // Map with index to guarantee uniqueness even if deduplication missed something
      // Index is ALWAYS unique in array.map(), so this guarantees unique keys
      const generatedKeys = new Set<string>();
      const validCustomers = uniqueCustomers
        .map((customer, index) => {
          // Double-check: ensure customer is valid before rendering
          if (!customer || typeof customer !== 'object') return null;

          // Generate key - index guarantees uniqueness, but verify anyway
          const uniqueKey = getUniqueKey(index, customer.id);

          // This should NEVER happen since index is always unique in map()
          // But we check anyway to catch any bugs
          if (generatedKeys.has(uniqueKey)) {
            console.error(
              '❌ CRITICAL: Duplicate key detected! This should be impossible!',
              {
                key: uniqueKey,
                index: index,
                customerId: customer.id,
                customerName: customer.name,
                allKeys: Array.from(generatedKeys),
              },
            );
            // Skip this item to prevent React error
            return null;
          }
          generatedKeys.add(uniqueKey);

          // Render with guaranteed unique index (index is always 0, 1, 2, 3... unique)
          return renderCustomerItem(customer, index);
        })
        .filter(Boolean); // Remove any null/undefined items

      // Log deduplication results for debugging
      if (uniqueCustomers.length !== paginatedCustomers.length) {
        console.log('🔍 Deduplication removed duplicates:', {
          original: paginatedCustomers.length,
          afterDedup: uniqueCustomers.length,
          removed: paginatedCustomers.length - uniqueCustomers.length,
        });
      }

      // Final validation
      if (generatedKeys.size !== validCustomers.length) {
        console.error('❌ Key count mismatch!', {
          uniqueKeys: generatedKeys.size,
          validCustomers: validCustomers.length,
        });
      }

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
      // Debug: Log the actual summary data being used for display
      console.log(
        '🔍 DEBUG: renderSummarySection called with summaryData:',
        summaryData,
      );
      console.log('🔍 DEBUG: Individual values:', {
        payment: summaryData.payment,
        receipt: summaryData.receipt,
        sell: summaryData.sell,
        purchase: summaryData.purchase,
      });

      return (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconLabelRow}>
                <Text style={styles.summaryLabel}>Payment</Text>
              </View>
              <Text style={[styles.summaryAmount, { color: '#dc3545' }]}>
                ₹{summaryData.payment.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIconLabelRow}>
                <Text style={styles.summaryLabel}>Receipt</Text>
              </View>
              <Text style={[styles.summaryAmount, { color: '#28a745' }]}>
                ₹{summaryData.receipt.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Sell and Purchase Data Display Row - Hidden */}
          {/* <View style={styles.dataDisplayRow}>
            <View style={styles.dataDisplayItem}>
              <View style={styles.summaryIconLabelRow}>
                <Text style={styles.dataDisplayLabel}>Sell</Text>
              </View>
              <Text style={[styles.dataDisplayAmount, { color: '#28a745' }]}>
                ₹{summaryData.sell.toLocaleString()}
              </Text>
            </View>
            <View style={styles.dataDisplayItem}>
              <View style={styles.summaryIconLabelRow}>
                <Text style={styles.dataDisplayLabel}>Purchase</Text>
              </View>
              <Text style={[styles.dataDisplayAmount, { color: '#dc3545' }]}>
                ₹{summaryData.purchase.toLocaleString()}
              </Text>
            </View>
          </View> */}

          {/* View Report Button - Bottom */}
          <TouchableOpacity
            style={styles.bottomViewReportButton}
            onPress={handleViewReport}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={17}
              color="#4f8cff"
            />
            <Text style={styles.bottomViewReportText}>View Report</Text>
          </TouchableOpacity>
        </View>
      );
    } catch (error) {
      console.error('Error rendering summary section:', error);
      return (
        <View style={styles.summaryContainer}>
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
              onChangeText={text => {
                setSearchQuery(text);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholderTextColor="#666666"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
              >
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
        <View
          style={[
            styles.header,
            getSolidHeaderStyle(
              preciseStatusBarHeight || statusBarSpacer.height,
            ),
          ]}
          key={`hdr-${headerKey}`}
        >
          <View style={{ height: HEADER_CONTENT_HEIGHT }} />
          <TouchableOpacity
            style={styles.headerMenuButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="menu" size={25} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={21}
              color="#fff"
            />
            <Text style={styles.headerText}>{getHeaderDisplayName()}</Text>
          </View>
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => navigation.navigate('ProfileScreen', { user: {} })}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil" size={17} color="#fff" />
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
      return <TopTabs activeTab={activeTab} onChange={handleTabChange} />;
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

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMoreData) return;
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setVisibleCount(prev =>
        Math.min(
          prev + PAGE_SIZE,
          filteredCustomers.length || prev + PAGE_SIZE,
        ),
      );
      setIsLoadingMore(false);
    });
  };

  // Main render function with error boundary
  const renderMainContent = () => {
    try {
      return (
        <>
          {/* Header */}
          {renderHeader()}

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={[0]}
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
                        fetch(`${BASE_URL}/transactions`, {
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
                    console.log(
                      '🔍 DEBUG: Setting allVouchers in manual refresh:',
                      {
                        vouchersResponseLength: vouchersResponse.length,
                        vouchersResponse: vouchersResponse.slice(0, 3), // Show first 3 vouchers
                      },
                    );
                    setAllVouchers(vouchersResponse);
                    setUserData(userDataResult);
                    updateBusinessNameIfPresent(userDataResult?.businessName);

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
            {/* Sticky header block: Tabs + Summary + Search */}
            <View style={styles.stickyHeaderBlock}>
              {renderNavigationTabs()}
              {renderSummarySection()}
              {renderSearchAndFilter()}
            </View>

            {/* Customer List */}
            <View style={styles.customerList}>
              <PartyList
                items={
                  (paginatedCustomers || []).map((it: any) => {
                    const raw = String(
                      it?.phoneNumber || it?.partyPhone || it?.phone || '',
                    );
                    let digits = raw.replace(/\D/g, '');
                    if (digits.length > 10) digits = digits.slice(-10);
                    const formatted =
                      digits.length === 10 ? `+91-${digits}` : '';
                    return { ...it, phoneNumber: formatted };
                  }) as unknown as PartyItem[]
                }
                emptyTitle={tabText.emptyText}
                emptySubtitle={tabText.emptySubtext}
                onPressItem={item => {
                  try {
                    navigation.navigate('CustomerDetail', {
                      customer: item,
                      partyType:
                        (item.partyType as any) ||
                        (activeTab === 'suppliers' ? 'supplier' : 'customer'),
                    });
                  } catch (e) {
                    console.error('Navigation error:', e);
                  }
                }}
                onEndReached={handleLoadMore}
                isLoadingMore={isLoadingMore}
                hasMore={hasMoreData}
              />
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
                        placeholderTextColor="#666666"
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
                        placeholderTextColor="#666666"
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
                        placeholderTextColor="#666666"
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
          return (
            <Text style={{ fontFamily: 'Roboto-Medium' }}>
              {String(element)}
            </Text>
          );
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
    <SafeAreaView style={styles.container} key={refreshKey} edges={['bottom']}>
      <StatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
      />
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
  stickyHeaderBlock: {
    backgroundColor: '#f8fafc',
    zIndex: 1,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    borderWidth: 0,
  },
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
    paddingTop: 30,
    paddingBottom: 30,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // marginLeft: 10,
  },
  editIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 12,
  },
  headerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Roboto-Medium',
  },
  headerMenuButton: {
    padding: 10,
    // borderRadius: 10,
    // backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 6,
  },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 1000,
    elevation: 8,
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
    color: '#64748b',
    fontFamily: 'Roboto-Medium',
  },

  activeTabText: {
    color: '#4f8cff',

    fontFamily: 'Roboto-Medium',
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
    fontFamily: 'Roboto-Medium',
  },

  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  summaryContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
    paddingBottom: 0,
  },

  bottomViewReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 4,
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 6,
    gap: 6,
  },
  bottomViewReportText: {
    color: '#4f8cff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 5.5,
    paddingHorizontal: 0,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderRadius: 7,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#e9eef5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#000000',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },

  summaryAmount: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'Roboto-Medium',
  },

  dataDisplayRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingHorizontal: 0,
  },
  dataDisplayItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderRadius: 7,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#e9eef5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
  },
  summaryIconLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dataDisplayIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  dataDisplayLabel: {
    fontSize: 12,
    color: '#000000',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },

  dataDisplayAmount: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'Roboto-Medium',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    // paddingVertical: 6,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.06,
    // shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  filterButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e6eaf0',
    minWidth: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: '#4f8cff',
    borderWidth: 2,
    backgroundColor: '#eaf2ff',
  },
  customerList: {
    marginBottom: 60, // Space for FAB
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Roboto-Medium',
  },

  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
  },

  customerDate: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  customerPhone: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: 'Roboto-Medium',
  },

  customerAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
  },

  amountLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  fab: {
    position: 'absolute',
    bottom: 40,
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
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
    fontWeight: '700',
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 9,
    fontSize: 10,
    color: '#666666',
    fontFamily: 'Roboto-Medium',
  },

  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  errorText: {
    marginTop: 9,
    fontSize: 10,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Roboto-Medium',
  },

  retryButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 9.5,
    fontFamily: 'Roboto-Medium',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 9,
    fontSize: 12,
    color: '#333333',
    marginBottom: 3,
    fontFamily: 'Roboto-Medium',
  },

  emptySubtext: {
    fontSize: 9.5,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
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
    fontSize: 18,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  modalSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
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
    padding: 16,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 12,
    color: '#333333',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  filterOptionTextSelected: {
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10.5,
    paddingTop: 12,
    paddingBottom: 24,
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resetButtonText: {
    color: '#dc3545',
    fontSize: 14,
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
  },

  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f8cff',
    borderWidth: 2,
    borderColor: '#4f8cff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
  },

  locationInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 13.5,
    paddingVertical: 10.5,
    fontSize: 12,
    color: '#333333',
    backgroundColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 8,
    lineHeight: 12,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 9.5,
    color: '#666666',
    marginTop: 3,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  quickFiltersSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 12,
    letterSpacing: -0.2,
    fontFamily: 'Roboto-Medium',
  },

  quickFiltersGrid: {
    flexDirection: 'row',
    gap: 7.5,
  },
  quickFilterCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 80,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eaf2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickFilterLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  quickFilterSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  amountRangeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4.5,
  },
  amountRangeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#cfe0ff',
    backgroundColor: '#ffffff',
    minWidth: 80,
    justifyContent: 'center',
    gap: 6,
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
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  amountRangeTextActive: {
    color: '#fff',
    fontFamily: 'Roboto-Medium',
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
    fontSize: 11,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  clearLocationButton: {
    padding: 3,
    marginLeft: 6,
  },
  addressSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fbff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#e6ecf5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  addressIcon: {
    marginRight: 7.5,
  },
  addressSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
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
    fontSize: 9.5,
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 8.5,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  contactFilterOptionTextActive: {
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },
  contactFilterGrid: {
    flexDirection: 'column',
    gap: 9,
  },
  contactFilterCard: {
    backgroundColor: '#f9fbff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e6ecf5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  contactFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7.5,
    gap: 4.5,
  },
  contactFilterTitle: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  contactFilterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4.5,
  },
  contactFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minWidth: 70,
  },
  contactFilterButtonActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  contactFilterButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'Roboto-Medium',
  },

  contactFilterButtonTextActive: {
    color: '#fff',
    fontFamily: 'Roboto-Medium',
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
    fontSize: 12,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  businessNameModalCloseButton: {
    padding: 3,
  },
  businessNameModalBody: {
    marginBottom: 18,
  },
  businessNameModalLabel: {
    fontSize: 11,
    color: '#333333',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
  },

  businessNameModalInput: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 9,
    fontSize: 11,
    color: '#333333',
    backgroundColor: '#f9fafb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 11,
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
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
    color: '#333333',
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
  },

  businessInfoModalSubtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
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
    color: '#333333',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
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
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  businessInfoDropdownSelectedText: {
    color: '#333333',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
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
    color: '#333333',
    backgroundColor: '#f8fafc',
    minHeight: 48,
    fontFamily: 'Roboto-Medium',
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
    color: '#666666',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
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
    fontFamily: 'Roboto-Medium',
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
    color: '#333333',
    fontFamily: 'Roboto-Medium',
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
    fontSize: 15,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 9,
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },

  alertMessage: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 6,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 11,
    color: '#6c757d',
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
  },

  alertButtonConfirmText: {
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
  },
});

export default CustomerScreen;
