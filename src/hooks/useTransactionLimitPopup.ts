import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTransactionLimit } from '../context/TransactionLimitContext';

export const useTransactionLimitPopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<any>(null);
  const navigation = useNavigation();
  const { limitData, showLimitPopup } = useTransactionLimit();

  const handleShowPopup = useCallback((data: any) => {
    setPopupData(data);
    setShowPopup(true);
  }, []);

  const handleClosePopup = useCallback(() => {
    setShowPopup(false);
    setPopupData(null);
  }, []);

  const handleUpgrade = useCallback(() => {
    // Navigate to subscription plan screen
    (navigation as any).navigate('App', {
      screen: 'AppStack',
      params: { screen: 'SubscriptionPlan' },
    });
  }, [navigation]);

  return {
    showPopup: showPopup || showLimitPopup,
    popupData: popupData || limitData,
    handleShowPopup,
    handleClosePopup,
    handleUpgrade,
  };
};
