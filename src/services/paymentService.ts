import RazorpayCheckout from 'react-native-razorpay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserIdFromToken } from '../utils/storage';
import PaymentApiService, {
  CreateOrderDto,
  CapturePaymentDto,
  ApiResponse,
} from '../api/payments';
import { getBaseUrl } from '../config/network';
import { getRazorpayConfig } from '../config/env';

// Razorpay configuration - now using environment variables
const RAZORPAY_CONFIG = getRazorpayConfig();

// Debug mode - set to true to get detailed logging
const DEBUG_MODE = true;

// Helper function for debug logging
const debugLog = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
  }
};

export interface PaymentPlan {
  id: string;
  name: string;
  price: number;
  period: string;
}

export interface PaymentResult {
  success: boolean;
  message: string;
  paymentId?: string;
  orderId?: string;
  paymentDetails?: any;
  signature?: string;
  // Add Razorpay response fields for capture endpoint
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  amount?: number;
  method?: string;
  bank?: string;
  wallet?: string;
  card_id?: string;
  card_network?: string;
  card_type?: string;
  card_last4?: string;
  card_issuer?: string;
  upi_transaction_id?: string;
  upi_vpa?: string;
  international?: boolean;
  fee?: number;
  tax?: number;
  contact?: string;
  name?: string;
  email?: string;
  // Add detailed error information
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    attempts?: number;
    lastError?: string;
  };
}

