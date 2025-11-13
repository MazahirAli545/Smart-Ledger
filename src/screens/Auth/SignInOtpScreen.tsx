import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProperSystemNotificationService from '../../services/properSystemNotificationService';
import { unifiedApi } from '../../api/unifiedApiService';
import { verifyOtp, getCurrentUser } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import messaging from '@react-native-firebase/messaging';
import { navigationRef, ROOT_STACK_APP } from '../../../Navigation';
import { showSignInSuccessNotification } from '../../utils/notificationHelper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
    usePostmanAuth,
  } = route.params as any;
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30); // Reduced for testing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const scrollViewRef = useRef<any>(null);
  const otpInputRefs = useRef<TextInput[]>([]);

  const fetchAndStoreRoles = async (token: string) => {
    try {
      // Use unified API
      const response = (await unifiedApi.get('/rbac/me/roles')) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const roles = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      await AsyncStorage.setItem('userRoles', JSON.stringify(roles));
      console.log(
        '✅ Stored userRoles:',
        Array.isArray(roles) ? roles.map((r: any) => r.name) : roles,
      );
    } catch (e) {
      console.warn('Failed to fetch/store roles:', e);
    }
  };

  const fetchAndStorePermissions = async (token: string) => {
    try {
      // Use unified API
      const perms = await unifiedApi.get('/rbac/me/permissions');
      await AsyncStorage.setItem('userPermissions', JSON.stringify(perms));
      console.log('✅ Stored userPermissions:', perms);
    } catch (e) {
      console.warn('Failed to fetch/store permissions:', e);
    }
  };

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

  const handleOtpChange = (value: string, index: number) => {
    console.log('🔢 OTP Change:', { value, index, currentOtp: otp });

    // Create a fixed 6-length array with current OTP values, using space as placeholder
    const currentOtpArray = (otp || '').split('');
    const otpArray = Array.from({ length: 6 }, (_, i) =>
      currentOtpArray[i] === ' ' ? '' : currentOtpArray[i] || '',
    );

    // Handle empty value (deletion) - use space as placeholder
    if (value === '') {
      otpArray[index] = '';
      const otpString = otpArray
        .map(char => (char === '' ? ' ' : char))
        .join('');
      setOtp(otpString);
      return;
    }

    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // Update OTP array
    otpArray[index] = value;
    const otpString = otpArray.map(char => (char === '' ? ' ' : char)).join('');
    setOtp(otpString);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered (no spaces)
    if (otpString.replace(/\s/g, '').length === 6) {
      setTimeout(() => {
        handleVerify();
      }, 100);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key !== 'Backspace') return;

    const currentOtpArray = (otp || '').split('');
    const otpArray = Array.from({ length: 6 }, (_, i) =>
      currentOtpArray[i] === ' ' ? '' : currentOtpArray[i] || '',
    );

    // If current box has a digit, clear only that digit and keep focus
    if (otpArray[index]) {
      otpArray[index] = '';
      const otpString = otpArray
        .map(char => (char === '' ? ' ' : char))
        .join('');
      setOtp(otpString);
      return;
    }

    // If current box is empty and not the first box, move to previous box and clear it
    if (index > 0) {
      const prevIndex = index - 1;
      otpArray[prevIndex] = '';
      const otpString = otpArray
        .map(char => (char === '' ? ' ' : char))
        .join('');
      setOtp(otpString);
      otpInputRefs.current[prevIndex]?.focus();
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      if (usePostmanAuth) {
        // Use Postman collection endpoint for resend
        console.log('🔄 Resending OTP using Postman collection endpoint...');
        const { sendOtp } = await import('../../api');
        const result = await sendOtp({ phone: phone });

        if (result && (result.otp || result.success)) {
          setTimer(30);
          setOtp('      '); // 6 spaces for empty slots
          setError(null);
          // Focus first input after resending
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
          console.log('✅ OTP resent successfully via Postman collection');
        } else {
          throw new Error(result?.message || 'Failed to resend OTP');
        }
      } else if (useUnifiedAuth) {
        // Resend unified auth OTP
        console.log('🎯 Resending unified auth OTP...');
        // Not supported in backend – fall back to /auth/send-otp
        // Use unified API
        const result = (await unifiedApi.post('/auth/send-otp', { phone })) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const resultData = result.data || result;
        if (resultData?.otp) {
          setTimer(30);
          setOtp('      '); // 6 spaces for empty slots
          setError(null);
          // Focus first input after resending
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
        } else {
          throw new Error(resultData?.message || 'Failed to resend OTP');
        }
      } else if (isExistingUser) {
        // Resend login OTP
        console.log('📱 Resending login OTP...');
        // Use unified API
        const result = (await unifiedApi.post('/auth/send-otp', { phone })) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const resultData = result.data || result;
        if (resultData?.otp) {
          setTimer(30);
          setOtp('      '); // 6 spaces for empty slots
          setError(null);
          // Focus first input after resending
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
        } else {
          throw new Error(resultData?.message || 'Failed to resend OTP');
        }
      } else {
        // Resend registration OTP
        console.log('🆕 Resending registration OTP...');
        // Registration is unified; send OTP only
        // Use unified API
        const result = (await unifiedApi.post('/auth/send-otp', { phone })) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const resultData = result.data || result;
        if (resultData?.otp) {
          setTimer(30);
          setOtp('      '); // 6 spaces for empty slots
          setError(null);
          // Focus first input after resending
          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 100);
        } else {
          throw new Error(resultData?.message || 'Failed to resend OTP');
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
    const cleanOtp = otp.replace(/\s/g, ''); // Remove spaces
    if (cleanOtp.length !== 6) return;
    setLoading(true);
    setError(null);

    console.log('🔍 handleVerify called with usePostmanAuth:', usePostmanAuth);
    console.log('🔍 Current OTP:', cleanOtp);
    console.log('🔍 Phone:', phone);
    console.log('🔍 Backend OTP:', backendOtp);

    try {
      if (usePostmanAuth) {
        // POSTMAN COLLECTION AUTH FLOW - Using /auth/verify-otp endpoint
        console.log('🎯 Using Postman collection auth verification...');

        console.log('🔍 Phone number format check:', {
          originalPhone: phone,
          phoneLength: phone.length,
          phoneStartsWithPlus: phone.startsWith('+'),
          otpLength: otp.length,
          otpValue: otp,
        });

        const result = await verifyOtp({
          phone: phone,
          otp: cleanOtp,
        });

        console.log('🎯 Postman auth verification response:', result);
        console.log('🎯 Response success check:', {
          hasResult: !!result,
          hasSuccess: !!result?.success,
          hasAccessToken: !!result?.accessToken,
          hasAccessTokenUnderscore: !!result?.access_token,
          resultKeys: result ? Object.keys(result) : 'no result',
        });

        if (
          result &&
          (result.success || result.accessToken || result.access_token)
        ) {
          console.log('✅ Postman auth successful!');
          console.log(
            '🎯 User type:',
            result.isNewUser ? 'NEW USER' : 'EXISTING USER',
          );

          // Store tokens
          const token = result.accessToken || result.access_token;
          if (token) {
            await AsyncStorage.setItem('accessToken', token);
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
            await AsyncStorage.setItem('accessToken', token);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Initialize notifications and register FCM token for new user
            try {
              const proper = ProperSystemNotificationService.getInstance();
              await proper.initializeNotifications();
              // Get FCM token - initializeNotifications() should have fetched it,
              // but refresh if needed to ensure we have it
              let fcmToken = proper.getCurrentFCMToken();
              if (!fcmToken) {
                fcmToken = await proper.refreshFCMToken();
              }
              if (fcmToken) {
                console.log(
                  '🔔 Registering FCM token for new user:',
                  fcmToken.substring(0, 20) + '...',
                );
                console.log(
                  '🔔 API URL:',
                  // Use unified API
                  '/notifications/register-token',
                );
                console.log('🔔 Authorization token length:', token.length);
                console.log('🔔 Request body:', {
                  token: fcmToken.substring(0, 20) + '...',
                  deviceType: Platform.OS,
                });

                // Use unified API
                const fcmResponse = (await unifiedApi.post(
                  '/notifications/register-token',
                  {
                    token: fcmToken,
                    deviceType: Platform.OS,
                  },
                )) as { data: any; status: number; headers: Headers };
                // unifiedApi returns { data, status, headers } structure
                if (fcmResponse.status >= 200 && fcmResponse.status < 300) {
                  const fcmResult = fcmResponse.data || fcmResponse;
                  console.log('🔔 FCM Response:', fcmResult);
                  console.log(
                    '✅ FCM token registered for new user:',
                    fcmResult,
                  );
                } else {
                  const errorText = fcmResponse.data;
                  console.warn(
                    '⚠️ FCM token registration failed for new user:',
                    fcmResponse.status,
                  );
                  console.warn('⚠️ Error response:', errorText);
                }
              } else {
                console.warn(
                  '⚠️ No FCM token available for new user (likely emulator)',
                );
              }
            } catch (fcmError) {
              console.error(
                'Failed to register FCM token for new user:',
                fcmError,
              );
            }

            // Call login first to update auth context, then navigate
            await login(token, null, true);

            // Fetch and log user profile
            try {
              const profile = await getCurrentUser(token);
              console.log('👤 Logged-in user profile:', profile);
            } catch (e) {
              console.warn('⚠️ Failed to fetch user profile after signup:', e);
            }

            // Fetch and store RBAC roles/permissions for gated screens
            await fetchAndStoreRoles(token);
            await fetchAndStorePermissions(token);

            // Show account creation success notification with name if available
            try {
              console.log('🔔 Showing NEW USER notification...');
              const profileForNotif = await getCurrentUser(token).catch(
                () => null,
              );
              const displayNameForNotif =
                profileForNotif?.ownerName ||
                profileForNotif?.businessName ||
                undefined;
              console.log(
                '🔔 Display name for notification:',
                displayNameForNotif,
              );
              await showSignInSuccessNotification(displayNameForNotif, true);
              console.log('✅ NEW USER notification sent successfully');
            } catch (notificationError) {
              console.error(
                '❌ Failed to show NEW USER notification:',
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
            await AsyncStorage.setItem('accessToken', token);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Initialize notifications and register FCM token for existing user
            try {
              const proper = ProperSystemNotificationService.getInstance();
              await proper.initializeNotifications();
              // Get FCM token - initializeNotifications() should have fetched it,
              // but refresh if needed to ensure we have it
              let fcmToken = proper.getCurrentFCMToken();
              if (!fcmToken) {
                fcmToken = await proper.refreshFCMToken();
              }
              if (fcmToken) {
                console.log(
                  '🔔 Registering FCM token for existing user:',
                  fcmToken.substring(0, 20) + '...',
                );
                console.log(
                  '🔔 API URL:',
                  // Use unified API
                  '/notifications/register-token',
                );
                console.log('🔔 Authorization token length:', token.length);
                console.log('🔔 Request body:', {
                  token: fcmToken.substring(0, 20) + '...',
                  deviceType: Platform.OS,
                });

                const fcmResponse = (await unifiedApi.post(
                  '/notifications/register-token',
                  {
                    token: fcmToken,
                    deviceType: Platform.OS,
                  },
                )) as { data: any; status: number; headers: Headers };

                // unifiedApi returns { data, status, headers } structure
                console.log('🔔 FCM Response status:', fcmResponse.status);
                // Safely log headers - headers might be undefined or not have entries() method
                if (fcmResponse.headers) {
                  try {
                    // Check if headers has entries method (browser) or is a plain object (React Native)
                    if (typeof fcmResponse.headers.entries === 'function') {
                      console.log(
                        '🔔 FCM Response headers:',
                        Object.fromEntries(fcmResponse.headers.entries()),
                      );
                    } else if (typeof fcmResponse.headers === 'object') {
                      // React Native might return headers as a plain object
                      console.log(
                        '🔔 FCM Response headers:',
                        fcmResponse.headers,
                      );
                    }
                  } catch (e) {
                    console.log('🔔 FCM Response headers: (unable to log)', e);
                  }
                }

                // unifiedApi returns { data, status, headers } structure
                if (fcmResponse.status >= 200 && fcmResponse.status < 300) {
                  const fcmResult = fcmResponse.data || fcmResponse;
                  console.log(
                    '✅ FCM token registered for existing user:',
                    fcmResult,
                  );
                } else {
                  const errorText = fcmResponse.data;
                  console.warn(
                    '⚠️ FCM token registration failed for existing user:',
                    fcmResponse.status,
                  );
                  console.warn('⚠️ Error response:', errorText);
                }
              } else {
                console.warn(
                  '⚠️ No FCM token available for existing user (likely emulator)',
                );
              }
            } catch (fcmError) {
              console.error(
                'Failed to register FCM token for existing user:',
                fcmError,
              );
            }

            // Call login first to update auth context, then navigate
            await login(token, null, true);

            // Fetch and log user profile
            try {
              const profile = await getCurrentUser(token);
              console.log('👤 Logged-in user profile:', profile);
            } catch (e) {
              console.warn('⚠️ Failed to fetch user profile after login:', e);
            }

            // Show welcome back notification for existing user
            try {
              console.log('🔔 Showing EXISTING USER notification...');
              const profileForNotif = await getCurrentUser(token).catch(
                () => null,
              );
              const displayNameForNotif =
                profileForNotif?.ownerName ||
                profileForNotif?.businessName ||
                undefined;
              console.log(
                '🔔 Display name for notification:',
                displayNameForNotif,
              );
              await showSignInSuccessNotification(displayNameForNotif, false);
              console.log('✅ EXISTING USER notification sent successfully');
            } catch (notificationError) {
              console.error(
                '❌ Failed to show EXISTING USER notification:',
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
          }
        } else {
          console.error('❌ Postman auth verification failed:', {
            result: result,
            hasSuccess: !!result?.success,
            hasAccessToken: !!result?.accessToken,
            message: result?.message,
          });
          setError(
            result?.message ||
              'OTP verification failed. Please check the console for details.',
          );
        }
      } else {
        // LEGACY FLOW - Handle existing vs new user logic
        if (isExistingUser) {
          // EXISTING USER - Login flow
          console.log('📱 Verifying login OTP for existing user...');

          // Use unified API
          const result = (await unifiedApi.post('/auth/verify-otp', {
            phone,
            otp,
          })) as { data: any; status: number; headers: Headers };
          const resultData = result.data || result;
          console.log('📱 Login verification response:', resultData);

          if (resultData?.success) {
            const verifiedMobile =
              resultData.data?.mobileNumber || resultData.mobileNumber || phone;
            await AsyncStorage.setItem('userMobileNumber', verifiedMobile);
            if (resultData.accessToken != null) {
              await AsyncStorage.setItem('accessToken', resultData.accessToken);

              // Initialize notifications and register FCM token after successful login
              try {
                console.log(
                  '🔔 LEGACY FLOW (EXISTING USER) - Initializing notifications and registering FCM token...',
                );
                const proper = ProperSystemNotificationService.getInstance();
                const initialized = await proper.initializeNotifications();

                if (initialized) {
                  // Get FCM token and ensure it's registered
                  const fcmToken = await proper.getFCMToken();
                  if (fcmToken) {
                    console.log(
                      '✅ LEGACY FLOW (EXISTING USER) - FCM token obtained, registering with backend...',
                    );
                    // Ensure token is registered - refreshFCMToken will re-register it
                    await proper.refreshFCMToken();
                  } else {
                    console.warn(
                      '⚠️ LEGACY FLOW (EXISTING USER) - No FCM token available',
                    );
                  }
                } else {
                  // If initialization failed, try direct registration
                  console.log(
                    '⚠️ LEGACY FLOW (EXISTING USER) - Initialization failed, trying direct FCM token registration...',
                  );
                  try {
                    const fcmToken = await messaging().getToken();
                    if (fcmToken && resultData.accessToken) {
                      // Use unified API
                      await unifiedApi.post('/notifications/register-token', {
                        token: fcmToken,
                        deviceType: Platform.OS,
                      });
                      console.log(
                        '✅ LEGACY FLOW (EXISTING USER) - FCM token registered directly',
                      );
                    }
                  } catch (directError) {
                    console.error(
                      '❌ LEGACY FLOW (EXISTING USER) - Direct FCM token registration failed:',
                      directError,
                    );
                  }
                }
              } catch (fcmError) {
                console.error(
                  '❌ LEGACY FLOW (EXISTING USER) - Failed to register FCM token:',
                  fcmError,
                );
              }
            } else {
              await AsyncStorage.removeItem('accessToken');
            }
            if (resultData.refreshToken != null) {
              await AsyncStorage.setItem(
                'refreshToken',
                resultData.refreshToken,
              );
            } else {
              await AsyncStorage.removeItem('refreshToken');
            }
            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', resultData.accessToken);
            if (resultData.refreshToken) {
              await AsyncStorage.setItem(
                'refreshToken',
                resultData.refreshToken,
              );
            }
            await AsyncStorage.setItem('userMobileNumber', verifiedMobile);

            // Call login first to update auth context, then navigate
            await login(resultData.accessToken, resultData.refreshToken, true);

            // Fetch and log user profile
            try {
              const profile = await getCurrentUser(resultData.accessToken);
              console.log('👤 Logged-in user profile:', profile);
            } catch (e) {
              console.warn('⚠️ Failed to fetch user profile after login:', e);
            }

            // Fetch and store RBAC roles/permissions for gated screens
            await fetchAndStoreRoles(resultData.accessToken);
            await fetchAndStorePermissions(resultData.accessToken);

            // Set Customer as default screen and save current position
            await setDefaultScreen('Customer');
            await saveCurrentScreen('Customer');

            // Navigate to CustomerScreen after login
            navigation.navigate('App', {
              screen: 'AppStack',
              params: { screen: 'Customer' },
            });
          } else {
            setError(resultData.message || 'Invalid OTP');
          }
        } else {
          // NEW USER - Registration flow
          console.log('🆕 Verifying registration OTP for new user...');
          console.log('🆕 Registration data:', registrationData);

          // Use unified API
          const result = (await unifiedApi.post('/auth/verify-otp', {
            phone,
            otp: cleanOtp,
          })) as { data: any; status: number; headers: Headers };
          const resultData = result.data || result;
          console.log('🆕 Registration verification response:', resultData);

          if (resultData?.success) {
            console.log('✅ Registration OTP verified successfully!');

            // Store tokens first, then navigate to CustomerScreen
            await AsyncStorage.setItem('accessToken', resultData.accessToken);
            await AsyncStorage.setItem('userMobileNumber', phone);

            // Call login first to update auth context, then navigate
            console.log('🔐 Calling login function for new user with:', {
              token: resultData.accessToken,
              refreshToken: null,
              profileComplete: true,
            });
            await login(resultData.accessToken, null, true);

            // Ensure notifications are initialized and FCM token is registered after login
            try {
              console.log(
                '🔔 LEGACY FLOW - Initializing notifications and registering FCM token...',
              );
              const proper = ProperSystemNotificationService.getInstance();
              const initialized = await proper.initializeNotifications();

              if (initialized) {
                // Get FCM token and ensure it's registered
                const fcmToken = await proper.getFCMToken();
                if (fcmToken) {
                  console.log(
                    '✅ LEGACY FLOW - FCM token obtained, registering with backend...',
                  );
                  // Ensure token is registered - refreshFCMToken will re-register it
                  await proper.refreshFCMToken();
                } else {
                  console.warn('⚠️ LEGACY FLOW - No FCM token available');
                }
              } else {
                // If initialization failed, try direct registration
                console.log(
                  '⚠️ LEGACY FLOW - Initialization failed, trying direct FCM token registration...',
                );
                try {
                  const fcmToken = await messaging().getToken();
                  if (fcmToken && resultData.accessToken) {
                    // Use unified API
                    await unifiedApi.post('/notifications/register-token', {
                      token: fcmToken,
                      deviceType: Platform.OS,
                    });
                    console.log(
                      '✅ LEGACY FLOW - FCM token registered directly',
                    );
                  }
                } catch (directError) {
                  console.error(
                    '❌ LEGACY FLOW - Direct FCM token registration failed:',
                    directError,
                  );
                }
              }
            } catch (notifError) {
              console.error(
                '❌ LEGACY FLOW - Notification initialization failed:',
                notifError,
              );
            }

            // Fetch and log user profile
            try {
              const profile = await getCurrentUser(resultData.accessToken);
              console.log('👤 Logged-in user profile:', profile);
            } catch (e) {
              console.warn('⚠️ Failed to fetch user profile after signup:', e);
            }
            console.log(
              '✅ Login function completed successfully for new user',
            );

            // Fetch and store RBAC roles/permissions for gated screens
            await fetchAndStoreRoles(resultData.accessToken);
            await fetchAndStorePermissions(resultData.accessToken);

            // Show account creation success notification with name if available
            try {
              console.log('🔔 LEGACY FLOW - Showing NEW USER notification...');
              const profile = await getCurrentUser(
                resultData.accessToken,
              ).catch(() => null);
              const displayName =
                profile?.ownerName || profile?.businessName || undefined;
              console.log('🔔 LEGACY FLOW - Display name:', displayName);
              await showSignInSuccessNotification(displayName, true);
              console.log(
                '✅ LEGACY FLOW - NEW USER notification sent successfully',
              );
            } catch (notificationError) {
              console.error(
                '❌ LEGACY FLOW - Failed to show NEW USER notification:',
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
            setError(
              resultData.message || 'Registration OTP verification failed',
            );
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
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid
          enableAutomaticScroll={true}
          extraScrollHeight={80}
          extraHeight={100}
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={26} color="#2d3748" />
            </TouchableOpacity>

            {/* Header Section */}
            <View style={styles.headerSection}>
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
                          <TextInput
                            key={index}
                            ref={ref => {
                              if (ref) {
                                otpInputRefs.current[index] = ref;
                              }
                            }}
                            style={[
                              styles.otpInput,
                              otp[index] &&
                                otp[index] !== ' ' &&
                                styles.otpInputFilled,
                            ]}
                            value={otp[index] === ' ' ? '' : otp[index] || ''}
                            onChangeText={value =>
                              handleOtpChange(value, index)
                            }
                            onKeyPress={({ nativeEvent }) =>
                              handleKeyPress(nativeEvent.key, index)
                            }
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            autoFocus={index === 0}
                            selectTextOnFocus={true}
                            autoComplete="sms-otp"
                            showSoftInputOnFocus={true}
                            blurOnSubmit={false}
                            returnKeyType="next"
                            onSubmitEditing={() => {
                              if (index < 5) {
                                otpInputRefs.current[index + 1]?.focus();
                              }
                            }}
                          />
                        ))}
                      </View>
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
                      <LinearGradient
                        colors={['#6366f1', '#4f46e5', '#4338ca']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.resendButton}
                      >
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 24,
                            paddingVertical: 14,
                          }}
                          onPress={handleResend}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="refresh" size={20} color="#ffffff" />
                          <Text style={styles.resendText}>Resend OTP</Text>
                        </TouchableOpacity>
                      </LinearGradient>
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

                  {/* Test buttons removed for production */}
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
        </KeyboardAwareScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // Header Section
  headerSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 15,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 15,
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
    justifyContent: 'flex-start',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 17,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },

  otpContainer: {
    marginVertical: 18,
    alignItems: 'center',
    position: 'relative',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  otpInput: {
    width: 44,
    height: 56,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fafbfc',
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    fontSize: 20,
    color: '#0f172a',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: '#6366f1',
    backgroundColor: '#f0f6ff',
    shadowColor: '#6366f1',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
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

  inputSection: {
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
    backgroundColor: '#fafbfc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  timerText: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 8,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  timerExpired: {
    color: '#94a3b8',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },
  resendButton: {
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  resendText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 8,
    letterSpacing: 0.5,
    fontWeight: '700',
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
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
    fontSize: 14,
    marginLeft: 12,
    textAlign: 'left',
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
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
    fontSize: 14,
    marginLeft: 12,
    fontFamily: 'Roboto-Medium',
  },

  footerSection: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
  },
  bottomText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'Roboto-Medium',
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
    color: '#2e7d32',
    fontFamily: 'Roboto-Medium',
    fontWeight: '700',
  },

  backendOtpValue: {
    fontSize: 18,
    color: '#1b5e20',
    fontFamily: 'Roboto-Bold',
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Test button styles
  // Test styles removed
});

export default SignInOtpScreen;
