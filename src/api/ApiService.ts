// src/api/ApiService.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  // Customer APIs
  fetchCustomers,
  fetchCustomersOnly,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  Customer,

  // Transaction APIs
  fetchTransactions,
  fetchTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchTransactionsByCustomer,
  exportTransactionsCSV,
  exportTransactionsPDF,
  deleteTransactionById,
  fetchTransactionsByCustomerId,
  Transaction,
  TransactionFilters,
  TransactionResponse,

  // Report APIs
  createReport,
  fetchReports,
  fetchReportById,
  generateReport,
  exportReportCSV,
  exportReportPDF,
  deleteReport,
  fetchCustomerLedger,
  fetchSupplierLedger,
  fetchDailySummary,
  fetchMonthlySummary,
  fetchYearlySummary,
  createNewReport,
  fetchAllReports,
  Report,
  ReportFilters,
  ReportResponse,
  ReportSummary,
  CustomerLedger,

  // RBAC APIs
  checkRole,
  checkPermission,
  fetchUserRoles,
  fetchUserPermissions,
  fetchAllRoles,
  fetchAllPermissions,
  RoleCheckResponse,
  PermissionCheckResponse,
  Role,
  Permission,
} from './index';

/**
 * Comprehensive API Service Class
 * Provides easy access to all Khatabook Ledger API endpoints
 */
export class ApiService {
  private static instance: ApiService;
  private baseUrl: string = BASE_URL;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // ========================================
  // AUTHENTICATION APIs
  // ========================================

