import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProperSystemNotificationService from '../services/properSystemNotificationService';
import NotificationService from '../services/notificationService';

export interface LocalNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  color?: string;
}

/**
 * Display a local Firebase notification using notifee
 */
export const showLocalNotification = async (
  options: LocalNotificationOptions,
): Promise<void> => {
  try {
    // Respect global flag set when user declines notification permissions
    const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
    if (neverAsk === 'true') {
      return;
    }

    const permission = await notifee.requestPermission();

    if (permission.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
      // Persist the user's decline to avoid prompting again
      await AsyncStorage.setItem('notificationsNeverAsk', 'true');
      return;
    }

    try {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500],
      });
    } catch (channelError) {
      // Channel might already exist, continue
    }

    const notificationConfig = {
      title: options.title,
      body: options.body,
      data: options.data || {},
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        color: options.color || '#4f8cff',
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_launcher',
        // Ensure notification shows in foreground
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
    };

    console.log(
      '🔔 Displaying notification with config:',
      JSON.stringify(notificationConfig, null, 2),
    );
    await notifee.displayNotification(notificationConfig);
    console.log('✅ Notification display call completed');
  } catch (error) {
    throw error;
  }
};

/**
 * Display account creation success notification
 */
export const showAccountCreatedNotification = async (
  displayName?: string,
): Promise<void> => {
  try {
    await showLocalNotification({
      title: 'Account Created Successfully',
      body:
        displayName && displayName.trim().length > 0
          ? `Welcome to Smart Ledger, ${displayName}! Your business account is now active and ready to manage your finances.`
          : 'Welcome to Smart Ledger! Your business account is now active and ready to manage your finances.',
      data: {
        type: 'account_created',
        timestamp: new Date().toISOString(),
      },
      color: '#10b981', // Professional green
    });
  } catch (error) {
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Account Created Successfully',
        body:
          displayName && displayName.trim().length > 0
            ? `Welcome to Smart Ledger, ${displayName}!`
            : 'Welcome to Smart Ledger!',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: '#10b981',
        },
      });
    } catch (simpleError) {
      // Silent fail - notification is not critical
    }
  }
};

/**
 * Display sign-in success notification
 */
export const showSignInSuccessNotification = async (
  displayName?: string,
  isNewUser: boolean = false,
): Promise<void> => {
  try {
    console.log('🔔 Notification function called with:', {
      displayName,
      isNewUser,
      userType: isNewUser ? 'NEW USER' : 'EXISTING USER',
    });

    const title = 'Welcome';
    const body =
      displayName && displayName.trim().length > 0
        ? `Welcome to Smart Ledger, ${displayName}! Your account is ready to manage your business finances.`
        : 'Welcome to Smart Ledger! Your account is ready to manage your business finances.';

    console.log('🔔 Notification content:', { title, body });

    await showLocalNotification({
      title,
      body,
      data: {
        type: isNewUser ? 'account_created' : 'sign_in_success',
        timestamp: new Date().toISOString(),
      },
      color: isNewUser ? '#10b981' : '#3b82f6', // More professional colors
    });
  } catch (error) {
    console.error('❌ Failed to show sign-in notification:', error);
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Welcome',
        body: 'Welcome to Smart Ledger! Your account is ready.',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: isNewUser ? '#10b981' : '#3b82f6',
        },
      });
    } catch (simpleError) {
      console.error(
        '❌ Fallback sign-in notification also failed:',
        simpleError,
      );
    }
  }
};

/**
 * Display folder creation success notification
 */
export const showFolderCreatedNotification = async (
  folderName: string,
): Promise<void> => {
  try {
    await showLocalNotification({
      title: 'Folder Created Successfully! 📁',
      body: `"${folderName}" folder has been created successfully and is ready to use.`,
      data: {
        type: 'folder_created',
        folderName,
        timestamp: new Date().toISOString(),
      },
      color: '#4f8cff',
    });
  } catch (error) {
    console.error('❌ Failed to show folder creation notification:', error);
    // Don't throw - we don't want to break the user flow if notification fails
  }
};

/**
 * Display plan update success notification
 */
export const showPlanUpdatedNotification = async (
  planName: string,
  planPrice: number,
): Promise<void> => {
  try {
    await showLocalNotification({
      title: 'Subscription Upgraded Successfully',
      body: `Your Smart Ledger subscription has been upgraded to ${planName} plan (₹${planPrice}/month). All premium features are now available for your business.`,
      data: {
        type: 'plan_updated',
        planName,
        planPrice: planPrice.toString(),
        timestamp: new Date().toISOString(),
      },
      color: '#3b82f6', // Professional blue
    });
  } catch (error) {
    console.error('❌ Failed to show plan update notification:', error);
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Subscription Upgraded Successfully',
        body: `Your Smart Ledger subscription has been upgraded to ${planName} plan.`,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: '#3b82f6',
        },
      });
    } catch (simpleError) {
      // Silent fail - notification is not critical
      console.error('❌ Fallback plan notification also failed:', simpleError);
    }
  }
};

/**
 * Display transaction limit warning notification
 */
