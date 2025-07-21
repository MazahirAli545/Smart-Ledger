import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
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
  fetchAll: (query?: string) => Promise<void>;
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

  const fetchAll = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuppliers(query);
      setSuppliers(data);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  const add = async (supplier: Omit<Supplier, 'id'>) => {
    setLoading(true);
    setError(null);
    try {
      const newSupplier = await addSupplier(supplier);
      setSuppliers(prev => [newSupplier, ...prev]);
      return newSupplier;
    } catch (e: any) {
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
      return true;
    } catch (e: any) {
      setError(e.message || 'Failed to delete supplier');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <SupplierContext.Provider
      value={{ suppliers, loading, error, fetchAll, add, update, remove }}
    >
      {children}
    </SupplierContext.Provider>
  );
};
