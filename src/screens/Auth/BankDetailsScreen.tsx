import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboarding } from '../../context/OnboardingContext';
import { RootStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const BANK_ICON = 'https://img.icons8.com/ios-filled/100/fa7d09/bank-cards.png'; // Placeholder orange bank icon

const BankDetailsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { data, setData } = useOnboarding();
  const [bankName, setBankName] = useState(data.bankName || '');
  const [accountNumber, setAccountNumber] = useState(data.accountNumber || '');
  const [ifsc, setIfsc] = useState(data.ifscCode || '');
  const [activeField, setActiveField] = useState('');
  const [caAccountId, setCaAccountId] = useState('');

  const handleBankNameChange = (value: string) => {
    setBankName(value);
    setData(prev => ({ ...prev, bankName: value }));
  };

  const handleAccountNumberChange = (value: string) => {
    setAccountNumber(value);
    setData(prev => ({ ...prev, accountNumber: value }));
  };

  const handleIfscChange = (value: string) => {
    setIfsc(value);
    setData(prev => ({ ...prev, ifscCode: value }));
  };

  const handleCaAccountIdChange = (value: string) => {
    setCaAccountId(value);
    setData(prev => ({ ...prev, caAccountId: value }));
  };

  const handleNext = () => {
    // Save bank details to context before navigating
    setData(prev => ({
      ...prev,
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      ifscCode: ifsc || '',
      caAccountId: caAccountId || '',
    }));

    navigation.navigate('FinalStep');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={60}
        showsVerticalScrollIndicator={false}
      >
        {/* <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.appName}>Smart Ledger</Text>
        </View> */}
        {/* Setup Wizard Badge */}
        {/* <View style={styles.badgeRow}>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.setupBadge}
          >
            <Text style={styles.setupBadgeText}>Setup Wizard</Text>
          </LinearGradient>
        </View> */}

        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: BANK_ICON }} style={styles.bankIcon} />
          <Text style={styles.cardHeading}>Bank Details</Text>
          <Text style={styles.cardSubtext}>
            Connect your bank account for seamless reconciliation
          </Text>
          {/* Bank Name */}
          <Text style={styles.label}>Bank Name</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'bankName' && styles.inputActive,
              activeField === 'bankName' && styles.inputFocusShadow,
            ]}
            placeholder="e.g., State Bank of India"
            value={bankName}
            onChangeText={handleBankNameChange}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('bankName')}
            onBlur={() => setActiveField('')}
          />
          {/* Account Number */}
          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'accountNumber' && styles.inputActive,
              activeField === 'accountNumber' && styles.inputFocusShadow,
            ]}
            placeholder="Enter account number"
            value={accountNumber}
            onChangeText={handleAccountNumberChange}
            placeholderTextColor="#8a94a6"
            keyboardType="number-pad"
            onFocus={() => setActiveField('accountNumber')}
            onBlur={() => setActiveField('')}
          />
          {/* IFSC Code */}
          <Text style={styles.label}>IFSC Code</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'ifsc' && styles.inputActive,
              activeField === 'ifsc' && styles.inputFocusShadow,
            ]}
            placeholder="e.g., SBIN0001234"
            value={ifsc}
            onChangeText={handleIfscChange}
            placeholderTextColor="#8a94a6"
            autoCapitalize="characters"
            onFocus={() => setActiveField('ifsc')}
            onBlur={() => setActiveField('')}
          />
          {/* CA Account Id */}
          <Text style={styles.label}>CA Account Id</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'caAccountId' && styles.inputActive,
              activeField === 'caAccountId' && styles.inputFocusShadow,
            ]}
            placeholder="Enter CA Account Id"
            value={caAccountId}
            onChangeText={text =>
              handleCaAccountIdChange(
                text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12),
              )
            }
            placeholderTextColor="#8a94a6"
            keyboardType={
              Platform.OS === 'ios' ? 'default' : 'visible-password'
            }
            autoCapitalize="characters"
            onFocus={() => setActiveField('caAccountId')}
            onBlur={() => setActiveField('')}
            maxLength={12}
          />
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoNote}>
              <Text style={styles.bold}>Note:</Text> Bank details are encrypted
              and stored securely. This information is used only for transaction
              reconciliation and is never shared.
            </Text>
          </View>
          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => navigation.navigate('Preferences')}
            >
              <Text style={styles.prevButtonText}>{'\u2190'} Previous</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={['#4f8cff', '#1ecb81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next {'\u2192'}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  setupBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    letterSpacing: 0.5,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  setupBadge: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.2,
    shadowColor: '#2563eb33',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    alignItems: 'center',
  },
  bankIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
    tintColor: '#fa7d09',
    alignSelf: 'center',
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtext: {
    fontSize: 15,
    color: '#7a869a',
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '400',
  },
  label: {
    fontSize: 15,
    color: '#222',
    marginBottom: 6,
    marginTop: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#e3e7ee',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 2,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#222',
  },
  inputActive: {
    borderColor: '#4f8cff',
    borderWidth: 2,
  },
  inputFocusShadow: {
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: '#f0f6ff',
  },
  infoBox: {
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  infoNote: {
    fontSize: 13,
    color: '#b26a00',
    fontWeight: '500',
  },
  bold: {
    fontWeight: 'bold',
    color: '#b26a00',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  prevButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flex: 1,
    marginRight: 8,
  },
  prevButtonText: {
    color: '#222',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gradientButton: {
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  nextButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    width: '100%',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default BankDetailsScreen;
