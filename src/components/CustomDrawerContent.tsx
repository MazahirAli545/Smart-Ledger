import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { BASE_URL } from '../api';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

interface MenuItem {
  id: number;
  title: string;
  parentId: number | null;
  isVisible: boolean;
  icon?: string;
  children?: MenuItem[];
}

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

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = props => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<{ [key: number]: boolean }>({
    28: true,
  }); // Expand 'transaction' by default

  useEffect(() => {
    fetchMenus();
  }, []);

  // Re-fetch menus whenever the drawer is focused (opened or switched to)
  useFocusEffect(
    React.useCallback(() => {
      fetchMenus();
    }, []),
  );

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
      const menuTree = buildMenuTree(menuData);
      setMenus(menuTree);
    } catch (err) {
      console.error('Error fetching menus:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sort menus by id ascending
  const sortMenus = (menuList: MenuItem[]): MenuItem[] => {
    // Sort so 'Add Folder' is always last among siblings
    const sorted = menuList
      .filter(menu => menu.isVisible)
      .sort((a, b) => {
        const aIsAddFolder = a.title?.toLowerCase() === 'add folder';
        const bIsAddFolder = b.title?.toLowerCase() === 'add folder';
        if (aIsAddFolder && !bIsAddFolder) return 1;
        if (!aIsAddFolder && bIsAddFolder) return -1;
        return a.id - b.id;
      })
      .map(menu => ({
        ...menu,
        children: menu.children ? sortMenus(menu.children) : [],
      }));
    return sorted;
  };

  // menus is now a tree, just sort it
  const topLevelMenus = sortMenus(menus);

  const handleToggle = (id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to render icon
  const renderIcon = (
    iconName?: string,
    color: string = '#222',
    size: number = 22,
    isParent: boolean = true,
    title?: string,
  ) => {
    if (isParent) {
      return (
        <MaterialCommunityIcons
          name="folder"
          size={24}
          color={BRAND_COLOR}
          style={{ marginRight: 18 }}
        />
      );
    } else {
      let childIcon = 'file-document-outline';
      if (title) {
        if (title.toLowerCase().includes('invoice'))
          childIcon = 'file-document-outline';
        else if (title.toLowerCase().includes('receipt'))
          childIcon = 'file-document-outline';
        else if (title.toLowerCase().includes('payment'))
          childIcon = 'credit-card-outline';
        else if (title.toLowerCase().includes('purchase'))
          childIcon = 'cart-outline';
        else if (title.toLowerCase().includes('add folder'))
          childIcon = 'folder-outline';
      }
      return (
        <MaterialCommunityIcons
          name={childIcon}
          size={20}
          color="#7a8ca3"
          style={{ marginRight: 14 }}
        />
      );
    }
  };

  // Render menu tree recursively
  const renderMenuTree = (menuList: MenuItem[], level = 0) => {
    return menuList.map((menu, idx) => {
      const hasChildren = menu.children && menu.children.length > 0;
      const isParent = level === 0;
      const isExpanded = expanded[menu.id];
      return (
        <View key={menu.id}>
          {/* Divider between parent menus */}
          {isParent && idx > 0 && <View style={styles.parentDivider} />}
          <TouchableOpacity
            style={[
              styles.menuRow,
              isParent ? styles.parentMenuRow : styles.childMenuRow,
              isExpanded && isParent ? styles.parentMenuRowExpanded : null,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (hasChildren) {
                handleToggle(menu.id);
              } else {
                // Navigation for leaf menu items
                const title = menu.title?.toLowerCase();
                if (title === 'dashboard') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'Dashboard',
                    });
                  }, 250);
                } else if (title === 'invoice') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'Invoice',
                    });
                  }, 250);
                } else if (title === 'receipt') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'Receipt',
                    });
                  }, 250);
                } else if (title === 'payment') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'Payment',
                    });
                  }, 250);
                } else if (title === 'purchase') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'Purchase',
                    });
                  }, 250);
                } else if (title === 'add folder') {
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'AddFolder',
                    });
                  }, 250);
                } else {
                  // Dynamic folder: pass the menu object as folder param
                  props.navigation.closeDrawer();
                  setTimeout(() => {
                    props.navigation.navigate('AppStack', {
                      screen: 'FolderScreen',
                      params: { folder: menu },
                    });
                  }, 250);
                }
              }
            }}
          >
            <View style={styles.menuLeft}>
              <Text
                style={[
                  styles.menuItem,
                  isParent ? styles.parentMenu : styles.childMenu,
                ]}
                numberOfLines={1}
              >
                {menu.title}
              </Text>
            </View>
            {/* Right-side icon for every menu */}
            {hasChildren && isParent ? (
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-down' : 'chevron-right'}
                size={24}
                color={BRAND_COLOR}
                style={{ marginLeft: 12, alignSelf: 'center' }}
              />
            ) : (
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color="#b0b8c1"
                style={{ marginLeft: 10, alignSelf: 'center' }}
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
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG_COLOR }}>
      <Text style={styles.title}>Smart Ledger</Text>
      <View style={styles.divider} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="small" color={BRAND_COLOR} />
        ) : (
          renderMenuTree(topLevelMenus)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: LIGHT_PARENT_COLOR,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.7,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f3f8',
    marginHorizontal: 24,
    marginBottom: 10,
    borderRadius: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 28,
  },
  parentDivider: {
    height: 1,
    backgroundColor: '#f3f6fa',
    marginVertical: 6,
    marginHorizontal: 8,
    borderRadius: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 2,
    marginTop: 2,
  },
  parentMenuRow: {
    backgroundColor: '#f7fafd',
  },
  parentMenuRowExpanded: {
    backgroundColor: '#e6f0ff',
    borderRadius: 14,
    // Remove border and shadow
  },
  childMenuRow: {
    backgroundColor: '#fafdff', // very light, almost white
    marginLeft: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    // Remove borderLeft and shadow
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItem: {
    fontSize: 16,
    color: LIGHT_PARENT_COLOR,
    fontWeight: '500',
    flexShrink: 1,
    letterSpacing: 0.1,
  },
  parentMenu: {
    fontSize: PARENT_FONT_SIZE,
    fontWeight: '600',
    color: LIGHT_PARENT_COLOR,
    marginLeft: 2,
  },
  childMenu: {
    fontSize: CHILD_FONT_SIZE,
    color: '#7a8ca3', // more neutral color
    fontWeight: '400',
    marginLeft: 2,
  },
  expandIcon: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  childrenContainer: {
    marginLeft: 10,
    // Remove borderLeftWidth and borderLeftColor
    paddingLeft: 10,
    backgroundColor: '#fafdff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    // Remove border and shadow
  },
});

export default CustomDrawerContent;
