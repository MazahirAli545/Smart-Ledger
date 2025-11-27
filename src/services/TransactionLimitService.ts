import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, AppStateStatus } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  TriggerType,
  RepeatFrequency,
} from '@notifee/react-native';
import { BASE_URL } from '../api';
import { getUserIdFromToken } from '../utils/storage';
import { unifiedApi } from '../api/unifiedApiService';
import {
  hasUserDeclinedNotifications,
  markNotificationsAsDeclined,
} from '../utils/notificationPrefs';

export interface TransactionLimitData {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  planName: string;
  canCreate: boolean;
  percentageUsed: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  nextResetDate: string;
  nextResetFormatted: string;
}

export interface NotificationCallback {
  (data: TransactionLimitData): void;
}

class TransactionLimitService {
  private static instance: TransactionLimitService;
  private notificationCallback: NotificationCallback | null = null;
  private isPopupShown = false;
  private isServiceActive = false;
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = 'active';
  private lastNotificationTime: number | null = null;
  private readonly NOTIFICATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly STORAGE_KEYS = {
    LAST_NOTIFICATION_TIME: 'transaction_limit_last_notification',
    POPUP_SHOWN_SESSION: 'transaction_limit_popup_shown_session',
    SERVICE_ACTIVE: 'transaction_limit_service_active',
  };

  private constructor() {
    this.initializeService();
  }

  public static getInstance(): TransactionLimitService {
    if (!TransactionLimitService.instance) {
      TransactionLimitService.instance = new TransactionLimitService();
    }
    return TransactionLimitService.instance;
  }

