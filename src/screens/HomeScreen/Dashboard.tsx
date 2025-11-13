import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { DrawerActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
import { BASE_URL } from '../../api';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
// Removed SafeAreaView to allow full control over StatusBar area
import axios from 'axios';
import { getUserIdFromToken } from '../../utils/storage';
import { useVouchers } from '../../context/VoucherContext';
import { useNotifications } from '../../context/NotificationContext';
import PremiumBadge from '../../components/PremiumBadge';
import DashboardShimmer from '../../components/DashboardShimmer';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { getStatusBarSpacerHeight } from '../../utils/statusBarManager';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import StableStatusBar from '../../components/StableStatusBar';

// Global cache for Dashboard with TTL (Time To Live)
let globalDashboardCache: any = {
  userData: null,
  folders: [],
  fullUserData: null,
  vouchers: [],
  lastUpdated: 0,
};
let globalDashboardCacheChecked = false;

// Cache TTL: 30 seconds (30,000 ms) - reduced for more responsive updates
const CACHE_TTL = 30 * 1000;

// Function to clear global cache
export const clearDashboardCache = () => {
  globalDashboardCache = {
    userData: null,
    folders: [],
    fullUserData: null,
    vouchers: [],
    lastUpdated: 0,
  };
  globalDashboardCacheChecked = false;
};

// Function to force refresh dashboard data
export const forceRefreshDashboard = () => {
  clearDashboardCache();
  return true;
};

// Function to refresh specific data types
export const refreshDashboardData = async (
  dataType: 'vouchers' | 'folders' | 'all' = 'all',
) => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) return false;

    if (dataType === 'vouchers' || dataType === 'all') {
      // Use unified API with caching
      const vouchersResult = (await unifiedApi.getTransactions({
        limit: 50,
      })) as {
        data: any;
        status: number;
        headers: Headers;
      };

      const vouchersData = vouchersResult?.data || vouchersResult;
      if (vouchersData) {
        globalDashboardCache.vouchers = Array.isArray(vouchersData)
          ? vouchersData
          : vouchersData.data || [];
        globalDashboardCache.lastUpdated = Date.now();
      }
    }

    if (dataType === 'folders' || dataType === 'all') {
      // Use unified API with caching
      const foldersResult = (await unifiedApi.get('/menus')) as {
        data: any;
        status: number;
        headers: Headers;
      };

      const foldersData = foldersResult?.data || foldersResult;
      if (foldersData) {
        const foldersArray = Array.isArray(foldersData)
          ? foldersData
          : foldersData.data || [];
        globalDashboardCache.folders = foldersArray.filter(
          (item: any) =>
            item.parentId === null &&
            item.isCustom === true &&
            !DEFAULT_TYPES.includes(item.title.toLowerCase()) &&
            item.title.toLowerCase() !== 'add folder',
        );
        globalDashboardCache.lastUpdated = Date.now();
      }
    }

    return true;
  } catch (error) {
    console.error('Error refreshing dashboard data:', error);
    return false;
  }
};

// Function to check if cache is still valid
const isCacheValid = () => {
  const now = Date.now();
  return (
    globalDashboardCache.lastUpdated > 0 &&
    now - globalDashboardCache.lastUpdated < CACHE_TTL
  );
};

// import EntryForm from '../../components/EntryForm';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

interface UserData {
  id: number;
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  businessType: string;
  businessSize: string;
  industry: string;
  profileComplete: boolean;
}

interface Transaction {
  id: number;
  type: 'Invoice' | 'Purchase' | 'Receipt' | 'Payment';
  party: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Received';
}

const DEFAULT_TYPES = ['sell', 'receipt', 'payment', 'purchase'];

