import React, { useState, useRef, MutableRefObject, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  findNodeHandle,
  Modal,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import CheckBox from '@react-native-community/checkbox';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  registerUser,
  RegisterPayload,
  sendOtpApi,
  verifyOtpApi,
} from '../../api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboarding } from '../../context/OnboardingContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CountryPicker from 'react-native-country-picker-modal';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import TestCredentialsPanel from '../../components/TestCredentialsPanel';
import {
  getTestCredentials,
  TestCredentials,
} from '../../config/testCredentials';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

const businessTypes = [
  'Manufacturing',
  'Proprietorship',
  'Partnership',
  'Private Limited',
  'LLP',
  'Other',
];

const CreateAccountScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { setData } = useOnboarding();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [agree, setAgree] = useState(false);
  const [activeField, setActiveField] = useState('');
  const scrollRef = useRef<KeyboardAwareScrollView | null>(null);
  const dropdownRef = useRef(null);
  const dropdownContainerRef = useRef<View>(null);
  // Add country picker state for mobile input
  const [countryCode, setCountryCode] = useState('IN');
  const [callingCode, setCallingCode] = useState('91');
  const [country, setCountry] = useState<any>({ flag: '🇮🇳' });
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMobileExistsModal, setShowMobileExistsModal] = useState(false);
  const [showTestCredentials, setShowTestCredentials] = useState(false);

  const onSelectCountry = (selectedCountry: any) => {
    setCountryCode(selectedCountry.cca2);
    setCallingCode(selectedCountry.callingCode[0]);
    setCountry({
      ...selectedCountry,
      flag: getFlagEmoji(selectedCountry.cca2),
    });
    setShowCountryPicker(false);
  };

  const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  // Handle pre-filled mobile number from SignInScreen
  useEffect(() => {
    const params = route.params as any;
    if (params?.prefillMobile) {
      setMobileNumber(params.prefillMobile);
      if (params.prefillCallingCode) {
        setCallingCode(params.prefillCallingCode);
      }
      if (params.prefillCountryCode) {
        setCountryCode(params.prefillCountryCode);
        setCountry({
          cca2: params.prefillCountryCode,
          callingCode: [params.prefillCallingCode || '91'],
          flag: getFlagEmoji(params.prefillCountryCode),
        });
      }
    }
  }, [route.params]);

  // const handleDropdownFocus = () => {
  //   setActiveField('businessType');
  //   if (scrollRef.current && dropdownContainerRef.current) {
  //     const node = findNodeHandle(dropdownContainerRef.current);
  //     if (node) {
  //       // Calculate the position to scroll to
  //       const extraOffset = Platform.OS === 'ios' ? 100 : 150;
  //       scrollRef.current.scrollToPosition(0, extraOffset, true);
  //     }
  //   }
  // };

  // measureDropdownAndScroll removed (not needed with ScrollView)

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    const fullPhone = `${callingCode}${mobileNumber}`;
    const payload: RegisterPayload = {
      businessName,
      ownerName,
      mobileNumber: fullPhone,
      businessType,
      gstNumber,
    };
    try {
      const response = await sendOtpApi(payload);
      const otpFromBackend =
        response?.data?.otp !== undefined && response?.data?.otp !== null
          ? String(response.data.otp)
          : null;
      setLoading(false);
      // Navigate to OTP Verification Screen
      navigation.navigate('OtpVerification', {
        phone: fullPhone,
        backendOtp: otpFromBackend,
        registrationData: payload,
      });
    } catch (err: any) {
      setLoading(false);
      const errorMsg =
        err?.response?.data?.message || err?.message || 'Failed to send OTP';
      if (
        errorMsg.toLowerCase().includes('mobile number already registered') ||
        (errorMsg.toLowerCase().includes('mobile') &&
          errorMsg.toLowerCase().includes('exist'))
      ) {
        setShowMobileExistsModal(true);
        setError(null);
      } else {
        setError(typeof err === 'string' ? err : errorMsg);
      }
    }
  };

  const canSendOtp =
    businessName && ownerName && mobileNumber && businessType && agree;

  // Handle test credentials selection
  const handleTestCredentialsSelect = (credentials: TestCredentials) => {
    setBusinessName(credentials.businessName);
    setOwnerName(credentials.ownerName);
    setMobileNumber(credentials.mobileNumber);
    setBusinessType(credentials.businessType);
    if (credentials.gstNumber) {
      setGstNumber(credentials.gstNumber);
    }
    setError(null);
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
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={36}
              color="#222"
              style={styles.backArrow}
            />
          </TouchableOpacity>
        </View>
        {/* Title and Subtitle */}
        <Text style={styles.title}>Complete Your Account</Text>
        <Text style={styles.subtitle}>
          {mobileNumber
            ? `Setting up account for ${mobileNumber}`
            : 'Start your journey to smarter accounting'}
        </Text>
        {/* Card Container */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Business Registration</Text>
          <Text style={styles.cardSubtext}>
            Tell us about your business to get started
          </Text>
          {/* Business Name */}
          <Text style={styles.label}>Business Name *</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'businessName' && styles.inputActive,
              activeField === 'businessName' && styles.inputFocusShadow,
            ]}
            placeholder="Enter your business name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('businessName')}
            onBlur={() => setActiveField('')}
            returnKeyType="next"
          />
          {/* Owner Name */}
          <Text style={styles.label}>Owner Name *</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'ownerName' && styles.inputActive,
              activeField === 'ownerName' && styles.inputFocusShadow,
            ]}
            placeholder="Enter owner's full name"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('ownerName')}
            onBlur={() => setActiveField('')}
            returnKeyType="next"
          />
          {/* Mobile Number */}
          <Text style={styles.label}>Mobile Number *</Text>
          <View style={styles.phoneInputRow}>
            <TouchableOpacity
              style={styles.countryTrigger}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.flag}>{country?.flag || '🇮🇳'}</Text>
              <Text style={styles.code}>+{callingCode}</Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color="#888"
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              placeholder="9999999999"
              placeholderTextColor="#8a94a6"
              value={mobileNumber}
              onChangeText={text =>
                setMobileNumber(text.replace(/\D/g, '').slice(0, 10))
              }
              keyboardType="number-pad"
              maxLength={10}
              onFocus={() => setActiveField('mobileNumber')}
              onBlur={() => setActiveField('')}
              returnKeyType="next"
            />
          </View>
          {showCountryPicker && (
            <CountryPicker
              countryCode={countryCode as any}
              withFilter
              withAlphaFilter
              withFlag
              withCountryNameButton={false}
              withCallingCodeButton={false}
              visible={showCountryPicker}
              onSelect={onSelectCountry}
              onClose={() => setShowCountryPicker(false)}
              theme={{
                backgroundColor: '#fff',
                fontSize: 18,
                itemHeight: 48,
                filterPlaceholderTextColor: '#8a94a6',
                primaryColor: '#4f8cff',
              }}
            />
          )}
          {/* Business Type */}
          <Text style={styles.label}>Business Type *</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              activeField === 'businessType' && styles.inputActive,
              activeField === 'businessType' && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={businessTypes.map(type => ({ label: type, value: type }))}
            search
            searchPlaceholder="Search business type..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select business type"
            value={businessType}
            onChange={item => setBusinessType(item.value)}
            renderLeftIcon={() => (
              <Ionicons
                name="business"
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
            onFocus={() => setActiveField('businessType')}
            onBlur={() => setActiveField('')}
            flatListProps={{ keyboardShouldPersistTaps: 'always' }}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.dropdownItemContainer}
            keyboardAvoiding={false}
          />
          {/* GST Number */}
          <Text style={styles.label}>GST Number (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              activeField === 'gstNumber' && styles.inputActive,
              activeField === 'gstNumber' && styles.inputFocusShadow,
            ]}
            placeholder="Enter GST number if applicable"
            value={gstNumber}
            onChangeText={setGstNumber}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('gstNumber')}
            onBlur={() => setActiveField('')}
            returnKeyType="done"
          />
          {/* Terms and Policy */}
          <View style={styles.termsRow}>
            <CheckBox
              value={agree}
              onValueChange={setAgree}
              tintColors={{ true: '#4f8cff', false: '#b0b8c1' }}
              boxType={Platform.OS === 'ios' ? 'square' : undefined}
              style={styles.checkbox}
            />
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.link}>Terms of Service</Text>{' '}
              and <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>
          {/* Show error message if any */}
          {error && (
            <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
          )}
          {/* Send OTP / Verify Button */}
          <LinearGradient
            colors={
              loading
                ? ['#dbeafe', '#e0f7ef']
                : canSendOtp
                ? ['#4f8cff', '#1ecb81']
                : ['#dbeafe', '#e0f7ef']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <TouchableOpacity
              style={styles.button}
              disabled={!canSendOtp || loading}
              onPress={handleSendOtp}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    opacity: canSendOtp ? 1 : 0.5,
                  },
                ]}
              >
                {loading ? 'Registering...' : 'Send OTP'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Test Credentials Button - Development Only */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.testCredentialsButton}
              onPress={() => setShowTestCredentials(true)}
            >
              <Text style={styles.testCredentialsButtonText}>
                🧪 Use Test Credentials
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Sign in here</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Credentials Panel */}
        <TestCredentialsPanel
          visible={showTestCredentials}
          onClose={() => setShowTestCredentials(false)}
          onSelectCredentials={handleTestCredentialsSelect}
          mode="registration"
        />

        {/* Mobile Exists Modal */}
        <Modal
          visible={showMobileExistsModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowMobileExistsModal(false);
            setError(null);
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 32,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
                minWidth: 280,
              }}
            >
              <Ionicons
                name="alert-circle"
                size={48}
                color="#dc3545"
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#dc3545',
                  marginBottom: 8,
                }}
              >
                Mobile Number Exists
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: '#222',
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                The mobile number you entered is already registered. Please use
                a different number or sign in.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#4f8cff',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 24,
                    marginRight: 8,
                  }}
                  onPress={() => {
                    setShowMobileExistsModal(false);
                    setError(null);
                  }}
                >
                  <Text
                    style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                  >
                    OK
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#1ecb81',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 24,
                  }}
                  onPress={() => {
                    setShowMobileExistsModal(false);
                    setError(null);
                    navigation.navigate('SignIn');
                  }}
                >
                  <Text
                    style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                  >
                    Go to Sign In
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginLeft: 12,
    marginBottom: 12,
    height: 44,
  },
  backArrow: {
    marginLeft: 0,
    textShadowColor: '#dbeafe',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  backText: {
    fontSize: 15,
    color: '#222',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#7a869a',
    textAlign: 'center',
    marginBottom: 14,
    marginTop: 0,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 13,
    color: '#7a869a',
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: '#222',
    marginBottom: 4,
    marginTop: 14,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 46,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 2,
    backgroundColor: '#f8fafc',
    fontSize: 15,
    color: '#222',
    marginTop: 2,
    shadowColor: 'transparent',
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
  pickerWrapper: {
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 2,
    height: 46,
    justifyContent: 'center',
    marginTop: 2,
    paddingHorizontal: 0,
    shadowColor: 'transparent',
  },
  picker: {
    width: '100%',
    height: 52,
    color: '#222',
    fontSize: 16,
    paddingVertical: 0,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },
  pickerItem: {
    height: 52,
    fontSize: 16,
    color: '#222',
    textAlignVertical: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  checkbox: {
    marginRight: 8,
    width: 20,
    height: 20,
  },
  termsText: {
    fontSize: 12,
    color: '#222',
    flex: 1,
    flexWrap: 'wrap',
  },
  link: {
    color: '#4f8cff',
    textDecorationLine: 'underline',
  },
  gradientButton: {
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.2,
    textShadowColor: '#1ecb81',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  otpInfo: {
    fontSize: 12,
    color: '#7a869a',
    marginBottom: 2,
    marginTop: 2,
    textAlign: 'center',
  },
  resendOtp: {
    color: '#4f8cff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  footerText: {
    color: '#7a869a',
    fontSize: 13,
  },
  footerLink: {
    color: '#4f8cff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#e3e7ee',
  },
  flag: {
    fontSize: 20,
    marginRight: 5,
  },
  code: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginRight: 5,
  },
  phoneInput: {
    flex: 1,
    height: 46,
    fontSize: 16,
    color: '#222',
    paddingVertical: 0,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },
  testCredentialsButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#4f8cff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  testCredentialsButtonText: {
    color: '#4f8cff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CreateAccountScreen;
