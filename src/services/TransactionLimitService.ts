import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState, AppStateStatus } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  RepeatFrequency,
} from '@notifee/react-native';
import { BASE_URL } from '../api';

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
      // Request permission for notifications
      await notifee.requestPermission();

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

      // Check for popup immediately
      await this.checkAndShowPopup();

      // Schedule 24-hour notification
      await this.schedule24HourNotification();

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

      // Check if user is at or near limit
      if (limitData.isAtLimit || limitData.isNearLimit) {
        console.log('⚠️ User is at/near limit, showing popup...');
        await this.showTransactionLimitPopup(limitData);
      } else {
        console.log('✅ User is within limits, no popup needed');
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

      // Force show popup regardless of session state
      console.log('⚠️ Force showing popup with data:', limitData);
      await this.showTransactionLimitPopup(limitData);
    } catch (error) {
      console.error('❌ Error force showing popup:', error);
    }
  }

  private async fetchTransactionLimitData(): Promise<TransactionLimitData | null> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('❌ No access token available');
        return null;
      }

      const response = await fetch(`${BASE_URL}/transaction-limits/info`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.code === 200 && result.data) {
        return result.data;
      } else {
        console.error('❌ Failed to fetch transaction limit data:', result);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching transaction limit data:', error);
      return null;
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
