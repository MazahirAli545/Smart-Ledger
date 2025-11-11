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
import ProperSystemNotificationService from '../services/properSystemNotificationService';
import NotificationService from '../services/notificationService';

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

          // Initialize notifications on app start when session is present
          try {
            const proper = ProperSystemNotificationService.getInstance();
            await proper.initializeNotifications();
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

      // Initialize notifications post-login and register FCM token with backend
      // Use a small delay to ensure token is stored in AsyncStorage
      setTimeout(async () => {
        try {
          console.log('🔔 Starting FCM token registration after login...');

          // First, initialize notifications
          const proper = ProperSystemNotificationService.getInstance();
          const initialized = await proper.initializeNotifications();

          if (initialized) {
            // Get FCM token and register it
            const fcmToken = await proper.getFCMToken();
            if (fcmToken) {
              console.log(
                '✅ FCM token obtained after login, registering with backend...',
              );
              // The getFCMToken() already calls sendTokenToBackend internally,
              // but we'll also ensure it's registered explicitly
              await proper.refreshFCMToken();
            } else {
              console.warn(
                '⚠️ No FCM token available after login initialization',
              );
            }
          } else {
            // If initialization failed, try to get token anyway and register
            console.log(
              '⚠️ Notification initialization failed, trying direct token registration...',
            );
            try {
              const fcmToken = await proper.getFCMToken();
              if (fcmToken) {
                // Manually send token to backend
                const accessToken = await AsyncStorage.getItem('accessToken');
                if (accessToken) {
                  const { Platform } = require('react-native');
                  const { unifiedApi } = require('../api/unifiedApiService');
                  await unifiedApi.post('/notifications/register-token', {
                    token: fcmToken,
                    deviceType: Platform.OS,
                  });
                  console.log('✅ FCM token registered directly after login');
                }
              }
            } catch (directError) {
              console.error(
                '❌ Failed to register FCM token directly:',
                directError,
              );
            }
          }

          // Also ensure legacy service (if used elsewhere) updates and sends token
          try {
            const legacy = NotificationService.getInstance();
            const tokenNow = await legacy.getFCMToken();
            if (tokenNow) {
              await legacy.sendTokenToBackend(tokenNow);
            }
          } catch (legacyError) {
            console.warn(
              '⚠️ Legacy notification service token registration failed:',
              legacyError,
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
    await AsyncStorage.clear();
    clearProfileCache(); // Clear profile cache on logout
    clearAddFolderCache(); // Clear add folder cache on logout
    clearCashFlowCache(); // Clear cash flow cache on logout
    clearGSTCache(); // Clear GST cache on logout
    clearDashboardCache(); // Clear dashboard cache on logout
    clearContactsCache(); // Clear contacts cache on logout
    setIsAuthenticated(false);

    // Stop session monitoring
    sessionManager.stopSessionMonitoring();

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
