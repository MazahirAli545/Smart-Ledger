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
import { useSupplierContext } from '../context/SupplierContext';
import { fetchSupplierById } from '../api/suppliers';

// Global scale helper aligned with other components
const SCALE = 0.9;
const scale = (value: number) => Math.round(value * SCALE);

interface Supplier {
  id: number;
  name?: string; // Some backends may return partyName instead
  partyName?: string;
  phoneNumber?: string;
  address?: string;
  gstNumber?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface SupplierSelectorProps {
  value: string;
  onChange: (name: string, supplier?: Supplier) => void;
  placeholder?: string;
  scrollRef?: any;
  onSupplierSelect?: (supplier: Supplier) => void;
  supplierData?: Supplier; // Add supplier data prop for external updates
}

const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Type or search supplier',
  scrollRef,
  onSupplierSelect,
  supplierData,
}) => {
  const { suppliers, fetchAll, loading, error } = useSupplierContext();
  const [searchText, setSearchText] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Fetch suppliers only once on mount to avoid infinite re-fetch loops
    // caused by changing function identities from context re-renders
    const loadSuppliers = async () => {
      try {
        console.log('🔍 SupplierSelector: Starting to load suppliers...');
        console.log('🔍 SupplierSelector: Context state:', {
          loading,
          error,
          suppliersCount: suppliers?.length || 0,
        });

        // Always try to fetch suppliers on mount to ensure they're loaded
        console.log('🔍 SupplierSelector: Fetching suppliers...');
        const result = await fetchAll('');
        console.log(
          '🔍 SupplierSelector: fetchAll result:',
          result?.length || 0,
          'suppliers',
        );
      } catch (error) {
        console.error('❌ SupplierSelector: Error loading suppliers:', error);
      }
    };
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync searchText with value prop when it changes
  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  const getDisplayName = (s: Supplier) => {
    // Prefer the longer/more complete name between name and partyName
    const name = (s.name || '').trim();
    const partyName = (s.partyName || '').trim();
    return name.length >= partyName.length ? name : partyName;
  };

  useEffect(() => {
    console.log('🔍 SupplierSelector: useEffect triggered', {
      suppliers: suppliers?.length || 0,
      isArray: Array.isArray(suppliers),
      searchText,
    });

    if (!suppliers || !Array.isArray(suppliers)) {
      console.log(
        '🔍 SupplierSelector: Setting filteredSuppliers to empty array',
      );
      setFilteredSuppliers([]);
      return;
    }

    // Start with the main suppliers list
    let baseSuppliers = [...suppliers];

    // If we have external supplier data and it matches the current value, include it
    if (
      supplierData &&
      value &&
      supplierData.id &&
      supplierData.name &&
      value.trim() === supplierData.name.trim()
    ) {
      console.log('🔍 SupplierSelector: Including external supplier data');
      // Check if the supplier is already in the base list
      const existingSupplier = baseSuppliers.find(
        s => s.id === supplierData.id,
      );
      if (existingSupplier) {
        // Update the existing supplier with new data
        baseSuppliers = baseSuppliers.map(supplier =>
          supplier.id === supplierData.id
            ? { ...supplier, ...supplierData }
            : supplier,
        );
      } else {
        // Add the new supplier to the list
        baseSuppliers.unshift(supplierData);
      }
    }

    if (searchText.trim() === '') {
      console.log(
        '🔍 SupplierSelector: Setting filteredSuppliers to all suppliers',
      );
      console.log(
        '🔍 SupplierSelector: Sample supplier data:',
        baseSuppliers.slice(0, 2),
      );
      setFilteredSuppliers(baseSuppliers);
    } else {
      const needle = searchText.toLowerCase();
      const filtered = baseSuppliers.filter(supplier => {
        const name = getDisplayName(supplier).toLowerCase();
        const phone = (supplier.phoneNumber || '').toLowerCase();
        return name.includes(needle) || phone.includes(needle);
      });
      console.log(
        '🔍 SupplierSelector: Setting filteredSuppliers to filtered results',
        filtered.length,
      );
      setFilteredSuppliers(filtered);
    }
  }, [searchText, suppliers, supplierData, value]);

  const handleSupplierSelect = async (supplier: Supplier) => {
    const selectedName = getDisplayName(supplier);
    let enriched: Supplier = {
      ...supplier,
      phoneNumber: supplier.phoneNumber || '',
      address: supplier.address || '',
    };
    // Fallback: fetch full detail if phone/address is missing
    if (!enriched.phoneNumber || !enriched.address) {
      try {
        const full = await fetchSupplierById(supplier.id);
        if (full) {
          enriched = {
            ...enriched,
            phoneNumber: full.phoneNumber || enriched.phoneNumber,
            address: full.address || enriched.address,
            // Ensure we have the most complete name from the server
            name: full.name || enriched.name,
            partyName: full.partyName || enriched.partyName,
          };
        }
      } catch (e) {
        // Ignore detail fetch failures
      }
    }
    // Use the most complete name after potential enrichment
    const finalName = getDisplayName(enriched);
    onChange(finalName, enriched);
    setSearchText(finalName);
    setShowDropdown(false);
    Keyboard.dismiss();
    if (onSupplierSelect) onSupplierSelect(enriched);
  };

  const handleInputChange = (text: string) => {
    setSearchText(text);
    onChange(text, undefined);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    console.log('🔍 SupplierSelector: Input focused, showing dropdown');
    console.log('🔍 SupplierSelector: Current state:', {
      suppliers: suppliers?.length || 0,
      filteredSuppliers: filteredSuppliers?.length || 0,
      loading,
      error,
    });

    // If no suppliers are loaded and not currently loading, try to fetch them
    if ((!suppliers || suppliers.length === 0) && !loading && !error) {
      console.log(
        '🔍 SupplierSelector: No suppliers available, attempting to fetch...',
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

  const renderSupplierItem = ({ item }: { item: Supplier }) => {
    const displayName = getDisplayName(item);
    console.log('🔍 SupplierSelector: Rendering supplier item:', {
      id: item.id,
      partyName: item.partyName,
      displayName: displayName,
      itemKeys: Object.keys(item),
    });

    return (
      <TouchableOpacity
        style={styles.supplierItem}
        onPress={() => handleSupplierSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.supplierInfo}>
          <Text style={styles.supplierName} numberOfLines={1}>
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
            console.log('🔍 SupplierSelector: Rendering dropdown with state:', {
              loading,
              error,
              suppliersCount: suppliers?.length || 0,
              filteredSuppliersCount: filteredSuppliers?.length || 0,
              showDropdown,
            });
            return null;
          })()}
          {loading ? (
            <Text style={styles.hint}>Loading suppliers...</Text>
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
                    '🔄 SupplierSelector: Retrying supplier fetch...',
                  );
                  fetchAll('');
                }}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !filteredSuppliers || filteredSuppliers.length === 0 ? (
            <View style={styles.hintContainer}>
              <Text style={styles.hint}>No suppliers found</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 240 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {(filteredSuppliers || []).map(item => (
                <View key={item.id.toString()}>
                  {renderSupplierItem({ item })}
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
  supplierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
    minHeight: 56,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: scale(16),
    color: '#1f2937',
    fontFamily: 'Roboto-Medium',
    lineHeight: scale(20),
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

  hintContainer: {
    padding: scale(8),
    alignItems: 'center',
  },
});

export default SupplierSelector;
