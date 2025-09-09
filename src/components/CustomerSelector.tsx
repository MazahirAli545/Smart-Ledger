import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useCustomerContext } from '../context/CustomerContext';
import type { Customer } from '../api/customers';

interface CustomerSelectorProps {
  value: string;
  onChange: (name: string, customer?: Customer) => void;
  placeholder?: string;
  onCustomerSelect?: (customer: Customer) => void;
}

const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Type or search customer',
  onCustomerSelect,
}) => {
  const { customers, fetchAll } = useCustomerContext();
  const [isFocus, setIsFocus] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleCustomerSelect = (customer: Customer) => {
    console.log('🔍 CustomerSelector: Customer selected:', customer);
    console.log('🔍 CustomerSelector: partyName:', customer.partyName);
    console.log('🔍 CustomerSelector: phoneNumber:', customer.phoneNumber);
    console.log('🔍 CustomerSelector: address:', customer.address);

    // Call the optional callback first to populate fields
    if (onCustomerSelect) {
      console.log('🔍 CustomerSelector: Calling onCustomerSelect callback');
      onCustomerSelect(customer);
    } else {
      console.log('🔍 CustomerSelector: No onCustomerSelect callback provided');
    }

    // Then update the input value
    onChange(customer.partyName || '', customer);
    setInputValue(customer.partyName || '');
    setShowDropdown(false);
    setIsFocus(false);
  };

  const closeDropdown = () => {
    // Don't close dropdown if user is actively scrolling
    if (isScrolling) {
      return;
    }

    // Add a small delay to allow user interaction
    setTimeout(() => {
      if (!isScrolling) {
        setShowDropdown(false);
        setIsFocus(false);
      }
    }, 100);
  };

  // Safe cleanup to prevent memory leaks and errors
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      setShowDropdown(false);
      setIsFocus(false);
      setIsScrolling(false);
    };
  }, []);

  const handleInputChange = (text: string) => {
    console.log('🔍 CustomerSelector: Input changed to:', text);
    setInputValue(text);
    onChange(text); // Always update parent with current text

    // Always show dropdown when typing, filter customers based on input
    if (customers.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleInputFocus = () => {
    setIsFocus(true);

    // Always show dropdown when focused if there are customers
    if (customers.length > 0) {
      setShowDropdown(true);
      console.log(
        '✅ CustomerSelector: Focused, showing dropdown with',
        customers.length,
        'customers',
      );
    } else {
      console.log('❌ CustomerSelector: No customers available on focus');
    }
  };

  const handleInputBlur = () => {
    // Don't immediately hide dropdown - let user interact with it
    // The dropdown will be hidden when a customer is selected or when clicking outside
    // We'll handle closing through the closeDropdown function
  };

  // Clean customer data to remove any "Phone" prefix from partyName
  const cleanCustomerData = (customer: Customer) => {
    if (customer.partyName) {
      // Remove "Phone" prefix and any leading/trailing whitespace
      let cleanName = customer.partyName;

      // Remove "Phone " prefix (with space)
      if (cleanName.startsWith('Phone ')) {
        cleanName = cleanName.replace(/^Phone\s+/, '');
      }

      // Remove "Phone" prefix (without space)
      if (cleanName.startsWith('Phone')) {
        cleanName = cleanName.replace(/^Phone/, '');
      }

      // Clean up any remaining whitespace
      cleanName = cleanName.trim();

      console.log('🧹 Cleaning customer data:', {
        original: customer.partyName,
        cleaned: cleanName,
      });

      return {
        ...customer,
        partyName: cleanName || customer.partyName, // Fallback to original if cleaning results in empty string
      };
    }
    return customer;
  };

  // Filter customers based on input
  const filteredCustomers = inputValue.trim()
    ? customers.filter(customer =>
        customer.partyName?.toLowerCase().includes(inputValue.toLowerCase()),
      )
    : customers;

  return (
    <View style={styles.container}>
      {/* TextInput for typing customer names */}
      <TextInput
        style={[styles.textInput, isFocus && styles.textInputFocused]}
        value={inputValue}
        onChangeText={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        placeholderTextColor="#8a94a6"
      />

      {/* Dropdown for existing customers - only show when there are matches */}
      {(() => {
        console.log('🔍 CustomerSelector: Dropdown visibility check:', {
          showDropdown,
          filteredCustomersLength: filteredCustomers.length,
          totalCustomers: customers.length,
          inputValue: inputValue.trim(),
        });
        return null;
      })()}
      {showDropdown && filteredCustomers.length > 0 && (
        <>
          {/* Background overlay to ensure dropdown appears above everything */}
          <TouchableOpacity
            style={styles.dropdownOverlay}
            activeOpacity={1}
            onPress={closeDropdown}
          />
          <View style={styles.dropdownContainer}>
            <ScrollView
              style={styles.dropdownScrollView}
              nestedScrollEnabled={false}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              bounces={false}
              alwaysBounceVertical={false}
              contentContainerStyle={styles.dropdownScrollContent}
              onScrollBeginDrag={() => setIsScrolling(true)}
              onScrollEndDrag={() => setIsScrolling(false)}
              onMomentumScrollBegin={() => setIsScrolling(true)}
              onMomentumScrollEnd={() => setIsScrolling(false)}
            >
              {filteredCustomers.map((customer, index) => {
                const cleanCustomer = cleanCustomerData(customer);
                return (
                  <TouchableOpacity
                    key={customer.id}
                    style={[
                      styles.dropdownItem,
                      index === filteredCustomers.length - 1 &&
                        styles.dropdownItemLast,
                    ]}
                    onPress={() => handleCustomerSelect(cleanCustomer)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownItemContent}>
                      <MaterialCommunityIcons
                        name="account"
                        size={20}
                        color="#4f8cff"
                        style={styles.dropdownIcon}
                      />
                      <Text style={styles.dropdownItemText} numberOfLines={1}>
                        {cleanCustomer.partyName || 'No Name'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}

      {/* Show indicator for new customer */}
      {/* {inputValue && !customers.find(c => c.partyName === inputValue) && (
        <View style={styles.newCustomerIndicator}>
          <MaterialCommunityIcons
            name="account-plus"
            size={16}
            color="#4f8cff"
          />
          <Text style={styles.newCustomerText}>New customer: {inputValue}</Text>
        </View>
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  textInput: {
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#222',
  },
  textInputFocused: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 1001,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
    // Ensure proper nested scrolling
    flex: 1,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownScrollContent: {
    flexGrow: 1,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
    flex: 1,
  },
  newCustomerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  newCustomerText: {
    fontSize: 12,
    color: '#4f8cff',
    fontStyle: 'italic',
    marginLeft: 8,
  },
});

export default CustomerSelector;
