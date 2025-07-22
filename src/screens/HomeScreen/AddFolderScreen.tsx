import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserIdFromToken } from '../../utils/storage';

const FOLDER_TYPES = [
  { label: 'Invoice', value: 'invoice', icon: 'file-document-outline' },
  { label: 'Receipt', value: 'receipt', icon: 'receipt' }, // Fixed icon name
  { label: 'Payment', value: 'payment', icon: 'credit-card-outline' },
  { label: 'Purchase', value: 'purchase', icon: 'cart-outline' },
];

const AddFolderScreen: React.FC = () => {
  const navigation = useNavigation();
  const [folderName, setFolderName] = useState('');
  const [selectedType, setSelectedType] = useState<string>(''); // No default
  const [saving, setSaving] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState('');
  const [typeError, setTypeError] = useState('');
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [cardAnim]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSave = async () => {
    let hasError = false;
    if (!folderName.trim()) {
      setError('Folder name is required');
      hasError = true;
    } else {
      setError('');
    }
    if (!selectedType) {
      setTypeError('Please select a folder type');
      hasError = true;
    } else {
      setTypeError('');
    }
    if (hasError) return;
    setSaving(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();
      const body = {
        title: folderName.trim(),
        route: `/transaction/${folderName.trim().replace(/\s+/g, '')}`,
        icon: selectedType,
        parentId: 28,
        orderNo: 1,
        isActive: true,
        isVisible: true,
        menuType: 'default',
        planType: { type: 'free' },
        isCustom: true,
      };
      await axios.post(`${BASE_URL}/menus`, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      setSaving(false);
      navigation.goBack();
    } catch (err) {
      setSaving(false);
      setError('Failed to create folder. Please try again.');
    }
  };

  const handleInputFocus = () => setInputFocused(true);
  const handleInputBlur = () => setInputFocused(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Folder</Text>
        <View style={{ width: 32 }} />
      </View>
      {/* Dismiss keyboard on outside tap */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.inputLabel}>Enter Folder Name</Text>
            <TextInput
              style={[
                styles.input,
                inputFocused && styles.inputActive,
                error && styles.inputError,
              ]}
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name"
              placeholderTextColor="#aaa"
              autoFocus
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              returnKeyType="done"
              accessibilityLabel="Folder name input"
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            <Text style={[styles.inputLabel, { marginTop: 18 }]}>
              Choose Type
            </Text>
            <View style={styles.typeRow}>
              {FOLDER_TYPES.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    selectedType === type.value && styles.typeButtonSelected,
                  ]}
                  onPress={() => setSelectedType(type.value)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Select ${type.label}`}
                >
                  <MaterialCommunityIcons
                    name={type.icon}
                    size={22}
                    color={selectedType === type.value ? '#fff' : '#222'}
                    style={{ marginBottom: 2 }}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      selectedType === type.value &&
                        styles.typeButtonTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!typeError && <Text style={styles.errorText}>{typeError}</Text>}
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!folderName || !selectedType) && { opacity: 0.5 },
              ]}
              onPress={handleSave}
              disabled={!folderName || !selectedType || saving}
              activeOpacity={0.85}
              accessibilityLabel="Save folder"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  inputLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#222',
    marginBottom: 2,
  },
  inputActive: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 2,
    fontWeight: '500',
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 18,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'column',
    minWidth: 70,
  },
  typeButtonSelected: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  typeButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 2,
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AddFolderScreen;
