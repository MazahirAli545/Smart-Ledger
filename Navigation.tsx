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
import NetworkStatusModal from './src/components/NetworkStatusModal';

import SignInScreen from './src/screens/Auth/SignInScreen';

import Dashboard from './src/screens/HomeScreen/Dashboard';
import InvoiceScreen from './src/screens/HomeScreen/InvoiceScreen';
import ReceiptScreen from './src/screens/HomeScreen/ReceiptScreen';
import PaymentScreen from './src/screens/HomeScreen/PaymentScreen';
import PurchaseScreen from './src/screens/HomeScreen/PurchaseScreen';
import AddFolderScreen from './src/screens/HomeScreen/AddFolderScreen';
import FolderScreen from './src/screens/HomeScreen/FolderScreen';
import ProfileScreen from './src/screens/HomeScreen/ProfileScreen';
import AllQuickActionsScreen from './src/screens/HomeScreen/AllQuickActionsScreen';
import GSTSummaryScreen from './src/screens/HomeScreen/GSTSummaryScreen';
import CashFlowScreen from './src/screens/HomeScreen/CashFlowScreen';
import DailyLedgerScreen from './src/screens/HomeScreen/DailyLedgerScreen';
import CustomerScreen from './src/screens/HomeScreen/CustomerScreen';
import AddCustomerFromContactsScreen from './src/screens/HomeScreen/AddCustomerFromContactsScreen';
import AddPartyScreen from './src/screens/HomeScreen/AddPartyScreen';
import CustomerDetailScreen from './src/screens/HomeScreen/CustomerDetailScreen';
import AddNewEntryScreen from './src/screens/HomeScreen/AddNewEntryScreen';
import SubscriptionPlanScreen from './src/screens/SubscriptionPlanScreen';
import NotificationScreen from './src/screens/HomeScreen/NotificationScreen';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './src/context/AuthContext';
import { AuthProvider } from './src/context/AuthContext';
import CustomDrawerContent from './src/components/CustomDrawerContent';
import GlobalNotificationWrapper from './src/components/GlobalNotificationWrapper';
import GlobalPlanExpiryWrapper from './src/components/GlobalPlanExpiryWrapper';
import GlobalTransactionLimitWrapper from './src/components/GlobalTransactionLimitWrapper';
import { TransactionLimitProvider } from './src/context/TransactionLimitContext';
import SessionLogoutPopup from './src/components/SessionLogoutPopup';

import SignInOtpScreen from './src/screens/Auth/SignInOtpScreen';

const Stack = createStackNavigator();
const RootStack = createStackNavigator();
const Drawer = createDrawerNavigator();

export const navigationRef = createNavigationContainerRef();

export const ROOT_STACK_AUTH = 'Auth';
export const ROOT_STACK_APP = 'App';

const SplashScreen: React.FC<{ onFinish: (isLoggedIn: boolean) => void }> = ({
  onFinish,
}) => {
  const [logoScale, setLogoScale] = useState(0.8);
  const [logoOpacity, setLogoOpacity] = useState(0);
  const [textOpacity, setTextOpacity] = useState(0);
  const [loaderOpacity, setLoaderOpacity] = useState(0);
  const [circleScale, setCircleScale] = useState(0.5);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        console.log('🔍 SplashScreen - Checking login status:', {
          hasToken: !!accessToken,
          willNavigateTo: accessToken ? 'Dashboard' : 'SignInScreen',
        });

        // Animate logo entrance
        setTimeout(() => {
          setLogoScale(1);
          setLogoOpacity(1);
        }, 200);

        // Animate text entrance
        setTimeout(() => {
          setTextOpacity(1);
        }, 600);

        // Animate loader entrance
        setTimeout(() => {
          setLoaderOpacity(1);
        }, 1000);

        // Animate background circles
        setTimeout(() => {
          setCircleScale(1);
        }, 400);

        // Wait 2.5 seconds for splash screen effect
        setTimeout(() => {
          onFinish(!!accessToken);
        }, 2500);
      } catch (error) {
        console.error('Error checking login status:', error);
        setTimeout(() => {
          onFinish(false);
        }, 2500);
      }
    };

    checkLoginStatus();
  }, [onFinish]);

  return (
    <View style={styles.splashContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <View
          style={[styles.circle1, { transform: [{ scale: circleScale }] }]}
        />
        <View
          style={[styles.circle2, { transform: [{ scale: circleScale }] }]}
        />
        <View
          style={[styles.circle3, { transform: [{ scale: circleScale }] }]}
        />
      </View>

      {/* Main Content */}
      <View style={styles.splashContent}>
        {/* App Logo */}
        <View
          style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Image
            source={require('./android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png')}
            style={styles.appLogo}
            resizeMode="contain"
          />
        </View>

        {/* App Name */}
        <Text style={[styles.appName, { opacity: textOpacity }]}>
          Smart Ledger
        </Text>

        {/* App Tagline */}
        <Text style={[styles.appTagline, { opacity: textOpacity }]}>
          Your Business, Simplified
        </Text>
      </View>

      {/* Loading Indicator */}
      <View style={[styles.loaderContainer, { opacity: loaderOpacity }]}>
        <ActivityIndicator
          size="large"
          color="#8f5cff"
          style={styles.splashLoader}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
};

const AuthStack = () => {
  console.log('🔍 AuthStack - Initializing with SignIn as initial route');

  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignInOtp" component={SignInOtpScreen} />
    </Stack.Navigator>
  );
};

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

