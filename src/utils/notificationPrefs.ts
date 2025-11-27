import AsyncStorage from '@react-native-async-storage/async-storage';

const NEVER_ASK_KEY = 'notificationsNeverAsk';

/**
 * Returns true if the user previously declined notification permission.
 * Allows other services (Notifee, in-app reminders, etc.) to honor the choice
 * without triggering additional OS prompts.
 */
export const hasUserDeclinedNotifications = async (): Promise<boolean> => {
  try {
    const flag = await AsyncStorage.getItem(NEVER_ASK_KEY);
    return flag === 'true';
  } catch (error) {
    console.warn(
      '⚠️ notificationPrefs: Failed to read notificationsNeverAsk flag',
      error,
    );
    return false;
  }
};

/**
 * Persists the "never ask" preference so every permission entry point
 * respects the decline consistently.
 */
export const markNotificationsAsDeclined = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(NEVER_ASK_KEY, 'true');
  } catch (error) {
    console.warn(
      '⚠️ notificationPrefs: Failed to store notificationsNeverAsk flag',
      error,
    );
  }
};