  private async initializeService() {
    try {
      // Load last notification time from storage
      const lastNotificationTimeStr = await AsyncStorage.getItem(
        this.STORAGE_KEYS.LAST_NOTIFICATION_TIME,
      );
      if (lastNotificationTimeStr) {
        this.lastNotificationTime = parseInt(lastNotificationTimeStr, 10);
      }

      // Setup app state listener
      this.setupAppStateListener();

      // Setup push notification
      this.setupPushNotification();

      console.log('✅ TransactionLimitService initialized');
    } catch (error) {
      console.error('❌ Error initializing TransactionLimitService:', error);
    }
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this),
    );
  }

  private async handleAppStateChange(nextAppState: AppStateStatus) {
    console.log(
      '🔄 App state changed from',
      this.currentAppState,
      'to',
      nextAppState,
    );

    const wasInBackground =
      this.currentAppState === 'background' ||
      this.currentAppState === 'inactive';
    const isNowActive = nextAppState === 'active';

    this.currentAppState = nextAppState;

    // If app is coming back from background and user is logged in, check for popup
    if (wasInBackground && isNowActive && this.isServiceActive) {
      console.log('📱 App resumed from background, checking for popup...');

      // Reset popup flag when app resumes (allows popup to show again)
      await this.resetPopupFlag();

      // Check if we should show popup (with delay to ensure app is fully loaded)
      setTimeout(() => {
        this.checkAndShowPopup();
      }, 1000);
    }
  }

  private async setupPushNotification() {
    try {
      const userDeclined = await hasUserDeclinedNotifications();
      if (userDeclined) {
        console.log(
          '⚠️ TransactionLimitService: User declined notifications - skipping Notifee permission prompt',
        );
        return;
      }

      // Request permission for notifications
      const permissionStatus = await notifee.requestPermission();
      if (
        permissionStatus?.authorizationStatus === AuthorizationStatus.DENIED
      ) {
        console.log(
          '⚠️ TransactionLimitService: Notifee permission denied - respecting preference',
        );
        await markNotificationsAsDeclined();
        return;
      }

      // Create notification channel for Android
      await notifee.createChannel({
        id: 'transaction-limit',
        name: 'Transaction Limit Notifications',
        description: 'Notifications for transaction limit expiry',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
      });

      console.log('✅ Notification channel created successfully');
    } catch (error) {
      console.error('❌ Error setting up push notifications:', error);
    }
  }

  public async startLimitMonitoring() {
    try {
      console.log('🚀 Starting transaction limit monitoring...');

      this.isServiceActive = true;
      await AsyncStorage.setItem(this.STORAGE_KEYS.SERVICE_ACTIVE, 'true');

      // Check immediately and update popup/notifications based on current state
      await this.checkAndShowPopup();

      console.log('✅ Transaction limit monitoring started');
    } catch (error) {
      console.error('❌ Error starting limit monitoring:', error);
    }
  }

  public async stopLimitMonitoring() {
    try {
      console.log('🛑 Stopping transaction limit monitoring...');

      this.isServiceActive = false;
      await AsyncStorage.setItem(this.STORAGE_KEYS.SERVICE_ACTIVE, 'false');

      // Cancel scheduled notifications
      await notifee.cancelAllNotifications();

      console.log('✅ Transaction limit monitoring stopped');
    } catch (error) {
      console.error('❌ Error stopping limit monitoring:', error);
    }
  }

  public setNotificationCallback(callback: NotificationCallback) {
    this.notificationCallback = callback;
    console.log('📞 Notification callback set');
  }

  public async checkAndShowPopup() {
    try {
      // Don't show popup if service is not active
      if (!this.isServiceActive) {
        console.log('⏸️ Service not active, skipping popup check');
        return;
      }

      // Check if popup was already shown in this session
      const popupShown = await AsyncStorage.getItem(
        this.STORAGE_KEYS.POPUP_SHOWN_SESSION,
      );
      if (popupShown === 'true') {
        console.log('🚫 Popup already shown in this session, skipping');
        return;
      }

      // Get transaction limit data
      const limitData = await this.fetchTransactionLimitData();
      if (!limitData) {
        console.log('❌ No transaction limit data available');
        return;
      }

      // Update scheduled notifications strictly based on hard limit state
      await this.updateNotificationsForLimitState(limitData);

      // Show popup ONLY when user is AT LIMIT (not for near-limit)
      if (limitData.isAtLimit) {
        console.log('⛔ User is at limit, showing popup...');
        await this.showTransactionLimitPopup(limitData);
      } else {
        console.log('✅ User is below limit, no popup');
      }
    } catch (error) {
      console.error('❌ Error checking and showing popup:', error);
    }
  }

  public async forceShowPopup() {
    try {
      console.log('🔧 Force showing transaction limit popup...');

      // Get transaction limit data
      const limitData = await this.fetchTransactionLimitData();
      if (!limitData) {
        console.log('❌ No transaction limit data available for force popup');
        return;
      }

      // Respect business rule: show daily only for users who reached limit
      if (limitData.isAtLimit) {
        console.log('⚠️ Force showing popup with data (at limit):', limitData);
        await this.showTransactionLimitPopup(limitData);
      } else {
        console.log('ℹ️ Force popup suppressed because user is not at limit');
      }
    } catch (error) {
      console.error('❌ Error force showing popup:', error);
    }
  }

  // Expose a safe force check method used by screens/contexts
  public async forceCheckTransactionLimit() {
    try {
      // Ensure service is considered active during explicit checks
      this.isServiceActive = true;
      await this.checkAndShowPopup();
    } catch (error) {
      console.error('❌ Error in forceCheckTransactionLimit:', error);
    }
  }

  private async fetchTransactionLimitData(): Promise<TransactionLimitData | null> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ No access token available');
        return null;
      }

      // Get user ID from token
      const userId = await getUserIdFromToken();
      if (!userId) {
        console.log('❌ No user ID available');
        return null;
      }

      // Use the dedicated transaction limits endpoint with user ID parameter
      const userIdString = String(userId);
      console.log('🔍 TransactionLimitService: userId type and value:', {
        originalUserId: userId,
        userIdType: typeof userId,
        userIdString: userIdString,
        userIdStringType: typeof userIdString,
      });

      // Use URLSearchParams to ensure proper encoding
      // Use unified API for transaction limits
      const res = (await unifiedApi.getTransactionLimits()) as {
        data: any;
        status: number;
        headers: Headers;
      };

      // unifiedApi returns { data, status, headers } structure
      // If unauthorized/forbidden, don't throw – just return a benign default
      if (res.status === 401 || res.status === 403) {
        console.warn('⚠️ Transaction limits request unauthorized/forbidden');
        return {
          currentCount: 0,
          maxAllowed: 50,
          remaining: 50,
          planName: 'Free',
          canCreate: true,
          percentageUsed: 0,
          isNearLimit: false, // Never show popup for 0 transactions
          isAtLimit: false, // Never show popup for 0 transactions
          nextResetDate: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toISOString(),
          nextResetFormatted: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toLocaleDateString(),
        };
      }

      if (res.status < 200 || res.status >= 300) {
        console.warn('⚠️ Transaction limits request failed:', res.status);
        // Return a benign default instead of null to prevent blocking the user
        return {
          currentCount: 0,
          maxAllowed: 50,
          remaining: 50,
          planName: 'Free',
          canCreate: true,
          percentageUsed: 0,
          isNearLimit: false,
          isAtLimit: false,
          nextResetDate: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toISOString(),
          nextResetFormatted: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toLocaleDateString(),
        };
      }

      // unifiedApi already returns parsed data
      const data = res.data || res;
      console.log('📈 Transaction limits data from backend:', data);
      return data;
    } catch (error) {
      console.error('❌ Error fetching transaction limit data:', error);
      // Return a benign default instead of null to prevent blocking the user
      const maxAllowed = 50;
      return {
        currentCount: 0,
        maxAllowed,
        remaining: maxAllowed,
        planName: 'Free',
        canCreate: true,
        percentageUsed: 0,
        isNearLimit: false, // Never show popup for 0 transactions
        isAtLimit: false, // Never show popup for 0 transactions
        nextResetDate: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1,
        ).toISOString(),
        nextResetFormatted: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1,
        ).toLocaleDateString(),
      };
    }
  }

  private async showTransactionLimitPopup(data: TransactionLimitData) {
    try {
      // Mark popup as shown for this session
      await AsyncStorage.setItem(this.STORAGE_KEYS.POPUP_SHOWN_SESSION, 'true');
      this.isPopupShown = true;

      // Show popup via callback
      if (this.notificationCallback) {
        console.log('📢 Triggering popup via callback');
        this.notificationCallback(data);
      } else {
        // Fallback to Alert if no callback is set
        console.log('📢 Showing fallback Alert popup');
        this.showFallbackAlert(data);
      }

      // Also show immediate local notification
      await this.showImmediateNotification(data);
    } catch (error) {
      console.error('❌ Error showing transaction limit popup:', error);
    }
  }

  private showFallbackAlert(data: TransactionLimitData) {
    const title = data.isAtLimit
      ? 'Transaction Limit Reached'
      : 'Transaction Limit Warning';
    const message = data.isAtLimit
      ? `You have reached your monthly transaction limit (${data.currentCount}/${data.maxAllowed}). Please upgrade your plan to continue.`
      : `You are approaching your monthly transaction limit (${data.currentCount}/${data.maxAllowed}). Consider upgrading your plan.`;

    Alert.alert(
      title,
      message,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Upgrade Plan',
          style: 'default',
          onPress: () => {
            console.log('👆 User chose to upgrade plan');
            // You can add navigation logic here
          },
        },
      ],
      { cancelable: true },
    );
  }

  private async showImmediateNotification(data: TransactionLimitData) {
    try {
      const title = data.isAtLimit
        ? 'Transaction Limit Reached'
        : 'Transaction Limit Warning';
      const message = data.isAtLimit
        ? `You've reached your ${data.planName} plan limit (${data.currentCount}/${data.maxAllowed})`
        : `You're approaching your ${data.planName} plan limit (${data.currentCount}/${data.maxAllowed})`;

      await notifee.displayNotification({
        title: title,
        body: message,
        data: {
          type: 'transaction_limit',
          data: JSON.stringify(data),
        },
        android: {
          channelId: 'transaction-limit',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibrationPattern: [300, 500],
        },
      });

      console.log('📱 Immediate notification sent');
    } catch (error) {
      console.error('❌ Error showing immediate notification:', error);
    }
  }

  private async schedule24HourNotification() {
    try {
      const now = Date.now();

      // Check if 24 hours have passed since last notification
      if (
        this.lastNotificationTime &&
        now - this.lastNotificationTime < this.NOTIFICATION_INTERVAL
      ) {
        const timeRemaining =
          this.NOTIFICATION_INTERVAL - (now - this.lastNotificationTime);
        console.log(
          `⏰ 24-hour notification scheduled in ${Math.round(
            timeRemaining / (1000 * 60 * 60),
          )} hours`,
        );
        return;
      }

      // Schedule notification for 24 hours from now
      const notificationTime = new Date(now + this.NOTIFICATION_INTERVAL);

      await notifee.createTriggerNotification(
        {
          title: 'Transaction Count Expiry Reminder',
          body: 'Check your transaction usage and consider upgrading your plan if needed.',
          data: {
            type: 'transaction_limit_24h',
            scheduledTime: notificationTime.getTime(),
          },
          android: {
            channelId: 'transaction-limit',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            sound: 'default',
            vibrationPattern: [300, 500],
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: notificationTime.getTime(),
          repeatFrequency: RepeatFrequency.DAILY,
        },
      );

      // Update last notification time
      this.lastNotificationTime = now;
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LAST_NOTIFICATION_TIME,
        now.toString(),
      );

      console.log(
        '📅 24-hour notification scheduled for:',
        notificationTime.toISOString(),
      );
    } catch (error) {
      console.error('❌ Error scheduling 24-hour notification:', error);
    }
  }

  // Ensure notifications only exist for users who have reached the limit
  private async updateNotificationsForLimitState(data: TransactionLimitData) {
    try {
      if (data.isAtLimit) {
        // Schedule (or keep) the daily reminder
        await this.schedule24HourNotification();
      } else {
        // Cancel any scheduled notifications when user drops below limit
        await notifee.cancelAllNotifications();
        this.lastNotificationTime = null;
        await AsyncStorage.removeItem(this.STORAGE_KEYS.LAST_NOTIFICATION_TIME);
        console.log('🧹 Cleared scheduled notifications (user below limit)');
      }
    } catch (error) {
      console.error('❌ Error updating notifications for limit state:', error);
    }
  }

  public async resetPopupFlag() {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.POPUP_SHOWN_SESSION);
      this.isPopupShown = false;
      console.log('🔄 Popup flag reset');
    } catch (error) {
      console.error('❌ Error resetting popup flag:', error);
    }
  }

  public async forceTriggerNotification() {
    try {
      console.log('🧪 Force triggering notification...');

      const limitData = await this.fetchTransactionLimitData();
      if (limitData) {
        await this.showTransactionLimitPopup(limitData);
      } else {
        console.log('❌ No limit data available for force trigger');
      }
    } catch (error) {
      console.error('❌ Error force triggering notification:', error);
    }
  }

  public async getServiceStatus() {
    try {
      const serviceActive = await AsyncStorage.getItem(
        this.STORAGE_KEYS.SERVICE_ACTIVE,
      );
      const popupShown = await AsyncStorage.getItem(
        this.STORAGE_KEYS.POPUP_SHOWN_SESSION,
      );

      return {
        serviceActive: serviceActive === 'true',
        popupShown: popupShown === 'true',
        lastNotificationTime: this.lastNotificationTime,
        hoursSinceLastNotification: this.lastNotificationTime
          ? Math.round(
              (Date.now() - this.lastNotificationTime) / (1000 * 60 * 60),
            )
          : null,
      };
    } catch (error) {
      console.error('❌ Error getting service status:', error);
      return {
        serviceActive: false,
        popupShown: false,
        lastNotificationTime: null,
        hoursSinceLastNotification: null,
      };
    }
  }

  public destroy() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    notifee.cancelAllNotifications();
    console.log('🗑️ TransactionLimitService destroyed');
  }
}

export default TransactionLimitService;
