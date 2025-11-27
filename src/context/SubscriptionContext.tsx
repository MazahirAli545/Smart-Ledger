import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../api/unifiedApiService';
import { jwtDecode } from 'jwt-decode';

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
  fetchSubscriptionData: (forceRefreshPlans?: boolean) => Promise<void>;
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
    console.log('🔍 Mapping API plan:', apiPlan);
    console.log('🔍 API plan ID details:', {
      originalId: apiPlan.id,
      idType: typeof apiPlan.id,
      idValue: apiPlan.id,
      isNumber: typeof apiPlan.id === 'number',
      isString: typeof apiPlan.id === 'string',
      parsed: Number(apiPlan.id),
      isNaN: isNaN(Number(apiPlan.id)),
    });

    // Use the actual ID from the API
    const planId = apiPlan.id ? apiPlan.id.toString() : '999';
    console.log('🔍 Final plan ID:', planId);

    const mappedPlan = {
      id: planId,
      name: apiPlan.displayName || apiPlan.name,
      price: parseFloat(apiPlan.price) || 0,
      period:
        apiPlan.billingCycle === 'month'
          ? 'month'
          : apiPlan.billingCycle === 'year'
          ? 'year'
          : apiPlan.billingCycle === 'monthly'
          ? 'month'
          : 'month',
      description: apiPlan.description || 'No description available',
      features: Array.isArray(apiPlan.features) ? apiPlan.features : [],
      limits: {
        transactions: apiPlan.maxTransactions || 0,
        users: getPlanUserLimit(apiPlan.name || apiPlan.displayName),
        storage: getPlanStorageLimit(apiPlan.name || apiPlan.displayName),
      },
      isPopular: apiPlan.isPopular || false,
    };

    console.log('🔍 Mapped plan result:', mappedPlan);
    return mappedPlan;
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

  const fetchSubscriptionData = async (forceRefreshPlans: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');

      // Build headers with Authorization if token exists
      const commonHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        commonHeaders.Authorization = `Bearer ${token}`;
      }

      // Fetch plans from API only if not already loaded or force refresh is requested
      // Plans don't change frequently, so we can cache them
      let mappedPlans: SubscriptionPlan[] =
        availablePlans.length > 0 && !forceRefreshPlans ? availablePlans : [];

      if (mappedPlans.length === 0 || forceRefreshPlans) {
        try {
          console.log('🔍 Fetching plans from API:', '/plans');
          // Use unified API - get() already returns response.data
          // Plans endpoint is public (no auth required), so skip auth
          const plansResult = await unifiedApi.get('/plans', {
            skipAuth: true, // Plans endpoint is public, no auth required
          });
          console.log('📡 Plans API Response:', plansResult);
          console.log('📡 Plans API Response Type:', typeof plansResult);
          console.log(
            '📡 Plans API Response Is Array:',
            Array.isArray(plansResult),
          );

          // Backend returns array directly, but unifiedApi.get() wraps it
          // Handle both cases: direct array or wrapped in { data: ... }
          let plansArray: any[] = [];

          if (Array.isArray(plansResult)) {
            // Direct array response
            plansArray = plansResult;
          } else if (plansResult && typeof plansResult === 'object') {
            // Wrapped response - check for data property
            if (Array.isArray((plansResult as any).data)) {
              plansArray = (plansResult as any).data;
            } else if (Array.isArray((plansResult as any).plans)) {
              plansArray = (plansResult as any).plans;
            } else {
              // Try to extract array from any property
              const keys = Object.keys(plansResult);
              for (const key of keys) {
                if (Array.isArray((plansResult as any)[key])) {
                  plansArray = (plansResult as any)[key];
                  break;
                }
              }
            }
          }

          console.log('📡 Plans Array Length:', plansArray.length);
          console.log(
            '📡 Plans Array Data:',
            JSON.stringify(plansArray, null, 2),
          );

          if (plansArray.length > 0) {
            mappedPlans = plansArray.map(mapApiPlanToSubscriptionPlan);
            console.log('📡 Mapped Plans Count:', mappedPlans.length);
            console.log(
              '📡 Mapped Plans:',
              mappedPlans.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
              })),
            );
          } else {
            console.warn(
              '⚠️ Plans array is empty - no plans found in response',
            );
          }
        } catch (e: any) {
          console.error('❌ Plans API request failed:', e);
          // Safely log error details
          try {
            const errorDetails: any = {};
            if (e?.message) errorDetails.message = e.message;
            if (e?.status) errorDetails.status = e.status;
            if (e?.response) errorDetails.response = e.response;
            if (e?.data) errorDetails.data = e.data;
            console.error('❌ Error details:', errorDetails);
          } catch (logError) {
            console.error('❌ Error logging failed:', logError);
          }
          setError(e?.message || 'Failed to fetch plans');
        }

        if (mappedPlans.length === 0) {
          console.log(
            '⚠️ No plans available from API - this may indicate a backend issue',
          );
          // Don't set any fallback plans - show empty state instead
          mappedPlans = [];
        }

        setAvailablePlans(mappedPlans);
      } else {
        console.log('✅ Using cached plans, skipping API call');
      }

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
            // Decode JWT token to get user ID (RN-safe)
            const tokenPayload: any = jwtDecode(token);
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

      // Fetch subscription data from /subscriptions/current endpoint first (most up-to-date)
      // This endpoint returns the current subscription with plan details
      let subscriptionData: any = null;
      try {
        console.log('🔍 Fetching subscription from /subscriptions/current...');
        const subscriptionResult = await unifiedApi.get(
          '/subscriptions/current',
          {
            cache: false, // always fetch latest plan status (live vs cached)
          },
        );
        const subscriptionResultData =
          (subscriptionResult as any)?.data ?? subscriptionResult ?? {};

        // Backend returns { success: true, data: subscription } or direct subscription object
        if (
          (subscriptionResultData as any).success &&
          (subscriptionResultData as any).data
        ) {
          subscriptionData = (subscriptionResultData as any).data;
        } else if (
          subscriptionResultData &&
          typeof subscriptionResultData === 'object' &&
          (subscriptionResultData as any).id
        ) {
          subscriptionData = subscriptionResultData;
        }

        console.log(
          '📡 Subscription data from /subscriptions/current:',
          subscriptionData,
        );
      } catch (subError) {
        console.warn(
          '⚠️ Failed to fetch from /subscriptions/current, falling back to /users/profile:',
          subError,
        );
      }

      // Fallback to user profile if subscription endpoint doesn't have data
      let userData: any = null;
      if (!subscriptionData) {
        try {
          console.log('🔍 Fetching user data from /users/profile...');
          const result = await unifiedApi.get('/users/profile', {
            cache: false,
          });
          userData = (result as any)?.data ?? result;
          console.log('📡 User data fetched:', userData);
        } catch (userError) {
          console.warn('⚠️ Failed to fetch from /users/profile:', userError);
        }
      }

      // Extract plan information from subscription data or user data
      let planType = 'free';
      let planName = 'Free';
      let planAmount = 0;
      let nextBillingDate: string | null = null;
      let startDate = '2024-01-01';
      let endDate = '2024-12-31';

      if (subscriptionData) {
        // Use subscription data (most accurate)
        const plan =
          subscriptionData.plan ||
          subscriptionData.planName ||
          subscriptionData.planType;
        if (plan) {
          if (typeof plan === 'object') {
            planName = plan.displayName || plan.name || 'Free';
            planType = (plan.name || plan.displayName || 'free').toLowerCase();
            planAmount = parseFloat(plan.price || 0);
          } else {
            planName = String(plan);
            planType = String(plan).toLowerCase();
            // Try to find plan amount from availablePlans
            const matchedPlan = availablePlans.find(
              (p: any) => p.name?.toLowerCase() === planType,
            );
            planAmount = matchedPlan?.price || 0;
          }
        }
        nextBillingDate =
          subscriptionData.nextBillingDate ||
          subscriptionData.endDate ||
          subscriptionData.expiryDate;
        startDate =
          subscriptionData.startDate ||
          subscriptionData.createdAt ||
          '2024-01-01';
        endDate =
          subscriptionData.endDate ||
          subscriptionData.expiryDate ||
          '2024-12-31';
      } else if (userData) {
        // Fallback to user data
        planType = userData.planType?.toLowerCase() || 'free';
        planName = planType.charAt(0).toUpperCase() + planType.slice(1);
        planAmount = getPlanAmount(planType);
        nextBillingDate = userData.planExpiryDT || '2025-01-15';
        startDate = userData.planFromDT || '2024-01-01';
        endDate = userData.planUpToDT || '2024-12-31';
      }

      // Map premium to professional
      if (planType === 'premium') {
        planType = 'professional';
        planName = 'Professional';
      }

      // If we still don't have plan amount, calculate from plan type
      if (planAmount === 0) {
        planAmount = getPlanAmount(planType);
      }

      // Create subscription data
      const currentSubscription: CurrentSubscription = {
        planId: planType,
        planName: planName,
        status: subscriptionData?.status || 'active',
        startDate: startDate,
        endDate: endDate,
        nextBillingDate: nextBillingDate || '2025-01-15',
        amount: planAmount,
        usage: getPlanUsage(planType),
      };

      console.log('✅ Current subscription updated:', currentSubscription);
      setCurrentSubscription(currentSubscription);
    } catch (err: any) {
      // Avoid redbox overlays by using warn and set a safe default
      console.warn('Failed to fetch subscription data:', err);
      setError(err.message || 'Failed to fetch subscription data');
      if (!currentSubscription) {
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
      }
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

      // API call to upgrade subscription using unifiedApi
      // unifiedApi.post() returns response.data directly
      const response = await unifiedApi.post('/subscriptions', {
        planId: parseInt(planId),
      });

      console.log('Upgrading to plan:', planId, 'Response:', response);

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

      // Backend handles downgrade via the same upgrade endpoint
      // If the selected plan is cheaper, it switches immediately without payment
      // unifiedApi.post() returns response.data directly
      const response = await unifiedApi.post('/subscriptions/upgrade', {
        planId: parseInt(planId, 10),
      });

      console.log(
        'Downgrade request sent (upgrade endpoint):',
        planId,
        'Response:',
        response,
      );

      // Check if response indicates success
      // unifiedApi.post() returns data directly, check for success indicators
      const responseData = (response as any)?.data ?? response;
      const isSuccess = !!(
        responseData?.success ||
        responseData?.id ||
        responseData?.subscriptionId ||
        (responseData &&
          !responseData.error &&
          !responseData.message?.includes('error'))
      );

      if (!isSuccess) {
        const errorMsg = responseData?.message || 'Failed to downgrade plan';
        console.warn('❌ Downgrade failed:', errorMsg);

        // Check if it's the "already subscribed" error - don't log as error
        if (
          errorMsg.toLowerCase().includes('already subscribed') ||
          errorMsg.toLowerCase().includes('already on this plan')
        ) {
          console.log('ℹ️ User is already on this plan');
        }

        setError(errorMsg);
        return false;
      }

      // 🎯 FIXED: Invalidate subscription cache to ensure fresh data
      try {
        unifiedApi.invalidateCachePattern('.*/subscriptions.*');
        unifiedApi.invalidateCachePattern('.*/users/profile.*');
        console.log('✅ Invalidated subscription cache after downgrade');
      } catch (cacheError) {
        console.warn('⚠️ Failed to invalidate cache:', cacheError);
      }

      // Refresh subscription data immediately
      await fetchSubscriptionData(false); // false = don't refresh plans

      // 🎯 FIXED: Add multiple retries with increasing delays to ensure backend updates are visible
      // This ensures the current plan is immediately updated in the UI
      setTimeout(async () => {
        console.log(
          '🔄 First retry: Refreshing subscription data after plan downgrade (1s delay)...',
        );
        // Invalidate cache again before retry
        try {
          unifiedApi.invalidateCachePattern('.*/subscriptions.*');
          unifiedApi.invalidateCachePattern('.*/users/profile.*');
        } catch {}
        // Refresh subscription data again after delay to get updated plan
        await fetchSubscriptionData(false); // false = don't refresh plans

        // Second retry with longer delay
        setTimeout(async () => {
          console.log(
            '🔄 Second retry: Refreshing subscription data after plan downgrade (2.5s delay)...',
          );
          // Invalidate cache again before retry
          try {
            unifiedApi.invalidateCachePattern('.*/subscriptions.*');
            unifiedApi.invalidateCachePattern('.*/users/profile.*');
          } catch {}
          await fetchSubscriptionData(false); // false = don't refresh plans

          // Third retry with even longer delay
          setTimeout(async () => {
            console.log(
              '🔄 Third retry: Refreshing subscription data after plan downgrade (4s delay)...',
            );
            // Invalidate cache again before retry
            try {
              unifiedApi.invalidateCachePattern('.*/subscriptions.*');
              unifiedApi.invalidateCachePattern('.*/users/profile.*');
            } catch {}
            await fetchSubscriptionData(false); // false = don't refresh plans
          }, 1500); // Wait another 1.5 seconds (total 4s from first retry)
        }, 1500); // Wait another 1.5 seconds (total 2.5s from first retry)
      }, 1000); // Wait 1 second for backend to update subscription

      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to downgrade plan';

      // Check if it's the "already subscribed" error - don't log as error
      if (
        errorMsg.toLowerCase().includes('already subscribed') ||
        errorMsg.toLowerCase().includes('already on this plan')
      ) {
        console.log('ℹ️ User is already on this plan');
      } else {
        console.error('❌ Downgrade error:', errorMsg);
      }

      setError(errorMsg);
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

      // API call to cancel subscription using unifiedApi
      // unifiedApi.delete() returns response.data directly
      const response = await unifiedApi.delete('/subscriptions/current');

      console.log('Cancelling subscription, response:', response);

      // Refresh subscription data
      await fetchSubscriptionData();
      return !!response; // If response exists, assume success
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
