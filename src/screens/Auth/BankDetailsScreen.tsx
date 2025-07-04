import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, SafeAreaView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const BANK_ICON = 'https://img.icons8.com/ios-filled/100/fa7d09/bank-cards.png'; // Placeholder orange bank icon

type RootStackParamList = {
  SetupWizard: undefined;
  TeamSetup: undefined;
  BankDetails: undefined;
  Preferences: undefined;
  FinalStepScreen: undefined;
};

const BankDetailsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
          <Text style={styles.progressText}>Step 4 of 5</Text>
          <Text style={styles.progressTextRight}>80% Complete</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={styles.progressBarFill} />
        </View>
        {/* Card Container */}
        <View style={styles.card}>
          <Image source={{ uri: BANK_ICON }} style={styles.bankIcon} />
          <Text style={styles.cardHeading}>Bank Details</Text>
          <Text style={styles.cardSubtext}>Connect your bank account for seamless reconciliation</Text>
          {/* Bank Name */}
          <Text style={styles.label}>Bank Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., State Bank of India"
            value={bankName}
            onChangeText={setBankName}
            placeholderTextColor="#8a94a6"
          />
          {/* Account Number */}
          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholderTextColor="#8a94a6"
            keyboardType="number-pad"
          />
          {/* IFSC Code */}
          <Text style={styles.label}>IFSC Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., SBIN0001234"
            value={ifsc}
            onChangeText={setIfsc}
            placeholderTextColor="#8a94a6"
            autoCapitalize="characters"
          />
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoNote}><Text style={styles.bold}>Note:</Text> Bank details are encrypted and stored securely. This information is used only for transaction reconciliation and is never shared.</Text>
          </View>
          {/* Navigation Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.prevButton} onPress={() => navigation.navigate('Preferences')}>
              <Text style={styles.prevButtonText}>{'\u2190'} Previous</Text>
            </TouchableOpacity>
            <LinearGradient
              colors={['#4f8cff', '#1ecb81']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <TouchableOpacity style={styles.nextButton} onPress={() => navigation.navigate('FinalStepScreen')}>
                <Text style={styles.nextButtonText}>Next {'\u2192'}</Text>
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
    width: '80%',
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
  bankIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
    tintColor: '#fa7d09',
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
  infoBox: {
    backgroundColor: '#fffbe6',
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  infoNote: {
    fontSize: 13,
    color: '#b26a00',
    fontWeight: '500',
  },
  bold: {
    fontWeight: 'bold',
    color: '#b26a00',
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

export default BankDetailsScreen; 