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
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { sendOtp } from '../../api';
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
    }
  }, [mobile, callingCode, countryCode, validatePhoneNumber, navigation]);

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
        <StatusBar
          barStyle="light-content"
          backgroundColor="#4f8cff"
          translucent={false}
        />
        <LinearGradient
          colors={['#4f8cff', '#4f8cff', '#f6fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundGradient}
        >
          <KeyboardAwareScrollView
            enableOnAndroid
            extraScrollHeight={40}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Brand strip */}
            <View style={styles.brandBar}>
              <View style={styles.brandLogoCircle}>
                <Image
                  source={require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png')}
                  style={styles.brandLogoIcon}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandTextContainer}>
                <Text style={styles.brandTitle}>Utils Ledger</Text>
                <Text style={styles.brandSubtitle}>
                  Smart ledger for your business
                </Text>
              </View>
            </View>

            {/* Main card */}
            <View style={styles.sheetWrapper}>
              <View style={styles.sheetGradient}>
                <View style={styles.sheetInner}>
                  <View style={styles.stepPill}>
                    <Text style={styles.stepPillText}>
                      Step 1 of 2 · Verify number
                    </Text>
                  </View>

                  <View style={styles.headerSection}>
                    <Text style={styles.screenTitle}>Sign in with OTP</Text>
                    <Text style={styles.screenSubtitle}>
                      Enter your mobile number to receive a one-time password.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.inputSection}>
                      <Text style={styles.label}>Mobile number</Text>
                      <View style={styles.phoneInputRow}>
                        <TextInput
                          style={styles.phoneInput}
                          placeholder="12345 67890"
                          placeholderTextColor="#64748b"
                          value={mobile}
                          onChangeText={handleMobileChange}
                          keyboardType="number-pad"
                          keyboardAppearance="dark"
                          maxLength={10}
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          selectionColor="#818cf8"
                          accessibilityLabel="Mobile number"
                        />
                      </View>
                    </View>

                    <Text style={styles.inlineHelperText}>
                      We never share your number. It&apos;s used only for
                      sign-in.
                    </Text>

                    {error && <Text style={styles.errorText}>{error}</Text>}
                  </View>

                  <View style={styles.buttonSection}>
                    <LinearGradient
                      colors={
                        mobile.length !== 10 || loading
                          ? ['#9ca3af', '#9ca3af']
                          : ['#4f8cff', '#4f8cff']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.primaryButtonGradient,
                        (mobile.length !== 10 || loading) &&
                          styles.primaryButtonGradientDisabled,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleSendOtp}
                        disabled={mobile.length !== 10 || loading}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.buttonText}>
                          {loading ? 'Sending OTP…' : 'Send OTP'}
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>

                    <Text style={styles.secondaryNote}>
                      You agree to receive an OTP on this number.
                    </Text>
                  </View>

                  <View style={styles.securityStrip}>
                    <View style={styles.securityDot} />
                    <Text style={styles.securityText}>
                      Bank-grade encryption · No password to remember
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.footerNoteContainer}>
              <Text style={styles.footerNoteTitle}>
                Why mobile verification?
              </Text>
              <Text style={styles.footerNoteSubtitle}>
                It keeps your ledger secure, even if your phone is shared.
              </Text>
            </View>
          </KeyboardAwareScrollView>
        </LinearGradient>

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
              backgroundColor: 'rgba(15,23,42,0.85)',
            }}
          >
            <View
              style={{
                backgroundColor: '#0f172a',
                borderRadius: 18,
                padding: 26,
                alignItems: 'center',
                width: 310,
                borderWidth: 1,
                borderColor: '#1f2937',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  marginBottom: 10,
                  color: '#e5e7eb',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Profile incomplete
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#9ca3af',
                  marginBottom: 18,
                  textAlign: 'center',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                To unlock all features, we need a few more details about your
                business profile.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#4f46e5',
                  borderRadius: 999,
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
                    color: '#f9fafb',
                    fontSize: 15,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Complete profile
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
    backgroundColor: '#4f8cff',
  },
  backgroundGradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    justifyContent: 'flex-start',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  welcome: {
    fontSize: 26,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '800',
    fontFamily: 'Roboto-Bold',
    letterSpacing: -0.5,
  },

  // Card & content
  subtitle: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },
  heroTagline: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'Roboto-Medium',
  },

  cardOuter: {
    borderRadius: 26,
    padding: 1,
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 22,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 4,
    textAlign: 'left',
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    letterSpacing: -0.3,
  },

  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'left',
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },

  formSection: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 10,
    alignSelf: 'flex-start',
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    letterSpacing: 0.1,
  },

  inputSection: {
    width: '100%',
    marginBottom: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: 0.4,
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
    fontSize: 13,
    marginTop: 10,
    marginBottom: 0,
    textAlign: 'left',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    fontFamily: 'Roboto-Medium',
  },

  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minHeight: 56,
    paddingHorizontal: 16,
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
    height: 56,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 17,
    color: '#0f172a',
    backgroundColor: 'transparent',
    minWidth: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },

  purpleButton: {
    borderRadius: 12,
    width: '100%',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  buttonSection: {
    width: '100%',
    marginTop: 4,
  },

  footerNoteContainer: {
    marginTop: 24,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  footerNoteTitle: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '600',
    fontFamily: 'Roboto-Medium',
    marginBottom: 4,
  },
  footerNoteSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
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

  // New layout styles
  brandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 20,
    alignSelf: 'center',
  },
  brandLogoCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  brandTextContainer: {
    marginLeft: 12,
    flexShrink: 1,
  },
  brandTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Roboto-Medium',
    fontWeight: '500',
    marginTop: 2,
  },
  sheetWrapper: {
    flex: 0,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetGradient: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sheetInner: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: 'transparent',
  },
  stepPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
    marginBottom: 20,
  },
  stepPillText: {
    fontSize: 11,
    color: '#0369a1',
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  screenTitle: {
    fontSize: 30,
    color: '#0f172a',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'Roboto-Medium',
    lineHeight: 22,
    marginBottom: 24,
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#1f2937',
  },
  codeText: {
    fontSize: 15,
    color: '#e5e7eb',
    marginLeft: 6,
    fontFamily: 'Roboto-Bold',
  },
  inlineHelperText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
    fontFamily: 'Roboto-Medium',
    lineHeight: 18,
  },
  primaryButtonGradient: {
    borderRadius: 12,
    width: '100%',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradientDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
    lineHeight: 16,
  },
  securityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  securityDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
    marginRight: 10,
  },
  securityText: {
    fontSize: 12,
    color: '#475569',
    fontFamily: 'Roboto-Medium',
  },
});

export default SignInScreen;
