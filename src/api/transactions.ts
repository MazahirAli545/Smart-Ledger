// src/api/transactions.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: number;
  customerId?: number;
  type: 'CREDIT' | 'DEBIT' | 'RECEIPT' | 'PAYMENT';
  amount: number;
  description?: string;
  invoiceNumber?: string;
  category?: string;
  gstNumber?: string;
  items?: TransactionItem[];
  purchaseTerms?: string;
  attachments?: string[];
  cGST?: number;
  sGST?: number;
  iGST?: number;
  gstPct?: number;
  discount?: number;
  shippingAmount?: number;
  subTotal?: number;
  totalAmount?: number;
  documentDate?: string;
  method?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransactionItem {
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  customerName?: string;
  customerId?: number;
  category?: string;
}

export interface TransactionResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Get all transactions with filtering
export async function fetchTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionResponse> {
  const token = await AsyncStorage.getItem('accessToken');

  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.type) queryParams.append('type', filters.type);
  if (filters.minAmount)
    queryParams.append('minAmount', filters.minAmount.toString());
  if (filters.maxAmount)
    queryParams.append('maxAmount', filters.maxAmount.toString());
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.customerName)
    queryParams.append('customerName', filters.customerName);
  if (filters.customerId)
    queryParams.append('customerId', filters.customerId.toString());
  if (filters.category) queryParams.append('category', filters.category);

  const url = `${BASE_URL}/transactions${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch transactions');
  }
  const data = await res.json();
  return data;
}

// Get transaction by ID
export async function fetchTransactionById(id: number): Promise<Transaction> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch transaction');
  }
  const data = await res.json();
  return data;
}

// Create transaction
export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<Transaction> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) {
    throw new Error('Failed to create transaction');
  }
  const data = await res.json();
  return data;
}

// Update transaction
export async function updateTransaction(
  id: number,
  transaction: Partial<
    Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  >,
): Promise<Transaction> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(transaction),
  });
  if (!res.ok) {
    throw new Error('Failed to update transaction');
  }
  const data = await res.json();
  return data;
}

// Delete transaction
export async function deleteTransaction(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete transaction');
  }
}

// Get transactions by customer ID
export async function fetchTransactionsByCustomer(
  customerId: number,
  filters: Omit<TransactionFilters, 'customerId'> = {},
): Promise<TransactionResponse> {
  const token = await AsyncStorage.getItem('accessToken');

  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.type) queryParams.append('type', filters.type);
  if (filters.minAmount)
    queryParams.append('minAmount', filters.minAmount.toString());
  if (filters.maxAmount)
    queryParams.append('maxAmount', filters.maxAmount.toString());
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.customerName)
    queryParams.append('customerName', filters.customerName);
  if (filters.category) queryParams.append('category', filters.category);

  const url = `${BASE_URL}/transactions/customer/${customerId}${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch customer transactions');
  }
  const data = await res.json();
  return data;
}

// Export transactions as CSV
export async function exportTransactionsCSV(
  filters: TransactionFilters = {},
): Promise<Blob> {
  const token = await AsyncStorage.getItem('accessToken');

  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.type) queryParams.append('type', filters.type);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.customerId)
    queryParams.append('customerId', filters.customerId.toString());
  if (filters.category) queryParams.append('category', filters.category);

  const url = `${BASE_URL}/transactions/export/csv${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to export transactions CSV');
  }
  return res.blob();
}

// Export transactions as PDF
export async function exportTransactionsPDF(
  filters: TransactionFilters = {},
): Promise<Blob> {
  const token = await AsyncStorage.getItem('accessToken');

  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.type) queryParams.append('type', filters.type);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.customerId)
    queryParams.append('customerId', filters.customerId.toString());
  if (filters.category) queryParams.append('category', filters.category);

  const url = `${BASE_URL}/transactions/export/pdf${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to export transactions PDF');
  }
  return res.blob();
}

// Delete transaction by ID
export async function deleteTransactionById(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete transaction');
  }
}

// Get transactions by customer ID with pagination
export async function fetchTransactionsByCustomerId(
  customerId: number,
  filters: Omit<TransactionFilters, 'customerId'> = {},
): Promise<TransactionResponse> {
  const token = await AsyncStorage.getItem('accessToken');

  // Build query string
  const queryParams = new URLSearchParams();
  if (filters.page) queryParams.append('page', filters.page.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.type) queryParams.append('type', filters.type);
  if (filters.minAmount)
    queryParams.append('minAmount', filters.minAmount.toString());
  if (filters.maxAmount)
    queryParams.append('maxAmount', filters.maxAmount.toString());
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.customerName)
    queryParams.append('customerName', filters.customerName);
  if (filters.category) queryParams.append('category', filters.category);

  const url = `${BASE_URL}/transactions/customer/${customerId}${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch customer transactions');
  }
  const data = await res.json();
  return data;
}
