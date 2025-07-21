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
    return menuList
      .filter(menu => menu.isVisible)
      .sort((a, b) => a.id - b.id)
      .map(menu => ({
        ...menu,
        children: menu.children ? sortMenus(menu.children) : [],
      }));
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
  ) => {
    // Fallback for URLs, blobs, or invalid icon names
    if (
      !iconName ||
      iconName.startsWith('http') ||
      iconName.startsWith('blob:') ||
      typeof iconName !== 'string' ||
      iconName.length < 2
    ) {
      return (
        <MaterialCommunityIcons
          name="folder-outline"
          size={size}
          color={color}
          style={{ marginRight: 16 }}
        />
      );
    }
    return (
      <MaterialCommunityIcons
        name={iconName}
        size={size}
        color={color}
        style={{ marginRight: 16 }}
      />
    );
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
              if (hasChildren) handleToggle(menu.id);
              // Add navigation for Add Folder
              if (menu.title === 'Add Folder') {
                props.navigation.closeDrawer();
                setTimeout(() => {
                  props.navigation.navigate('AppStack', {
                    screen: 'AddFolder',
                  });
                }, 250);
              }
            }}
          >
            <View style={styles.menuLeft}>
              {/* Only render icon for parent menus */}
              {isParent && renderIcon(menu.icon, BRAND_COLOR, 24)}
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
            {hasChildren && (
              <MaterialCommunityIcons
                name={isExpanded ? 'chevron-down' : 'chevron-right'}
                size={22}
                color={BRAND_COLOR}
                style={styles.expandIcon}
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
      <View style={styles.bgWrapper}>
        <View style={styles.cardContainer}>
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
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bgWrapper: {
    flex: 1,
    backgroundColor: BG_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    marginBottom: 32,
    marginHorizontal: 8,
    flex: 1,
    width: '96%',
    // Removed shadow and elevation for a cleaner look
    // Add a subtle border for separation
    borderWidth: 1,
    borderColor: '#e6eaf0',
    paddingVertical: 22,
    paddingHorizontal: 0,
  },
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
  },
  childMenuRow: {
    backgroundColor: '#fafdff', // lighter, more minimal
    marginLeft: 16,
    // Removed borderLeft for a cleaner look
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6, // more spacing between child items
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
    borderLeftWidth: 2,
    borderLeftColor: '#e6eaf0',
    paddingLeft: 10,
    backgroundColor: '#fafdff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});

export default CustomDrawerContent;
