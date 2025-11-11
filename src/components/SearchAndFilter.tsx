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
import { uiColors, uiFonts, uiButtons, uiLayout } from '../config/uiSizing';

const SCALE = 0.75;
const scale = (value: number) => Math.round(value * SCALE);

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
  // Optional overrides for input text and placeholder colors
  inputTextColor?: string;
  placeholderTextColor?: string;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  value,
  onChange,
  onFilterPress,
  recentSearches,
  onRecentSearchPress,
  filterBadgeCount,
  inputTextColor,
  placeholderTextColor,
}) => {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={uiColors.textTertiary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={[
            styles.input,
            inputTextColor ? { color: inputTextColor } : null,
          ]}
          placeholder="Search payments, suppliers, amount, etc."
          value={value.searchText}
          onChangeText={text => onChange({ ...value, searchText: text })}
          returnKeyType="search"
          placeholderTextColor={
            placeholderTextColor ? placeholderTextColor : uiColors.textTertiary
          }
        />
        {!!value.searchText && (
          <TouchableOpacity
            onPress={() => onChange({ ...value, searchText: '' })}
            style={{ marginLeft: 4 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={22}
              color={uiColors.textTertiary}
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
            color={uiColors.primaryBlue}
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
    backgroundColor: uiColors.bgCard,
    borderRadius: uiButtons.radiusMd,
    borderColor: uiColors.borderLight,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  } as ViewStyle,
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: uiColors.textPrimary,
    fontFamily: 'Roboto-Medium',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: uiColors.primaryBlue,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  } as ViewStyle,
  badgeText: {
    color: uiColors.textHeader,
    fontSize: 10,
    fontFamily: 'Roboto-Medium',
  },

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
    color: uiColors.primaryBlue,
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },
});

export default SearchAndFilter;
