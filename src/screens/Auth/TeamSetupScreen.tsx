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
const TEAM_ICON =
  'https://img.icons8.com/ios-filled/100/4caf50/conference-call.png'; // Placeholder green team icon

const teamSizes = ['Just me', '2-5 people', '6-10 people', 'More than 10'];

const TeamSetupScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { data, setData } = useOnboarding();
  const [teamSize, setTeamSize] = useState(data.teamSize || '');

  const handleTeamSizeChange = (value: string) => {
    setTeamSize(value);
    setData(prev => ({ ...prev, teamSize: value }));
  };

  const handleNext = () => {
    // Save team size to context before navigating
    setData(prev => ({
      ...prev,
      teamSize: teamSize || '2-5 people', // Default value if none selected
    }));

    navigation.navigate('Preferences');
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
        {/* Progress Bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>Step 2 of 5</Text>
          <Text style={styles.progressTextRight}>40% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: TEAM_ICON }} style={styles.teamIcon} />
          <Text style={styles.cardHeading}>Team Setup</Text>
          <Text style={styles.cardSubtext}>
            Configure access for your team members
          </Text>
          {/* Team Size */}
          <Text style={styles.label}>Team Size</Text>
          <Dropdown
            style={[
              styles.dropdown1,
              teamSize && styles.inputActive,
              teamSize && styles.inputFocusShadow,
            ]}
            placeholderStyle={styles.placeholderStyle1}
            selectedTextStyle={styles.selectedTextStyle1}
            inputSearchStyle={styles.inputSearchStyle1}
            iconStyle={styles.iconStyle1}
            data={teamSizes.map(size => ({ label: size, value: size }))}
            search
            searchPlaceholder="Search team size..."
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="How many people will use Smart Ledger?"
            value={teamSize}
            onChange={item => handleTeamSizeChange(item.value)}
            renderLeftIcon={() => (
              <Ionicons
                name="people"
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
          {/* Team Roles Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Team Roles Available:</Text>
            <Text style={styles.infoItem}>
              <Text style={styles.bold}>• Admin:</Text> Full access to all
              features
            </Text>
            <Text style={styles.infoItem}>
              <Text style={styles.bold}>• Accountant:</Text> Manage transactions
              and reports
            </Text>
            <Text style={styles.infoItem}>
              <Text style={styles.bold}>• Data Entry:</Text> Add transactions
              only
            </Text>
            <Text style={styles.infoItem}>
              <Text style={styles.bold}>• Viewer:</Text> View reports only
            </Text>
          </View>
          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.prevButton}
              onPress={() => navigation.navigate('SetupWizard')}
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
    width: '40%',
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
  teamIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
    tintColor: '#22c55e',
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
  pickerWrapper: undefined, // Remove old picker styles
  picker: undefined,
  pickerItem: undefined,
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
  infoBox: {
    backgroundColor: '#f1f5fb',
    borderRadius: 10,
    padding: 16,
    marginTop: 18,
    marginBottom: 8,
    width: '100%',
  },
  infoTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#222',
    marginBottom: 6,
  },
  infoItem: {
    fontSize: 14,
    color: '#222',
    marginBottom: 2,
  },
  bold: {
    fontWeight: 'bold',
    color: '#222',
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

export default TeamSetupScreen;
