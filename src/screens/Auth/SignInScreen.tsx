import React, {
  useState,
  useEffect,
  useCallback,
  startTransition,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
<<<<<<< Updated upstream
  SafeAreaView,
  Alert,
=======
  Modal,
>>>>>>> Stashed changes
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
<<<<<<< Updated upstream
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
=======
import { sendOtp } from '../../api';
import { useAlert } from '../../context/AlertContext';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
>>>>>>> Stashed changes

// Logo removed - using text-based branding instead

interface CountryType {
  cca2: string;
  callingCode: string[];
  flag: string;
}

// Define the navigation param list
type RootStackParamList = {
  SignIn: undefined;
  SetupWizard: undefined;
  CreateAccount: undefined;
  Dashboard: undefined;
};

const SignInScreen: React.FC = () => {
<<<<<<< Updated upstream
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState<'MOBILE' | 'OTP'>('MOBILE');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOtp, setBackendOtp] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'OTP' && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, timer]);

  const handleSendOtp = async () => {
    if (mobile.length === 10) {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mobileNumber: mobile }),
        });

        const result = await response.json();

        if (response.ok && result.otp) {
          setBackendOtp(result.otp);
          setStep('OTP');
          setTimer(30);
        } else {
          throw new Error(result.message || 'Failed to send OTP');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to send OTP');
        Alert.alert('Error', err.message || 'Failed to send OTP');
      } finally {
        setLoading(false);
      }
