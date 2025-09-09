import React, { createContext, useContext, useEffect, useState } from 'react';
import PlanExpiryService, {
  PlanExpiryData,
} from '../services/planExpiryService';

interface PlanExpiryContextType {
  planExpiryService: PlanExpiryService;
  pendingExpiryNotification: PlanExpiryData | null;
  isExpiryPopupVisible: boolean;
  showExpiryPopup: (data: PlanExpiryData) => void;
  hideExpiryPopup: () => void;
  clearPendingExpiryNotification: () => Promise<void>;
  forceCheckExpiredPlan: () => Promise<void>;
  getExpiryNotificationStatus: () => Promise<{
    serviceActive: boolean;
    lastShown: string | null;
    hoursSinceLastShown: number | null;
  }>;
}

const PlanExpiryContext = createContext<PlanExpiryContextType | undefined>(
  undefined,
);

export const PlanExpiryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [planExpiryService] = useState(() => PlanExpiryService.getInstance());
  const [pendingExpiryNotification, setPendingExpiryNotification] =
    useState<PlanExpiryData | null>(null);
  const [isExpiryPopupVisible, setIsExpiryPopupVisible] = useState(false);

  useEffect(() => {
    // Initialize the plan expiry monitoring service
    initializePlanExpiryMonitoring();

    // Set up notification callback
    planExpiryService.setNotificationCallback(handleExpiryNotificationReceived);

    // Load any pending notifications on mount
    loadPendingExpiryNotification();

    return () => {
      // Clean up when component unmounts
      planExpiryService.stopExpiryMonitoring();
    };
  }, []);

  const initializePlanExpiryMonitoring = async () => {
    try {
      console.log('🚀 Initializing plan expiry monitoring system...');
      await planExpiryService.startExpiryMonitoring();
      console.log('✅ Plan expiry monitoring system initialized');
    } catch (error) {
      console.error(
        '❌ Error initializing plan expiry monitoring system:',
        error,
      );
    }
  };

  const handleExpiryNotificationReceived = (data: PlanExpiryData) => {
    console.log('📢 Plan expiry notification received:', data);
    setPendingExpiryNotification(data);
    setIsExpiryPopupVisible(true);
  };

  const loadPendingExpiryNotification = async () => {
    try {
      // Check if there's a pending notification to show
      const status = await planExpiryService.getExpiryNotificationStatus();
      if (status.serviceActive) {
        // Force check for expired plans on app start
        await planExpiryService.forceCheckExpiredPlan();
      }
    } catch (error) {
      console.error('❌ Error loading pending expiry notification:', error);
    }
  };

  const showExpiryPopup = (data: PlanExpiryData) => {
    setPendingExpiryNotification(data);
    setIsExpiryPopupVisible(true);
  };

  const hideExpiryPopup = () => {
    setIsExpiryPopupVisible(false);
  };

  const clearPendingExpiryNotification = async () => {
    try {
      await planExpiryService.clearExpiryNotificationData();
      setPendingExpiryNotification(null);
      setIsExpiryPopupVisible(false);
    } catch (error) {
      console.error('❌ Error clearing pending expiry notification:', error);
    }
  };

  const forceCheckExpiredPlan = async () => {
    try {
      await planExpiryService.forceCheckExpiredPlan();
    } catch (error) {
      console.error('❌ Error force checking expired plan:', error);
    }
  };

  const getExpiryNotificationStatus = async () => {
    try {
      return await planExpiryService.getExpiryNotificationStatus();
    } catch (error) {
      console.error('❌ Error getting expiry notification status:', error);
      return {
        serviceActive: false,
        lastShown: null,
        hoursSinceLastShown: null,
      };
    }
  };

  return (
    <PlanExpiryContext.Provider
      value={{
        planExpiryService,
        pendingExpiryNotification,
        isExpiryPopupVisible,
        showExpiryPopup,
        hideExpiryPopup,
        clearPendingExpiryNotification,
        forceCheckExpiredPlan,
        getExpiryNotificationStatus,
      }}
    >
      {children}
    </PlanExpiryContext.Provider>
  );
};

export const usePlanExpiry = () => {
  const context = useContext(PlanExpiryContext);
  if (!context) {
    throw new Error('usePlanExpiry must be used within a PlanExpiryProvider');
  }
  return context;
};
