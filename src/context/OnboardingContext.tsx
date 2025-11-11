import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingData {
  mobileNumber: string;
  businessSize: string;
  industry: string;
  monthlyTransactionVolume: string;
  currentAccountingSoftware: string;
  teamSize: string;
  preferredLanguage: string;
  features: string[];
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  primaryGoal: string;
  currentChallenges: string;
}

const defaultData: OnboardingData = {
  mobileNumber: '',
  businessSize: '',
  industry: '',
  monthlyTransactionVolume: '',
  currentAccountingSoftware: '',
  teamSize: '',
  preferredLanguage: '',
  features: [],
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  primaryGoal: '',
  currentChallenges: '',
};

type OnboardingContextType = {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>(defaultData);

  useEffect(() => {
    // Load mobile number from AsyncStorage on mount
    AsyncStorage.getItem('userMobileNumber').then((mobileNumber) => {
      if (mobileNumber) {
        setData(prev => ({ ...prev, mobileNumber }));
      }
    });
  }, []);

  return (
    <OnboardingContext.Provider value={{ data, setData }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}; 