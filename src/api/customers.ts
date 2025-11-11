// src/api/customers.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Customer {
  id: number;
  partyName?: string;
  name?: string; // Add name field as alternative
  partyType?: string;
  phoneNumber?: string;
  address?: string;
  gstNumber?: string;
  voucherType?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Normalize customer data from API response, handling various field name variations
function normalizeCustomerData(rawCustomers: any[]): Customer[] {
  return rawCustomers.map((c: any) => {
    // Debug the raw API response first
    console.log('🔍 normalizeCustomerData: Raw API response for customer:', {
      id: c.id ?? c.ID ?? c.customerId,
      name: c.name,
      partyName: c.partyName,
      party_name: c.party_name,
      customerName: c.customerName,
      phoneNumber: c.phoneNumber,
      phone: c.phone,
      phone_number: c.phone_number,
      address: c.address,
      addresses: c.addresses,
    });

    const customer = {
      id: Number(c.id ?? c.ID ?? c.customerId),
      name: c.name || c.partyName || c.party_name || c.customerName,
      partyName: c.partyName || c.name || c.party_name || c.customerName,
      partyType: c.partyType || c.party_type,
      phoneNumber:
        c.phoneNumber || c.phone || c.phone_number || c.mobile || c.contactNo,
      address:
        c.address ||
        c.partyAddress ||
        (Array.isArray(c.addresses)
          ? c.addresses[0]?.addressLine1 || c.addresses[0]?.address
          : undefined),
      gstNumber: c.gstNumber || c.gst_number || c.gst,
      voucherType: c.voucherType || c.voucher_type,
      userId: c.userId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };

    // Debug logging for normalized customer data
    console.log('🔍 normalizeCustomerData: Normalized customer:', {
      id: customer.id,
      name: customer.name,
      partyName: customer.partyName,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
    });

    return customer;
  });
}

export async function fetchCustomers(query: string = ''): Promise<Customer[]> {
  const token = await AsyncStorage.getItem('accessToken');

  // Check if user is authenticated before making API calls
  if (!token) {
    console.log('🔍 fetchCustomers: No token found, returning empty array');
    return [];
  }

  // Use customers-only endpoint to ensure we only get customers, not suppliers
  const url = `${BASE_URL}/customers/customers-only${
    query ? `?search=${encodeURIComponent(query)}` : '?page=1&limit=50'
  }`;
  console.log('🔍 fetchCustomers: Fetching from URL:', url);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Handle 401 specifically - user needs to re-authenticate
      if (res.status === 401) {
        console.log(
          '🔍 fetchCustomers: 401 Unauthorized - user needs to re-authenticate',
        );
        return [];
      }

      console.error(
        '❌ fetchCustomers: API error:',
        res.status,
        res.statusText,
      );
      // Fallback to regular customers endpoint if customers-only fails
      console.log(
        '🔍 fetchCustomers: Falling back to regular customers endpoint',
      );
      const fallbackUrl = `${BASE_URL}/customers${
        query ? `?search=${encodeURIComponent(query)}` : '?page=1&limit=50'
      }`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!fallbackRes.ok) {
        if (fallbackRes.status === 401) {
          console.log(
            '🔍 fetchCustomers: Fallback also returned 401 - user needs to re-authenticate',
          );
          return [];
        }
        throw new Error('Failed to fetch customers');
      }

      const fallbackData = await fallbackRes.json();
      console.log('🔍 fetchCustomers: Fallback API response:', fallbackData);

      // Filter to only include customers (not suppliers)
      const rawCustomers = Array.isArray(fallbackData.data)
        ? fallbackData.data
        : Array.isArray(fallbackData)
        ? fallbackData
        : [];

      // Normalize the customer data first
      const normalizedCustomers = normalizeCustomerData(rawCustomers);

      // Filter out suppliers - assume customers have partyType 'customer' or no partyType
      const filteredCustomers = normalizedCustomers.filter(
        (item: any) =>
          !item.partyType || item.partyType.toLowerCase() === 'customer',
      );

      console.log(
        '🔍 fetchCustomers: Filtered customers:',
        filteredCustomers.length,
      );
      return filteredCustomers;
    }

    const data = await res.json();
    console.log('🔍 fetchCustomers: API response:', data);

    // Handle paginated response format
    if (data && typeof data === 'object' && 'data' in data) {
      console.log(
        '🔍 fetchCustomers: Paginated response, extracting data array',
      );
      const rawCustomers = Array.isArray(data.data) ? data.data : [];
      return normalizeCustomerData(rawCustomers);
    }

    // Handle direct array response
    if (Array.isArray(data)) {
      console.log('🔍 fetchCustomers: Direct array response');
      return normalizeCustomerData(data);
    }

    console.warn('🔍 fetchCustomers: Unexpected response format:', data);
    return [];
  } catch (error) {
    console.error('❌ fetchCustomers: Network or other error:', error);
    return [];
  }
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

// Get customers only (not suppliers)
export async function fetchCustomersOnly(
  query: string = '',
  page: number = 1,
  limit: number = 10,
): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
  const token = await AsyncStorage.getItem('accessToken');
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (query) {
    params.append('search', query);
  }
  const url = `${BASE_URL}/customers/customers-only?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch customers only');
  }
  const data = await res.json();
  return data;
}
