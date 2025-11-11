import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { unifiedApi } from '../api/unifiedApiService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// Removed SafeAreaView to allow full control over StatusBar area
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { getStatusBarSpacerHeight } from '../utils/statusBarManager';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../utils/headerLayout';
import { useFocusEffect } from '@react-navigation/native';
import { getUserIdFromToken } from '../utils/storage';
import PremiumBadge from './PremiumBadge';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import StableStatusBar from './StableStatusBar';

interface MenuItem {
  id: number;
  title: string;
  route: string;
  icon?: string;
  parentId: number | null;
  orderNo: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  url: string;
  isVisible: boolean;
  menuType: string;
  planType: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  isCustom: boolean;
  children?: MenuItem[];
}

interface UserData {
  id: number;
  planType: string;
  // ... other user fields
}

// Plan hierarchy for comparison (normalized names)
const PLAN_HIERARCHY = {
  free: 0,
  starter: 1,
  premium: 2, // legacy alias -> treated as professional
  professional: 2,
  enterprise: 3,
};

const BRAND_COLOR = '#4f8cff';
const BG_COLOR = '#f6fafc';
const CARD_BG = '#fff';
const PARENT_FONT_SIZE = 18;
const CHILD_FONT_SIZE = 16;
const LIGHT_PARENT_COLOR = '#333';
const LIGHT_CHILD_COLOR = '#5a8fff';

// Utility to build a tree from a flat menu array
function buildMenuTree(flatMenus: MenuItem[]) {
  const menuMap: { [key: number]: MenuItem } = {};
  flatMenus.forEach(menu => {
    menu.children = [];
    menuMap[menu.id] = menu;
  });
  const tree: MenuItem[] = [];
  flatMenus.forEach(menu => {
    if (menu.parentId === null) {
      tree.push(menu);
    } else if (menuMap[menu.parentId]) {
      (
        menuMap[menu.parentId].children ||
        (menuMap[menu.parentId].children = [])
      ).push(menu);
    }
  });
  return tree;
}

