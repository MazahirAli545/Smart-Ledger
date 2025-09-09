import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import TransactionLimitService, {
  TransactionLimitData,
} from '../services/TransactionLimitService';
import { useAuth } from './AuthContext';

interface TransactionLimitContextType {
  transactionLimitService: TransactionLimitService;
  showLimitPopup: boolean;
  limitData: TransactionLimitData | null;
  forceTriggerNotification: () => Promise<void>;
  forceCheckTransactionLimit: () => Promise<void>;
  forceShowPopup: () => Promise<void>;
  getServiceStatus: () => Promise<any>;
  startLimitMonitoring: () => Promise<void>;
  stopLimitMonitoring: () => Promise<void>;
  handleClosePopup: () => void;
}

const TransactionLimitContext = createContext<
  TransactionLimitContextType | undefined
>(undefined);

interface TransactionLimitProviderProps {
  children: ReactNode;
}

export const TransactionLimitProvider: React.FC<
  TransactionLimitProviderProps
> = ({ children }) => {
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [limitData, setLimitData] = useState<TransactionLimitData | null>(null);
  const [transactionLimitService] = useState(() =>
    TransactionLimitService.getInstance(),
  );
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Set up notification callback
    transactionLimitService.setNotificationCallback(
      (data: TransactionLimitData) => {
        console.log('📢 Transaction limit notification received:', data);
        setLimitData(data);
        setShowLimitPopup(true);
      },
    );

    return () => {
      // Cleanup when component unmounts
      transactionLimitService.destroy();
    };
  }, [transactionLimitService]);

  useEffect(() => {
    // Start monitoring when user is authenticated
    if (isAuthenticated) {
      console.log(
        '🔐 User authenticated, starting transaction limit monitoring...',
      );
      startLimitMonitoring();
    } else {
      console.log(
        '🔓 User not authenticated, stopping transaction limit monitoring...',
      );
      stopLimitMonitoring();
    }
  }, [isAuthenticated]);

  const startLimitMonitoring = async () => {
    try {
      await transactionLimitService.startLimitMonitoring();
      console.log('✅ Transaction limit monitoring started');
    } catch (error) {
      console.error('❌ Error starting transaction limit monitoring:', error);
    }
  };

  const stopLimitMonitoring = async () => {
    try {
      await transactionLimitService.stopLimitMonitoring();
      setShowLimitPopup(false);
      setLimitData(null);
      console.log('✅ Transaction limit monitoring stopped');
    } catch (error) {
      console.error('❌ Error stopping transaction limit monitoring:', error);
    }
  };

  const forceTriggerNotification = async () => {
    try {
      await transactionLimitService.forceTriggerNotification();
    } catch (error) {
      console.error('❌ Error force triggering notification:', error);
    }
  };

  const forceCheckTransactionLimit = async () => {
    try {
      await transactionLimitService.checkAndShowPopup();
    } catch (error) {
      console.error('❌ Error checking transaction limit:', error);
    }
  };

  const forceShowPopup = async () => {
    try {
      await transactionLimitService.forceShowPopup();
    } catch (error) {
      console.error('❌ Error force showing popup:', error);
    }
  };

  const getServiceStatus = async () => {
    try {
      return await transactionLimitService.getServiceStatus();
    } catch (error) {
      console.error('❌ Error getting service status:', error);
      return {
        serviceActive: false,
        popupShown: false,
        lastNotificationTime: null,
        hoursSinceLastNotification: null,
      };
    }
  };

  const handleClosePopup = () => {
    setShowLimitPopup(false);
    setLimitData(null);
  };

  const contextValue: TransactionLimitContextType = {
    transactionLimitService,
    showLimitPopup,
    limitData,
    forceTriggerNotification,
    forceCheckTransactionLimit,
    forceShowPopup,
    getServiceStatus,
    startLimitMonitoring,
    stopLimitMonitoring,
    handleClosePopup,
  };

  return (
    <TransactionLimitContext.Provider value={contextValue}>
      {children}
    </TransactionLimitContext.Provider>
  );
};

export const useTransactionLimit = (): TransactionLimitContextType => {
  const context = useContext(TransactionLimitContext);
  if (context === undefined) {
    throw new Error(
      'useTransactionLimit must be used within a TransactionLimitProvider',
    );
  }
  return context;
};
