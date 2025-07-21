import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// --- TypeScript interfaces for search/filter state ---
export interface PaymentSearchFilterState {
  searchText: string;
  paymentNumber?: string;
  supplierName?: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  status?: string;
  description?: string;
  reference?: string;
  category?: string;
}

export interface RecentSearch {
  text: string;
  timestamp: number;
}

export interface SearchAndFilterProps {
  value: PaymentSearchFilterState;
  onChange: (value: PaymentSearchFilterState) => void;
  onFilterPress: () => void;
  recentSearches: RecentSearch[];
  onRecentSearchPress: (search: RecentSearch) => void;
  filterBadgeCount: number;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  value,
  onChange,
  onFilterPress,
  recentSearches,
  onRecentSearchPress,
  filterBadgeCount,
}) => {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color="#8a94a6"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Search payments, suppliers, amount, etc."
          value={value.searchText}
          onChangeText={text => onChange({ ...value, searchText: text })}
          returnKeyType="search"
        />
        {!!value.searchText && (
          <TouchableOpacity
            onPress={() => onChange({ ...value, searchText: '' })}
            style={{ marginLeft: 4 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={22}
              color="#8a94a6"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onFilterPress}
          style={{ marginLeft: 8, padding: 6 }}
          accessibilityLabel="Filter"
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={22}
            color="#4f8cff"
          />
          {filterBadgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterBadgeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <FlatList
            data={recentSearches}
            horizontal
            keyExtractor={item => item.text + item.timestamp}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recentSearchChip}
                onPress={() => onRecentSearchPress(item)}
              >
                <Text style={styles.recentSearchText}>{item.text}</Text>
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  } as ViewStyle,
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#222',
  } as TextStyle,
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  } as ViewStyle,
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  } as TextStyle,
  recentSearchesContainer: {
    marginTop: 6,
    flexDirection: 'row',
  } as ViewStyle,
  recentSearchChip: {
    backgroundColor: '#f0f6ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  } as ViewStyle,
  recentSearchText: {
    color: '#4f8cff',
    fontSize: 14,
  } as TextStyle,
});

export default SearchAndFilter;