export const showTransactionLimitNotification = async (
  currentCount: number,
  maxAllowed: number,
  planName: string,
  percentageUsed: number,
): Promise<void> => {
  try {
    const isAtLimit = percentageUsed >= 100;
    const isNearLimit = percentageUsed >= 95;

    let title = '';
    let body = '';
    let color = '#f59e0b'; // Professional amber

    if (isAtLimit) {
      title = 'Transaction Limit Reached';
      body = `You have reached the maximum ${maxAllowed} transactions for your ${planName} plan this month. Upgrade your plan to continue managing your business finances.`;
      color = '#ef4444'; // Professional red
    } else if (isNearLimit) {
      title = 'Transaction Limit Warning';
      body = `You have used ${currentCount} of ${maxAllowed} transactions (${percentageUsed}%) for your ${planName} plan. Consider upgrading to avoid service interruption.`;
      color = '#f97316'; // Professional orange
    } else {
      title = 'Transaction Usage Update';
      body = `You have used ${currentCount} of ${maxAllowed} transactions (${percentageUsed}%) for your ${planName} plan this month.`;
    }

    await showLocalNotification({
      title,
      body,
      data: {
        type: 'transaction_limit_warning',
        currentCount: currentCount.toString(),
        maxAllowed: maxAllowed.toString(),
        planName,
        percentageUsed: percentageUsed.toString(),
        isAtLimit: isAtLimit.toString(),
        timestamp: new Date().toISOString(),
      },
      color,
    });
  } catch (error) {
    console.error('❌ Failed to show transaction limit notification:', error);
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Transaction Limit Warning',
        body: `Used ${currentCount}/${maxAllowed} transactions`,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: '#f59e0b',
        },
      });
    } catch (simpleError) {
      // Silent fail - notification is not critical
      console.error(
        '❌ Fallback transaction limit notification also failed:',
        simpleError,
      );
    }
  }
};

/**
 * Test notification function to verify notifications are working
 */
export const showTestNotification = async (): Promise<void> => {
  try {
    console.log('🧪 Testing basic notification...');

    // Request permission
    await notifee.requestPermission();

    // Create basic channel
    await notifee.createChannel({
      id: 'test',
      name: 'Test Channel',
      importance: AndroidImportance.HIGH,
    });

    // Show very basic notification
    await notifee.displayNotification({
      title: 'Test Notification 🧪',
      body: 'This is a simple test notification.',
      android: {
        channelId: 'test',
        importance: AndroidImportance.HIGH,
        color: '#ff6b35',
      },
    });

    console.log('✅ Test notification displayed successfully');
  } catch (error) {
    console.error('❌ Test notification failed:', error);
  }
};

/**
 * Handle in-app "Allow" button: request permission, init services, register token, and show test notification.
 */
export const handleUserAllowNotifications = async (): Promise<{
  granted: boolean;
  tokenPreview?: string;
}> => {
  // Clear any decline flag
  await AsyncStorage.removeItem('notificationsNeverAsk');

  // If already granted previously, avoid prompting again
  const alreadyGranted = await AsyncStorage.getItem('notificationsGranted');
  let granted = alreadyGranted === 'true';
  if (!granted) {
    const permission = await notifee.requestPermission();
    granted = permission.authorizationStatus === AuthorizationStatus.AUTHORIZED;
  }

  if (!granted) {
    // Persist the user's decline to avoid prompting again
    await AsyncStorage.setItem('notificationsNeverAsk', 'true');
    return { granted: false };
  }

  // Persist granted flag to avoid future duplicate prompts
  await AsyncStorage.setItem('notificationsGranted', 'true');

  // Initialize both notification services (ensures listeners/channels)
  const proper = ProperSystemNotificationService.getInstance();
  await proper.initializeNotifications();

  const legacy = NotificationService.getInstance();
  const token = await legacy.getFCMToken();

  // If we have a user session, register token to backend
  const accessToken = await AsyncStorage.getItem('accessToken');
  if (accessToken && token) {
    await legacy.sendTokenToBackend(token);
  }

  // Fire a local test notification to confirm UI delivery
  await showLocalNotification({
    title: 'Notifications Enabled',
    body: 'You will now receive alerts for your account.',
    data: { type: 'enable_test', timestamp: new Date().toISOString() },
    color: '#3b82f6',
  });

  return {
    granted: true,
    tokenPreview: token ? token.substring(0, 20) + '...' : undefined,
  };
};

/**
 * Handle in-app "Don't allow" button: persist decline and avoid re-prompting.
 */
export const handleUserDontAllowNotifications = async (): Promise<void> => {
  await AsyncStorage.setItem('notificationsNeverAsk', 'true');
};

/**
 * Test function to verify notification (same for all users)
 */
export const testNewUserNotification = async (
  displayName?: string,
): Promise<void> => {
  try {
    console.log('🧪 Testing notification...');
    await showSignInSuccessNotification(displayName, true);
    console.log('✅ Notification test completed');
  } catch (error) {
    console.error('❌ Notification test failed:', error);
  }
};

/**
 * Test function to verify notification (same for all users)
 */
export const testExistingUserNotification = async (
  displayName?: string,
): Promise<void> => {
  try {
    console.log('🧪 Testing notification...');
    await showSignInSuccessNotification(displayName, false);
    console.log('✅ Notification test completed');
  } catch (error) {
    console.error('❌ Notification test failed:', error);
  }
};
