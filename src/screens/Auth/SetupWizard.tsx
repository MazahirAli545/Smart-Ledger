import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import SetupWizardScreen from './SetupWizardScreen';
import TeamSetupScreen from './TeamSetupScreen';
import PreferencesScreen from './PreferencesScreen';
import BankDetailsScreen from './BankDetailsScreen';
import FinalStepScreen from './FinalStepScreen';
import {
  OnboardingProvider,
  useOnboarding,
} from '../../context/OnboardingContext';

const steps = [
  { label: 'Business details', component: <SetupWizardScreen /> },
  { label: 'Team roles', component: <TeamSetupScreen /> },
  { label: 'Preferences', component: <PreferencesScreen /> },
  { label: 'Bank details', component: <BankDetailsScreen /> },
  { label: 'Final step', component: null }, // Will be set below
];

const TOTAL_STEPS = 5;

const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(0);
  const { data, setData } = useOnboarding();

  // Set the final step's component with navigation handlers
  steps[4].component = <FinalStepScreen />;

  const percent = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };
  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
  };

  return (
    <OnboardingProvider>
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, backgroundColor: '#f6fafc' }}>
          {/* Header and Progress */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Smart Ledger</Text>
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
          </View>
          {/* Separator */}
          <View style={styles.separator} />
          {/* Step Content */}
          <View style={{ flex: 1 }}>{steps[step].component}</View>
          {/* Navigation Buttons for non-final steps */}
          {step < steps.length - 1 && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.prevButton, step === 0 && styles.disabledButton]}
                onPress={handlePrev}
                disabled={step === 0}
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
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>Next {'\u2192'}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </View>
      </SafeAreaView>
    </OnboardingProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  headerContainer: {
    paddingTop: 32,
    paddingHorizontal: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
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

  separator: {
    height: 1,
    backgroundColor: '#e3e7ee',
    width: '100%',
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: 'transparent',
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
  disabledButton: {
    opacity: 0.5,
  },
});

export default SetupWizard;
