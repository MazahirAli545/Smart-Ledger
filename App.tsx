/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SignInScreen from './src/screens/Auth/SignInScreen';
import CreateAccountScreen from './src/screens/Auth/CreateAccountScreen';
import SetupWizardScreen from './src/screens/Auth/SetupWizardScreen';
import TeamSetupScreen from './src/screens/Auth/TeamSetupScreen';
import PreferencesScreen from './src/screens/Auth/PreferencesScreen';
import BankDetailsScreen from './src/screens/Auth/BankDetailsScreen';
import FinalStepScreen from './src/screens/Auth/FinalStepScreen';

const Stack = createStackNavigator();

const SPLASH_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'; // Placeholder image

const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.splashContainer}>
      <StatusBar barStyle="light-content" />
      <Image source={{ uri: SPLASH_IMAGE }} style={styles.splashImage} resizeMode="cover" />
      <ActivityIndicator size="large" color="#fff" style={styles.splashLoader} />
    </View>
  );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Stack.Screen name="SetupWizard" component={SetupWizardScreen} />
        <Stack.Screen name="TeamSetup" component={TeamSetupScreen} />
        
        <Stack.Screen name="Preferences" component={PreferencesScreen} />
        <Stack.Screen name="BankDetailsScreen" component={BankDetailsScreen} />
        <Stack.Screen name="FinalStepScreen" component={FinalStepScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  splashImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  splashLoader: {
    position: 'absolute',
    bottom: 60,
  },
});

export default App;
