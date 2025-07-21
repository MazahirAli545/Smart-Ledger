import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOnboarding } from '../../context/OnboardingContext';
import { RootStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const MIC_ICON = 'https://img.icons8.com/ios-filled/100/9b5de5/microphone.png'; // Placeholder purple mic icon
const VOICE_ICON = 'https://img.icons8.com/ios-filled/24/9b5de5/microphone.png';
const OCR_ICON = 'https://img.icons8.com/ios-filled/24/9b5de5/camera--v1.png';
const WHATSAPP_ICON =
  'https://img.icons8.com/ios-filled/24/9b5de5/whatsapp.png';
const CHECK_ICON = 'https://img.icons8.com/ios-filled/24/4f8cff/checkmark.png';

const languages = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Kannada',
];

const features = [
  { key: 'Voice Input', label: 'Voice Input', icon: VOICE_ICON },
  { key: 'OCR Scanning', label: 'OCR Scanning', icon: OCR_ICON },
  {
    key: 'WhatsApp Integration',
    label: 'WhatsApp Integration',
    icon: WHATSAPP_ICON,
  },
];

const PreferencesScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { data, setData } = useOnboarding();
  const [language, setLanguage] = useState(data.preferredLanguage || '');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    data.features || [],
  );

  const toggleFeature = (key: string) => {
    const newFeatures = selectedFeatures.includes(key)
      ? selectedFeatures.filter(f => f !== key)
      : [...selectedFeatures, key];

    setSelectedFeatures(newFeatures);
    setData(prev => ({ ...prev, features: newFeatures }));
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setData(prev => ({ ...prev, preferredLanguage: value }));
  };

  const handleNext = () => {
    // Save preferences to context before navigating
    setData(prev => ({
      ...prev,
      preferredLanguage: language || 'English',
      features: selectedFeatures,
    }));

    navigation.navigate('BankDetails');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={60}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and App Name */}
        {/* <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} />
          <Text style={styles.appName}>Smart Ledger</Text>
        </View>
        {/* Setup Wizard Badge */}
        {/* <View style={styles.badgeRow}>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.setupBadge}
          >
            <Text style={styles.setupBadgeText}>Setup Wizard</Text>
          </LinearGradient>
        </View> */}
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Step 3 of 5</Text>
          <Text style={styles.progressTextRight}>60% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: MIC_ICON }} style={styles.micIcon} />
          <Text style={styles.cardHeading}>Preferences</Text>
          <Text style={styles.cardSubtext}>
            Customize your Smart Ledger experience
          </Text>
          {/* Preferred Language */}
          <Text style={styles.label}>Preferred Language</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              language && styles.inputActive,
              language && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={languages.map(lang => ({ label: lang, value: lang }))}
            search
            searchPlaceholder="Search language..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="Select your preferred language"
            value={language}
            onChange={item => handleLanguageChange(item.value)}
            renderLeftIcon={() => (
              <Ionicons
                name="language"
                size={20}
                color="#4f8cff"
                style={{ marginRight: 10 }}
              />
            )}
            renderItem={(item, selected) => (
              <View style={styles.dropdownItem}>
                <Text style={styles.dropdownItemText}>{item.label}</Text>
                {selected && (
                  <Ionicons name="checkmark" size={18} color="#4f8cff" />
                )}
              </View>
            )}
            flatListProps={{ keyboardShouldPersistTaps: 'always' }}
            containerStyle={styles.dropdownContainer}
            itemContainerStyle={styles.dropdownItemContainer}
          />
          {/* Features */}
          <Text style={styles.label}>Features you're most interested in:</Text>
          {features.map(feature => {
            const selected = selectedFeatures.includes(feature.key);
            return (
              <TouchableOpacity
                key={feature.key}
                style={[
                  styles.featureBox,
                  selected && styles.featureBoxSelected,
                ]}
                onPress={() => toggleFeature(feature.key)}
                activeOpacity={0.8}
              >
                <View style={styles.featureRow}>
                  <Image
                    source={{ uri: feature.icon }}
                    style={styles.featureIcon}
                  />
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                  {selected && (
                    <Image
                      source={{ uri: CHECK_ICON }}
                      style={styles.checkIcon}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => navigation.navigate('TeamSetup')}
            >
              <Text style={styles.prevButtonText}>{'\u2190'} Previous</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={['#4f8cff', '#1ecb81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next {'\u2192'}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 2,
    marginTop: 30,
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
    width: '60%',
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
  micIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
    tintColor: '#9b5de5',
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
  label: {
    fontSize: 15,
    color: '#222',
    marginBottom: 6,
    marginTop: 16,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  featureBox: {
    width: '100%',
    borderColor: '#e3e7ee',
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  featureBoxSelected: {
    borderColor: '#4f8cff',
    backgroundColor: '#f1f7ff',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 24,
    height: 24,
    marginRight: 14,
    tintColor: '#9b5de5',
  },
  featureLabel: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
    flex: 1,
  },
  checkIcon: {
    width: 22,
    height: 22,
    marginLeft: 8,
    tintColor: '#4f8cff',
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
  dropdown1: {
    marginTop: 12,
    height: 50,
    width: '100%',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1.5,
    fontSize: 16,
  },
  placeholderStyle1: {
    fontSize: 15,
    color: '#8a94a6',
  },
  selectedTextStyle1: {
    fontSize: 15,
    color: '#222',
  },
  inputSearchStyle1: {
    height: 40,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingLeft: 8,
    borderBottomColor: '#e3e7ee',
    borderBottomWidth: 1,
  },
  iconStyle1: {
    width: 24,
    height: 24,
  },
  dropdownContainer: {
    marginTop: 10,
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItemContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItem: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
  },
  inputActive: {
    borderColor: '#4f8cff',
    borderWidth: 2,
  },
  inputFocusShadow: {
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: '#f0f6ff',
  },
});

export default PreferencesScreen;
