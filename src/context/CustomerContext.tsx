import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
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
  fetchAll: (query?: string) => Promise<void>;
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

  const fetchAll = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(query);
      console.log('🔍 CustomerContext: Fetched customers:', data);
      console.log('🔍 CustomerContext: First customer sample:', data[0]);
      setCustomers(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch customers');
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
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed to delete customer');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <CustomerContext.Provider
      value={{ customers, loading, error, fetchAll, add, update, remove }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
