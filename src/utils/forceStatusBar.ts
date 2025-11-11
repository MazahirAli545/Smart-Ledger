/**
 * Force StatusBar Update Utility
 *
 * This utility provides aggressive methods to force StatusBar updates
 * on Android devices where the standard React Native StatusBar API
 * might not work reliably.
 */

import { StatusBar, Platform, Dimensions, NativeModules } from 'react-native';

export const FORCE_STATUS_BAR_COLOR = '#4f8cff';

/**
 * Debug logging for StatusBar updates
 */
const logStatusBarUpdate = (method: string, success: boolean = true) => {
  if (__DEV__) {
    console.log(
      `🎨 StatusBar ${method}: ${
        success ? 'SUCCESS' : 'FAILED'
      } - Color: ${FORCE_STATUS_BAR_COLOR}`,
    );
  }
};

/**
 * Aggressively force StatusBar color and style
 */
export const forceStatusBarUpdate = () => {
  if (Platform.OS === 'android') {
    try {
      // Method 1: Standard React Native API
      StatusBar.setBackgroundColor(FORCE_STATUS_BAR_COLOR, true);
      StatusBar.setBarStyle('light-content', true);
      StatusBar.setTranslucent(false);
      logStatusBarUpdate('Standard API');

      // Method 2: Force update by toggling hidden state
      StatusBar.setHidden(false, 'fade');

      // Method 3: Try to access native modules if available
      if (NativeModules.StatusBarManager) {
        try {
          NativeModules.StatusBarManager.setColor(FORCE_STATUS_BAR_COLOR, true);
        } catch (e) {
          console.log('Native StatusBarManager not available');
        }
      }

      // Method 4: Multiple delayed attempts
      setTimeout(() => {
        StatusBar.setBackgroundColor(FORCE_STATUS_BAR_COLOR, true);
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setTranslucent(false);
      }, 10);

      setTimeout(() => {
        StatusBar.setBackgroundColor(FORCE_STATUS_BAR_COLOR, true);
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setTranslucent(false);
      }, 50);

      setTimeout(() => {
        StatusBar.setBackgroundColor(FORCE_STATUS_BAR_COLOR, true);
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setTranslucent(false);
      }, 100);

      // Method 5: Force re-render by toggling visibility
      setTimeout(() => {
        StatusBar.setHidden(true, 'none');
        setTimeout(() => {
          StatusBar.setHidden(false, 'fade');
          StatusBar.setBackgroundColor(FORCE_STATUS_BAR_COLOR, true);
          StatusBar.setBarStyle('light-content', true);
          StatusBar.setTranslucent(false);
        }, 50);
      }, 200);
    } catch (error) {
      console.warn('Error forcing StatusBar update:', error);
    }
  } else {
    // iOS approach
    StatusBar.setBarStyle('light-content', true);
  }
};

/**
 * Force StatusBar update with multiple retries
 */
export const forceStatusBarWithRetries = (maxRetries: number = 5) => {
  let retryCount = 0;

  const attemptUpdate = () => {
    forceStatusBarUpdate();
    retryCount++;

    if (retryCount < maxRetries) {
      setTimeout(attemptUpdate, 100 * retryCount);
    }
  };

  attemptUpdate();
};

/**
 * Get StatusBar configuration object
 */
export const getForceStatusBarConfig = () => ({
  backgroundColor: FORCE_STATUS_BAR_COLOR,
  barStyle: 'light-content' as const,
  translucent: false,
  animated: true,
  hidden: false,
});

/**
 * Force StatusBar update on component mount and focus
 */
export const useForceStatusBar = () => {
  const forceUpdate = () => {
    forceStatusBarUpdate();
    forceStatusBarWithRetries(3);
  };

  return { forceUpdate };
};
