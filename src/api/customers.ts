// src/api/customers.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Customer {
  id: number;
  partyName: string;
  partyType?: string;
  phoneNumber?: string;
  address?: string;
  gstNumber?: string;
  voucherType?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchCustomers(query: string = ''): Promise<Customer[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/customers${
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
  customer: Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<Customer> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customers`, {
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
  customer: Partial<
    Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  >,
): Promise<Customer> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customers/${id}`, {
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
  const res = await fetch(`${BASE_URL}/customers/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete customer');
  }
}
