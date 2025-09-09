import React from 'react';
import { View } from 'react-native';
import PlanExpiryPopup from './PlanExpiryPopup';
import { usePlanExpiry } from '../context/PlanExpiryContext';

interface GlobalPlanExpiryWrapperProps {
  children: React.ReactNode;
  excludeFromExpiryNotifications?: boolean; // Flag to exclude certain screens
}

const GlobalPlanExpiryWrapper: React.FC<GlobalPlanExpiryWrapperProps> = ({
  children,
  excludeFromExpiryNotifications = false,
}) => {
  const {
    pendingExpiryNotification,
    isExpiryPopupVisible,
    hideExpiryPopup,
    clearPendingExpiryNotification,
  } = usePlanExpiry();

  const handleRenew = () => {
    // Clear the notification when user chooses to renew
    clearPendingExpiryNotification();
  };

  const handleClose = () => {
    hideExpiryPopup();
  };

  // Don't show notifications on excluded screens
  if (excludeFromExpiryNotifications) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* Global Plan Expiry Popup */}
      <PlanExpiryPopup
        visible={isExpiryPopupVisible && !excludeFromExpiryNotifications}
        planName={pendingExpiryNotification?.planName || ''}
        expiredDate={pendingExpiryNotification?.expiredDate || ''}
        onClose={handleClose}
        onRenew={handleRenew}
      />
    </View>
  );
};

export default GlobalPlanExpiryWrapper;