  async sendOtp(phone: string) {
    const response = await fetch(`${this.baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!response.ok) throw new Error('Failed to send OTP');
    return response.json();
  }

  async verifyOtp(phone: string, otp: string) {
    const response = await fetch(`${this.baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!response.ok) throw new Error('Failed to verify OTP');
    return response.json();
  }

  async getSmsStatus() {
    const response = await fetch(`${this.baseUrl}/auth/sms-status`);
    if (!response.ok) throw new Error('Failed to get SMS status');
    return response.json();
  }

  // ========================================
  // USER APIs
  // ========================================

  async getUserProfile() {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to get user profile');
    return response.json();
  }

  async updateUserProfile(payload: {
    businessName?: string;
    ownerName?: string;
    businessType?: string;
    gstNumber?: string;
    businessSize?: string;
    industry?: string;
    monthlyTransactionVolume?: string;
    currentAccountingSoftware?: string;
    teamSize?: string;
    preferredLanguage?: string;
    features?: string[];
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    CAAccountID?: string;
    primaryGoal?: string;
    currentChallenges?: string;
  }) {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to update user profile');
    return response.json();
  }

  // ========================================
  // CUSTOMER APIs
  // ========================================

  async getCustomers(query?: string): Promise<Customer[]> {
    return fetchCustomers(query);
  }

  async getCustomersOnly(
    query?: string,
    page?: number,
    limit?: number,
  ): Promise<{ data: Customer[]; total: number; page: number; limit: number }> {
    return fetchCustomersOnly(query || '', page || 1, limit || 10);
  }

  async getSuppliers(query?: string): Promise<Customer[]> {
    const token = await AsyncStorage.getItem('accessToken');
    const url = `${this.baseUrl}/customers/suppliers${
      query ? `?search=${encodeURIComponent(query)}` : ''
    }`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch suppliers');
    return response.json();
  }

  // ========================================
  // ITEM NAME SUGGESTIONS
  // ========================================
  async getItemNames(
    search?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: string[]; total: number; page: number; limit: number }> {
    const token = await AsyncStorage.getItem('accessToken');
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.append('search', search);
    const response = await fetch(
      `${this.baseUrl}/items/names?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error('Failed to fetch item names');
    return response.json();
  }

  async createCustomer(
    customer: Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Customer> {
    return addCustomer(customer);
  }

  async updateCustomer(
    id: number,
    customer: Partial<Customer>,
  ): Promise<Customer> {
    return updateCustomer(id, customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    return deleteCustomer(id);
  }

  async getCustomerById(id: number): Promise<Customer> {
    const token = await AsyncStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/customers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch customer');
    return response.json();
  }

  // ========================================
  // TRANSACTION APIs
  // ========================================

  async getTransactions(
    filters?: TransactionFilters,
  ): Promise<TransactionResponse> {
    return fetchTransactions(filters);
  }

  async getTransactionById(id: number): Promise<Transaction> {
    return fetchTransactionById(id);
  }

  async createTransaction(
    transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ): Promise<Transaction> {
    return createTransaction(transaction);
  }

  async updateTransaction(
    id: number,
    transaction: Partial<Transaction>,
  ): Promise<Transaction> {
    return updateTransaction(id, transaction);
  }

  async deleteTransaction(id: number): Promise<void> {
    return deleteTransaction(id);
  }

  async getTransactionsByCustomer(
    customerId: number,
    filters?: Omit<TransactionFilters, 'customerId'>,
  ): Promise<TransactionResponse> {
    return fetchTransactionsByCustomer(customerId, filters);
  }

  async exportTransactionsCSV(filters?: TransactionFilters): Promise<Blob> {
    return exportTransactionsCSV(filters);
  }

  async exportTransactionsPDF(filters?: TransactionFilters): Promise<Blob> {
    return exportTransactionsPDF(filters);
  }

  async deleteTransactionById(id: number): Promise<void> {
    return deleteTransactionById(id);
  }

  async getTransactionsByCustomerId(
    customerId: number,
    filters?: Omit<TransactionFilters, 'customerId'>,
  ): Promise<TransactionResponse> {
    return fetchTransactionsByCustomerId(customerId, filters);
  }

  // ========================================
  // REPORT APIs
  // ========================================

  async createReport(
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
    return createReport(report);
  }

  async getReports(
    page: number = 1,
    limit: number = 10,
  ): Promise<ReportResponse> {
    return fetchReports(page, limit);
  }

  async getReportById(id: number): Promise<Report> {
    return fetchReportById(id);
  }

  async generateReport(id: number): Promise<Report> {
    return generateReport(id);
  }

  async exportReportCSV(id: number): Promise<Blob> {
    return exportReportCSV(id);
  }

  async exportReportPDF(id: number): Promise<Blob> {
    return exportReportPDF(id);
  }

  async deleteReport(id: number): Promise<void> {
    return deleteReport(id);
  }

  async getCustomerLedger(
    customerId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<CustomerLedger> {
    return fetchCustomerLedger(customerId, startDate, endDate);
  }

  async getSupplierLedger(
    supplierId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<CustomerLedger> {
    return fetchSupplierLedger(supplierId, startDate, endDate);
  }

  async getDailySummary(
    startDate: string,
    endDate: string,
  ): Promise<ReportSummary> {
    return fetchDailySummary(startDate, endDate);
  }

  async getMonthlySummary(
    startDate: string,
    endDate: string,
  ): Promise<ReportSummary> {
    return fetchMonthlySummary(startDate, endDate);
  }

  async getYearlySummary(
    startDate: string,
    endDate: string,
  ): Promise<ReportSummary> {
    return fetchYearlySummary(startDate, endDate);
  }

  // Additional Report APIs
  async createNewReport(
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
    return createNewReport(report);
  }

  async getAllReports(
    page: number = 1,
    limit: number = 10,
  ): Promise<ReportResponse> {
    return fetchAllReports(page, limit);
  }

  async generateReportById(id: number): Promise<Report> {
    return generateReport(id);
  }

  async deleteReportById(id: number): Promise<void> {
    return deleteReport(id);
  }

  async getCustomerLedgerById(
    customerId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<CustomerLedger> {
    return fetchCustomerLedger(customerId, startDate, endDate);
  }

  async getSupplierLedgerById(
    supplierId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<CustomerLedger> {
    return fetchSupplierLedger(supplierId, startDate, endDate);
  }

  // ========================================
  // RBAC APIs
  // ========================================

  async checkUserRole(role: string): Promise<RoleCheckResponse> {
    return checkRole(role);
  }

  async checkUserPermission(
    permission: string,
  ): Promise<PermissionCheckResponse> {
    return checkPermission(permission);
  }

  async getUserRoles(): Promise<Role[]> {
    return fetchUserRoles();
  }

  async getUserPermissions(): Promise<Permission[]> {
    return fetchUserPermissions();
  }

  async getAllRoles(): Promise<Role[]> {
    return fetchAllRoles();
  }

  async getAllPermissions(): Promise<Permission[]> {
    return fetchAllPermissions();
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return false;

      // Test token validity by making a simple API call
      await this.getUserProfile();
      return true;
    } catch {
      return false;
    }
  }

  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem('accessToken');
  }

  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem('accessToken', token);
  }

  async clearAuthToken(): Promise<void> {
    await AsyncStorage.removeItem('accessToken');
  }
}

// Export singleton instance
export const apiService = ApiService.getInstance();
export default apiService;
