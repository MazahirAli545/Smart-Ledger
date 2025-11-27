import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearProfileCache } from '../screens/HomeScreen/ProfileScreen';
import { clearAddFolderCache } from '../screens/HomeScreen/AddFolderScreen';
import { clearCashFlowCache } from '../screens/HomeScreen/CashFlowScreen';
import { clearGSTCache } from '../screens/HomeScreen/GSTSummaryScreen';
import { clearDashboardCache } from '../screens/HomeScreen/Dashboard';
import { clearContactsCache } from '../screens/HomeScreen/AddCustomerFromContactsScreen';
import { sessionManager } from '../utils/sessionManager';
import { clearNavigationState } from '../utils/navigationStateManager';
import NotificationService from '../services/notificationService';
import sessionWarmUpService from '../services/SessionWarmUpService';
import { clearStoragePreservingNotificationPrefs } from '../utils/storage';

// Define the shape of the authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    token: string | null | undefined,
    refreshToken: string | null | undefined,
    profileComplete?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;
  showSessionLogoutPopup: () => void;
  hideSessionLogoutPopup: () => void;
  handleSessionLogoutConfirm: () => Promise<void>;
  isSessionLogoutPopupVisible: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSessionLogoutPopupVisible, setIsSessionLogoutPopupVisible] =
    useState(false);

  useEffect(() => {
    const checkToken = async () => {
      try {
        console.log('🔍 AuthContext: Checking for existing token...');
        const token = await AsyncStorage.getItem('accessToken');
        console.log('🔍 AuthContext: Token check result:', {
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
        });

        if (token) {
          setIsAuthenticated(true);
          console.log('✅ AuthContext: Token found, user authenticated');

          // Start session monitoring
          sessionManager.startSessionMonitoring();

          // Initialize session warm-up service for authenticated users
          try {
            sessionWarmUpService.initialize();
            console.log('🔥 Session warm-up service initialized');
          } catch (e) {
            console.log('⚠️ Failed to initialize session warm-up service', e);
          }

          // Initialize notifications on app start when session is present
          try {
            const notificationService = NotificationService.getInstance();

            // Skip if already initialized
            if (notificationService.isServiceInitialized()) {
              console.log(
                '✅ AuthContext: Notification service already initialized on app start',
              );
            } else {
              // CRITICAL: Check if user has declined before attempting initialization
              const userDeclined =
                await notificationService.hasUserDeclinedNotifications();
              if (userDeclined) {
                console.log(
                  '⚠️ AuthContext: User has declined notification permission - skipping initialization',
                );
              } else {
                // Check if permission was already granted (to avoid popup)
                const grantedFlag = await AsyncStorage.getItem(
                  'notificationsGranted',
                );
                if (grantedFlag === 'true') {
                  console.log(
                    '✅ AuthContext: Permission already granted, initializing silently on app start',
                  );
                }

                await notificationService.initializeNotifications();
              }
            }
          } catch (e) {
            console.log(
              '⚠️ Failed to initialize notifications on app start',
              e,
            );
          }
        } else {
          setIsAuthenticated(false);
          console.log('❌ AuthContext: No token found, user not authenticated');
        }
      } catch (error) {
        console.error('❌ AuthContext: Error checking token:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
        console.log(
          '🏁 AuthContext: Loading complete, isAuthenticated:',
          isAuthenticated,
        );
      }
    };
    checkToken();
  }, []);

  // Set up session logout callback
  useEffect(() => {
    sessionManager.setSessionLogoutCallback(() => {
      console.log('📢 Session logout callback triggered');
      setIsSessionLogoutPopupVisible(true);
    });

    return () => {
      sessionManager.setSessionLogoutCallback(null);
    };
  }, []);

  const login = async (
    token: string | null | undefined,
    refreshToken: string | null | undefined,
    profileComplete?: boolean,
  ) => {
    console.log('🔐 AuthContext.login called with:', {
      hasToken: !!token,
      hasRefreshToken: !!refreshToken,
      profileComplete,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
    });

    if (token != null) {
      await AsyncStorage.setItem('accessToken', token);
      console.log('💾 Access token stored successfully');
      // Set authentication to true when token is provided
      setIsAuthenticated(true);
      console.log('✅ isAuthenticated set to true');

      // Start session monitoring for new login
      sessionManager.startSessionMonitoring();

      // Initialize session warm-up service for new login
      try {
        sessionWarmUpService.initialize();
        console.log('🔥 Session warm-up service initialized after login');
      } catch (e) {
        console.log(
          '⚠️ Failed to initialize session warm-up service after login',
          e,
        );
      }

      // Initialize notifications post-login and register FCM token with backend
      // Use a small delay to ensure token is stored in AsyncStorage
      setTimeout(async () => {
        try {
          console.log('🔔 Starting FCM token registration after login...');

          const notificationService = NotificationService.getInstance();

          // Check if already initialized or permission already granted
          if (notificationService.isServiceInitialized()) {
            console.log(
              '✅ AuthContext: Notification service already initialized after login',
            );
            // Still try to get and send token
            const existingToken = await notificationService.refreshFCMToken();
            if (existingToken) {
              await notificationService.sendTokenToBackend(existingToken);
            }
            return;
          }

          // CRITICAL: Check if user has declined before attempting initialization
          const userDeclined =
            await notificationService.hasUserDeclinedNotifications();
          let initialized = false;
          if (userDeclined) {
            console.log(
              '⚠️ AuthContext: User has declined notification permission - skipping initialization after login',
            );
          } else {
            // Check if permission was already granted (to avoid popup)
            const grantedFlag = await AsyncStorage.getItem(
              'notificationsGranted',
            );
            if (grantedFlag === 'true') {
              console.log(
                '✅ AuthContext: Permission already granted, initializing silently after login',
              );
            }

            initialized = await notificationService.initializeNotifications();
          }

          let fcmToken: string | null = null;
          if (initialized) {
            fcmToken = await notificationService.refreshFCMToken();
          }
          if (!fcmToken) {
            console.warn(
              '⚠️ Notification initialization failed or no token available, attempting direct fetch via messaging()',
            );
            try {
              const messaging =
                require('@react-native-firebase/messaging').default;
              fcmToken = await messaging().getToken();
            } catch (directError) {
              console.error('❌ Direct FCM token fetch failed:', directError);
            }
          }

          if (fcmToken) {
            await notificationService.sendTokenToBackend(fcmToken);
            console.log('✅ FCM token registered after login');
          } else {
            console.warn(
              '⚠️ No FCM token available after login initialization',
            );
          }
        } catch (e) {
          console.error(
            '❌ Failed to initialize/register notifications after login:',
            e,
          );
        }
      }, 500); // Small delay to ensure token is stored
    } else {
      await AsyncStorage.removeItem('accessToken');
      console.log('🗑️ Access token removed');
      setIsAuthenticated(false);
      console.log('❌ isAuthenticated set to false');
    }
    if (refreshToken != null) {
      await AsyncStorage.setItem('refreshToken', refreshToken);
      console.log('💾 Refresh token stored successfully');
    } else {
      await AsyncStorage.removeItem('refreshToken');
      console.log('🗑️ Refresh token removed');
    }
    // profileComplete parameter is kept for backward compatibility but not required for authentication
    if (profileComplete !== undefined) {
      console.log('Profile complete status:', profileComplete);
    }
  };

  const logout = async () => {
    await clearStoragePreservingNotificationPrefs();
    clearProfileCache(); // Clear profile cache on logout
    clearAddFolderCache(); // Clear add folder cache on logout
    clearCashFlowCache(); // Clear cash flow cache on logout
    clearGSTCache(); // Clear GST cache on logout
    clearDashboardCache(); // Clear dashboard cache on logout
    clearContactsCache(); // Clear contacts cache on logout
    setIsAuthenticated(false);

    // Stop session monitoring
    sessionManager.stopSessionMonitoring();

    // Cleanup session warm-up service
    try {
      sessionWarmUpService.cleanup();
      console.log('🔥 Session warm-up service cleaned up');
    } catch (e) {
      console.log('⚠️ Failed to cleanup session warm-up service', e);
    }

    // Clear navigation state
    await clearNavigationState();
  };

  const forceLogout = async () => {
    console.log('🚨 Force logout triggered - Session expired or invalid');
    await sessionManager.forceLogout();
  };

  const showSessionLogoutPopup = () => {
    setIsSessionLogoutPopupVisible(true);
  };

  const hideSessionLogoutPopup = () => {
    setIsSessionLogoutPopupVisible(false);
  };

  const handleSessionLogoutConfirm = async () => {
    console.log('🚨 User confirmed session logout');
    setIsSessionLogoutPopupVisible(false);

    // Clear authentication state first
    setIsAuthenticated(false);

    // Perform logout operations
    await sessionManager.performLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        login,
        logout,
        forceLogout,
        showSessionLogoutPopup,
        hideSessionLogoutPopup,
        handleSessionLogoutConfirm,
        isSessionLogoutPopupVisible,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