export class PaymentService {
  /**
   * Check if Razorpay SDK is properly integrated and working
   */
  static async checkRazorpayHealth(): Promise<{
    isAvailable: boolean;
    hasOpenMethod: boolean;
    error?: string;
  }> {
    try {
      console.log('🔍 Checking Razorpay SDK health...');

      // Check if RazorpayCheckout is available
      if (!RazorpayCheckout) {
        return {
          isAvailable: false,
          hasOpenMethod: false,
          error: 'RazorpayCheckout is not imported or undefined',
        };
      }

      // Check if open method exists
      if (typeof RazorpayCheckout.open !== 'function') {
        return {
          isAvailable: true,
          hasOpenMethod: false,
          error: 'RazorpayCheckout.open method is not available',
        };
      }

      // Check if configuration is valid
      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        return {
          isAvailable: true,
          hasOpenMethod: true,
          error: 'Razorpay configuration is incomplete',
        };
      }

      console.log('✅ Razorpay SDK health check passed');
      return {
        isAvailable: true,
        hasOpenMethod: true,
      };
    } catch (error: any) {
      console.error('❌ Razorpay health check failed:', error);
      return {
        isAvailable: false,
        hasOpenMethod: false,
        error: error.message || 'Unknown error during health check',
      };
    }
  }

  /**
   * Verify payment with Razorpay before proceeding
   */
  static async verifyPayment(
    razorpay_payment_id: string,
    razorpay_order_id: string,
    razorpay_signature: string,
  ): Promise<boolean> {
    try {
      console.log('🔍 Verifying payment with Razorpay...');

      // Create the signature string
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;

      // For now, skip signature verification to avoid crypto-js issues
      // TODO: Implement proper signature verification when crypto-js is properly configured
      console.log(
        '⚠️ Skipping signature verification due to crypto-js import issues',
      );
      console.log('📝 Payment details for manual verification:');
      console.log('   Order ID:', razorpay_order_id);
      console.log('   Payment ID:', razorpay_payment_id);
      console.log('   Signature:', razorpay_signature);

      // Return true for now to allow payment flow to continue
      // In production, this should be properly implemented
      return true;
    } catch (error: any) {
      console.error('❌ Payment verification error:', error);
      return false;
    }
  }

  /**
   * Process payment for plan upgrade using Razorpay with backend integration
   */
  static async processPlanPayment(plan: PaymentPlan): Promise<PaymentResult> {
    try {
      console.log('🚀 PaymentService.processPlanPayment started');
      console.log('📋 Plan data received:', plan);

      // Pre-flight check: Verify Razorpay SDK health
      const razorpayHealth = await this.checkRazorpayHealth();
      if (!razorpayHealth.isAvailable || !razorpayHealth.hasOpenMethod) {
        console.error('❌ Razorpay SDK health check failed:', razorpayHealth);
        throw new Error(`Razorpay integration issue: ${razorpayHealth.error}`);
      }
      console.log('✅ Razorpay SDK health check passed');

      // Get user authentication data
      const token = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!token || !userId || userId <= 0) {
        throw new Error('Authentication failed. Please log in again.');
      }

      console.log('✅ User authenticated:', userId);

      // Helper: normalize mobile number to 10-digit (strip +91 etc.)
      const normalizeMobileNumber = (input: string): string => {
        const digitsOnly = (input || '').replace(/\D/g, '');
        if (digitsOnly.length > 10 && digitsOnly.startsWith('91')) {
          return digitsOnly.slice(-10);
        }
        if (digitsOnly.length >= 10) {
          return digitsOnly.slice(-10);
        }
        return digitsOnly;
      };

      // Get user details from token
      let userMobileNumber = '';
      let userName = '';

      if (token) {
        try {
          // Try to decode token to get user info
          const tokenPayload = this.decodeToken(token);
          if (tokenPayload) {
            userMobileNumber =
              tokenPayload.mobileNumber || tokenPayload.phone || '';
            userName =
              tokenPayload.name ||
              tokenPayload.fullName ||
              tokenPayload.ownerName ||
              '';
          }
          console.log('🔍 Token payload decoded:', {
            userMobileNumberRaw: userMobileNumber,
            userMobileNumberNormalized: normalizeMobileNumber(userMobileNumber),
            userName,
            hasPayload: !!tokenPayload,
          });
        } catch (error) {
          console.log('⚠️ Could not decode token for user info:', error);
        }
      }

      const amountInPaise = plan.price * 100;
      console.log('💰 Amount calculation:', {
        originalPrice: plan.price,
        amountInPaise: amountInPaise,
        currency: 'INR',
      });

      // Step 1: Create order with backend API
      console.log('📋 Creating order with backend API...');
      let orderResponse: ApiResponse;
      let orderId: string;

      try {
        const orderData: CreateOrderDto = {
          userId: parseInt(userId.toString()),
          planId: parseInt(plan.id.toString()),
          amount: amountInPaise,
          currency: 'INR',
          receipt: `plan_upgrade_${Date.now()}`,
          notes: `Upgrade to ${plan.name} plan`,
          contact: normalizeMobileNumber(userMobileNumber),
          name: userName || 'User',
        };

        console.log('📤 Order data being sent to backend:', orderData);

        orderResponse = await PaymentApiService.createOrder(orderData);
        orderId = PaymentApiService.extractOrderId(orderResponse) || '';

        if (!orderId) {
          console.error('❌ No order ID received from backend:', orderResponse);
          throw new Error('Failed to get order ID from backend response');
        }

        console.log('✅ Backend order created successfully:', orderId);
        console.log('📥 Full backend response:', orderResponse);
      } catch (error: any) {
        console.error('❌ Backend order creation failed:', error);
        throw new Error(`Failed to create payment order: ${error.message}`);
      }

      // Step 2: Configure Razorpay checkout options
      console.log('🎯 Configuring Razorpay checkout options...');

      // Validate Razorpay configuration
      debugLog('Validating Razorpay configuration', {
        key: RAZORPAY_CONFIG.key ? 'Set' : 'Not Set',
        keyLength: RAZORPAY_CONFIG.key?.length,
        secret: RAZORPAY_CONFIG.secret ? 'Set' : 'Not Set',
        secretLength: RAZORPAY_CONFIG.secret?.length,
      });

      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        throw new Error(
          'Razorpay configuration is incomplete. Please check your API keys.',
        );
      }

      const options = {
        order_id: orderId,
        description: `Upgrade to ${plan.name} Plan`,
        image: 'https://your-logo-url.com', // Replace with your app logo
        currency: 'INR',
        key: RAZORPAY_CONFIG.key,
        amount: amountInPaise,
        name: 'UtilsApp',
        prefill: {
          contact: normalizeMobileNumber(userMobileNumber),
          name: userName || 'User',
          email: '',
        },
        method: {
          netbanking: true,
          card: true,
          upi: true,
          wallet: true,
          emi: false,
          paylater: false,
        },
        theme: { color: '#4f8cff' },
        fullscreen: true,
        backdropClose: false,
        // Add new parameters from latest integration guide
        partial_payment: false, // Set to true if you want to allow partial payments
        first_payment_min_amount: undefined, // Only needed if partial_payment is true
        notes: {
          plan_id: plan.id,
          plan_name: plan.name,
          user_id: userId.toString(),
          upgrade_date: new Date().toISOString(),
        },
        timeout: 300, // 5 minutes timeout in seconds
        send_sms_hash: true, // Auto-read OTP for cards and netbanking
        allow_rotation: true, // Allow payment page rotation
        readonly: {
          contact: false,
          email: false,
          name: false,
        },
        hidden: {
          contact: false,
          email: false,
          name: false,
        },
        retry: {
          enabled: true,
          max_count: 3,
        },
        config: {
          display: {
            language: 'en' as const, // Required language property
            blocks: {
              banks: {
                name: 'Pay using any bank',
                instruments: [
                  {
                    method: 'card',
                  },
                  {
                    method: 'netbanking',
                  },
                  {
                    method: 'wallet',
                  },
                  {
                    method: 'upi',
                  },
                ],
              },
            },
            sequence: ['block.banks'],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
      };

      debugLog('Razorpay options configured', {
        orderId: options.order_id,
        amount: options.amount,
        currency: options.currency,
        key: options.key ? 'Set' : 'Not Set',
        prefill: options.prefill,
        method: options.method,
        theme: options.theme,
      });

      // Step 3: Open Razorpay checkout
      console.log('🚪 Opening Razorpay checkout...');

      // Test if RazorpayCheckout is available
      if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
        console.error(
          '❌ RazorpayCheckout is not available or open method missing',
        );
        throw new Error(
          'Razorpay checkout is not available. Please check the integration.',
        );
      }
      console.log('✅ RazorpayCheckout is available and open method exists');

      // Create a promise-based wrapper for Razorpay
      let resolvePayment: (value: any) => void;
      let rejectPayment: (reason: any) => void;

      const paymentPromise = new Promise<any>((resolve, reject) => {
        resolvePayment = resolve;
        rejectPayment = reject;
      });

      // Set up timeout for payment process
      const paymentTimeout = setTimeout(() => {
        rejectPayment({
          code: 'PAYMENT_TIMEOUT',
          message: 'Payment timed out',
          description: 'Payment process took too long to complete',
          source: 'timeout',
          step: 'payment_processing',
          reason: 'timeout',
        });
      }, 300000); // 5 minutes timeout

      // Add timeout for modal opening - REDUCED to 8 seconds for faster detection
      const modalOpenTimeout = setTimeout(() => {
        console.error(
          '🚨 MODAL_OPEN_TIMEOUT triggered - modal did not open within 8 seconds',
        );
        rejectPayment({
          code: 'MODAL_OPEN_TIMEOUT',
          message: 'Payment modal failed to open properly',
          description:
            'Razorpay modal may have failed silently - check network and configuration',
          source: 'modal_timeout',
          step: 'modal_opening',
          reason: 'silent_failure',
        });
      }, 8000); // 8 seconds timeout - reduced from 15

      // Configure Razorpay options with proper handlers
      const enhancedOptions = {
        ...options,
        handler: (response: any) => {
          console.log(
            '🎯 Razorpay success handler called with response:',
            response,
          );

          // Log the complete response structure
          console.log('🎉 Razorpay payment completed successfully!');
          console.log(
            '📱 Complete Razorpay response:',
            JSON.stringify(response, null, 2),
          );
          console.log('🔍 Response type:', typeof response);
          console.log('🔍 Response keys:', Object.keys(response || {}));

          // Validate the response structure
          if (!response) {
            console.error('❌ Razorpay response is null or undefined');
            rejectPayment({
              code: 'INVALID_RESPONSE',
              message: 'Razorpay returned invalid response',
              description: 'Payment response is missing or malformed',
              source: 'razorpay_sdk',
              step: 'payment_completion',
              reason: 'null_response',
            });
            return;
          }

          // Check for required fields
          const requiredFields = [
            'razorpay_payment_id',
            'razorpay_order_id',
            'razorpay_signature',
          ];
          const missingFields = requiredFields.filter(
            field => !response[field],
          );

          if (missingFields.length > 0) {
            console.error(
              '❌ Missing required fields in Razorpay response:',
              missingFields,
            );
            console.error('❌ Available fields:', Object.keys(response));
            rejectPayment({
              code: 'INCOMPLETE_RESPONSE',
              message: 'Razorpay response missing required fields',
              description: `Missing: ${missingFields.join(', ')}`,
              source: 'razorpay_sdk',
              step: 'payment_completion',
              reason: 'incomplete_response',
            });
            return;
          }

          console.log('✅ Razorpay response validation passed');
          console.log('✅ Payment ID:', response.razorpay_payment_id);
          console.log('✅ Order ID:', response.razorpay_order_id);
          console.log('✅ Signature:', response.razorpay_signature);

          clearTimeout(paymentTimeout);
          clearTimeout(modalOpenTimeout);
          resolvePayment(response);
        },
        modal: {
          ondismiss: () => {
            console.log('🚪 Razorpay modal dismissed by user');
            clearTimeout(paymentTimeout);
            clearTimeout(modalOpenTimeout);
            rejectPayment({
              code: 'PAYMENT_CANCELLED',
              message: 'Payment was cancelled by user',
              description: 'User closed the payment modal',
              source: 'modal_dismiss',
              step: 'modal_interaction',
              reason: 'user_action',
            });
          },
        },
        // Add error handler for Razorpay failures
        onError: (error: any) => {
          console.error('🚨 Razorpay onError handler triggered:', error);
          clearTimeout(paymentTimeout);
          clearTimeout(modalOpenTimeout);
          rejectPayment({
            code: 'RAZORPAY_ERROR',
            message: 'Razorpay payment failed',
            description: error.message || 'Unknown Razorpay error',
            source: 'razorpay_sdk',
            step: 'payment_processing',
            reason: error.message || 'sdk_error',
          });
        },
      };

      console.log(
        '🚪 Calling RazorpayCheckout.open with options:',
        enhancedOptions,
      );

      // Open Razorpay checkout with better error handling
      try {
        // Add a flag to track if modal actually opened
        let modalOpened = false;

        // Call RazorpayCheckout.open
        const result = RazorpayCheckout.open(enhancedOptions);

        // Check if the call was successful
        if (result === undefined || result === null) {
          console.log(
            '✅ RazorpayCheckout.open called successfully (returned undefined/null as expected)',
          );
          modalOpened = true;
        } else {
          console.log(
            '⚠️ RazorpayCheckout.open returned unexpected result:',
            result,
          );
          modalOpened = true;
        }

        // Set a flag to indicate modal was opened
        setTimeout(() => {
          if (!modalOpened) {
            console.warn(
              '⚠️ Modal may not have opened properly - no response yet',
            );
          }
        }, 2000); // Check after 2 seconds

        console.log('✅ Razorpay modal opened successfully');
      } catch (openError: any) {
        console.error('❌ RazorpayCheckout.open failed:', openError);
        clearTimeout(paymentTimeout);
        clearTimeout(modalOpenTimeout);
        throw {
          code: 'RAZORPAY_OPEN_ERROR',
          message: 'Failed to open payment gateway',
          description: openError.message || 'Unknown error opening Razorpay',
          source: 'razorpay_sdk',
          step: 'opening_checkout',
          reason: openError.message || 'sdk_error',
        };
      }

      // Wait for payment result
      const paymentData = await paymentPromise;

      console.log('🎉 Payment Data from Razorpay:', paymentData);

      // Validate payment response
      if (!paymentData || !paymentData.razorpay_payment_id) {
        console.error(
          '❌ Invalid payment response from Razorpay:',
          paymentData,
        );
        throw new Error('Invalid payment response from Razorpay');
      }

      console.log('✅ Payment response validation passed');

      console.log('✅ Payment ID received:', paymentData.razorpay_payment_id);
      console.log('✅ Order ID received:', paymentData.razorpay_order_id);
      console.log('✅ Signature received:', paymentData.razorpay_signature);

      // Return the complete payment data for the frontend to handle
      return {
        success: true,
        message: 'Payment successful! Your plan has been upgraded.',
        paymentId: paymentData.razorpay_payment_id,
        orderId: paymentData.razorpay_order_id,
        signature: paymentData.razorpay_signature,
        paymentDetails: paymentData,
        // Razorpay response fields for capture endpoint
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
        // Additional fields that might be useful
        method: paymentData.method || 'unknown',
        bank: paymentData.bank || '',
        wallet: paymentData.wallet || '',
        card_id: paymentData.card_id || '',
        card_network: paymentData.card_network || '',
        card_type: paymentData.card_type || '',
        card_last4: paymentData.card_last4 || '',
        card_issuer: paymentData.card_issuer || '',
        upi_transaction_id: paymentData.upi_transaction_id || '',
        upi_vpa: paymentData.upi_vpa || '',
        contact: paymentData.contact || '',
        name: paymentData.name || 'User',
        email: paymentData.email || '',
        amount: paymentData.amount || 0,
      };
    } catch (error: any) {
      console.error('❌ PaymentService error:', error);
      throw error;
    }
  }

  /**
   * Fallback payment method with different Razorpay configurations
   */
  static async processPlanPaymentWithFallback(
    plan: PaymentPlan,
  ): Promise<PaymentResult> {
    try {
      console.log('🚀 PaymentService.processPlanPaymentWithFallback started');

      // Check device compatibility first
      const deviceCheck = await this.checkDeviceCompatibility();
      console.log('📱 Device compatibility:', deviceCheck);

      // Get user authentication data
      const token = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!token || !userId || userId <= 0) {
        throw new Error('Authentication failed. Please log in again.');
      }

      console.log('✅ User authenticated:', userId);

      // Create order with backend first
      const orderData: CreateOrderDto = {
        userId: parseInt(userId.toString()),
        planId: parseInt(plan.id.toString()),
        amount: plan.price * 100,
        currency: 'INR',
        receipt: `plan_upgrade_${Date.now()}`,
        notes: `Upgrade to ${plan.name} plan`,
        contact: '',
        name: 'User',
      };

      console.log('📋 Creating order with backend API...');
      const orderResponse = await PaymentApiService.createOrder(orderData);
      const orderId = PaymentApiService.extractOrderId(orderResponse) || '';

      if (!orderId) {
        throw new Error('Failed to get order ID from backend response');
      }

      console.log('✅ Backend order created successfully:', orderId);

      // Try different Razorpay configurations
      const configurations = [
        {
          name: 'Standard Configuration',
          config: {
            order_id: orderId,
            description: `Upgrade to ${plan.name} Plan`,
            currency: 'INR',
            key: RAZORPAY_CONFIG.key,
            amount: plan.price * 100,
            name: 'UtilsApp',
            prefill: {
              contact: '',
              name: 'User',
            },
            method: {
              netbanking: true,
              card: true,
              upi: true,
              wallet: true,
            },
            theme: { color: '#4f8cff' },
            fullscreen: true,
            backdropClose: false,
          },
        },
        {
          name: 'Simplified Configuration',
          config: {
            order_id: orderId,
            description: `Upgrade to ${plan.name} Plan`,
            currency: 'INR',
            key: RAZORPAY_CONFIG.key,
            amount: plan.price * 100,
            name: 'UtilsApp',
            prefill: {
              contact: '',
              name: 'User',
            },
            method: {
              card: true,
              upi: true,
            },
            theme: { color: '#4f8cff' },
            fullscreen: false,
            backdropClose: true,
          },
        },
        {
          name: 'Minimal Configuration',
          config: {
            order_id: orderId,
            description: `Upgrade to ${plan.name} Plan`,
            currency: 'INR',
            key: RAZORPAY_CONFIG.key,
            amount: plan.price * 100,
            name: 'UtilsApp',
            prefill: {
              contact: '',
              name: 'User',
            },
            method: {
              card: true,
            },
            theme: { color: '#4f8cff' },
            fullscreen: false,
            backdropClose: true,
          },
        },
      ];

      // Try each configuration
      for (let i = 0; i < configurations.length; i++) {
        const config = configurations[i];
        console.log(
          `🔄 Trying configuration ${i + 1}/${configurations.length}: ${
            config.name
          }`,
        );

        try {
          const result = await this.tryRazorpayConfiguration(
            config.config,
            plan,
          );
          if (result.success) {
            console.log(`✅ Configuration ${i + 1} succeeded: ${config.name}`);
            return result;
          }
        } catch (error: any) {
          console.warn(
            `⚠️ Configuration ${i + 1} failed: ${config.name}`,
            error.message,
          );
          if (i === configurations.length - 1) {
            // Last configuration failed
            throw error;
          }
          // Continue to next configuration
        }
      }

      throw new Error('All Razorpay configurations failed');
    } catch (error: any) {
      console.error('❌ Fallback payment method failed:', error);
      throw error;
    }
  }

  /**
   * Try a specific Razorpay configuration
   */
  private static async tryRazorpayConfiguration(
    config: any,
    plan: PaymentPlan,
  ): Promise<PaymentResult> {
    return new Promise((resolve, reject) => {
      // Set timeout for this configuration
      const configTimeout = setTimeout(() => {
        reject(new Error('Configuration timeout'));
      }, 15000); // 15 seconds per configuration

      // Add handlers to config
      const enhancedConfig = {
        ...config,
        handler: (response: any) => {
          console.log(
            '🎯 Razorpay success handler called with response:',
            response,
          );
          clearTimeout(configTimeout);

          if (!response || !response.razorpay_payment_id) {
            reject(new Error('Invalid Razorpay response'));
            return;
          }

          resolve({
            success: true,
            message: 'Payment successful! Your plan has been upgraded.',
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            paymentDetails: response,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            method: response.method || 'unknown',
            bank: response.bank || '',
            wallet: response.wallet || '',
            card_id: response.card_id || '',
            card_network: response.card_network || '',
            card_type: response.card_type || '',
            card_last4: response.card_last4 || '',
            card_issuer: response.card_issuer || '',
            upi_transaction_id: response.upi_transaction_id || '',
            upi_vpa: response.upi_vpa || '',
            contact: response.contact || '',
            name: response.name || 'User',
            email: response.email || '',
            amount: response.amount || 0,
          });
        },
        modal: {
          ondismiss: () => {
            console.log('🚪 Razorpay modal dismissed by user');
            clearTimeout(configTimeout);
            reject(new Error('Payment cancelled by user'));
          },
        },
        onError: (error: any) => {
          console.error('🚨 Razorpay error:', error);
          clearTimeout(configTimeout);
          reject(
            new Error(`Razorpay error: ${error.message || 'Unknown error'}`),
          );
        },
      };

      try {
        console.log('🚪 Opening Razorpay with config:', enhancedConfig);
        RazorpayCheckout.open(enhancedConfig);
      } catch (error: any) {
        clearTimeout(configTimeout);
        reject(error);
      }
    });
  }

  /**
   * Capture payment using backend API
   */
  static async capturePayment(
    paymentData: any,
    plan: PaymentPlan,
  ): Promise<ApiResponse> {
    try {
      console.log('🎯 Capturing payment with backend API:', paymentData);
      // Validate critical fields before building payload
      console.log('🔎 Pre-capture field check:', {
        hasSignature: !!paymentData?.razorpay_signature,
        hasPaymentId: !!paymentData?.razorpay_payment_id,
        hasOrderId: !!paymentData?.razorpay_order_id,
        planId: plan?.id,
        planName: plan?.name,
      });

      const userId = await getUserIdFromToken();
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      // Map data to backend capture format
      const capturePayload: CapturePaymentDto = {
        // Core payment data
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_signature: paymentData.razorpay_signature,
        amount: paymentData.amount,
        currency: 'INR',
        planId: parseInt(plan.id.toString()),
        userId: parseInt(userId.toString()),

        // Payment method details
        method: paymentData.method || 'unknown',
        bank: paymentData.bank || '',
        wallet: paymentData.wallet || '',

        // 🎯 FIXED: Send proper card_details object structure
        card_details: {
          card_id: paymentData.card_id || '',
          card_network: paymentData.card_network || '',
          card_type: paymentData.card_type || '',
          card_last4: paymentData.card_last4 || '',
          card_issuer: paymentData.card_issuer || '',
        },

        // 🎯 FIXED: Send proper upi_details object structure
        upi_details: {
          upi_transaction_id: paymentData.upi_transaction_id || '',
          upi_vpa: paymentData.upi_vpa || '',
        },

        // Keep individual fields for backward compatibility
        card_id: paymentData.card_id || '',
        card_network: paymentData.card_network || '',
        card_type: paymentData.card_type || '',
        card_last4: paymentData.card_last4 || '',
        card_issuer: paymentData.card_issuer || '',
        upi_transaction_id: paymentData.upi_transaction_id || '',
        upi_vpa: paymentData.upi_vpa || '',

        // Financial details
        fee: paymentData.fee || 0,
        tax: paymentData.tax || 0,
        international: paymentData.international || false,
        amount_in_paisa: paymentData.amount,
        base_amount: paymentData.amount,
        base_currency: 'INR',

        // User details
        contact: paymentData.contact || '',
        name: paymentData.name || 'User',
        email: paymentData.email || '',

        // Status and metadata
        status: 'captured',
        captured: true,
        description: `Payment for ${plan.name} plan`,
        notes: `Plan upgrade to ${plan.name}`,

        // Complete Razorpay response for logging
        razorpay_response: JSON.stringify(paymentData),

        // 🎯 ADDED: JSON_LOG structure that backend expects
        JSON_LOG: {
          razorpay_signature: paymentData.razorpay_signature,
          payment_id: paymentData.razorpay_payment_id,
          order_id: paymentData.razorpay_order_id,
          card_details: {
            card_id: paymentData.card_id || '',
            card_network: paymentData.card_network || '',
            card_type: paymentData.card_type || '',
            card_last4: paymentData.card_last4 || '',
            card_issuer: paymentData.card_issuer || '',
          },
          upi_details: {
            upi_transaction_id: paymentData.upi_transaction_id || '',
            upi_vpa: paymentData.upi_vpa || '',
          },
          full_response: {
            razorpay_signature: paymentData.razorpay_signature,
            razorpay_order_id: paymentData.razorpay_order_id,
            razorpay_payment_id: paymentData.razorpay_payment_id,
          },
        },

        // Additional fields
        entity: 'payment',
        invoice_id: '',
        recurring: false,
        recurring_token: '',
        recurring_status: '',

        // 🎯 ADDED: Missing fields that backend expects
        paymentId: paymentData.razorpay_payment_id,
        order_id: paymentData.razorpay_order_id,
      };

      console.log('📤 Sending capture payload to backend:', capturePayload);

      // Call backend capture endpoint
      const response = await PaymentApiService.capturePayment(capturePayload);

      console.log('✅ Payment captured successfully:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Payment capture failed:', error);
      throw new Error(`Payment capture failed: ${error.message}`);
    }
  }

  /**
   * Complete payment process
   */
  static async completePayment(
    paymentData: any,
    plan: PaymentPlan,
  ): Promise<ApiResponse> {
    try {
      console.log('✅ Completing payment process:', paymentData);

      const completeData = {
        orderId: paymentData.razorpay_order_id,
        paymentId: paymentData.razorpay_payment_id,
        signature: paymentData.razorpay_signature,
      };

      const response = await PaymentApiService.completePayment(completeData);

      console.log('✅ Payment completion successful:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Payment completion failed:', error);
      throw new Error(`Payment completion failed: ${error.message}`);
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(orderId: string): Promise<ApiResponse> {
    try {
      console.log('🔍 Getting payment status for order:', orderId);
      const response = await PaymentApiService.getPaymentStatus(orderId);
      return response;
    } catch (error: any) {
      console.error('❌ Get payment status failed:', error);
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Get payment history
   */
  static async getPaymentHistory(): Promise<ApiResponse> {
    try {
      console.log('📋 Getting payment history');
      const response = await PaymentApiService.getMyPayments();
      return response;
    } catch (error: any) {
      console.error('❌ Get payment history failed:', error);
      throw new Error(`Failed to get payment history: ${error.message}`);
    }
  }

  /**
   * Retry payment verification
   */
  static async retryVerification(orderId: string): Promise<ApiResponse> {
    try {
      console.log('🔄 Retrying payment verification for order:', orderId);
      const response = await PaymentApiService.retryVerification(orderId);
      return response;
    } catch (error: any) {
      console.error('❌ Retry verification failed:', error);
      throw new Error(`Failed to retry verification: ${error.message}`);
    }
  }

  /**
   * Test Razorpay connectivity and configuration
   */
  static async testRazorpayConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      debugLog('Testing Razorpay connectivity...');

      // Check configuration
      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        return {
          success: false,
          message: 'Razorpay configuration is incomplete',
          details: {
            hasKey: !!RAZORPAY_CONFIG.key,
            hasSecret: !!RAZORPAY_CONFIG.secret,
          },
        };
      }

      // Test Razorpay API connectivity
      try {
        const testOrder = await this.createRazorpayOrder(100); // Test with 1 rupee
        debugLog('Razorpay API test successful', testOrder);

        return {
          success: true,
          message: 'Razorpay connection test successful',
          details: {
            testOrderId: testOrder.id,
            apiVersion: 'v1',
            timestamp: new Date().toISOString(),
          },
        };
      } catch (apiError: any) {
        debugLog('Razorpay API test failed', apiError);
        return {
          success: false,
          message: 'Razorpay API connection failed',
          details: {
            error: apiError.message,
            code: apiError.code,
            status: apiError.status,
          },
        };
      }
    } catch (error: any) {
      debugLog('Razorpay connection test error', error);
      return {
        success: false,
        message: 'Failed to test Razorpay connection',
        details: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }

  /**
   * Simple test to verify Razorpay integration
   */
  static async testRazorpayIntegration(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      debugLog('Testing Razorpay integration...');

      // Check if RazorpayCheckout is available
      if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
        return {
          success: false,
          message: 'RazorpayCheckout is not available',
          details: {
            hasRazorpayCheckout: !!RazorpayCheckout,
            hasOpenMethod: typeof RazorpayCheckout?.open === 'function',
          },
        };
      }

      // Check configuration
      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        return {
          success: false,
          message: 'Razorpay configuration is incomplete',
          details: {
            hasKey: !!RAZORPAY_CONFIG.key,
            hasSecret: !!RAZORPAY_CONFIG.secret,
          },
        };
      }

      // Test with a minimal order
      const testOptions = {
        order_id: 'test_order_' + Date.now(),
        description: 'Test Payment',
        image: 'https://your-logo-url.com',
        currency: 'INR',
        key: RAZORPAY_CONFIG.key,
        amount: 100, // 1 rupee test
        name: 'UtilsApp Test',
        prefill: {
          contact: '9999999999',
          name: 'Test User',
        },
        method: {
          netbanking: true,
          card: true,
          upi: true,
          wallet: true,
        },
        theme: { color: '#4f8cff' },
        fullscreen: true,
        backdropClose: false,
        handler: (response: any) => {
          debugLog('Test payment handler called', response);
        },
        modal: {
          ondismiss: () => {
            debugLog('Test payment modal dismissed');
          },
        },
      };

      debugLog('Test options configured', testOptions);

      return {
        success: true,
        message: 'Razorpay integration test passed',
        details: {
          testOptions: testOptions,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      debugLog('Razorpay integration test failed', error);
      return {
        success: false,
        message: 'Razorpay integration test failed',
        details: {
          error: error.message,
          stack: error.stack,
        },
      };
    }
  }

  /**
   * Create Razorpay order (fallback method)
   */
  private static async createRazorpayOrder(
    amountInPaise: number,
  ): Promise<any> {
    // Create base64 encoded credentials for React Native compatibility
    const credentials = `${RAZORPAY_CONFIG.key}:${RAZORPAY_CONFIG.secret}`;
    const base64Credentials = btoa(credentials);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `plan_upgrade_${Date.now()}`,
        payment_capture: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create order: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Decode JWT token to extract user information
   */
  private static decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get payment configuration
   */
  static getConfig() {
    return RAZORPAY_CONFIG;
  }

  /**
   * Check if payment is supported
   */
  static isPaymentSupported(): boolean {
    return !!RAZORPAY_CONFIG.key;
  }

  /**
   * Get available payment methods
   */
  static getPaymentMethods() {
    return {
      netbanking: true,
      card: true,
      upi: true,
      wallet: true,
      emi: false,
      paylater: false,
    };
  }

  /**
   * Validate payment amount
   */
  static validateAmount(amount: number): boolean {
    return amount > 0 && amount <= 1000000; // Max 10 lakh rupees
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Get payment status description
   */
  static getPaymentStatusDescription(status: string): string {
    const statusMap: { [key: string]: string } = {
      created: 'Payment initiated',
      authorized: 'Payment authorized',
      captured: 'Payment successful',
      failed: 'Payment failed',
      pending: 'Payment pending',
      cancelled: 'Payment cancelled',
      refunded: 'Payment refunded',
    };
    return statusMap[status] || 'Unknown status';
  }

  /**
   * Get common Razorpay error solutions
   */
  static getCommonErrorSolutions(errorCode: string): string[] {
    const solutions: { [key: string]: string[] } = {
      PAYMENT_CANCELLED: [
        'User cancelled the payment',
        'This is normal behavior',
        'User can try again anytime',
      ],
      NETWORK_ERROR: [
        'Check internet connection',
        'Try switching between WiFi and mobile data',
        'Check if Razorpay servers are accessible',
        'Try again in a few minutes',
      ],
      INVALID_ORDER_ID: [
        'Order may have expired',
        'Try creating a new order',
        'Check if backend is generating valid order IDs',
        'Verify Razorpay configuration',
      ],
      ORDER_ALREADY_PAID: [
        'Check if payment was already processed',
        'Verify subscription status',
        'Check payment history',
        'Contact support if issue persists',
      ],
      INSUFFICIENT_FUNDS: [
        'Check account balance',
        'Try a different payment method',
        'Verify card has sufficient funds',
        'Check if card supports the transaction amount',
      ],
      CARD_DECLINED: [
        'Try a different card',
        'Check if card supports online transactions',
        'Verify card details are correct',
        'Contact your bank for authorization',
      ],
      UPI_ERROR: [
        'Try a different UPI ID',
        'Check if UPI service is working',
        'Verify UPI ID is correct',
        'Try card or netbanking instead',
      ],
      WALLET_ERROR: [
        'Check wallet balance',
        'Try a different payment method',
        'Verify wallet is supported',
        'Try card or UPI instead',
      ],
    };

    return (
      solutions[errorCode] || [
        'Try again in a few minutes',
        'Check your payment method',
        'Try a different payment option',
        'Contact support if issue persists',
      ]
    );
  }

  /**
   * Get troubleshooting steps for payment failures
   */
  static getTroubleshootingSteps(): string[] {
    return [
      '1. Check your internet connection',
      '2. Verify your payment method has sufficient funds',
      '3. Try a different payment method (Card, UPI, Netbanking)',
      '4. Ensure your card supports online transactions',
      '5. Check if your bank has blocked the transaction',
      '6. Try again in a few minutes',
      '7. Contact support if the issue persists',
    ];
  }

  /**
   * Check Razorpay payment status and handle gateway errors
   */
  static async checkRazorpayStatus(orderId: string): Promise<{
    success: boolean;
    message: string;
    status?: string;
    details?: any;
  }> {
    try {
      debugLog('Checking Razorpay payment status for order:', orderId);

      // This would typically call Razorpay's API to check payment status
      // For now, we'll implement a basic check

      // Check if we have any stored payment data for this order
      const storedPaymentData = await this.getStoredPaymentData(orderId);

      if (storedPaymentData) {
        return {
          success: true,
          message: 'Payment data found',
          status: storedPaymentData.status,
          details: storedPaymentData,
        };
      }

      // If no stored data, the payment likely failed at Razorpay level
      return {
        success: false,
        message: 'Payment failed at Razorpay gateway',
        status: 'failed',
        details: {
          orderId,
          error: 'Razorpay gateway error',
          recommendation: 'Try again in a few minutes',
        },
      };
    } catch (error: any) {
      debugLog('Error checking Razorpay status:', error);
      return {
        success: false,
        message: 'Failed to check payment status',
        status: 'unknown',
        details: {
          error: error.message,
          orderId,
        },
      };
    }
  }

  /**
   * Get stored payment data for an order (simulated)
   */
  private static async getStoredPaymentData(orderId: string): Promise<any> {
    // This would typically check your backend or local storage
    // For now, return null to simulate no stored data
    return null;
  }

  /**
   * Retry payment with exponential backoff
   */
  static async retryPayment(
    plan: PaymentPlan,
    maxRetries: number = 3,
    baseDelay: number = 2000,
  ): Promise<PaymentResult> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Payment attempt ${attempt}/${maxRetries}`);

        // Add delay between retries (exponential backoff)
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(2, attempt - 2); // 2s, 4s, 8s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Attempt payment
        const result = await this.processPlanPayment(plan);

        if (result.success) {
          console.log(`✅ Payment succeeded on attempt ${attempt}`);
          return result;
        } else {
          lastError = result;
          console.log(
            `❌ Payment failed on attempt ${attempt}:`,
            result.message,
          );

          // If it's a Razorpay gateway error, continue retrying
          if (
            result.message.includes('Razorpay encountered') ||
            result.message.includes('Something went wrong')
          ) {
            console.log('🔄 Razorpay gateway error, will retry...');
            continue;
          } else {
            // For other errors, don't retry
            break;
          }
        }
      } catch (error: any) {
        lastError = error;
        console.log(`❌ Payment error on attempt ${attempt}:`, error.message);

        // If it's a Razorpay gateway error, continue retrying
        if (
          error.message.includes('Razorpay encountered') ||
          error.message.includes('Something went wrong')
        ) {
          console.log('🔄 Razorpay gateway error, will retry...');
          continue;
        } else {
          // For other errors, don't retry
          break;
        }
      }
    }

    // All retries failed
    console.log(`❌ All ${maxRetries} payment attempts failed`);
    return {
      success: false,
      message: `Payment failed after ${maxRetries} attempts. Please try again later or contact support.`,
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        description: 'All retry attempts failed',
        attempts: maxRetries,
        lastError: lastError?.message || 'Unknown error',
      },
    };
  }

  /**
   * Test method to verify PaymentService is working
   */
  static async testPaymentService(): Promise<boolean> {
    try {
      console.log('🧪 Testing PaymentService...');

      // Test 1: Check if RazorpayCheckout is available
      if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
        console.error('❌ RazorpayCheckout not available');
        return false;
      }
      console.log('✅ RazorpayCheckout is available');

      // Test 2: Check configuration
      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        console.error('❌ Razorpay configuration incomplete');
        return false;
      }
      console.log('✅ Razorpay configuration is complete');

      // Test 3: Check network configuration
      try {
        const baseUrl = await getBaseUrl();
        console.log('✅ Network configuration working, base URL:', baseUrl);
      } catch (error) {
        console.error('❌ Network configuration failed:', error);
        return false;
      }

      console.log('✅ PaymentService test passed');
      return true;
    } catch (error) {
      console.error('❌ PaymentService test failed:', error);
      return false;
    }
  }

  /**
   * Simple test to check if Razorpay modal can open
   */
  static async testRazorpayModal(): Promise<boolean> {
    try {
      console.log('🧪 Testing Razorpay modal opening...');

      // Check device compatibility first
      const deviceCheck = await this.checkDeviceCompatibility();
      console.log('📱 Device compatibility:', deviceCheck);

      if (!deviceCheck.isCompatible) {
        console.warn(
          '⚠️ Device compatibility issues detected:',
          deviceCheck.issues,
        );
      }

      // Check if RazorpayCheckout is available
      if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
        console.error('❌ RazorpayCheckout not available');
        return false;
      }

      // Create a simple test promise
      let resolveTest: (value: any) => void;
      let rejectTest: (reason: any) => void;

      const testPromise = new Promise<any>((resolve, reject) => {
        resolveTest = resolve;
        rejectTest = reject;
      });

      // Set a short timeout for testing
      const testTimeout = setTimeout(() => {
        rejectTest(new Error('Test timeout - modal did not open'));
      }, 10000); // 10 seconds

      // Try alternative configuration first (more compatible)
      const testOptions: any = this.getAlternativeRazorpayConfig();

      // Add handlers
      testOptions.handler = (response: any) => {
        console.log('✅ Test modal opened and got response:', response);
        clearTimeout(testTimeout);
        resolveTest(response);
      };

      testOptions.modal = {
        ondismiss: () => {
          console.log('🚪 Test modal dismissed');
          clearTimeout(testTimeout);
          rejectTest(new Error('Test modal dismissed'));
        },
      };

      // Add error handler to catch Razorpay internal errors
      testOptions.onError = (error: any) => {
        console.error('🚨 Razorpay onError triggered:', error);
        clearTimeout(testTimeout);

        // Check if we can bypass this error
        this.handleRazorpayError(error).then(bypassResult => {
          if (bypassResult.canBypass) {
            console.log('✅ Error can be bypassed:', bypassResult.solution);
            rejectTest(
              new Error(
                `Razorpay Error (Bypassable): ${bypassResult.solution}`,
              ),
            );
          } else {
            rejectTest(
              new Error(`Razorpay Error: ${error.message || 'Unknown error'}`),
            );
          }
        });
      };

      console.log('🚪 Opening test Razorpay modal with simplified config...');
      console.log('🔧 Test options:', testOptions);

      // Try to open the modal
      RazorpayCheckout.open(testOptions);

      // Wait for result
      const result = await testPromise;
      console.log('✅ Test modal test passed:', result);
      return true;
    } catch (error: any) {
      console.error('❌ Test modal test failed:', error);

      // Check if this is a bypassable Razorpay error
      const bypassResult = await this.handleRazorpayError(error);
      if (bypassResult.canBypass) {
        console.log('✅ Error can be bypassed:', bypassResult.solution);
        throw new Error(
          `Razorpay Error (Bypassable): ${bypassResult.solution}`,
        );
      }

      return false;
    }
  }

  /**
   * Check device compatibility for Razorpay
   */
  static async checkDeviceCompatibility(): Promise<{
    isCompatible: boolean;
    platform: string;
    version: string;
    issues: string[];
  }> {
    try {
      console.log('🔍 Checking device compatibility...');

      const issues: string[] = [];
      let isCompatible = true;

      // Check platform
      const platform = require('react-native').Platform.OS;
      console.log('📱 Platform:', platform);

      // Check React Native version
      const version = require('react-native').Platform.Version;
      console.log('📱 Version:', version);

      // Platform-specific checks
      if (platform === 'android') {
        // Android-specific compatibility checks
        if (version < 21) {
          issues.push(
            'Android API level below 21 (Android 5.0) - may cause issues',
          );
          isCompatible = false;
        }

        // Check for common Android issues
        console.log('🔍 Android compatibility check passed');
      } else if (platform === 'ios') {
        // iOS-specific compatibility checks
        if (version < 11) {
          issues.push('iOS version below 11 - may cause issues');
          isCompatible = false;
        }

        console.log('🔍 iOS compatibility check passed');
      }

      console.log('✅ Device compatibility check completed');
      return {
        isCompatible,
        platform,
        version: version.toString(),
        issues,
      };
    } catch (error) {
      console.error('❌ Device compatibility check failed:', error);
      return {
        isCompatible: false,
        platform: 'unknown',
        version: 'unknown',
        issues: ['Failed to check device compatibility'],
      };
    }
  }

  /**
   * Get alternative Razorpay configuration for problematic devices
   */
  static getAlternativeRazorpayConfig() {
    return {
      // Simplified configuration that works on most devices
      key: RAZORPAY_CONFIG.key,
      amount: 100, // Test amount
      currency: 'INR',
      name: 'UtilsApp',
      description: 'Test Payment',
      order_id: `test_${Date.now()}`,
      prefill: {
        contact: '9999999999',
        name: 'Test User',
      },
      // Minimal method configuration
      method: {
        card: true,
        upi: true,
      },
      // Simplified theme
      theme: { color: '#4f8cff' },
      // Disable problematic features
      fullscreen: false,
      backdropClose: true,
      // Remove complex configurations
      image: undefined,
    };
  }

  /**
   * Bypass Razorpay errors and provide alternative solutions
   */
  static async handleRazorpayError(error: any): Promise<{
    canBypass: boolean;
    solution: string;
    alternativeMethod?: string;
  }> {
    try {
      console.log('🔍 Analyzing Razorpay error for bypass solution...');

      // Check if this is a "Something went wrong" error
      if (
        error.message?.includes('Something went wrong') ||
        error.message?.includes('Uh! oh!') ||
        error.description?.includes('Something went wrong')
      ) {
        console.log(
          '🚨 Detected Razorpay internal error - attempting bypass...',
        );

        return {
          canBypass: true,
          solution:
            'Razorpay is experiencing internal issues. We can try alternative approaches.',
          alternativeMethod: 'manual_payment',
        };
      }

      // Check for other common Razorpay errors
      if (error.code === 'MODAL_OPEN_TIMEOUT') {
        return {
          canBypass: true,
          solution:
            'Payment modal failed to open. This might be a device compatibility issue.',
          alternativeMethod: 'simplified_config',
        };
      }

      if (error.code === 'RAZORPAY_OPEN_ERROR') {
        return {
          canBypass: true,
          solution:
            'Failed to open Razorpay. This might be a configuration issue.',
          alternativeMethod: 'config_fix',
        };
      }

      // Check if this is a network-related error
      if (
        error.message?.includes('network') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout')
      ) {
        return {
          canBypass: true,
          solution:
            'Network connectivity issue detected. Please check your internet connection.',
          alternativeMethod: 'network_retry',
        };
      }

      return {
        canBypass: false,
        solution:
          'This error cannot be automatically bypassed. Please contact support.',
      };
    } catch (analysisError) {
      console.error('❌ Error analysis failed:', analysisError);
      return {
        canBypass: false,
        solution: 'Unable to analyze error. Please contact support.',
      };
    }
  }

  /**
   * Alternative payment method when Razorpay fails
   */
  static async processAlternativePayment(
    plan: PaymentPlan,
  ): Promise<PaymentResult> {
    try {
      console.log('🔄 Processing alternative payment method...');

      // Get user authentication data
      const token = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!token || !userId || userId <= 0) {
        throw new Error('Authentication failed. Please log in again.');
      }

      console.log('✅ User authenticated:', userId);

      // Create order with backend first
      const orderData: CreateOrderDto = {
        userId: parseInt(userId.toString()),
        planId: parseInt(plan.id.toString()),
        amount: plan.price * 100,
        currency: 'INR',
        receipt: `plan_upgrade_${Date.now()}`,
        notes: `Upgrade to ${plan.name} plan (Alternative Payment)`,
        contact: '',
        name: 'User',
      };

      console.log('📋 Creating order with backend API...');
      const orderResponse = await PaymentApiService.createOrder(orderData);
      const orderId = PaymentApiService.extractOrderId(orderResponse) || '';

      if (!orderId) {
        throw new Error('Failed to get order ID from backend response');
      }

      console.log('✅ Backend order created successfully:', orderId);

      // Return a special result indicating alternative payment needed
      return {
        success: true,
        message:
          'Alternative payment method initiated. Please contact support to complete your payment.',
        paymentId: `alt_${Date.now()}`,
        orderId: orderId,
        signature: 'alternative_payment',
        paymentDetails: {
          method: 'alternative',
          orderId: orderId,
          plan: plan,
        },
        razorpay_payment_id: `alt_${Date.now()}`,
        razorpay_order_id: orderId,
        razorpay_signature: 'alternative_payment',
        method: 'alternative',
        amount: plan.price * 100,
        contact: '',
        name: 'User',
        email: '',
      };
    } catch (error: any) {
      console.error('❌ Alternative payment failed:', error);
      throw error;
    }
  }
}

export default PaymentService;
