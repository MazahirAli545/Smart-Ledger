import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../types/navigation';
import { navigationRef, ROOT_STACK_APP } from '../../../Navigation';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CountryPicker from 'react-native-country-picker-modal';
import SignInOtpScreen from './SignInOtpScreen';
import TestCredentialsPanel from '../../components/TestCredentialsPanel';
import { getTestUser, TestUser } from '../../config/testCredentials';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

const SignInScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { login } = useAuth();
  const { showAlert } = useAlert();
  const [mobile, setMobile] = useState('');
  const [callingCode, setCallingCode] = useState('91');
  const [countryCode, setCountryCode] = useState('IN');
  const [country, setCountry] = useState<any>({ flag: '🇮🇳' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [pendingMobile, setPendingMobile] = useState<string | null>(null);
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '', '']);
  const [showTestCredentials, setShowTestCredentials] = useState(false);

  // Get screen dimensions for responsive design
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 375; // iPhone SE and smaller devices

  useEffect(() => {
    console.log(
      '🔍 SignInScreen - Component mounted (direct navigation from splash)',
    );
    setCountry({
      cca2: 'IN',
      callingCode: ['91'],
      flag: '🇮🇳',
    });
  }, []);

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

  // Handle test user selection
  const handleTestUserSelect = (user: TestUser) => {
    setMobile(user.mobileNumber);
    setError(null);
  };

  // UNIFIED AUTH APPROACH: Single endpoint handles both login and registration
  const handleSendOtp = async () => {
    console.log('🚀 handleSendOtp called with mobile:', mobile);

    if (mobile.length === 10) {
      setLoading(true);
      setError(null);
      const fullPhone = `${callingCode}${mobile}`;

      console.log('🔍 Processing mobile number:', fullPhone);
      console.log('🎯 Using UNIFIED AUTH endpoint for both login/registration');

      try {
        // Use the unified auth endpoint that handles both scenarios automatically
        const response = await fetch(
          `${BASE_URL}/user/unified-auth/request-otp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileNumber: fullPhone }),
          },
        );

        const result = await response.json();
        console.log('🎯 Unified auth response:', response.status, result);

        if (response.ok && result.otp) {
          console.log('✅ OTP sent successfully via unified auth');
          setLoading(false);

          // Navigate to unified OTP verification screen
          (navigation as any).navigate('Auth', {
            screen: 'SignInOtp',
            params: {
              phone: fullPhone,
              backendOtp: result.otp,
              callingCode,
              countryCode,
              isExistingUser: null, // Will be determined during verification
              useUnifiedAuth: true, // Flag to use unified auth
            },
          });
        } else {
          throw new Error(result.message || 'Failed to send OTP');
        }
      } catch (err: any) {
        console.error('❌ Error in unified auth:', err);
        setLoading(false);
        setError(err.message || 'Failed to send OTP. Please try again.');
        showAlert({
          title: 'Error',
          message: err.message || 'Failed to send OTP. Please try again.',
          type: 'error',
        });
      }
    } else {
      showAlert({
        title: 'Error',
        message: 'Please enter a valid 10-digit mobile number',
        type: 'error',
      });
    }
  };

  const handleResend = async () => {
    // Resend functionality will be handled in the respective OTP screens
    // This function is kept for future use if needed
    console.log('Resend functionality handled in OTP screens');
  };

  const handleVerify = async () => {
    // OTP verification logic removed as per original code
  };

  const otpInputRefs: Array<TextInput | null> = Array(6).fill(null);

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      const chars = text.replace(/\D/g, '').slice(0, 6).split('');
      let newOtpArr = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtpArr[i] = chars[i] || '';
      }
      setOtp(newOtpArr);
      if (chars.length < 6) {
        otpInputRefs[chars.length]?.focus();
      } else {
        otpInputRefs[5]?.blur();
      }
      return;
    }
    if (!/^[0-9]?$/.test(text)) return;
    let newOtpArr = [...otp];
    newOtpArr[index] = text;
    setOtp(newOtpArr);
    if (text && index < 5) {
      otpInputRefs[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (nativeEvent: any, index: number) => {
    if (nativeEvent.key === 'Backspace') {
      if (otp[index]) {
        let newOtpArr = [...otp];
        newOtpArr[index] = '';
        setOtp(newOtpArr);
      } else if (index > 0) {
        otpInputRefs[index - 1]?.focus();
        let newOtpArr = [...otp];
        newOtpArr[index - 1] = '';
        setOtp(newOtpArr);
      }
    } else if (nativeEvent.key === 'ArrowLeft' && index > 0) {
      otpInputRefs[index - 1]?.focus();
    } else if (nativeEvent.key === 'ArrowRight' && index < 5) {
      otpInputRefs[index + 1]?.focus();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaViewRN style={styles.safeArea}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid
          extraScrollHeight={24}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.titleSection}>
                <Text style={styles.welcome}>Welcome to Smart Ledger</Text>
                <Text style={styles.subtitle}>
                  Sign in or create your account
                </Text>
              </View>
            </View>

            {/* Main Content Card */}
            <View style={styles.mainContent}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Sign In / Sign Up</Text>
                  <Text style={styles.cardSubtitle}>
                    Enter your mobile number to continue
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.infoText}>
                    We'll automatically detect if you're new or existing user
                    and send the appropriate OTP. New users get instant access
                    with default settings.
                  </Text>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Phone Number</Text>
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
                          size={16}
                          color="#718096"
                          style={{ marginLeft: 4 }}
                        />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="9999999999"
                        placeholderTextColor="#a0aec0"
                        value={mobile}
                        onChangeText={text =>
                          setMobile(text.replace(/\D/g, '').slice(0, 10))
                        }
                        keyboardType="number-pad"
                        maxLength={10}
                      />
                    </View>
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

                  <View style={styles.buttonSection}>
                    <LinearGradient
                      colors={['#8f5cff', '#6f4cff']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.purpleButton}
                    >
                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleSendOtp}
                        disabled={mobile.length !== 10 || loading}
                      >
                        <Text style={styles.buttonText}>
                          {loading ? 'Checking User...' : 'Send OTP'}
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>

                  {error && <Text style={styles.errorText}>{error}</Text>}
                </View>

                <View style={styles.footerSection}>
                  <Text style={styles.bottomText}>
                    One mobile number, one account. New users get instant
                    access, existing users login normally.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* Test Credentials Panel */}
        <TestCredentialsPanel
          visible={showTestCredentials}
          onClose={() => setShowTestCredentials(false)}
          onSelectUser={handleTestUserSelect}
          mode="login"
        />

        {/* Profile Complete Popup */}
        <Modal
          visible={showProfilePopup}
          transparent
          animationType="fade"
          onRequestClose={() => setShowProfilePopup(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 28,
                alignItems: 'center',
                width: 300,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: 12,
                  color: '#222',
                }}
              >
                Profile Incomplete
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: '#444',
                  marginBottom: 18,
                  textAlign: 'center',
                }}
              >
                Please complete your profile
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#4f8cff',
                  borderRadius: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 32,
                }}
                onPress={() => {
                  setShowProfilePopup(false);
                  if (pendingMobile) {
                    (navigation as any).navigate('Auth', {
                      screen: 'SetupWizard',
                      params: { mobileNumber: pendingMobile },
                    });
                  }
                }}
              >
                <Text
                  style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                >
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaViewRN>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16, // Responsive padding
  },
  // Header Section
  headerSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  welcome: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 6,
  },
  mainContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24, // Reduced from 28 to give more space for content
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    width: '100%',
    maxWidth: 360, // Reduced from 380 to give more space on smaller screens
    alignSelf: 'center',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 20,
  },
  formSection: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    color: '#1a202c',
    marginBottom: 10,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  inputSection: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 52,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#222',
    textAlignVertical: 'center',
    shadowColor: 'transparent',
  },
  gradientButton: {
    borderRadius: 8,
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  otpInfo: {
    fontSize: 13,
    color: '#7a869a',
    marginBottom: 8,
    marginTop: 0,
    textAlign: 'center',
    width: '100%',
  },
  resend: {
    color: '#1ecb81',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    fontSize: 13,
  },
  bottomText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    color: '#4f8cff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    fontSize: 15,
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
    backgroundColor: '#fed7d7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: 'hidden', // Prevent content from extending beyond borders
    minHeight: 52, // Ensure consistent height
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 52,
    borderRightWidth: 1.5,
    borderRightColor: '#e2e8f0',
    minWidth: 80, // Set minimum width for country selector
    maxWidth: 100, // Set maximum width to prevent taking too much space
  },
  flag: {
    fontSize: 22,
    marginRight: 6,
  },
  code: {
    fontSize: 16,
    color: '#1a202c',
    fontWeight: '600',
    marginRight: 3,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1a202c',
    backgroundColor: '#fff',
    minWidth: 0, // Allow flex to shrink properly
    textAlignVertical: 'center', // Ensure text is centered vertically
  },
  purpleButton: {
    borderRadius: 12,
    width: '100%',
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonSection: {
    width: '100%',
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
    width: '100%',
  },
  otpBox: {
    width: 36,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    borderRadius: 8,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 18,
    color: '#222',
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  otpBoxActive: {
    borderColor: '#8f5cff',
    shadowColor: '#8f5cff',
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
  },

  infoText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});

export default SignInScreen;