=======
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { showAlert } = useAlert();
  const [mobile, setMobile] = useState('');
  const [callingCode] = useState('91');
  const [countryCode] = useState('IN');
  const [country, setCountry] = useState<CountryType>({
    cca2: 'IN',
    callingCode: ['91'],
    flag: '🇮🇳',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [pendingMobile, setPendingMobile] = useState<string | null>(null);

  useEffect(() => {
    setCountry({
      cca2: 'IN',
      callingCode: ['91'],
      flag: '🇮🇳',
    });
  }, []);

  // Optimized validation - single pass with early returns
  const validatePhoneNumber = useCallback((phone: string): string | null => {
    const trimmed = phone.trim();
    if (!trimmed) return 'Please enter your mobile number';
    if (trimmed.length !== 10)
      return 'Please enter a valid 10-digit mobile number';
    if (!/^\d+$/.test(trimmed)) return 'Phone number must contain only digits';
    return null;
  }, []);

  // Optimized OTP sending with faster navigation
  const handleSendOtp = useCallback(async () => {
    // Early validation - synchronous, no async overhead
    const validationError = validatePhoneNumber(mobile);
    if (validationError) {
      setError(validationError);
      showAlert({
        title: 'Invalid Phone Number',
        message: validationError,
        type: 'error',
      });
      return;
    }

    // Pre-compute values before async operations
    const trimmedMobile = mobile.trim();
    const fullPhone = `${callingCode}${trimmedMobile}`;

    // Batch state updates
    setError(null);
    setLoading(true);

    try {
      // Make API call - navigation happens immediately after success
      const result = await sendOtp({ phone: fullPhone });

      if (result && (result.otp || result.success)) {
        // Use startTransition for non-blocking navigation - smoother UX
        startTransition(() => {
          navigation.navigate('Auth', {
            screen: 'SignInOtp',
            params: {
              phone: fullPhone,
              backendOtp: result.otp || undefined, // Handle case where success=true but no OTP
              callingCode,
              countryCode,
              isExistingUser: null,
              usePostmanAuth: true,
            },
          });
        });
        // Reset loading state immediately for faster UI response
        setLoading(false);
      } else {
        throw new Error(result?.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      const errorMessage =
        err.message || 'Failed to send OTP. Please try again.';
      setLoading(false);
      setError(errorMessage);
      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
      });
>>>>>>> Stashed changes
    }
  }, [
    mobile,
    callingCode,
    countryCode,
    validatePhoneNumber,
    navigation,
    showAlert,
  ]);

<<<<<<< Updated upstream
  const handleResend = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobileNumber: mobile }),
      });

      const result = await response.json();

      if (response.ok && result.otp) {
        setBackendOtp(result.otp);
        setTimer(30);
        setOtp('');
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
    if (otp.length === 6) {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BASE_URL}/user/login/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mobileNumber: mobile,
            otp: otp,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Save tokens to AsyncStorage
          await AsyncStorage.setItem('accessToken', result.accessToken);
          await AsyncStorage.setItem('refreshToken', result.refreshToken);
          await AsyncStorage.setItem('userMobileNumber', mobile);

          // Check if profile is complete
          if (result.profileComplete) {
            Alert.alert('Success', 'Login successful!', [
              { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
            ]);
          }
          // } else {
          //   // If profile is not complete, navigate to setup wizard
          //   navigation.navigate('Dashboard');
          // }
        } else {
          throw new Error(result.message || 'Invalid OTP');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify OTP');
        Alert.alert('Error', err.message || 'Failed to verify OTP');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>{'\u2190'} Back to Home</Text>
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logo} />
            <Text style={styles.appName}>Smart Ledger</Text>
=======
  // Optimized input handler - memoized to prevent unnecessary re-renders
  const handleMobileChange = useCallback(
    (text: string) => {
      // Filter non-digits and limit to 10 characters in one pass
      const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
      setMobile(digitsOnly);
      // Clear error when user starts typing
      if (error) setError(null);
    },
    [error],
  );

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
              <View style={styles.logoContainer}>
                <Image
                  source={require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png')}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
              </View>
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
                      <View style={styles.countryTrigger}>
                        <Text style={styles.flag}>{country?.flag || '🇮🇳'}</Text>
                        <Text style={styles.code}>+{callingCode}</Text>
                      </View>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="9999999999"
                        placeholderTextColor="#a0aec0"
                        value={mobile}
                        onChangeText={handleMobileChange}
                        keyboardType="number-pad"
                        maxLength={10}
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                      />
                    </View>
                  </View>

                  <View style={styles.buttonSection}>
                    <LinearGradient
                      colors={
                        mobile.length !== 10
                          ? ['#cbd5e1', '#94a3b8']
                          : ['#6366f1', '#4f46e5', '#4338ca']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.purpleButton}
                    >
                      <TouchableOpacity
                        style={[
                          styles.button,
                          (mobile.length !== 10 || loading) &&
                            styles.buttonDisabled,
                        ]}
                        onPress={handleSendOtp}
                        disabled={mobile.length !== 10 || loading}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.buttonText}>
                          {loading ? 'Sending...' : 'Send OTP'}
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
                  marginBottom: 12,
                  color: '#222',
                  fontFamily: 'Roboto-Medium',
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
                  fontFamily: 'Roboto-Medium',
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
                  style={{
                    color: '#fff',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  OK
                </Text>
              </TouchableOpacity>
            </View>
>>>>>>> Stashed changes
          </View>
          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Enter your credentials to access your account
            </Text>
            {step === 'MOBILE' ? (
              <>
                <Text style={styles.label}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your mobile number"
                  placeholderTextColor="#8a94a6"
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <LinearGradient
                  colors={['#4f8cff', '#1ecb81']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSendOtp}
                    disabled={mobile.length !== 10 || loading}
                  >
                    <Text style={styles.buttonText}>
                      {loading ? 'Sending...' : 'Send OTP'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#8a94a6"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.otpInfo}>
                  OTP sent to {mobile} {timer > 0 ? `Resend in ${timer}s` : ''}
                  {timer === 0 && (
                    <Text style={styles.resend} onPress={handleResend}>
                      {' '}
                      Resend
                    </Text>
                  )}
                </Text>
                {/* Show OTP for testing purposes */}
                {backendOtp && (
                  <Text
                    style={{
                      color: 'red',
                      fontWeight: 'bold',
                      marginTop: 4,
                      textAlign: 'center',
                    }}
                  >
                    [API OTP: {backendOtp}]
                  </Text>
                )}
                <LinearGradient
                  colors={['#4f8cff', '#1ecb81']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleVerify}
                    disabled={otp.length !== 6 || loading}
                  >
                    <Text style={styles.buttonText}>
                      {loading ? 'Verifying...' : 'Verify & Sign In'}
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </>
            )}
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Text style={styles.bottomText}>
              Don't have an account?{' '}
              <Text
                style={styles.link}
                onPress={() => navigation.navigate('CreateAccount')}
              >
                Create one here
              </Text>
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backRow: {
    alignSelf: 'flex-start',
    marginTop: 32,
    marginLeft: 24,
    marginBottom: 8,
  },
  backText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '500',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
<<<<<<< Updated upstream
    marginTop: 8,
    marginBottom: 2,
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
  welcome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#7a869a',
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '400',
=======
    paddingHorizontal: 20,
  },
  // Header Section
  headerSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 15,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  titleSection: {
    alignItems: 'center',
  },
  welcome: {
    fontSize: 32,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '800',
    fontFamily: 'Roboto-Bold',
    letterSpacing: -0.5,
  },

  mainContent: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
>>>>>>> Stashed changes
  },

  card: {
<<<<<<< Updated upstream
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
    width: '92%',
=======
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#6366f1',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    width: '100%',
    maxWidth: 400,
>>>>>>> Stashed changes
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
<<<<<<< Updated upstream
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
    textAlign: 'center',
=======
  cardHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 28,
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    letterSpacing: -0.3,
>>>>>>> Stashed changes
  },

  cardSubtitle: {
<<<<<<< Updated upstream
    fontSize: 14,
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
=======
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },

  formSection: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 12,
>>>>>>> Stashed changes
    alignSelf: 'flex-start',
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0.2,
  },
<<<<<<< Updated upstream
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
    fontSize: 14,
    color: '#222',
    textAlignVertical: 'center',
  },
  gradientButton: {
    borderRadius: 8,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
=======

  inputSection: {
    width: '100%',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 16,
>>>>>>> Stashed changes
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
<<<<<<< Updated upstream
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  otpInfo: {
    fontSize: 13,
    color: '#7a869a',
    marginBottom: 8,
    marginTop: -4,
    textAlign: 'left',
    width: '100%',
  },
  resend: {
    color: '#1ecb81',
    fontWeight: 'bold',
=======
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
>>>>>>> Stashed changes
  },

  bottomText: {
    fontSize: 14,
<<<<<<< Updated upstream
    color: '#7a869a',
    marginTop: 10,
    textAlign: 'center',
  },
  link: {
    color: '#4f8cff',
    fontWeight: 'bold',
=======
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'Roboto-Medium',
>>>>>>> Stashed changes
  },

  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
<<<<<<< Updated upstream
=======
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    fontFamily: 'Roboto-Medium',
  },

  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#fafbfc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#6366f1',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
    minHeight: 60,
  },
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 60,
    borderRightWidth: 1.5,
    borderRightColor: '#e2e8f0',
    minWidth: 90,
    maxWidth: 105,
    backgroundColor: '#ffffff',
  },
  flag: {
    fontSize: 24,
    marginRight: 8,
    lineHeight: 28,
    fontFamily: 'Roboto-Medium',
  },

  code: {
    fontSize: 16,
    color: '#0f172a',
    marginRight: 4,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
  },

  phoneInput: {
    flex: 1,
    height: 60,
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: 17,
    color: '#0f172a',
    backgroundColor: '#fafbfc',
    minWidth: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
  },

  purpleButton: {
    borderRadius: 16,
    width: '100%',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonSection: {
    width: '100%',
    marginTop: 8,
  },

  infoText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
    fontWeight: '400',
    fontFamily: 'Roboto-Medium',
  },

  footerSection: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
>>>>>>> Stashed changes
  },
});

export default SignInScreen;
