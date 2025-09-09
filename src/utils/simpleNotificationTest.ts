import notifee, { AndroidImportance } from '@notifee/react-native';

/**
 * Very simple notification test that bypasses all complex logic
 */
export const testSimpleNotification = async (): Promise<void> => {
  try {
    console.log('🧪 Testing very simple notification...');

    // Just try to display a notification with minimal config
    await notifee.displayNotification({
      title: 'Simple Test',
      body: 'This is a basic test notification',
    });

    console.log('✅ Simple notification sent successfully');
  } catch (error) {
    console.error('❌ Simple notification failed:', error);
  }
};

/**
 * Test notification with Android channel
 */
export const testNotificationWithChannel = async (): Promise<void> => {
  try {
    console.log('🧪 Testing notification with channel...');

    // Create channel first
    await notifee.createChannel({
      id: 'test-simple',
      name: 'Test Simple',
      importance: AndroidImportance.HIGH,
    });

    // Display notification
    await notifee.displayNotification({
      title: 'Test With Channel',
      body: 'This notification uses a proper channel',
      android: {
        channelId: 'test-simple',
      },
    });

    console.log('✅ Channel notification sent successfully');
  } catch (error) {
    console.error('❌ Channel notification failed:', error);
  }
};

/**
 * Test notification permissions
 */
export const testNotificationPermissions = async (): Promise<void> => {
  try {
    console.log('🧪 Testing notification permissions...');

    const permission = await notifee.requestPermission();
    console.log('🔐 Permission result:', permission);

    if (permission.authorizationStatus === 1) {
      console.log('✅ Notification permission granted');
      await testNotificationWithChannel();
    } else {
      console.log('❌ Notification permission denied');
    }
  } catch (error) {
    console.error('❌ Permission test failed:', error);
  }
};
