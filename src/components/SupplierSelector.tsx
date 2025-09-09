import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSupplierContext } from '../context/SupplierContext';

interface Supplier {
  id: number;
  name: string;
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
}

const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Type or search supplier',
  scrollRef,
  onSupplierSelect,
}) => {
  const { suppliers, fetchAll } = useSupplierContext();
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchAll('');
  }, [fetchAll]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter(supplier =>
        supplier.name?.toLowerCase().includes(searchText.toLowerCase()),
      );
      setFilteredSuppliers(filtered);
    }
  }, [searchText, suppliers]);

  const handleSupplierSelect = (supplier: Supplier) => {
    console.log('🔍 SupplierSelector: Supplier selected:', supplier);
    console.log('🔍 SupplierSelector: name:', supplier.name);
    console.log('🔍 SupplierSelector: phoneNumber:', supplier.phoneNumber);
    console.log('🔍 SupplierSelector: address:', supplier.address);

    // Call the optional callback first to populate fields
    if (onSupplierSelect) {
      console.log('🔍 SupplierSelector: Calling onSupplierSelect callback');
      onSupplierSelect(supplier);
    } else {
      console.log('🔍 SupplierSelector: No onSupplierSelect callback provided');
    }

    // Then update the input value
    onChange(supplier.name || '', supplier);
    setSearchText('');
    setShowDropdown(false);
  };

  const handleInputChange = (text: string) => {
    setSearchText(text);
    onChange(text);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
    if (scrollRef?.current && inputRef.current) {
      scrollRef.current.scrollToFocusedInput(inputRef.current, 120);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow selection
    setTimeout(() => setShowDropdown(false), 200);
  };

  const renderSupplierItem = ({ item }: { item: Supplier }) => (
    <TouchableOpacity
      style={styles.supplierItem}
      onPress={() => handleSupplierSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.supplierInfo}>
        <Text style={styles.supplierName}>{item.name}</Text>
        {item.phoneNumber && (
          <Text style={styles.supplierPhone}>{item.phoneNumber}</Text>
        )}
        {item.address && (
          <Text style={styles.supplierAddress} numberOfLines={1}>
            {item.address}
          </Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        placeholderTextColor="#8a94a6"
      />

      {showDropdown && filteredSuppliers.length > 0 && (
        <Modal
          visible={showDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDropdown(false)}
          >
            <View style={styles.dropdownContainer}>
              <FlatList
                data={filteredSuppliers}
                renderItem={renderSupplierItem}
                keyExtractor={item => item.id.toString()}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              />
            </View>
          </TouchableOpacity>
        </Modal>
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
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f9f9f9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    width: '90%',
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  supplierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  supplierPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  supplierAddress: {
    fontSize: 12,
    color: '#888',
  },
});

export default SupplierSelector;
