import notifee, {
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';

/**
 * Interface for local notification options
 */
export interface LocalNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  color?: string;
  channelId?: string;
}

/**
 * Show a local notification (generic helper function)
 * @param options - Notification options including title, body, data, and color
 */
export async function showLocalNotification(
  options: LocalNotificationOptions,
): Promise<void> {
  try {
    // Request permission if needed
    await notifee.requestPermission();

    // Use provided channel ID or create a default one
    const channelId =
      options.channelId ||
      (await notifee.createChannel({
        id: 'general_notifications',
        name: 'General Notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
      }));

    // Display the notification
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

    console.log('✅ Local notification sent:', options.title);
  } catch (error) {
    console.error('❌ Error showing local notification:', error);
    // Don't throw - allow the flow to continue even if notification fails
  }
}

/**
 * Show a notification when a plan is updated
 * @param planName - Name of the plan (e.g., "Professional", "Starter")
 * @param planPrice - Price of the plan in rupees
 */
export async function showPlanUpdatedNotification(
  planName: string,
  planPrice: number,
): Promise<void> {
  try {
    // Request permission if needed
    await notifee.requestPermission();

    // Create or get notification channel for Android
    const channelId = await notifee.createChannel({
      id: 'plan-updates',
      name: 'Plan Updates',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
    });

    // Format price for display
    const formattedPrice =
      planPrice === 0 ? 'Free' : `₹${planPrice.toLocaleString('en-IN')}`;

    // Display the notification
    await notifee.displayNotification({
      title: '🎉 Plan Updated Successfully!',
      body: `Your plan has been upgraded to ${planName} (${formattedPrice})`,
      data: {
        type: 'plan_update',
        planName: planName,
        planPrice: planPrice.toString(),
      },
      android: {
        channelId: channelId,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibrationPattern: [300, 500],
        pressAction: {
          id: 'default',
        },
      },
    });

    console.log('✅ Plan update notification sent:', { planName, planPrice });
  } catch (error) {
    console.error('❌ Error showing plan update notification:', error);
    // Don't throw - allow the flow to continue even if notification fails
  }
}
