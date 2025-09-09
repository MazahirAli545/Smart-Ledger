import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';

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
    const permission = await notifee.requestPermission();

    if (permission.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
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
      },
      ios: {
        foregroundPresentationOptions: {
          badge: true,
          sound: true,
          banner: true,
          list: true,
        },
      },
    };

    await notifee.displayNotification(notificationConfig);
  } catch (error) {
    throw error;
  }
};

/**
 * Display account creation success notification
 */
export const showAccountCreatedNotification = async (): Promise<void> => {
  try {
    await showLocalNotification({
      title: 'Account Created Successfully! 🎉',
      body: 'Congratulations! Your account has been created successfully. Welcome to the app!',
      data: {
        type: 'account_created',
        timestamp: new Date().toISOString(),
      },
      color: '#1ecb81',
    });
  } catch (error) {
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Account Created Successfully! 🎉',
        body: 'Welcome to the app!',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: '#1ecb81',
        },
      });
    } catch (simpleError) {
      // Silent fail - notification is not critical
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
      title: 'Plan Updated Successfully! 🎉',
      body: `Your subscription has been upgraded to ${planName} plan (₹${planPrice}/month). Enjoy your new features!`,
      data: {
        type: 'plan_updated',
        planName,
        planPrice: planPrice.toString(),
        timestamp: new Date().toISOString(),
      },
      color: '#4f8cff',
    });
  } catch (error) {
    console.error('❌ Failed to show plan update notification:', error);
    // Fallback to simple notification if complex one fails
    try {
      await notifee.displayNotification({
        title: 'Plan Updated Successfully! 🎉',
        body: `Your subscription has been upgraded to ${planName} plan.`,
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          color: '#4f8cff',
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
    let color = '#ffc107';

    if (isAtLimit) {
      title = 'Transaction Limit Reached! 🚫';
      body = `You've used all ${maxAllowed} transactions for ${planName} plan this month. Upgrade to continue.`;
      color = '#dc3545';
    } else if (isNearLimit) {
      title = 'Transaction Limit Warning! ⚠️';
      body = `You've used ${currentCount}/${maxAllowed} transactions (${percentageUsed}%) for ${planName} plan. Consider upgrading.`;
      color = '#fd7e14';
    } else {
      title = 'Transaction Limit Alert 📊';
      body = `You've used ${currentCount}/${maxAllowed} transactions (${percentageUsed}%) for ${planName} plan.`;
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
          color: '#ffc107',
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
