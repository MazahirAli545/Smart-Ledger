import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Text,
} from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SignInScreen from './src/screens/Auth/SignInScreen';
import CreateAccountScreen from './src/screens/Auth/CreateAccountScreen';
import SetupWizardScreen from './src/screens/Auth/SetupWizardScreen';
import TeamSetupScreen from './src/screens/Auth/TeamSetupScreen';
import PreferencesScreen from './src/screens/Auth/PreferencesScreen';
import BankDetailsScreen from './src/screens/Auth/BankDetailsScreen';
import FinalStepScreen from './src/screens/Auth/FinalStepScreen';
import Dashboard from './src/screens/HomeScreen/Dashboard';
import InvoiceScreen from './src/screens/HomeScreen/InvoiceScreen';
import ReceiptScreen from './src/screens/HomeScreen/ReceiptScreen';
import PaymentScreen from './src/screens/HomeScreen/PaymentScreen';
import PurchaseScreen from './src/screens/HomeScreen/PurchaseScreen';
import AddFolderScreen from './src/screens/HomeScreen/AddFolderScreen';
import FolderScreen from './src/screens/HomeScreen/FolderScreen';
import { OnboardingProvider } from './src/context/OnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './src/context/AuthContext';
import { AuthProvider } from './src/context/AuthContext';
import CustomDrawerContent from './src/components/CustomDrawerContent';
import OtpVerificationScreen from './src/screens/Auth/OtpVerificationScreen';
import SignInOtpScreen from './src/screens/Auth/SignInOtpScreen';

const Stack = createStackNavigator();
const RootStack = createStackNavigator();
const Drawer = createDrawerNavigator();

export const navigationRef = createNavigationContainerRef();

export const ROOT_STACK_AUTH = 'Auth';
export const ROOT_STACK_APP = 'App';

const SPLASH_IMAGE =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80'; // Placeholder image

const SplashScreen: React.FC<{ onFinish: (isLoggedIn: boolean) => void }> = ({
  onFinish,
}) => {
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        // Wait 2 seconds for splash screen effect
        setTimeout(() => {
          onFinish(!!accessToken);
        }, 2000);
      } catch (error) {
        console.error('Error checking login status:', error);
        setTimeout(() => {
          onFinish(false);
        }, 2000);
      }
    };

    checkLoginStatus();
  }, [onFinish]);

  return (
    <View style={styles.splashContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
      <Image
        source={{ uri: SPLASH_IMAGE }}
        style={styles.splashImage}
        resizeMode="cover"
      />
      <ActivityIndicator
        size="large"
        color="#fff"
        style={styles.splashLoader}
      />
    </View>
  );
};

const AuthStack = () => {
  return (
    // <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignInOtp" component={SignInOtpScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="SetupWizard" component={SetupWizardScreen} />
      <Stack.Screen name="TeamSetup" component={TeamSetupScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
      <Stack.Screen name="FinalStep" component={FinalStepScreen} />
    </Stack.Navigator>
  );
};

// Placeholder screens for the drawer
const ProfileScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Profile Screen</Text>
  </View>
);
const SettingsScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Settings Screen</Text>
  </View>
);
const HelpScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Help Screen</Text>
  </View>
);

const AppStack = () => (
  <Stack.Navigator
    screenOptions={{ headerShown: false }}
    initialRouteName="Dashboard"
  >
    <Stack.Screen name="Dashboard" component={Dashboard} />
    <Stack.Screen name="Invoice" component={InvoiceScreen} />
    <Stack.Screen name="Receipt" component={ReceiptScreen} />
    <Stack.Screen name="Payment" component={PaymentScreen} />
    <Stack.Screen name="Purchase" component={PurchaseScreen} />
    <Stack.Screen name="AddFolder" component={AddFolderScreen} />
    <Stack.Screen name="FolderScreen" component={FolderScreen} />
  </Stack.Navigator>
);

const AppDrawer = () => (
  <Drawer.Navigator
    screenOptions={{ headerShown: false }}
    drawerContent={props => <CustomDrawerContent {...props} />}
  >
    <Drawer.Screen
      name="AppStack"
      component={AppStack}
      options={{
        drawerLabel: () => null,
        title: undefined,
        drawerIcon: () => null,
      }}
    />
  </Drawer.Navigator>
);

const RootNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show splash/loading screen
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name={ROOT_STACK_AUTH} component={AuthStack} />
        ) : (
          <RootStack.Screen name={ROOT_STACK_APP} component={AppDrawer} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const Navigation: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleSplashFinish = (loggedIn: boolean) => {
    setIsLoggedIn(loggedIn);
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <AuthProvider>
      <OnboardingProvider>
        <RootNavigator />
      </OnboardingProvider>
    </AuthProvider>
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

export default Navigation;
