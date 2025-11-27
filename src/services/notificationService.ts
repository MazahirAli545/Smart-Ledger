import messaging from '@react-native-firebase/messaging';
import app from '@react-native-firebase/app';
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
  private isInitializing = false; // Prevent multiple simultaneous initialization attempts

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

  /**
   * Check if user has declined notification permission
   * This is a public method that can be called from anywhere to check before initializing
   */
  public async hasUserDeclinedNotifications(): Promise<boolean> {
    try {
      // First check AsyncStorage flag
      const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
      if (neverAsk === 'true') {
        console.log(
          '⚠️ User has declined notification permission (stored flag)',
        );
        return true;
      }

      // For Android, check both Firebase and system permission status
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          // Check Android system permission first
          const hasAndroidPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          // Check if we have the granted flag
          const grantedFlag = await AsyncStorage.getItem(
            'notificationsGranted',
          );

          // If Android permission is NOT granted AND we don't have granted flag,
          // it could mean:
          // 1. Never asked (first time) - should ask
          // 2. Previously denied - should NOT ask
          //
          // To distinguish, check Firebase status
          if (!hasAndroidPermission && grantedFlag !== 'true') {
            if (this.isFirebaseInitialized()) {
              try {
                const firebaseStatus =
                  await this.getMessaging().hasPermission();
                console.log('🔍 Android permission check:', {
                  hasAndroidPermission,
                  grantedFlag,
                  firebaseStatus,
                });

                // If Firebase shows DENIED, definitely don't ask
                if (firebaseStatus === messaging.AuthorizationStatus.DENIED) {
                  console.log(
                    '⚠️ System shows notification permission as DENIED (Firebase)',
                  );
                  await AsyncStorage.setItem('notificationsNeverAsk', 'true');
                  return true;
                }

                // If Firebase shows NOT_DETERMINED, we need to determine if this is:
                // 1. First time (never asked) - should ask
                // 2. Previously denied, then app data cleared - should NOT ask
                //
                // CRITICAL: If Android permission is NOT granted and we don't have the granted flag,
                // and Firebase shows NOT_DETERMINED, it's ambiguous. However, to avoid annoying
                // users who previously declined, we should be conservative and NOT ask again.
                //
                // The only safe time to ask is if we can prove it's truly the first time.
                // Since we can't distinguish perfectly after app data is cleared, we'll
                // err on the side of NOT asking to respect the user's previous choice.
                if (
                  firebaseStatus ===
                  messaging.AuthorizationStatus.NOT_DETERMINED
                ) {
                  console.log(
                    '⚠️ Android permission not granted, Firebase shows NOT_DETERMINED',
                  );
                  console.log(
                    '⚠️ This could be first time OR previously denied - being conservative and NOT asking',
                  );
                  console.log(
                    '⚠️ Setting neverAsk flag to prevent popup (user can enable in settings if needed)',
                  );
                  // Set flag to prevent asking - this respects user's previous choice
                  // If they really want notifications, they can enable in app settings
                  await AsyncStorage.setItem('notificationsNeverAsk', 'true');
                  return true;
                }
              } catch (error) {
                console.warn('⚠️ Error checking Firebase permission:', error);
                // If we can't check Firebase, be conservative
                if (!hasAndroidPermission && grantedFlag !== 'true') {
                  console.log(
                    '⚠️ Cannot verify permission status - being conservative and not asking',
                  );
                  await AsyncStorage.setItem('notificationsNeverAsk', 'true');
                  return true;
                }
              }
            } else {
              // Firebase not initialized, but Android permission not granted
              // Be conservative
              console.log(
                '⚠️ Firebase not initialized, Android permission not granted - being conservative',
              );
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              return true;
            }
          }
        } catch (error) {
          console.warn('⚠️ Error checking Android system permission:', error);
        }
      } else if (Platform.OS === 'android') {
        // For Android < 13, check Firebase status
        try {
          if (this.isFirebaseInitialized()) {
            const status = await this.getMessaging().hasPermission();
            if (status === messaging.AuthorizationStatus.DENIED) {
              console.log(
                '⚠️ System shows notification permission as DENIED (Firebase)',
              );
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              return true;
            }
          }
        } catch (error) {
          console.warn('⚠️ Error checking system permission:', error);
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking if user declined:', error);
      return false;
    }
  }

  /**
   * Initialize Firebase messaging and request permissions
   * This must be called explicitly after app startup
   */
  public async initializeNotifications(): Promise<boolean> {
    // CRITICAL: Check if user declined FIRST, before any other checks
    const userDeclined = await this.hasUserDeclinedNotifications();
    if (userDeclined) {
      console.log(
        '⚠️ Notification permission previously denied – skipping ALL initialization',
      );
      return false;
    }

    if (this.isInitialized) {
      console.log('✅ Notifications already initialized');
      return true;
    }

    // Prevent multiple simultaneous initialization attempts
    if (this.isInitializing) {
      console.log(
        '⏸️ Notification initialization already in progress, waiting...',
      );
      // Wait a bit and check if initialized
      await new Promise(resolve => setTimeout(resolve, 500));
      if (this.isInitialized) {
        return true;
      }
      // Re-check if user declined while waiting
      const declinedWhileWaiting = await this.hasUserDeclinedNotifications();
      if (declinedWhileWaiting) {
        console.log('⚠️ User declined while waiting for initialization');
        return false;
      }
      // If still not initialized after wait, allow this call to proceed
      // (in case the other call failed)
      console.log(
        '⚠️ Previous initialization attempt may have failed, proceeding...',
      );
    }

    // Set initializing flag
    this.isInitializing = true;

    try {
      console.log('🚀 Initializing notifications...');

      // Check if Firebase is initialized
      if (!this.isFirebaseInitialized()) {
        console.warn(
          '⚠️ Firebase not initialized, skipping notification initialization',
        );
        this.isInitializing = false;
        return false;
      }

      // Ensure user is signed in before prompting for permission or registering token
      const accessTokenForInit = await AsyncStorage.getItem('accessToken');
      if (!accessTokenForInit) {
        console.log('⏭️ Skipping notification permission until after sign-in');
        this.isInitializing = false;
        return false;
      }

      // Check actual system permission status FIRST before checking AsyncStorage
      // This handles the case where app was cleared and AsyncStorage was reset
      let currentStatus: number;
      let systemPermissionDenied = false;

      // For Android, check system permission state first (before Firebase check)
      // This helps detect if permission was previously denied even after app data clear
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const androidPermissionState = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          console.log(
            '🔍 Android POST_NOTIFICATIONS system check (before Firebase):',
            androidPermissionState,
          );

          // If Android permission is not granted, we'll check Firebase status
          // But we'll be more conservative about requesting
          if (!androidPermissionState) {
            console.log(
              '⚠️ Android POST_NOTIFICATIONS not granted at system level',
            );
          }
        } catch (error) {
          console.warn('⚠️ Error checking Android permission early:', error);
        }
      }

      try {
        currentStatus = await this.getMessaging().hasPermission();
        console.log(
          '🔍 Current Firebase notification permission status:',
          currentStatus,
        );

        // If system shows DENIED, respect it immediately and set flag
        if (currentStatus === messaging.AuthorizationStatus.DENIED) {
          console.log(
            '⚠️ Notifications currently denied by user (Firebase status shows DENIED)',
          );
          systemPermissionDenied = true;
          await AsyncStorage.setItem('notificationsNeverAsk', 'true');
          this.isInitializing = false;
          return false;
        }

        // If already authorized, skip permission request
        if (
          currentStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          currentStatus === messaging.AuthorizationStatus.PROVISIONAL
        ) {
          console.log(
            '✅ Notification permission already granted, skipping request',
          );
          // Set the flag so we don't ask again
          await AsyncStorage.setItem('notificationsGranted', 'true');
        }
      } catch (error) {
        console.warn('⚠️ Error checking permission:', error);
        currentStatus = messaging.AuthorizationStatus.NOT_DETERMINED;
      }

      // For Android, check POST_NOTIFICATIONS permission status FIRST
      // This is critical because after clearing app data, Firebase might return NOT_DETERMINED
      // even though the system permission is still denied
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const hasPostNotificationPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          console.log(
            '🔍 Android POST_NOTIFICATIONS check result:',
            hasPostNotificationPermission,
          );

          // If POST_NOTIFICATIONS is NOT granted, check if Firebase also shows denied
          if (!hasPostNotificationPermission) {
            // If Firebase shows DENIED, definitely don't ask (user previously denied)
            if (
              systemPermissionDenied ||
              currentStatus === messaging.AuthorizationStatus.DENIED
            ) {
              console.log(
                '⚠️ Android POST_NOTIFICATIONS permission denied (Firebase also shows DENIED)',
              );
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              this.isInitializing = false;
              return false;
            }
            // If Firebase shows NOT_DETERMINED, we'll proceed to request below
            // but we'll handle the response properly
          } else {
            // Permission is granted, so we're good
            console.log(
              '✅ Android POST_NOTIFICATIONS permission already granted',
            );
          }
        } catch (error) {
          console.warn(
            '⚠️ Error checking Android POST_NOTIFICATIONS permission:',
            error,
          );
        }
      }

      // Note: We already checked hasUserDeclinedNotifications() at the start
      // This is just a final safety check
      const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
      if (neverAsk === 'true') {
        console.log(
          '⚠️ Notification permission previously denied (final safety check) – never asking again',
        );
        this.isInitializing = false;
        return false;
      }

      // Initialize proper system notifications
      const properNotificationService =
        ProperSystemNotificationService.getInstance();
      await properNotificationService.initializeNotifications();

      // Only request permission if NOT_DETERMINED (not yet asked)
      // For iOS
      if (Platform.OS === 'ios') {
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');

        // If we already have the flag set, skip request
        if (grantedFlag === 'true') {
          console.log(
            '✅ iOS: notificationsGranted flag set, skipping permission request',
          );
        } else if (
          currentStatus === messaging.AuthorizationStatus.NOT_DETERMINED
        ) {
          // Only request if status is NOT_DETERMINED
          console.log('📱 iOS: Requesting notification permission...');
          const authStatus = await this.getMessaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

          console.log('📱 iOS permission status:', authStatus);
          if (!enabled) {
            console.log('❌ iOS notification permission denied');
            // Set never ask flag if denied
            await AsyncStorage.setItem('notificationsNeverAsk', 'true');
            this.isInitializing = false;
            return false;
          }
          // Set granted flag on success
          await AsyncStorage.setItem('notificationsGranted', 'true');
        } else {
          console.log(
            '✅ iOS: Permission already determined, skipping request',
          );
        }
      }

      // For Android
      if (Platform.OS === 'android') {
        const grantedFlag = await AsyncStorage.getItem('notificationsGranted');

        // Check if we need to request POST_NOTIFICATIONS permission (Android 13+)
        if (Platform.Version >= 33) {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );

          console.log(
            '🔍 Android POST_NOTIFICATIONS check:',
            hasPermission,
            'Firebase status:',
            currentStatus,
            'Granted flag:',
            grantedFlag,
          );

          // Only request if:
          // 1. Permission is not granted
          // 2. We don't have the granted flag set
          // 3. Firebase status is NOT_DETERMINED (first time asking)
          // 4. We haven't set the neverAsk flag earlier
          if (
            !hasPermission &&
            grantedFlag !== 'true' &&
            currentStatus === messaging.AuthorizationStatus.NOT_DETERMINED
          ) {
            // CRITICAL: Triple-check neverAsk flag right before requesting
            // Also re-check hasUserDeclinedNotifications to catch any system-level denials
            const neverAskBeforeRequest = await AsyncStorage.getItem(
              'notificationsNeverAsk',
            );
            if (neverAskBeforeRequest === 'true') {
              console.log(
                '⚠️ Android: neverAsk flag set right before request - skipping',
              );
              this.isInitializing = false;
              return false;
            }

            // Also check if user declined using our helper method
            const userDeclinedCheck = await this.hasUserDeclinedNotifications();
            if (userDeclinedCheck) {
              console.log(
                '⚠️ Android: User declined detected right before request - skipping',
              );
              this.isInitializing = false;
              return false;
            }

            // One final check after a tiny delay to catch any race conditions
            await new Promise(resolve => setTimeout(resolve, 100));
            const finalCheck = await AsyncStorage.getItem(
              'notificationsNeverAsk',
            );
            if (finalCheck === 'true') {
              console.log(
                '⚠️ Android: neverAsk flag set during delay - skipping request',
              );
              this.isInitializing = false;
              return false;
            }

            console.log(
              '📱 Android: Requesting POST_NOTIFICATIONS permission...',
            );
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

            console.log(
              '📱 Android POST_NOTIFICATIONS request result:',
              granted,
            );

            if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              console.log(
                '❌ Android notification permission denied - never ask again',
              );
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');
              this.isInitializing = false;
              return false;
            }
            // Handle DENIED (Cancel/Don't allow clicked) - set flag to never ask again
            if (granted === PermissionsAndroid.RESULTS.DENIED) {
              console.log(
                "❌ Android notification permission denied (Cancel/Don't allow clicked)",
              );
              console.log('🔧 Setting notificationsNeverAsk flag to true...');

              // If user clicks Cancel/Don't allow (DENIED), set flag to stop asking
              // This prevents showing the Firebase messaging permission popup
              await AsyncStorage.setItem('notificationsNeverAsk', 'true');

              // Verify the flag was saved - try multiple times if needed
              let verifyFlag = await AsyncStorage.getItem(
                'notificationsNeverAsk',
              );
              console.log(
                '🔍 First verification of neverAsk flag after denial:',
                verifyFlag,
              );

              if (verifyFlag !== 'true') {
                console.error(
                  '❌ CRITICAL: Failed to save neverAsk flag! Retrying...',
                );
                await AsyncStorage.setItem('notificationsNeverAsk', 'true');
                // Wait a bit and verify again
                await new Promise(resolve => setTimeout(resolve, 50));
                verifyFlag = await AsyncStorage.getItem(
                  'notificationsNeverAsk',
                );
                console.log('🔍 Second verification after retry:', verifyFlag);

                if (verifyFlag !== 'true') {
                  console.error(
                    '❌ CRITICAL: Still failed to save flag after retry!',
                  );
                  // Try one more time
                  await AsyncStorage.setItem('notificationsNeverAsk', 'true');
                }
              } else {
                console.log('✅ neverAsk flag successfully saved and verified');
              }

              this.isInitializing = false;
              return false;
            }
            // Handle any other non-GRANTED result (e.g., if buttonNeutral returns something else)
            // Still return false to avoid showing Firebase popup, but don't set neverAsk flag
            // so user can be asked again later
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
              console.log(
                '⏸️ Android: Permission not granted (may be Ask Me Later) - will ask again later',
                'Result:',
                granted,
              );
              this.isInitializing = false;
              return false;
            }
            // Set granted flag on success
            console.log('✅ Android POST_NOTIFICATIONS permission granted');
            await AsyncStorage.setItem('notificationsGranted', 'true');
          } else {
            console.log(
              '✅ Android: POST_NOTIFICATIONS permission already granted or not needed',
              {
                hasPermission,
                grantedFlag,
                currentStatus,
              },
            );
          }
        }

        // Re-check neverAsk flag again before Firebase messaging permission request
        // (in case it was set during POST_NOTIFICATIONS request)
        const neverAskAfterPost = await AsyncStorage.getItem(
          'notificationsNeverAsk',
        );
        if (neverAskAfterPost === 'true') {
          console.log(
            '⚠️ Android: Notification permission denied during POST_NOTIFICATIONS request – skipping Firebase permission request',
          );
          this.isInitializing = false;
          return false;
        }

        // Re-check system permission status before Firebase request
        // (in case it changed after POST_NOTIFICATIONS request)
        try {
          const updatedStatus = await this.getMessaging().hasPermission();
          if (updatedStatus === messaging.AuthorizationStatus.DENIED) {
            console.log(
              '⚠️ Android: Firebase permission denied after POST_NOTIFICATIONS – skipping Firebase permission request',
            );
            await AsyncStorage.setItem('notificationsNeverAsk', 'true');
            this.isInitializing = false;
            return false;
          }
          // Update currentStatus for Firebase request check
          if (updatedStatus !== currentStatus) {
            currentStatus = updatedStatus;
          }
        } catch (error) {
          console.warn(
            '⚠️ Error re-checking permission before Firebase request:',
            error,
          );
        }

        // Check Firebase messaging permission - only request if NOT_DETERMINED
        if (grantedFlag === 'true') {
          console.log(
            '✅ Android: notificationsGranted flag set, skipping Firebase permission request',
          );
        } else if (
          currentStatus === messaging.AuthorizationStatus.NOT_DETERMINED
        ) {
          // Only request if status is NOT_DETERMINED
          console.log(
            '📱 Android: Requesting Firebase messaging permission...',
          );
          const authStatus = await this.getMessaging().requestPermission();
          console.log('📱 Android Firebase permission status:', authStatus);

          if (authStatus === messaging.AuthorizationStatus.DENIED) {
            await AsyncStorage.setItem('notificationsNeverAsk', 'true');
            this.isInitializing = false;
            return false;
          }

          // Set granted flag if authorized
          if (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
          ) {
            await AsyncStorage.setItem('notificationsGranted', 'true');
          }
        } else {
          console.log(
            '✅ Android: Firebase permission already determined, skipping request',
          );
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
      this.isInitializing = false; // Clear flag on success
      console.log('✅ Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      this.isInitializing = false; // Clear flag on error
      return false;
    } finally {
      // Ensure flag is cleared even if there was an early return
      // (though we handle it in catch and success paths above)
      this.isInitializing = false;
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

      // Check if Firebase is initialized
      if (!this.isFirebaseInitialized()) {
        console.warn('⚠️ Firebase not initialized, cannot get FCM token');
        return null;
      }

      // Check if we have permission first
      const authStatus = await this.getMessaging().hasPermission();
      console.log('🔧 Permission status:', authStatus);
      if (authStatus === messaging.AuthorizationStatus.DENIED) {
        console.log('❌ Notification permission denied');
        return null;
      }

      console.log('🔧 Calling messaging().getToken()...');
      const token = await this.getMessaging().getToken();
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
    if (this.isFirebaseInitialized()) {
      try {
        this.getMessaging().onTokenRefresh(async (newToken: string) => {
          try {
            this.fcmToken = newToken;
            await AsyncStorage.setItem('fcmToken', newToken);
            await this.sendTokenToBackend(newToken);
          } catch (error) {
            console.error('❌ Error handling token refresh:', error);
          }
        });
      } catch (error) {
        console.warn('⚠️ Could not set up token refresh handler:', error);
      }
    } else {
      console.warn(
        '⚠️ Firebase not initialized, skipping token refresh handler setup',
      );
    }
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
