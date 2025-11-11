import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Platform,
  Alert,
  PermissionsAndroid,
  PushNotificationIOS,
} from 'react-native';
import { unifiedApi } from '../api/unifiedApiService';
import ProperSystemNotificationService from './properSystemNotificationService';

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

class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;
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

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize Firebase messaging and request permissions
   * This must be called explicitly after app startup
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
      console.log('🚀 Initializing notifications...');

      // Check if Firebase is available
      if (!messaging) {
        console.error('❌ Firebase messaging not available');
        return false;
      }

      // Ensure user is signed in before prompting for permission or registering token
      const accessTokenForInit = await AsyncStorage.getItem('accessToken');
      if (!accessTokenForInit) {
        console.log('⏭️ Skipping notification permission until after sign-in');
        return false;
      }

      // Do not short-circuit on NOT_DETERMINED; we'll request permission below
      try {
        const currentStatus = await messaging().hasPermission();
        if (currentStatus === messaging.AuthorizationStatus.DENIED) {
          console.log('⚠️ Notifications currently denied by user');
          await AsyncStorage.setItem('notificationsNeverAsk', 'true');
          return false;
        }
      } catch {}

      // Initialize proper system notifications
      const properNotificationService =
        ProperSystemNotificationService.getInstance();
      await properNotificationService.initializeNotifications();

      // Request permission for iOS (skip if previously granted)
      if (Platform.OS === 'ios') {
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');
        const authStatus =
          grantedFlag === 'true'
            ? messaging.AuthorizationStatus.AUTHORIZED
            : await messaging().requestPermission();
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

        // Also request the general notification permission to ensure tokens are issued
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');
        const authStatus =
          grantedFlag === 'true'
            ? messaging.AuthorizationStatus.AUTHORIZED
            : await messaging().requestPermission();
        console.log('📱 Android permission status:', authStatus);
        if (
          authStatus === messaging.AuthorizationStatus.DENIED ||
          authStatus === messaging.AuthorizationStatus.NOT_DETERMINED
        ) {
          await AsyncStorage.setItem('notificationsNeverAsk', 'true');
          return false;
        }
      }

      // Get FCM token
      const token = await this.getFCMToken();
      if (!token) {
        console.error('❌ Failed to get FCM token');
        return false;
      }
      // Persist granted if we have a token
      await AsyncStorage.setItem('notificationsGranted', 'true');

      // Set up message handlers
      this.setupMessageHandlers();

      // Load notification settings
      await this.loadNotificationSettings();

      this.isInitialized = true;
      console.log('✅ Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      return false;
    }
  }

  /**
   * Get FCM token and save it
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

      // Check if we have permission first
      const authStatus = await messaging().hasPermission();
      console.log('🔧 Permission status:', authStatus);
      if (authStatus === messaging.AuthorizationStatus.DENIED) {
        console.log('❌ Notification permission denied');
        return null;
      }

      console.log('🔧 Calling messaging().getToken()...');
      const token = await messaging().getToken();
      console.log(
        '🔧 Token received from Firebase:',
        token ? `${token.substring(0, 20)}...` : 'null',
      );

      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcmToken', token);
        console.log('✅ FCM Token obtained (FULL):', token);
        console.log('✅ FCM Token length:', token.length);
        console.log('✅ FCM Token first 20 chars:', token.substring(0, 20));
        console.log(
          '✅ FCM Token last 20 chars:',
          token.substring(token.length - 20),
        );

        // Don't automatically send to backend - let the calling code decide when to send
        console.log('🔧 FCM token obtained, ready for backend registration');

        return token;
      } else {
        console.log('❌ No FCM token received');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      console.error('🔧 Full error details in getFCMToken:', error);
      return null;
    }
  }

  /**
   * Manually send FCM token to backend (public method)
   */
  public async sendTokenToBackend(token?: string): Promise<boolean> {
    const tokenToSend = token || this.fcmToken;
    if (!tokenToSend) {
      console.log('❌ No FCM token available to send to backend');
      return false;
    }

    try {
      await this.sendTokenToBackendInternal(tokenToSend);
      return true;
    } catch (error) {
      console.error('❌ Error sending FCM token to backend:', error);
      return false;
    }
  }

  /**
   * Send FCM token to backend for server-side notifications (internal method)
   */
  private async sendTokenToBackendInternal(token: string): Promise<void> {
    try {
      console.log(
        '🔧 sendTokenToBackend called with token:',
        token ? `${token.substring(0, 20)}...` : 'null',
      );

      // Avoid duplicate registration if token hasn't changed
      const lastRegistered = await AsyncStorage.getItem(
        'lastRegisteredFcmToken',
      );
      if (lastRegistered === token) {
        console.log('⏭️ Skipping backend registration; token unchanged');
        return;
      }

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.log('⚠️ No access token available for FCM registration');
        return;
      }

      console.log('📤 Sending FCM token to backend...');
      console.log('🔧 Backend URL:', '/notifications/register-token');
      console.log('🔧 Device Type:', Platform.OS);
      console.log('🔧 Access Token length:', accessToken.length);

      const requestBody = {
        token: token,
        deviceType: Platform.OS,
      };
      console.log('🔧 Request body:', requestBody);

      // Use unified API
      const response = (await unifiedApi.post(
        '/notifications/register-token',
        requestBody,
      )) as { data: any; status: number; headers: Headers };

      // unifiedApi returns { data, status, headers } structure
      console.log('🔧 Response status:', response.status);

      if (response.status >= 200 && response.status < 300) {
        const responseData = response.data || response;
        console.log('✅ FCM token sent to backend successfully');
        console.log('🔧 Backend response:', responseData);
        await AsyncStorage.setItem('lastRegisteredFcmToken', token);
      } else {
        console.log('❌ Failed to send FCM token to backend:', response.status);
        console.log('🔧 Error response:', response.data);
      }
    } catch (error) {
      console.error('❌ Error sending FCM token to backend:', error);
      console.error('🔧 Full error details:', error);
    }
  }

  /**
   * Set up message handlers for proper system notifications
   */
  private setupMessageHandlers(): void {
    console.log('🔧 Setting up message handlers...');

    // Use the proper system notification service for all handlers
    const properNotificationService =
      ProperSystemNotificationService.getInstance();

    // Note: Background handler is now registered at app level
    //  (index.js)
    // Foreground and notification open handlers are handled by ProperSystemNotificationService

    console.log('✅ Message handlers set up successfully');

    // Handle FCM token refresh and re-register with backend if available
    messaging().onTokenRefresh(async newToken => {
      try {
        this.fcmToken = newToken;
        await AsyncStorage.setItem('fcmToken', newToken);
        await this.sendTokenToBackend(newToken);
      } catch (error) {
        console.error('❌ Error handling token refresh:', error);
      }
    });
  }

  /**
   * Show local notification when app is in foreground
   * Now shows proper system notification instead of alert dialog
   */
  private showLocalNotification(remoteMessage: any): void {
    const { notification, data } = remoteMessage;

    if (notification) {
      console.log('📱 Showing local notification:', notification);

      // Use proper system notifications instead of custom components
      if (Platform.OS === 'ios') {
        // iOS: Use a simpler approach for local notifications
        try {
          // For iOS, we'll use the custom notification component for now
          // since PushNotificationIOS.addNotificationRequest is not available
          this.showCustomNotification(notification, data, remoteMessage);
        } catch (error) {
          console.error('❌ Error showing iOS notification:', error);
        }
      } else {
        // Android: Use a proper system notification approach
        this.showAndroidSystemNotification(notification, data, remoteMessage);
      }
    }
  }

  /**
   * Show custom notification using the custom component
   */
  private showCustomNotification(
    notification: any,
    data: any,
    remoteMessage: any,
  ): void {
    // Store the notification data for the custom component to access
    this.currentNotification = {
      title: notification.title || 'New Notification',
      body: notification.body || '',
      data: data || {},
      remoteMessage: remoteMessage,
    };

    // Trigger the notification display
    this.triggerCustomNotification();
  }

  /**
   * Show Android system notification
   */
  private showAndroidSystemNotification(
    notification: any,
    data: any,
    remoteMessage: any,
  ): void {
    // For Android, we'll use a proper system notification approach
    // This will show a notification that appears in the system notification tray

    // Create a notification that looks like a system notification
    // We'll use the custom component but style it to look like a system notification
    this.showCustomNotification(notification, data, remoteMessage);

    // Also log the notification for debugging
    console.log('📱 Android notification data:', {
      title: notification.title,
      body: notification.body,
      data: data,
      timestamp: new Date().toISOString(),
    });
  }

  // Add properties to store current notification and callback
  private currentNotification: any = null;
  private onCustomNotification: ((notification: any) => void) | null = null;

  /**
   * Set callback for custom notification display
   */
  public setCustomNotificationHandler(
    callback: (notification: any) => void,
  ): void {
    this.onCustomNotification = callback;
  }

  /**
   * Trigger custom notification display
   */
  private triggerCustomNotification(): void {
    if (this.onCustomNotification && this.currentNotification) {
      this.onCustomNotification(this.currentNotification);
    }
  }

  /**
   * Handle notification data for processing
   */
  private handleNotificationData(remoteMessage: any): void {
    const { data } = remoteMessage;
    if (data) {
      this.storeNotificationData(data);
    }
  }

  /**
   * Handle notification view action
   */
  public handleNotificationView(): void {
    if (this.currentNotification) {
      this.handleNotificationOpen(this.currentNotification.remoteMessage);
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
   * Get current FCM token (synchronous)
   */
  public getCurrentFCMToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Refresh FCM token
   */
  public async refreshFCMToken(): Promise<string | null> {
    return await this.getFCMToken();
  }

  /**
   * Check if notifications are enabled
   */
  public isNotificationsEnabled(): boolean {
    return this.notificationSettings.enabled;
  }

  /**
   * Enable/disable notifications
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
   * Force re-initialization (useful for debugging)
   */
  public async reinitialize(): Promise<boolean> {
    this.isInitialized = false;
    return await this.initializeNotifications();
  }

  /**
   * Create notification channel for Android
   */
  private async createNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        // For now, we'll skip channel creation since notifee is not installed
        // The Firebase messaging will handle basic notifications
        console.log('✅ Using default Firebase notification channel');
      } catch (error) {
        console.error('❌ Error with notification channel:', error);
      }
    }
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export default NotificationService;
