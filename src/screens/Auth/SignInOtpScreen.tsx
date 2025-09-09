import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import messaging from '@react-native-firebase/messaging';
import { navigationRef, ROOT_STACK_APP } from '../../../Navigation';
import { showAccountCreatedNotification } from '../../utils/notificationHelper';
import { ScrollView } from 'react-native';
import {
  setDefaultScreen,
  saveCurrentScreen,
} from '../../utils/navigationStateManager';
// Using a simple custom OTP input instead of external package

const SignInOtpScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { showAlert } = useAlert();
  const {
    phone,
    backendOtp,
    callingCode,
    countryCode,
    isExistingUser,
    registrationData,
    useUnifiedAuth,
  } = route.params as any;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30); // Reduced for testing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Handle keyboard show/hide with custom positioning

  useEffect(() => {
    console.log('⏰ Timer updated:', timer);
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('🔍 SignInOtpScreen mounted with params:', {
      phone,
      backendOtp,
      callingCode,
      countryCode,
      isExistingUser,
      registrationData,
      useUnifiedAuth,
    });

    // Log backend OTP specifically
    if (backendOtp) {
      console.log('🎯 Backend OTP received:', backendOtp);
      console.log('🎯 OTP length:', backendOtp.length);
      console.log('🎯 OTP type:', typeof backendOtp);
    } else {
      console.log('❌ No backend OTP received');
    }

    // Clear any previous errors when component mounts
    setError(null);
  }, [
    phone,
    backendOtp,
    callingCode,
    countryCode,
    isExistingUser,
    registrationData,
    useUnifiedAuth,
  ]);

  useEffect(() => {
    if (otp.length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // Initial positioning when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        const screenHeight = Dimensions.get('window').height;
        const targetScrollY = Math.max(0, screenHeight * 0.2); // Center position
        scrollViewRef.current?.scrollTo({ y: targetScrollY, animated: true });
        console.log(
          '🔍 Initial positioning completed, targetY:',
          targetScrollY,
        );
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Custom keyboard handling for better control
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        console.log('🔍 Keyboard shown - moving OTP card much higher');
        setIsKeyboardVisible(true);

        // Move card much higher when keyboard appears
        setTimeout(() => {
          if (scrollViewRef.current) {
            const screenHeight = Dimensions.get('window').height;
            const keyboardHeight = screenHeight * 0.4;
            const availableHeight = screenHeight - keyboardHeight;

            // Move card even higher - more aggressive positioning
            const targetScrollY = Math.max(0, availableHeight * 0.05); // 5% from top for even higher positioning

            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true,
            });
            console.log(
              '🔍 Keyboard scroll completed, targetY:',
              targetScrollY,
            );
          }
        }, 100);
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        console.log('🔍 Keyboard hidden - centering OTP card');
        setIsKeyboardVisible(false);

        // Center the card when keyboard is hidden
        setTimeout(() => {
          if (scrollViewRef.current) {
            const screenHeight = Dimensions.get('window').height;
            const targetScrollY = Math.max(0, screenHeight * 0.2); // 20% from top for better center

            scrollViewRef.current?.scrollTo({
              y: targetScrollY,
              animated: true,
            });
            console.log(
              '🔍 Keyboard hide scroll completed, targetY:',
              targetScrollY,
            );
          }
        }, 100);
      },
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleOtpChange = (value: string) => {
    console.log('🔢 OTP Change:', { value, currentOtp: otp });
    setOtp(value);
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      if (useUnifiedAuth) {
        // Resend unified auth OTP
        console.log('🎯 Resending unified auth OTP...');
        const response = await fetch(
          `${BASE_URL}/user/unified-auth/request-otp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobileNumber: phone }),
          },
        );
        const result = await response.json();
        if (response.ok && result.otp) {
          setTimer(30);
          setOtp('');
          setError(null);
        } else {
          throw new Error(result.message || 'Failed to resend OTP');
        }
      } else if (isExistingUser) {
        // Resend login OTP
        console.log('📱 Resending login OTP...');
        const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: phone }),
        });
        const result = await response.json();
        if (response.ok && result.otp) {
          setTimer(30);
          setOtp('');
          setError(null);
        } else {
          throw new Error(result.message || 'Failed to resend OTP');
        }
      } else {
        // Resend registration OTP
        console.log('🆕 Resending registration OTP...');
        const response = await fetch(`${BASE_URL}/user/register-init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mobileNumber: phone,
            businessName: '',
            ownerName: '',
            businessType: '',
          }),
        });
        const result = await response.json();
        if (response.ok && result.otp) {
          setTimer(30);
          setOtp('');
          setError(null);
        } else {
          throw new Error(result.message || 'Failed to resend OTP');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
      showAlert({
        title: 'Error',
        message: err.message || 'Failed to resend OTP',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError(null);

    console.log('🔍 handleVerify called with useUnifiedAuth:', useUnifiedAuth);
    console.log('🔍 Current OTP:', otp);
    console.log('🔍 Phone:', phone);
    console.log('🔍 Backend OTP:', backendOtp);

    try {
      if (useUnifiedAuth) {
        // UNIFIED AUTH FLOW - Automatically handles both new and existing users
        console.log('🎯 Using unified auth verification...');

        const response = await fetch(
          `${BASE_URL}/user/unified-auth/verify-otp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobileNumber: phone,
              otp: otp,
            }),
          },
        );

        const result = await response.json();
        console.log(
          '🎯 Unified auth verification response:',
          response.status,
          result,
        );

        if (response.ok && result.success) {
          console.log('✅ Unified auth successful!');
          console.log(
            '🎯 User type:',
            result.isNewUser ? 'NEW USER' : 'EXISTING USER',
          );

          // Store tokens
          if (result.accessToken) {
            await AsyncStorage.setItem('accessToken', result.accessToken);
            await AsyncStorage.setItem('userMobileNumber', phone);
          }

          if (result.isNewUser) {
            // New user - Backend already created account with defaults, go directly to CustomerScreen
            console.log(
              '🆕 New user created with defaults, navigating to CustomerScreen...',
            );
            console.log('🆕 Backend created user with defaults:', {
              businessName: 'My Business',
              ownerName: 'User',
              businessType: 'General',
              gstNumber: null,
            });

            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', result.accessToken);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Call login first to update auth context, then navigate
            await login(result.accessToken, null, true);

            // Show account creation success notification
            try {
              await showAccountCreatedNotification();
              console.log('✅ Account creation notification sent successfully');
            } catch (notificationError) {
              console.error(
                '❌ Failed to show account creation notification:',
                notificationError,
              );
              // Don't block the flow if notification fails
            }

            // Set Customer as default screen and save current position
            await setDefaultScreen('Customer');
            await saveCurrentScreen('Customer');

            // Navigate to CustomerScreen after login
            navigation.navigate('App', {
              screen: 'AppStack',
              params: { screen: 'Customer' },
            });
          } else {
            // Existing user - login and go to CustomerScreen
            console.log('📱 Existing user, navigating to CustomerScreen...');

            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', result.accessToken);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Call login first to update auth context, then navigate
            await login(result.accessToken, null, true);

            // Set Customer as default screen and save current position
            await setDefaultScreen('Customer');
            await saveCurrentScreen('Customer');

            // Navigate to CustomerScreen after login
            navigation.navigate('App', {
              screen: 'AppStack',
              params: { screen: 'Customer' },
            });
          }
        } else {
          setError(result.message || 'OTP verification failed');
        }
      } else {
        // LEGACY FLOW - Handle existing vs new user logic
        if (isExistingUser) {
          // EXISTING USER - Login flow
          console.log('📱 Verifying login OTP for existing user...');

          const response = await fetch(`${BASE_URL}/user/login/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobileNumber: phone,
              otp: otp,
            }),
          });
          const result = await response.json();
          console.log(
            '📱 Login verification response:',
            response.status,
            result,
          );

          if (response.ok && result.success) {
            const verifiedMobile = result.data?.mobileNumber || phone;
            await AsyncStorage.setItem('userMobileNumber', verifiedMobile);
            if (result.accessToken != null) {
              await AsyncStorage.setItem('accessToken', result.accessToken);

              // Register FCM token after successful login
              try {
                const fcmToken = await messaging().getToken();
                if (fcmToken) {
                  await fetch(`${BASE_URL}/notifications/register-token`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${result.accessToken}`,
                    },
                    body: JSON.stringify({
                      token: fcmToken,
                      deviceType: Platform.OS,
                    }),
                  });
                }
              } catch (fcmError) {
                console.error('Failed to register FCM token:', fcmError);
              }
            } else {
              await AsyncStorage.removeItem('accessToken');
            }
            if (result.refreshToken != null) {
              await AsyncStorage.setItem('refreshToken', result.refreshToken);
            } else {
              await AsyncStorage.removeItem('refreshToken');
            }
            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', result.accessToken);
            if (result.refreshToken) {
              await AsyncStorage.setItem('refreshToken', result.refreshToken);
            }
            await AsyncStorage.setItem('userMobileNumber', verifiedMobile);

            // Call login first to update auth context, then navigate
            await login(result.accessToken, result.refreshToken, true);

            // Set Customer as default screen and save current position
            await setDefaultScreen('Customer');
            await saveCurrentScreen('Customer');

            // Navigate to CustomerScreen after login
            navigation.navigate('App', {
              screen: 'AppStack',
              params: { screen: 'Customer' },
            });
          } else {
            setError(result.message || 'Invalid OTP');
          }
        } else {
          // NEW USER - Registration flow
          console.log('🆕 Verifying registration OTP for new user...');
          console.log('🆕 Registration data:', registrationData);

          const response = await fetch(`${BASE_URL}/user/register/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mobileNumber: phone,
              otp: otp,
            }),
          });
          const result = await response.json();
          console.log(
            '🆕 Registration verification response:',
            response.status,
            result,
          );

          if (response.ok && result.success) {
            console.log('✅ Registration OTP verified successfully!');

            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', result.accessToken);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Call login first to update auth context, then navigate
            console.log('🔐 Calling login function for new user with:', {
              token: result.accessToken,
              refreshToken: null,
              profileComplete: true,
            });
            await login(result.accessToken, null, true);
            console.log(
              '✅ Login function completed successfully for new user',
            );

            // Show account creation success notification
            try {
              await showAccountCreatedNotification();
              console.log('✅ Account creation notification sent successfully');
            } catch (notificationError) {
              console.error(
                '❌ Failed to show account creation notification:',
                notificationError,
              );
              // Don't block the flow if notification fails
            }

            // Set Customer as default screen and save current position
            await setDefaultScreen('Customer');
            await saveCurrentScreen('Customer');

            // Navigate to CustomerScreen after login
            navigation.navigate('App', {
              screen: 'AppStack',
              params: { screen: 'Customer' },
            });
          } else {
            setError(result.message || 'Registration OTP verification failed');
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Error in handleVerify:', err);
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 **** $3');

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            flexGrow: 1,
            minHeight: '100%',
            justifyContent: 'center',
            paddingTop: 80,
            paddingBottom: 80,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          bounces={!isKeyboardVisible} // Disable bouncing when keyboard is visible
          alwaysBounceVertical={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <TouchableOpacity
                style={styles.topBar}
                onPress={() => navigation.goBack()}
              >
                <Ionicons
                  name="arrow-back"
                  size={28}
                  color="#2d3748"
                  style={styles.backArrow}
                />
              </TouchableOpacity>

              <View style={styles.titleSection}>
                <Text style={styles.welcome}>Verify Your Number</Text>
                <Text style={styles.subtitle}>
                  Enter the 6-digit code sent to {maskedPhone}
                </Text>
              </View>
            </View>

            {/* Main Content Card */}
            <View style={styles.mainContent}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconContainer}>
                    <LinearGradient
                      colors={['#8f5cff', '#6f4cff']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.iconGradient}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={32}
                        color="#fff"
                      />
                    </LinearGradient>
                  </View>
                  <Text style={styles.cardTitle}>OTP Verification</Text>
                  <Text style={styles.cardSubtitle}>
                    {useUnifiedAuth
                      ? "We'll automatically create your account or log you in"
                      : 'Complete your account setup'}
                  </Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.infoText}>
                    {useUnifiedAuth
                      ? 'New users get instant access with default settings'
                      : 'Enter the verification code to continue'}
                  </Text>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Verification Code</Text>
                    <View style={styles.otpContainer}>
                      <View style={styles.otpRow}>
                        {Array.from({ length: 6 }, (_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.otpInput,
                              otp.length > index && styles.otpInputFilled,
                              otp.length === index && styles.otpInputActive,
                            ]}
                          >
                            <Text style={styles.otpText}>
                              {otp[index] || ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <TextInput
                        style={styles.hiddenInput}
                        value={otp}
                        onChangeText={handleOtpChange}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus={true}
                        selectTextOnFocus={true}
                        autoComplete="sms-otp"
                        showSoftInputOnFocus={true}
                        onFocus={() => {
                          console.log(
                            '🔍 OTP input focused - forcing keyboard to show',
                          );
                          // Force keyboard to show and move card even higher
                          setTimeout(() => {
                            if (scrollViewRef.current) {
                              const screenHeight =
                                Dimensions.get('window').height;
                              const targetScrollY = Math.max(
                                0,
                                screenHeight * 0.05, // Even higher positioning
                              );
                              scrollViewRef.current?.scrollTo({
                                y: targetScrollY,
                                animated: true,
                              });
                            }
                          }, 200);
                        }}
                        onBlur={() => {
                          console.log('🔍 OTP input blurred');
                        }}
                      />
                    </View>
                    {/* Backend OTP Display */}
                    {backendOtp && (
                      <View style={styles.backendOtpContainer}>
                        <Text style={styles.backendOtpTitle}>OTP:</Text>
                        <Text style={styles.backendOtpValue}>{backendOtp}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.timerSection}>
                    <View style={styles.timerContainer}>
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={timer > 0 ? '#666' : '#999'}
                      />
                      <Text
                        style={[
                          styles.timerText,
                          timer === 0 && styles.timerExpired,
                        ]}
                      >
                        {timer > 0
                          ? `0:${timer.toString().padStart(2, '0')}`
                          : '0:00'}
                      </Text>
                    </View>

                    {timer === 0 && (
                      <TouchableOpacity
                        style={styles.resendButton}
                        onPress={handleResend}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh" size={24} color="#ffffff" />
                        <Text style={styles.resendText}>Resend OTP</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={20}
                        color="#dc3545"
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {loading && (
                    <View style={styles.loadingContainer}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#8f5cff"
                      />
                      <Text style={styles.loadingText}>Verifying...</Text>
                    </View>
                  )}
                </View>

                <View style={styles.footerSection}>
                  <Text style={styles.bottomText}>
                    {useUnifiedAuth
                      ? 'One mobile number, one account. New users get instant access.'
                      : 'Enter the code to complete your registration.'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    minHeight: '100%',
  },
  // Header Section
  headerSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  topBar: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  backArrow: {
    marginLeft: 0,
    marginTop: 0,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 50,
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
    justifyContent: 'flex-start',
    marginTop: 20,
    position: 'relative',
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 20,
  },
  otpContainer: {
    marginVertical: 18,
    alignItems: 'center',
    position: 'relative',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
  },
  otpInput: {
    width: 36,
    height: 46,
    borderWidth: 2,
    borderColor: '#e3e7ee',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: '#8f5cff',
    backgroundColor: '#f0f6ff',
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  otpInputActive: {
    borderColor: '#8f5cff',
    backgroundColor: '#f0f6ff',
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  otpText: {
    fontSize: 18,
    color: '#1a202c',
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    width: '100%',
    maxWidth: 380,
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
  infoText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  inputSection: {
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
  timerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timerText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    fontWeight: '600',
  },
  timerExpired: {
    color: '#999',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8f5cff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginBottom: 20,
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  resendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  errorText: {
    color: '#dc2626',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 12,
    textAlign: 'left',
    flex: 1,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingText: {
    color: '#0369a1',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 12,
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  bottomText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },

  backendOtpContainer: {
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#4caf50',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backendOtpTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
  backendOtpValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});

export default SignInOtpScreen;
