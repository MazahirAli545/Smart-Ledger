import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboarding } from '../../context/OnboardingContext';
import { BASE_URL, onboardingUser } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const CHECK_ICON = 'https://img.icons8.com/color/96/26e07f/ok--v1.png';

const goals = [
  'Track business finances',
  'Automate accounting',
  'GST compliance',
  'Generate reports',
  'Other',
];

type RootStackParamList = {
  BankDetailsScreen: undefined;
  Dashboard: undefined;
  SignIn: undefined;
  // ... other screens if needed
};

const FinalStepScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { data, setData } = useOnboarding();
  const [goal, setGoal] = useState(data.primaryGoal || '');
  const [challenges, setChallenges] = useState(data.currentChallenges || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);

  useEffect(() => {
    // Set initial values from context
    if (data.primaryGoal) setGoal(data.primaryGoal);
    if (data.currentChallenges) setChallenges(data.currentChallenges);

    // Check for mobile number in context first
    if (data.mobileNumber) {
      setMobileNumber(data.mobileNumber);
    } else {
      // Try to get mobile number from AsyncStorage
      const getMobileNumber = async () => {
        try {
          const storedMobileNumber = await AsyncStorage.getItem(
            'userMobileNumber',
          );
          if (storedMobileNumber) {
            setMobileNumber(storedMobileNumber);
            setData(prev => ({ ...prev, mobileNumber: storedMobileNumber }));
            console.log(
              'Mobile number retrieved from AsyncStorage:',
              storedMobileNumber,
            );
          } else {
            console.log('No mobile number found in AsyncStorage');
          }
        } catch (error) {
          console.error('Error retrieving mobile number:', error);
        }
      };

      getMobileNumber();
    }
  }, [data, setData]);

  const handleGoalChange = (selectedGoal: string) => {
    setGoal(selectedGoal);
    setData(prev => ({ ...prev, primaryGoal: selectedGoal }));
  };

  const handleChallengesChange = (text: string) => {
    setChallenges(text);
    setData(prev => ({ ...prev, currentChallenges: text }));
  };

  const handleCompleteSetup = async () => {
    if (!goal) {
      Alert.alert('Required', 'Please select your primary goal');
      return;
    }

    setLoading(true);
    setError(null);

    // Check if we have a mobile number
    if (!mobileNumber && !data.mobileNumber) {
      try {
        const storedMobileNumber = await AsyncStorage.getItem(
          'userMobileNumber',
        );
        if (storedMobileNumber) {
          setMobileNumber(storedMobileNumber);
          setData(prev => ({ ...prev, mobileNumber: storedMobileNumber }));
        } else {
          setLoading(false);
          Alert.alert(
            'Error',
            'Mobile number is not verified. Please restart the registration process.',
          );
          return;
        }
      } catch (error) {
        console.error('Error retrieving mobile number:', error);
        setLoading(false);
        Alert.alert(
          'Error',
          'Could not verify mobile number. Please restart the registration process.',
        );
        return;
      }
    }

    // Use the mobile number we have
    const finalMobileNumber = mobileNumber || data.mobileNumber; // Fallback to example number if all else fails

    // Create a base payload with the required mobile number
    const basePayload: Record<string, any> = {
      mobileNumber: finalMobileNumber,
    };

    // Only add fields that have actual values
    if (data.businessSize) basePayload.businessSize = data.businessSize;
    if (data.industry) basePayload.industry = data.industry;
    if (data.monthlyTransactionVolume)
      basePayload.monthlyTransactionVolume = data.monthlyTransactionVolume;
    if (data.currentAccountingSoftware)
      basePayload.currentAccountingSoftware = data.currentAccountingSoftware;
    if (data.teamSize) basePayload.teamSize = data.teamSize;
    if (data.preferredLanguage)
      basePayload.preferredLanguage = data.preferredLanguage;

    // Handle features array properly
    if (data.features && data.features.length > 0) {
      basePayload.features = data.features;
    }

    // Add bank details if available
    if (data.bankName) basePayload.bankName = data.bankName;
    if (data.accountNumber) basePayload.accountNumber = data.accountNumber;
    if (data.ifscCode) basePayload.ifscCode = data.ifscCode;

    // Add data from this screen
    if (goal) basePayload.primaryGoal = goal;
    if (challenges) basePayload.currentChallenges = challenges;

    console.log('Onboarding payload:', basePayload);

    try {
      // Use direct fetch for more control over the request
      const response = await fetch(`${BASE_URL}/user/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(basePayload),
      });

      const result = await response.json();
      console.log('API response:', result);

      if (response.ok && result.code === 200) {
        // Save tokens to AsyncStorage
        if (result.accessToken) {
          await AsyncStorage.setItem('accessToken', result.accessToken);
        }
        if (result.refreshToken) {
          await AsyncStorage.setItem('refreshToken', result.refreshToken);
        }

        // Handle successful onboarding
        Alert.alert('Success', 'Onboarding completed successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('SignIn') },
        ]);
      } else {
        throw new Error(result?.message || 'Onboarding failed');
      }
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message || 'Failed to complete onboarding');
      Alert.alert('Error', err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Logo and App Name */}
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.appName}>Smart Ledger</Text>
        </View>
        {/* Setup Wizard Badge */}
        <View style={styles.badgeRow}>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.setupBadge}
          >
            <Text style={styles.setupBadgeText}>Setup Wizard</Text>
          </LinearGradient>
        </View>
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Step 5 of 5</Text>
          <Text style={styles.progressTextRight}>100% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: CHECK_ICON }} style={styles.checkIcon} />
          <Text style={styles.cardHeading}>Almost Done!</Text>
          <Text style={styles.cardSubtext}>
            Tell us about your goals and challenges
          </Text>
          {/* Mobile Number Status */}
          <View style={styles.mobileStatusContainer}>
            <Text style={styles.mobileStatusLabel}>
              Mobile Number:{' '}
              <Text style={styles.mobileStatusValue}>
                {mobileNumber || data.mobileNumber || 'Not verified'}
              </Text>
            </Text>
          </View>
          {/* Primary Goal Dropdown */}
          <Text style={styles.label}>Primary Goal with Smart Ledger</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={goal}
              onValueChange={handleGoalChange}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              dropdownIconColor="#8a94a6"
            >
              <Picker.Item
                label="What's your main goal?"
                value=""
                color="#8a94a6"
              />
              {goals.map(g => (
                <Picker.Item key={g} label={g} value={g} />
              ))}
            </Picker>
          </View>
          {/* Current Challenges */}
          <Text style={styles.label}>Current Challenges (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us about any accounting challenges you face..."
            value={challenges}
            onChangeText={handleChallengesChange}
            placeholderTextColor="#8a94a6"
            multiline
            numberOfLines={4}
          />
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🎉 You're all set!</Text>
            <Text style={styles.infoText}>
              Based on your preferences, we've customized Smart Ledger for your
              business. You'll have access to:
            </Text>
            <Text style={styles.bullet}>
              • Voice input in your preferred language
            </Text>
            <Text style={styles.bullet}>
              • Industry-specific transaction categories
            </Text>
            <Text style={styles.bullet}>
              • Customized dashboard for your business size
            </Text>
            <Text style={styles.bullet}>• GST compliance tools</Text>
          </View>
          {/* Error Display */}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => navigation.navigate('BankDetailsScreen')}
            >
              <Text style={styles.prevButtonText}>{'\u2190'} Previous</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={['#4f8cff', '#1ecb81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleCompleteSetup}
                disabled={loading}
              >
                <Text style={styles.nextButtonText}>
                  {loading ? 'Processing...' : 'Complete Setup \u2192'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
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
  badgeRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  setupBadge: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.2,
    shadowColor: '#2563eb33',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  setupBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 2,
  },
  progressText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '500',
  },
  progressTextRight: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e3e7ee',
    borderRadius: 4,
    marginHorizontal: 24,
    marginBottom: 18,
  },
  progressBarFill: {
    height: 6,
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 4,
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
  },
  checkIcon: {
    width: 64,
    height: 64,
    marginBottom: 14,
    alignSelf: 'center',
  },
  cardHeading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtext: {
    fontSize: 15,
    color: '#7a869a',
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '400',
  },
  mobileStatusContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  mobileStatusLabel: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  mobileStatusValue: {
    fontWeight: 'bold',
  },
  label: {
    fontSize: 15,
    color: '#222',
    marginBottom: 6,
    marginTop: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  pickerWrapper: {
    width: '100%',
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
    height: 56,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 56,
    color: '#222',
  },
  pickerItem: {
    fontSize: 14,
    color: '#222',
  },
  textArea: {
    width: '100%',
    minHeight: 64,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#222',
    textAlignVertical: 'top',
  },
  infoBox: {
    backgroundColor: '#eaffea',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#b7f7b7',
  },
  infoTitle: {
    fontSize: 15,
    color: '#1ecb81',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 13,
    color: '#222',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 13,
    color: '#222',
    marginLeft: 8,
    marginBottom: 2,
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  prevButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flex: 1,
    marginRight: 8,
  },
  prevButtonText: {
    color: '#222',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gradientButton: {
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  nextButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    width: '100%',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default FinalStepScreen;
