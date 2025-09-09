import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api';

export interface SubscriptionPlan {
  id: string; // String that can be parsed as a number (e.g., "1", "2", "3")
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  limits: {
    transactions: number;
    users: number;
    storage: number; // in GB
  };
  isPopular?: boolean;
}

export interface CurrentSubscription {
  planId: string;
  planName: string;
  status: 'active' | 'inactive' | 'cancelled';
  startDate: string;
  endDate: string;
  nextBillingDate: string;
  amount: number;
  usage: {
    transactions: { used: number; limit: number };
    users: { used: number; limit: number };
    storage: { used: number; limit: number };
  };
}

interface SubscriptionContextType {
  currentSubscription: CurrentSubscription | null;
  availablePlans: SubscriptionPlan[];
  loading: boolean;
  error: string | null;
  fetchSubscriptionData: () => Promise<void>;
  upgradePlan: (planId: string) => Promise<boolean>;
  downgradePlan: (planId: string) => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  isFeatureAvailable: (feature: string) => boolean;
  getPlanAccess: (planName: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined,
);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentSubscription, setCurrentSubscription] =
    useState<CurrentSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to map API plan data to SubscriptionPlan interface
  const mapApiPlanToSubscriptionPlan = (apiPlan: any): SubscriptionPlan => {
    // Generate a numeric ID based on plan name or use existing ID if available
    let planId: string;
    if (apiPlan.id && !isNaN(parseInt(apiPlan.id))) {
      planId = apiPlan.id.toString();
    } else {
      // Fallback: create numeric ID from plan name
      const planNameToId: { [key: string]: string } = {
        free: '1',
        starter: '2',
        professional: '3',
        enterprise: '4',
      };
      planId = planNameToId[apiPlan.name] || '999'; // Default fallback
    }

    return {
      id: planId, // Use numeric ID instead of plan name
      name: apiPlan.displayName,
      price: parseInt(apiPlan.price),
      period: apiPlan.billingCycle === 'monthly' ? 'month' : 'year',
      description: apiPlan.description,
      features: apiPlan.features,
      limits: {
        transactions:
          apiPlan.maxTransactions === -1 ? -1 : apiPlan.maxTransactions,
        users: getPlanUserLimit(apiPlan.name),
        storage: getPlanStorageLimit(apiPlan.name),
      },
      isPopular: apiPlan.isPopular,
    };
  };

  // Helper functions to get user and storage limits based on plan name
  const getPlanUserLimit = (planName: string): number => {
    const userLimits: { [key: string]: number } = {
      free: 1,
      starter: 3,
      professional: 10,
      enterprise: -1, // unlimited
    };
    return userLimits[planName] || 1;
  };

  const getPlanStorageLimit = (planName: string): number => {
    const storageLimits: { [key: string]: number } = {
      free: 1,
      starter: 5,
      professional: 50,
      enterprise: 500,
    };
    return storageLimits[planName] || 1;
  };

  const fetchSubscriptionData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch plans from API
      const plansResponse = await fetch(`${BASE_URL}/plans`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!plansResponse.ok) {
        throw new Error(`HTTP error! status: ${plansResponse.status}`);
      }

      const plansResult = await plansResponse.json();

      if (plansResult.code !== 200) {
        throw new Error(plansResult.message || 'Failed to fetch plans');
      }

      // Map API plans to SubscriptionPlan interface
      const mappedPlans = plansResult.data.map(mapApiPlanToSubscriptionPlan);
      setAvailablePlans(mappedPlans);

      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log(
          '⚠️ No authentication token found, skipping subscription fetch',
        );
        // Set default free plan instead of throwing error
        setCurrentSubscription({
          planId: 'free',
          planName: 'Free',
          status: 'active',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '2025-12-31',
          nextBillingDate: '2025-12-31',
          amount: 0,
          usage: {
            transactions: { used: 0, limit: 50 },
            users: { used: 1, limit: 1 },
            storage: { used: 0, limit: 100 },
          },
        });
        setLoading(false);
        return;
      }

      // Get user ID from token or storage
      let userId = await AsyncStorage.getItem('userId');

      // If no userId in storage, try to extract from token or use a fallback
      if (!userId) {
        // Try to get user ID from token payload or other sources
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          try {
            // Decode JWT token to get user ID (if token contains user info)
            const tokenPayload = JSON.parse(atob(token.split('.')[1]));
            userId = tokenPayload.userId || tokenPayload.id || tokenPayload.sub;
          } catch (e) {
            console.log('Could not decode token for user ID');
          }
        }

        // If still no userId, use a fallback for development/testing
        if (!userId) {
          console.log('No user ID found, using fallback for development');
          userId = '22'; // Fallback user ID for testing
        }
      }

      // Fetch user data from API
      const response = await fetch(`${BASE_URL}/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.code !== 200) {
        throw new Error(result.message || 'Failed to fetch user data');
      }

      const userData = result.data;
      console.log('User data fetched:', userData);

      // Map planType to subscription data
      let planType = userData.planType?.toLowerCase() || 'free';

      // Map premium to professional
      if (planType === 'premium') {
        planType = 'professional';
      }

      // Create subscription data based on user's planType
      const currentSubscription: CurrentSubscription = {
        planId: planType,
        planName: planType.charAt(0).toUpperCase() + planType.slice(1), // Capitalize first letter
        status: 'active',
        startDate: userData.planFromDT || '2024-01-01',
        endDate: userData.planUpToDT || '2024-12-31',
        nextBillingDate: userData.planExpiryDT || '2025-01-15',
        amount: getPlanAmount(planType),
        usage: getPlanUsage(planType),
      };

      console.log('Current subscription:', currentSubscription);
      setCurrentSubscription(currentSubscription);
    } catch (err: any) {
      console.error('Error fetching subscription data:', err);
      setError(err.message || 'Failed to fetch subscription data');
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (planId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('No authentication token');

      // Mock API call - replace with actual API
      // const response = await fetch(`${BASE_URL}/subscription/upgrade`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: `Bearer ${token}`,
      //   },
      //   body: JSON.stringify({ planId }),
      // });
      // const data = await response.json();

      // Mock success
      console.log('Upgrading to plan:', planId);

      // Refresh subscription data
      await fetchSubscriptionData();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to upgrade plan');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const downgradePlan = async (planId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('No authentication token');

      // Mock API call - replace with actual API
      // const response = await fetch(`${BASE_URL}/subscription/downgrade`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: `Bearer ${token}`,
      //   },
      //   body: JSON.stringify({ planId }),
      // });
      // const data = await response.json();

      // Mock success
      console.log('Downgrading to plan:', planId);

      // Refresh subscription data
      await fetchSubscriptionData();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to downgrade plan');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('No authentication token');

      // Mock API call - replace with actual API
      // const response = await fetch(`${BASE_URL}/subscription/cancel`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     Authorization: `Bearer ${token}`,
      //   },
      // });
      // const data = await response.json();

      // Mock success
      console.log('Cancelling subscription');

      // Refresh subscription data
      await fetchSubscriptionData();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const isFeatureAvailable = (feature: string): boolean => {
    if (!currentSubscription) return false;

    const plan = availablePlans.find(p => p.id === currentSubscription.planId);
    if (!plan) return false;

    // Check if feature is available in current plan
    const featureMap: Record<string, string[]> = {
      voice_entry: ['starter', 'professional', 'enterprise'],
      ocr_scanning: ['starter', 'professional', 'enterprise'],
      advanced_reports: ['professional', 'enterprise'],
      ca_collaboration: ['professional', 'enterprise'],
      multi_location: ['enterprise'],
      custom_integrations: ['enterprise'],
      dedicated_support: ['enterprise'],
    };

    const requiredPlans = featureMap[feature];
    if (!requiredPlans) return true; // Feature available in all plans

    return requiredPlans.includes(plan.id);
  };

  const getPlanAmount = (planType: string): number => {
    const planAmounts: { [key: string]: number } = {
      free: 0,
      starter: 999,
      professional: 1999,
      enterprise: 4999,
    };
    return planAmounts[planType] || 0;
  };

  const getPlanUsage = (planType: string) => {
    const planUsage: { [key: string]: any } = {
      free: {
        transactions: { used: 5, limit: 10 },
        users: { used: 1, limit: 1 },
        storage: { used: 0.5, limit: 1 },
      },
      starter: {
        transactions: { used: 250, limit: 500 },
        users: { used: 2, limit: 3 },
        storage: { used: 2.5, limit: 5 },
      },
      professional: {
        transactions: { used: 450, limit: 1000 },
        users: { used: 3, limit: 5 },
        storage: { used: 2.1, limit: 10 },
      },
      enterprise: {
        transactions: { used: 800, limit: -1 }, // unlimited
        users: { used: 5, limit: -1 }, // unlimited
        storage: { used: 50, limit: 500 },
      },
    };
    return planUsage[planType] || planUsage['free'];
  };

  const getPlanAccess = (planName: string): boolean => {
    if (!currentSubscription) return false;

    const planHierarchy = ['free', 'starter', 'professional', 'enterprise'];
    const currentPlanIndex = planHierarchy.indexOf(currentSubscription.planId);
    const requiredPlanIndex = planHierarchy.indexOf(planName.toLowerCase());

    return currentPlanIndex >= requiredPlanIndex;
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        currentSubscription,
        availablePlans,
        loading,
        error,
        fetchSubscriptionData,
        upgradePlan,
        downgradePlan,
        cancelSubscription,
        isFeatureAvailable,
        getPlanAccess,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
