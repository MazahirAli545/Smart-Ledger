import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from '../services/notificationService';
import ProperSystemNotificationService from '../services/properSystemNotificationService';

/**
 * Dev-only helper to verify that after a decline, no permission prompt/alert
 * is triggered by notification initialization on CustomerScreen.
 *
 * Usage (DEV only):
 *   import { runDeclineFlowTest } from '../dev/notificationTest';
 *   runDeclineFlowTest();
 */
export const runDeclineFlowTest = async (): Promise<{
  neverAskFlag: string | null;
  initNotificationService: boolean;
  initProperSystemService: boolean;
}> => {
  // Simulate user pressing "Don't allow"
  await AsyncStorage.setItem('notificationsNeverAsk', 'true');

  const notificationService = NotificationService.getInstance();
  const properSystemService = ProperSystemNotificationService.getInstance();

  // Attempt to initialize both services; both should short-circuit to false
  const [initNS, initPSS] = await Promise.all([
    notificationService.initializeNotifications(),
    properSystemService.initializeNotifications(),
  ]);

  const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');

  console.log('🧪 Decline flow test:', {
    neverAskFlag: neverAsk,
    initNotificationService: initNS,
    initProperSystemService: initPSS,
  });

  return {
    neverAskFlag: neverAsk,
    initNotificationService: initNS,
    initProperSystemService: initPSS,
  };
};

/**
 * Clears the decline flag for testing repeated runs.
 */
export const resetDeclineFlag = async (): Promise<void> => {
  await AsyncStorage.removeItem('notificationsNeverAsk');
  console.log('🧪 notificationsNeverAsk cleared');
};

/**
 * Dev-only helper to verify the Allow flow: clears decline flag, initializes
 * both notification services, and attempts to fetch an FCM token.
 */
export const runAllowFlowTest = async (): Promise<{
  initNotificationService: boolean;
  initProperSystemService: boolean;
  fcmTokenPreview: string | null;
}> => {
  // Ensure the decline flag is not set
  await AsyncStorage.removeItem('notificationsNeverAsk');

  const notificationService = NotificationService.getInstance();
  const properSystemService = ProperSystemNotificationService.getInstance();

  const [initNS, initPSS] = await Promise.all([
    notificationService.initializeNotifications(),
    properSystemService.initializeNotifications(),
  ]);

  // Try to retrieve a token (may be null if user actually denies via OS UI)
  const token = await notificationService.getFCMToken();
  const fcmTokenPreview = token ? token.substring(0, 20) + '...' : null;

  console.log('🧪 Allow flow test:', {
    initNotificationService: initNS,
    initProperSystemService: initPSS,
    fcmTokenPreview,
  });

  return {
    initNotificationService: initNS,
    initProperSystemService: initPSS,
    fcmTokenPreview,
  };
};

/**
 * Dev helper to run both flows quickly and compare results.
 */
export const runPermissionMatrixTest = async (): Promise<{
  allow: {
    initNotificationService: boolean;
    initProperSystemService: boolean;
    fcmTokenPreview: string | null;
  };
  dontAllow: {
    neverAskFlag: string | null;
    initNotificationService: boolean;
    initProperSystemService: boolean;
  };
}> => {
  // Run allow flow
  const allow = await runAllowFlowTest();

  // Run decline flow
  const dontAllow = await runDeclineFlowTest();

  console.log('🧪 Permission matrix result:', { allow, dontAllow });
  return { allow, dontAllow };
};