const AppStack = () => {
  const [initialRoute, setInitialRoute] = useState('Customer');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getInitialRoute = async () => {
      try {
        // Import here to avoid circular dependency
        const { getLastScreen } = await import(
          './src/utils/navigationStateManager'
        );
        const lastScreen = await getLastScreen();
        setInitialRoute(lastScreen.screen);
      } catch (error) {
        console.error('❌ Error getting initial route:', error);
        setInitialRoute('Customer'); // Default to Customer screen
      } finally {
        setIsLoading(false);
      }
    };

    getInitialRoute();
  }, []);

  if (isLoading) {
    return <SplashScreen onFinish={() => {}} />; // Show splash screen while determining initial route
  }

  return (
    <GlobalNotificationWrapper>
      <GlobalPlanExpiryWrapper>
        <GlobalTransactionLimitWrapper>
          <Stack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={initialRoute}
          >
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Invoice" component={InvoiceScreen} />
            <Stack.Screen name="Receipt" component={ReceiptScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Purchase" component={PurchaseScreen} />
            <Stack.Screen name="AddFolder" component={AddFolderScreen} />
            <Stack.Screen name="FolderScreen" component={FolderScreen} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
            <Stack.Screen name="Customer" component={CustomerScreen} />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
            />
            <Stack.Screen name="AddNewEntry" component={AddNewEntryScreen} />
            <Stack.Screen
              name="AddCustomerFromContacts"
              component={AddCustomerFromContactsScreen}
            />
            <Stack.Screen name="AddParty" component={AddPartyScreen} />
            <Stack.Screen
              name="AllQuickActionsScreen"
              component={AllQuickActionsScreen}
            />
            <Stack.Screen name="GSTSummary" component={GSTSummaryScreen} />
            <Stack.Screen name="CashFlow" component={CashFlowScreen} />
            <Stack.Screen name="DailyLedger" component={DailyLedgerScreen} />
            <Stack.Screen
              name="SubscriptionPlan"
              component={SubscriptionPlanScreen}
            />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
          </Stack.Navigator>
        </GlobalTransactionLimitWrapper>
      </GlobalPlanExpiryWrapper>
    </GlobalNotificationWrapper>
  );
};

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
  const {
    isAuthenticated,
    loading,
    isSessionLogoutPopupVisible,
    handleSessionLogoutConfirm,
  } = useAuth();

  console.log('🔍 RootNavigator - Auth state:', {
    isAuthenticated,
    loading,
    willShow: isAuthenticated ? 'Dashboard' : 'SignInScreen',
    timestamp: new Date().toISOString(),
  });

  if (loading) {
    console.log('⏳ RootNavigator - Still loading, showing splash screen');
    // Show splash screen instead of null
    return <SplashScreen onFinish={() => {}} />;
  }

  console.log(
    '✅ RootNavigator - Loading complete, showing:',
    isAuthenticated ? 'App' : 'Auth',
  );
  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name={ROOT_STACK_AUTH} component={AuthStack} />
        ) : (
          <RootStack.Screen name={ROOT_STACK_APP} component={AppDrawer} />
        )}
      </RootStack.Navigator>

      {/* Global Session Logout Popup */}
      <SessionLogoutPopup
        visible={isSessionLogoutPopupVisible}
        onConfirm={handleSessionLogoutConfirm}
        title="Session Expired"
        message="Your session has expired. Please login again to continue."
      />

      {/* Global Network Status Popup */}
      <NetworkStatusModal />
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
      <TransactionLimitProvider>
        <RootNavigator />
      </TransactionLimitProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },

  // Background Pattern
  backgroundPattern: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  circle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(143, 92, 255, 0.05)',
    top: -50,
    right: -50,
  },
  circle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(111, 76, 255, 0.03)',
    bottom: 100,
    left: -30,
  },
  circle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(143, 92, 255, 0.04)',
    top: '50%',
    right: 50,
  },

  // Main Content
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLogo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  appTagline: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
  },

  // Loader
  loaderContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  splashLoader: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
});

export default Navigation;
