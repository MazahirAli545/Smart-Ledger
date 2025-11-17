/**
 * Unified API Service - Centralized API calls with caching, deduplication, and error handling
 *
 * This service consolidates all API calls from screens into one place for:
 * - Better performance (caching, deduplication)
 * - Consistent error handling
 * - Easier maintenance
 * - Request cancellation support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './index';
import { getUserIdFromToken } from '../utils/storage';

// ========================================
// TYPES & INTERFACES
// ========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: boolean;
  cacheTTL?: number; // Time to live in milliseconds
  skipAuth?: boolean;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

// Custom error class that includes HTTP status code
export class ApiError extends Error {
  status: number;
  originalError?: any;

  constructor(message: string, status: number, originalError?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.originalError = originalError;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// ========================================
// CACHE SERVICE
// ========================================

class ApiCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 30 * 1000; // 30 seconds default

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getCacheTimestamp(key: string): number | null {
    const entry = this.cache.get(key);
    return entry ? entry.timestamp : null;
  }
}

// ========================================
// REQUEST DEDUPLICATION SERVICE
// ========================================

class RequestDeduplicationService {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // If request already in progress, return that promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const request = fetcher()
      .then(data => {
        this.pendingRequests.delete(key);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, request);
    return request;
  }

  cancel(key: string): void {
    this.pendingRequests.delete(key);
  }

  cancelAll(): void {
    this.pendingRequests.clear();
  }
}

// ========================================
// UNIFIED API SERVICE
// ========================================

class UnifiedApiService {
  private cache = new ApiCacheService();
  private deduplicator = new RequestDeduplicationService();

  /**
   * Get authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('accessToken');
  }

  /**
   * Build cache key from URL and options
   */
  private buildCacheKey(url: string, options?: RequestOptions): string {
    const method = options?.method || 'GET';
    const bodyKey = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${bodyKey}`;
  }

  /**
   * Create timeout promise for fetch requests
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Retry request with exponential backoff
   */
  private async retryRequest<T>(
    fetcher: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetcher();
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx) except 408 (timeout)
        if (
          error.status &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `🔄 Retrying request (attempt ${
            attempt + 1
          }/${maxRetries}) after ${delay}ms...`,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Make API request with caching, deduplication, timeout, retry, and error handling
   */
  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      signal,
      cache = true,
      cacheTTL,
      skipAuth = false,
    } = options;

    // Build full URL
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${BASE_URL}${endpoint}`;
    const cacheKey = this.buildCacheKey(url, options);

    // Check cache for GET requests
    if (method === 'GET' && cache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        return {
          data: cached,
          status: 200,
          headers: new Headers(),
        };
      }
    }

    // Get auth token
    let authToken: string | null = null;
    if (!skipAuth) {
      authToken = await this.getAuthToken();
      if (!authToken) {
        throw new Error('Authentication token not found');
      }
    }

    // Determine timeout based on method and endpoint
    // GET requests: 15s (longer for data fetching)
    // POST/PUT/PATCH: 20s (longer for complex operations)
    // DELETE: 10s (usually quick)
    const getTimeout = () => {
      if (method === 'GET') return 15000; // 15 seconds
      if (method === 'DELETE') return 10000; // 10 seconds
      return 20000; // 20 seconds for POST/PUT/PATCH
    };

    const timeoutMs = getTimeout();

    // Build request options with keep-alive headers
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Connection: 'keep-alive', // Enable HTTP keep-alive
        'Keep-Alive': 'timeout=60, max=1000', // Keep connection alive
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...headers,
      },
      ...(signal && { signal }),
      ...(body && { body: JSON.stringify(body) }),
    };

    // Make request with deduplication, timeout, and retry
    // 🎯 SAFETY: Only retry GET requests to prevent duplicate POST/PUT/DELETE operations
    const response = await this.deduplicator.deduplicate(cacheKey, async () => {
      const makeRequest = async () => {
        // Race between fetch and timeout
        const fetchPromise = fetch(url, requestOptions);
        const timeoutPromise = this.createTimeoutPromise(timeoutMs);

        const res = await Promise.race([fetchPromise, timeoutPromise]);

        if (!res.ok) {
          let errorMessage = `Request failed with status ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status text
            errorMessage = res.statusText || errorMessage;
          }

          // Handle specific status codes with custom error class
          if (res.status === 401) {
            throw new ApiError(
              'Authentication failed - Please login again',
              401,
            );
          } else if (res.status === 403) {
            // For 403, include more helpful message from backend if available
            const backendMessage = errorMessage.includes('Request failed')
              ? 'Access forbidden - Please check your permissions'
              : errorMessage;
            throw new ApiError(backendMessage, 403);
          } else if (res.status === 408 || res.status === 504) {
            // Timeout errors - retry these
            throw new ApiError(
              'Request timeout - Please try again',
              res.status,
            );
          } else if (res.status >= 500) {
            // Server errors - retry these
            throw new ApiError(
              'Server error - Please try again later',
              res.status,
            );
          }

          throw new ApiError(errorMessage, res.status);
        }

        const data = await res.json();

        // Cache GET requests with longer TTL for stable data
        if (method === 'GET' && cache) {
          // Use provided TTL or default based on endpoint type
          const effectiveTTL = cacheTTL || this.getDefaultCacheTTL(endpoint);
          this.cache.set(cacheKey, data, effectiveTTL);
        }

        return {
          data,
          status: res.status,
          headers: res.headers,
        };
      };

      // Only retry GET requests to prevent duplicate operations
      if (method === 'GET') {
        return this.retryRequest(makeRequest);
      } else {
        // POST/PUT/PATCH/DELETE: Single attempt only (no retry to prevent duplicates)
        return makeRequest();
      }
    });

    return response;
  }

  /**
   * Get default cache TTL based on endpoint type
   */
  private getDefaultCacheTTL(endpoint: string): number {
    // User profile, subscription data - cache longer (5 minutes)
    if (
      endpoint.includes('/users/profile') ||
      endpoint.includes('/subscriptions/current')
    ) {
      return 5 * 60 * 1000; // 5 minutes
    }

    // Customer/Supplier lists - cache longer (2 minutes)
    if (endpoint.includes('/customers') || endpoint.includes('/suppliers')) {
      return 2 * 60 * 1000; // 2 minutes
    }

    // Transactions - cache shorter (1 minute)
    if (endpoint.includes('/transactions')) {
      return 60 * 1000; // 1 minute
    }

    // Menus/folders - cache longer (3 minutes)
    if (endpoint.includes('/menus')) {
      return 3 * 60 * 1000; // 3 minutes
    }

    // Default: 30 seconds
    return 30 * 1000;
  }

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const response = await this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const response = await this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body,
    });
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const response = await this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const response = await this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body,
    });
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {},
  ): Promise<T> {
    const response = await this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
    return response.data;
  }

  /**
   * Invalidate cache
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.invalidate(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateCachePattern(pattern: string): void {
    this.cache.invalidatePattern(pattern);
  }

  /**
   * Cancel pending request
   */
  cancelRequest(key: string): void {
    this.deduplicator.cancel(key);
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    this.deduplicator.cancelAll();
  }
}

// ========================================
// SPECIFIC API METHODS
// ========================================

class AppApiService extends UnifiedApiService {
  // ========================================
  // AUTHENTICATION
  // ========================================

  async sendOtp(phone: string) {
    return this.post('/auth/send-otp', { phone }, { skipAuth: true });
  }

  async verifyOtp(phone: string, otp: string) {
    return this.post('/auth/verify-otp', { phone, otp }, { skipAuth: true });
  }

  async getSmsStatus() {
    return this.get('/auth/sms-status', { skipAuth: true });
  }

  // ========================================
  // USER PROFILE
  // ========================================

  async getUserProfile() {
    return this.get('/users/profile');
  }

  async updateUserProfile(data: any) {
    const userId = await getUserIdFromToken();
    if (!userId) throw new Error('User ID not found');

    const result = await this.patch(`/users/${userId}`, data);
    // Invalidate profile cache
    this.invalidateCachePattern('.*/users/profile.*');
    return result;
  }

  // ========================================
  // CUSTOMERS
  // ========================================

  async getCustomers(query: string = '', page: number = 1, limit: number = 50) {
    const params = new URLSearchParams();
    if (query) params.append('search', query);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    return this.get(`/customers/customers-only?${params.toString()}`, {
      cacheTTL: 30 * 1000, // 30 seconds
    });
  }

  async getCustomerById(id: number) {
    return this.get(`/customers/${id}`, {
      cacheTTL: 30 * 1000,
    });
  }

  async createCustomer(data: any) {
    const result = await this.post('/customers', data);
    // Invalidate customers cache
    this.invalidateCachePattern('.*/customers.*');
    return result;
  }

  async updateCustomer(id: number, data: any) {
    const result = await this.patch(`/customers/${id}`, data);
    // Invalidate customers cache
    this.invalidateCachePattern('.*/customers.*');
    return result;
  }

  async deleteCustomer(id: number) {
    const result = await this.delete(`/customers/${id}`);
    // Invalidate customers cache
    this.invalidateCachePattern('.*/customers.*');
    return result;
  }

  // ========================================
  // SUPPLIERS
  // ========================================

  async getSuppliers(query: string = '') {
    const params = query ? `?search=${encodeURIComponent(query)}` : '';
    return this.get(`/customers/suppliers${params}`, {
      cacheTTL: 30 * 1000,
    });
  }

  async getSupplierById(id: number) {
    return this.get(`/customers/suppliers/${id}`, {
      cacheTTL: 30 * 1000,
    });
  }

  async createSupplier(data: any) {
    const result = await this.post('/customers/suppliers', data);
    // Invalidate suppliers cache
    this.invalidateCachePattern('.*/customers/suppliers.*');
    return result;
  }

  async updateSupplier(id: number, data: any) {
    const result = await this.patch(`/customers/suppliers/${id}`, data);
    // Invalidate suppliers cache
    this.invalidateCachePattern('.*/customers/suppliers.*');
    return result;
  }

  async deleteSupplier(id: number) {
    const result = await this.delete(`/customers/suppliers/${id}`);
    // Invalidate suppliers cache
    this.invalidateCachePattern('.*/customers/suppliers.*');
    return result;
  }

  // ========================================
  // TRANSACTIONS
  // ========================================

  async getTransactions(
    filters: {
      type?: string;
      page?: number;
      limit?: number;
      customerId?: number;
      startDate?: string;
      endDate?: string;
      category?: string;
      hasItems?: boolean;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.customerId)
      params.append('customerId', filters.customerId.toString());
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.category) params.append('category', filters.category);
    if (filters.hasItems !== undefined)
      params.append('hasItems', filters.hasItems.toString());

    return this.get(`/transactions?${params.toString()}`, {
      cacheTTL: 30 * 1000,
    });
  }

  async getTransactionById(id: number) {
    return this.get(`/transactions/${id}`, {
      cacheTTL: 30 * 1000,
    });
  }

  async getTransactionsByCustomer(customerId: number, filters: any = {}) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) {
        params.append(key, String(filters[key]));
      }
    });

    return this.get(
      `/transactions/customer/${customerId}?${params.toString()}`,
      {
        cacheTTL: 30 * 1000,
      },
    );
  }

  async createTransaction(data: any) {
    const result = await this.post('/transactions', data);
    // Invalidate transactions cache
    this.invalidateCachePattern('.*/transactions.*');
    return result;
  }

  async updateTransaction(id: number, data: any) {
    // Backend uses PUT, not PATCH for transaction updates
    const result = await this.put(`/transactions/${id}`, data);
    // Invalidate transactions cache
    this.invalidateCachePattern('.*/transactions.*');
    return result;
  }

  async deleteTransaction(id: number) {
    const result = await this.delete(`/transactions/${id}`);
    // Invalidate transactions cache
    this.invalidateCachePattern('.*/transactions.*');
    return result;
  }

  // ========================================
  // PURCHASES (Debit transactions with items)
  // ========================================

  async getPurchases(page: number = 1, limit: number = 20) {
    return this.getTransactions({
      type: 'debit',
      hasItems: true,
      page,
      limit,
    });
  }

  // ========================================
  // INVOICES (Credit transactions with items)
  // ========================================

  async getInvoices(page: number = 1, limit: number = 20) {
    return this.getTransactions({
      type: 'credit',
      hasItems: true,
      page,
      limit,
    });
  }

  // ========================================
  // PAYMENTS (Debit transactions without items)
  // ========================================

  async getPayments(page: number = 1, limit: number = 20) {
    return this.getTransactions({
      type: 'debit',
      hasItems: false,
      page,
      limit,
    });
  }

  // ========================================
  // RECEIPTS (Credit transactions without items)
  // ========================================

  async getReceipts(page: number = 1, limit: number = 20) {
    return this.getTransactions({
      type: 'credit',
      hasItems: false,
      page,
      limit,
    });
  }

  // ========================================
  // DASHBOARD
  // ========================================

  async getDashboardData() {
    // Fetch all dashboard data in parallel
    const [userData, folders, vouchers] = await Promise.all([
      this.getUserProfile(),
      this.get<any>('/menus', { cacheTTL: 60 * 1000 }),
      this.get<any>('/vouchers', { cacheTTL: 30 * 1000 }),
    ]);

    return {
      userData,
      folders: Array.isArray(folders) ? folders : (folders as any)?.data || [],
      vouchers: Array.isArray(vouchers)
        ? vouchers
        : (vouchers as any)?.data || [],
    };
  }

  // ========================================
  // ITEMS
  // ========================================

  async getItemNames(
    search: string = '',
    page: number = 1,
    limit: number = 10,
  ) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);

    return this.get(`/items/names?${params.toString()}`, {
      cacheTTL: 60 * 1000, // 1 minute for item names
    });
  }

  async upsertItemNames(names: string[]) {
    return this.post('/items/names', { names });
  }

  // ========================================
  // REPORTS
  // ========================================

  async getReports(page: number = 1, limit: number = 10) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    return this.get(`/reports?${params.toString()}`);
  }

  async getCustomerLedger(
    customerId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.get(
      `/reports/customer-ledger/${customerId}?${params.toString()}`,
    );
  }

  async getSupplierLedger(
    supplierId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.get(
      `/reports/supplier-ledger/${supplierId}?${params.toString()}`,
    );
  }

  // ========================================
  // SUBSCRIPTION & LIMITS
  // ========================================

  async getTransactionLimits(userId?: number) {
    const params = new URLSearchParams();
    if (userId) {
      params.append('userId', userId.toString());
      params.append('user_id', userId.toString());
    }

    return this.get(`/transactions/limits?${params.toString()}`, {
      cacheTTL: 60 * 1000, // 1 minute
    });
  }

  async getSubscriptionPlans() {
    return this.get('/subscriptions/plans', {
      cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
  }

  // ========================================
  // FOLDERS/MENUS
  // ========================================

  async getFolders() {
    return this.get('/menus', {
      cacheTTL: 60 * 1000,
    });
  }

  async createFolder(data: any) {
    const result = await this.post('/menus', data);
    this.invalidateCachePattern('.*/menus.*');
    return result;
  }

  async updateFolder(id: number, data: any) {
    const result = await this.patch(`/menus/${id}`, data);
    this.invalidateCachePattern('.*/menus.*');
    return result;
  }

  async deleteFolder(id: number) {
    const result = await this.delete(`/menus/${id}`);
    this.invalidateCachePattern('.*/menus.*');
    return result;
  }
}

// ========================================
// EXPORT SINGLETON INSTANCE
// ========================================

export const unifiedApi = new AppApiService();
export default unifiedApi;

// Export types
export type { RequestOptions, ApiResponse };
