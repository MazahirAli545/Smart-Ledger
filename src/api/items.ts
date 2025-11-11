import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ItemNameResponse {
  data: string[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchItemNames(
  search: string = '',
  page: number = 1,
  limit: number = 10,
): Promise<ItemNameResponse> {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) {
    return { data: [], total: 0, page: 1, limit };
  }
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append('search', search);
  const res = await fetch(`${BASE_URL}/items/names?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { data: [], total: 0, page: 1, limit };
  }
  const json = await res.json();
  const data = Array.isArray(json?.data)
    ? json
    : {
        data: json,
        total: json?.total ?? 0,
        page: json?.page ?? 1,
        limit: json?.limit ?? limit,
      };
  return data as ItemNameResponse;
}

export async function upsertItemNames(
  names: string[],
): Promise<{ inserted: number; total: number }> {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token || !Array.isArray(names) || names.length === 0) {
    return { inserted: 0, total: 0 };
  }
  const res = await fetch(`${BASE_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ names }),
  });
  if (!res.ok) {
    return { inserted: 0, total: names.length };
  }
  return res.json();
}
