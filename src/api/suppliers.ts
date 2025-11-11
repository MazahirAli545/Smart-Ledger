import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Supplier {
  id: number;
  name?: string;
  partyName?: string;
  phoneNumber?: string;
  address?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchSuppliers(query: string = ''): Promise<Supplier[]> {
  const token = await AsyncStorage.getItem('accessToken');

  // Check if user is authenticated before making API calls
  if (!token) {
    console.log('🔍 fetchSuppliers: No token found, returning empty array');
    return [];
  }

  // Use dedicated suppliers endpoint for consistency with create route
  const url = `${BASE_URL}/customers/suppliers`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      // Handle 401 specifically - user needs to re-authenticate
      if (res.status === 401) {
        console.log(
          '🔍 fetchSuppliers: 401 Unauthorized - user needs to re-authenticate',
        );
        return [];
      }
      throw new Error('Failed to fetch suppliers');
    }

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : json;
    const normalized: Supplier[] = (rows || []).map((c: any) => {
      // Debug the raw API response first
      console.log('🔍 fetchSuppliers: Raw API response for supplier:', {
        id: c.id ?? c.ID ?? c.customerId,
        name: c.name,
        partyName: c.partyName,
        party_name: c.party_name,
        phoneNumber: c.phoneNumber,
        phone: c.phone,
        phone_number: c.phone_number,
        address: c.address,
        addresses: c.addresses,
      });

      const supplier = {
        id: Number(c.id ?? c.ID ?? c.customerId ?? c.supplierId),
        name: c.name || c.partyName || c.party_name || c.supplierName,
        partyName: c.partyName || c.name || c.party_name || c.supplierName,
        phoneNumber: (() => {
          const phoneRaw =
            c.phoneNumber ||
            c.phone ||
            c.phone_number ||
            c.mobile ||
            c.contactNo ||
            '';
          const digits = String(phoneRaw).replace(/\D/g, '');
          // If it's just country code (1-3 digits like "91"), return empty
          if (digits.length <= 3) return '';
          // Otherwise return last 10 digits for valid numbers
          return digits.slice(-10);
        })(),
        address:
          c.address ||
          c.partyAddress ||
          (Array.isArray(c.addresses)
            ? c.addresses[0]?.addressLine1 || c.addresses[0]?.address
            : undefined),
        userId: c.userId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };

      // Debug logging for supplier data
      console.log('🔍 fetchSuppliers: Normalized supplier:', {
        id: supplier.id,
        name: supplier.name,
        partyName: supplier.partyName,
        phoneNumber: supplier.phoneNumber,
        address: supplier.address,
      });

      return supplier;
    });

    if (query) {
      const q = query.toLowerCase();
      return normalized.filter(s =>
        (s.name || s.partyName || '').toLowerCase().includes(q),
      );
    }
    return normalized;
  } catch (error) {
    console.error('❌ fetchSuppliers: Network or other error:', error);
    return [];
  }
}

