import React, { createContext, useContext, useEffect, useState } from 'react';
import NotificationService, {
  NotificationSettings,
} from '../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationContextType {
  notificationService: NotificationService;
  settings: NotificationSettings;
  pendingNotifications: any[];
  isInitialized: boolean;
  initializeNotifications: () => Promise<boolean>;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  clearPendingNotifications: () => Promise<void>;
  refreshFCMToken: () => Promise<string | null>;
  isNotificationsEnabled: () => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notificationService] = useState(() =>
    NotificationService.getInstance(),
  );
  const [settings, setSettings] = useState<NotificationSettings>(
    notificationService.getNotificationSettings(),
  );
  const [pendingNotifications, setPendingNotifications] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize notifications when the provider mounts
    initializeNotifications();

    // Load pending notifications on mount
    loadPendingNotifications();

    // Set up periodic refresh of pending notifications
    const interval = setInterval(loadPendingNotifications, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const initializeNotifications = async (): Promise<boolean> => {
    try {
      // Check if user has declined notification permission
      const neverAsk = await AsyncStorage.getItem('notificationsNeverAsk');
      if (neverAsk === 'true') {
        console.log(
          '⚠️ NotificationContext: Notification permission declined - skipping initialization',
        );
        setIsInitialized(false);
        return false;
      }

      console.log('🚀 Initializing notifications from context...');
      const success = await notificationService.initializeNotifications();
      setIsInitialized(success);

      if (success) {
        console.log('✅ Notifications initialized successfully from context');
        // Update settings after initialization
        setSettings(notificationService.getNotificationSettings());
      } else {
        console.log('❌ Failed to initialize notifications from context');
      }

      return success;
    } catch (error) {
      console.error('❌ Error initializing notifications from context:', error);
      setIsInitialized(false);
      return false;
    }
  };

  const loadPendingNotifications = async () => {
    try {
      const notifications = await notificationService.getPendingNotifications();
      setPendingNotifications(notifications);
    } catch (error) {
      console.error('Error loading pending notifications:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      await notificationService.saveNotificationSettings(newSettings);
      setSettings(notificationService.getNotificationSettings());
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const clearPendingNotifications = async () => {
    try {
      await notificationService.clearPendingNotifications();
      setPendingNotifications([]);
    } catch (error) {
      console.error('Error clearing pending notifications:', error);
    }
  };

  const refreshFCMToken = async (): Promise<string | null> => {
    return await notificationService.refreshFCMToken();
  };

  const isNotificationsEnabled = (): boolean => {
    return notificationService.isNotificationsEnabled();
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationService,
        settings,
        pendingNotifications,
        isInitialized,
        initializeNotifications,
        updateSettings,
        clearPendingNotifications,
        refreshFCMToken,
        isNotificationsEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }
  return context;
};
