import React, { useState, useEffect, useRef } from 'react';
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
import { Dropdown } from 'react-native-element-dropdown';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboarding } from '../../context/OnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const BUSINESS_ICON = 'https://img.icons8.com/ios-filled/100/256/building.png';

const businessSizes = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '200+ employees',
];
const industries = [
  'Retail & E-commerce',
  'Manufacturing',
  'Services',
  'Healthcare',
  'Education',
  'Food & Beverage',
  'Technology',
  'Construction',
  'Other',
];
const transactionVolumes = [
  '1-50/month',
  '51-200/month',
  '201-500/month',
  '500+/month',
];

const SetupWizardScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { data, setData } = useOnboarding();
  const [businessSize, setBusinessSize] = useState(data.businessSize || '');
  const [industry, setIndustry] = useState(data.industry || '');
  const [transactionVolume, setTransactionVolume] = useState(
    data.monthlyTransactionVolume || '',
  );
  const [accountingSoftware, setAccountingSoftware] = useState(
    data.currentAccountingSoftware || '',
  );
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [activeField, setActiveField] = useState('');

  useEffect(() => {
    const checkMobileNumber = async () => {
      if (data.mobileNumber) {
        setMobileNumber(data.mobileNumber);
      } else {
        try {
          const storedMobileNumber = await AsyncStorage.getItem(
            'userMobileNumber',
          );
          if (storedMobileNumber) {
            setMobileNumber(storedMobileNumber);
            setData(prev => ({ ...prev, mobileNumber: storedMobileNumber }));
          }
        } catch (error) {
          console.error('Error retrieving mobile number:', error);
        }
      }
    };
    checkMobileNumber();
  }, [data.mobileNumber, setData]);

  const handleBusinessSizeChange = (item: { value: string }) => {
    setBusinessSize(item.value);
    setData(prev => ({ ...prev, businessSize: item.value }));
  };
  const handleIndustryChange = (item: { value: string }) => {
    setIndustry(item.value);
    setData(prev => ({ ...prev, industry: item.value }));
  };
  const handleTransactionVolumeChange = (item: { value: string }) => {
    setTransactionVolume(item.value);
    setData(prev => ({ ...prev, monthlyTransactionVolume: item.value }));
  };
  const handleAccountingSoftwareChange = (value: string) => {
    setAccountingSoftware(value);
    setData(prev => ({ ...prev, currentAccountingSoftware: value }));
  };
  const handleNext = () => {
    setData(prev => ({
      ...prev,
      businessSize,
      industry,
      monthlyTransactionVolume: transactionVolume,
      currentAccountingSoftware: accountingSoftware,
    }));
    navigation.navigate('TeamSetup');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={60}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and App Name */}
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
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Step 1 of 5</Text>
          <Text style={styles.progressTextRight}>20% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: BUSINESS_ICON }} style={styles.businessIcon} />
          <Text style={styles.cardHeading}>Tell us about your business</Text>
          <Text style={styles.cardSubtext}>
            Help us customize Smart Ledger for your needs
          </Text>

          {/* Mobile Number Status */}
          {mobileNumber && (
            <View style={styles.mobileStatusContainer}>
              <Text style={styles.mobileStatusLabel}>
                Mobile Number:{' '}
                <Text style={styles.mobileStatusValue}>{mobileNumber}</Text>
              </Text>
            </View>
          )}

          {/* Business Size */}
          <Text style={styles.label}>Business Size</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              activeField === 'businessSize' && styles.inputActive,
              activeField === 'businessSize' && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={businessSizes.map(size => ({ label: size, value: size }))}
            search
            searchPlaceholder="Search business size..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select business size"
            value={businessSize}
            onChange={handleBusinessSizeChange}
            renderLeftIcon={() => (
              <Ionicons
                name="people"
                size={20}
                color="#4f8cff"
                style={{ marginRight: 10 }}
              />
            )}
            renderItem={(item, selected) => (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{item.label}</Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#4f8cff" />
                )}
              </View>
            )}
            onFocus={() => setActiveField('businessSize')}
            flatListProps={{ keyboardShouldPersistTaps: 'always' }}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.dropdownItemContainer}
          />

          {/* Industry */}
          <Text style={styles.label}>Industry</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              activeField === 'industry' && styles.inputActive,
              activeField === 'industry' && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={industries.map(ind => ({ label: ind, value: ind }))}
            search
            searchPlaceholder="Search industry..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select your industry"
            value={industry}
            onChange={handleIndustryChange}
            renderLeftIcon={() => (
              <Ionicons
                name="briefcase"
                size={20}
                color="#4f8cff"
                style={{ marginRight: 10 }}
              />
            )}
            renderItem={(item, selected) => (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{item.label}</Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#4f8cff" />
                )}
              </View>
            )}
            onFocus={() => setActiveField('industry')}
            flatListProps={{ keyboardShouldPersistTaps: 'always' }}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.dropdownItemContainer}
          />

          {/* Monthly Transaction Volume */}
          <Text style={styles.label}>Monthly Transaction Volume</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              activeField === 'transactionVolume' && styles.inputActive,
              activeField === 'transactionVolume' && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={transactionVolumes.map(vol => ({ label: vol, value: vol }))}
            search
            searchPlaceholder="Search volume..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select transaction volume"
            value={transactionVolume}
            onChange={handleTransactionVolumeChange}
            renderLeftIcon={() => (
              <Ionicons
                name="swap-vertical"
                size={20}
                color="#4f8cff"
                style={{ marginRight: 10 }}
              />
            )}
            renderItem={(item, selected) => (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{item.label}</Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#4f8cff" />
                )}
              </View>
            )}
            onFocus={() => setActiveField('transactionVolume')}
            flatListProps={{ keyboardShouldPersistTaps: 'always' }}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.dropdownItemContainer}
          />

          {/* Current Accounting Software */}
          <Text style={styles.label}>Current Accounting Software (if any)</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'accountingSoftware' && styles.inputActive,
              activeField === 'accountingSoftware' && styles.inputFocusShadow,
            ]}
            placeholder="e.g., Tally, QuickBooks, Excel, None"
            value={accountingSoftware}
            onChangeText={handleAccountingSoftwareChange}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('accountingSoftware')}
            onBlur={() => setActiveField('')}
          />

          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.prevButton, { opacity: 0.5 }]}
              disabled={true}
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
  setupBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  mobileStatusContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  mobileStatusLabel: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  mobileStatusValue: {
    fontWeight: 'bold',
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
  businessIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
    tintColor: '#2563eb',
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
  dropdown1: {
    marginTop: 12,
    height: 50,
    width: '100%',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1.5,
    fontSize: 16,
  },
  placeholderStyle1: {
    fontSize: 15,
    color: '#8a94a6',
  },
  selectedTextStyle1: {
    fontSize: 15,
    color: '#222',
  },
  inputSearchStyle1: {
    height: 40,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingLeft: 8,
    borderBottomColor: '#e3e7ee',
    borderBottomWidth: 1,
  },
  iconStyle1: {
    width: 24,
    height: 24,
  },
  dropdownContainer: {
    marginTop: 10,
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItemContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItem: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 8,
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 2,
    marginTop: 30,
  },
  progressText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '500',
  },
  progressTextRight: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e3e7ee',
    borderRadius: 4,
    marginHorizontal: 24,
    marginBottom: 18,
  },
  progressBarFill: {
    height: 6,
    width: '20%',
    backgroundColor: '#222',
    borderRadius: 4,
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

export default SetupWizardScreen;