// Helper function to get mock menu data
function getMockMenuData(): MenuItem[] {
  return [
    {
      id: 1,
      title: 'Dashboard',
      route: '/dashboard',
      icon: 'dashboard',
      parentId: null,
      orderNo: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/dashboard',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 2,
      title: 'Customer',
      route: '/customer',
      icon: 'users',
      parentId: null,
      orderNo: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/customer',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 3,
      title: 'Payment',
      route: '/payment',
      icon: 'credit-card',
      parentId: null,
      orderNo: 3,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/payment',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 4,
      title: 'Receipt',
      route: '/receipt',
      icon: 'receipt',
      parentId: null,
      orderNo: 4,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/receipt',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 5,
      title: 'Purchase',
      route: '/purchase',
      icon: 'shopping-cart',
      parentId: null,
      orderNo: 5,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/purchase',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 6,
      title: 'Sell',
      route: '/sell',
      icon: 'trending-up',
      parentId: null,
      orderNo: 6,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/sell',
      isVisible: true,
      menuType: 'main',
      planType: 'free',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 8,
      title: 'Report',
      route: '/report',
      icon: 'bar-chart-2',
      parentId: null,
      orderNo: 7,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/report',
      isVisible: true,
      menuType: 'main',
      planType: 'premium',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
    {
      id: 9,
      title: 'Link to CA',
      route: '/link-ca',
      icon: 'link',
      parentId: null,
      orderNo: 8,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: '/link-ca',
      isVisible: true,
      menuType: 'main',
      planType: 'premium',
      createdBy: 1,
      updatedBy: 1,
      isCustom: false,
    },
  ];
}

// Utility to check if a plan level is accessible to the user
const isPlanAccessible = (userPlan: string, featurePlan: string): boolean => {
  const userLevel =
    PLAN_HIERARCHY[userPlan as keyof typeof PLAN_HIERARCHY] ?? 0;
  const featureLevel =
    PLAN_HIERARCHY[featurePlan as keyof typeof PLAN_HIERARCHY] ?? 0;
  return userLevel >= featureLevel;
};

// Local Text wrapper to enforce Roboto font in this component
const Text: React.FC<RNTextProps> = ({ style, ...rest }) => (
  <RNText {...rest} style={[{ fontFamily: 'Roboto-Medium' }, style]} />
);

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
  const { logout } = useAuth();
  // Simple StatusBar configuration - let ForceStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );
  const { currentSubscription, fetchSubscriptionData } = useSubscription();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userMobile, setUserMobile] = useState<string | null>(null);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    new Set(),
  );
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  // Get user plan from subscription context
  const userPlan = currentSubscription?.planId || 'free';

  // Fetch data on component mount
  useEffect(() => {
    fetchSubscriptionData();
    fetchMenus();
    // Load cached data immediately for instant display
    loadCachedUserData();
    // Only fetch from API if we don't have cached data
    if (!userName && !userMobile) {
      fetchUserProfile();
    }
    // Subscribe to immediate profile updates from edit screens
    const sub = DeviceEventEmitter.addListener(
      'profile-updated',
      (payload: any) => {
        console.log('📡 DRAWER: Received profile-updated event:', payload);
        try {
          const nameCandidate =
            payload?.name || payload?.ownerName || payload?.username || null;
          const mobileCandidate =
            payload?.mobile ??
            payload?.mobileNumber ??
            payload?.phoneNumber ??
            payload?.phone ??
            null;

          console.log('📡 DRAWER: Extracted values:', {
            nameCandidate,
            mobileCandidate,
          });
          console.log('📡 DRAWER: Current state before update:', {
            userName,
            userMobile,
          });

          if (nameCandidate != null) {
            console.log('📡 DRAWER: Setting userName to:', nameCandidate);
            setUserName(String(nameCandidate));
          }
          if (mobileCandidate != null) {
            console.log('📡 DRAWER: Setting userMobile to:', mobileCandidate);
            setUserMobile(String(mobileCandidate));
          }

          // Optimistically cache so drawer shows latest instantly next time
          const cached = {
            ownerName: nameCandidate ?? userName,
            mobileNumber: mobileCandidate ?? userMobile,
          };
          console.log('📡 DRAWER: Caching data:', cached);
          AsyncStorage.setItem('cachedUserData', JSON.stringify(cached)).catch(
            () => {},
          );
          if (nameCandidate != null)
            AsyncStorage.setItem('userName', String(nameCandidate)).catch(
              () => {},
            );
          if (mobileCandidate != null)
            AsyncStorage.setItem('userMobile', String(mobileCandidate)).catch(
              () => {},
            );
        } catch (error) {
          console.error('📡 DRAWER: Error in profile-updated handler:', error);
        }
      },
    );

    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, []);

  // Load cached user data immediately without async delay
  const loadCachedUserData = () => {
    try {
      // Use synchronous approach for immediate display
      AsyncStorage.multiGet([
        'cachedUserData',
        'userName',
        'userMobile',
        'userMobileNumber',
      ])
        .then(results => {
          const [cachedUserResult, nameResult, mobileResult, mobileAltResult] =
            results;

          // Parse cached user data
          if (cachedUserResult[1]) {
            try {
              const cached = JSON.parse(cachedUserResult[1]);
              const nameCandidate =
                cached?.ownerName || cached?.name || cached?.username;
              const mobileCandidate =
                cached?.mobileNumber || cached?.phone || cached?.phoneNumber;
              if (nameCandidate && !userName)
                setUserName(String(nameCandidate));
              if (mobileCandidate && !userMobile)
                setUserMobile(String(mobileCandidate));
            } catch {}
          }

          // Set individual cached values
          if (nameResult[1] && !userName) setUserName(nameResult[1]);
          if (mobileResult[1] && !userMobile) setUserMobile(mobileResult[1]);
          if (!mobileResult[1] && mobileAltResult[1] && !userMobile)
            setUserMobile(mobileAltResult[1]);
        })
        .catch(() => {});
    } catch {}
  };

  // Re-fetch data whenever the drawer is focused (opened or switched to)
  useFocusEffect(
    React.useCallback(() => {
      fetchSubscriptionData(); // Fetch latest subscription data
      fetchMenus(); // Ensure latest menus are always fetched on focus
      // Load cached data first, then refresh
      loadCachedUserData();
      // Only fetch from API if we don't have cached data to avoid overwriting instant updates
      if (!userName && !userMobile) {
        fetchUserProfile(); // Only refresh user header if no cached data
      }
    }, [userName, userMobile]),
  );

  // Sort menus by orderNo from API response
  const sortMenus = (menuList: MenuItem[]): MenuItem[] => {
    return menuList
      .filter(menu => menu.isVisible && menu.isActive)
      .filter(menu => menu.title?.toLowerCase() !== 'link to ca')
      .filter(menu => menu.title?.toLowerCase() !== 'dashboard')
      .sort((a, b) => {
        // Special handling for orderNo 6 (Sell/Invoice + Custom folders)
        if (a.orderNo === 6 && b.orderNo === 6) {
          // If both have orderNo 6, prioritize system menus over custom folders
          if (a.isCustom && !b.isCustom) return 1; // Custom folders after system
          if (!a.isCustom && b.isCustom) return -1; // System menus before custom
          // If both are custom or both are system, sort by creation date
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime; // Oldest first for custom folders
        }

        // Primary sort: by orderNo
        if (a.orderNo !== b.orderNo) {
          return a.orderNo - b.orderNo;
        }

        // Secondary sort: by creation date (latest first) if orderNo is same
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      })
      .map(menu => ({
        ...menu,
        children: menu.children ? sortMenus(menu.children) : [],
      }));
  };

  // Memoize topLevelMenus to prevent infinite re-renders
  const topLevelMenus = useMemo(() => {
    return menus.length > 0 ? sortMenus(menus) : [];
  }, [menus]);

  // Debug: Log the final sorted menus only when menus are loaded and not empty
  useEffect(() => {
    console.log('🔍 CustomDrawerContent Debug:', {
      loading,
      menusLength: menus.length,
      topLevelMenusLength: topLevelMenus.length,
      currentSubscription: currentSubscription?.planId,
    });

    if (__DEV__ && !loading && menus.length > 0 && topLevelMenus.length > 0) {
      console.log(
        '📱 Final sorted top-level menus:',
        topLevelMenus.map((menu: MenuItem) => ({
          title: menu.title,
          orderNo: menu.orderNo,
          isCustom: menu.isCustom,
          createdAt: menu.createdAt,
          icon: menu.icon, // Add icon to debug info
        })),
      );

      // Special debug for Report menu
      const reportMenu = topLevelMenus.find(
        menu => menu.title?.toLowerCase() === 'report',
      );
      if (reportMenu) {
        console.log(`🔍 Report menu found in final menus:`, reportMenu);
      } else {
        console.log(`❌ Report menu NOT found in final menus`);
      }
    }
  }, [loading, menus, topLevelMenus, currentSubscription]);

  // Normalize server plan strings to app's expected set
  const normalizePlan = (value?: string): string => {
    const v = (value || 'free').toLowerCase();
    if (v === 'premium') return 'professional';
    if (v === 'pro') return 'professional';
    if (v === 'basic') return 'starter';
    return v;
  };

  const fetchMenus = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');

      // Debug: Log authentication details
      if (__DEV__) {
        console.log(
          '🔑 Fetching menus with token:',
          accessToken ? 'Present' : 'Missing',
        );
        console.log('🌐 API URL:', '/menus');
      }

      // TEMPORARY: Use mock data when API is not available
      const useMockData = true; // Set to false when API is working

      if (useMockData) {
        console.log('🔄 Using mock menu data (API not available)');
        const mockMenuData = getMockMenuData();
        console.log('📱 Mock menu data loaded:', mockMenuData.length, 'items');
        const menuTree = buildMenuTree(mockMenuData);
        setMenus(menuTree);
        setLoading(false);
        return;
      }

      if (!accessToken) {
        console.error('❌ No access token found for menus API');
        // Fallback to mock data when no token
        console.log('🔄 No access token, falling back to mock menu data');
        const mockMenuData = getMockMenuData();
        const menuTree = buildMenuTree(mockMenuData);
        setMenus(menuTree);
        setLoading(false);
        return;
      }

      console.log('🌐 Making API call to:', '/menus');
      // Use unified API
      const response = (await unifiedApi.get('/menus')) as {
        data: any;
        status: number;
        headers: Headers;
      };

      // Debug: Log full response
      if (__DEV__) {
        console.log('📱 Full API response:', {
          status: response.status,
          data: response.data,
          dataType: typeof response.data,
          isArray: Array.isArray(response.data),
        });
      }

      // Handle both { data: [...] } and plain array
      const menuData = Array.isArray(response.data)
        ? response.data
        : response.data?.data || response.data || [];

      // Debug: Log the menu data to see what icons we're getting
      if (__DEV__) {
        console.log(
          '📱 Menu data received from API:',
          menuData.map((menu: MenuItem) => ({
            title: menu.title,
            icon: menu.icon,
            orderNo: menu.orderNo,
            isCustom: menu.isCustom,
            createdAt: menu.createdAt,
          })),
        );
        console.log('📱 Total menu items:', menuData.length);
      }

      if (!Array.isArray(menuData) || menuData.length === 0) {
        console.warn(
          '⚠️ No menu data received or empty array, falling back to mock data',
        );
        // Fallback to mock data when API returns empty data
        const mockMenuData = getMockMenuData();
        const menuTree = buildMenuTree(mockMenuData);
        setMenus(menuTree);
        setLoading(false);
        return;
      }

      // Sort menu items by orderNo
      const sortedMenuData = menuData.sort(
        (a: MenuItem, b: MenuItem) => a.orderNo - b.orderNo,
      );

      // Debug: Log the sorted menu data
      if (__DEV__) {
        console.log(
          '📱 Sorted menu data:',
          sortedMenuData.map((menu: MenuItem) => ({
            title: menu.title,
            orderNo: menu.orderNo,
            isCustom: menu.isCustom,
            createdAt: menu.createdAt,
          })),
        );
      }

      const menuTree = buildMenuTree(sortedMenuData);
      setMenus(menuTree);
    } catch (err: any) {
      console.error('❌ Error fetching menus:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        url: err.config?.url,
        method: err.config?.method,
      });

      // Fallback to mock data when API fails
      console.log('🔄 API failed, falling back to mock menu data');
      const mockMenuData = getMockMenuData();
      console.log(
        '📱 Mock menu data loaded as fallback:',
        mockMenuData.length,
        'items',
      );
      const menuTree = buildMenuTree(mockMenuData);
      setMenus(menuTree);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile from API and populate drawer header (no extra menus added)
  const fetchUserProfile = async () => {
    setIsRefreshingProfile(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        // Fallback to cached values if no token
        const name = await AsyncStorage.getItem('userName');
        const mobile = await AsyncStorage.getItem('userMobile');
        // Try unified cached profile as well
        const cachedUserJson = await AsyncStorage.getItem('cachedUserData');
        if (name) setUserName(name);
        if (mobile) setUserMobile(mobile);
        if (cachedUserJson) {
          try {
            const cached = JSON.parse(cachedUserJson);
            const nameCandidate =
              cached?.ownerName || cached?.name || cached?.username;
            const mobileCandidate =
              cached?.mobileNumber || cached?.phone || cached?.phoneNumber;
            if (nameCandidate && !name) setUserName(String(nameCandidate));
            if (mobileCandidate && !mobile)
              setUserMobile(String(mobileCandidate));
          } catch {}
        }
        return;
      }

      // Use unified API
      const res = (await unifiedApi.getUserProfile()) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const profile = res?.data ?? res ?? null;
      if (profile) {
        setUserData(profile);
        const name =
          profile.ownerName || profile.name || profile.username || null;
        const mobile =
          profile.mobileNumber || profile.phone || profile.phoneNumber || null;
        if (name) setUserName(String(name));
        if (mobile) setUserMobile(String(mobile));
        // Cache lightweight values for instant next open
        try {
          await AsyncStorage.setItem(
            'cachedUserData',
            JSON.stringify({ ownerName: name, mobileNumber: mobile }),
          );
          if (name) await AsyncStorage.setItem('userName', String(name));
          if (mobile) await AsyncStorage.setItem('userMobile', String(mobile));
        } catch {}
      } else {
        // Fallback to cached values
        const name = await AsyncStorage.getItem('userName');
        const mobile = await AsyncStorage.getItem('userMobile');
        if (name) setUserName(name);
        if (mobile) setUserMobile(mobile);
      }
    } catch (err) {
      console.warn('Drawer profile fetch failed:', err);
      try {
        const name = await AsyncStorage.getItem('userName');
        const mobile = await AsyncStorage.getItem('userMobile');
        const cachedUserJson = await AsyncStorage.getItem('cachedUserData');
        if (name) setUserName(name);
        if (mobile) setUserMobile(mobile);
        if (cachedUserJson) {
          try {
            const cached = JSON.parse(cachedUserJson);
            const nameCandidate =
              cached?.ownerName || cached?.name || cached?.username;
            const mobileCandidate =
              cached?.mobileNumber || cached?.phone || cached?.phoneNumber;
            if (nameCandidate && !name) setUserName(String(nameCandidate));
            if (mobileCandidate && !mobile)
              setUserMobile(String(mobileCandidate));
          } catch {}
        }
      } catch {}
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  const handleToggle = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      await logout(); // Use context logout
    } catch (error) {
      console.error('Logout error:', error);
    }
    setLogoutModalVisible(false);
  };

  const cancelLogout = () => {
    setLogoutModalVisible(false);
  };

  // Helper to render icon
  const renderIcon = (
    iconName?: string,
    color: string = '#4f8cff',
    size: number = 22,
    isParent: boolean = true,
    title?: string,
  ) => {
    // Helper function to check if string is a valid URL
    const isValidUrl = (url: string) => {
      if (!url || url.trim() === '') return false;
      try {
        const urlObj = new URL(url);
        // Check if it's a valid HTTP/HTTPS URL
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    };

    // Debug logging to see what icons are coming from API
    if (iconName && __DEV__) {
      console.log(`🎨 Menu item "${title}" has icon: "${iconName}"`);
      if (isValidUrl(iconName)) {
        console.log(`✓ Valid URL detected for "${title}": ${iconName}`);
      } else {
        console.log(`✗ Invalid URL for "${title}": ${iconName}`);
      }
    }

    // Special debug logging for custom folders
    if (__DEV__ && title && !iconName) {
      console.log(`⚠️ Custom folder "${title}" has no icon, will use fallback`);
    }

    // Special debug logging for Report menu
    if (__DEV__ && title && title.toLowerCase() === 'report') {
      console.log(
        `📊 Report menu item: iconName="${iconName}", will use fallback: "${getIconForTitle(
          title,
          isParent,
        )}"`,
      );
      console.log(`📊 Report menu full details:`, {
        title,
        iconName,
        isParent,
      });
    }

    // Special debug logging for all menu items to help diagnose icon issues
    if (__DEV__ && title) {
      console.log(
        `🎯 Menu item "${title}": iconName="${iconName}", fallback="${getIconForTitle(
          title,
          isParent,
        )}"`,
      );
    }

    // Special override for Report menu - always use chart-bar icon
    if (title && title.toLowerCase() === 'report') {
      console.log(
        `🔧 Report menu detected - overriding any API icon with chart-bar`,
      );
      return (
        <MaterialCommunityIcons
          name="chart-bar"
          size={size}
          color={color}
          style={{ marginRight: isParent ? 20 : 18 }}
        />
      );
    }

    // If API provides an icon, try to use it, but fallback if invalid
    if (iconName && iconName.trim() !== '') {
      if (__DEV__) {
        console.log(
          `🎨 Processing icon: "${iconName}" for menu item: "${title}"`,
        );
      }
      // Check if it's a valid URL and hasn't failed before
      if (isValidUrl(iconName) && !failedImageUrls.has(iconName)) {
        // It's a URL, render as image
        const isImageLoading = loadingImages.has(iconName);

        return (
          <View style={{ position: 'relative' }}>
            <Image
              source={{
                uri: iconName,
                // Add headers to handle potential CORS issues
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; ReactNative)',
                  Accept: 'image/*',
                },
                // Add cache policy for better performance
                cache: 'default',
              }}
              style={{
                width: isParent ? 23 : 21,
                height: isParent ? 23 : 21,
                marginRight: isParent ? 20 : 18,
                resizeMode: 'contain',
                opacity: isImageLoading ? 0.5 : 1,
                borderRadius: 4, // Add slight border radius for better appearance
              }}
              onLoadStart={() => {
                setLoadingImages(prev => new Set(prev).add(iconName));
                if (__DEV__) {
                  console.log(`🔄 Loading image for "${title}": ${iconName}`);
                }
              }}
              onLoad={() => {
                setLoadingImages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(iconName);
                  return newSet;
                });
                if (__DEV__) {
                  console.log(
                    `✅ Image loaded successfully for "${title}": ${iconName}`,
                  );
                }
              }}
              onError={error => {
                if (__DEV__) {
                  console.warn(
                    `❌ Failed to load image from URL: "${iconName}" for menu item "${title}"`,
                    error.nativeEvent,
                  );
                }
                // Track failed URL to avoid retrying
                setFailedImageUrls(prev => new Set(prev).add(iconName));
                setLoadingImages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(iconName);
                  return newSet;
                });
              }}
            />
            {isImageLoading && (
              <ActivityIndicator
                size="small"
                color={BRAND_COLOR}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
            )}
          </View>
        );
      }

      // Direct mapping for your API icon names to MaterialCommunityIcons
      const iconMapping: { [key: string]: string } = {
        dashboard: 'view-dashboard',
        users: 'account-group',
        'credit-card': 'credit-card-outline',
        receipt: 'file-document-outline',
        'shopping-cart': 'cart-outline',
        'trending-up': 'trending-up',
        'folder-plus': 'folder-plus',
        'bar-chart-2': 'chart-bar',
        link: 'link',
        // Add mappings for folder types
        sell: 'trending-up',
        payment: 'credit-card-outline',
        purchase: 'cart-outline',
        // Add specific mapping for Report
        report: 'bar-chart-2',
      };

      // Check if we have a direct mapping for this icon
      if (iconMapping[iconName]) {
        if (__DEV__) {
          console.log(
            `✅ Direct icon mapping found for "${iconName}" -> "${iconMapping[iconName]}"`,
          );
        }
        return (
          <MaterialCommunityIcons
            name={iconMapping[iconName] as any}
            size={size}
            color={color}
            style={{ marginRight: isParent ? 20 : 18 }}
          />
        );
      }

      if (__DEV__) {
        console.log(
          `🔍 No direct mapping found for icon: "${iconName}", checking valid icons list...`,
        );
      }

      // Check if the icon name is a valid MaterialCommunityIcons name
      const validIcons = [
        // Core icons from your API response - these are the exact names from your API
        'dashboard',
        'users',
        'credit-card',
        'receipt',
        'shopping-cart',
        'trending-up',
        'folder-plus',
        'bar-chart-2',
        'link',
        // Add folder type icons
        'sell',
        'payment',
        'purchase',
        // Add Report icon
        'report',

        // Additional MaterialCommunityIcons
        'view-dashboard',
        'home',
        'folder',
        'file-document-outline',
        'credit-card-outline',
        'cart-outline',
        'calculator',
        'cash-multiple',
        'book-open-variant',
        'account',
        'cog',
        'swap-horizontal',
        'chart-line',
        'account-cog',
        'folder-outline',
        'file-document',
        'shopping-cart',
        'calculator-variant',
        'cash',
        'book-open',
        'account-circle',
        'settings',
        'chart-bar',
        'folder-multiple',
        'file-multiple',
        'invoice',
        'payment',
        'purchase',
        'view-dashboard-variant',
        'dashboard-variant',
        'home-variant',
        'folder-multiple-outline',
        'file-document-multiple',
        'credit-card-multiple',
        'cart-multiple',
        'cash-minus',
        'cash-plus',
        'bank',
        'truck-delivery',
        'package-variant',
        'briefcase',
        'account-group',
      ];

      const isValidIcon = validIcons.some(
        validIcon =>
          validIcon.toLowerCase() === iconName.toLowerCase() ||
          validIcon.toLowerCase().includes(iconName.toLowerCase()) ||
          iconName.toLowerCase().includes(validIcon.toLowerCase()),
      );

      if (isValidIcon) {
        if (__DEV__) {
          console.log(`✅ Icon "${iconName}" is valid, using directly`);
        }
        return (
          <MaterialCommunityIcons
            name={iconName as any}
            size={size}
            color={color}
            style={{ marginRight: isParent ? 20 : 18 }}
          />
        );
      } else {
        // Log invalid icon for debugging
        if (__DEV__) {
          console.warn(
            `❌ Invalid icon name "${iconName}" for menu item "${title}", using fallback`,
          );
        }
      }
    }

    // Fallback to title-based icons
    let fallbackIcon = getIconForTitle(title || '', isParent);

    // Force specific icons for known menu items
    if (title && title.toLowerCase() === 'report') {
      fallbackIcon = 'chart-bar';
      console.log(`🔧 Forcing Report icon to: ${fallbackIcon}`);
    }

    if (__DEV__) {
      if (!iconName || iconName.trim() === '') {
        console.log(
          `⚠️ No icon provided for "${title}", using fallback: "${fallbackIcon}"`,
        );
      } else {
        console.log(`🔄 Using fallback icon for "${title}": "${fallbackIcon}"`);
      }
    }

    // Additional debug for custom folders
    if (
      __DEV__ &&
      title &&
      title !== 'Dashboard' &&
      title !== 'Customer' &&
      title !== 'Payment' &&
      title !== 'Receipt' &&
      title !== 'Purchase' &&
      title !== 'Sell' &&
      title !== 'Add New Folder' &&
      title !== 'Report' &&
      title !== 'Link to CA'
    ) {
      console.log(
        `🔍 Custom folder "${title}" using fallback icon: "${fallbackIcon}"`,
      );
    }

    return (
      <MaterialCommunityIcons
        name={fallbackIcon as any}
        size={size}
        color={color}
        style={{ marginRight: isParent ? 20 : 18 }}
      />
    );
  };

  // Helper function to get appropriate icon based on title
  const getIconForTitle = (title: string, isParent: boolean) => {
    const lowerTitle = title.toLowerCase();

    if (isParent) {
      // Parent menu icons - exact matches for your API response
      if (lowerTitle === 'dashboard') return 'view-dashboard';
      if (lowerTitle === 'customer') return 'account-group';
      if (lowerTitle === 'payment') return 'credit-card-outline';
      if (lowerTitle === 'receipt') return 'file-document-outline';
      if (lowerTitle === 'purchase') return 'cart-outline';
      if (lowerTitle === 'sell') return 'trending-up';
      if (lowerTitle === 'add new folder') return 'folder-plus';
      if (lowerTitle === 'report') return 'chart-bar';
      if (lowerTitle === 'link to ca') return 'link';

      // Fallback patterns
      if (lowerTitle.includes('dashboard')) return 'view-dashboard';
      if (lowerTitle.includes('customer')) return 'account-group';
      if (lowerTitle.includes('payment')) return 'credit-card-outline';
      if (lowerTitle.includes('receipt')) return 'file-document-outline';
      if (lowerTitle.includes('purchase')) return 'cart-outline';
      if (lowerTitle.includes('sell')) return 'trending-up';
      if (lowerTitle.includes('folder')) return 'folder-plus';
      if (lowerTitle.includes('report')) return 'chart-bar';
      if (lowerTitle.includes('link')) return 'link';

      // For custom folders, try to use a more specific icon based on the folder type
      // Check if this is a custom folder by looking for common patterns
      if (
        lowerTitle.includes('purchase') ||
        lowerTitle.includes('buy') ||
        lowerTitle.includes('supply')
      ) {
        return 'cart-outline';
      }
      if (
        lowerTitle.includes('sell') ||
        lowerTitle.includes('invoice') ||
        lowerTitle.includes('client')
      ) {
        return 'trending-up';
      }
      if (
        lowerTitle.includes('payment') ||
        lowerTitle.includes('expense') ||
        lowerTitle.includes('vendor')
      ) {
        return 'credit-card-outline';
      }
      if (
        lowerTitle.includes('receipt') ||
        lowerTitle.includes('expense') ||
        lowerTitle.includes('bill')
      ) {
        return 'file-document-outline';
      }

      // Default fallback for any other custom folder
      return 'folder-outline';
    } else {
      // Child menu icons
      if (lowerTitle === 'invoice') return 'file-document-outline';
      if (lowerTitle === 'sell') return 'trending-up';
      if (lowerTitle === 'receipt') return 'file-document-outline';
      if (lowerTitle === 'payment') return 'credit-card-outline';
      if (lowerTitle === 'purchase') return 'cart-outline';
      if (lowerTitle === 'add folder') return 'folder-plus';
      if (lowerTitle === 'gst summary') return 'calculator';
      if (lowerTitle === 'cash flow') return 'cash-multiple';
      if (lowerTitle === 'daily ledger') return 'book-open-variant';

      // For custom child folders, try to use more specific icons
      if (
        lowerTitle.includes('purchase') ||
        lowerTitle.includes('buy') ||
        lowerTitle.includes('supply')
      ) {
        return 'cart-outline';
      }
      if (
        lowerTitle.includes('sell') ||
        lowerTitle.includes('invoice') ||
        lowerTitle.includes('client')
      ) {
        return 'trending-up';
      }
      if (
        lowerTitle.includes('payment') ||
        lowerTitle.includes('expense') ||
        lowerTitle.includes('vendor')
      ) {
        return 'credit-card-outline';
      }
      if (
        lowerTitle.includes('receipt') ||
        lowerTitle.includes('expense') ||
        lowerTitle.includes('bill')
      ) {
        return 'file-document-outline';
      }

      // Default fallback for any other custom child folder
      return 'folder-multiple-outline';
    }
  };

  // Helper to render plan badge - only show for actual plan types
  const renderPlanBadge = (planType?: string, menu?: MenuItem) => {
    // Only show badge if planType exists and is not 'free'
    // Hide badge for user-created custom folders
    // Show Premium badge for premium features that are disabled
    if (
      !planType ||
      planType === 'free' ||
      menu?.isCustom // Hide badge for user-created custom folders
    )
      return null;

    // Show Premium badge for premium features
    const isPremiumFeature = planType === 'premium';
    const hasAccess = userPlan === 'professional' || userPlan === 'enterprise';
    const isReportOrLinkCA =
      menu?.title?.toLowerCase() === 'report' ||
      menu?.title?.toLowerCase() === 'link to ca';

    // For Report and Link to CA: Hide PREMIUM badge for Professional/Enterprise users
    if (isPremiumFeature && isReportOrLinkCA) {
      // Hide badge for Professional/Enterprise users
      if (hasAccess) {
        return null;
      }

      // Show PREMIUM badge for other users
      return (
        <PremiumBadge
          size="small"
          text="PREMIUM"
          disabled={false}
          navigation={props.navigation}
          onPress={() => {
            // Handle premium badge click - navigate to subscription plan
            console.log(
              `🏷️ Premium badge clicked for "${menu?.title}" - navigating to subscription plan`,
            );
            props.navigation.closeDrawer();
            setTimeout(() => {
              console.log(
                '🏷️ Navigating to SubscriptionPlan screen from badge click',
              );
              try {
                props.navigation.navigate('AppStack', {
                  screen: 'SubscriptionPlan',
                });
                console.log(
                  '✅ Badge navigation to SubscriptionPlan successful',
                );
              } catch (error) {
                console.error('❌ Badge navigation error:', error);
                // Fallback navigation
                props.navigation.navigate('SubscriptionPlan');
              }
            }, 250);
          }}
        />
      );
    }

    // For other premium features: Show PREMIUM badge if user doesn't have access
    if (isPremiumFeature && !hasAccess) {
      return (
        <PremiumBadge
          size="small"
          text="PREMIUM"
          disabled={true}
          navigation={props.navigation}
          onPress={() => {
            // Handle premium badge click - navigate to subscription plan
            console.log(
              `🏷️ Premium badge clicked for "${menu?.title}" - navigating to subscription plan`,
            );
            props.navigation.closeDrawer();
            setTimeout(() => {
              console.log(
                '🏷️ Navigating to SubscriptionPlan screen from badge click',
              );
              try {
                props.navigation.navigate('AppStack', {
                  screen: 'SubscriptionPlan',
                });
                console.log(
                  '✅ Badge navigation to SubscriptionPlan successful',
                );
              } catch (error) {
                console.error('❌ Badge navigation error:', error);
                // Fallback navigation
                props.navigation.navigate('SubscriptionPlan');
              }
            }, 250);
          }}
        />
      );
    }

    // Hide badge if user has access to the feature
    if (hasAccess) return null;

    if (__DEV__) {
      console.log(
        `🏷️ Rendering plan badge for "${menu?.title}": planType="${planType}", userPlan="${userPlan}"`,
      );
    }

    return (
      <PremiumBadge
        size="small"
        text={planType.charAt(0).toUpperCase() + planType.slice(1)}
        disabled={isPlanAccessible(userPlan, planType)}
        navigation={props.navigation}
        onPress={() => {
          // Handle premium badge click - navigate to subscription plan
          console.log(
            `🏷️ Premium badge clicked for "${menu?.title}" - navigating to subscription plan`,
          );
          props.navigation.closeDrawer();
          setTimeout(() => {
            console.log(
              '🏷️ Navigating to SubscriptionPlan screen from badge click',
            );
            try {
              props.navigation.navigate('AppStack', {
                screen: 'SubscriptionPlan',
              });
              console.log('✅ Badge navigation to SubscriptionPlan successful');
            } catch (error) {
              console.error('❌ Badge navigation error:', error);
              // Fallback navigation
              props.navigation.navigate('SubscriptionPlan');
            }
          }, 250);
        }}
      />
    );
  };

  // Render menu tree recursively
  const renderMenuTree = (menuList: MenuItem[], level = 0) => {
    return menuList
      .map((menu, idx) => {
        const hasChildren = menu.children && menu.children.length > 0;
        const isParent = level === 0;
        const isExpanded = expanded[menu.id];
        const menuPlan = menu.planType || 'free';
        // User-created custom folders should always be accessible to the user who created them
        // Enable Report and Link to CA for all users - they will show premium badges but be accessible
        // Disable other Premium features unless user has Professional or Enterprise plan
        const isAccessible = menu.isCustom
          ? true
          : menuPlan === 'premium' &&
            userPlan !== 'professional' &&
            userPlan !== 'enterprise' &&
            menu.title?.toLowerCase() !== 'report' &&
            menu.title?.toLowerCase() !== 'link to ca'
          ? false
          : isPlanAccessible(userPlan, menuPlan);

        return (
          <View key={menu.id}>
            <TouchableOpacity
              style={[
                styles.menuRow,
                isParent ? styles.parentMenuRow : styles.childMenuRow,
                isExpanded && isParent ? styles.parentMenuRowExpanded : null,
                !isAccessible && styles.inaccessibleMenuRow,
              ]}
              activeOpacity={isAccessible ? 0.7 : 1}
              disabled={!isAccessible}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                if (hasChildren) {
                  handleToggle(menu.id);
                } else {
                  // Navigation for leaf menu items
                  const title = menu.title?.toLowerCase();
                  console.log(
                    `🎯 Menu item clicked: "${menu.title}" (lowercase: "${title}")`,
                    {
                      menuId: menu.id,
                      menuTitle: menu.title,
                      planType: menu.planType,
                      isCustom: menu.isCustom,
                      hasChildren: hasChildren,
                    },
                  );

                  // Handle navigation based on orderNo (menu order) and isCustom flag
                  const orderNo = menu.orderNo;
                  const isCustom = menu.isCustom;

                  console.log(
                    `🎯 Menu item clicked: "${menu.title}" with orderNo: ${orderNo}, isCustom: ${isCustom}`,
                    {
                      menuId: menu.id,
                      menuTitle: menu.title,
                      orderNo: orderNo,
                      planType: menu.planType,
                      isCustom: menu.isCustom,
                      hasChildren: hasChildren,
                    },
                  );

                  // Navigation mapping - prioritize isCustom over orderNo
                  let targetScreen = '';
                  let targetParams = {};

                  // First check if this is a custom folder - these should always go to FolderScreen
                  if (isCustom) {
                    console.log(
                      `📁 Custom folder "${menu.title}" detected - navigating to FolderScreen`,
                    );
                    targetScreen = 'FolderScreen';
                    targetParams = { folder: menu };
                  } else {
                    // Handle system menus based on orderNo
                    switch (orderNo) {
                      case 1: // Dashboard
                        targetScreen = 'Dashboard';
                        break;
                      case 2: // Customer
                        targetScreen = 'Customer';
                        break;
                      case 3: // Payment
                        targetScreen = 'Payment';
                        break;
                      case 4: // Receipt
                        targetScreen = 'Receipt';
                        break;
                      case 5: // Purchase
                        targetScreen = 'Purchase';
                        break;
                      case 6: // Sell/Invoice
                        targetScreen = 'Invoice';
                        break;
                      case 7: // Report
                        targetScreen = 'Report';
                        break;
                      case 8: // Link to CA
                        targetScreen = 'LinkToCA';
                        break;
                      default:
                        // Dynamic folder: pass the menu object as folder param
                        targetScreen = 'FolderScreen';
                        targetParams = { folder: menu };
                        break;
                    }
                  }

                  // Execute navigation
                  if (targetScreen) {
                    props.navigation.closeDrawer();
                    setTimeout(() => {
                      try {
                        if (targetScreen === 'SubscriptionPlan') {
                          props.navigation.navigate('AppStack', {
                            screen: targetScreen,
                          });
                        } else {
                          props.navigation.navigate('AppStack', {
                            screen: targetScreen,
                            params: targetParams,
                          });
                        }
                        console.log(
                          `✅ Navigation to ${targetScreen} successful`,
                        );
                      } catch (error) {
                        console.error(
                          `❌ Navigation error to ${targetScreen}:`,
                          error,
                        );
                        // Fallback navigation
                        if (targetScreen === 'SubscriptionPlan') {
                          props.navigation.navigate('SubscriptionPlan');
                        } else {
                          props.navigation.navigate(targetScreen, targetParams);
                        }
                      }
                    }, 250);
                  }
                }
              }}
            >
              <View style={styles.menuLeft}>
                {/* Render the icon on the left side */}
                {(() => {
                  const textColor = !isAccessible
                    ? '#9aa1aa'
                    : isParent
                    ? '#1a1a1a'
                    : '#4a4a4a';
                  const textSize = isParent ? 19 : 17;
                  return renderIcon(
                    menu.icon,
                    textColor,
                    textSize,
                    isParent,
                    menu.title,
                  );
                })()}
                <View style={styles.menuTextContainer}>
                  <Text
                    style={[
                      styles.menuItem,
                      isParent ? styles.parentMenu : styles.childMenu,
                      !isAccessible && styles.inaccessibleMenuText,
                    ]}
                    numberOfLines={1}
                  >
                    {menu.title}
                  </Text>
                </View>
              </View>
              {/* Right-side icon for every menu */}
              <View style={styles.rightSide}>
                {hasChildren && isParent ? (
                  <MaterialCommunityIcons
                    name={isExpanded ? 'chevron-down' : 'chevron-right'}
                    size={24}
                    color={BRAND_COLOR}
                  />
                ) : (
                  // Show PREMIUM badge on the right when applicable; otherwise chevron
                  renderPlanBadge(menu.planType || undefined, menu) || (
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#c7c7cc"
                    />
                  )
                )}
              </View>
            </TouchableOpacity>
            {/* Children, if expanded */}
            {hasChildren && isExpanded && (
              <View style={styles.childrenContainer}>
                {renderMenuTree(menu.children!, level + 1)}
              </View>
            )}
          </View>
        );
      })
      .filter(Boolean); // Remove null items
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9fa', width: '100%' }}>
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
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => props.navigation.closeDrawer()}
          accessibilityLabel="Close drawer"
        >
          <MaterialCommunityIcons name="arrow-left" size={27} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerUserInfo}>
          <View style={styles.headerAvatarCircle}>
            <Text style={styles.headerAvatarText}>
              {(userName || 'U')
                .split(' ')
                .map(s => s.charAt(0).toUpperCase())
                .join('')
                .slice(0, 2)}
            </Text>
          </View>
          <View style={styles.headerNameBlock}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerUserName}>{userName || 'User'}</Text>
              {isRefreshingProfile && (
                <ActivityIndicator
                  size="small"
                  color="rgba(255,255,255,0.7)"
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
            {!!userMobile && (
              <Text style={styles.headerUserMobile}>{userMobile}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Profile row removed (info now shown in header) */}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            <Text style={styles.loadingText}>Loading menu...</Text>
          </View>
        ) : (
          <>
            {console.log('🔍 Rendering menu tree with:', {
              topLevelMenusLength: topLevelMenus.length,
              topLevelMenus: topLevelMenus.map(m => ({
                title: m.title,
                orderNo: m.orderNo,
              })),
            })}
            {renderMenuTree(topLevelMenus)}
          </>
        )}
      </ScrollView>

      {/* Current Plan Row - Enhanced UI */}
      <View style={styles.planRowContainer}>
        <View style={styles.planRowContent}>
          <View style={styles.planRowLeft}>
            <View style={styles.planIconContainer}>
              <MaterialCommunityIcons
                name="crown"
                size={18}
                color={userPlan === 'free' ? '#6c757d' : '#ffd700'}
              />
            </View>
            <View style={styles.planTextContainer}>
              <Text style={styles.planRowLabel}>Current Plan</Text>
              <Text style={styles.planRowText}>
                {currentSubscription?.planName || 'Free'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.planRowButton,
              userPlan === 'free' && styles.planRowUpgradeButton,
              userPlan !== 'free' && styles.planRowManageButton,
            ]}
            onPress={() => {
              props.navigation.closeDrawer();
              setTimeout(() => {
                props.navigation.navigate('AppStack', {
                  screen: 'SubscriptionPlan',
                });
              }, 250);
            }}
          >
            <MaterialCommunityIcons
              name={userPlan === 'free' ? 'star-plus' : 'cog'}
              size={16}
              color="#ffffff"
            />
            <Text style={styles.planRowButtonText}>
              {userPlan === 'free' ? 'Upgrade' : 'Manage'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modern Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialCommunityIcons
          name="logout-variant"
          size={20}
          color="#ffffff"
        />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Enhanced Logout Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelLogout}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <MaterialCommunityIcons
                  name="logout-variant"
                  size={32}
                  color="#fff"
                />
              </View>
              <Text style={styles.modalTitle}>Confirm Logout</Text>
            </View>

            <Text style={styles.modalMessage}>
              Are you sure you want to logout from your account? You'll need to
              sign in again.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelLogout}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmLogout}
              >
                <Text style={styles.confirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: undefined as any,
  },
  headerBackButton: {
    padding: 10,
    marginRight: 6,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#4f8cff',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
  headerNameBlock: {
    flexDirection: 'column',
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerUserName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: 'Roboto-Medium',
  },
  headerUserMobile: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Roboto-Regular',
    marginTop: 3,
  },
  headerTitle: {
    fontSize: 22,
    color: '#1a1a1a',
    letterSpacing: 0.3,
    marginBottom: 0,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
    textAlign: 'center',
  },

  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
  },

  // Plan Row Styles - Enhanced UI
  planRowContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  profileNameText: {
    fontSize: 18,
    color: '#1a1a1a',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
    marginBottom: 2,
  },
  profileSubText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Roboto-Regular',
    fontWeight: '400',
  },
  planRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  planRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  planIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  planTextContainer: {
    flex: 1,
  },
  planRowLabel: {
    fontSize: 12,
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
    fontFamily: 'Roboto-Medium',
    fontWeight: '500',
  },

  planRowText: {
    fontSize: 17,
    color: '#1a1a1a',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  planRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  planRowUpgradeButton: {
    backgroundColor: '#34c759',
  },
  planRowManageButton: {
    backgroundColor: BRAND_COLOR,
  },
  planRowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 6,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 0,
    marginBottom: 8,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 56,
    backgroundColor: 'transparent',
  },
  parentMenuRow: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  parentMenuRowExpanded: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 0,
  },
  childMenuRow: {
    backgroundColor: 'transparent',
    marginLeft: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 0,
    marginBottom: 6,
    borderColor: 'transparent',
    minHeight: 48,
  },
  inaccessibleMenuRow: {
    opacity: 1,
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  inaccessibleMenuText: {
    color: '#9aa1aa',

    fontFamily: 'Roboto-Medium',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightSide: {
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    minWidth: 28,
  },
  menuItem: {
    fontSize: 17,
    color: '#1a1a1a',
    flexShrink: 1,
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Regular',
    fontWeight: '600',
  },

  parentMenu: {
    fontSize: 19,
    color: '#1a1a1a',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  childMenu: {
    fontSize: 17,
    color: '#4a4a4a',
    fontFamily: 'Roboto-Regular',
    fontWeight: '600',
  },

  childrenContainer: {
    marginLeft: 0,
    paddingLeft: 0,
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    marginHorizontal: 16,
    marginBottom: 40,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.2,
    fontFamily: 'Roboto-Medium',
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    backgroundColor: '#dc3545',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  modalMessage: {
    fontSize: 15,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'Roboto-Medium',
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto-Medium',
  },

  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#dc3545',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },
});

export default CustomDrawerContent;
