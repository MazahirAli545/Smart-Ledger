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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BASE_URL } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

// Define the navigation param list
type RootStackParamList = {
  SignIn: undefined;
  SetupWizard: undefined;
  CreateAccount: undefined;
  Dashboard: undefined;
};

const SignInScreen: React.FC = () => {
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
    }
  };

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
    backgroundColor: '#f6fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
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
    width: '92%',
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
    backgroundColor: 'transparent',
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
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
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default SignInScreen;
