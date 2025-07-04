import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Platform, SafeAreaView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CheckBox from '@react-native-community/checkbox';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { registerUser, RegisterPayload, sendOtpApi, verifyOtpApi } from '../../api';
import axios from 'axios';

// Define the navigation param list
type RootStackParamList = {
  SignIn: undefined;
  SetupWizard: undefined;
  CreateAccount: undefined;
};

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');

const businessTypes = [
  'Manufacturing',
  'Proprietorship',
  'Partnership',
  'Private Limited',
  'LLP',
  'Other',
];

const CreateAccountScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [agree, setAgree] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [activeField, setActiveField] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerOtp, setRegisterOtp] = useState<string | null>(null);
  const [backendOtp, setBackendOtp] = useState<string | null>(null);

  // Start timer when OTP is sent
  React.useEffect(() => {
    if (otpSent && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(timer - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [otpSent, timer]);

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    const payload: RegisterPayload = {
      businessName,
      ownerName,
      mobileNumber,
      businessType,
      gstNumber,
    };
    try {
      const response = await sendOtpApi(payload);
      const otpFromBackend = response?.data?.otp !== undefined && response?.data?.otp !== null ? String(response.data.otp) : null;
      setRegisterOtp(otpFromBackend);
      setBackendOtp(otpFromBackend);
      setOtpSent(true);
      setTimer(30);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(typeof err === 'string' ? err : err.message || 'Failed to send OTP');
    }
  };

  const handleResendOtp = () => {
    setTimer(30);
    setOtp('');
  };

  // const handleVerify = async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const verifyResponse = await verifyOtpApi({ mobileNumber, otp });
  //     if (verifyResponse && verifyResponse.code === 200) {
  //       setError(null);
  //       setLoading(false);
  //       navigation.navigate('SetupWizard');
  //     } else if (verifyResponse && verifyResponse.message) {
  //       setError(verifyResponse.message);
  //       setLoading(false);
  //     } else {
  //       setError('Invalid OTP');
  //       setLoading(false);
  //     }
  //   } catch (err: any) {
  //     setLoading(false);
  //     setError(typeof err === 'string' ? err : err.message || 'Invalid OTP');
  //   }
  // };

  // Button enabled only if all required fields are filled and checkbox is checked
 
  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. First verify the OTP
      const verifyResponse = await verifyOtpApi({ mobileNumber, otp });
      
      if (verifyResponse?.code === 200) {
        // 2. Try to register, but don't let registration failure block navigation
        try {
          await registerUser({
            businessName,
            ownerName,
            mobileNumber,
            businessType,
            gstNumber,
          });
        } catch (registerError) {
          console.warn('Registration API returned error but user may have been created:', registerError);
        }
        
        // 3. Navigate to SetupWizard regardless of registration API response
        navigation.navigate('SetupWizard');
      } else {
        setError(verifyResponse?.message || 'Invalid OTP');
      }
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };
 
  const canSendOtp = businessName && ownerName && mobileNumber && businessType && agree && !otpSent;
  const canVerify = businessName && ownerName && mobileNumber && businessType && agree && otpSent && otp.length === 6;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={{flexDirection:'row',alignItems:'center'}} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
            <Text style={styles.backText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
        {/* Logo and App Name */}
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.appName}>Smart Ledger</Text>
        </View>
        {/* Title and Subtitle */}
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>Start your journey to smarter accounting</Text>
        {/* Card Container */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Business Registration</Text>
          <Text style={styles.cardSubtext}>Tell us about your business to get started</Text>
          {/* Business Name */}
          <Text style={styles.label}>Business Name *</Text>
          <TextInput
            style={[styles.input, activeField === 'businessName' && styles.inputActive]}
            placeholder="Enter your business name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('businessName')}
            onBlur={() => setActiveField('')}
          />
          {/* Owner Name */}
          <Text style={styles.label}>Owner Name *</Text>
          <TextInput
            style={[styles.input, activeField === 'ownerName' && styles.inputActive]}
            placeholder="Enter owner's full name"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('ownerName')}
            onBlur={() => setActiveField('')}
          />
          {/* Mobile Number */}
          <Text style={styles.label}>Mobile Number *</Text>
          <TextInput
            style={[styles.input, activeField === 'mobileNumber' && styles.inputActive]}
            placeholder="Enter your mobile number"
            value={mobileNumber}
            onChangeText={setMobileNumber}
            keyboardType="phone-pad"
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('mobileNumber')}
            onBlur={() => setActiveField('')}
          />
          {/* OTP Input (after Send OTP) */}
          {otpSent && (
            <>
              <Text style={styles.label}>Enter OTP *</Text>
              <TextInput
                style={[styles.input, activeField === 'otp' && styles.inputActive]}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor="#8a94a6"
                onFocus={() => setActiveField('otp')}
                onBlur={() => setActiveField('')}
              />
              <Text style={styles.otpInfo}>
                OTP sent to {mobileNumber}  {timer > 0 ? `Resend in ${timer}s` : ''}
                {timer === 0 && (
                  <Text style={styles.resendOtp} onPress={handleResendOtp}>  Resend</Text>
                )}
              </Text>
              {/* Show register API OTP below Resend button for testing */}
              {registerOtp && (
                <Text style={{ color: 'red', fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
                  [Register API OTP: {registerOtp}]
                </Text>
              )}
            </>
          )}
          {/* Business Type */}
          <Text style={styles.label}>Business Type *</Text>
          <View style={[styles.pickerWrapper, activeField === 'businessType' && styles.inputActive]}>
            <Picker
              selectedValue={businessType}
              onValueChange={setBusinessType}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#8a94a6"
              onFocus={() => setActiveField('businessType')}
              onBlur={() => setActiveField('')}
            >
              <Picker.Item label="Select business type" value="" color="#8a94a6" />
              {businessTypes.map((type) => (
                <Picker.Item key={type} label={type} value={type} />
              ))}
            </Picker>
          </View>
          {/* GST Number */}
          <Text style={styles.label}>GST Number (Optional)</Text>
          <TextInput
            style={[styles.input, activeField === 'gstNumber' && styles.inputActive]}
            placeholder="Enter GST number if applicable"
            value={gstNumber}
            onChangeText={setGstNumber}
            placeholderTextColor="#8a94a6"
            onFocus={() => setActiveField('gstNumber')}
            onBlur={() => setActiveField('')}
          />
          {/* Terms and Policy */}
          <View style={styles.termsRow}>
            <CheckBox
              value={agree}
              onValueChange={setAgree}
              tintColors={{ true: '#4f8cff', false: '#b0b8c1' }}
              boxType={Platform.OS === 'ios' ? 'square' : undefined}
              style={styles.checkbox}
            />
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.link}>Terms of Service</Text> and{' '}
              <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>
          {/* Show error message if any */}
          {error && <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>}
          {/* Send OTP / Verify Button */}
          <LinearGradient
            colors={otpSent ? (canVerify ? ['#4f8cff', '#1ecb81'] : ['#dbeafe', '#e0f7ef']) : (canSendOtp ? ['#4f8cff', '#1ecb81'] : ['#dbeafe', '#e0f7ef'])}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <TouchableOpacity
              style={styles.button}
              disabled={otpSent ? !canVerify || loading : !canSendOtp || loading}
              onPress={otpSent ? handleVerify : handleSendOtp}
            >
              <Text style={[styles.buttonText, {opacity: otpSent ? (canVerify ? 1 : 0.5) : (canSendOtp ? 1 : 0.5)}]}>
                {loading ? 'Registering...' : (otpSent ? 'Verify & Create Account' : 'Send OTP')}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.footerLink}>Sign in here</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginLeft: 10,
    marginBottom: 10,
  },
  backArrow: {
    fontSize: 22,
    color: '#222',
    marginRight: 4,
    marginTop: 2,
  },
  backText: {
    fontSize: 15,
    color: '#222',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#7a869a',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#7a869a',
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    color: '#222',
    marginBottom: 4,
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    height: 48,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 2,
    backgroundColor: '#f8fafc',
    fontSize: 15,
    color: '#222',
  },
  inputActive: {
    borderColor: '#222',
    borderWidth: 1.5,
  },
  pickerWrapper: {
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 2,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 52,
    color: '#222',
    fontSize: 15,
    paddingVertical: 0,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },
  pickerItem: {
    height: 52,
    fontSize: 15,
    color: '#222',
    textAlignVertical: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    marginRight: 8,
    width: 20,
    height: 20,
  },
  termsText: {
    fontSize: 13,
    color: '#222',
    flex: 1,
    flexWrap: 'wrap',
  },
  link: {
    color: '#4f8cff',
    textDecorationLine: 'underline',
  },
  gradientButton: {
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  otpInfo: {
    fontSize: 13,
    color: '#7a869a',
    marginBottom: 2,
    marginTop: 2,
  },
  resendOtp: {
    color: '#4f8cff',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  footerText: {
    color: '#7a869a',
    fontSize: 14,
  },
  footerLink: {
    color: '#4f8cff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});

export default CreateAccountScreen;
