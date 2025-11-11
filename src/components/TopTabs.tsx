import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface TopTabsProps {
  activeTab: 'customers' | 'suppliers';
  onChange: (tab: 'customers' | 'suppliers') => void;
}

const TopTabs: React.FC<TopTabsProps> = ({ activeTab, onChange }) => {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'customers' ? styles.activeTab : {}]}
        onPress={() => onChange('customers')}
        activeOpacity={0.7}
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
        style={[styles.tab, activeTab === 'suppliers' ? styles.activeTab : {}]}
        onPress={() => onChange('suppliers')}
        activeOpacity={0.7}
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
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 10,
    gap: 8,
    // Ensure tabs render above any floating elements
    position: 'relative',
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderRadius: 8,
    marginHorizontal: 0,
  },
  activeTab: {
    borderBottomColor: '#4f8cff',
    backgroundColor: 'rgba(79, 140, 255, 0.1)',
  },
  tabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },

  activeTabText: {
    color: '#4f8cff',
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
  },
});

export default TopTabs;
