import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboarding } from '../../context/OnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the navigation param list
type RootStackParamList = {
  SetupWizard: undefined;
  TeamSetup: undefined;
  Onboarding: undefined;
};

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const BUSINESS_ICON = 'https://img.icons8.com/ios-filled/100/256/building.png'; // Placeholder blue business icon

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
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

  useEffect(() => {
    // Check for mobile number in context or AsyncStorage
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
            console.log(
              'Mobile number retrieved from AsyncStorage:',
              storedMobileNumber,
            );
          } else {
            console.log('No mobile number found in AsyncStorage');
          }
        } catch (error) {
          console.error('Error retrieving mobile number:', error);
        }
      }
    };

    checkMobileNumber();
  }, [data.mobileNumber, setData]);

  const handleBusinessSizeChange = (value: string) => {
    setBusinessSize(value);
    setData(prev => ({ ...prev, businessSize: value }));
  };

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    setData(prev => ({ ...prev, industry: value }));
  };

  const handleTransactionVolumeChange = (value: string) => {
    setTransactionVolume(value);
    setData(prev => ({ ...prev, monthlyTransactionVolume: value }));
  };

  const handleAccountingSoftwareChange = (value: string) => {
    setAccountingSoftware(value);
    setData(prev => ({ ...prev, currentAccountingSoftware: value }));
  };

  const handleNext = () => {
    // Save all data to context before navigating
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Logo and App Name */}
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.appName}>Smart Ledger</Text>
        </View>
        {/* Setup Wizard Badge */}
        <View style={styles.badgeRow}>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.setupBadge}
          >
            <Text style={styles.setupBadgeText}>Setup Wizard</Text>
          </LinearGradient>
        </View>
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
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={businessSize}
              onValueChange={handleBusinessSizeChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#8a94a6"
            >
              <Picker.Item
                label="Select business size"
                value=""
                color="#8a94a6"
              />
              {businessSizes.map(size => (
                <Picker.Item key={size} label={size} value={size} />
              ))}
            </Picker>
          </View>
          {/* Industry */}
          <Text style={styles.label}>Industry</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={industry}
              onValueChange={handleIndustryChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#8a94a6"
            >
              <Picker.Item
                label="Select your industry"
                value=""
                color="#8a94a6"
              />
              {industries.map(ind => (
                <Picker.Item key={ind} label={ind} value={ind} />
              ))}
            </Picker>
          </View>
          {/* Monthly Transaction Volume */}
          <Text style={styles.label}>Monthly Transaction Volume</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={transactionVolume}
              onValueChange={handleTransactionVolumeChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#8a94a6"
            >
              <Picker.Item
                label="Select transaction volume"
                value=""
                color="#8a94a6"
              />
              {transactionVolumes.map(vol => (
                <Picker.Item key={vol} label={vol} value={vol} />
              ))}
            </Picker>
          </View>
          {/* Current Accounting Software */}
          <Text style={styles.label}>Current Accounting Software (if any)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Tally, QuickBooks, Excel, None"
            value={accountingSoftware}
            onChangeText={handleAccountingSoftwareChange}
            placeholderTextColor="#8a94a6"
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
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
  pickerWrapper: {
    width: '100%',
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 2,
    backgroundColor: '#fff',
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 52,
    color: '#222',
    fontSize: 15,
    paddingVertical: 0,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },
  pickerItem: {
    height: 52,
    fontSize: 15,
    color: '#222',
    textAlignVertical: 'center',
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 2,
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
