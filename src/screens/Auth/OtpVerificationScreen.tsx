import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { verifyOtpApi, registerUser, BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import ProperSystemNotificationService from '../../services/properSystemNotificationService';
import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  showAccountCreatedNotification,
  showTestNotification,
} from '../../utils/notificationHelper';
// import {
//   testSimpleNotification,
//   testNotificationWithChannel,
//   testNotificationPermissions,
// } from '../../utils/simpleNotificationTest';

// Use any for now, or import the correct AuthStackParamList if available
const OtpVerificationScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { phone, backendOtp, registrationData } = route.params as any;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtp, setShowOtp] = useState(true);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  useEffect(() => {
    // Auto-verify when 6 digits are entered
    if (otp.join('').length === 6) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleOtpChange = (value: string, idx: number) => {
    if (/^\d?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[idx] = value;
      setOtp(newOtp);

      // Move to next input if digit entered
      if (value && idx < 5) {
        setTimeout(() => {
          inputRefs.current[idx + 1]?.focus();
        }, 50);
      }
    }
  };

  const handleOtpKeyPress = (e: any, idx: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace') {
      if (otp[idx] === '') {
        // If current field is empty, go to previous field and clear it
        if (idx > 0) {
          const newOtp = [...otp];
          newOtp[idx - 1] = '';
          setOtp(newOtp);
          setTimeout(() => {
            inputRefs.current[idx - 1]?.focus();
          }, 50);
        }
      } else {
        // If current field has value, clear it
        const newOtp = [...otp];
        newOtp[idx] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleResend = () => {
    setTimer(30);
    setOtp(['', '', '', '', '', '']);
    setError(null);
    // Optionally, trigger resend OTP API here
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const verifyResponse = await verifyOtpApi({
        mobileNumber: phone,
        otp: otp.join(''),
      });

      if (verifyResponse?.code === 200) {
        try {
          await AsyncStorage.setItem('userMobileNumber', phone);
        } catch (storageError) {}
        // Try to register user (but don't block the flow if it fails)
        let registrationSuccess = false;
        try {
          await registerUser(registrationData);
          registrationSuccess = true;
        } catch (registerError) {
          // Registration failed, but continue with the flow
          console.log('Note: User registration API unavailable, continuing...');
          registrationSuccess = false;
        }

        // Show success notification after OTP verification
        try {
          await showAccountCreatedNotification();
        } catch (notificationError) {
          // Fallback to basic notification if custom one fails
          try {
            await notifee.displayNotification({
              title: 'Account Created Successfully! 🎉',
              body: 'Welcome to the app!',
            });
          } catch (fallbackError) {
            // Silent fail - notification is not critical
          }
        }

        // Register FCM token if registration was successful
        if (registrationSuccess) {
          try {
            const fcmToken = await messaging().getToken();
            if (fcmToken) {
              const accessToken = await AsyncStorage.getItem('accessToken');
              if (accessToken) {
                await fetch(`${BASE_URL}/notifications/register-token`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    token: fcmToken,
                    deviceType: Platform.OS,
                  }),
                });
              }
            }
          } catch (fcmError) {
            console.error('Failed to register FCM token:', fcmError);
          }
        }

        // Small delay to let notification show before navigating
        setTimeout(() => {
          navigation.navigate('SetupWizard');
        }, 1500);
      } else {
        setError(verifyResponse?.message || 'Invalid OTP');
      }
    } catch (err: any) {
      setError(
        typeof err === 'string'
          ? err
          : err.message || 'OTP verification failed',
      );
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 **** $3');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={32} color="#222" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <Ionicons name="chatbox-ellipses-outline" size={32} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          A 6-digit verification code has been sent on{' '}
          <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
        </Text>
        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={ref => {
                inputRefs.current[idx] = ref;
              }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={val => handleOtpChange(val, idx)}
              onKeyPress={e => handleOtpKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={idx === 0}
              returnKeyType="next"
              selectTextOnFocus={true}
              selectionColor="#4f8cff"
            />
          ))}
        </View>
        <View style={styles.timerContainer}>
          <Ionicons
            name="time-outline"
            size={20}
            color={timer > 0 ? '#666' : '#999'}
          />
          <Text style={[styles.timerText, timer === 0 && styles.timerExpired]}>
            {timer > 0 ? `0:${timer.toString().padStart(2, '0')}` : '0:00'}
          </Text>
        </View>

        {timer === 0 && (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color="#4f8cff" />
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}

        {showOtp && backendOtp && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>[Backend OTP: {backendOtp}]</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={20} color="#dc3545" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#4f8cff"
            />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 10,
    marginTop: Platform.OS === 'android' ? 12 : 0,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#7a869a',
    textAlign: 'center',
    marginBottom: 18,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 18,
  },
  otpInput: {
    width: 44,
    height: 54,
    borderWidth: 2,
    borderColor: '#e3e7ee',
    borderRadius: 10,
    marginHorizontal: 6,
    fontSize: 22,
    color: '#000',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
    fontWeight: '600',
  },
  otpInputFilled: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  phoneHighlight: {
    color: '#4f8cff',
    fontWeight: '600',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
    backgroundColor: '#4f8cff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginBottom: 20,
    shadowColor: '#4f8cff',
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
  debugContainer: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  debugText: {
    color: '#856404',
    fontWeight: '500',
    fontSize: 13,
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
    shadowColor: '#4f8cff',
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
});

export default OtpVerificationScreen;