export async function addSupplier(
  supplier: Omit<Supplier, 'id'>,
): Promise<Supplier> {
  const token = await AsyncStorage.getItem('accessToken');
  // Create supplier via customers service
  const payload: any = {
    partyName: supplier.name || supplier.partyName || '',
    name: supplier.name || supplier.partyName || '',
    partyType: 'Supplier',
  };
  // Pass phone/address when available (backend expects 'phone' field)
  if (supplier.phoneNumber) {
    const digits = String(supplier.phoneNumber).replace(/\D/g, '');
    // Backend expects 10-13 digits, optionally starting with +
    if (digits && digits.length >= 10 && digits.length <= 13) {
      payload.phone = digits; // Backend expects 'phone' field
      payload.phoneNumber = digits; // Keep for compatibility
    } else if (digits && digits.length > 13) {
      // If more than 13 digits, take the last 13
      const trimmedDigits = digits.slice(-13);
      payload.phone = trimmedDigits;
      payload.phoneNumber = trimmedDigits;
    }
  }
  if (supplier.address) {
    payload.address = supplier.address;
    payload.addressLine1 = supplier.address;
    payload.addresses = [
      { type: 'billing', flatBuildingNumber: supplier.address },
    ];
  }

  console.log('🔍 addSupplier API: Input supplier data:', {
    name: supplier.name,
    partyName: supplier.partyName,
    phoneNumber: supplier.phoneNumber,
    address: supplier.address,
  });
  console.log('🔍 addSupplier API: Payload being sent:', payload);
  const res = await fetch(`${BASE_URL}/customers/suppliers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.error('❌ addSupplier API: Backend error:', {
      status: res.status,
      error: error,
    });
    throw new Error(
      error.message || `Failed to create supplier: ${res.status}`,
    );
  }
  const data = await res.json();
  console.log('🔍 addSupplier API: Backend response:', data);
  // Normalize returned shape
  const normalized = {
    id: Number(data?.id ?? data?.data?.id),
    name: data?.name || data?.partyName || payload.name,
    partyName: data?.partyName || data?.name || payload.name,
    phoneNumber: (() => {
      const phoneRaw = data?.phone || data?.phoneNumber || payload.phone || '';
      const digits = String(phoneRaw).replace(/\D/g, '');
      // If it's just country code (1-3 digits like "91"), return empty
      if (digits.length <= 3) return '';
      // Otherwise return last 10 digits for valid numbers
      return digits.slice(-10);
    })(),
    address: data?.address || data?.addressLine1 || payload.address || '',
    userId: data?.userId,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  } as Supplier;
  console.log('🔍 addSupplier API: Normalized response:', normalized);
  return normalized;
}

export async function updateSupplier(
  id: number,
  supplier: Partial<Supplier>,
): Promise<Supplier> {
  const token = await AsyncStorage.getItem('accessToken');
  // Use customers update endpoint
  const payload: any = {
    partyName: supplier.name || supplier.partyName,
    name: supplier.name || supplier.partyName,
  };

  // Add phone/address fields if provided
  if (supplier.phoneNumber) {
    const digits = String(supplier.phoneNumber).replace(/\D/g, '');
    // Backend expects 10-13 digits, optionally starting with +
    if (digits && digits.length >= 10 && digits.length <= 13) {
      payload.phone = digits; // Backend expects 'phone' field
      payload.phoneNumber = digits; // Keep for compatibility
    } else if (digits && digits.length > 13) {
      // If more than 13 digits, take the last 13
      const trimmedDigits = digits.slice(-13);
      payload.phone = trimmedDigits;
      payload.phoneNumber = trimmedDigits;
    }
  }

  if (supplier.address) {
    payload.address = supplier.address;
    payload.addressLine1 = supplier.address;
    payload.addresses = [
      { type: 'billing', flatBuildingNumber: supplier.address },
    ];
  }

  console.log('🔍 updateSupplier API: Input supplier data:', {
    id,
    name: supplier.name,
    partyName: supplier.partyName,
    phoneNumber: supplier.phoneNumber,
    address: supplier.address,
  });
  console.log('🔍 updateSupplier API: Payload being sent:', payload);

  const res = await fetch(`${BASE_URL}/customers/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    console.error('❌ updateSupplier API: Backend error:', {
      status: res.status,
      error: error,
    });
    throw new Error(
      error.message || `Failed to update supplier: ${res.status}`,
    );
  }
  const data = await res.json();
  console.log('🔍 updateSupplier API: Backend response:', data);

  // Normalize returned shape
  const normalized = {
    id: Number(data?.id ?? id),
    name: data?.name || data?.partyName || payload.name,
    partyName: data?.partyName || data?.name || payload.name,
    phoneNumber:
      // prefer backend phone → normalize to last 10 for UI
      (data?.phone || data?.phoneNumber || payload.phone || '')
        ?.toString()
        .replace(/\D/g, '')
        .slice(-10) || '',
    address: data?.address || data?.addressLine1 || payload.address || '',
    userId: data?.userId,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  } as Supplier;

  console.log('🔍 updateSupplier API: Normalized response:', normalized);
  return normalized;
}

export async function deleteSupplier(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  // Use customers delete endpoint
  const res = await fetch(`${BASE_URL}/customers/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete supplier');
  }
}

// Fetch single supplier/customer detail and normalize
export async function fetchSupplierById(id: number): Promise<Supplier | null> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/customers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return null;
  }
  const c = await res.json();
  if (!c) return null;
  return {
    id: Number(c.id ?? c.ID ?? id),
    name: c.name || c.partyName || c.party_name,
    partyName: c.partyName || c.name || c.party_name,
    phoneNumber:
      c.phoneNumber || c.phone || c.phone_number || c.mobile || c.contactNo,
    address:
      c.address ||
      c.partyAddress ||
      (Array.isArray(c.addresses)
        ? c.addresses[0]?.addressLine1 || c.addresses[0]?.address
        : undefined),
    userId: c.userId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  } as Supplier;
}
