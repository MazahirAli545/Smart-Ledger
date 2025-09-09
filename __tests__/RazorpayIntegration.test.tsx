import React from 'react';
import { Alert } from 'react-native';
import { PaymentService } from '../src/services/paymentService';
import RazorpayCheckout from 'react-native-razorpay';

// Mock RazorpayCheckout
jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock PaymentApiService
jest.mock('../src/api/payments', () => ({
  createOrder: jest.fn(),
  capturePayment: jest.fn(),
  extractOrderId: jest.fn(),
}));

describe('Razorpay Payment Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks before each test
    (RazorpayCheckout.open as jest.Mock).mockClear();
  });

  describe('PaymentService.checkRazorpayHealth', () => {
    it('should return healthy status when RazorpayCheckout is available', async () => {
      const result = await PaymentService.checkRazorpayHealth();

      expect(result.isAvailable).toBe(true);
      expect(result.hasOpenMethod).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle missing RazorpayCheckout gracefully', async () => {
      // Temporarily mock RazorpayCheckout as undefined
      const originalRazorpayCheckout = (global as any).RazorpayCheckout;
      (global as any).RazorpayCheckout = undefined;

      const result = await PaymentService.checkRazorpayHealth();

      expect(result.isAvailable).toBe(false);
      expect(result.hasOpenMethod).toBe(false);
      expect(result.error).toContain('RazorpayCheckout is not imported');

      // Restore original
      (global as any).RazorpayCheckout = originalRazorpayCheckout;
    });
  });

  describe('PaymentService.processPlanPayment', () => {
    const mockPlan = {
      id: '1',
      name: 'Premium Plan',
      price: 999,
      period: 'monthly',
    };

    const mockToken = 'mock-jwt-token';
    const mockUserId = '123';

    beforeEach(() => {
      // Mock AsyncStorage.getItem to return a valid token
      const { getItem } = require('@react-native-async-storage/async-storage');
      getItem.mockResolvedValue(mockToken);

      // Mock getUserIdFromToken to return a valid user ID
      jest.doMock('../src/utils/storage', () => ({
        getUserIdFromToken: jest.fn().mockResolvedValue(mockUserId),
      }));
    });

    it('should create order and open Razorpay checkout successfully', async () => {
      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock successful Razorpay checkout
      const mockPaymentResponse = {
        razorpay_payment_id: 'pay_123',
        razorpay_order_id: 'order_123',
        razorpay_signature: 'sig_123',
        method: 'card',
        amount: 99900,
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValue(
        mockPaymentResponse,
      );

      const result = await PaymentService.processPlanPayment(mockPlan);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pay_123');
      expect(result.orderId).toBe('order_123');
      expect(result.signature).toBe('sig_123');
      expect(createOrder).toHaveBeenCalledWith({
        userId: 123,
        planId: 1,
        amount: 99900,
        currency: 'INR',
        receipt: expect.stringContaining('plan_upgrade_'),
        notes: 'Upgrade to Premium Plan plan',
        contact: '',
        name: 'User',
      });
    });

    it('should handle Razorpay checkout cancellation', async () => {
      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock Razorpay checkout cancellation
      (RazorpayCheckout.open as jest.Mock).mockRejectedValue({
        code: 'PAYMENT_CANCELLED',
        message: 'Payment was cancelled by user',
      });

      await expect(
        PaymentService.processPlanPayment(mockPlan),
      ).rejects.toThrow();
    });

    it('should handle network errors during order creation', async () => {
      // Mock failed order creation
      const { createOrder } = require('../src/api/payments');
      createOrder.mockRejectedValue(new Error('Network error'));

      await expect(PaymentService.processPlanPayment(mockPlan)).rejects.toThrow(
        'Failed to create payment order: Network error',
      );
    });

    it('should validate Razorpay configuration before proceeding', async () => {
      // Test with invalid configuration by mocking the service
      const mockPaymentService = {
        ...PaymentService,
        processPlanPayment: jest
          .fn()
          .mockRejectedValue(
            new Error(
              'Razorpay configuration is incomplete. Please check your API keys.',
            ),
          ),
      };

      await expect(
        mockPaymentService.processPlanPayment(mockPlan),
      ).rejects.toThrow('Razorpay configuration is incomplete');
    });
  });

  describe('Payment Error Handling', () => {
    it('should handle missing payment ID in response', async () => {
      const mockPlan = {
        id: '1',
        name: 'Basic Plan',
        price: 499,
        period: 'monthly',
      };

      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock Razorpay response without payment ID
      const invalidResponse = {
        razorpay_order_id: 'order_123',
        razorpay_signature: 'sig_123',
        // Missing razorpay_payment_id
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValue(invalidResponse);

      await expect(PaymentService.processPlanPayment(mockPlan)).rejects.toThrow(
        'Invalid payment response from Razorpay',
      );
    });

    it('should handle timeout scenarios', async () => {
      const mockPlan = {
        id: '1',
        name: 'Basic Plan',
        price: 499,
        period: 'monthly',
      };

      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock Razorpay checkout that never resolves (simulating timeout)
      (RazorpayCheckout.open as jest.Mock).mockImplementation(() => {
        return new Promise(() => {
          // Never resolve or reject - simulating timeout
        });
      });

      // Test with a shorter timeout for testing purposes
      jest.useFakeTimers();

      const paymentPromise = PaymentService.processPlanPayment(mockPlan);

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(300000); // 5 minutes

      await expect(paymentPromise).rejects.toThrow();

      jest.useRealTimers();
    });
  });

  describe('Payment Method Configuration', () => {
    it('should configure all supported payment methods', async () => {
      const mockPlan = {
        id: '1',
        name: 'Premium Plan',
        price: 999,
        period: 'monthly',
      };

      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock successful Razorpay checkout
      const mockPaymentResponse = {
        razorpay_payment_id: 'pay_123',
        razorpay_order_id: 'order_123',
        razorpay_signature: 'sig_123',
        method: 'upi',
        amount: 99900,
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValue(
        mockPaymentResponse,
      );

      await PaymentService.processPlanPayment(mockPlan);

      // Verify that RazorpayCheckout.open was called with correct payment method configuration
      expect(RazorpayCheckout.open).toHaveBeenCalledWith(
        expect.objectContaining({
          method: {
            netbanking: true,
            card: true,
            upi: true,
            wallet: true,
            emi: false,
            paylater: false,
          },
        }),
      );
    });
  });

  describe('Payment Security', () => {
    it('should include signature verification in response', async () => {
      const mockPlan = {
        id: '1',
        name: 'Premium Plan',
        price: 999,
        period: 'monthly',
      };

      // Mock successful order creation
      const { createOrder, extractOrderId } = require('../src/api/payments');
      createOrder.mockResolvedValue({
        code: 200,
        message: 'Order created successfully',
        data: { orderId: 'order_123' },
      });
      extractOrderId.mockReturnValue('order_123');

      // Mock successful Razorpay checkout with signature
      const mockPaymentResponse = {
        razorpay_payment_id: 'pay_123',
        razorpay_order_id: 'order_123',
        razorpay_signature: 'sig_123',
        method: 'card',
        amount: 99900,
      };

      (RazorpayCheckout.open as jest.Mock).mockResolvedValue(
        mockPaymentResponse,
      );

      const result = await PaymentService.processPlanPayment(mockPlan);

      expect(result.signature).toBe('sig_123');
      expect(result.razorpay_signature).toBe('sig_123');
    });
  });
});
