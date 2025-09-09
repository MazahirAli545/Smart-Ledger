import React, { createContext, useContext, useEffect, useState } from 'react';
import SubscriptionNotificationService, {
  RenewalNotificationData,
} from '../services/subscriptionNotificationService';

interface SubscriptionNotificationContextType {
  subscriptionNotificationService: SubscriptionNotificationService;
  pendingNotification: RenewalNotificationData | null;
  isNotificationVisible: boolean;
  showNotification: (notification: RenewalNotificationData) => void;
  hideNotification: () => void;
  clearPendingNotification: () => Promise<void>;
  forceCheckSubscription: () => Promise<void>;
  getSubscriptionStatus: () => Promise<{
    hasActiveSubscription: boolean;
    daysUntilExpiry: number | null;
    subscription: any;
  }>;
}

const SubscriptionNotificationContext = createContext<
  SubscriptionNotificationContextType | undefined
>(undefined);

export const SubscriptionNotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [subscriptionNotificationService] = useState(() =>
    SubscriptionNotificationService.getInstance(),
  );
  const [pendingNotification, setPendingNotification] =
    useState<RenewalNotificationData | null>(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);

  useEffect(() => {
    // Initialize the subscription notification service
    initializeSubscriptionNotifications();

    // Set up notification callback
    subscriptionNotificationService.setNotificationCallback(
      handleNotificationReceived,
    );

    // Load any pending notifications on mount
    loadPendingNotification();

    return () => {
      // Clean up when component unmounts
      subscriptionNotificationService.stopNotificationSystem();
    };
  }, []);

  const initializeSubscriptionNotifications = async () => {
    try {
      console.log('🚀 Initializing subscription notification system...');
      await subscriptionNotificationService.startNotificationSystem();
      console.log('✅ Subscription notification system initialized');
    } catch (error) {
      console.error(
        '❌ Error initializing subscription notification system:',
        error,
      );
    }
  };

  const handleNotificationReceived = (
    notification: RenewalNotificationData,
  ) => {
    console.log('📢 Subscription renewal notification received:', notification);
    setPendingNotification(notification);
    setIsNotificationVisible(true);
  };

  const loadPendingNotification = async () => {
    try {
      const notification =
        await subscriptionNotificationService.getPendingRenewalNotification();
      if (notification) {
        setPendingNotification(notification);
        setIsNotificationVisible(true);
      }
    } catch (error) {
      console.error('❌ Error loading pending notification:', error);
    }
  };

  const showNotification = (notification: RenewalNotificationData) => {
    setPendingNotification(notification);
    setIsNotificationVisible(true);
  };

  const hideNotification = () => {
    setIsNotificationVisible(false);
  };

  const clearPendingNotification = async () => {
    try {
      await subscriptionNotificationService.clearPendingRenewalNotification();
      setPendingNotification(null);
      setIsNotificationVisible(false);
    } catch (error) {
      console.error('❌ Error clearing pending notification:', error);
    }
  };

  const forceCheckSubscription = async () => {
    try {
      await subscriptionNotificationService.forceCheckSubscription();
    } catch (error) {
      console.error('❌ Error force checking subscription:', error);
    }
  };

  const getSubscriptionStatus = async () => {
    try {
      return await subscriptionNotificationService.getSubscriptionStatus();
    } catch (error) {
      console.error('❌ Error getting subscription status:', error);
      return {
        hasActiveSubscription: false,
        daysUntilExpiry: null,
        subscription: null,
      };
    }
  };

  return (
    <SubscriptionNotificationContext.Provider
      value={{
        subscriptionNotificationService,
        pendingNotification,
        isNotificationVisible,
        showNotification,
        hideNotification,
        clearPendingNotification,
        forceCheckSubscription,
        getSubscriptionStatus,
      }}
    >
      {children}
    </SubscriptionNotificationContext.Provider>
  );
};

export const useSubscriptionNotifications = () => {
  const context = useContext(SubscriptionNotificationContext);
  if (!context) {
    throw new Error(
      'useSubscriptionNotifications must be used within a SubscriptionNotificationProvider',
    );
  }
  return context;
};
