// src/api/customers.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Customer {
  id: number;
  name: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchCustomers(query: string = ''): Promise<Customer[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/customer${
    query ? `?search=${encodeURIComponent(query)}` : ''
  }`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch customers');
  }
  const data = await res.json();
  return data;
}

export async function addCustomer(
  customer: Omit<Customer, 'id'>,
): Promise<Customer> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(customer),
  });
  if (!res.ok) {
    throw new Error('Failed to add customer');
  }
  const data = await res.json();
  return data;
}

export async function updateCustomer(
  id: number,
  customer: Partial<Customer>,
): Promise<Customer> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customer/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(customer),
  });
  if (!res.ok) {
    throw new Error('Failed to update customer');
  }
  const data = await res.json();
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customer/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete customer');
  }
}
