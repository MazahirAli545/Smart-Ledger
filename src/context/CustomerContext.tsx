import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Customer,
  fetchCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
} from '../api/customers';

interface CustomerContextType {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  fetchAll: (query?: string) => Promise<Customer[]>;
  add: (customer: Omit<Customer, 'id'>) => Promise<Customer | null>;
  update: (id: number, customer: Partial<Customer>) => Promise<Customer | null>;
  remove: (id: number) => Promise<boolean>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(
  undefined,
);

export const useCustomerContext = () => {
  const ctx = useContext(CustomerContext);
  if (!ctx)
    throw new Error('useCustomerContext must be used within CustomerProvider');
  return ctx;
};

export const CustomerProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async (query = ''): Promise<Customer[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(query);
      console.log(
        '🔍 CustomerContext: Fetched customers:',
        data.length,
        'customers',
      );
      if (data.length > 0) {
        console.log(
          '🔍 CustomerContext: First customer sample:',
          JSON.stringify(data[0], null, 2),
        );
        console.log(
          '🔍 CustomerContext: First customer phone:',
          data[0].phoneNumber,
        );
        console.log(
          '🔍 CustomerContext: First customer address:',
          data[0].address,
        );
      }
      setCustomers(data);

      // Cache the customers data for persistence
      try {
        await AsyncStorage.setItem('cachedCustomers', JSON.stringify(data));
        console.log('🔍 CustomerContext: Cached customers data');
      } catch (cacheError) {
        console.warn(
          '⚠️ CustomerContext: Failed to cache customers:',
          cacheError,
        );
      }

      return data;
    } catch (e: any) {
      console.error('❌ CustomerContext: Error fetching customers:', e);
      const errorMessage =
        e.message || e.response?.data?.message || 'Failed to fetch customers';
      console.error('❌ CustomerContext: Error details:', {
        message: e.message,
        status: e.response?.status,
        statusText: e.response?.statusText,
        data: e.response?.data,
      });
      setError(errorMessage);

      // Try to return cached data if available
      try {
        const cachedData = await AsyncStorage.getItem('cachedCustomers');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          console.log(
            '🔍 CustomerContext: Using cached customers:',
            parsedData.length,
          );
          setCustomers(parsedData);
          return parsedData;
        }
      } catch (cacheError) {
        console.warn(
          '⚠️ CustomerContext: Failed to load cached customers:',
          cacheError,
        );
      }

      return [];
    } finally {
      setLoading(false);
    }
  };

  const add = async (customer: Omit<Customer, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      const newCustomer = await addCustomer(customer);
      setCustomers(prev => [newCustomer, ...prev]);
      // Ensure cross-screen freshness for all dropdowns and lookups
      try {
        await fetchAll('');
      } catch {}
      return newCustomer;
    } catch (e: any) {
      setError(e.message || 'Failed to add customer');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id: number, customer: Partial<Customer>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateCustomer(id, customer);
      setCustomers(prev => prev.map(c => (c.id === id ? updated : c)));
      // Refresh to propagate updated names/IDs across screens
      try {
        await fetchAll('');
      } catch {}
      return updated;
    } catch (e: any) {
      setError(e.message || 'Failed to update customer');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteCustomer(id);
      setCustomers(prev => prev.filter(c => c.id !== id));
      // Ensure lists are in sync after deletion
      try {
        await fetchAll('');
      } catch {}
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed to delete customer');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(
      '🔍 CustomerContext: useEffect triggered, loading cached data first...',
    );

    // Load cached customers first for immediate availability
    const loadCachedCustomers = async () => {
      try {
        const cachedData = await AsyncStorage.getItem('cachedCustomers');
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          console.log(
            '🔍 CustomerContext: Loaded cached customers:',
            parsedData.length,
          );
          setCustomers(parsedData);
        }
      } catch (error) {
        console.warn(
          '⚠️ CustomerContext: Failed to load cached customers:',
          error,
        );
      }
    };

    loadCachedCustomers();

    // Only fetch fresh data if user is authenticated
    const checkAuthAndFetch = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          console.log(
            '🔍 CustomerContext: User authenticated, calling fetchAll...',
          );
          fetchAll();
        } else {
          console.log(
            '🔍 CustomerContext: User not authenticated, skipping fetchAll',
          );
        }
      } catch (error) {
        console.warn(
          '⚠️ CustomerContext: Error checking authentication:',
          error,
        );
      }
    };

    checkAuthAndFetch();
  }, []);

  return (
    <CustomerContext.Provider
      value={{ customers, loading, error, fetchAll, add, update, remove }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