// Map API icon field to MaterialCommunityIcons name
const FOLDER_TYPE_ICONS: Record<string, string> = {
  sell: 'cart-plus',
  receipt: 'receipt',
  payment: 'currency-inr',
  purchase: 'cart-outline',
};
const getFolderIcon = (icon: string | undefined, title?: string) => {
  if (!icon) {
    // Fallback to title-based icon mapping
    if (title) {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle === 'sell') return 'cart-plus';
      if (lowerTitle === 'receipt') return 'receipt';
      if (lowerTitle === 'payment') return 'currency-inr';
      if (lowerTitle === 'purchase') return 'cart-outline';
      if (lowerTitle === 'add folder') return 'folder-plus';

      // For custom folders, try to determine appropriate icon based on name
      if (lowerTitle.includes('gst') || lowerTitle.includes('tax'))
        return 'calculator';
      if (lowerTitle.includes('cash') || lowerTitle.includes('money'))
        return 'cash-multiple';
      if (lowerTitle.includes('bank') || lowerTitle.includes('account'))
        return 'bank';
      if (lowerTitle.includes('expense') || lowerTitle.includes('cost'))
        return 'cash-minus';
      if (lowerTitle.includes('income') || lowerTitle.includes('revenue'))
        return 'cash-plus';
      if (lowerTitle.includes('report') || lowerTitle.includes('analytics'))
        return 'chart-line';
      if (lowerTitle.includes('customer') || lowerTitle.includes('client'))
        return 'account-group';
      if (lowerTitle.includes('supplier') || lowerTitle.includes('vendor'))
        return 'truck-delivery';
      if (lowerTitle.includes('product') || lowerTitle.includes('item'))
        return 'package-variant';
      if (lowerTitle.includes('service') || lowerTitle.includes('work'))
        return 'briefcase';

      // For very short or random names, use a generic folder icon
      if (lowerTitle.length <= 5) return 'folder-multiple';

      // Default for custom folders
      return 'folder-multiple';
    }
    return 'folder-outline';
  }

  const mapped = FOLDER_TYPE_ICONS[String(icon).toLowerCase()];
  return mapped || icon || 'folder-outline';
};

// Return icon color by quick action category title
const getActionIconColor = (title?: string) => {
  const key = String(title || '').toLowerCase();
  if (key === 'sell') return '#dc3545'; // red
  if (key === 'purchase') return '#dc3545'; // red
  if (key === 'receipt') return '#1ecb81'; // green
  if (key === 'payment') return '#1ecb81'; // green
  return '#1f2430'; // default
};

// Background tint for the circular icon bubble per category
const getActionIconBg = (title?: string) => {
  const key = String(title || '').toLowerCase();
  if (key === 'sell' || key === 'purchase') return 'rgba(220, 53, 69, 0.12)'; // light red
  if (key === 'receipt' || key === 'payment') return 'rgba(30, 203, 129, 0.12)'; // light green
  return 'rgba(31, 36, 48, 0.08)';
};

