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
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { sendOtp } from '../../api';
import { useAlert } from '../../context/AlertContext';
import { SafeAreaView as SafeAreaViewRN } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// Logo removed - using text-based branding instead

interface CountryType {
  cca2: string;
  callingCode: string[];
  flag: string;
}

const SignInScreen: React.FC = () => {
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
    }
  }, [
    mobile,
    callingCode,
    countryCode,
    validatePhoneNumber,
    navigation,
    showAlert,
  ]);

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
          </View>
        </Modal>
      </SafeAreaViewRN>
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
    justifyContent: 'center',
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
  },

  card: {
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
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
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
  },

  cardSubtitle: {
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
    alignSelf: 'flex-start',
    fontWeight: '700',
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0.2,
  },

  inputSection: {
    width: '100%',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
  },

  bottomText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'Roboto-Medium',
  },

  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
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
  },
});

export default SignInScreen;
