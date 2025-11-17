import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

/**
 * Service for handling proper system notifications using notifee
 * This service manages notification channels and handles foreground/background notifications
 */
class ProperSystemNotificationService {
  private static instance: ProperSystemNotificationService;
  private isInitialized = false;
  private defaultChannelId = 'general_notifications';

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of ProperSystemNotificationService
   */
  public static getInstance(): ProperSystemNotificationService {
    if (!ProperSystemNotificationService.instance) {
      ProperSystemNotificationService.instance =
        new ProperSystemNotificationService();
    }
    return ProperSystemNotificationService.instance;
  }

  /**
   * Initialize the notification service
   * Sets up notification channels and handlers
   */
  public async initializeNotifications(): Promise<boolean> {
    if (this.isInitialized) {
      console.log('✅ ProperSystemNotificationService already initialized');
      return true;
    }

    // Respect user's choice to never be asked again
    const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
    if (neverAsk === 'true') {
      console.log(
        '⚠️ Notification permission previously denied – skipping initialization',
      );
      return false;
    }

    try {
      console.log('🚀 Initializing ProperSystemNotificationService...');

      // Check permission without prompting (NotificationService handles requesting)
      const settings = await notifee.getNotificationSettings();
      if (
        settings.authorizationStatus === AuthorizationStatus.DENIED ||
        settings.authorizationStatus === AuthorizationStatus.NOT_DETERMINED
      ) {
        console.log(
          '⚠️ Notification permission not granted yet - skipping ProperSystemNotificationService initialization',
        );
        return false;
      }

      // Create default notification channel for Android
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: this.defaultChannelId,
          name: 'General Notifications',
          description: 'General notifications for the app',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibration: true,
        });
        console.log('✅ Android notification channel created');
      }

      // Set up foreground message handler
      this.setupForegroundMessageHandler();

      this.isInitialized = true;
      console.log(
        '✅ ProperSystemNotificationService initialized successfully',
      );
      return true;
    } catch (error) {
      console.error(
        '❌ Error initializing ProperSystemNotificationService:',
        error,
      );
      return false;
    }
  }

  /**
   * Set up foreground message handler for Firebase Cloud Messaging
   */
  private setupForegroundMessageHandler(): void {
    try {
      messaging().onMessage(async remoteMessage => {
        console.log('📱 Foreground message received:', remoteMessage);

        const { notification, data } = remoteMessage;

        if (notification) {
          // Display notification using notifee
          await this.displayNotification({
            title: notification.title || 'New Notification',
            body: notification.body || '',
            data: data || {},
          });
        }
      });

      console.log('✅ Foreground message handler set up');
    } catch (error) {
      console.error('❌ Error setting up foreground message handler:', error);
    }
  }

  /**
   * Display a system notification
   */
  public async displayNotification(options: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
    color?: string;
  }): Promise<void> {
    try {
      const channelId = options.channelId || this.defaultChannelId;

      // Ensure channel exists (Android)
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: channelId,
          name: 'General Notifications',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibration: true,
        });
      }

      await notifee.displayNotification({
        title: options.title,
        body: options.body,
        data: options.data || {},
        android: {
          channelId: channelId,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          color: options.color || '#2563EB',
          vibrationPattern: [300, 500],
          pressAction: {
            id: 'default',
          },
          autoCancel: true,
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

      console.log('✅ Notification displayed:', options.title);
    } catch (error) {
      console.error('❌ Error displaying notification:', error);
    }
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export default ProperSystemNotificationService;
