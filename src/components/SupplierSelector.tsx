import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Platform,
  Dimensions,
  Modal,
  findNodeHandle,
  UIManager,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSupplierContext } from '../context/SupplierContext';
import type { Supplier } from '../api/suppliers';

interface SupplierSelectorProps {
  value: string;
  onChange: (supplierName: string, supplierObj?: Supplier) => void;
  placeholder?: string;
  style?: any;
  /**
   * Pass the parent KeyboardAwareScrollView ref to ensure dropdown is visible above keyboard.
   */
  scrollRef?: React.RefObject<any>;
}

const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Type or search supplier',
  style,
  scrollRef,
}) => {
  const { suppliers, loading, fetchAll, add, update, remove } =
    useSupplierContext();
  const [input, setInput] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [inputRowHeight, setInputRowHeight] = useState(0);
  const inputRef = useRef<View>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputLayout, setInputLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    if (showDropdown && input.length > 0) {
      setSearching(true);
      fetchAll(input).finally(() => setSearching(false));
    }
  }, [input, showDropdown]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(input.toLowerCase()),
  );

  const handleSelect = (supplier: Supplier) => {
    setInput(supplier.name);
    setShowDropdown(false);
    onChange(supplier.name, supplier);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await remove(id);
    setDeletingId(null);
    await fetchAll(''); // Refresh the full list after delete
  };

  // Handle update on blur or enter
  const handleUpdate = async (supplier: Supplier) => {
    if (editValue.trim() && editValue.trim() !== supplier.name) {
      await update(supplier.id, { name: editValue.trim() });
      setEditingId(null);
      setEditValue('');
      await fetchAll(''); // Refresh the full list after update
    } else {
      setEditingId(null);
      setEditValue('');
    }
  };

  // When dropdown is opened, always fetch the full list
  const showDropdownInline = () => {
    setShowDropdown(true);
    fetchAll(''); // Always fetch full list on open
    // Scroll input into view above keyboard
    if (scrollRef && scrollRef.current && inputRef.current) {
      // extraOffset: inputRowHeight + 16 for dropdown
      scrollRef.current.scrollToFocusedInput(
        inputRef.current,
        inputRowHeight + 16,
      );
    }
    // Measure input position for dropdown placement (fallback to measureInWindow)
    if (inputRef.current) {
      const handle = findNodeHandle(inputRef.current);
      if (handle) {
        UIManager.measureInWindow(handle, (x, y, width, height) => {
          setInputLayout({ x, y, width: width || 240, height });
        });
      }
    }
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View
        ref={inputRef}
        style={styles.inputRow}
        onLayout={e => setInputRowHeight(e.nativeEvent.layout.height)}
      >
        <Ionicons
          name="business"
          size={20}
          color="#000"
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={text => {
            setInput(text);
            onChange(text);
          }}
          placeholder={placeholder}
          autoCorrect={false}
          autoCapitalize="words"
          onFocus={() => {
            setIsFocused(true);
            showDropdownInline();
          }}
          onBlur={() => setIsFocused(false)}
        />
        {searching && (
          <ActivityIndicator
            size="small"
            color="#4f8cff"
            style={{ marginLeft: 8 }}
          />
        )}
      </View>
      <Modal
        visible={showDropdown && inputLayout.width > 0}
        transparent
        animationType="none"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View
            style={[
              styles.dropdown,
              {
                position: 'absolute',
                top: inputLayout.y + inputLayout.height,
                left: inputLayout.x,
                width: inputLayout.width,
                marginTop: 0, // ensure flush
                maxHeight: Math.max(
                  100,
                  Dimensions.get('window').height -
                    (inputLayout.y + inputLayout.height) -
                    keyboardHeight -
                    16,
                ),
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                zIndex: 9999,
              },
            ]}
          >
            <FlatList
              data={filtered}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.dropdownItemRow}>
                  {editingId === item.id ? (
                    <TextInput
                      style={[
                        styles.dropdownItemText,
                        {
                          flex: 1,
                          borderBottomWidth: 1,
                          borderColor: '#e0e0e0',
                        },
                      ]}
                      value={editValue}
                      autoFocus
                      onChangeText={setEditValue}
                      onBlur={() => handleUpdate(item)}
                      onSubmitEditing={() => handleUpdate(item)}
                      returnKeyType="done"
                    />
                  ) : (
                    <TouchableOpacity
                      style={[styles.dropdownItem, { flex: 1 }]}
                      onPress={() => handleSelect(item)}
                      onLongPress={() => {
                        setEditingId(item.id);
                        setEditValue(item.name);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{item.name}</Text>
                      {input.toLowerCase() === item.name.toLowerCase() && (
                        <Ionicons name="checkmark" size={18} color="#4f8cff" />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteIcon}
                    onPress={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size="small" color="#dc3545" />
                    ) : (
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color="#dc3545"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              )}
              style={{
                maxHeight: Math.max(
                  100,
                  Dimensions.get('window').height -
                    (inputLayout.y + inputLayout.height) -
                    keyboardHeight -
                    16,
                ),
              }}
              ListFooterComponent={null}
              showsVerticalScrollIndicator={true}
            />
            {filtered.length === 0 &&
              !(
                input.trim() &&
                !suppliers.some(
                  s =>
                    s.name.trim().toLowerCase() === input.trim().toLowerCase(),
                )
              ) && (
                <Text
                  style={{ color: '#888', padding: 12, textAlign: 'center' }}
                >
                  No suppliers found
                </Text>
              )}
            {localError && (
              <Text style={{ color: 'red', padding: 8 }}>{localError}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 10,
    // Remove shadow and elevation for a clean, attached look
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#222',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 0, // Remove rounding for seamless attachment
    borderWidth: 1,
    borderColor: '#e0e0e0',
    zIndex: 10,
    // Remove shadow and elevation for a clean, attached look
    maxHeight: 180,
    borderTopWidth: 0, // Attach to input
  },
  dropdownItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    color: '#222',
    fontSize: 16,
    flex: 1,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingRight: 4,
  },
  deleteIcon: {
    padding: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SupplierSelector;
