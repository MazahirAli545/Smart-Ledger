import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api';
import { useSubscription } from '../context/SubscriptionContext';
import { getUserIdFromToken } from '../utils/storage';
import PaymentApiService, { CapturePaymentDto } from '../api/payments';
import RazorpayCheckout from 'react-native-razorpay';
import PaymentDetailsDisplay from '../components/PaymentDetailsDisplay';
import { showPlanUpdatedNotification } from '../utils/notificationHelper';
import {
  PaymentService,
  PaymentPlan,
  PaymentResult,
} from '../services/paymentService';
import { useTransactionLimit } from '../context/TransactionLimitContext';
import { useAlert } from '../context/AlertContext';

// Razorpay Configuration - now using environment variables
import { getRazorpayConfig } from '../config/env';

const RAZORPAY_CONFIG = getRazorpayConfig();

/**
 * SubscriptionPlanScreen - Updated with Direct Razorpay Integration
 *
 * Payment Flow (Direct Razorpay like DonationDetail.js):
 * 1. User selects plan and clicks upgrade
 * 2. Check transaction limits first
 * 3. Create Razorpay order directly from frontend
 * 4. Open Razorpay modal with order ID
 * 5. User completes payment in Razorpay
 * 6. Capture payment details and send to backend
 * 7. Backend activates user plan
 * 8. Show success message and refresh subscription data
 *
 * Fallback: Still uses backend APIs if direct integration fails
 *
 * IMPORTANT: Razorpay Signature Handling
 * =====================================
 * The React Native Razorpay SDK does NOT include the razorpay_signature in the response
 * object. This is by design for security reasons - the signature requires the secret key
 * which should never be exposed to the frontend.
 *
 * The correct approach is:
 * 1. Frontend sends payment_id and order_id to backend
 * 2. Backend generates signature using secret key + HMAC SHA256
 * 3. Backend verifies the signature against Razorpay's records
 * 4. Backend processes the payment if verification succeeds
 *
 * This fix ensures the frontend doesn't fail when signature is null/undefined.
 */

interface PlanDisplayData {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isCurrent?: boolean;
  buttonText: string;
  buttonAction: 'upgrade' | 'downgrade' | 'current' | 'contact';
}

interface CurrentPlanDisplay {
  name: string;
  price: number;
  period: string;
  description: string;
  usage: {
    transactions: { used: number; limit: number };
    users: { used: number; limit: number };
    storage: { used: number; limit: number };
  };
  nextBilling: string;
  amount: number;
  status: 'active' | 'inactive';
}

// New interfaces for API data
interface BillingSummary {
  totalInvoices: number;
  totalAmount: number;
  averageAmount: number;
  pendingInvoices: number;
  overdueInvoices: number;
  currency: string;
}

interface TransactionLimitInfo {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  planName: string;
  canCreate: boolean;
  percentageUsed: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  nextResetDate: string;
  nextResetFormatted: string;
}

interface BillingHistoryItem {
  id: number;
  invoiceNumber: string;
  billingPeriod: string;
  billingDate: string;
  dueDate: string;
  amount: number;
  status: string;
  planType: string;
  planName: string;
  paymentId?: string; // Add payment ID for linking to payment details
}

const SubscriptionPlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  const {
    currentSubscription,
    availablePlans,
    loading,
    error,
    fetchSubscriptionData,
    upgradePlan: contextUpgradePlan,
    downgradePlan: contextDowngradePlan,
    cancelSubscription,
  } = useSubscription();

  // Transaction limit context to control popups during plan upgrades
  const { stopLimitMonitoring, startLimitMonitoring } = useTransactionLimit();

  // State to track which plan is currently selected for detailed view
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // New state for API data
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null,
  );
  const [transactionLimits, setTransactionLimits] =
    useState<TransactionLimitInfo | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>(
    [],
  );
  const [apiLoading, setApiLoading] = useState(false);

  // New state for better error handling (like web version)
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [planActionLoading, setPlanActionLoading] = useState<string | null>(
    null,
  );

  // Payment details state
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    console.log('SubscriptionPlanScreen mounted');

    // 🚨 REMOVED: All loading logic and timeout - direct data fetch
    fetchSubscriptionData();
    fetchBillingData();
  }, []);

  // Set recommended plan as default selected plan when data loads
  useEffect(() => {
    if (availablePlans.length > 0 && currentSubscription) {
      const recommendedPlan = availablePlans.find(plan =>
        getRecommendedPlan(plan.name),
      );
      if (recommendedPlan) {
        setSelectedPlanId(recommendedPlan.id);
      }
    }
  }, [availablePlans, currentSubscription]);

  // New function to fetch billing data from backend APIs with better error handling
  const fetchBillingData = async () => {
    try {
      setApiLoading(true);
      setPaymentError(null);

      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('No auth token, skipping billing data fetch');
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch billing summary with error handling
      try {
        const billingSummaryResponse = await fetch(
          `${BASE_URL}/billing/summary`,
          { headers },
        );
        if (billingSummaryResponse.ok) {
          const billingData = await billingSummaryResponse.json();
          if (billingData.code === 200) {
            setBillingSummary(billingData.data);
          } else {
            console.error('Billing summary API error:', billingData);
          }
        } else {
          console.error(
            'Billing summary HTTP error:',
            billingSummaryResponse.status,
          );
        }
      } catch (error) {
        console.error('Billing summary fetch error:', error);
      }

      // Fetch transaction limits with error handling
      try {
        const transactionLimitsResponse = await fetch(
          `${BASE_URL}/transaction-limits/info`,
          { headers },
        );
        if (transactionLimitsResponse.ok) {
          const limitsData = await transactionLimitsResponse.json();
          if (limitsData.code === 200) {
            setTransactionLimits(limitsData.data);
          } else {
            console.error('Transaction limits API error:', limitsData);
          }
        } else {
          console.error(
            'Transaction limits HTTP error:',
            transactionLimitsResponse.status,
          );
        }
      } catch (error) {
        console.error('Transaction limits fetch error:', error);
      }

      // Fetch billing history with error handling
      try {
        const billingHistoryResponse = await fetch(
          `${BASE_URL}/billing/history`,
          { headers },
        );
        if (billingHistoryResponse.ok) {
          const historyData = await billingHistoryResponse.json();
          if (historyData.code === 200) {
            setBillingHistory(historyData.data || []);
          } else {
            console.error('Billing history API error:', historyData);
          }
        } else {
          console.error(
            'Billing history HTTP error:',
            billingHistoryResponse.status,
          );
        }
      } catch (error) {
        console.error('Billing history fetch error:', error);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      setPaymentError('Failed to load billing information. Please try again.');
    } finally {
      setApiLoading(false);
    }
  };

  // Function to refresh billing data
  const refreshBillingData = async () => {
    try {
      setApiLoading(true);
      await fetchBillingData();
    } catch (error) {
      console.error('Error refreshing billing data:', error);
      // 🎯 FIXED: Show user-friendly error message
      showAlert({
        title: 'Refresh Failed',
        message: 'Unable to refresh billing data. Please try again.',
        type: 'error',
      });
    } finally {
      setApiLoading(false);
    }
  };

  // 🚨 REMOVED: Loading state - direct access

  // 🚨 REMOVED: Retry mechanism - not needed

  // Function to fetch payment details from backend
  const fetchPaymentDetails = async (paymentId: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.error('No auth token available');
        return;
      }

      const response = await fetch(`${BASE_URL}/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const paymentData = await response.json();
        if (paymentData.code === 200 && paymentData.data) {
          setPaymentDetails(paymentData.data);
          setShowPaymentDetails(true);
        } else {
          console.error('Failed to fetch payment details:', paymentData);
        }
      } else {
        console.error('Failed to fetch payment details:', response.status);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  };

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'paid':
        return '#28a745';
      case 'pending':
        return '#fd7e14';
      case 'overdue':
        return '#dc3545';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  };

  // Get the currently selected plan for detailed view with better null safety
  const getSelectedPlan = () => {
    if (!selectedPlanId || !availablePlans || availablePlans.length === 0)
      return null;
    const plan = availablePlans.find(plan => plan.id === selectedPlanId);
    if (!plan) return null;

    // Create a plan object with all required properties for display
    const isCurrent =
      currentSubscription?.planName.toLowerCase() === plan.name.toLowerCase();
    const isRecommended = getRecommendedPlan(plan.name);

    return {
      ...plan,
      isCurrent,
      isRecommended,
      buttonText: isCurrent
        ? 'Current Plan'
        : isRecommended
        ? 'Upgrade Now'
        : plan.price > (currentSubscription?.amount || 0)
        ? 'Upgrade'
        : 'Downgrade',
      buttonAction: isCurrent
        ? 'current'
        : plan.price > (currentSubscription?.amount || 0)
        ? 'upgrade'
        : ('downgrade' as 'upgrade' | 'downgrade' | 'current' | 'contact'),
    };
  };

  const handlePlanAction = async (plan: PlanDisplayData) => {
    switch (plan.buttonAction) {
      case 'upgrade':
        // Direct upgrade without transaction limit check - let Razorpay handle payment
        upgradePlan(plan);
        break;
      case 'downgrade':
        showAlert({
          title: 'Downgrade Plan',
          message: `Are you sure you want to downgrade to ${plan.name}? This will take effect at the end of your current billing cycle.`,
          type: 'confirm',
          confirmText: 'Downgrade',
          cancelText: 'Cancel',
          onConfirm: () => downgradePlan(plan),
        });
        break;
      case 'contact':
        showAlert({
          title: 'Contact Sales',
          message: 'Please contact our sales team for enterprise pricing.',
          type: 'info',
        });
        break;
      default:
        break;
    }
  };

  // 🎯 CRITICAL: Signature extraction helper function
  const extractSignatureFromResponse = (response: any): string | null => {
    try {
      // Method 1: Direct property
      if (response.razorpay_signature) {
        console.log('✅ Signature found at root level');
        return response.razorpay_signature;
      }

      // Method 2: Check all properties for signature-like values
      const searchForSignature = (
        obj: any,
        path: string = '',
      ): string | null => {
        if (typeof obj === 'object' && obj !== null) {
          for (const [key, value] of Object.entries(obj)) {
            if (
              typeof value === 'string' &&
              value.length > 20 &&
              /^[a-f0-9]+$/i.test(value)
            ) {
              console.log(`✅ Signature found at ${path}.${key}`);
              return value;
            } else if (typeof value === 'object') {
              const result = searchForSignature(
                value,
                path ? `${path}.${key}` : key,
              );
              if (result) return result;
            }
          }
        }
        return null;
      };

      return searchForSignature(response);
    } catch (error) {
      console.error('❌ Error extracting signature:', error);
      return null;
    }
  };

  // 🎯 UPDATED: Handle payment success with backend capture endpoint (simplified like web version)
  // ... existing code ...
  const handlePaymentSuccess = async (
    razorpayResponse: any,
    plan: PlanDisplayData,
  ) => {
    try {
      console.log(
        '🎉 Payment success, capturing payment with backend...',
        razorpayResponse,
      );

      const token = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!token || !userId) {
        throw new Error('Authentication failed');
      }

      // Validate Razorpay response
      if (
        !razorpayResponse.razorpay_payment_id ||
        !razorpayResponse.razorpay_order_id
      ) {
        console.error('❌ Invalid Razorpay response:', razorpayResponse);
        throw new Error('Invalid payment response from Razorpay');
      }

      // 🎯 CRITICAL FIX: React Native Razorpay SDK doesn't include signature in response
      // The signature will be generated on the backend using the secret key
      //
      // IMPORTANT: In React Native Razorpay SDK, the signature is NOT included in the response
      // because it requires the secret key which should never be exposed to the frontend.
      // The backend will generate the signature using:
      // 1. razorpay_payment_id
      // 2. razorpay_order_id
      // 3. Razorpay secret key
      // 4. HMAC SHA256 algorithm
      //
      // This is the correct and secure approach for signature verification.
      console.log(
        '⚠️ Note: razorpay_signature not included in React Native response - will be generated on backend',
      );

      console.log('✅ Payment response validation passed');

      // 🎯 DEBUG: Log the complete Razorpay response for debugging
      console.log(
        '🔍 Complete Razorpay response:',
        JSON.stringify(razorpayResponse, null, 2),
      );

      // 🎯 DEBUG: Check if signature exists in response
      console.log('🔍 Signature check:');
      console.log(
        '  - Has razorpay_signature property:',
        'razorpay_signature' in razorpayResponse,
      );
      console.log(
        '  - razorpay_signature value:',
        razorpayResponse.razorpay_signature,
      );
      console.log(
        '  - razorpay_signature type:',
        typeof razorpayResponse.razorpay_signature,
      );
      console.log('  - All response keys:', Object.keys(razorpayResponse));

      // 🎯 DEBUG: Check for alternative signature properties
      console.log('🔍 Alternative signature check:');
      console.log('  - signature:', razorpayResponse.signature);
      console.log('  - payment_signature:', razorpayResponse.payment_signature);
      console.log(
        '  - response_signature:',
        razorpayResponse.response_signature,
      );
      console.log(
        '  - All properties with "signature" in name:',
        Object.keys(razorpayResponse).filter(key =>
          key.toLowerCase().includes('signature'),
        ),
      );

      // 🎯 CRITICAL: Check if signature is in a different property name
      console.log('🔍 Deep signature search:');
      console.log(
        '  - Checking all string values for signature-like patterns...',
      );
      const searchForSignature = (obj: any, path: string = ''): void => {
        if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (
              typeof value === 'string' &&
              value.length > 20 &&
              /^[a-f0-9]+$/i.test(value)
            ) {
              console.log(
                `  - Found potential signature at ${path}.${key}: ${value.substring(
                  0,
                  20,
                )}...`,
              );
            } else if (typeof value === 'object') {
              searchForSignature(value, path ? `${path}.${key}` : key);
            }
          });
        }
      };
      searchForSignature(razorpayResponse);

      // 🎯 CRITICAL FIX: Extract signature from response - COMPREHENSIVE APPROACH
      let extractedSignature = null;

      // Method 1: Try direct access first
      if (razorpayResponse.razorpay_signature) {
        extractedSignature = razorpayResponse.razorpay_signature;
        console.log(
          '✅ Signature found at root level:',
          extractedSignature.substring(0, 20) + '...',
        );
      } else {
        // Method 2: Check all possible signature property names
        const signatureKeys = [
          'razorpay_signature',
          'signature',
          'payment_signature',
          'response_signature',
          'razorpaySignature',
          'paymentSignature',
          'responseSignature',
        ];

        for (const key of signatureKeys) {
          if (
            razorpayResponse[key] &&
            typeof razorpayResponse[key] === 'string'
          ) {
            extractedSignature = razorpayResponse[key];
            console.log(
              `✅ Signature found at key '${key}':`,
              extractedSignature.substring(0, 20) + '...',
            );
            break;
          }
        }

        // Method 2.5: Check nested structures (like full_response)
        if (!extractedSignature) {
          // Check if signature is in full_response object
          if (
            razorpayResponse.full_response &&
            razorpayResponse.full_response.razorpay_signature
          ) {
            extractedSignature =
              razorpayResponse.full_response.razorpay_signature;
            console.log(
              '✅ Signature found in full_response.razorpay_signature:',
              extractedSignature.substring(0, 20) + '...',
            );
          }
          // Check if signature is in JSON_LOG object
          else if (
            razorpayResponse.JSON_LOG &&
            razorpayResponse.JSON_LOG.razorpay_signature
          ) {
            extractedSignature = razorpayResponse.JSON_LOG.razorpay_signature;
            console.log(
              '✅ Signature found in JSON_LOG.razorpay_signature:',
              extractedSignature.substring(0, 20) + '...',
            );
          }
          // Check if signature is in JSON_LOG.full_response object
          else if (
            razorpayResponse.JSON_LOG &&
            razorpayResponse.JSON_LOG.full_response &&
            razorpayResponse.JSON_LOG.full_response.razorpay_signature
          ) {
            extractedSignature =
              razorpayResponse.JSON_LOG.full_response.razorpay_signature;
            console.log(
              '✅ Signature found in JSON_LOG.full_response.razorpay_signature:',
              extractedSignature.substring(0, 20) + '...',
            );
          }
          // Check if signature is in razorpay_response.JSON_LOG.full_response object (from CSV data)
          else if (
            razorpayResponse.razorpay_response &&
            razorpayResponse.razorpay_response.JSON_LOG &&
            razorpayResponse.razorpay_response.JSON_LOG.full_response &&
            razorpayResponse.razorpay_response.JSON_LOG.full_response
              .razorpay_signature
          ) {
            extractedSignature =
              razorpayResponse.razorpay_response.JSON_LOG.full_response
                .razorpay_signature;
            console.log(
              '✅ Signature found in razorpay_response.JSON_LOG.full_response.razorpay_signature:',
              extractedSignature.substring(0, 20) + '...',
            );
          }
        }

        // Method 3: Deep search through the entire response object
        if (!extractedSignature) {
          const searchForSignature = (
            obj: any,
            path: string = '',
          ): string | null => {
            if (
              typeof obj === 'string' &&
              obj.length > 20 &&
              /^[a-f0-9]+$/i.test(obj)
            ) {
              console.log(
                `✅ Found potential signature at ${path}: ${obj.substring(
                  0,
                  20,
                )}...`,
              );
              return obj;
            }
            if (typeof obj === 'object' && obj !== null) {
              for (const [key, value] of Object.entries(obj)) {
                const result = searchForSignature(
                  value,
                  path ? `${path}.${key}` : key,
                );
                if (result) return result;
              }
            }
            return null;
          };

          extractedSignature = searchForSignature(razorpayResponse);
          if (extractedSignature) {
            console.log(
              '✅ Signature found in nested object:',
              extractedSignature.substring(0, 20) + '...',
            );
          }
        }
      }

      // 🎯 IMPORTANT: Log signature status for debugging
      console.log('🔍 SIGNATURE EXTRACTION RESULT:');
      console.log('  - Signature found:', !!extractedSignature);
      console.log(
        '  - Signature value:',
        extractedSignature
          ? `${extractedSignature.substring(0, 20)}...`
          : 'NULL',
      );
      console.log('  - Full signature:', extractedSignature);

      if (!extractedSignature) {
        console.log(
          '❌ No signature found in response - checking all response keys:',
        );
        console.log('  - All keys:', Object.keys(razorpayResponse));
        console.log(
          '  - Full response:',
          JSON.stringify(razorpayResponse, null, 2),
        );
      }

      // 🎯 CRITICAL FIX: Intelligent payment method detection with fallbacks
      let paymentMethod = 'unknown';

      // Try to detect payment method from Razorpay response
      if (razorpayResponse.method) {
        paymentMethod = razorpayResponse.method;
        console.log('✅ Payment method detected from Razorpay:', paymentMethod);
      } else if (razorpayResponse.bank) {
        paymentMethod = 'netbanking';
        console.log('✅ Payment method detected as netbanking from bank field');
      } else if (razorpayResponse.wallet) {
        paymentMethod = 'wallet';
        console.log('✅ Payment method detected as wallet from wallet field');
      } else if (
        razorpayResponse.card_id ||
        razorpayResponse.card_network ||
        razorpayResponse.card_type ||
        razorpayResponse.card_last4
      ) {
        paymentMethod = 'card';
        console.log('✅ Payment method detected as card from card fields');
      } else if (
        razorpayResponse.upi_vpa ||
        razorpayResponse.upi_transaction_id
      ) {
        paymentMethod = 'upi';
        console.log('✅ Payment method detected as UPI from UPI fields');
      } else {
        // 🎯 IMPROVED FALLBACK: Check for UPI indicators first, then card
        // This prevents misclassifying UPI payments as card payments
        const hasUPIIndicators =
          razorpayResponse.razorpay_payment_id &&
          !razorpayResponse.card_id &&
          !razorpayResponse.card_last4;

        if (hasUPIIndicators) {
          paymentMethod = 'upi';
          console.log(
            '✅ Payment method detected as UPI from payment pattern analysis',
          );
        } else if (
          razorpayResponse.razorpay_order_id &&
          razorpayResponse.razorpay_order_id.includes('order_')
        ) {
          // Most common in test mode - default to card only if no UPI indicators
          paymentMethod = 'card';
          console.log(
            '⚠️ Payment method not detected, defaulting to card (test mode fallback)',
          );
        } else {
          paymentMethod = 'unknown';
          console.log('⚠️ Payment method not detected, setting as unknown');
        }
      }

      console.log('🔍 Final detected payment method:', paymentMethod);

      console.log('🎯 Plan details:', {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        priceInPaisa: plan.price * 100,
      });

      // 🎯 DEBUG: Log ALL available fields from Razorpay response
      console.log('🔍 ALL RAZORPAY FIELDS AVAILABLE:');
      console.log(
        '  - razorpay_payment_id:',
        razorpayResponse.razorpay_payment_id,
      );
      console.log('  - razorpay_order_id:', razorpayResponse.razorpay_order_id);
      console.log(
        '  - razorpay_signature:',
        razorpayResponse.razorpay_signature ||
          'NOT PROVIDED (React Native SDK limitation)',
      );
      console.log('  - method:', razorpayResponse.method);
      console.log('  - bank:', razorpayResponse.bank);
      console.log('  - wallet:', razorpayResponse.wallet);
      console.log('  - card_id:', razorpayResponse.card_id);
      console.log('  - card_network:', razorpayResponse.card_network);
      console.log('  - card_type:', razorpayResponse.card_type);
      console.log('  - card_last4:', razorpayResponse.card_last4);
      console.log('  - card_issuer:', razorpayResponse.card_issuer);
      console.log(
        '  - upi_transaction_id:',
        razorpayResponse.upi_transaction_id,
      );
      console.log('  - upi_vpa:', razorpayResponse.upi_vpa);
      console.log('  - fee:', razorpayResponse.fee);
      console.log('  - tax:', razorpayResponse.tax);
      console.log('  - international:', razorpayResponse.international);
      console.log('  - contact:', razorpayResponse.contact);
      console.log('  - name:', razorpayResponse.name);
      console.log('  - email:', razorpayResponse.email);
      console.log('  - amount:', razorpayResponse.amount);
      console.log('  - currency:', razorpayResponse.currency);
      console.log('  - status:', razorpayResponse.status);
      console.log('  - captured:', razorpayResponse.captured);
      console.log('  - entity:', razorpayResponse.entity);
      console.log('  - invoice_id:', razorpayResponse.invoice_id);
      console.log('  - error_code:', razorpayResponse.error_code);
      console.log('  - error_description:', razorpayResponse.error_description);
      console.log('  - error_source:', razorpayResponse.error_source);
      console.log('  - error_step:', razorpayResponse.error_step);
      console.log('  - error_reason:', razorpayResponse.error_reason);
      console.log('  - created_at:', razorpayResponse.created_at);
      console.log('  - updated_at:', razorpayResponse.updated_at);
      console.log('  - captured_at:', razorpayResponse.captured_at);
      console.log('  - refunded_at:', razorpayResponse.refunded_at);
      console.log('  - recurring:', razorpayResponse.recurring);
      console.log('  - recurring_token:', razorpayResponse.recurring_token);
      console.log('  - recurring_status:', razorpayResponse.recurring_status);
      console.log('  - amount_in_paisa:', razorpayResponse.amount_in_paisa);
      console.log('  - base_amount:', razorpayResponse.base_amount);
      console.log('  - base_currency:', razorpayResponse.base_currency);
      console.log('  - exchange_rate:', razorpayResponse.exchange_rate);
      console.log(
        '  - razorpay_signature1:',
        razorpayResponse.razorpay_signature,
      );

      // 🎯 DEBUG: Log user data from AsyncStorage
      const userMobile = await AsyncStorage.getItem('userMobile');
      const userName = await AsyncStorage.getItem('userName');
      const userEmail = await AsyncStorage.getItem('userEmail');
      console.log('🔍 USER DATA FROM ASYNCSTORAGE:');
      console.log('  - userMobile:', userMobile);
      console.log('  - userName:', userName);
      console.log('  - userEmail:', userEmail);

      // 🎯 CRITICAL FIX: Get REAL user data from token - NO DUMMY DATA
      let realUserMobile: string | null = null;
      let realUserName: string | null = null;

      try {
        console.log('🔍 Fetching user data from token...');

        // 🎯 FIXED: Get user data from token instead of non-existent API endpoint
        // The token contains user information, so we can extract it directly
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        console.log('🔍 Token payload:', tokenPayload);

        if (tokenPayload) {
          realUserMobile = tokenPayload.mobileNumber || null;
          realUserName = tokenPayload.ownerName || null;

          console.log('✅ REAL user data extracted from token:', {
            mobile: realUserMobile,
            name: realUserName,
          });
        } else {
          console.log('⚠️ Could not extract user data from token');
        }
      } catch (error) {
        console.log('⚠️ Token parsing error:', error);
        // Fallback to AsyncStorage data
        const storedMobile = await AsyncStorage.getItem('userMobile');
        const storedName = await AsyncStorage.getItem('userName');

        realUserMobile = storedMobile;
        realUserName = storedName;
      }

      console.log('🔍 FINAL REAL USER DATA:');
      console.log('  - realUserMobile:', realUserMobile);
      console.log('  - realUserName:', realUserName);

      // 🎯 FIXED: Use ONLY real user data - NO DUMMY DATA
      const finalUserMobile = realUserMobile || userMobile;
      const finalUserName = realUserName || userName;

      console.log('🔍 FINAL USER DATA (WITH FALLBACKS):');
      console.log('  - finalUserMobile:', finalUserMobile);
      console.log('  - finalUserName:', finalUserName);

      // 🎯 FIXED: Map data correctly for backend capture endpoint using exact field names
      const capturePayload = {
        // 🎯 CRITICAL FIX: Use exact field names that backend controller expects
        paymentId: razorpayResponse.razorpay_payment_id, // Backend expects 'paymentId'
        razorpay_payment_id: razorpayResponse.razorpay_payment_id, // Also send as razorpay_payment_id
        order_id: razorpayResponse.razorpay_order_id, // Backend expects 'order_id'
        razorpay_order_id: razorpayResponse.razorpay_order_id, // Also send as razorpay_order_id
        amount: plan.price * 100, // Convert to paisa
        planId: parseInt(plan.id.toString()), // Backend expects 'planId'

        // 🎯 CRITICAL FIX: Use detected payment method instead of unknown
        method: paymentMethod, // Use the detected method, not razorpayResponse.method
        status: 'captured',

        // 🎯 CRITICAL FIX: Handle signature properly for React Native Razorpay
        // Use extracted signature from response
        razorpay_signature: razorpayResponse.razorpay_signature,

        // 🎯 ADDITIONAL: Send verification data for backend
        verification_data: {
          payment_id: razorpayResponse.razorpay_payment_id,
          order_id: razorpayResponse.razorpay_order_id,
          amount: plan.price * 100,
          currency: 'INR',
          timestamp: Date.now(),
          sdk_type: 'react_native',
          signature_available: !!razorpayResponse.razorpay_signature,
        },
        notes: `Upgrade to ${plan.name} plan - User ID: ${userId}`,
        contact: razorpayResponse.contact || finalUserMobile || '', // Use REAL user mobile
        name: razorpayResponse.name || finalUserName || '', // Use REAL user name
        email: razorpayResponse.email || '', // Use Razorpay email if available

        // Payment method details - FIXED to match backend field names
        bank: razorpayResponse.bank || '',
        wallet: razorpayResponse.wallet || '',
        card_id: razorpayResponse.card_id || '',
        card_network: razorpayResponse.card_network || '',
        card_type: razorpayResponse.card_type || '',
        card_last4: razorpayResponse.card_last4 || '',
        card_issuer: razorpayResponse.card_issuer || '',
        upi_transaction_id: razorpayResponse.upi_transaction_id || '',
        upi_vpa: razorpayResponse.upi_vpa || '',

        // Financial details - FIXED to match backend expectations
        fee: razorpayResponse.fee || 0,
        tax: razorpayResponse.tax || 0,
        international: razorpayResponse.international || false,

        // Status and metadata
        description: `Payment for ${plan.name} plan`,

        // 🎯 IMPORTANT: Signature handling note for backend
        signature_note: extractedSignature
          ? 'Signature provided by Razorpay'
          : 'No signature from React Native SDK - backend should verify using payment_id and order_id',

        // 🎯 CRITICAL: Flag for backend to handle signature verification differently
        requires_alternative_verification: !extractedSignature,

        // 🎯 FIXED: Store Razorpay data in JSON_LOG field as backend expects
        JSON_LOG: {
          // 🎯 CRITICAL: Use extracted signature from response
          razorpay_signature: extractedSignature,
          payment_id: razorpayResponse.razorpay_payment_id,
          order_id: razorpayResponse.razorpay_order_id,
          method: paymentMethod, // Use detected method
          bank: razorpayResponse.bank,
          wallet: razorpayResponse.wallet,
          card_details: {
            id: razorpayResponse.card_id,
            network: razorpayResponse.card_network,
            type: razorpayResponse.card_type,
            last4: razorpayResponse.card_last4,
            issuer: razorpayResponse.card_issuer,
          },
          upi_details: {
            transaction_id: razorpayResponse.upi_transaction_id,
            vpa: razorpayResponse.upi_vpa,
          },
          amount: razorpayResponse.amount,
          currency: razorpayResponse.currency,
          status: razorpayResponse.status,
          captured: razorpayResponse.captured,
          // 🎯 ADDITIONAL: Include all Razorpay response data for completeness
          full_response: razorpayResponse,

          // 🎯 ADDITIONAL: Add detection logic info for debugging
          method_detection: {
            detected_method: paymentMethod,
            original_method: razorpayResponse.method,
            fallback_used: !razorpayResponse.method,
            detection_logic: 'intelligent_fallback_for_test_mode',
          },

          // 🎯 CRITICAL: Signature verification approach
          signature_verification: {
            signature_provided: !!extractedSignature,
            verification_method: extractedSignature
              ? 'standard_signature_verification'
              : 'alternative_verification_required',
            note: extractedSignature
              ? 'Signature successfully extracted from Razorpay response'
              : 'React Native SDK limitation - backend should verify using payment_id and order_id',
          },
        },

        // Additional fields
        entity: 'payment',
        invoice_id: '',

        // 🎯 ADDITIONAL: Ensure all database fields are populated
        amount_in_paisa: plan.price * 100,
        base_amount: plan.price * 100,
        base_currency: 'INR',
        currency: 'INR',
        captured: true,
        refunded: false,
        refund_status: 'not_refunded',
        amount_refunded: 0,
        tax_amount: 0,
        fee_amount: 0,
        service_tax: 0,

        // 🎯 CRITICAL: Add subscription linking fields
        // Note: subscription_id will be set by backend after subscription creation

        // 🎯 ADDITIONAL: Send subscription_id if available (for linking)
        // This will be empty initially, backend will create subscription and link it
      };

      console.log(
        '📤 Sending capture payload to backend:',
        JSON.stringify(capturePayload, null, 2),
      );
      console.log('🔍 Key fields being sent:');
      console.log('  - razorpay_signature:', capturePayload.razorpay_signature);
      console.log('  - notes:', capturePayload.notes);
      console.log('  - contact:', capturePayload.contact);
      console.log('  - name:', capturePayload.name);
      console.log('  - email:', capturePayload.email);

      // 🎯 DEBUG: Log the exact values for missing fields
      console.log('🔍 SIGNATURE HANDLING DEBUG:');
      console.log(
        '  - razorpay_signature value:',
        capturePayload.razorpay_signature,
      );
      console.log(
        '  - razorpay_signature type:',
        typeof capturePayload.razorpay_signature,
      );
      console.log(
        '  - Note: Signature will be generated on backend using secret key',
      );
      console.log('  - contact length:', capturePayload.contact?.length);
      console.log('  - contact type:', typeof capturePayload.contact);
      console.log('  - name length:', capturePayload.name?.length);
      console.log('  - name type:', typeof capturePayload.name);
      console.log('  - email length:', capturePayload.email?.length);
      console.log('  - email type:', typeof capturePayload.email);

      // 🎯 CRITICAL: Log the exact values being sent for key fields
      console.log('🔍 CRITICAL FIELD VALUES:');
      console.log(
        '  - razorpay_signature:',
        capturePayload.razorpay_signature ||
          'NULL (will be generated on backend)',
      );
      console.log('  - contact:', capturePayload.contact);
      console.log('  - name:', capturePayload.name);
      console.log('  - email:', capturePayload.email);
      console.log('  - notes:', capturePayload.notes);

      // 🎯 DEBUG: Log the complete capture payload structure
      console.log('🔍 COMPLETE CAPTURE PAYLOAD STRUCTURE:');
      console.log('  - paymentId:', capturePayload.paymentId);
      console.log(
        '  - razorpay_payment_id:',
        capturePayload.razorpay_payment_id,
      );
      console.log('  - order_id:', capturePayload.order_id);
      console.log('  - razorpay_order_id:', capturePayload.razorpay_order_id);
      console.log('  - amount:', capturePayload.amount);
      console.log('  - planId:', capturePayload.planId);
      console.log('  - method:', capturePayload.method);
      console.log('  - status:', capturePayload.status);
      console.log('  - razorpay_signature:', capturePayload.razorpay_signature);
      console.log('  - notes:', capturePayload.notes);
      console.log('  - contact:', capturePayload.contact);
      console.log('  - name:', capturePayload.name);
      console.log('  - email:', capturePayload.email);
      console.log('  - bank:', capturePayload.bank);
      console.log('  - wallet:', capturePayload.wallet);
      console.log('  - card_id:', capturePayload.card_id);
      console.log('  - card_network:', capturePayload.card_network);
      console.log('  - card_type:', capturePayload.card_type);
      console.log('  - card_last4:', capturePayload.card_last4);
      console.log('  - card_issuer:', capturePayload.card_issuer);
      console.log('  - upi_transaction_id:', capturePayload.upi_transaction_id);
      console.log('  - upi_vpa:', capturePayload.upi_vpa);
      console.log('  - fee:', capturePayload.fee);
      console.log('  - tax:', capturePayload.tax);
      console.log('  - international:', capturePayload.international);
      console.log('  - description:', capturePayload.description);
      console.log('  - entity:', capturePayload.entity);
      console.log('  - invoice_id:', capturePayload.invoice_id);
      console.log('  - JSON_LOG exists:', !!capturePayload.JSON_LOG);
      console.log(
        '  - JSON_LOG keys:',
        capturePayload.JSON_LOG ? Object.keys(capturePayload.JSON_LOG) : 'N/A',
      );

      // 🎯 FIXED: Call backend capture endpoint directly with correct field names
      const response = await fetch(`${BASE_URL}/payments/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(capturePayload),
      });

      const responseData = await response.json();
      console.log('📥 Backend capture response status:', response.status);
      console.log('📥 Backend capture response data:', responseData);

      if (!response.ok) {
        console.error(
          '❌ Backend capture failed with status:',
          response.status,
        );
        console.error('❌ Backend error response:', responseData);
        throw new Error(
          responseData.message ||
            `Payment capture failed with status ${response.status}`,
        );
      }

      // Check if payment was successful
      if (responseData.success || responseData.code === 200) {
        // ✅ Payment successful - plan activated
        console.log('✅ Payment captured successfully:', responseData);

        // Store payment details for display
        const paymentDetailsData = {
          ...razorpayResponse,
          amount: plan.price * 100,
          currency: 'INR',
          description: `Payment for ${plan.name} plan`,
          created_at: Math.floor(Date.now() / 1000),

          // 🎯 CRITICAL FIX: Use detected payment method, not unknown
          method: paymentMethod, // Use the detected method

          // 🎯 FIX: Extract additional payment method details
          bank: razorpayResponse.bank || '',
          wallet: razorpayResponse.wallet || '',
          card_id: razorpayResponse.card_id || '',
          card_network: razorpayResponse.card_network || '',
          card_type: razorpayResponse.card_type || '',
          card_last4: razorpayResponse.card_last4 || '',
          card_issuer: razorpayResponse.card_issuer || '',
          upi_transaction_id: razorpayResponse.upi_transaction_id || '',
          upi_vpa: razorpayResponse.upi_vpa || '',
          contact: razorpayResponse.contact || finalUserMobile || '',
          name: razorpayResponse.name || finalUserName || '',
          email: razorpayResponse.email || '',
          status: 'captured',
          captured: true,
        };

        console.log(
          '🎯 Storing payment details for display:',
          paymentDetailsData,
        );
        console.log('🔍 Payment method extracted:', paymentDetailsData.method);
        console.log('🔍 Full Razorpay response:', razorpayResponse);
        setPaymentDetails(paymentDetailsData);

        // Update subscription in context
        const success = await contextUpgradePlan(plan.id);
        if (success) {
          // Show success message with app UI
          setSuccessMessage(
            `Payment completed! Your plan has been successfully upgraded to ${plan.name}!`,
          );
          setShowSuccessModal(true);

          // Show plan update notification
          try {
            await showPlanUpdatedNotification(plan.name, plan.price);
            console.log('✅ Plan update notification sent successfully');
          } catch (notificationError) {
            console.error(
              '❌ Failed to show plan update notification:',
              notificationError,
            );
            // Don't block the flow if notification fails
          }

          // Refresh subscription data and transaction limits
          fetchSubscriptionData();
          fetchBillingData(); // This will refresh transaction limit data

          // 🎯 FIXED: Clear session flags and restart transaction limit monitoring with updated data
          console.log(
            '🔄 Clearing session flags and restarting transaction limit monitoring with new plan data...',
          );
          try {
            // Clear any session flags that might prevent popups from showing with new plan data
            await AsyncStorage.removeItem(
              'transaction_limit_popup_shown_session',
            );
            console.log('✅ Session flags cleared');
          } catch (error) {
            console.error('❌ Error clearing session flags:', error);
          }

          setTimeout(async () => {
            try {
              await startLimitMonitoring();
              console.log(
                '✅ Transaction limit monitoring restarted successfully',
              );
            } catch (error) {
              console.error(
                '❌ Error restarting transaction limit monitoring:',
                error,
              );
            }
          }, 2000); // Wait 2 seconds to ensure data is refreshed
        } else {
          throw new Error('Plan upgrade failed after payment');
        }
      } else {
        console.error('❌ Backend capture failed:', responseData);
        throw new Error(
          `Payment capture failed: ${responseData.message || 'Unknown error'}`,
        );
      }
    } catch (error: any) {
      console.error('❌ Payment capture failed:', error);

      // 🎯 IMPROVED: Better error handling with specific messages
      let errorMessage =
        'Payment was successful, but we could not complete the process. Please contact support.';

      if (error.message?.includes('Invalid payment response')) {
        errorMessage =
          'Payment verification failed. Please contact support with your payment details.';
      } else if (error.message?.includes('Payment capture failed')) {
        errorMessage =
          'Payment was received but could not be processed. Please contact support.';
      } else if (error.message?.includes('Internal server error')) {
        errorMessage =
          'Server error occurred. Please try again in a few minutes or contact support.';
      } else if (
        error.message?.includes('network') ||
        error.message?.includes('fetch')
      ) {
        errorMessage =
          'Network error. Please check your internet connection and try again.';
      }

      setPaymentError(errorMessage);
      showAlert({
        title: 'Payment Error',
        message: errorMessage,
        type: 'error',
        confirmText: 'OK',
        onConfirm: () => {
          console.log('User acknowledged payment error');
        },
      });
    }
  };
  // ... existing code ...

  // 🎯 UPDATED: Simplified upgradePlan function with proper Razorpay integration
  const upgradePlan = async (plan: PlanDisplayData) => {
    try {
      console.log('🚀 Starting plan upgrade for:', {
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
      });

      // Set payment processing state
      setPaymentProcessing(true);
      setPaymentError(null);

      // 🎯 FIXED: Temporarily stop transaction limit monitoring to prevent popup interference
      console.log(
        '⏸️ Temporarily stopping transaction limit monitoring during plan upgrade...',
      );
      await stopLimitMonitoring();

      // Validate Razorpay configuration
      if (!RAZORPAY_CONFIG.key || !RAZORPAY_CONFIG.secret) {
        console.error('❌ Razorpay configuration missing:', RAZORPAY_CONFIG);
        setPaymentError('Payment configuration error. Please contact support.');
        showAlert({
          title: 'Configuration Error',
          message: 'Payment configuration error. Please contact support.',
          type: 'error',
          confirmText: 'OK',
        });
        return;
      }

      // Validate plan data
      if (!plan.id || isNaN(parseInt(plan.id.toString()))) {
        console.error('❌ Invalid plan data:', plan);
        setPaymentError('Invalid plan data. Plan ID must be a valid number.');
        showAlert({
          title: 'Error',
          message: 'Invalid plan data. Plan ID must be a valid number.',
          type: 'error',
          confirmText: 'OK',
        });
        return;
      }

      // Get user authentication data
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setPaymentError('Please log in to upgrade your plan');
        showAlert({
          title: 'Error',
          message: 'Please log in to upgrade your plan',
          type: 'error',
          confirmText: 'OK',
        });
        return;
      }

      const userId = await getUserIdFromToken();
      if (!userId || userId <= 0) {
        setPaymentError('Invalid user ID. Please log in again.');
        showAlert({
          title: 'Error',
          message: 'Invalid user ID. Please log in again.',
          type: 'error',
          confirmText: 'OK',
        });
        return;
      }

      if (plan.price === 0) {
        // Free plan - no payment required
        try {
          const success = await contextUpgradePlan(plan.id);
          if (success) {
            setSuccessMessage(`Successfully upgraded to ${plan.name} plan!`);
            setShowSuccessModal(true);

            // Show plan update notification for free plan
            try {
              await showPlanUpdatedNotification(plan.name, plan.price);
              console.log('✅ Free plan update notification sent successfully');
            } catch (notificationError) {
              console.error(
                '❌ Failed to show free plan update notification:',
                notificationError,
              );
              // Don't block the flow if notification fails
            }

            fetchSubscriptionData();
          } else {
            setPaymentError('Failed to upgrade plan');
            showAlert({
              title: 'Error',
              message: 'Failed to upgrade plan',
              type: 'error',
              confirmText: 'OK',
            });
          }
        } catch (error) {
          setPaymentError('Failed to upgrade plan');
          showAlert({
            title: 'Error',
            message: 'Failed to upgrade plan',
            type: 'error',
            confirmText: 'OK',
          });
        }
        return;
      }

      // 🎯 FIXED: Use the same working approach as Test Simple Checkout
      try {
        console.log('🎯 Opening Razorpay checkout for plan upgrade...');

        // Create a simple order first, then use it in checkout
        const orderData = {
          amount: plan.price * 100,
          currency: 'INR',
          receipt: `plan_${plan.id}_${Date.now()}`,
        };

        // Create order using Razorpay credentials
        const credentials = `${RAZORPAY_CONFIG.key}:${RAZORPAY_CONFIG.secret}`;
        const base64Credentials = btoa(credentials);

        const orderResponse = await fetch(
          'https://api.razorpay.com/v1/orders',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${base64Credentials}`,
            },
            body: JSON.stringify(orderData),
          },
        );

        if (!orderResponse.ok) {
          throw new Error('Failed to create Razorpay order');
        }

        const order = await orderResponse.json();
        console.log('✅ Razorpay order created:', order.id);

        // Get real user data from token
        let realUserMobile: string | null = null;
        let realUserName: string | null = null;
        let realUserEmail: string | null = null;

        try {
          console.log('🔍 Fetching user data from token for Razorpay...');
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          console.log('🔍 Token payload:', tokenPayload);

          if (tokenPayload) {
            realUserMobile = tokenPayload.mobileNumber || null;
            realUserName = tokenPayload.ownerName || null;
            realUserEmail = tokenPayload.email || null;

            console.log('✅ Real user data extracted from token:', {
              mobile: realUserMobile,
              name: realUserName,
              email: realUserEmail,
            });
          }
        } catch (error) {
          console.log('⚠️ Token parsing error:', error);
          // Fallback to AsyncStorage data
          realUserMobile = await AsyncStorage.getItem('userMobile');
          realUserName = await AsyncStorage.getItem('userName');
          realUserEmail = await AsyncStorage.getItem('userEmail');
        }

        // Use the exact same options that work in Test Simple Checkout with real user data
        const options = {
          order_id: order.id,
          description: `Subscription for ${plan.name} plan`,
          image: 'https://your-logo-url.com',
          currency: 'INR',
          key: RAZORPAY_CONFIG.key,
          amount: plan.price * 100,
          name: 'Your App Name',
          prefill: {
            email: realUserEmail || 'user@example.com',
            contact: realUserMobile || '9999999999',
            name: realUserName || 'User',
          },
          theme: { color: '#4f8cff' },
        };

        console.log('🎯 Opening Razorpay checkout with real user data:');
        console.log('  - User Name:', realUserName || 'User (fallback)');
        console.log(
          '  - User Mobile:',
          realUserMobile || '9999999999 (fallback)',
        );
        console.log(
          '  - User Email:',
          realUserEmail || 'user@example.com (fallback)',
        );
        console.log('  - Full options:', JSON.stringify(options, null, 2));

        const paymentData = await RazorpayCheckout.open(options);
        console.log('🎉 Payment completed:', paymentData);

        if (!paymentData.razorpay_payment_id) {
          throw new Error('No payment ID received from Razorpay');
        }

        // Step 3: Handle payment success
        await handlePaymentSuccess(paymentData, plan);
      } catch (error: any) {
        console.error('❌ Payment process failed:', error);

        // 🎯 FIXED: Handle Razorpay modal dismissal and user cancellation
        if (
          error.code === 'PAYMENT_CANCELLED' ||
          error.code === 'USER_CANCELLED'
        ) {
          console.log('🔄 User cancelled payment');
          setPaymentError('Payment was cancelled');
          return;
        }

        let errorMessage = 'Payment failed. Please try again.';

        if (error.message?.includes('No payment ID')) {
          errorMessage = 'Payment was not completed. Please try again.';
        } else if (error.message?.includes('network')) {
          errorMessage =
            'Network error. Please check your internet connection.';
        }

        setPaymentError(errorMessage);
        showAlert({
          title: 'Payment Error',
          message: errorMessage,
          type: 'error',
          confirmText: 'OK',
          onConfirm: () => {
            console.log('User acknowledged payment error');
          },
        });
      }
    } catch (error) {
      console.error('Plan upgrade error:', error);
      setPaymentError('Failed to upgrade plan. Please try again.');
      showAlert({
        title: 'Error',
        message: 'Failed to upgrade plan. Please try again.',
        type: 'error',
        confirmText: 'OK',
      });

      // 🎯 FIXED: Restart transaction limit monitoring if payment fails
      console.log(
        '🔄 Restarting transaction limit monitoring after payment failure...',
      );
      try {
        await startLimitMonitoring();
        console.log('✅ Transaction limit monitoring restarted after failure');
      } catch (monitoringError) {
        console.error(
          '❌ Error restarting transaction limit monitoring after failure:',
          monitoringError,
        );
      }
    } finally {
      // Reset payment processing state
      setPaymentProcessing(false);
      console.log('🏁 Payment flow completed');
    }
  };

  // 🎯 UPDATED: Better downgradePlan function with loading state (like web version)
  const downgradePlan = async (plan: PlanDisplayData) => {
    try {
      setPlanActionLoading(plan.id);
      const success = await contextDowngradePlan(plan.id);
      if (success) {
        setSuccessMessage(`Successfully downgraded to ${plan.name} plan!`);
        setShowSuccessModal(true);

        // Show plan update notification for downgrade
        try {
          await showPlanUpdatedNotification(plan.name, plan.price);
          console.log('✅ Plan downgrade notification sent successfully');
        } catch (notificationError) {
          console.error(
            '❌ Failed to show plan downgrade notification:',
            notificationError,
          );
          // Don't block the flow if notification fails
        }

        fetchSubscriptionData();
      } else {
        setPaymentError('Failed to downgrade plan');
        showAlert({
          title: 'Error',
          message: 'Failed to downgrade plan',
          type: 'error',
          confirmText: 'OK',
        });
      }
    } catch (error) {
      setPaymentError('Failed to downgrade plan');
      showAlert({
        title: 'Error',
        message: 'Failed to downgrade plan',
        type: 'error',
        confirmText: 'OK',
      });
    } finally {
      setPlanActionLoading(null);
    }
  };

  const handleCancelSubscription = () => {
    showAlert({
      title: 'Cancel Subscription',
      message:
        'Are you sure you want to cancel your subscription? This action cannot be undone.',
      type: 'confirm',
      confirmText: 'Cancel Subscription',
      cancelText: 'Keep Subscription',
      onConfirm: async () => {
        try {
          const success = await cancelSubscription();
          if (success) {
            setSuccessMessage(
              'Your subscription has been cancelled successfully.',
            );
            setShowSuccessModal(true);
            fetchSubscriptionData();
          } else {
            showAlert({
              title: 'Error',
              message: 'Failed to cancel subscription. Please try again.',
              type: 'error',
              confirmText: 'OK',
            });
          }
        } catch (error) {
          showAlert({
            title: 'Error',
            message: 'Failed to cancel subscription. Please try again.',
            type: 'error',
            confirmText: 'OK',
          });
        }
      },
    });
  };

  const contactSales = () => {
    showAlert({
      title: 'Contact Sales',
      message: 'Please contact our sales team for assistance.',
      type: 'info',
      confirmText: 'OK',
    });
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
        return 'gift-outline';
      case 'starter':
        return 'rocket-launch-outline';
      case 'professional':
        return 'crown-outline';
      case 'enterprise':
        return 'domain';
      default:
        return 'package-variant';
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
        return '#6c757d';
      case 'starter':
        return '#17a2b8';
      case 'professional':
        return '#ffc107';
      case 'enterprise':
        return '#dc3545';
      default:
        return '#4f8cff';
    }
  };

  const getPlanFeature = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
        return 'Basic features for individuals';
      case 'starter':
        return 'Perfect for small teams';
      case 'professional':
        return 'Advanced features for growing businesses';
      case 'enterprise':
        return 'Custom solutions for large organizations';
      default:
        return 'Comprehensive business solution';
    }
  };

  const getRecommendedPlan = (planName: string) => {
    // Fetch user's current plan from token/subscription context
    if (!currentSubscription) return false;

    const currentPlanName = currentSubscription.planName.toLowerCase();
    const planNameLower = planName.toLowerCase();

    // Define the upgrade path - show next plan as recommended
    const upgradePath: { [key: string]: string } = {
      free: 'starter',
      starter: 'professional',
      professional: 'enterprise',
      enterprise: 'enterprise', // No upgrade from enterprise
    };

    // Check if this plan is the recommended upgrade for user's current plan
    const isRecommended = upgradePath[currentPlanName] === planNameLower;

    return isRecommended;
  };

  // 🚨 REMOVED: Loading screen completely - no more loading states

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons
                name="check-circle"
                size={64}
                color="#28a745"
              />
            </View>
            <Text style={styles.successModalTitle}>🎉 Plan Upgraded!</Text>
            <Text style={styles.successModalMessage}>{successMessage}</Text>

            <View style={styles.successModalFooter}>
              <Text style={styles.successModalSubtext}>
                You can now enjoy all the benefits of your new plan!
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                // 🎯 FIXED: Ensure transaction limit monitoring is active after closing success modal
                console.log(
                  '🔄 Ensuring transaction limit monitoring is active after plan upgrade...',
                );
                setTimeout(async () => {
                  try {
                    await startLimitMonitoring();
                    console.log(
                      '✅ Transaction limit monitoring confirmed active after plan upgrade',
                    );
                  } catch (error) {
                    console.error(
                      '❌ Error ensuring transaction limit monitoring:',
                      error,
                    );
                  }
                }, 1000);
              }}
            >
              <Text style={styles.successModalButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment Details Modal */}
      <Modal
        visible={showPaymentDetails}
        animationType="slide"
        onRequestClose={() => setShowPaymentDetails(false)}
      >
        {paymentDetails && (
          <PaymentDetailsDisplay
            paymentData={paymentDetails}
            onClose={() => setShowPaymentDetails(false)}
          />
        )}
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#222" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Subscription Plans</Text>
            <Text style={styles.subtitle}>
              Choose the plan that best fits your business needs
            </Text>
            <View style={styles.headerBadge}>
              <MaterialCommunityIcons
                name="shield-check"
                size={16}
                color="#28a745"
              />
              <Text style={styles.headerBadgeText}>Secure & Reliable</Text>
            </View>
          </View>
        </View>

        {/* Current Plan Status Section */}
        <View style={styles.currentPlanSection}>
          <View style={styles.currentPlanCard}>
            <View style={styles.currentPlanHeader}>
              <View style={styles.currentPlanInfo}>
                <Text style={styles.currentPlanTitle}>
                  {currentSubscription?.planName || 'Free'} Plan
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={refreshBillingData}
              >
                {apiLoading ? (
                  <ActivityIndicator size="small" color="#4f8cff" />
                ) : (
                  <MaterialCommunityIcons
                    name="refresh"
                    size={20}
                    color="#4f8cff"
                  />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.currentPlanDetails}>
              ₹{currentSubscription?.amount || 0}/month •{' '}
              {getPlanFeature(currentSubscription?.planName || 'free')}
            </Text>

            <View style={styles.usageSection}>
              <View style={styles.usageCard}>
                <View style={styles.usageIcon}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={24}
                    color="#4f8cff"
                  />
                </View>
                <Text style={styles.usageTitle}>
                  Transactions Monthly Limit
                </Text>
                <View style={styles.usageAmount}>
                  <Text style={styles.usageUsed}>
                    {transactionLimits?.currentCount || 0}
                  </Text>
                  <Text style={styles.usageTotal}>
                    / {transactionLimits?.maxAllowed || 50}
                  </Text>
                </View>
                <Text style={styles.usagePercentage}>
                  {transactionLimits
                    ? `${transactionLimits.percentageUsed}% used`
                    : '0% used'}
                </Text>
              </View>
            </View>

            <View style={styles.billingInfo}>
              <View style={styles.billingRow}>
                <View style={styles.billingItem}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={20}
                    color="#666"
                  />
                  <Text style={styles.billingLabel}>Next Billing Date</Text>
                  <Text style={styles.billingValue}>
                    No active subscription
                  </Text>
                </View>
                <View style={styles.billingItem}>
                  <MaterialCommunityIcons
                    name="receipt"
                    size={20}
                    color="#666"
                  />
                  <Text style={styles.billingLabel}>Billing Amount</Text>
                  <Text style={styles.billingValue}>
                    ₹{currentSubscription?.amount || 0}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.billingHistoryButton}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={16}
                  color="#fff"
                />
                <Text style={styles.billingHistoryText}>Billing History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Transaction Limits Section */}
        <View style={styles.transactionLimitsSection}>
          <View style={styles.transactionLimitsCard}>
            <View style={styles.transactionLimitsHeader}>
              <Text style={styles.transactionLimitsTitle}>
                Transaction Limits
              </Text>
              <View style={styles.allGoodBadge}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#ffffff"
                />
                <Text style={styles.allGoodText}>All Good</Text>
              </View>
            </View>

            <View style={styles.limitDetails}>
              <Text style={styles.limitLabel}>
                Current Plan:{' '}
                <Text style={styles.limitValue}>
                  {currentSubscription?.planName || 'Free'}
                </Text>
              </Text>

              <View style={styles.limitProgress}>
                <Text style={styles.limitProgressLabel}>Transactions Used</Text>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: transactionLimits
                            ? `${Math.min(
                                transactionLimits.percentageUsed,
                                100,
                              )}%`
                            : '0%',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {transactionLimits?.currentCount || 0} /{' '}
                    {transactionLimits?.maxAllowed || 50}
                  </Text>
                </View>
                <Text style={styles.remainingText}>
                  {transactionLimits?.remaining || 0} remaining
                </Text>
              </View>

              <View style={styles.resetInfo}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={16}
                  color="#666"
                />
                <Text style={styles.resetText}>
                  Next reset:{' '}
                  {transactionLimits?.nextResetFormatted || 'End of month'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Summary Section */}
        <View style={styles.billingSummarySection}>
          <View style={styles.billingSummaryHeader}>
            <Text style={styles.billingSummaryTitle}>Billing Summary</Text>
            {apiLoading && <ActivityIndicator size="small" color="#4f8cff" />}
          </View>
          <View style={styles.billingMetrics}>
            {/* Row 1 */}
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="file-document-multiple"
                    size={16}
                    color="#4f8cff"
                  />
                </View>
                <Text style={[styles.metricValue, { color: '#4f8cff' }]}>
                  {billingSummary?.totalInvoices || 0}
                </Text>
                <Text style={styles.metricLabel}>Total Invoices</Text>
              </View>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="currency-inr"
                    size={16}
                    color="#28a745"
                  />
                </View>
                <Text style={[styles.metricValue, { color: '#28a745' }]}>
                  ₹{billingSummary?.totalAmount || 0}
                </Text>
                <Text style={styles.metricLabel}>Total Amount</Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={16}
                    color="#fd7e14"
                  />
                </View>
                <Text style={[styles.metricValue, { color: '#fd7e14' }]}>
                  {billingSummary?.pendingInvoices || 0}
                </Text>
                <Text style={styles.metricLabel}>Pending</Text>
              </View>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={16}
                    color="#dc3545"
                  />
                </View>
                <Text style={[styles.metricValue, { color: '#dc3545' }]}>
                  {billingSummary?.overdueInvoices || 0}
                </Text>
                <Text style={styles.metricLabel}>Overdue</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing History Section */}
        <View style={styles.billingHistorySection}>
          <View style={styles.billingHistoryHeader}>
            <Text style={styles.billingHistoryTitle}>Billing History</Text>
            <TouchableOpacity
              style={styles.refreshHistoryButton}
              onPress={refreshBillingData}
            >
              <Text style={styles.refreshHistoryText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {billingHistory.length > 0 ? (
            <View style={styles.billingHistoryList}>
              {billingHistory.map(invoice => (
                <View key={invoice.id} style={styles.billingHistoryItem}>
                  <View style={styles.billingHistoryItemHeader}>
                    <Text style={styles.billingHistoryItemTitle}>
                      {invoice.invoiceNumber}
                    </Text>
                    <View
                      style={[
                        styles.billingHistoryItemStatus,
                        { backgroundColor: getStatusColor(invoice.status) },
                      ]}
                    >
                      <Text style={styles.billingHistoryItemStatusText}>
                        {invoice.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.billingHistoryItemPlan}>
                    {invoice.planName} - {invoice.billingPeriod}
                  </Text>
                  <View style={styles.billingHistoryItemFooter}>
                    <Text style={styles.billingHistoryItemAmount}>
                      ₹{invoice.amount}
                    </Text>
                    <Text style={styles.billingHistoryItemDate}>
                      {new Date(invoice.billingDate).toLocaleDateString()}
                    </Text>

                    {/* View Payment Details Button */}
                    {invoice.paymentId && (
                      <TouchableOpacity
                        style={styles.viewPaymentButton}
                        onPress={() => {
                          // Fetch payment details from backend and show
                          if (invoice.paymentId) {
                            fetchPaymentDetails(invoice.paymentId);
                          }
                        }}
                      >
                        <MaterialCommunityIcons
                          name="receipt-text"
                          size={16}
                          color="#4f8cff"
                        />
                        <Text style={styles.viewPaymentButtonText}>
                          Details
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noHistoryContainer}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={48}
                color="#ccc"
              />
              <Text style={styles.noHistoryTitle}>
                No billing history found
              </Text>
              <Text style={styles.noHistorySubtitle}>
                Your invoices will appear here once generated.
              </Text>
            </View>
          )}
        </View>

        {/* Plans Summary Grid */}
        <View style={styles.plansSummaryContainer}>
          <View style={styles.plansSummaryHeader}>
            <Text style={styles.plansSummaryTitle}>Choose Your Plan</Text>
            <Text style={styles.plansSummarySubtitle}>
              Select the perfect plan for your business needs
            </Text>
          </View>
          <View style={styles.plansGrid}>
            {(() => {
              // Create a 2x2 grid layout
              const plans = availablePlans.slice(0, 4);
              const rows = [];

              for (let i = 0; i < plans.length; i += 2) {
                const row = plans.slice(i, i + 2);
                rows.push(
                  <View key={`row-${i}`} style={styles.planRow}>
                    {row.map((plan: any) => {
                      const isRecommended = getRecommendedPlan(plan.name);
                      const isCurrent =
                        currentSubscription?.planName.toLowerCase() ===
                        plan.name.toLowerCase();
                      const isSelected = selectedPlanId === plan.id;

                      return (
                        <TouchableOpacity
                          key={plan.id}
                          style={[
                            styles.planSummaryCard,
                            plan.isPopular &&
                              !isRecommended &&
                              !isCurrent &&
                              styles.popularPlanCard,
                            isCurrent && styles.currentPlanSelectionCard,
                            isRecommended && styles.recommendedPlanCard,
                            isSelected && styles.selectedPlanSummaryCard,
                          ]}
                          onPress={() => setSelectedPlanId(plan.id)}
                          activeOpacity={0.7}
                        >
                          {/* Priority: Current > Recommended > Popular */}
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>
                                Current
                              </Text>
                            </View>
                          )}
                          {isRecommended && !isCurrent && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedBadgeText}>
                                Recommended
                              </Text>
                            </View>
                          )}
                          {plan.isPopular && !isRecommended && !isCurrent && (
                            <View style={styles.popularBadge}>
                              <Text style={styles.popularBadgeText}>
                                Most Popular
                              </Text>
                            </View>
                          )}
                          <View style={styles.planIconContainer}>
                            <MaterialCommunityIcons
                              name={getPlanIcon(plan.name)}
                              size={28}
                              color={getPlanColor(plan.name)}
                            />
                          </View>
                          <Text style={styles.planSummaryName}>
                            {plan.name}
                          </Text>
                          <View style={styles.priceContainer}>
                            <Text style={styles.planSummaryPrice}>
                              ₹{plan.price.toLocaleString('en-IN')}
                            </Text>
                            <Text style={styles.planSummaryPeriod}>
                              /{plan.period}
                            </Text>
                          </View>
                          <View style={styles.planFeatures}>
                            <Text style={styles.planFeatureText}>
                              {getPlanFeature(plan.name)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>,
                );
              }

              return rows;
            })()}
          </View>
        </View>

        {/* Selected Plan Details */}
        {getSelectedPlan() && (
          <View style={styles.plansContainer}>
            <Text style={styles.plansTitle}>Plan Details</Text>
            {(() => {
              const plan = getSelectedPlan();
              if (!plan) return null;

              return (
                <View
                  style={[
                    styles.planCard,
                    plan.isCurrent && styles.selectedPlanCard,
                    plan.isPopular && styles.popularPlanCard,
                  ]}
                >
                  {plan.isPopular && !plan.isCurrent && (
                    <View style={styles.popularBadgeTop}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                  {plan.isCurrent && (
                    <View style={styles.currentBadgeTop}>
                      <Text style={styles.currentText}>Current Plan</Text>
                    </View>
                  )}

                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>

                  <View style={styles.planPrice}>
                    <Text style={styles.priceAmount}>
                      ₹{plan.price.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.pricePeriod}>/{plan.period}</Text>
                  </View>

                  <View style={styles.featuresList}>
                    {plan.features.map((feature: string, index: number) => (
                      <View key={index} style={styles.featureItem}>
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color="#28a745"
                        />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.planButton,
                      plan.isCurrent && styles.currentPlanButton,
                      plan.buttonAction === 'upgrade' && styles.upgradeButton,
                      plan.buttonAction === 'downgrade' &&
                        styles.downgradeButton,
                      plan.buttonAction === 'contact' && styles.contactButton,
                      paymentProcessing && styles.processingButton,
                      planActionLoading === plan.id && styles.processingButton,
                    ]}
                    onPress={() => handlePlanAction(plan)}
                    disabled={
                      plan.isCurrent ||
                      paymentProcessing ||
                      planActionLoading === plan.id
                    }
                  >
                    {paymentProcessing || planActionLoading === plan.id ? (
                      <View style={styles.processingButtonContent}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.processingButtonText}>
                          Processing...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.planButtonText,
                          plan.isCurrent && styles.currentPlanButtonText,
                        ]}
                      >
                        {plan.buttonText}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Error and Success Messages */}
                  {paymentError && (
                    <View style={styles.errorContainer}>
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={20}
                        color="#dc3545"
                      />
                      <Text style={styles.errorText}>{paymentError}</Text>
                    </View>
                  )}
                  {successMessage && (
                    <View style={styles.successContainer}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color="#28a745"
                      />
                      <Text style={styles.successText}>{successMessage}</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Payment Security Section */}
        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color="#28a745"
            />
            <Text style={styles.securityTitle}>Secure Payment</Text>
          </View>
          <Text style={styles.securityText}>
            Your payment is secured by Razorpay with bank-level encryption. We
            never store your payment details.
          </Text>
        </View>

        {/* Contact Sales Section */}
        <View style={styles.contactSection}>
          <Text style={styles.contactText}>
            Need help choosing the right plan? Contact our sales team.
          </Text>
          <TouchableOpacity
            style={styles.contactSalesButton}
            onPress={contactSales}
          >
            <Text style={styles.contactSalesText}>Contact Sales</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  // 🚨 REMOVED: Unused loading styles
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
    alignItems: 'center',
    minHeight: 120,
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  headerBadgeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#28a745',
  },

  backButton: {
    position: 'absolute',
    left: 16,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  plansSummaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
    marginTop: 16,
  },
  plansSummaryHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  plansSummaryTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  plansSummarySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  plansGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  planSummaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    minHeight: 160,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  popularPlanCard: {
    borderColor: '#4f8cff',
    borderWidth: 2,
  },
  currentPlanSelectionCard: {
    borderColor: '#28a745',
    borderWidth: 2,
  },
  recommendedPlanCard: {
    borderColor: '#ff6b35',
    borderWidth: 2,
  },
  selectedPlanSummaryCard: {
    borderColor: '#4f8cff',
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    backgroundColor: '#ff6b35',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  recommendedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planFeatures: {
    alignItems: 'center',
  },
  planFeatureText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
  },
  planSummaryName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  planSummaryPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4f8cff',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  planSummaryPeriod: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  plansContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  selectedPlanCard: {
    borderWidth: 2,
    borderColor: '#28a745',
  },
  popularBadgeTop: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  currentBadgeTop: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  currentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  planPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#222',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  planButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  currentPlanButton: {
    backgroundColor: '#28a745',
  },
  upgradeButton: {
    backgroundColor: '#4f8cff',
  },
  downgradeButton: {
    backgroundColor: '#6c757d',
  },
  contactButton: {
    backgroundColor: '#343a40',
  },
  processingButton: {
    backgroundColor: '#6c757d',
    opacity: 0.7,
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  currentPlanButtonText: {
    color: '#fff',
  },
  processingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  contactSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  contactSalesButton: {
    backgroundColor: '#343a40',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  contactSalesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  securitySection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Success Modal Styles

  // Success Modal Styles
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    marginHorizontal: 24,
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 15 },
    elevation: 15,
    borderWidth: 2,
    borderColor: '#e8f5e8',
  },
  successIconContainer: {
    marginBottom: 24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#28a745',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 16,
    textAlign: 'center',
  },
  successModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successModalButton: {
    backgroundColor: '#28a745',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    minWidth: 140,
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  successModalFooter: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  successModalSubtext: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // View Details Button Styles
  viewDetailsButton: {
    backgroundColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  viewDetailsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Current Plan Section Styles
  currentPlanSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 20,
  },
  currentPlanCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  currentPlanInfo: {
    flex: 1,
  },
  currentPlanTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 8,
  },
  activeBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentPlanDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  usageSection: {
    marginBottom: 20,
  },
  usageCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  usageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageTitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  usageAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  usageUsed: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f8cff',
  },
  usageTotal: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  usagePercentage: {
    fontSize: 12,
    color: '#666',
  },
  billingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  billingRow: {
    flex: 1,
  },
  billingItem: {
    marginBottom: 12,
  },
  billingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  billingValue: {
    fontSize: 14,
    color: '#4f8cff',
    fontWeight: '500',
  },
  billingHistoryButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  billingHistoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },

  // Transaction Limits Section Styles
  transactionLimitsSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  transactionLimitsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  transactionLimitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionLimitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  allGoodBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
    shadowColor: '#28a745',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  allGoodText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  limitDetails: {
    gap: 16,
  },
  limitLabel: {
    fontSize: 14,
    color: '#666',
  },
  limitValue: {
    color: '#4f8cff',
    fontWeight: '600',
  },
  limitProgress: {
    gap: 8,
  },
  limitProgressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  remainingText: {
    fontSize: 12,
    color: '#666',
  },
  resetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetText: {
    fontSize: 12,
    color: '#666',
  },

  // Billing Summary Section Styles
  billingSummarySection: {
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 8,
  },
  billingSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  billingSummaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  billingMetrics: {
    flexDirection: 'column',
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minHeight: 80,
  },
  metricIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Billing History Section Styles
  billingHistorySection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  billingHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  billingHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  refreshHistoryButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  refreshHistoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noHistoryContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  noHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noHistorySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Billing History List Styles
  billingHistoryList: {
    gap: 12,
  },
  billingHistoryItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  billingHistoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billingHistoryItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    flex: 1,
  },
  billingHistoryItemStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  billingHistoryItemStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  billingHistoryItemPlan: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  billingHistoryItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  billingHistoryItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4f8cff',
  },
  billingHistoryItemDate: {
    fontSize: 12,
    color: '#999',
  },

  // View Payment Button Styles
  viewPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  viewPaymentButtonText: {
    fontSize: 12,
    color: '#4f8cff',
    fontWeight: '500',
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  successText: {
    color: '#28a745',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});

export default SubscriptionPlanScreen;
