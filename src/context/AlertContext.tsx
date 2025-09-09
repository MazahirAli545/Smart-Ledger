import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AlertOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
  alert: AlertOptions | null;
  isVisible: boolean;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alert, setAlert] = useState<AlertOptions | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showAlert = (options: AlertOptions) => {
    setAlert(options);
    setIsVisible(true);
  };

  const hideAlert = () => {
    setIsVisible(false);
    setAlert(null);
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert, alert, isVisible }}>
      {children}
    </AlertContext.Provider>
  );
};
