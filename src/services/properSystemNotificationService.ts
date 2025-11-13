import messaging from '@react-native-firebase/messaging';
import app from '@react-native-firebase/app';
import notifee, {
  AndroidImportance,
  AndroidStyle,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform, PermissionsAndroid } from 'react-native';
import { unifiedApi } from '../api/unifiedApiService';

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  invoiceNotifications: boolean;
  paymentNotifications: boolean;
  systemNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

class ProperSystemNotificationService {
  private static instance: ProperSystemNotificationService;
  private fcmToken: string | null = null;

  /**
   * Check if Firebase is initialized
   */
  private isFirebaseInitialized(): boolean {
    try {
      // React Native Firebase auto-initializes from google-services.json
      // Try to access the default app - if it throws, Firebase isn't initialized
      const apps = app.apps;
      const defaultApp = apps.find((a: any) => a.name === '[DEFAULT]');
      return defaultApp !== null && defaultApp !== undefined;
    } catch (error) {
      // If accessing apps throws, Firebase isn't initialized
      return false;
    }
  }

  /**
   * Safely get messaging instance
   */
  private getMessaging() {
    if (!this.isFirebaseInitialized()) {
      throw new Error(
        'Firebase is not initialized. Please ensure google-services.json is properly configured.',
      );
    }
    return messaging();
  }
  private notificationSettings: NotificationSettings = {
    enabled: true,
    invoiceNotifications: true,
    paymentNotifications: true,
    systemNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
  };
  private isInitialized = false;

  private constructor() {
    // Don't auto-initialize, let it be called explicitly
  }

  public static getInstance(): ProperSystemNotificationService {
    if (!ProperSystemNotificationService.instance) {
      ProperSystemNotificationService.instance =
        new ProperSystemNotificationService();
    }
    return ProperSystemNotificationService.instance;
  }

  /**
   * Initialize Firebase messaging and request permissions
   */
  public async initializeNotifications(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('✅ Notifications already initialized');
      return true;
    }

    // Respect user's choice to never be asked again - check FIRST before any permission requests
    const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
    if (neverAsk === 'true') {
      console.log(
        '⚠️ Notification permission previously denied – never asking again',
      );
      return false;
    }

    try {
      console.log('🚀 Initializing proper system notifications...');

      // Ensure user is signed in before prompting for permission or registering token
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.log('⏭️ Skipping notification permission until after sign-in');
        return false;
      }

      // Check if Firebase is available
      if (!messaging) {
        console.error('❌ Firebase messaging not available');
        return false;
      }

      // Create notification channel for Android
      if (Platform.OS === 'android') {
        await this.createNotificationChannel();
      }

