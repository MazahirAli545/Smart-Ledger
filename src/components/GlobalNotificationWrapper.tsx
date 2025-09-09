import React from 'react';
import { View } from 'react-native';
import SubscriptionRenewalNotification from './SubscriptionRenewalNotification';
import { useSubscriptionNotifications } from '../context/SubscriptionNotificationContext';
import { useNavigation } from '@react-navigation/native';

interface GlobalNotificationWrapperProps {
  children: React.ReactNode;
  excludeFromNotifications?: boolean; // Flag to exclude certain screens
}

const GlobalNotificationWrapper: React.FC<GlobalNotificationWrapperProps> = ({
  children,
  excludeFromNotifications = false,
}) => {
  const navigation = useNavigation();
  const {
    pendingNotification,
    isNotificationVisible,
    hideNotification,
    clearPendingNotification,
  } = useSubscriptionNotifications();

  const handleUpgrade = () => {
    // Clear the notification when user chooses to upgrade
    clearPendingNotification();
  };

  const handleClose = () => {
    hideNotification();
  };

  // Don't show notifications on excluded screens
  if (excludeFromNotifications) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* Global Subscription Renewal Notification */}
      <SubscriptionRenewalNotification
        visible={isNotificationVisible && !excludeFromNotifications}
        notificationData={pendingNotification}
        onClose={handleClose}
        onUpgrade={handleUpgrade}
      />
    </View>
  );
};

export default GlobalNotificationWrapper;
