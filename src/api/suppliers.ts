import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Supplier {
  id: number;
  name: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchSuppliers(query: string = ''): Promise<Supplier[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/supplier${
    query ? `?search=${encodeURIComponent(query)}` : ''
  }`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch suppliers');
  }
  const data = await res.json();
  return data;
}

export async function addSupplier(
  supplier: Omit<Supplier, 'id'>,
): Promise<Supplier> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/supplier`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(supplier),
  });
  if (!res.ok) {
    throw new Error('Failed to add supplier');
  }
  const data = await res.json();
  return data;
}

export async function updateSupplier(
  id: number,
  supplier: Partial<Supplier>,
): Promise<Supplier> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/supplier/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(supplier),
  });
  if (!res.ok) {
    throw new Error('Failed to update supplier');
  }
  const data = await res.json();
  return data;
}

export async function deleteSupplier(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/supplier/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete supplier');
  }
}
