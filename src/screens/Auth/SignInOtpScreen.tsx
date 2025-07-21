import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { useAuth } from '../../context/AuthContext';

const SignInOtpScreen = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute();
  const { phone, backendOtp, callingCode, countryCode } = route.params as any;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtp, setShowOtp] = useState(true);
  const [userNotFoundPopup, setUserNotFoundPopup] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const { login } = useAuth();

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  useEffect(() => {
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
      if (value && idx < 5) {
        inputRefs.current[idx + 1]?.focus();
      }
      if (!value && idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/user/login/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: phone }),
      });
      const result = await response.json();
      if (response.ok && result.otp) {
        setTimer(30);
        setOtp(['', '', '', '', '', '']);
        setError(null);
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
    if (otp.join('').length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/user/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber: phone,
          otp: otp.join(''),
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        const verifiedMobile = result.data?.mobileNumber || phone;
        await AsyncStorage.setItem('userMobileNumber', verifiedMobile);
        if (result.accessToken != null) {
          await AsyncStorage.setItem('accessToken', result.accessToken);
        } else {
          await AsyncStorage.removeItem('accessToken');
        }
        if (result.refreshToken != null) {
          await AsyncStorage.setItem('refreshToken', result.refreshToken);
        } else {
          await AsyncStorage.removeItem('refreshToken');
        }
        if (typeof result.data?.profileComplete === 'boolean') {
          if (!result.data.profileComplete) {
            Alert.alert('Profile Incomplete', 'Please complete your profile.');
            navigation.navigate('SetupWizard');
          } else {
            await login(result.accessToken, result.refreshToken, true);
            navigation.navigate('App', { screen: 'Dashboard' });
          }
        } else {
          await login(result.accessToken, result.refreshToken, true);
          navigation.navigate('App', { screen: 'Dashboard' });
        }
      } else {
        if ((result.message || '').toLowerCase().includes('user not found')) {
          setUserNotFoundPopup(true);
        } else {
          setError(result.message || 'Invalid OTP');
        }
      }
    } catch (err: any) {
      if ((err.message || '').toLowerCase().includes('user not found')) {
        setUserNotFoundPopup(true);
      } else {
        setError(err.message || 'Failed to verify OTP');
      }
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
        <Ionicons
          name="chatbox-ellipses-outline"
          size={44}
          color="#4f8cff"
          style={{ marginBottom: 8 }}
        />
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          A 6-digit verification code has been sent on {maskedPhone}
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
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={idx === 0}
              returnKeyType="next"
            />
          ))}
        </View>
        <Text style={styles.timerText}>
          <Ionicons name="time-outline" size={18} color="#222" />{' '}
          {timer > 0 ? `0:${timer.toString().padStart(2, '0')}` : '0:00'}
        </Text>
        {timer === 0 && (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
        {showOtp && backendOtp && (
          <Text style={styles.backendOtp}>[Backend OTP: {backendOtp}]</Text>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {loading && <Text style={styles.loadingText}>Verifying...</Text>}
      </View>
      <Modal
        visible={userNotFoundPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setUserNotFoundPopup(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContainer}>
            <Text style={styles.popupTitle}>User Not Found</Text>
            <Text style={styles.popupMessage}>
              The entered phone number is not registered.
            </Text>
            <TouchableOpacity
              style={styles.popupButton}
              onPress={() => setUserNotFoundPopup(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.popupButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    color: '#222',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  },
  otpInputFilled: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  timerText: {
    fontSize: 16,
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  resendText: {
    color: '#4f8cff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'center',
  },
  backendOtp: {
    color: 'red',
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingText: {
    color: '#4f8cff',
    marginTop: 8,
    textAlign: 'center',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    width: 300,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10,
    textAlign: 'center',
  },
  popupMessage: {
    fontSize: 15,
    color: '#444',
    marginBottom: 18,
    textAlign: 'center',
  },
  popupButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  popupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SignInOtpScreen;
