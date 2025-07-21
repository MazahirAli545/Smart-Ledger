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
import { verifyOtpApi, registerUser } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      if (value && idx < 5) {
        inputRefs.current[idx + 1]?.focus();
      }
      if (!value && idx > 0) {
        inputRefs.current[idx - 1]?.focus();
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
        try {
          await registerUser(registrationData);
        } catch (registerError) {}
        navigation.navigate('SetupWizard');
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
});

export default OtpVerificationScreen;
