import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { BASE_URL } from '../api';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getUserIdFromToken } from '../utils/storage';
import PremiumBadge from './PremiumBadge';
import { useAuth } from '../context/AuthContext';

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

// Plan hierarchy for comparison (free, premium, and enterprise)
const PLAN_HIERARCHY = {
  free: 0,
  premium: 1,
  enterprise: 2,
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

// Utility to check if a plan level is accessible to the user
const isPlanAccessible = (userPlan: string, featurePlan: string): boolean => {
  const userLevel =
    PLAN_HIERARCHY[userPlan as keyof typeof PLAN_HIERARCHY] ?? 0;
  const featureLevel =
    PLAN_HIERARCHY[featurePlan as keyof typeof PLAN_HIERARCHY] ?? 0;
  return userLevel >= featureLevel;
};

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
  const { logout } = useAuth();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<string>('free');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({});
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    new Set(),
  );
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  // Fetch data on component mount
  useEffect(() => {
    fetchUserData();
    fetchMenus();
  }, []);

  // Re-fetch menus whenever the drawer is focused (opened or switched to)
  useFocusEffect(
    React.useCallback(() => {
      fetchUserData();
      fetchMenus(); // Ensure latest menus are always fetched on focus
    }, []),
  );

  // Sort menus by orderNo from API response
  const sortMenus = (menuList: MenuItem[]): MenuItem[] => {
    return menuList
      .filter(menu => menu.isVisible && menu.isActive)
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
  }, [loading, menus, topLevelMenus]);

  // Fetch user data to get planType
  const fetchUserData = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();
      if (!userId) return;

      const response = await axios.get(`${BASE_URL}/user/${userId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const user = response.data.data;
      setUserData(user);
      setUserPlan(user.planType || 'free');
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserPlan('free'); // Default to free plan on error
    }
  };

  const fetchMenus = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const response = await axios.get(`${BASE_URL}/menus`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Handle both { data: [...] } and plain array
      const menuData = Array.isArray(response.data)
        ? response.data
        : response.data.data || [];

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
    } catch (err) {
      console.error('Error fetching menus:', err);
    } finally {
      setLoading(false);
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
    color: string = '#222',
    size: number = 20,
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
          size={isParent ? 20 : 18}
          color={isParent ? BRAND_COLOR : '#7a8ca3'}
          style={{ marginRight: isParent ? 14 : 12 }}
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
                width: isParent ? 20 : 18,
                height: isParent ? 20 : 18,
                marginRight: isParent ? 14 : 12,
                resizeMode: 'contain',
                opacity: isImageLoading ? 0.5 : 1,
                borderRadius: 2, // Add slight border radius for better appearance
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
            size={isParent ? 20 : 18}
            color={isParent ? BRAND_COLOR : '#7a8ca3'}
            style={{ marginRight: isParent ? 14 : 12 }}
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
            size={isParent ? 20 : 18}
            color={isParent ? BRAND_COLOR : '#7a8ca3'}
            style={{ marginRight: isParent ? 14 : 12 }}
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
        size={isParent ? 20 : 18}
        color={isParent ? BRAND_COLOR : '#7a8ca3'}
        style={{ marginRight: isParent ? 14 : 12 }}
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
    // Also hide badge if user has 'premium' or 'enterprise' plan
    // And hide badge for user-created custom folders
    if (
      !planType ||
      planType === 'free' ||
      userPlan === 'premium' ||
      userPlan === 'enterprise' ||
      menu?.isCustom // Hide badge for user-created custom folders
    )
      return null;

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
        // Report menu is always disabled for now
        const isAccessible =
          menu.title?.toLowerCase() === 'report'
            ? false
            : menu.isCustom
            ? true
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
                        targetScreen = 'Invoice';
                        break;
                      case 6: // Sell/Invoice
                        targetScreen = 'Purchase';
                        break;
                      case 7: // Add New Folder
                        targetScreen = 'AddFolder';
                        break;
                      case 8: // Report
                        // Report menu is currently disabled for all users
                        console.log(`🔒 Report menu clicked but is disabled`);
                        targetScreen = ''; // No navigation
                        break;
                      case 9: // Link to CA
                        // Premium features - always navigate to subscription plan for now
                        console.log(
                          `Premium feature "${title}" clicked - navigating to subscription plan`,
                        );
                        targetScreen = 'SubscriptionPlan';
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
                {renderIcon(menu.icon, '#222', 20, isParent, menu.title)}
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
                  {renderPlanBadge(menu.planType || undefined, menu)}
                </View>
              </View>
              {/* Right-side icon for every menu */}
              {hasChildren && isParent ? (
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-down' : 'chevron-right'}
                  size={20}
                  color={BRAND_COLOR}
                  style={{ marginLeft: 10, alignSelf: 'center' }}
                />
              ) : !isAccessible ? (
                <MaterialCommunityIcons
                  name="lock"
                  size={16}
                  color="#adb5bd"
                  style={{ marginLeft: 8, alignSelf: 'center' }}
                />
              ) : (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color="#b0b8c1"
                  style={{ marginLeft: 8, alignSelf: 'center' }}
                />
              )}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Modern Header with Plan Card inside */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Smart Ledger</Text>
          <Text style={styles.headerSubtitle}>Business Management</Text>

          {/* User Plan Info Card inside header */}
          <View style={styles.planInfoCard}>
            <View style={styles.planInfoHeader}>
              <MaterialCommunityIcons
                name="crown"
                size={20}
                color={userPlan === 'free' ? '#6c757d' : '#ffd700'}
              />
              <Text style={styles.planInfoTitle}>Current Plan</Text>
            </View>
            <Text style={styles.planInfoValue}>
              {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
            </Text>
            <Text style={styles.planInfoSubtext}>
              {userPlan === 'free'
                ? 'Upgrade for premium features'
                : 'You have access to all features'}
            </Text>

            <TouchableOpacity
              style={[
                styles.subscriptionButton,
                userPlan === 'free' && styles.upgradeButton,
                userPlan !== 'free' && styles.manageButton,
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
              <Text style={styles.subscriptionButtonText}>
                {userPlan === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
          renderMenuTree(topLevelMenus)
        )}
      </ScrollView>

      {/* Modern Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialCommunityIcons name="logout-variant" size={20} color="#fff" />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.2,
  },
  planInfoCard: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 12, // reduced padding
    borderRadius: 12, // smaller radius
    width: '100%',
    alignSelf: 'center',
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.08,
    // shadowRadius: 4,
    // elevation: 2,
  },

  planInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // tighter spacing
  },
  planInfoTitle: {
    fontSize: 11, // reduced font
    color: '#495057',
    fontWeight: '600',
    marginLeft: 6,
  },
  planInfoValue: {
    fontSize: 14, // reduced font
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 1,
  },
  planInfoSubtext: {
    fontSize: 9, // smaller italic
    color: '#6c757d',
    fontStyle: 'italic',
    marginBottom: 6,
  },

  subscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    marginTop: 6, // tighter margin
    paddingVertical: 8, // smaller button
    borderRadius: 10,
  },
  subscriptionButtonText: {
    color: '#fff',
    fontSize: 12, // smaller button text
    fontWeight: '600',
    marginLeft: 6,
  },

  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
    fontSize: 12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 2,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  parentMenuRow: {
    backgroundColor: '#ffffff',
    borderColor: '#e9ecef',
  },
  parentMenuRowExpanded: {
    backgroundColor: '#f0f8ff',
    borderColor: '#bbdefb',
    borderRadius: 12,
  },
  childMenuRow: {
    backgroundColor: '#fafbfc',
    marginLeft: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 2,
    borderColor: '#f1f3f4',
    minHeight: 40,
  },
  inaccessibleMenuRow: {
    opacity: 0.5,
    backgroundColor: '#f8f9fa',
  },
  inaccessibleMenuText: {
    color: '#adb5bd',
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
  menuItem: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  parentMenu: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
  },
  childMenu: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '400',
  },
  childrenContainer: {
    marginLeft: 12,
    paddingLeft: 12,
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc3545',
    marginHorizontal: 12,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
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
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 14,
    fontWeight: '600',
  },

  // Subscription Upgrade Button Styles
  // subscriptionButton: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   backgroundColor: BRAND_COLOR,
  //   marginTop: 12,
  //   paddingVertical: 10,
  //   paddingHorizontal: 20,
  //   borderRadius: 12,
  //   borderWidth: 1,
  //   borderColor: '#e5e7eb',
  // },
  upgradeButton: {
    backgroundColor: '#28a745', // Green for upgrade
    borderColor: '#28a745',
  },
  manageButton: {
    backgroundColor: '#007bff', // Blue for manage
    borderColor: '#007bff',
  },
  // subscriptionButtonText: {
  //   color: '#fff',
  //   fontSize: 14,
  //   fontWeight: '600',
  //   marginLeft: 8,
  // },
});

export default CustomDrawerContent;