      // Do not short-circuit on NOT_DETERMINED; we'll request permission below
      try {
        if (!this.isFirebaseInitialized()) {
          console.warn(
            '⚠️ Firebase not initialized, skipping permission check',
          );
          return false;
        }
        const currentStatus = await this.getMessaging().hasPermission();
        if (currentStatus === messaging.AuthorizationStatus.DENIED) {
          console.log('⚠️ Notifications currently denied by user');
          await AsyncStorage.setItem('notificationsNeverAsk', 'true');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ Error checking notification permission:', error);
        return false;
      }

      // Request permission for iOS (skip if previously granted)
      if (Platform.OS === 'ios') {
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');
        const authStatus =
          grantedFlag === 'true'
            ? messaging.AuthorizationStatus.AUTHORIZED
            : await this.getMessaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        console.log('📱 iOS permission status:', authStatus);
        if (!enabled) {
          console.log('❌ iOS notification permission denied');
          // Set never ask flag if denied
          await AsyncStorage.setItem('notificationsNeverAsk', 'true');
          return false;
        }
      }

      // Request permission for Android
      if (Platform.OS === 'android') {
        // Check if we need to request POST_NOTIFICATIONS permission (Android 13+)
        if (Platform.Version >= 33) {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          if (!hasPermission) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              {
                title: 'Notification Permission',
                message:
                  'This app needs notification permission to send you important updates.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              },
            );

            if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              console.log(
                '❌ Android notification permission denied - never ask again',
              );
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              return false;
            }
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              console.log('❌ Android notification permission denied');
              // If user clicks Cancel (DENIED), also set flag to stop asking
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              return false;
            }
          }
        }
        // Also request Firebase messaging permission to ensure tokens are issued
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');
        if (grantedFlag !== 'true' && this.isFirebaseInitialized()) {
          await this.getMessaging().requestPermission();
        }
      }

      // Get FCM token
      let token = await this.getFCMToken();
      if (!token) {
        console.log('❌ Failed to get FCM token, checking stored token...');
        // Don't return false immediately - try to register anyway if token exists in storage
        const storedToken = await AsyncStorage.getItem('fcmToken');
        if (storedToken) {
          // Use stored token if available
          console.log('📋 Using stored FCM token for registration');
          token = storedToken;
          this.fcmToken = token;
          // Try to register stored token with backend
          await this.sendTokenToBackend(token);
        } else {
          return false;
        }
      } else {
        // Persist granted if we have a token
        await AsyncStorage.setItem('notificationsGranted', 'true');
      }

      // Set up message handlers
      this.setupMessageHandlers();

      // Load notification settings
      await this.loadNotificationSettings();

      this.isInitialized = true;
      console.log('✅ Proper system notifications initialized successfully');
      return true;
    } catch (error) {
      console.error(
        '❌ Error initializing proper system notifications:',
        error,
      );
      return false;
    }
  }

  /**
   * Create notification channel for Android
   */
  private async createNotificationChannel(): Promise<void> {
    try {
      // Create the notification channel
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        description: 'Default notification channel',
        sound: 'default',
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [300, 500],
        lights: true,
        lightColor: '#4f8cff',
      });

      console.log('✅ Android notification channel created successfully');
    } catch (error) {
      console.error('❌ Error creating notification channel:', error);
    }
  }

  /**
   * Get FCM token with full logging
   */
  public async getFCMToken(): Promise<string | null> {
    try {
      // Check if user has declined and we should never ask again
      const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
      if (neverAsk === 'true') {
        console.log(
          '⚠️ Notification permission declined - skipping token fetch',
        );
        return null;
      }

      console.log('🔑 Getting FCM token...');

      // Check if Firebase is initialized
      if (!this.isFirebaseInitialized()) {
        console.warn('⚠️ Firebase not initialized, cannot get FCM token');
        return null;
      }

      // Check if we have permission first
      const authStatus = await this.getMessaging().hasPermission();
      if (authStatus === messaging.AuthorizationStatus.DENIED) {
        console.log('❌ Notification permission denied');
        return null;
      }

      const token = await this.getMessaging().getToken();
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcmToken', token);

        // Log full token details
        console.log('✅ FCM Token obtained (FULL):', token);
        console.log('✅ FCM Token length:', token.length);
        console.log('✅ FCM Token first 20 chars:', token.substring(0, 20));
        console.log(
          '✅ FCM Token last 20 chars:',
          token.substring(token.length - 20),
        );

        // Send token to backend
        await this.sendTokenToBackend(token);

        return token;
      } else {
        console.log('❌ No FCM token received');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Send FCM token to backend
   */
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.log('⚠️ No access token available for FCM registration');
        return;
      }

      // Avoid duplicate registration if token hasn't changed
      const lastRegistered = await AsyncStorage.getItem(
        'lastRegisteredFcmToken',
      );
      if (lastRegistered === token) {
        console.log('⏭️ Skipping backend registration; token unchanged');
        return;
      }

      console.log('📤 Sending FCM token to backend...');
      console.log('📤 Token (first 20 chars):', token.substring(0, 20) + '...');
      console.log('📤 Device Type:', Platform.OS);
      console.log('📤 API URL:', '/notifications/register-token');

      // Use unified API
      const response = await unifiedApi.post('/notifications/register-token', {
        token: token,
        deviceType: Platform.OS,
      });

      console.log('📤 Response:', response);

      if (response) {
        console.log('✅ FCM token sent to backend successfully:', response);
        await AsyncStorage.setItem('lastRegisteredFcmToken', token);
      } else {
        console.error('❌ Failed to send FCM token to backend');
        // Don't store lastRegisteredFcmToken if registration failed,
        // so it will retry on next attempt
      }
    } catch (error) {
      console.error('❌ Error sending FCM token to backend:', error);
      console.error('❌ Error details:', JSON.stringify(error));
      // Don't store lastRegisteredFcmToken if registration failed,
      // so it will retry on next attempt
    }
  }

  /**
   * Set up message handlers for proper system notifications
   */
  private setupMessageHandlers(): void {
    console.log('🔧 Setting up proper system message handlers...');

    // Check if Firebase is initialized before setting up handlers
    if (!this.isFirebaseInitialized()) {
      console.warn(
        '⚠️ Firebase not initialized, cannot set up message handlers',
      );
      return;
    }

    const msg = this.getMessaging();

    // Handle foreground messages - show as system notifications
    msg.onMessage(async remoteMessage => {
      console.log('📱 Foreground message received:', remoteMessage);

      if (this.notificationSettings.enabled) {
        // Show as system notification using Notifee
        await this.showSystemNotification(remoteMessage);
      }
    });

    // Handle FCM token refresh
    msg.onTokenRefresh(async (token: string) => {
      try {
        console.log('🔄 FCM token refreshed');
        this.fcmToken = token;
        await AsyncStorage.setItem('fcmToken', token);
        await this.sendTokenToBackend(token);
      } catch (error) {
        console.error('❌ Error handling token refresh:', error);
      }
    });

    // Handle background messages
    msg.setBackgroundMessageHandler(async remoteMessage => {
      console.log('📱 Background message received:', remoteMessage);
      this.handleBackgroundNotification(remoteMessage);
    });

    // Handle notification open
    msg.onNotificationOpenedApp(remoteMessage => {
      console.log('📱 Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Handle initial notification (app opened from notification)
    msg
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 Initial notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      })
      .catch(error => {
        console.error('❌ Error getting initial notification:', error);
      });
  }

  /**
   * Show system notification using Notifee
   */
  private async showSystemNotification(remoteMessage: any): Promise<void> {
    try {
      const { notification, data } = remoteMessage;

      if (notification) {
        console.log('📱 Showing system notification:', notification);

        // Display the notification using Notifee
        await notifee.displayNotification({
          title: notification.title || 'New Notification',
          body: notification.body || '',
          data: data || {},
          android: {
            channelId: 'default',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [300, 500],
            color: '#4f8cff',
            pressAction: {
              id: 'default',
            },
            actions: [
              {
                title: 'View',
                pressAction: {
                  id: 'view',
                },
              },
              {
                title: 'Dismiss',
                pressAction: {
                  id: 'dismiss',
                },
              },
            ],
          },
          ios: {
            foregroundPresentationOptions: {
              badge: true,
              sound: true,
              banner: true,
              list: true,
            },
            sound: 'default',
            attachments: [],
            categoryId: 'default',
          },
        });

        console.log('✅ System notification displayed successfully');
      }
    } catch (error) {
      console.error('❌ Error showing system notification:', error);
    }
  }

  /**
   * Handle background notification
   */
  private handleBackgroundNotification(remoteMessage: any): void {
    const { data } = remoteMessage;

    if (data) {
      this.storeNotificationData(data);
    }
  }

  /**
   * Handle notification open/click
   */
  private handleNotificationOpen(remoteMessage: any): void {
    const { data } = remoteMessage;

    if (data) {
      // Store notification data for navigation handling
      this.storeNotificationData(data);

      // You can implement custom navigation logic here
      console.log('📱 Notification data for navigation:', data);
    }
  }

  /**
   * Store notification data for offline processing
   */
  private async storeNotificationData(
    data: Record<string, string>,
  ): Promise<void> {
    try {
      const notifications = await AsyncStorage.getItem('pendingNotifications');
      const pendingNotifications = notifications
        ? JSON.parse(notifications)
        : [];

      pendingNotifications.push({
        ...data,
        timestamp: new Date().toISOString(),
      });

      await AsyncStorage.setItem(
        'pendingNotifications',
        JSON.stringify(pendingNotifications),
      );
    } catch (error) {
      console.error('❌ Error storing notification data:', error);
    }
  }

  /**
   * Load notification settings from storage
   */
  private async loadNotificationSettings(): Promise<void> {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        this.notificationSettings = {
          ...this.notificationSettings,
          ...JSON.parse(settings),
        };
      }
    } catch (error) {
      console.error('❌ Error loading notification settings:', error);
    }
  }

  /**
   * Save notification settings to storage
   */
  public async saveNotificationSettings(
    settings: Partial<NotificationSettings>,
  ): Promise<void> {
    try {
      this.notificationSettings = { ...this.notificationSettings, ...settings };
      await AsyncStorage.setItem(
        'notificationSettings',
        JSON.stringify(this.notificationSettings),
      );
    } catch (error) {
      console.error('❌ Error saving notification settings:', error);
    }
  }

  /**
   * Get current notification settings
   */
  public getNotificationSettings(): NotificationSettings {
    return { ...this.notificationSettings };
  }

  /**
   * Get current FCM token
   */
  public getCurrentFCMToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Refresh FCM token
   */
  public async refreshFCMToken(): Promise<string | null> {
    try {
      if (!this.isFirebaseInitialized()) {
        console.warn('⚠️ Firebase not initialized, cannot refresh FCM token');
        return null;
      }
      const token = await this.getMessaging().getToken();
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcmToken', token);
        await this.sendTokenToBackend(token);
        return token;
      }
      return null;
    } catch (error) {
      console.error('❌ Error refreshing FCM token:', error);
      return null;
    }
  }

  /**
   * Check if notifications are enabled
   */
  public isNotificationsEnabled(): boolean {
    return this.notificationSettings.enabled;
  }

  /**
   * Toggle notifications on/off
   */
  public async toggleNotifications(enabled: boolean): Promise<void> {
    await this.saveNotificationSettings({ enabled });
  }

  /**
   * Get pending notifications
   */
  public async getPendingNotifications(): Promise<any[]> {
    try {
      const notifications = await AsyncStorage.getItem('pendingNotifications');
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('❌ Error getting pending notifications:', error);
      return [];
    }
  }

  /**
   * Clear pending notifications
   */
  public async clearPendingNotifications(): Promise<void> {
    try {
      await AsyncStorage.removeItem('pendingNotifications');
    } catch (error) {
      console.error('❌ Error clearing pending notifications:', error);
    }
  }

  /**
   * Reinitialize notifications
   */
  public async reinitialize(): Promise<boolean> {
    this.isInitialized = false;
    return await this.initializeNotifications();
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Test system notification
   */
  public async testSystemNotification(): Promise<void> {
    try {
      console.log('🧪 Testing system notification...');

      await notifee.displayNotification({
        title: 'Test System Notification',
        body: 'This is a test notification to verify system notifications are working properly.',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
          testId: Math.random().toString(36).substring(7),
        },
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [300, 500],
          color: '#4f8cff',
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          foregroundPresentationOptions: {
            badge: true,
            sound: true,
            banner: true,
            list: true,
          },
          sound: 'default',
        },
      });

      console.log('✅ Test system notification displayed');
    } catch (error) {
      console.error('❌ Error testing system notification:', error);
    }
  }
}

export default ProperSystemNotificationService;
