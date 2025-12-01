import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCustomerContext } from '../context/CustomerContext';
import { profileUpdateManager } from '../utils/profileUpdateManager';
import { unifiedApi } from '../api/unifiedApiService';
import type { Customer } from '../api/customers';

// Global scale helper aligned with other components
const SCALE = 0.9;
const scale = (value: number) => Math.round(value * SCALE);

interface CustomerSelectorProps {
  value: string;
  onChange: (name: string, customer?: Customer) => void;
  placeholder?: string;
  scrollRef?: any;
  onCustomerSelect?: (customer: Customer) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Search Customer',
  scrollRef,
  onCustomerSelect,
}) => {
  const { customers, fetchAll, loading, error } = useCustomerContext();
  const [searchText, setSearchText] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Fetch customers only once on mount to avoid infinite re-fetch loops
    // caused by changing function identities from context re-renders
    const loadCustomers = async () => {
      try {
        console.log('🔍 CustomerSelector: Starting to load customers...');
        console.log('🔍 CustomerSelector: Context state:', {
          loading,
          error,
          customersCount: customers?.length || 0,
        });

        // Always try to fetch customers on mount to ensure they're loaded
        console.log('🔍 CustomerSelector: Fetching customers...');
        const result = await fetchAll('');
        console.log(
          '🔍 CustomerSelector: fetchAll result:',
          result?.length || 0,
          'customers',
        );
      } catch (error) {
        console.error('❌ CustomerSelector: Error loading customers:', error);
      }
    };
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for profile update events (e.g., when customer is updated in AddPartyScreen)
  useEffect(() => {
    const handleProfileUpdate = async () => {
      console.log(
        '📢 CustomerSelector: Profile update event received, refreshing customers...',
      );
      try {
        // Invalidate cache to ensure fresh customer data
        unifiedApi.invalidateCachePattern('.*/customers.*');

        // Fetch fresh customers via unifiedApi (bypasses cache after invalidation)
        console.log(
          '🔄 CustomerSelector: Fetching fresh customers via unifiedApi...',
        );
        const customersResponse = (await unifiedApi.getCustomers('')) as any;
        const refreshedCustomers = Array.isArray(customersResponse)
          ? customersResponse
          : Array.isArray(customersResponse?.data)
          ? customersResponse.data
          : [];

        console.log(
          '✅ CustomerSelector: Fetched',
          refreshedCustomers.length,
          'fresh customers',
        );

        // Update customer context to ensure dropdown shows latest data
        try {
          await fetchAll('');
          console.log('✅ CustomerSelector: Customer context updated');
        } catch (e) {
          console.warn('⚠️ CustomerSelector: Error updating customer context:', e);
        }

        console.log(
          '✅ CustomerSelector: Customers refreshed after profile update',
        );
      } catch (error) {
        console.error(
          '❌ CustomerSelector: Error refreshing customers on profile update:',
          error,
        );
      }
    };

    profileUpdateManager.onProfileUpdate(handleProfileUpdate);
    console.log('📢 CustomerSelector: Registered profile update listener');

    return () => {
      profileUpdateManager.offProfileUpdate(handleProfileUpdate);
      console.log('📢 CustomerSelector: Unregistered profile update listener');
    };
  }, [fetchAll]);

  // Sync searchText with value prop when it changes
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  const getDisplayName = (c: Customer) => {
    // Prefer the longer/more complete name between name and partyName
    const name = (c.name || '').trim();
    const partyName = (c.partyName || '').trim();
    return name.length >= partyName.length ? name : partyName;
  };

  useEffect(() => {
    console.log('🔍 CustomerSelector: useEffect triggered', {
      customers: customers?.length || 0,
      isArray: Array.isArray(customers),
      searchText,
    });

    if (!customers || !Array.isArray(customers)) {
      console.log(
        '🔍 CustomerSelector: Setting filteredCustomers to empty array',
      );
      setFilteredCustomers([]);
      return;
    }

    if (searchText.trim() === '') {
      console.log(
        '🔍 CustomerSelector: Setting filteredCustomers to all customers',
      );
      console.log(
        '🔍 CustomerSelector: Sample customer data:',
        customers.slice(0, 2),
      );
      setFilteredCustomers(customers);
    } else {
      const needle = searchText.toLowerCase();
      const filtered = customers.filter(customer => {
        const name = getDisplayName(customer).toLowerCase();
        const phone = (customer.phoneNumber || '').toLowerCase();
        return name.includes(needle) || phone.includes(needle);
      });
      console.log(
        '🔍 CustomerSelector: Setting filteredCustomers to filtered results',
        filtered.length,
      );
      setFilteredCustomers(filtered);
    }
  }, [searchText, customers]);

  const handleCustomerSelect = async (customer: Customer) => {
    const selectedName = getDisplayName(customer);
    let enriched: Customer = {
      ...customer,
      phoneNumber: customer.phoneNumber || '',
      address: customer.address || '',
    };
    // Use the most complete name
    const finalName = getDisplayName(enriched);
    onChange(finalName, enriched);
    setSearchText(finalName);
    setShowDropdown(false);
    Keyboard.dismiss();
    if (onCustomerSelect) onCustomerSelect(enriched);
  };

  const handleInputChange = (text: string) => {
    setSearchText(text);
    onChange(text, undefined);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    console.log('🔍 CustomerSelector: Input focused, showing dropdown');
    console.log('🔍 CustomerSelector: Current state:', {
      customers: customers?.length || 0,
      filteredCustomers: filteredCustomers?.length || 0,
      loading,
      error,
    });

    // If no customers are loaded and not currently loading, try to fetch them
    if ((!customers || customers.length === 0) && !loading && !error) {
      console.log(
        '🔍 CustomerSelector: No customers available, attempting to fetch...',
      );
      fetchAll('');
    }

    setShowDropdown(true);
    if (scrollRef?.current && inputRef.current) {
      scrollRef.current.scrollToFocusedInput(inputRef.current, 120);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow selection
    setTimeout(() => setShowDropdown(false), 200);
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const displayName = getDisplayName(item);
    console.log('🔍 CustomerSelector: Rendering customer item:', {
      id: item.id,
      partyName: item.partyName,
      displayName: displayName,
      itemKeys: Object.keys(item),
    });

    return (
      <TouchableOpacity
        style={styles.customerItem}
        onPress={() => handleCustomerSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color="#9ca3af"
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={searchText}
        onChangeText={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        placeholderTextColor="#666666"
      />

      {showDropdown && (
        <View style={styles.dropdownAbsolute}>
          {(() => {
            console.log('🔍 CustomerSelector: Rendering dropdown with state:', {
              loading,
              error,
              customersCount: customers?.length || 0,
              filteredCustomersCount: filteredCustomers?.length || 0,
              showDropdown,
            });
            return null;
          })()}
          {loading ? (
            <Text style={styles.hint}>Loading customers...</Text>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText} numberOfLines={3}>
                {error}
              </Text>
              <Text style={styles.debugText}>
                Check network connection and try again
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  console.log(
                    '🔄 CustomerSelector: Retrying customer fetch...',
                  );
                  fetchAll('');
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !filteredCustomers || filteredCustomers.length === 0 ? (
            <View style={styles.hintContainer}>
              <Text style={styles.hint}>No customers found</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 240 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {(filteredCustomers || []).map(item => (
                <View key={item.id.toString()}>
                  {renderCustomerItem({ item })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  input: {
    borderWidth: 0.4,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: scale(16),
    color: '#333333',
    backgroundColor: '#f9f9f9',
    fontFamily: 'Roboto-Medium',
  },

  dropdownAbsolute: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    maxHeight: 200,
    overflow: 'hidden',
    // Ensure proper nested scrolling
    flex: 1,
    // Add a subtle border radius to the top corners only
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
    minHeight: 56,
  },
  customerInfo: {
    flex: 1,
  },
  customerDetails: {
    marginTop: 4,
  },
  customerName: {
    fontSize: scale(16),
    color: '#1f2937',
    fontFamily: 'Roboto-Medium',
    lineHeight: scale(20),
  },

  metaText: {
    fontSize: scale(16),
    color: '#666666',
    marginTop: 2,
    fontFamily: 'Roboto-Medium',
  },

  hint: {
    padding: 16,
    fontSize: scale(14),
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  hintContainer: {
    padding: scale(8),
    alignItems: 'center',
  },
  errorText: {
    padding: 12,
    fontSize: scale(14),
    color: '#dc3545',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  errorContainer: {
    padding: 12,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#dc3545',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
  },

  debugText: {
    fontSize: scale(12),
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'Roboto-Medium',
  },
});

export default CustomerSelector;
