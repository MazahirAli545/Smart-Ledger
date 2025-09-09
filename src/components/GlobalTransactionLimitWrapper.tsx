import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TransactionLimitPopup from './TransactionLimitPopup';
import { useTransactionLimit } from '../context/TransactionLimitContext';

interface GlobalTransactionLimitWrapperProps {
  children: React.ReactNode;
  excludeFromLimitNotifications?: boolean; // Flag to exclude certain screens
}

const GlobalTransactionLimitWrapper: React.FC<
  GlobalTransactionLimitWrapperProps
> = ({ children, excludeFromLimitNotifications = false }) => {
  const { showLimitPopup, limitData, handleClosePopup } = useTransactionLimit();
  const navigation = useNavigation();

  // Debug logging
  console.log('📊 [DEBUG] GlobalTransactionLimitWrapper render:', {
    showLimitPopup,
    hasLimitData: !!limitData,
    excludeFromLimitNotifications,
  });

  const handleUpgrade = () => {
    // Navigate to subscription plan screen
    (navigation as any).navigate('App', {
      screen: 'AppStack',
      params: { screen: 'SubscriptionPlan' },
    });
  };

  const handleClose = () => {
    handleClosePopup();
    console.log('📱 Transaction limit popup closed');
  };

  // Don't show notifications on excluded screens
  if (excludeFromLimitNotifications) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* Global Transaction Limit Popup */}
      {showLimitPopup && limitData && (
        <TransactionLimitPopup
          visible={showLimitPopup}
          currentCount={limitData.currentCount}
          maxAllowed={limitData.maxAllowed}
          remaining={limitData.remaining}
          planName={limitData.planName}
          percentageUsed={limitData.percentageUsed}
          isAtLimit={limitData.isAtLimit}
          nextResetDate={limitData.nextResetFormatted}
          onClose={handleClose}
          onUpgrade={handleUpgrade}
        />
      )}
    </View>
  );
};

export default GlobalTransactionLimitWrapper;
