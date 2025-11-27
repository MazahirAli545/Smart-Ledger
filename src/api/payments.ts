import { BASE_URL, DYNAMIC_BASE_URL } from './index';
import { getBaseUrl } from '../config/network';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Payment API endpoints
export const PAYMENT_ENDPOINTS = {
  CREATE_ORDER: '/payments/create-order',
  VERIFY_PAYMENT: '/payments/verify-payment',
  COMPLETE_PAYMENT: '/payments/complete-payment',
  CAPTURE_PAYMENT: '/payments/capture',
  GET_PAYMENTS: '/payments/my-payments',
  GET_PAYMENT_STATUS: '/payments/status',
  GET_PAYMENT_BY_ORDER: '/payments/order',
};

// Payment status types
export enum PaymentStatus {
  PENDING = 'pending',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Payment method types
export enum PaymentMethod {
  CARD = 'card',
  NETBANKING = 'netbanking',
  UPI = 'upi',
  WALLET = 'wallet',
  EMI = 'emi',
}

// DTOs matching backend structure
export interface CreateOrderDto {
  userId: number;
  planId: number;
  amount: number;
  currency: string;
  receipt: string;
  notes?: string;
  contact?: string;
  name?: string;
}

export interface VerifyPaymentDto {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  userId: number;
  planId: number;
}

export interface CompletePaymentDto {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface CapturePaymentDto {
  // Core payment data
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  amount: number;
  currency: string;
  planId: number;
  userId: number;

  // 🎯 ADDED: Alternative field names for backend compatibility
  paymentId?: string;
  order_id?: string;

  // Payment method details
  method?: string;
  bank?: string;
  wallet?: string;

  // 🎯 ADDED: Proper object structures for payment details
  card_details?: {
    card_id?: string;
    card_network?: string;
    card_type?: string;
    card_last4?: string;
    card_issuer?: string;
  };

  upi_details?: {
    upi_transaction_id?: string;
    upi_vpa?: string;
  };

  // Individual fields for backward compatibility
  card_id?: string;
  card_network?: string;
  card_type?: string;
  card_last4?: string;
  card_issuer?: string;
  upi_transaction_id?: string;
  upi_vpa?: string;

  // Financial details
  fee?: number;
  tax?: number;
  international?: boolean;
  amount_in_paisa?: number;
  base_amount?: number;
  base_currency?: string;

  // User details
  contact?: string;
  name?: string;
  email?: string;

  // Status and metadata
  status?: string;
  captured?: boolean;
  description?: string;
  notes?: string;

  // Complete Razorpay response
  razorpay_response?: string;

  // 🎯 ADDED: JSON_LOG structure for backend processing
  JSON_LOG?: {
    razorpay_signature?: string;
    payment_id?: string;
    order_id?: string;
    card_details?: any;
    upi_details?: any;
    full_response?: any;
  };

  // Additional fields
  entity?: string;
  invoice_id?: string;
  recurring?: boolean;
  recurring_token?: string;
  recurring_status?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  code?: number;
  status?: string;
  error?: any;
}

export interface PaymentRecord {
  id: number;
  userId: number;
  planId: number;
  razorpayPaymentId?: string;
  razorpayOrderId: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
  method?: string;
  status: string;
  captured: boolean;
  description?: string;
  notes?: string;
  contact?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  payment: PaymentRecord;
}

// Payment API Service
export class PaymentApiService {
  /**
   * Get authentication headers
   */
  private static async getAuthHeaders() {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      throw new Error('Authentication token not found');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Create Razorpay order
   */
  static async createOrder(
    orderData: CreateOrderDto,
  ): Promise<ApiResponse<OrderResponse>> {
    try {
      console.log('🔄 Creating Razorpay order:', orderData);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();
      console.log('🌐 Using base URL:', baseUrl);

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.CREATE_ORDER}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(orderData),
        },
      );

      const result = await response.json();
      console.log('📥 Create order response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create order');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Create order error:', error);

      // If local backend fails, try production as fallback
      if (
        error.message?.includes('fetch') ||
        error.message?.includes('network')
      ) {
        console.log('🔄 Network error detected, trying production backend...');
        try {
          const productionUrl = 'http://10.0.2.2:3001';
          const headers = await this.getAuthHeaders();
          const response = await fetch(
            `${productionUrl}${PAYMENT_ENDPOINTS.CREATE_ORDER}`,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(orderData),
            },
          );

          const result = await response.json();
          console.log('📥 Production backend response:', result);

          if (!response.ok) {
            throw new Error(
              result.message || 'Failed to create order on production',
            );
          }

          return result;
        } catch (productionError: any) {
          console.error('❌ Production backend also failed:', productionError);
          throw new Error(
            `Both local and production backends failed: ${error.message}`,
          );
        }
      }

