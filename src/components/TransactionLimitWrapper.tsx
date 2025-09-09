import React from 'react';
import { useTransactionLimitPopup } from '../hooks/useTransactionLimitPopup';
import TransactionLimitPopup from './TransactionLimitPopup';

interface TransactionLimitWrapperProps {
  children: React.ReactNode;
}

const TransactionLimitWrapper: React.FC<TransactionLimitWrapperProps> = ({
  children,
}) => {
  const { showPopup, popupData, handleClosePopup, handleUpgrade } =
    useTransactionLimitPopup();

  return (
    <>
      {children}
      {showPopup && popupData && (
        <TransactionLimitPopup
          visible={showPopup}
          currentCount={popupData.currentCount}
          maxAllowed={popupData.maxAllowed}
          remaining={popupData.remaining}
          planName={popupData.planName}
          percentageUsed={popupData.percentageUsed}
          isAtLimit={popupData.isAtLimit}
          nextResetDate={popupData.nextResetFormatted}
          onClose={handleClosePopup}
          onUpgrade={handleUpgrade}
        />
      )}
    </>
  );
};

export default TransactionLimitWrapper;
