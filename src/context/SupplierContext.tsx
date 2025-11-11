import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Supplier,
  fetchSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
} from '../api/suppliers';

interface SupplierContextType {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  fetchAll: (query?: string) => Promise<Supplier[]>;
  add: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier | null>;
  update: (id: number, supplier: Partial<Supplier>) => Promise<Supplier | null>;
  remove: (id: number) => Promise<boolean>;
}

const SupplierContext = createContext<SupplierContextType | undefined>(
  undefined,
);

export const useSupplierContext = () => {
  const ctx = useContext(SupplierContext);
  if (!ctx)
    throw new Error('useSupplierContext must be used within SupplierProvider');
  return ctx;
};

export const SupplierProvider = ({ children }: { children: ReactNode }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async (query = ''): Promise<Supplier[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuppliers(query);
      console.log(
        '🔍 SupplierContext: Fetched suppliers:',
        data.length,
        'suppliers',
      );
      if (data.length > 0) {
        console.log(
          '🔍 SupplierContext: First supplier sample:',
          JSON.stringify(data[0], null, 2),
        );
        console.log(
          '🔍 SupplierContext: First supplier phone:',
          data[0].phoneNumber,
        );
        console.log(
          '🔍 SupplierContext: First supplier address:',
          data[0].address,
        );
      }
      setSuppliers(data);
      return data;
    } catch (e: any) {
      setError(e.message || 'Failed to fetch suppliers');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const add = async (supplier: Omit<Supplier, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 SupplierContext: Creating supplier with data:', {
        name: supplier.name,
        partyName: supplier.partyName,
        phoneNumber: supplier.phoneNumber,
        address: supplier.address,
      });
      const newSupplier = await addSupplier(supplier);
      console.log(
        '🔍 SupplierContext: Created supplier response:',
        newSupplier,
      );
      setSuppliers(prev => [newSupplier, ...prev]);
      // Ensure cross-screen freshness
      try {
        await fetchAll('');
      } catch {}
      return newSupplier;
    } catch (e: any) {
      console.error('❌ SupplierContext: Error creating supplier:', e);
      setError(e.message || 'Failed to add supplier');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id: number, supplier: Partial<Supplier>) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateSupplier(id, supplier);
      setSuppliers(prev => prev.map(s => (s.id === id ? updated : s)));
      // Ensure other screens see latest name/phone/address
      try {
        await fetchAll('');
      } catch {}
      return updated;
    } catch (e: any) {
      setError(e.message || 'Failed to update supplier');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteSupplier(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      // Refresh list to avoid stale selections
      try {
        await fetchAll('');
      } catch {}
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed to delete supplier');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch fresh data if user is authenticated
    const checkAuthAndFetch = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          console.log(
            '🔍 SupplierContext: User authenticated, calling fetchAll...',
          );
          fetchAll();
        } else {
          console.log(
            '🔍 SupplierContext: User not authenticated, skipping fetchAll',
          );
        }
      } catch (error) {
        console.warn(
          '⚠️ SupplierContext: Error checking authentication:',
          error,
        );
      }
    };

    checkAuthAndFetch();
  }, []);

  return (
    <SupplierContext.Provider
      value={{ suppliers, loading, error, fetchAll, add, update, remove }}
    >
      {children}
    </SupplierContext.Provider>
  );
};
