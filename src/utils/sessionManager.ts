import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef, ROOT_STACK_AUTH } from '../../Navigation';
import { clearNavigationState } from './navigationStateManager';

// Session validation and management utilities
export class SessionManager {
  private static instance: SessionManager;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private sessionLogoutCallback: (() => void) | null = null;

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // Start monitoring session validity
  startSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    console.log('🔍 Starting session monitoring...');

    // Check session every 5 minutes
    this.sessionCheckInterval = setInterval(async () => {
      console.log('🔍 Periodic session check...');
      await this.validateSession();
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Stop session monitoring
  stopSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  // Validate current session
  async validateSession(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      console.log('🔍 Session validation: Checking token...', {
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
      });

      if (!token) {
        console.log('🚨 Session validation: No token found');
        await this.forceLogout();
        return false;
      }

      // Check if token is expired
      if (this.isTokenExpired(token)) {
        console.log('🚨 Session validation: Token expired');
        await this.forceLogout();
        return false;
      }

      console.log('✅ Session validation: Token still valid');
      return true;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      await this.forceLogout();
      return false;
    }
  }

  // Set callback for session logout popup
  setSessionLogoutCallback(callback: (() => void) | null) {
    this.sessionLogoutCallback = callback;
  }

  // Force logout when session is invalid
  async forceLogout() {
    console.log('🚨 Force logout triggered - Session expired or invalid');

    try {
      // Show session logout popup if callback is set
      if (this.sessionLogoutCallback) {
        console.log('📢 Showing session logout popup');
        this.sessionLogoutCallback();
        return; // Don't proceed with logout until user confirms
      }

      // If no callback is set, proceed with immediate logout
      await this.performLogout();
    } catch (error) {
      console.error('❌ Error during force logout:', error);
    }
  }

  // Perform the actual logout process
  async performLogout() {
    console.log('🚨 Performing session logout...');

    try {
      // Stop session monitoring
      this.stopSessionMonitoring();

      // Clear navigation state
      await clearNavigationState();

      // Force navigation to SignIn screen
      if (navigationRef.isReady()) {
        console.log('🔄 Resetting navigation to Auth stack...');
        try {
          navigationRef.reset({
            index: 0,
            routes: [{ name: ROOT_STACK_AUTH as never }],
          });
          console.log('✅ Navigation reset successful');
        } catch (navError) {
          console.error('❌ Navigation reset failed:', navError);
          // Fallback: try to navigate to the root
          try {
            navigationRef.navigate(ROOT_STACK_AUTH as never);
            console.log('✅ Fallback navigation successful');
          } catch (fallbackError) {
            console.error('❌ Fallback navigation also failed:', fallbackError);
          }
        }
      } else {
        console.log('⚠️ Navigation ref not ready, will retry...');
        // Retry after a short delay if navigation ref is not ready
        setTimeout(() => {
          if (navigationRef.isReady()) {
            console.log('🔄 Retrying navigation reset...');
            try {
              navigationRef.reset({
                index: 0,
                routes: [{ name: ROOT_STACK_AUTH as never }],
              });
              console.log('✅ Retry navigation reset successful');
            } catch (navError) {
              console.error('❌ Retry navigation reset failed:', navError);
              // Fallback: try to navigate to the root
              try {
                navigationRef.navigate(ROOT_STACK_AUTH as never);
                console.log('✅ Retry fallback navigation successful');
              } catch (fallbackError) {
                console.error(
                  '❌ Retry fallback navigation also failed:',
                  fallbackError,
                );
              }
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error during logout process:', error);
    }
  }

  // Check if token is expired (JWT decode)
  isTokenExpired(token: string): boolean {
    try {
      // Check if token has the correct JWT format (3 parts separated by dots)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log(
          '🚨 Invalid token format - expected 3 parts, got:',
          parts.length,
        );
        return true;
      }

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Date.now() / 1000;
      const tokenExpTime = payload.exp;

      console.log('🔍 Token expiration check:', {
        currentTime: new Date(currentTime * 1000),
        tokenExpTime: tokenExpTime
          ? new Date(tokenExpTime * 1000)
          : 'No expiration',
        timeUntilExpiry: tokenExpTime
          ? (tokenExpTime - currentTime) / 60
          : 'N/A', // minutes
      });

      // Add 5 minute buffer to prevent edge cases
      const bufferTime = 5 * 60; // 5 minutes in seconds

      if (payload.exp && payload.exp < currentTime + bufferTime) {
        console.log(
          '🚨 Token expired or expiring soon:',
          new Date(payload.exp * 1000),
          'Current time:',
          new Date(currentTime * 1000),
        );
        return true;
      }

      console.log('✅ Token is valid and not expiring soon');
      return false;
    } catch (error) {
      console.error('❌ Error decoding token:', error);
      return true; // Assume expired if can't decode
    }
  }

  // Get current token from storage
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('accessToken');
  }

  // Check session validity without forcing logout (for debugging)
  async checkSessionStatus(): Promise<{
    hasToken: boolean;
    isExpired: boolean;
    isValid: boolean;
    tokenPreview?: string;
    expirationTime?: Date;
  }> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        return {
          hasToken: false,
          isExpired: false,
          isValid: false,
        };
      }

      const isExpired = this.isTokenExpired(token);
      const isValid = !isExpired;

      // Get expiration time for debugging
      let expirationTime: Date | undefined;
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp) {
            expirationTime = new Date(payload.exp * 1000);
          }
        }
      } catch (e) {
        // Ignore parsing errors for expiration time
      }

      return {
        hasToken: true,
        isExpired,
        isValid,
        tokenPreview: token.substring(0, 20) + '...',
        expirationTime,
      };
    } catch (error) {
      console.error('❌ Error checking session status:', error);
      return {
        hasToken: false,
        isExpired: true,
        isValid: false,
      };
    }
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();

// Utility function to check session before API calls
export const checkSessionBeforeApiCall = async (): Promise<boolean> => {
  return await sessionManager.validateSession();
};

// Utility function to handle API response and check for auth errors
export const handleApiResponse = async (
  response: Response,
): Promise<Response> => {
  if (response.status === 401 || response.status === 403) {
    console.log('🚨 API returned auth error, forcing logout');
    await sessionManager.forceLogout();
    throw new Error('Authentication failed');
  }
  return response;
};
