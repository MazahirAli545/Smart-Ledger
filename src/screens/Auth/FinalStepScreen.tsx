import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const CHECK_ICON = 'https://img.icons8.com/color/96/26e07f/ok--v1.png';

const goals = [
  "Track business finances",
  "Automate accounting",
  "GST compliance",
  "Generate reports",
  "Other",
];

type RootStackParamList = {
  BankDetailsScreen: undefined;
  // ... other screens if needed
};

const FinalStepScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [goal, setGoal] = useState('');
  const [challenges, setChallenges] = useState('');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f6fafc' }} contentContainerStyle={{ flexGrow: 1 }}>
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
        <Text style={styles.cardSubtext}>Tell us about your goals and challenges</Text>
        {/* Primary Goal Dropdown */}
        <Text style={styles.label}>Primary Goal with Smart Ledger</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={goal}
            onValueChange={setGoal}
            style={styles.picker}
            itemStyle={styles.pickerItem}
            dropdownIconColor="#8a94a6"
          >
            <Picker.Item label="What's your main goal?" value="" color="#8a94a6" />
            {goals.map((g) => (
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
          onChangeText={setChallenges}
          placeholderTextColor="#8a94a6"
          multiline
          numberOfLines={4}
        />
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🎉 You're all set!</Text>
          <Text style={styles.infoText}>Based on your preferences, we've customized Smart Ledger for your business. You'll have access to:</Text>
          <Text style={styles.bullet}>• Voice input in your preferred language</Text>
          <Text style={styles.bullet}>• Industry-specific transaction categories</Text>
          <Text style={styles.bullet}>• Customized dashboard for your business size</Text>
          <Text style={styles.bullet}>• GST compliance tools</Text>
        </View>
        {/* Navigation Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.prevButton} onPress={() => navigation.navigate('BankDetailsScreen')}>
            <Text style={styles.prevButtonText}>{'\u2190'} Previous</Text>
          </TouchableOpacity>
          <LinearGradient
            colors={['#4f8cff', '#1ecb81']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <TouchableOpacity style={styles.nextButton} onPress={() => {}}>
              <Text style={styles.nextButtonText}>Complete Setup {'\u2192'}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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