      throw new Error(error.message || 'Failed to create order');
    }
  }

  /**
   * Verify payment signature
   */
  static async verifyPayment(
    verifyData: VerifyPaymentDto,
  ): Promise<ApiResponse> {
    try {
      console.log('🔍 Verifying payment:', verifyData);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.VERIFY_PAYMENT}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(verifyData),
        },
      );

      const result = await response.json();
      console.log('📥 Verify payment response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to verify payment');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Verify payment error:', error);
      throw new Error(error.message || 'Failed to verify payment');
    }
  }

  /**
   * Complete payment process
   */
  static async completePayment(
    completeData: CompletePaymentDto,
  ): Promise<ApiResponse> {
    try {
      console.log('✅ Completing payment:', completeData);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.COMPLETE_PAYMENT}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(completeData),
        },
      );

      const result = await response.json();
      console.log('📥 Complete payment response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to complete payment');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Complete payment error:', error);
      throw new Error(error.message || 'Failed to complete payment');
    }
  }

  /**
   * Capture payment (direct payment capture)
   */
  static async capturePayment(
    captureData: CapturePaymentDto,
  ): Promise<ApiResponse> {
    try {
      console.log('🎯 Capturing payment:', captureData);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();
      // Extra diagnostics to verify correct target and payload integrity
      console.log('🌐 Capture base URL:', baseUrl);
      console.log('🔎 Capture payload check:', {
        hasPaymentId:
          !!captureData.razorpay_payment_id || !!captureData.paymentId,
        hasOrderId: !!captureData.razorpay_order_id || !!captureData.order_id,
        hasSignature:
          !!captureData.razorpay_signature ||
          !!captureData.JSON_LOG?.razorpay_signature,
        planId: captureData.planId,
        userId: captureData.userId,
        amount: captureData.amount,
        method: captureData.method,
      });

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.CAPTURE_PAYMENT}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(captureData),
        },
      );

      const result = await response.json().catch(() => null);
      console.log('📥 Capture payment response:', result);

      if (!response.ok) {
        const fallback = {
          success: false,
          message:
            result?.message ||
            `Capture endpoint unavailable (${response.status})`,
        };
        console.warn('⚠️ Capture payment non-200 response:', fallback);
        return fallback;
      }

      return result;
    } catch (error: any) {
      const message = error?.message?.includes('Cannot POST')
        ? 'Capture endpoint not available in this environment'
        : error?.message || 'Failed to capture payment';
      console.warn('⚠️ Capture payment error:', message);
      return {
        success: false,
        message,
        error,
      };
    }
  }

  /**
   * Get user's payment history
   */
  static async getMyPayments(): Promise<ApiResponse<PaymentRecord[]>> {
    try {
      console.log('📋 Fetching payment history');

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENTS}`,
        {
          method: 'GET',
          headers,
        },
      );

      const result = await response.json();
      console.log('📥 Get payments response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch payments');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Get payments error:', error);
      throw new Error(error.message || 'Failed to fetch payments');
    }
  }

  /**
   * Get payment status by order ID
   * 🎯 FIXED: Uses /payments/order/{orderId} endpoint which actually exists
   * Falls back to /payments/status/{orderId} if needed
   */
  static async getPaymentStatus(orderId: string): Promise<ApiResponse> {
    try {
      console.log('🔍 Checking payment status for order:', orderId);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();

      // 🎯 CRITICAL FIX: Try /payments/order/{orderId} first (this endpoint exists)
      // The /payments/status/{orderId} endpoint doesn't exist on backend
      let response: Response;
      let result: any;

      try {
        // Try the correct endpoint: /payments/order/{orderId}
        console.log(
          `🔄 Trying endpoint: ${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENT_BY_ORDER}/${orderId}`,
        );
        response = await fetch(
          `${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENT_BY_ORDER}/${orderId}`,
          {
            method: 'GET',
            headers,
          },
        );

        result = await response.json();
        console.log(
          '📥 Payment status response (from /payments/order):',
          result,
        );

        if (response.ok) {
          return result;
        }

        // If 404 or endpoint doesn't exist, try alternative endpoint
        if (response.status === 404) {
          console.log(
            '⚠️ /payments/order endpoint returned 404, trying /payments/status...',
          );
          throw new Error('Endpoint not found, trying fallback');
        }
      } catch (firstError: any) {
        // Fallback: Try /payments/status/{orderId} if /payments/order fails
        console.log('🔄 Fallback: Trying /payments/status endpoint...');
        try {
          response = await fetch(
            `${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENT_STATUS}/${orderId}`,
            {
              method: 'GET',
              headers,
            },
          );

          result = await response.json();
          console.log(
            '📥 Payment status response (from /payments/status):',
            result,
          );

          if (!response.ok) {
            throw new Error(result.message || 'Failed to get payment status');
          }

          return result;
        } catch (fallbackError: any) {
          // If both endpoints fail, try querying all payments and filtering
          console.log(
            '🔄 Both endpoints failed, trying to get payment from /payments list...',
          );
          try {
            const allPaymentsResponse = await fetch(
              `${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENTS}?razorpayOrderId=${orderId}`,
              {
                method: 'GET',
                headers,
              },
            );

            if (allPaymentsResponse.ok) {
              const allPaymentsResult = await allPaymentsResponse.json();
              const paymentsData =
                allPaymentsResult?.data || allPaymentsResult || [];
              const paymentsArray = Array.isArray(paymentsData)
                ? paymentsData
                : paymentsData?.data || [];

              // Find payment with matching orderId
              const matchingPayment = paymentsArray.find(
                (p: any) =>
                  p.razorpayOrderId === orderId ||
                  p.razorpay_order_id === orderId ||
                  p.orderId === orderId,
              );

              if (matchingPayment) {
                console.log(
                  '✅ Found payment in payments list:',
                  matchingPayment,
                );
                return {
                  success: true,
                  data: matchingPayment,
                  message: 'Payment found',
                };
              }
            }
          } catch (listError) {
            console.warn('⚠️ Failed to get payment from list:', listError);
          }

          // If all methods fail, throw the original error
          throw new Error(
            `Failed to get payment status: ${
              firstError.message ||
              fallbackError.message ||
              'All endpoints failed'
            }`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to get payment status');
      }

      return result;
    } catch (error: any) {
      // 🎯 CRITICAL FIX: Use console.warn instead of console.error to prevent error handlers from showing toasts
      // This is expected during polling - payment might not be ready yet
      console.warn(
        '⚠️ Get payment status attempt failed (this is normal during polling):',
        error.message || error,
      );
      // Don't throw error - return a failure response instead so polling can continue
      return {
        success: false,
        message: error.message || 'Failed to get payment status',
        data: null,
      };
    }
  }

  /**
   * Get payment by order ID
   */
  static async getPaymentByOrder(
    orderId: string,
  ): Promise<ApiResponse<PaymentRecord>> {
    try {
      console.log('🔍 Getting payment for order:', orderId);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}${PAYMENT_ENDPOINTS.GET_PAYMENT_BY_ORDER}/${orderId}`,
        {
          method: 'GET',
          headers,
        },
      );

      const result = await response.json();
      console.log('📥 Get payment by order response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to get payment');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Get payment by order error:', error);
      throw new Error(error.message || 'Failed to get payment');
    }
  }

  /**
   * Retry payment verification
   */
  static async retryVerification(orderId: string): Promise<ApiResponse> {
    try {
      console.log('🔄 Retrying payment verification for order:', orderId);

      // Get the best available base URL
      const baseUrl = await getBaseUrl();

      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${baseUrl}/payments/retry-verification/${orderId}`,
        {
          method: 'POST',
          headers,
        },
      );

      const result = await response.json();
      console.log('📥 Retry verification response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to retry verification');
      }

      return result;
    } catch (error: any) {
      console.error('❌ Retry verification error:', error);
      throw new Error(error.message || 'Failed to retry verification');
    }
  }

  /**
   * Check if payment was successful
   */
  static isPaymentSuccessful(response: ApiResponse): boolean {
    return (
      response.success === true ||
      response.code === 200 ||
      response.status === '200' ||
      response.status === 'success' ||
      (response.data &&
        response.data.payment &&
        response.data.payment.status === 'captured') ||
      (response.data && response.data.status === 'captured')
    );
  }

  /**
   * Extract payment ID from response
   */
  static extractPaymentId(response: ApiResponse): string | null {
    if (response.data?.payment?.razorpayPaymentId) {
      return response.data.payment.razorpayPaymentId;
    }
    if (response.data?.razorpay_payment_id) {
      return response.data.razorpay_payment_id;
    }
    if (response.data?.paymentId) {
      return response.data.paymentId;
    }
    return null;
  }

  /**
   * Extract order ID from response
   */
  static extractOrderId(response: ApiResponse): string | null {
    if (response.data?.orderId) {
      return response.data.orderId;
    }
    if (response.data?.payment?.razorpayOrderId) {
      return response.data.payment.razorpayOrderId;
    }
    if (response.data?.razorpay_order_id) {
      return response.data.razorpay_order_id;
    }
    return null;
  }
}

export default PaymentApiService;
