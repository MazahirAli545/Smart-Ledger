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
  Alert,
  Platform,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../../types/navigation';
import { navigationRef, ROOT_STACK_APP } from '../../../Navigation';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CountryPicker from 'react-native-country-picker-modal';
import SignInOtpScreen from './SignInOtpScreen';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

const SignInScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [callingCode, setCallingCode] = useState('91');
  const [countryCode, setCountryCode] = useState('IN');
  const [country, setCountry] = useState<any>({ flag: '🇮🇳' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [pendingMobile, setPendingMobile] = useState<string | null>(null);

  useEffect(() => {
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

  const handleSendOtp = async () => {
    if (mobile.length === 10) {
      setLoading(true);
      setError(null);
      const fullPhone = `${callingCode}${mobile}`;
      try {
        const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mobileNumber: fullPhone }),
        });
        const result = await response.json();
        if (response.ok && result.otp) {
          setLoading(false);
          navigation.navigate('SignInOtp', {
            phone: fullPhone,
            backendOtp: result.otp,
            callingCode,
            countryCode,
          });
        } else {
          throw new Error(result.message || 'Failed to send OTP');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to send OTP');
        Alert.alert('Error', err.message || 'Failed to send OTP');
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);

    const fullPhone = `${callingCode}${mobile}`;
    try {
      const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobileNumber: fullPhone }),
      });

      const result = await response.json();

      if (response.ok && result.otp) {
        // setBackendOtp(result.otp); // Removed
        // setTimer(30); // Removed
        // setOtp(['', '', '', '', '', '']); // Removed
      } else {
        throw new Error(result.message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
      Alert.alert('Error', err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    // if (otp.join('').length === 6) { // Removed
    //   setLoading(true); // Removed
    //   setError(null); // Removed
    //   const fullPhone = `${callingCode}${mobile}`; // Removed
    //   try { // Removed
    //     const response = await fetch(`${BASE_URL}/user/login/verify-otp`, { // Removed
    //       method: 'POST', // Removed
    //       headers: { // Removed
    //         'Content-Type': 'application/json', // Removed
    //       }, // Removed
    //       body: JSON.stringify({ // Removed
    //         mobileNumber: fullPhone, // Removed
    //         otp: otp.join(''), // Removed
    //       }), // Removed
    //     }); // Removed
    //     const result = await response.json(); // Removed
    //     if (response.ok && result.success) { // Removed
    //       const verifiedMobile = result.data?.mobileNumber || fullPhone; // Removed
    //       await AsyncStorage.setItem('userMobileNumber', verifiedMobile); // Removed
    //       // Handle tokens safely // Removed
    //       if (result.accessToken != null) { // Removed
    //         await AsyncStorage.setItem('accessToken', result.accessToken); // Removed
    //       } else { // Removed
    //         await AsyncStorage.removeItem('accessToken'); // Removed
    //       } // Removed
    //       if (result.refreshToken != null) { // Removed
    //         await AsyncStorage.setItem('refreshToken', result.refreshToken); // Removed
    //       } else { // Removed
    //         await AsyncStorage.removeItem('refreshToken'); // Removed
    //       } // Removed
    //       const profileComplete = // Removed
    //         typeof result.data?.profileComplete === 'boolean' // Removed
    //           ? result.data.profileComplete // Removed
    //           : typeof result.profileComplete === 'boolean' // Removed
    //           ? result.profileComplete // Removed
    //           : undefined; // Removed
    //       if (typeof profileComplete === 'boolean') { // Removed
    //         if (!profileComplete) { // Removed
    //           setShowProfilePopup(true); // Removed
    //           setPendingMobile(verifiedMobile); // Removed
    //         } else { // Removed
    //           await login(result.accessToken, result.refreshToken, true); // Removed
    //           navigation.navigate('App', { screen: 'Dashboard' }); // Removed
    //         } // Removed
    //       } else { // Removed
    //         setError('Unexpected server response. Please try again.'); // Removed
    //         Alert.alert( // Removed
    //           'Error', // Removed
    //           'Unexpected server response. Please try again.', // Removed
    //         ); // Removed
    //       } // Removed
    //     } else { // Removed
    //       throw new Error(result.message || 'Invalid OTP'); // Removed
    //     } // Removed
    //   } catch (err: any) { // Removed
    //     setError(err.message || 'Failed to verify OTP'); // Removed
    //     Alert.alert('Error', err.message || 'Failed to verify OTP'); // Removed
    //   } finally { // Removed
    //     setLoading(false); // Removed
    //   } // Removed
    // } // Removed
  };

  const otpInputRefs: Array<TextInput | null> = Array(6).fill(null);

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Handle paste: fill all boxes in order
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
        // Clear current box only
        let newOtpArr = [...otp];
        newOtpArr[index] = '';
        setOtp(newOtpArr);
      } else if (index > 0) {
        // Move back and clear previous box
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
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.topBar}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={36}
              color="#222"
              style={styles.backArrow}
            />
          </TouchableOpacity>
          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Enter your credentials to access your account
            </Text>
            <>
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
                    size={18}
                    color="#888"
                    style={{ marginLeft: 2 }}
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="9999999999"
                  placeholderTextColor="#8a94a6"
                  value={mobile}
                  onChangeText={text =>
                    setMobile(text.replace(/\D/g, '').slice(0, 10))
                  }
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {/* Removed CountryPicker from here to eliminate right-side flag */}
              </View>
              {/* Render CountryPicker as a modal only when showCountryPicker is true */}
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
                    {loading ? 'Sending...' : 'Continue'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Text style={styles.bottomText}>
              Don't have an account?{' '}
              <Text
                style={styles.link}
                onPress={() =>
                  (navigation as any).navigate('Auth', {
                    screen: 'CreateAccount',
                  })
                }
              >
                Create one here
              </Text>
            </Text>
          </View>
        </View>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 24,
    marginLeft: 16,
    marginBottom: 4,
    height: 44,
  },
  backArrow: {
    marginLeft: 0,
    marginTop: 0,
    textShadowColor: '#dbeafe',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  welcome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#7a869a',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '400',
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
    width: '94%',
    alignSelf: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#7a869a',
    marginBottom: 14,
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
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: '#1ecb81',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    color: '#7a869a',
    marginTop: 10,
    textAlign: 'center',
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
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    marginBottom: 18,
    marginTop: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 52,
    borderRightWidth: 1.5,
    borderRightColor: '#e3e7ee',
  },
  flag: {
    fontSize: 22,
    marginRight: 6,
  },
  code: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
    marginRight: 2,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fff',
  },
  purpleButton: {
    borderRadius: 12,
    width: '100%',
    marginTop: 2,
    marginBottom: 10,
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
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
    width: 44,
    height: 54,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    borderRadius: 10,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 22,
    color: '#222',
    marginHorizontal: 3,
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
});

export default SignInScreen;