const Dashboard: React.FC = () => {
  // Screen tracking hook
  useScreenTracking();

  // Simple StatusBar configuration - let ForceStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const { isAuthenticated, logout } = useAuth();
  const { vouchers, setAllVouchers } = useVouchers();
  const { notificationService } = useNotifications();
  const { showAlert } = useAlert();

  const [userData, setUserData] = useState<UserData | null>(
    globalDashboardCache.userData,
  );
  const [folders, setFolders] = useState<any[]>(globalDashboardCache.folders);
  const [fullUserData, setFullUserData] = useState<any>(
    globalDashboardCache.fullUserData,
  );
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(!globalDashboardCacheChecked);
  const [error, setError] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const scrollRef = React.useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<any>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Check for cached data on component mount
  useEffect(() => {
    checkCachedData();
  }, []);

  // Listen for voucher context changes and update dashboard
  useEffect(() => {
    if (vouchers.length > 0 && vouchers !== globalDashboardCache.vouchers) {
      // Update cache only when vouchers actually change
      globalDashboardCache.vouchers = vouchers;
      globalDashboardCache.lastUpdated = Date.now();
    }
  }, [vouchers]);

  // Fetch FCM token only once on mount
  useEffect(() => {
    const fetchFCMToken = async () => {
      try {
        // First ensure notifications are initialized
        if (!notificationService.isServiceInitialized()) {
          await notificationService.initializeNotifications();
        }

        // Get FCM token (this will fetch from Firebase if not cached)
        const token = await notificationService.refreshFCMToken();
        setFcmToken(token);

        // Register FCM token with backend only if we don't have it cached
        if (token && !globalDashboardCache.fcmToken) {
          try {
            const accessToken = await AsyncStorage.getItem('accessToken');
            if (accessToken) {
              const success = await notificationService.sendTokenToBackend(
                token,
              );
              if (success) {
                // Cache the FCM token to avoid re-registration
                globalDashboardCache.fcmToken = token;
                console.log('✅ FCM token registered successfully');
              } else {
                console.warn('⚠️ FCM token registration failed');
              }
            }
          } catch (error) {
            console.warn('Error registering FCM token:', error);
            // Don't block the app for FCM registration failures
          }
        }
      } catch (error) {
        console.warn('Error fetching FCM token:', error);
      }
    };

    fetchFCMToken();
  }, [notificationService]);

  // Handle navigation back to screen - refresh data only when needed
  useFocusEffect(
    React.useCallback(() => {
      // Scroll to top when screen is focused
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }

      // Only refresh data if cache is stale or we don't have data
      const shouldRefresh =
        !isCacheValid() ||
        !globalDashboardCache.vouchers.length ||
        !globalDashboardCache.folders.length;

      if (shouldRefresh) {
        const refreshOnFocus = async () => {
          try {
            const accessToken = await AsyncStorage.getItem('accessToken');
            if (accessToken) {
              // Fetch fresh data only if needed
              const [vouchersResult, foldersResult] = await Promise.all([
                fetchVouchers(accessToken),
                fetchFolders(accessToken),
              ]);

              // Update cache with fresh data
              globalDashboardCache.vouchers = vouchersResult;
              globalDashboardCache.folders = foldersResult;
              globalDashboardCache.lastUpdated = Date.now();

              // Update state with fresh data
              setAllVouchers(vouchersResult);
              setFolders(foldersResult);
            }
          } catch (error) {
            console.error('❌ Dashboard: Focus refresh error:', error);
          }
        };

        refreshOnFocus();
      }
    }, []), // Remove dependencies to prevent loops
  );

  // Mock data for transactions
  const transactions: Transaction[] = [
    {
      id: 1,
      type: 'Invoice',
      party: 'ABC Corp',
      amount: 15000,
      date: '2024-01-15',
      status: 'Paid',
    },
    {
      id: 2,
      type: 'Purchase',
      party: 'XYZ Supplies',
      amount: 8500,
      date: '2024-01-14',
      status: 'Pending',
    },
    {
      id: 3,
      type: 'Receipt',
      party: 'DEF Ltd',
      amount: 22000,
      date: '2024-01-13',
      status: 'Received',
    },
    {
      id: 4,
      type: 'Payment',
      party: 'GHI Services',
      amount: 12000,
      date: '2024-01-12',
      status: 'Paid',
    },
  ];

  // Check for cached data on component mount
  const checkCachedData = async () => {
    // If we have valid cache, use it immediately but still refresh in background
    if (isCacheValid()) {
      setUserData(globalDashboardCache.userData);
      setFolders(globalDashboardCache.folders);
      setFullUserData(globalDashboardCache.fullUserData);
      setLoading(false);
      globalDashboardCacheChecked = true;

      // Only fetch fresh data in background if cache is stale
      if (!isCacheValid()) {
        setTimeout(() => {
          fetchDataInBackground();
        }, 100);
      }
      return;
    }

    // If no valid cache, fetch all data
    await fetchAllData();
  };

  // Fetch all data at once to reduce API calls
  const fetchAllData = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const mobileNumber =
        (await AsyncStorage.getItem('userMobileNumber')) || '9844587867';

      if (!accessToken) {
        throw new Error('Authentication token not found');
      }

      console.log(
        '🔑 Dashboard: Using token:',
        accessToken.substring(0, 20) + '...',
      );
      console.log('🌐 Dashboard: Making API calls to:', BASE_URL);

      // Add timeout wrapper to prevent API calls from hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Dashboard API request timeout')),
          20000,
        );
      });

      // Use unified API's built-in parallel fetching with timeout
      const [
        userDataResult,
        foldersResult,
        vouchersResult,
        fullUserDataResult,
      ] = (await Promise.race([
        Promise.all([
          unifiedApi.getUserProfile(),
          unifiedApi.get('/menus'),
          unifiedApi.getTransactions({ limit: 50 }),
          unifiedApi.getUserProfile(), // Full user data same as profile
        ]),
        timeoutPromise,
      ])) as [any, any, any, any];

      console.log('✅ Dashboard: All API calls completed successfully');

      // Update cache with timestamp
      globalDashboardCache = {
        userData: userDataResult,
        folders: foldersResult,
        vouchers: vouchersResult,
        fullUserData: fullUserDataResult,
        lastUpdated: Date.now(),
      };
      globalDashboardCacheChecked = true;

      // Update state
      setUserData(userDataResult);
      setFolders(foldersResult);
      setAllVouchers(vouchersResult);
      setFullUserData(fullUserDataResult);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error fetching dashboard data:', err);
      console.error('❌ Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        code: err.code,
      });

      let errorMessage = 'Failed to load dashboard data';
      if (err.message === 'Dashboard API request timeout') {
        errorMessage =
          'Request timeout. Please check your connection and try again.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (err.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  // Background refresh function
  const fetchDataInBackground = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) return;

      // Only refresh vouchers in background (most frequently changing data)
      const vouchersResult = await fetchVouchers(accessToken);
      if (vouchersResult && vouchersResult !== globalDashboardCache.vouchers) {
        globalDashboardCache.vouchers = vouchersResult;
        globalDashboardCache.lastUpdated = Date.now();
        setAllVouchers(vouchersResult);
      }
    } catch (error) {
      console.error('❌ Dashboard: Background refresh error:', error);
    }
  };

  // Individual fetch functions (simplified)
  const fetchUserData = async (accessToken: string): Promise<UserData> => {
    // Use mock data for now to reduce API calls
    const mobileNumber =
      (await AsyncStorage.getItem('userMobileNumber')) || '9844587867';

    return {
      id: 1,
      businessName: 'Smart Business Solutions',
      ownerName: 'John Doe',
      mobileNumber: mobileNumber,
      businessType: 'Private Limited',
      businessSize: 'Small',
      industry: 'Technology',
      profileComplete: true,
    };
  };

  const fetchFolders = async (accessToken: string): Promise<any[]> => {
    try {
      // Use unified API with caching
      const response = (await unifiedApi.get('/menus')) as {
        data: any;
        status: number;
        headers: Headers;
      };

      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : [];

      const userFolders = rows.filter(
        (item: any) =>
          item &&
          item.parentId === null &&
          item.isCustom === true &&
          typeof item.title === 'string' &&
          !DEFAULT_TYPES.includes(item.title.toLowerCase()) &&
          item.title.toLowerCase() !== 'add folder',
      );

      console.log('🔍 Dashboard - Filtered user folders:', userFolders);
      return userFolders;
    } catch (err) {
      console.warn('Error fetching folders:', err);
      return [];
    }
  };

  const fetchVouchers = async (accessToken: string): Promise<any[]> => {
    try {
      // Use unified API with caching
      const res = (await unifiedApi.getTransactions({ limit: 50 })) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const rows = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      return rows;
    } catch (err) {
      console.warn('Error fetching vouchers/transactions:', err);
      return [];
    }
  };

  const fetchFullUserData = async (accessToken: string): Promise<any> => {
    try {
      // Use unified API with caching
      const res = (await unifiedApi.getUserProfile()) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // Some controllers return the user entity directly
      return res?.data ?? res ?? null;
    } catch (err) {
      console.warn('Error fetching full user data:', err);
      return null;
    }
  };

  // Compute Today's Sync and Pending counts
  const syncCount = vouchers.filter(v => v && v.syncYN === 'Y').length;
  const pendingCount = vouchers.filter(v => v && v.syncYN === 'N').length;

  // Compute top 10 latest transactions (by date desc)
  const recentTransactions = [...vouchers]
    .filter(v => v)
    .sort((a, b) => {
      try {
        const dA =
          (a &&
            (a.date || a.createdAt || a.voucherDate || a.transactionDate)) ||
          0;
        const dB =
          (b &&
            (b.date || b.createdAt || b.voucherDate || b.transactionDate)) ||
          0;
        return new Date(dB as any).getTime() - new Date(dA as any).getTime();
      } catch (error) {
        return 0; // If date parsing fails, keep original order
      }
    })
    .slice(0, 10);

  // Helpers to safely read transaction fields from heterogeneous API rows
  const getTxnDate = (t: any): string | null => {
    const raw =
      t?.date || t?.createdAt || t?.voucherDate || t?.transactionDate || null;
    return raw ? new Date(raw).toISOString().split('T')[0] : null;
  };
  const getTxnParty = (t: any): string =>
    t?.partyName ||
    t?.party ||
    t?.customerName ||
    t?.supplierName ||
    t?.name ||
    'Unknown';
  const getTxnAmount = (t: any): number =>
    Number(t?.amount ?? t?.total ?? t?.netAmount ?? t?.grandTotal ?? 0);
  const getTxnType = (t: any): string =>
    (t?.type || t?.voucherType || 'Unknown').toString();
  const getTxnStatus = (t: any): string => {
    if (t?.status) return String(t.status);
    if (t?.syncYN === 'Y') return 'complete';
    if (t?.syncYN === 'N') return 'pending';
    return 'Unknown';
  };

  const handleLogout = async () => {
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'confirm',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await logout(); // Only use context logout
        } catch (error) {
          console.error('Logout error:', error);
        }
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Clear cache and fetch completely fresh data on pull-to-refresh
    try {
      clearDashboardCache(); // Clear cache to force fresh fetch
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        const [
          vouchersResult,
          foldersResult,
          userDataResult,
          fullUserDataResult,
        ] = await Promise.all([
          fetchVouchers(accessToken),
          fetchFolders(accessToken),
          fetchUserData(accessToken),
          fetchFullUserData(accessToken),
        ]);

        // Update cache with completely fresh data
        globalDashboardCache = {
          userData: userDataResult,
          folders: foldersResult,
          vouchers: vouchersResult,
          fullUserData: fullUserDataResult,
          lastUpdated: Date.now(),
        };

        // Update all state with fresh data
        setUserData(userDataResult);
        setFolders(foldersResult);
        setAllVouchers(vouchersResult);
        setFullUserData(fullUserDataResult);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        showAlert({
          title: 'Error',
          message: 'Authentication token not found. Please login again.',
          type: 'error',
          confirmText: 'OK',
        });
        return;
      }

      const response = (await unifiedApi.delete(`/menus/${folderId}`)) as {
        data: any;
        status: number;
        headers: Headers;
      };

      if (response.status === 200 || response.status === 204) {
        // Update local state and cache only on successful deletion
        const updatedFolders = folders.filter(f => f.id !== folderId);
        setFolders(updatedFolders);
        globalDashboardCache.folders = updatedFolders;
        globalDashboardCache.lastUpdated = Date.now();
        console.log('✅ Folder deleted successfully');
      } else {
        throw new Error(`Delete failed with status: ${response.status}`);
      }
    } catch (err: any) {
      console.error('Error deleting folder:', err);
      let errorMessage = 'Failed to delete folder.';

      if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'You do not have permission to delete this folder.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Folder not found. It may have been already deleted.';
      } else if (err.message) {
        errorMessage = `Delete failed: ${err.message}`;
      }

      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
        confirmText: 'OK',
      });
    }
  };

  const showDeleteModal = (folder: any) => {
    setFolderToDelete(folder);
    setDeleteModalVisible(true);
  };

  const hideDeleteModal = () => {
    setDeleteModalVisible(false);
    setFolderToDelete(null);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete || !folderToDelete.id) {
      showAlert({
        title: 'Error',
        message: 'Invalid folder selected for deletion.',
        type: 'error',
        confirmText: 'OK',
      });
      hideDeleteModal();
      return;
    }

    try {
      await handleDeleteFolder(folderToDelete.id);
      hideDeleteModal();
    } catch (error) {
      console.error('Error in confirmDeleteFolder:', error);
      // Error is already handled in handleDeleteFolder
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={64}
            color="#dc3545"
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              checkCachedData();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Plan hierarchy for comparison (only free and premium)
  const PLAN_HIERARCHY = {
    free: 0,
    premium: 1,
  };

  // Utility to check if a plan level is accessible to the user
  const isPlanAccessible = (userPlan: string, featurePlan: string): boolean => {
    const userLevel =
      PLAN_HIERARCHY[userPlan as keyof typeof PLAN_HIERARCHY] ?? 0;
    const featureLevel =
      PLAN_HIERARCHY[featurePlan as keyof typeof PLAN_HIERARCHY] ?? 0;
    return userLevel >= featureLevel;
  };

  // Static quick actions with plan types (only free and premium)
  const staticActions = [
    {
      title: 'Sell',
      icon: 'cart-plus',
      screen: 'Invoice',
      planType: 'free',
    },
    { title: 'Receipt', icon: 'receipt', screen: 'Receipt', planType: 'free' },
    {
      title: 'Payment',
      icon: 'currency-inr',
      screen: 'Payment',
      planType: 'free', // Based on API response - Payment is free
    },
    {
      title: 'Purchase',
      icon: 'cart-outline',
      screen: 'Purchase',
      planType: 'free', // Based on API response - Purchase is free
    },
  ];

  // Get user's plan type
  const userPlan = fullUserData?.planType || 'free';

  // Show all static actions with plan badges (for visibility)
  const allStaticActions = staticActions;

  // Dynamic quick actions - show all folders
  const dynamicActions = [...folders]
    .filter(
      f =>
        f.parentId === null && // ✅ Changed from 28 to null to match AddFolderScreen
        f.isCustom === true && // ✅ Only show custom user folders
        f.isVisible &&
        !['sell', 'receipt', 'payment', 'purchase', 'add folder'].includes(
          f.title?.toLowerCase(),
        ),
    )
    .sort((a, b) => Number(a.id) - Number(b.id));
  const visibleDynamic = dynamicActions.slice(0, 2);
  const overflowDynamic = dynamicActions.slice(2);
  const quickActions = [...allStaticActions, ...visibleDynamic];

  // Removed console.log to prevent render loops

  return (
    <View style={styles.safeArea}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
      {/* Fixed Header */}
      <View
        style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialCommunityIcons name="menu" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Demo: EntryForm at the top of Dashboard */}

        {/* Profile Card removed as requested */}

        {/* Profile Modal */}
        <Modal
          visible={profileModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 24,
                width: '90%',
                maxWidth: 400,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  marginBottom: 12,
                  color: '#222',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Profile Details
              </Text>
              {profileLoading || !fullUserData ? (
                <Text
                  style={{
                    color: '#888',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Loading...
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {fullUserData.ownerName}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {fullUserData.mobileNumber}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {fullUserData.businessName}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Business Type: {fullUserData.businessType}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    GST Number: {fullUserData.gstNumber}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Business Size: {fullUserData.businessSize}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Industry: {fullUserData.industry || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Monthly Transaction Volume:{' '}
                    {fullUserData.monthlyTransactionVolume || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Current Accounting Software:{' '}
                    {fullUserData.currentAccountingSoftware || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Team Size: {fullUserData.teamSize || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Preferred Language: {fullUserData.preferredLanguage || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Features:{' '}
                    {Array.isArray(fullUserData.features)
                      ? fullUserData.features.join(', ')
                      : '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Bank Name: {fullUserData.bankName || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Account Number: {fullUserData.accountNumber || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    IFSC Code: {fullUserData.ifscCode || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Primary Goal: {fullUserData.primaryGoal || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Current Challenges: {fullUserData.currentChallenges || '-'}
                  </Text>
                  <Text
                    style={{
                      color: '#666',
                      marginBottom: 6,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Profile Complete:{' '}
                    {fullUserData.profileComplete ? 'Yes' : 'No'}
                  </Text>
                </ScrollView>
              )}
              <TouchableOpacity
                style={{
                  marginTop: 18,
                  alignSelf: 'flex-end',
                  backgroundColor: '#4f8cff',
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                }}
                onPress={() => setProfileModalVisible(false)}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Sales</Text>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>₹45,230</Text>
              <MaterialCommunityIcons
                name="trending-up"
                size={20}
                color="#0F9D58"
              />
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: '#F4B400' }]}>
                ₹12,450
              </Text>
              <MaterialCommunityIcons
                name="trending-down"
                size={20}
                color="#DB4437"
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsCard}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={[styles.sectionTitle, { fontWeight: '600' }]}>
              Quick Actions
            </Text>
            {overflowDynamic.length > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#e6f0ff',
                  borderRadius: 20,
                  paddingHorizontal: 18,
                  paddingVertical: 4,
                  marginLeft: 8,
                }}
                onPress={() =>
                  navigation.navigate('AllQuickActionsScreen', {
                    actions: overflowDynamic,
                  })
                }
              >
                <Text
                  style={{
                    color: '#4f8cff',
                    fontSize: 15,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  More
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View
            style={{
              height: 1,
              backgroundColor: '#eef2f5',
              marginTop: 10,
              marginBottom: 14,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: 0,
              margin: 0,
            }}
          >
            {quickActions.map((action, idx) => {
              const isUserFolder = !action.screen;
              return (
                <View
                  key={action.title || action.id}
                  style={{
                    position: 'relative',
                    width: '48%',
                    height: 88,
                    marginBottom: 16,
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#eef2f5',
                    shadowColor: '#000',
                    shadowOpacity: 0.03,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 1,
                  }}
                >
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      height: '100%',
                      paddingVertical: 8,
                      opacity: isPlanAccessible(
                        userPlan,
                        action.planType || 'free',
                      )
                        ? 1
                        : 0.6,
                    }}
                    onPress={() => {
                      console.log('Action pressed:', action);
                      if (action.screen) {
                        console.log('Navigating to screen:', action.screen);
                        navigation.navigate(action.screen);
                      } else {
                        console.log('Navigating to folder:', action);
                        navigation.navigate('FolderScreen', { folder: action });
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={
                      !isPlanAccessible(userPlan, action.planType || 'free')
                    }
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: getActionIconBg(action.title),
                        marginBottom: 6,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={getFolderIcon(action.icon, action.title)}
                        size={18}
                        color={getActionIconColor(action.title)}
                      />
                    </View>
                    <Text
                      style={[
                        styles.actionText,
                        { color: '#000', fontWeight: '600' },
                      ]}
                    >
                      {action.title}
                    </Text>
                    {/* Plan badge for non-free actions only - but not for user-created custom folders */}
                    {action.planType &&
                      action.planType !== 'free' &&
                      !action.isCustom && (
                        <PremiumBadge
                          size="small"
                          text={
                            action.planType.charAt(0).toUpperCase() +
                            action.planType.slice(1)
                          }
                          disabled={
                            !isPlanAccessible(
                              userPlan,
                              action.planType || 'free',
                            )
                          }
                        />
                      )}
                  </TouchableOpacity>
                  {/* Delete button */}
                  {isUserFolder && (
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 2,
                        backgroundColor: '#fff',
                        borderRadius: 12,
                        padding: 2,
                        elevation: 2,
                      }}
                      onPress={() => showDeleteModal(action)}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color="#dc3545"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            {/* Removed empty placeholders to avoid extra bottom space */}
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          <View style={{ height: 350 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {recentTransactions.length > 0 ? (
                recentTransactions.map((transaction, idx) => (
                  <View key={String(transaction.id ?? idx)}>
                    <View
                      style={[styles.transactionItem, { paddingVertical: 14 }]}
                    >
                      {/* more vertical padding */}
                      <View style={styles.transactionLeft}>
                        <View style={styles.transactionTypeContainer}>
                          <Text style={styles.transactionTypeText}>
                            {(getTxnType(transaction) === 'Invoice'
                              ? 'Sell'
                              : getTxnType(transaction)
                            )
                              .charAt(0)
                              .toUpperCase() +
                              (getTxnType(transaction) === 'Invoice'
                                ? 'Sell'
                                : getTxnType(transaction)
                              ).slice(1)}
                          </Text>
                        </View>
                        <View style={styles.transactionDetails}>
                          <Text style={styles.transactionParty}>
                            {getTxnParty(transaction)}
                          </Text>
                          <Text style={styles.transactionDate}>
                            {getTxnDate(transaction) || 'No date'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.transactionRight}>
                        <Text
                          style={[styles.transactionAmount, { fontSize: 17 }]}
                        >
                          {' '}
                          {/* larger amount */}₹
                          {getTxnAmount(transaction).toLocaleString('en-IN')}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            getTxnStatus(transaction) === 'complete'
                              ? { backgroundColor: '#1ecb81', marginLeft: 8 }
                              : getTxnStatus(transaction) === 'draft'
                              ? { backgroundColor: '#F4B400', marginLeft: 8 }
                              : { backgroundColor: '#888', marginLeft: 8 },
                          ]}
                        >
                          <Text
                            style={{
                              color: '#fff',
                              fontSize: 13,
                              fontFamily: 'Roboto-Medium',
                            }}
                          >
                            {getTxnStatus(transaction).charAt(0).toUpperCase() +
                              getTxnStatus(transaction).slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {/* Divider except after last item */}
                    {idx < recentTransactions.length - 1 && (
                      <View
                        style={{
                          height: 1,
                          backgroundColor: '#f0f0f0',
                          marginLeft: 8,
                          marginRight: 8,
                        }}
                      />
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyTransactionsContainer}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={48}
                    color="#ccc"
                    style={{ marginBottom: 16 }}
                  />
                  <Text style={styles.emptyTransactionsTitle}>
                    No Recent Transactions
                  </Text>
                  <Text style={styles.emptyTransactionsSubtitle}>
                    Your recent transactions will appear here once you start
                    creating invoices, receipts, payments, or purchases.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Customer & Suppliers Tabs */}
        {/* <View style={styles.tabsContainer}>
          <TouchableOpacity style={styles.tab}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={20}
              color="#222"
            />
            <Text style={styles.tabText}>Customers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <MaterialCommunityIcons
              name="truck-outline"
              size={20}
              color="#222"
            />
            <Text style={styles.tabText}>Suppliers</Text>
          </TouchableOpacity>
        </View> */}
      </ScrollView>
      {/* Custom Delete Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={hideDeleteModal}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.18)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 28,
              width: 320,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <MaterialCommunityIcons
              name="alert-circle"
              size={44}
              color="#dc3545"
              style={{ marginBottom: 10 }}
            />
            <Text
              style={{
                fontSize: 20,
                color: '#222',
                marginBottom: 10,
                fontFamily: 'Roboto-Medium',
              }}
            >
              Delete Folder
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#444',
                textAlign: 'center',
                marginBottom: 24,
                fontFamily: 'Roboto-Medium',
              }}
            >
              Are you sure you want to delete the folder
              <Text
                style={{
                  color: '#dc3545',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {' '}
                "{folderToDelete?.title || 'Unknown'}"
              </Text>
              ?{'\n'}This action cannot be undone.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                gap: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#bbb',
                  backgroundColor: '#fff',
                  marginRight: 0,
                }}
                onPress={hideDeleteModal}
              >
                <Text
                  style={{
                    color: '#444',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  backgroundColor: '#dc3545',
                }}
                onPress={confirmDeleteFolder}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  header: {
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  menuButton: {
    padding: 10,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Roboto-Medium',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  profileCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef2f5',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf2ff',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    color: '#222',
    marginBottom: 2,
    fontFamily: 'Roboto-Medium',
  },
  profilePhone: {
    fontSize: 14,
    color: '#4f8cff',
    opacity: 1,
    marginBottom: 2,
    fontFamily: 'Roboto-Medium',
  },
  profileBusiness: {
    fontSize: 14,
    color: '#666',
    opacity: 1,
    fontFamily: 'Roboto-Medium',
  },
  welcomeMessage: {
    fontSize: 12,
    color: '#666',
    opacity: 1,
    marginTop: 4,
    fontFamily: 'Roboto-Medium',
  },
  profileButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewProfileText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 24,
    color: '#0F9D58',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 0,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontFamily: 'Roboto-Medium',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  gstLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
    fontFamily: 'Roboto-Medium',
  },
  legendValue: {
    fontSize: 14,
    color: '#222',
    fontFamily: 'Roboto-Medium',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#000',
    marginTop: 8,
    fontFamily: 'Roboto-Medium',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTypeContainer: {
    backgroundColor: '#222',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 12,
  },
  transactionTypeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
  },
  transactionDetails: {
    justifyContent: 'center',
  },
  transactionParty: {
    fontSize: 16,
    color: '#000',
    marginBottom: 2,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionAmount: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  paidBadge: {
    backgroundColor: '#222',
  },
  receivedBadge: {
    backgroundColor: '#0F9D58',
  },
  pendingBadge: {
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Roboto-Medium',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#222',
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userFoldersSection: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  folderList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  folderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    alignItems: 'center',
    width: 120,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  folderName: {
    marginTop: 8,
    fontSize: 15,
    color: '#222',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
  folderListWrapper: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  emptyTransactionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTransactionsTitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
  emptyTransactionsSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f6fafc',
  },
  errorIcon: {
    marginBottom: 15,
  },
  errorTitle: {
    fontSize: 20,
    color: '#dc3545',
    marginBottom: 10,
    fontFamily: 'Roboto-Medium',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
    fontFamily: 'Roboto-Medium',
  },
  retryButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
});

export default Dashboard;
