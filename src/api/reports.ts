// src/api/reports.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Report {
  id: number;
  reportType: string;
  title: string;
  description?: string;
  filters: ReportFilters;
  status: 'draft' | 'generated' | 'failed';
  generatedAt?: string;
  filePath?: string;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  customerIds?: number[];
  supplierIds?: number[];
  transactionTypes?: string[];
  minAmount?: number;
  maxAmount?: number;
  categories?: string[];
}

export interface ReportResponse {
  data: Report[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReportSummary {
  totalTransactions: number;
  totalAmount: number;
  creditAmount: number;
  debitAmount: number;
  netAmount: number;
  period: string;
  generatedAt: string;
}

export interface CustomerLedger {
  customerId: number;
  customerName: string;
  openingBalance: number;
  transactions: CustomerLedgerTransaction[];
  closingBalance: number;
  period: string;
}

export interface CustomerLedgerTransaction {
  id: number;
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

// Create report
export async function createReport(
  report: Omit<
    Report,
    | 'id'
    | 'userId'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'generatedAt'
    | 'filePath'
  >,
): Promise<Report> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(report),
  });
  if (!res.ok) {
    throw new Error('Failed to create report');
  }
  const data = await res.json();
  return data;
}

// Get all reports
export async function fetchReports(
  page: number = 1,
  limit: number = 10,
): Promise<ReportResponse> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/reports?page=${page}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch reports');
  }
  const data = await res.json();
  return data;
}

// Get report by ID
export async function fetchReportById(id: number): Promise<Report> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch report');
  }
  const data = await res.json();
  return data;
}

// Generate report
export async function generateReport(id: number): Promise<Report> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports/${id}/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to generate report');
  }
  const data = await res.json();
  return data;
}

// Export report as CSV
export async function exportReportCSV(id: number): Promise<Blob> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports/${id}/export/csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to export report CSV');
  }
  return res.blob();
}

// Export report as PDF
export async function exportReportPDF(id: number): Promise<Blob> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports/${id}/export/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to export report PDF');
  }
  return res.blob();
}

// Delete report
export async function deleteReport(id: number): Promise<void> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to delete report');
  }
}

// Get customer ledger
export async function fetchCustomerLedger(
  customerId: number,
  startDate?: string,
  endDate?: string,
): Promise<CustomerLedger> {
  const token = await AsyncStorage.getItem('accessToken');

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const url = `${BASE_URL}/reports/customer-ledger/${customerId}${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch customer ledger');
  }
  const data = await res.json();
  return data;
}

// Get supplier ledger
export async function fetchSupplierLedger(
  supplierId: number,
  startDate?: string,
  endDate?: string,
): Promise<CustomerLedger> {
  const token = await AsyncStorage.getItem('accessToken');

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const url = `${BASE_URL}/reports/supplier-ledger/${supplierId}${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch supplier ledger');
  }
  const data = await res.json();
  return data;
}

// Get daily summary
export async function fetchDailySummary(
  startDate: string,
  endDate: string,
): Promise<ReportSummary> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/reports/summary/daily?startDate=${startDate}&endDate=${endDate}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch daily summary');
  }
  const data = await res.json();
  return data;
}

// Get monthly summary
export async function fetchMonthlySummary(
  startDate: string,
  endDate: string,
): Promise<ReportSummary> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/reports/summary/monthly?startDate=${startDate}&endDate=${endDate}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch monthly summary');
  }
  const data = await res.json();
  return data;
}

// Get yearly summary
export async function fetchYearlySummary(
  startDate: string,
  endDate: string,
): Promise<ReportSummary> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/reports/summary/yearly?startDate=${startDate}&endDate=${endDate}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch yearly summary');
  }
  const data = await res.json();
  return data;
}

// Create new report
export async function createNewReport(
  report: Omit<
    Report,
    | 'id'
    | 'userId'
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'generatedAt'
    | 'filePath'
  >,
): Promise<Report> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(report),
  });
  if (!res.ok) {
    throw new Error('Failed to create report');
  }
  const data = await res.json();
  return data;
}

// Get all reports with pagination
export async function fetchAllReports(
  page: number = 1,
  limit: number = 10,
): Promise<ReportResponse> {
  const token = await AsyncStorage.getItem('accessToken');
  const url = `${BASE_URL}/reports?page=${page}&limit=${limit}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch reports');
  }
  const data = await res.json();
  return data;
}
