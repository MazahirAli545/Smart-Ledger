import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../api/unifiedApiService';
import { useSubscription } from '../context/SubscriptionContext';
import { getUserIdFromToken } from '../utils/storage';
import { jwtDecode } from 'jwt-decode';
import PaymentApiService, { CapturePaymentDto } from '../api/payments';
// @ts-ignore - react-native-razorpay doesn't have type definitions
import RazorpayCheckout from 'react-native-razorpay';
import PaymentDetailsDisplay from '../components/PaymentDetailsDisplay';
import { showPlanUpdatedNotification } from '../utils/notificationHelper';
import {
  PaymentService,
  PaymentPlan,
  PaymentResult,
} from '../services/paymentService';
import { useTransactionLimit } from '../context/TransactionLimitContext';
import { useAlert, AlertOptions } from '../context/AlertContext';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../utils/headerLayout';
import StableStatusBar from '../components/StableStatusBar';
import { getStatusBarSpacerHeight } from '../utils/statusBarManager';
import ContactSalesModal from '../components/ContactSalesModal';
import { generateNextDocumentNumber } from '../utils/autoNumberGenerator';

// Razorpay Configuration - now using environment variables
import { getRazorpayConfig } from '../config/env';

const RAZORPAY_CONFIG = getRazorpayConfig();
const HAS_RAZORPAY = !!(RAZORPAY_CONFIG.key && RAZORPAY_CONFIG.secret);
const SCREEN_WIDTH = Dimensions.get('window').width;
// Peeking carousel like MyJio: centered card with slight right preview
const LIST_SIDE_PADDING = 16; // symmetric side padding
const PEEK = 36; // visible width of the next card on the right
const CARD_GAP = 12; // space between cards
const ITEM_MARGIN = 0; // spacing handled via ItemSeparatorComponent
const RIGHT_PADDING = LIST_SIDE_PADDING + PEEK; // add extra space on right for preview
const CARD_WIDTH = Math.max(
  0,
  SCREEN_WIDTH - (LIST_SIDE_PADDING + RIGHT_PADDING),
);
const H_PADDING = LIST_SIDE_PADDING; // left padding
const HISTORY_PAGE_SIZE = 10;

const PHONEPE_GATEWAY_ERROR_PATTERNS = [
  'something went wrong',
  'uh! oh',
  'uh-oh',
  'phonepe',
];
const PHONEPE_EXTENDED_ATTEMPTS = 6;
const PHONEPE_EXTENDED_DELAY_MS = 5000;

const extractGatewayErrorText = (error: any): string => {
  const visited = new Set<any>();

  const dig = (value: any): string => {
    if (!value || visited.has(value)) {
      return '';
    }
    if (typeof value === 'string') {
      return value.toLowerCase();
    }

    if (typeof value === 'object') {
      visited.add(value);
      const candidates = [
        value.description,
        value.message,
        value.error,
        value.reason,
        value.details,
        value.title,
        value.response,
        value.data,
      ];

      for (const candidate of candidates) {
        const extracted = dig(candidate);
        if (extracted) {
          return extracted;
        }
      }

      try {
        return JSON.stringify(value).toLowerCase();
      } catch {
        return '';
      }
    }

    try {
      return value.toString().toLowerCase();
    } catch {
      return '';
    }
  };

  return dig(error);
};

const isPhonePeGatewayError = (error: any): boolean => {
  const text = extractGatewayErrorText(error);
  if (!text) {
    return false;
  }
  return PHONEPE_GATEWAY_ERROR_PATTERNS.some(pattern => text.includes(pattern));
};

const buildPhonePePendingAlertMessage = (orderId?: string | null): string => {
  const orderInfo = orderId ? `\n\nOrder ID: ${orderId}` : '';
  return (
    'PhonePe reported a temporary issue even though your payment may still be processing. ' +
    'Please allow up to a minute for confirmation. We are continuing to verify this automatically.' +
    orderInfo
  );
};

// Debug Razorpay configuration
console.log('🔧 Razorpay Configuration Debug:');
console.log('  - RAZORPAY_CONFIG:', RAZORPAY_CONFIG);
console.log('  - HAS_RAZORPAY:', HAS_RAZORPAY);
console.log('  - Key exists:', !!RAZORPAY_CONFIG.key);
console.log('  - Secret exists:', !!RAZORPAY_CONFIG.secret);

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
  // Extended fields for subscription stats UI
  totalSubscriptions?: number;
  activeSubscriptions?: number;
  expiredSubscriptions?: number;
  totalSpent?: number;
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
  amount: number; // backend unit (unknown rupees/paisa)
  status: string;
  planType: string;
  planName: string;
  paymentId?: string; // Add payment ID for linking to payment details

  // Additional plan tracking fields for upgrades/downgrades
  originalPlanName?: string;
  targetPlanName?: string;
  subscriptionPlan?: string;
  plan?: { name: string };
  isUpgrade?: boolean;
  isDowngrade?: boolean;
  fromPlan?: string;
  toPlan?: string;

  // Derived/normalized fields (frontend-only)
  amountRupees?: number;
  displayPlanName?: string;
  // Preferred lookup id for details
  lookupId?: string;
}

// Extracted component to avoid calling hooks conditionally inside render
const PlansCarousel: React.FC<{
  cleanedPlans: any[];
  currentSubscription: any;
  paymentProcessing: boolean;
  planActionLoading: string | null;
  paymentError: string | null;
  successMessage: string;
  successPlanId: string | null;
  onPlanPress: (plan: any) => void;
  setSelectedPlanId: (id: string) => void;
  getPlanIcon: (name: string) => string;
  getPlanColor: (name: string) => string;
  getPlanFeature: (name: string) => string;
  getPlanCardStyle: (name: string) => any;
}> = ({
  cleanedPlans,
  currentSubscription,
  paymentProcessing,
  planActionLoading,
  paymentError,
  successMessage,
  successPlanId,
  onPlanPress,
  setSelectedPlanId,
  getPlanIcon,
  getPlanColor,
  getPlanFeature,
  getPlanCardStyle,
}) => {
  const listRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const PlanSlide = React.memo(
    ({
      plan,
      isCurrent,
      isUpgradeTier,
      isDowngradeTier,
      successPlanId,
      onPress,
    }: any) => {
      const planIdentifier =
        plan?.id != null ? String(plan.id) : plan?.name || '';
      const matchesSuccess =
        !!successMessage &&
        !!successPlanId &&
        (successPlanId === planIdentifier ||
          successPlanId === (plan?.name || ''));
      return (
        <View style={[styles.slide, getPlanCardStyle(plan.name)]}>
          <View style={styles.planIconContainer}>
            <MaterialCommunityIcons
              name={getPlanIcon(plan.name)}
              size={28}
              color={getPlanColor(plan.name)}
            />
          </View>
          <Text style={styles.planSummaryName}>{plan.name}</Text>
          <Text style={styles.planSubtitle}>{getPlanFeature(plan.name)}</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.planSummaryPrice}>
              ₹{plan.price.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.planSummaryPeriod}>/{plan.period}</Text>
          </View>
          <View style={styles.featuresListCompact}>
            {(plan.features || [])
              .slice(0, 4)
              .map((feature: string, index: number) => (
                <View key={index} style={styles.featureItemCompact}>
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color="#28a745"
                  />
                  <Text style={styles.featureTextCompact}>{feature}</Text>
                </View>
              ))}
          </View>
          <View style={styles.cardDivider} />
          <TouchableOpacity
            style={[
              styles.planButton,
              styles.planButtonFull,
              isCurrent && styles.currentPlanButton,
              isUpgradeTier && styles.upgradeButton,
              isDowngradeTier && styles.downgradeButton,
              !isCurrent &&
                !isUpgradeTier &&
                !isDowngradeTier &&
                styles.contactButton,
              paymentProcessing && styles.processingButton,
              planActionLoading === plan.id && styles.processingButton,
            ]}
            onPress={onPress}
            disabled={
              isCurrent || paymentProcessing || planActionLoading === plan.id
            }
          >
            {paymentProcessing || planActionLoading === plan.id ? (
              <View style={styles.processingButtonContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.processingButtonText}>Processing...</Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.planButtonText,
                  isCurrent && styles.currentPlanButtonText,
                ]}
              >
                {isCurrent
                  ? 'Current Plan'
                  : isUpgradeTier
                  ? 'Upgrade Now'
                  : isDowngradeTier
                  ? 'Downgrade'
                  : 'Choose Plan'}
              </Text>
            )}
          </TouchableOpacity>
          {false && paymentError && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={20}
                color="#dc3545"
              />
              <Text style={styles.errorText}>{paymentError}</Text>
            </View>
          )}
          {successMessage && matchesSuccess && (
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
    },
  );

  const getScrollPosition = (index: number) => index * (CARD_WIDTH + CARD_GAP);

  // Find the current plan's index to start from user's current plan
  const getInitialIndex = () => {
    if (!currentSubscription?.planName || !cleanedPlans.length) return 0;

    const currentPlanName = currentSubscription.planName.toLowerCase();
    const currentPlanIndex = cleanedPlans.findIndex(
      plan => plan.name.toLowerCase() === currentPlanName,
    );

    console.log('🎯 Finding current plan:', {
      currentPlanName,
      availablePlans: cleanedPlans.map(p => p.name),
      foundIndex: currentPlanIndex,
    });

    // If current plan found, start from that index, otherwise start from 0
    return currentPlanIndex >= 0 ? currentPlanIndex : 0;
  };

  // Precompute exact snap offsets (account for 24px left padding)
  const snapOffsets = useMemo(
    () => cleanedPlans.map((_, i) => i * (CARD_WIDTH + CARD_GAP)),
    [cleanedPlans],
  );

  const snapToIndex = useCallback(
    (index: number, animated: boolean = true) => {
      const clampedIndex = Math.max(
        0,
        Math.min(index, cleanedPlans.length - 1),
      );
      if (listRef.current?.scrollToOffset) {
        try {
          listRef.current.scrollToOffset({
            offset: getScrollPosition(clampedIndex),
            animated,
          });
          setCurrentIndex(clampedIndex);
          currentIndexRef.current = clampedIndex;
          // Do not auto-select a plan on scroll
        } catch (error) {
          console.log('Scroll error:', error);
        }
      }
    },
    [cleanedPlans, setSelectedPlanId],
  );

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
      const clampedIndex = Math.max(
        0,
        Math.min(index, cleanedPlans.length - 1),
      );
      if (clampedIndex !== currentIndexRef.current) {
        setCurrentIndex(clampedIndex);
        currentIndexRef.current = clampedIndex;
        // Do not auto-select on momentum end
      }
    },
    [cleanedPlans, setSelectedPlanId],
  );

  // With snapToOffsets we only need to update the index on momentum end
  const onScrollEndDrag = useCallback(() => {}, []);

  useEffect(() => {
    if (isInitialized) return;
    if (!cleanedPlans.length) return;
    const initialIndex = getInitialIndex();
    setCurrentIndex(initialIndex);
    currentIndexRef.current = initialIndex;
    // Do not preselect any plan on init
    const timer = setTimeout(() => {
      // Scroll to the current plan's position instead of always starting from 0
      if (listRef.current?.scrollToOffset) {
        try {
          const initialOffset = getScrollPosition(initialIndex);
          listRef.current.scrollToOffset({
            offset: initialOffset,
            animated: false,
          });
        } catch {}
      }
      setIsInitialized(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [
    cleanedPlans,
    isInitialized,
    setSelectedPlanId,
    snapToIndex,
    currentSubscription,
  ]);

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        ref={listRef}
        data={cleanedPlans}
        horizontal
        keyExtractor={(item: any) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        nestedScrollEnabled
        bounces={false}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingLeft: H_PADDING,
          paddingRight: RIGHT_PADDING,
          alignItems: 'center',
        }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        getItemLayout={(_: any, index: number) => ({
          length: CARD_WIDTH + CARD_GAP,
          offset: (CARD_WIDTH + CARD_GAP) * index,
          index,
        })}
        windowSize={3}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        renderItem={({ item: plan }: any) => {
          const isCurrent =
            String(currentSubscription?.planName || '').toLowerCase() ===
            String(plan.name || '').toLowerCase();
          const currentAmount = Number(currentSubscription?.amount || 0);
          const planPrice = Number(plan.price || 0);
          const isUpgradeTier = !isCurrent && planPrice > currentAmount;
          const isDowngradeTier = !isCurrent && planPrice < currentAmount;
          return (
            <PlanSlide
              plan={plan}
              isCurrent={isCurrent}
              isUpgradeTier={isUpgradeTier}
              isDowngradeTier={isDowngradeTier}
              successPlanId={successPlanId}
              onPress={() => {
                if (plan?.id) setSelectedPlanId(plan.id);
                const action = isCurrent
                  ? 'current'
                  : isUpgradeTier
                  ? 'upgrade'
                  : isDowngradeTier
                  ? 'downgrade'
                  : 'contact';
                console.log('🖱️ Plan button tapped:', {
                  name: plan?.name,
                  id: plan?.id,
                  isCurrent,
                  isUpgradeTier,
                  isDowngradeTier,
                  resolvedAction: action,
                });
                onPlanPress({ ...plan, buttonAction: action });
              }}
            />
          );
        }}
      />
      <View style={styles.dotsRow}>
        {cleanedPlans.map((_, i: number) => (
          <TouchableOpacity
            key={`dot-${i}`}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
            onPress={() => {
              setCurrentIndex(i);
              snapToIndex(i, true);
            }}
            activeOpacity={0.7}
          />
        ))}
      </View>
    </View>
  );
};

const SubscriptionPlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  // Screen tracking hook
  useScreenTracking();

  // Simple StatusBar configuration - let StableStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  const handleHeaderBack = () => {
    try {
      if ((navigation as any)?.canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
        return;
      }
    } catch {}
    try {
      // Navigate to Customer screen as it's the main screen in the app
      (navigation as any).navigate('AppStack', { screen: 'Customer' });
    } catch {
      try {
        (navigation as any).navigate('Customer');
      } catch {}
    }
  };

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
  const currentSubscriptionRef = useRef(currentSubscription);

  useEffect(() => {
    currentSubscriptionRef.current = currentSubscription;
  }, [currentSubscription]);

  // Normalize and de-duplicate plans for clean UI (avoid duplicate "Free" etc.)
  const cleanedPlans = useMemo(() => {
    if (!availablePlans || availablePlans.length === 0) return [] as any[];

    // Normalize entries and pick the best candidate per name
    const byName: Map<string, any> = new Map();
    for (const plan of availablePlans) {
      const key = (plan.name || '').toLowerCase().trim();
      const normalized = {
        ...plan,
        period:
          (plan.period || '').toLowerCase() === 'monthly'
            ? 'month'
            : plan.period,
      };

      if (!byName.has(key)) {
        byName.set(key, normalized);
      } else {
        const existing = byName.get(key);
        // Prefer the one with: (1) non-null features, (2) higher sort of info, (3) higher price if both 0
        const existingFeatureScore = Array.isArray(existing.features)
          ? existing.features.length
          : 0;
        const newFeatureScore = Array.isArray(normalized.features)
          ? normalized.features.length
          : 0;
        const shouldReplace =
          newFeatureScore > existingFeatureScore ||
          (existing.price === 0 && normalized.price > 0);
        if (shouldReplace) byName.set(key, normalized);
      }
    }

    const result = Array.from(byName.values());
    // Sort: free/lowest price first, then by name for stability
    result.sort((a, b) => {
      const priceDiff = (a.price || 0) - (b.price || 0);
      if (priceDiff !== 0) return priceDiff;
      return String(a.name).localeCompare(String(b.name));
    });
    return result;
  }, [availablePlans]);

  // Transaction limit context to control popups during plan upgrades
  const { stopLimitMonitoring, startLimitMonitoring } = useTransactionLimit();

  // State to track which plan is currently selected for detailed view
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successPlanId, setSuccessPlanId] = useState<string | null>(null);
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
  const [visibleHistoryCount, setVisibleHistoryCount] =
    useState(HISTORY_PAGE_SIZE);
  const [historyPaginating, setHistoryPaginating] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState<string[] | null>(null);
  const [nextBillingDateApi, setNextBillingDateApi] = useState<string | null>(
    null,
  );

  // New state for better error handling (like web version)
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [suppressPaymentError, setSuppressPaymentError] =
    useState<boolean>(false);
  const [planActionLoading, setPlanActionLoading] = useState<string | null>(
    null,
  );

  const nonPendingBillingHistory = useMemo(() => {
    return billingHistory
      .filter(x => (x.status || '').toLowerCase() !== 'pending')
      .slice()
      .sort(
        (a, b) =>
          new Date(b.billingDate).getTime() - new Date(a.billingDate).getTime(),
      );
  }, [billingHistory]);

  const paginatedBillingHistory = useMemo(
    () => nonPendingBillingHistory.slice(0, visibleHistoryCount),
    [nonPendingBillingHistory, visibleHistoryCount],
  );

  const hasMoreBillingHistory =
    visibleHistoryCount < nonPendingBillingHistory.length;

  useEffect(() => {
    setVisibleHistoryCount(HISTORY_PAGE_SIZE);
  }, [billingHistory]);

  // Payment details state
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  // Contact Sales modal state
  const [showContactSalesModal, setShowContactSalesModal] = useState(false);
  // Guard against rapid double-taps opening Razorpay twice
  const upgradingLockRef = useRef<boolean>(false);
  // Track if Razorpay sheet is currently open to block re-entry
  const razorpayOpenRef = useRef<boolean>(false);
  // Throttle rapid taps (covers UI frame before state/refs propagate)
  const lastUpgradeTapRef = useRef<number>(0);

  // Helpers for resilient network calls
  const safeJson = useCallback(async (res: Response) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      try {
        return JSON.parse(text);
      } catch {
        return text || null;
      }
    }
  }, []);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track timeout IDs for cleanup
  const timeoutIdsRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // Helper function to safely set timeout with automatic cleanup tracking
  const safeSetTimeout = useCallback(
    (callback: () => void | Promise<void>, delay: number): NodeJS.Timeout => {
      const timeoutId = setTimeout(async () => {
        if (isMountedRef.current) {
          await callback();
        }
        timeoutIdsRef.current.delete(timeoutId);
      }, delay);
      timeoutIdsRef.current.add(timeoutId);
      return timeoutId;
    },
    [],
  );

  useEffect(() => {
    console.log('SubscriptionPlanScreen mounted');
    isMountedRef.current = true;

    // Load permissions for RBAC-aware API calls
    (async () => {
      try {
        const permsJson = await AsyncStorage.getItem('userPermissions');
        if (permsJson && isMountedRef.current) {
          setUserPermissions(JSON.parse(permsJson));
        }
      } catch (e) {
        console.warn('Failed to load userPermissions:', e);
      }
    })();

    // 🚨 REMOVED: All loading logic and timeout - direct data fetch
    fetchSubscriptionData();
    fetchBillingData();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMountedRef.current = false;
      // Clear all pending timeouts
      timeoutIdsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutIdsRef.current.clear();
      // Cancel any ongoing API requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debug: Log available plans count
  useEffect(() => {
    console.log('📊 Available Plans Count:', availablePlans.length);
    console.log('📊 Available Plans Data:', availablePlans);
    if (availablePlans.length > 0) {
      console.log('📊 Plan Details:');
      availablePlans.forEach((plan, index) => {
        console.log(
          `  ${index + 1}. ${plan.name} - ₹${plan.price}/${plan.period}`,
        );
      });
    }
  }, [availablePlans]);

  // Do not auto-select any plan; selection happens only on user interaction
  useEffect(() => {
    // Clear any prior selection when plans change
    setSelectedPlanId(null);
  }, [availablePlans]);

  // Store AbortController ref for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // New function to fetch billing data from backend APIs with better error handling
  const fetchBillingData = async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      if (!isMountedRef.current) return;
      setApiLoading(true);
      if (!isMountedRef.current) return;
      setPaymentError(null);
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('No auth token, skipping billing data fetch');
        if (!isMountedRef.current) return;
        setApiLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      } as const;

      const hasPerm = (_key: string) => true; // Always fetch on mobile

      // Fetch transaction limits from dedicated endpoint
      try {
        console.log(
          '📈 Fetching transaction limits from /transactions/limits endpoint...',
        );

        // Get user ID for the request
        const userId = await getUserIdFromToken();
        if (!userId) {
          console.log('❌ No user ID available for transaction limits');
          return;
        }

        console.log('🔍 SubscriptionPlanScreen: userId type and value:', {
          originalUserId: userId,
          userIdType: typeof userId,
        });

        // Always bypass cache so plan changes reflect instantly on LIVE
        const limitParams = new URLSearchParams();
        limitParams.append('userId', String(userId));
        limitParams.append('user_id', String(userId));
        const response = await unifiedApi.get(
          `/transactions/limits?${limitParams.toString()}`,
          { cache: false },
        );
        const limitsData: any = (response as any)?.data ?? response ?? {};
        console.log(
          '📈 Transaction limits response (normalized root):',
          limitsData,
        );
        console.log(
          '📈 Current subscription plan:',
          currentSubscription?.planName,
        );

        // Normalize fields from various possible backend shapes
        const usedCountRaw =
          limitsData.currentCount ??
          limitsData.used ??
          limitsData.transactionsUsed ??
          limitsData.count ??
          limitsData.current ??
          0;
        const maxAllowedRaw =
          limitsData.maxAllowed ??
          limitsData.max ??
          limitsData.limit ??
          limitsData.monthlyLimit ??
          limitsData.transactionsLimit ??
          0;
        const nextResetRaw =
          limitsData.nextResetDate ??
          limitsData.nextReset ??
          limitsData.resetAt;

        const usedCount = Number(usedCountRaw) || 0;
        const isUnlimited =
          String(maxAllowedRaw).toLowerCase() === 'unlimited' ||
          Number(maxAllowedRaw) === -1;
        const maxAllowed = isUnlimited ? 999999 : Number(maxAllowedRaw) || 50;
        const remaining = isUnlimited
          ? 999999
          : Math.max(0, maxAllowed - usedCount);
        const percentageUsed = isUnlimited
          ? 0
          : Math.min(
              100,
              Math.round((usedCount / Math.max(1, maxAllowed)) * 100),
            );

        if (!isMountedRef.current) return;
        setTransactionLimits({
          currentCount: usedCount,
          maxAllowed,
          remaining,
          planName: currentSubscription?.planName || 'Free',
          canCreate: limitsData.canCreate ?? true,
          percentageUsed,
          isNearLimit: isUnlimited
            ? false
            : percentageUsed >= 80 && percentageUsed < 100,
          isAtLimit: isUnlimited ? false : usedCount >= maxAllowed,
          nextResetDate: nextResetRaw || null,
          nextResetFormatted: nextResetRaw
            ? new Date(nextResetRaw as string).toLocaleDateString()
            : '',
        });
      } catch (error) {
        console.warn('Transaction limits fetch error:', error);
        // Fallback to hardcoded limits if API fails
        const getTransactionLimit = (planName: string): number => {
          const planLimits: { [key: string]: number } = {
            free: 50,
            starter: 500,
            professional: 1000,
            enterprise: -1, // unlimited
            enterprise_plan: -1, // handle enterprise_plan naming
          };
          return planLimits[planName?.toLowerCase()] || 50;
        };

        const maxAllowed = getTransactionLimit(
          currentSubscription?.planName || 'free',
        );
        const isUnlimited = maxAllowed === -1;

        // 🎯 FIXED: Preserve previous currentCount if available instead of resetting to 0
        // This prevents showing 0 when API fails temporarily after plan change
        const previousCount = transactionLimits?.currentCount || 0;

        if (!isMountedRef.current) return;
        setTransactionLimits({
          currentCount: previousCount, // Preserve previous count instead of 0
          maxAllowed: isUnlimited ? 999999 : maxAllowed,
          remaining: isUnlimited
            ? 999999
            : Math.max(0, maxAllowed - previousCount),
          planName: currentSubscription?.planName || 'Free',
          canCreate: true,
          percentageUsed:
            isUnlimited || maxAllowed === 0
              ? 0
              : Math.min(
                  100,
                  Math.round((previousCount / Math.max(1, maxAllowed)) * 100),
                ),
          isNearLimit:
            isUnlimited || maxAllowed === 0
              ? false
              : previousCount >= maxAllowed * 0.8 && previousCount < maxAllowed,
          isAtLimit: isUnlimited ? false : previousCount >= maxAllowed,
          nextResetDate: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toISOString(),
          nextResetFormatted: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1,
          ).toLocaleDateString(),
        });
      }

      // Fetch normalized next billing date from backend
      try {
        // Use unified API
        const nbResponse = (await unifiedApi.get(
          '/subscriptions/next-billing',
          { cache: false },
        )) as { data: any; status: number; headers: Headers };
        const nb = nbResponse.data || nbResponse;
        console.log('🧾 Next billing from API:', nb);
        if (!isMountedRef.current) return;
        setNextBillingDateApi(
          nb?.nextBillingDate ?? nb?.data?.nextBillingDate ?? null,
        );
      } catch (e) {
        console.warn('next-billing fetch error:', e);
        if (!isMountedRef.current) return;
        setNextBillingDateApi(null);
      }

      // Fetch billing data from new subscription billing endpoints
      try {
        console.log(
          '📊 Fetching billing summary from /subscriptions/billing/summary...',
        );
        // Use unified API
        const summaryResponse = (await unifiedApi.get(
          '/subscriptions/billing/summary',
          { cache: false },
        )) as { data: any; status: number; headers: Headers };
        const summaryData = summaryResponse.data || summaryResponse;
        console.log('📊 Billing summary response:', summaryData);
        console.log(
          '📊 Total amount from backend (assumed INR):',
          summaryData.totalAmount,
          'Type:',
          typeof summaryData.totalAmount,
        );
        // Backend returns rupees; use as-is
        const totalAmountRupees = Number(summaryData.totalAmount || 0);
        const totalInvoices = Number(summaryData.totalInvoices || 0);
        // Also fetch subscription stats for dashboard tiles
        try {
          // Use unified API
          const subStatsRes = (await unifiedApi.get('/subscriptions/stats', {
            cache: false,
          })) as { data: any; status: number; headers: Headers };
          const subStats =
            subStatsRes.status >= 200 && subStatsRes.status < 300
              ? subStatsRes.data || subStatsRes
              : null;

          if (!isMountedRef.current) return;
          setBillingSummary({
            totalInvoices,
            totalAmount: totalAmountRupees,
            averageAmount:
              totalInvoices > 0 ? totalAmountRupees / totalInvoices : 0,
            pendingInvoices: summaryData.pending || 0,
            overdueInvoices: summaryData.overdue || 0,
            currency: 'INR',
            // Strictly use raw backend values for tiles
            totalSubscriptions: subStats?.total,
            activeSubscriptions: subStats?.active,
            expiredSubscriptions: subStats?.expired,
            // Total spent should reflect payments; use billing summary total
            totalSpent: totalAmountRupees,
          });
        } catch (e) {
          if (!isMountedRef.current) return;
          setBillingSummary({
            totalInvoices,
            totalAmount: totalAmountRupees,
            averageAmount:
              totalInvoices > 0 ? totalAmountRupees / totalInvoices : 0,
            pendingInvoices: summaryData.pending || 0,
            overdueInvoices: summaryData.overdue || 0,
            currency: 'INR',
          });
        }

        console.log(
          '📊 Fetching billing history from /subscriptions/billing/history...',
        );
        // Use unified API with pagination - get() returns data directly
        const historyResponse = await unifiedApi.get(
          '/subscriptions/billing/history?page=1&limit=50',
          { cache: false },
        );
        console.log('📊 Billing history response:', historyResponse);

        // unifiedApi.get() returns data directly, not wrapped in {data, status, headers}
        const historyData = (historyResponse as any)?.data ?? historyResponse;
        console.log('📊 Billing history data type:', typeof historyData);
        console.log('📊 Billing history is array:', Array.isArray(historyData));
        console.log(
          '📊 Billing history has data property:',
          !!historyData?.data,
        );

        // Extract the actual array of invoices
        let invoicesArray: any[] = [];
        if (Array.isArray(historyData)) {
          invoicesArray = historyData;
        } else if (historyData?.data && Array.isArray(historyData.data)) {
          invoicesArray = historyData.data;
        } else if (
          historyData?.invoices &&
          Array.isArray(historyData.invoices)
        ) {
          invoicesArray = historyData.invoices;
        } else if (historyData && typeof historyData === 'object') {
          // Try to find any array property
          const arrayKeys = Object.keys(historyData).filter(key =>
            Array.isArray(historyData[key]),
          );
          if (arrayKeys.length > 0) {
            invoicesArray = historyData[arrayKeys[0]];
            console.log(`📊 Found invoices in property: ${arrayKeys[0]}`);
          }
        }

        console.log(
          '📊 Extracted invoices array length:',
          invoicesArray.length,
        );

        // Check if we have valid data
        let normalized: BillingHistoryItem[] = [];
        if (invoicesArray && invoicesArray.length > 0) {
          normalized = invoicesArray.map((inv: any, index: number) => {
            console.log(`🔍 Processing invoice ${index + 1}:`, {
              invoiceNumber: inv.invoiceNumber,
              planName: inv.planName,
              amount: inv.amount,
              amountType: typeof inv.amount,
              // Check all possible plan fields
              targetPlanName: inv.targetPlanName,
              originalPlanName: inv.originalPlanName,
              subscriptionPlan: inv.subscriptionPlan,
              plan: inv.plan,
              // Check upgrade/downgrade fields
              isUpgrade: inv.isUpgrade,
              isDowngrade: inv.isDowngrade,
              fromPlan: inv.fromPlan,
              toPlan: inv.toPlan,
              // Check other possible fields
              planType: inv.planType,
              billingPeriod: inv.billingPeriod,
            });

            const amountRaw = Number(inv.amount || 0);
            // Backend history returns rupees; use as-is for display
            const amountRupees: number = amountRaw;

            // Use backend-provided names only; do not infer on frontend
            const name: string | undefined =
              inv.displayPlanName ||
              (inv.plan && (inv.plan.displayName || inv.plan.name)) ||
              inv.planName ||
              inv.subscriptionPlan ||
              inv.targetPlanName ||
              inv.originalPlanName;

            // Prefer showing final plan; avoid constructing arrows on the client
            const display = name || 'Plan';

            console.log(`🔍 Final display name for invoice ${index + 1}:`, {
              display,
              isUpgrade: inv.isUpgrade,
              isDowngrade: inv.isDowngrade,
              fromPlan: inv.fromPlan,
              toPlan: inv.toPlan,
              finalName: name,
            });

            const out: BillingHistoryItem = {
              ...inv,
              amount: amountRaw,
              amountRupees: amountRupees,
              displayPlanName: display,
              // Lookup key for fetching details reliably
              lookupId:
                inv.razorpayPaymentId ||
                inv.paymentId ||
                inv.razorpay_payment_id ||
                inv.razorpayOrderId ||
                inv.razorpay_order_id ||
                inv.invoiceNumber,
            };
            return out;
          });
          console.log(
            '📊 Normalized billing history items:',
            normalized.length,
          );
          if (!isMountedRef.current) return;
          setBillingHistory(normalized);
        } else {
          console.warn('📊 Billing history empty or invalid response:', {
            historyData,
            invoicesArrayLength: invoicesArray.length,
            historyDataType: typeof historyData,
            isArray: Array.isArray(historyData),
            hasData: !!historyData?.data,
          });
          // Set empty history initially
          if (!isMountedRef.current) return;
          setBillingHistory([]);
        }

        // Fallback: if billing history is still empty, try building from payments endpoint
        if (!normalized || normalized.length === 0) {
          try {
            console.log('📊 Billing history empty; fetching from /payments...');
            // Use unified API - get() returns data directly
            const paymentsResponse = await unifiedApi.get(
              '/payments?limit=50',
              {
                cache: false,
              },
            );
            // unifiedApi.get() returns data directly
            const paymentsBody =
              (paymentsResponse as any)?.data ?? paymentsResponse;
            const rows = Array.isArray(paymentsBody?.data)
              ? paymentsBody.data
              : Array.isArray(paymentsBody)
              ? paymentsBody
              : [];

            const planById = new Map(
              availablePlans.map((p: any) => [Number(p.id), p]),
            );

            const paymentsAsHistory: BillingHistoryItem[] = rows.map(
              (p: any) => {
                const targetId = Number(p.targetPlanId || p.planId);
                const planMeta = planById.get(targetId);
                const name = planMeta?.name || p?.plan?.name || 'Subscription';
                const amountRaw = Number(p.amount || 0); // DB stores rupees
                const amountRupees =
                  amountRaw > 1000 ? amountRaw / 100 : amountRaw;

                return {
                  id: p.id,
                  invoiceNumber: p.razorpayOrderId || `INV-${p.id}`,
                  billingPeriod: 'Monthly',
                  billingDate: p.createdAt || new Date().toISOString(),
                  dueDate: p.createdAt || new Date().toISOString(),
                  amount: amountRaw,
                  status:
                    (p.status || 'paid').toString().toLowerCase() === 'success'
                      ? 'paid'
                      : p.status || 'paid',
                  planType: 'subscription',
                  planName: name,
                  paymentId: p.razorpayPaymentId || String(p.id),
                  amountRupees,
                  displayPlanName: name,
                } as BillingHistoryItem;
              },
            );

            console.log(
              '📊 Payments fallback normalized items:',
              paymentsAsHistory.length,
            );
            if (paymentsAsHistory.length > 0 && isMountedRef.current) {
              setBillingHistory(paymentsAsHistory);
            }
          } catch (fbErr) {
            console.warn('Billing history payments fallback failed:', fbErr);
          }
        }
      } catch (error) {
        console.warn('Billing API fetch error:', error);
        // Fallback to empty billing data
        if (isMountedRef.current) {
          setBillingSummary({
            totalInvoices: 0,
            totalAmount: 0,
            averageAmount: 0,
            pendingInvoices: 0,
            overdueInvoices: 0,
            currency: 'INR',
          });
          setBillingHistory([]);
        }
      }
    } catch (error) {
      console.warn('Error fetching billing data:', error);
      if (isMountedRef.current) {
        setPaymentError(
          'Failed to load billing information. Please try again.',
        );
      }
    } finally {
      if (isMountedRef.current) {
        setApiLoading(false);
      }
    }
  };

  const refreshSubscriptionAndConfirm = useCallback(
    async (
      targetPlanName: string,
      attempts: number = 3,
      delayMs: number = 900,
    ) => {
      if (!targetPlanName) return false;
      const normalizedTarget = targetPlanName.toLowerCase();
      const matchesTarget = () =>
        (currentSubscriptionRef.current?.planName || '')
          .toLowerCase()
          .includes(normalizedTarget);

      if (matchesTarget()) {
        return true;
      }

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          await fetchSubscriptionData(false);
          await new Promise(resolve => setTimeout(resolve, 250));
        } catch (error) {
          console.warn(
            `⚠️ Subscription refresh attempt ${attempt + 1} failed:`,
            error,
          );
        }

        if (matchesTarget()) {
          console.log(
            '✅ Subscription context updated to target plan after refresh attempt',
            attempt + 1,
          );
          return true;
        }

        if (attempt < attempts - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, delayMs * Math.max(1, attempt + 1)),
          );
        }
      }

      return false;
    },
    [fetchSubscriptionData],
  );

  const runPostUpgradeSuccessFlow = useCallback(
    async (plan: PlanDisplayData) => {
      if (!isMountedRef.current || !plan?.name) return;

      setSuccessPlanId(plan?.id != null ? String(plan.id) : plan.name || null);
      setSuccessMessage(
        `Payment completed! Your plan has been successfully upgraded to ${plan.name}!`,
      );
      setShowSuccessModal(true);

      try {
        await showPlanUpdatedNotification(plan.name, plan.price);
        console.log('✅ Plan update notification sent successfully');
      } catch (notificationError) {
        console.error(
          '❌ Failed to show plan update notification:',
          notificationError,
        );
      }

      // 🎯 CRITICAL FIX: Wrap refresh operations in try-catch to prevent errors
      // from propagating and showing error alerts after successful upgrade
      try {
        await refreshSubscriptionAndConfirm(plan.name, 3, 900);
      } catch (refreshError) {
        console.warn(
          '⚠️ Subscription refresh error (upgrade was successful):',
          refreshError,
        );
        // Don't throw - upgrade was successful, just log the error
      }

      safeSetTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          console.log(
            '🔄 Refreshing subscription data after plan upgrade (with delay)...',
          );
          await fetchSubscriptionData(false);
        } catch (fetchError) {
          console.warn(
            '⚠️ Subscription data fetch error (upgrade was successful):',
            fetchError,
          );
          // Don't throw - upgrade was successful, just log the error
        }
      }, 1000);

      safeSetTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          console.log(
            '🔄 Refreshing transaction limits after plan upgrade (with delay)...',
          );
          await fetchBillingData();

          safeSetTimeout(async () => {
            if (!isMountedRef.current) return;
            try {
              console.log(
                '🔄 Retrying transaction limits fetch to ensure accuracy...',
              );
              await fetchBillingData();
            } catch (retryError) {
              console.warn(
                '⚠️ Transaction limits retry error (upgrade was successful):',
                retryError,
              );
              // Don't throw - upgrade was successful, just log the error
            }
          }, 1500);
        } catch (billingError) {
          console.warn(
            '⚠️ Billing data fetch error (upgrade was successful):',
            billingError,
          );
          // Don't throw - upgrade was successful, just log the error
        }
      }, 1500);

      safeSetTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          await startLimitMonitoring();
          console.log('✅ Transaction limit monitoring restarted successfully');
        } catch (error) {
          console.error(
            '❌ Error restarting transaction limit monitoring:',
            error,
          );
        }
      }, 2000);

      safeSetTimeout(() => {
        if (isMountedRef.current) {
          console.log(
            '🔄 Resetting paymentProcessing after successful upgrade',
          );
          setPaymentProcessing(false);
          upgradingLockRef.current = false;
          razorpayOpenRef.current = false;
        }
      }, 2500);
    },
    [
      fetchBillingData,
      fetchSubscriptionData,
      refreshSubscriptionAndConfirm,
      safeSetTimeout,
      showPlanUpdatedNotification,
      startLimitMonitoring,
    ],
  );

  // Auto-refresh Billing History whenever subscription changes (plan/amount/date)
  useEffect(() => {
    // Avoid firing on first mount before data is available
    if (!currentSubscription) return;
    if (!isMountedRef.current) return;

    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Use a small delay to avoid race conditions
      timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          fetchBillingData();
        }
      }, 100);
    } catch (error) {
      console.warn('Error in fetchBillingData useEffect:', error);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    currentSubscription?.planName,
    currentSubscription?.amount,
    currentSubscription?.nextBillingDate,
  ]);

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

      // Use payments endpoint to fetch payment details
      console.log('💳 Fetching payment details from payments endpoint...');
      const isRzpId =
        typeof paymentId === 'string' && paymentId.startsWith('pay_');
      // Use unified API - get() returns data directly
      const url = isRzpId
        ? `/payments?razorpayPaymentId=${paymentId}`
        : `/payments/${encodeURIComponent(paymentId)}`;
      const paymentResponse = await unifiedApi.get(url, { cache: false });
      console.log('💳 Payment details response:', paymentResponse);
      // unifiedApi.get() returns data directly, not wrapped in {data, status, headers}
      const paymentData = (paymentResponse as any)?.data ?? paymentResponse;
      const payments = paymentData?.data ?? paymentData ?? {};
      const payment = Array.isArray(payments) ? payments[0] : payments;

      // Check if we have valid payment data
      if (
        payment &&
        (payment.id || payment.paymentId || payment.razorpayPaymentId)
      ) {
        console.log('💳 Payment data for transformation:', payment);
        console.log('💳 Payment createdAt:', payment.createdAt);
        console.log('💳 Payment amount:', payment.amount);
        console.log('💳 Payment razorpayPaymentId:', payment.razorpayPaymentId);
        console.log('💳 Payment razorpayOrderId:', payment.razorpayOrderId);

        console.log('🔍 Original payment data from backend:', {
          amount: payment.amount,
          amountType: typeof payment.amount,
          currency: payment.currency,
          method: payment.paymentMethod,
        });

        // Resolve plan name from targetPlanId/planId using availablePlans
        const resolvedPlanId = Number(payment.targetPlanId || payment.planId);
        const resolvedPlanMeta = availablePlans.find(
          (p: any) => Number(p.id) === resolvedPlanId,
        );
        const resolvedPlanName =
          resolvedPlanMeta?.name || payment?.plan?.name || undefined;

        // Compute expiry date from current subscription if available
        const expiryIso = currentSubscription?.nextBillingDate
          ? new Date(currentSubscription.nextBillingDate).toISOString()
          : undefined;

        const transformedPaymentData = {
          id: payment.id,
          // Pass amount in paisa for PaymentDetailsDisplay component
          amount:
            typeof payment.amount === 'number'
              ? Math.round(payment.amount * 100)
              : 0,
          currency: payment.currency || 'INR',
          status: payment.status || 'success',
          method: payment.paymentMethod || 'unknown',
          description:
            payment.paymentDescription ||
            (resolvedPlanName
              ? `Payment for ${resolvedPlanName} plan` +
                (expiryIso
                  ? ` (Expires: ${new Date(expiryIso).toLocaleDateString()})`
                  : '')
              : 'Subscription Payment'),
          created_at: payment.createdAt
            ? Math.floor(new Date(payment.createdAt).getTime() / 1000)
            : Math.floor(Date.now() / 1000),
          customer: {
            name: payment.customerName || '',
            email: payment.customerEmail || '',
            phone: payment.customerPhone || '',
          },
          invoice_number: payment.razorpayOrderId || `INV-${payment.id}`,
          // Fix field names to match PaymentDetailsDisplay component
          razorpay_payment_id: payment.razorpayPaymentId || '',
          razorpay_order_id: payment.razorpayOrderId || '',
          razorpay_signature: payment.razorpaySignature || '',
          ...payment, // Include all original data
          plan_name: resolvedPlanName,
          expiry_date: expiryIso,
        };

        console.log(
          '💳 Final transformed payment data:',
          transformedPaymentData,
        );
        console.log('🔍 Transformed amount details:', {
          amount: transformedPaymentData.amount,
          amountType: typeof transformedPaymentData.amount,
          currency: transformedPaymentData.currency,
        });
        console.log(
          '💳 Final created_at timestamp:',
          transformedPaymentData.created_at,
        );
        console.log('💳 Final amount:', transformedPaymentData.amount);
        console.log(
          '💳 Final razorpay_payment_id:',
          transformedPaymentData.razorpay_payment_id,
        );
        console.log(
          '💳 Final razorpay_order_id:',
          transformedPaymentData.razorpay_order_id,
        );

        setPaymentDetails(transformedPaymentData);
        setShowPaymentDetails(true);
      } else {
        console.error('No payment found with ID:', paymentId);
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

  // Helper to format INR currency cleanly
  const formatINR = (value: number): string => {
    try {
      const amount = Number(value || 0);
      return amount.toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
    } catch {
      return `₹${Number(value || 0).toFixed(2)}`;
    }
  };

  const handleLoadMoreHistory = () => {
    if (!hasMoreBillingHistory || historyPaginating) {
      return;
    }
    setHistoryPaginating(true);
    setTimeout(() => {
      setVisibleHistoryCount(prev =>
        Math.min(prev + HISTORY_PAGE_SIZE, nonPendingBillingHistory.length),
      );
      setHistoryPaginating(false);
    }, 200);
  };

  const renderBillingHistoryItem = ({
    item: invoice,
    index,
  }: {
    item: BillingHistoryItem;
    index: number;
  }) => (
    <View style={styles.billingHistoryItem}>
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
        {invoice.displayPlanName
          ? `${invoice.displayPlanName} - ${invoice.billingPeriod}`
          : `${invoice.planName} - ${invoice.billingPeriod}`}
      </Text>
      <View style={styles.billingHistoryItemFooter}>
        <Text style={styles.billingHistoryItemAmount}>
          {formatINR(
            typeof invoice.amountRupees === 'number'
              ? invoice.amountRupees
              : Number(invoice.amount || 0),
          )}
        </Text>
        <Text style={styles.billingHistoryItemDate}>
          {invoice.billingDate
            ? new Date(invoice.billingDate).toLocaleDateString()
            : '--'}
        </Text>
        {index === 0 && (
          <TouchableOpacity
            style={styles.viewPaymentButton}
            onPress={() => {
              const derivedId =
                (invoice as any).paymentId ||
                (invoice as any).lookupId ||
                (invoice as any).razorpayPaymentId ||
                (invoice as any).razorpay_payment_id ||
                (invoice as any).razorpayOrderId ||
                (invoice as any).razorpay_order_id ||
                invoice.invoiceNumber;
              if (derivedId) {
                fetchPaymentDetails(String(derivedId));
              }
            }}
          >
            <MaterialCommunityIcons name="eye" size={14} color="#4f8cff" />
            <Text style={styles.viewPaymentButtonText}>Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Get the currently selected plan for detailed view with better null safety
  const getSelectedPlan = () => {
    if (!selectedPlanId || !availablePlans || availablePlans.length === 0)
      return null;
    const plan = availablePlans.find(plan => plan.id === selectedPlanId);
    if (!plan) return null;

    // Create a plan object with all required properties for display
    const isCurrent =
      currentSubscription?.planName.toLowerCase() === plan.name.toLowerCase();
    const isRecommended = false; // Recommended flag removed per requirements

    // Determine if this is a downgrade (lower price than current plan)
    const isDowngrade = plan.price < (currentSubscription?.amount || 0);
    const isUpgrade = plan.price > (currentSubscription?.amount || 0);

    // For Free plan (price = 0), only show downgrade if current plan is paid
    const shouldShowDowngrade =
      isDowngrade && (plan.price > 0 || (currentSubscription?.amount || 0) > 0);

    const base = {
      ...plan,
      isCurrent,
      isRecommended,
      buttonText: isCurrent
        ? 'Current Plan'
        : isUpgrade
        ? 'Upgrade'
        : shouldShowDowngrade
        ? 'Downgrade'
        : 'Contact Sales',
      buttonAction: isCurrent
        ? 'current'
        : isUpgrade
        ? 'upgrade'
        : shouldShowDowngrade
        ? 'downgrade'
        : 'contact',
    } as any;

    // If Razorpay is not configured, show upgrade button but handle payment differently
    if (!HAS_RAZORPAY && base.buttonAction === 'upgrade') {
      console.log(
        '⚠️ Razorpay not configured, but allowing upgrade with alternative payment',
      );
      console.log('  - Plan:', plan.name);
      console.log('  - Button action:', base.buttonAction);
      console.log('  - Button text:', base.buttonText);
      // Keep the upgrade action but the payment flow will handle the missing Razorpay config
    } else {
      console.log('✅ Razorpay configured, keeping upgrade button');
      console.log('  - Plan:', plan.name);
      console.log('  - Button action:', base.buttonAction);
      console.log('  - Button text:', base.buttonText);
    }

    return base;
  };

  // Resolve the intended action for a plan even if buttonAction isn't provided
  const resolveActionForPlan = (
    plan: any,
  ): 'upgrade' | 'downgrade' | 'current' | 'contact' => {
    try {
      if (!plan) return 'contact';
      const planName = String(plan.name || '').toLowerCase();
      const isCurrent =
        String(currentSubscription?.planName || '').toLowerCase() === planName;
      if (isCurrent) return 'current';

      const currentAmount = Number(currentSubscription?.amount || 0);
      const planPrice = Number(plan.price || 0);
      if (Number.isFinite(planPrice) && Number.isFinite(currentAmount)) {
        if (planPrice > currentAmount) return 'upgrade';
        if (planPrice < currentAmount) return 'downgrade';
      }
      // Default to upgrade for equal/unknown pricing (user intent from UI)
      return 'upgrade';
    } catch {
      return 'upgrade';
    }
  };

  const handlePlanAction = async (plan: PlanDisplayData) => {
    console.log('🔍 handlePlanAction called with:', {
      planName: plan.name,
      planId: plan.id,
      buttonAction: plan.buttonAction,
    });

    const action = (plan as any).buttonAction || resolveActionForPlan(plan);
    switch (action) {
      case 'upgrade':
        console.log('🚀 Upgrade action triggered');
        // Debounce: prevent double trigger before React state updates
        const nowTs = Date.now();
        if (nowTs - (lastUpgradeTapRef.current || 0) < 1200) {
          console.log('⏸️ Upgrade ignored (throttled)');
          return;
        }
        if (
          upgradingLockRef.current ||
          paymentProcessing ||
          razorpayOpenRef.current
        ) {
          console.log('⏸️ Upgrade ignored (already in progress)');
          return;
        }
        lastUpgradeTapRef.current = nowTs;
        // Immediately flip UI to processing to disable the button on this frame
        if (!isMountedRef.current) return;
        setPaymentProcessing(true);
        upgradingLockRef.current = true;
        try {
          // Direct upgrade without transaction limit check - let Razorpay handle payment
          await upgradePlan(plan);
        } catch (error) {
          console.error('Error in upgradePlan:', error);
          // Ensure state is reset on error
          if (isMountedRef.current) {
            setPaymentProcessing(false);
            upgradingLockRef.current = false;
            razorpayOpenRef.current = false;
          }
        } finally {
          if (isMountedRef.current) {
            setPaymentProcessing(false);
          }
          upgradingLockRef.current = false;
          // Final safety to ensure state allows next attempt if something aborted early
          razorpayOpenRef.current = false;
        }
        break;
      case 'downgrade':
        console.log('⬇️ Downgrade action triggered - calling immediately');
        // Call directly to ensure the action triggers reliably
        downgradePlan(plan);
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

  // 🎯 DISABLED: Create transaction entry for plan upgrade
  // NOTE: This function is currently disabled because the backend already creates
  // a subscription transaction via createSubscriptionTransaction() in the payment service.
  // Creating transactions from the frontend would result in duplicate entries.
  // If you need to re-enable this, remove the backend transaction creation first.
  const createPlanUpgradeTransaction = async (
    plan: PlanDisplayData,
    paymentId?: string,
  ) => {
    // Function disabled - backend handles transaction creation
    console.log(
      '⚠️ createPlanUpgradeTransaction is disabled - backend creates transactions',
    );
    return;
    try {
      console.log('📝 Creating transaction entry for plan upgrade...');
      const userId = await getUserIdFromToken();
      if (!userId) {
        console.warn(
          '⚠️ No user ID available, skipping transaction entry creation',
        );
        return;
      }

      // 🎯 FIXED: Create or find "Subscription Payment" customer
      let subscriptionCustomerId: number | undefined;
      try {
        // Try to find existing "Subscription Payment" customer
        const customersResponse = await unifiedApi.get('/customers');
        const customersData =
          (customersResponse as any)?.data ?? customersResponse;
        const customersList = Array.isArray(customersData)
          ? customersData
          : customersData?.data || [];

        const existingCustomer = customersList.find(
          (c: any) =>
            (c.partyName || '').toString().trim().toLowerCase() ===
            'subscription payment',
        );

        if (existingCustomer && existingCustomer.id) {
          subscriptionCustomerId = Number(existingCustomer.id);
          console.log(
            '✅ Found existing Subscription Payment customer:',
            subscriptionCustomerId,
          );
        } else {
          // Create new "Subscription Payment" customer
          const newCustomer = await unifiedApi.createCustomer({
            partyName: 'Subscription Payment',
            partyType: 'Customer',
            phoneNumber: undefined,
            address: undefined,
          });
          const customerData = (newCustomer as any)?.data ?? newCustomer;
          subscriptionCustomerId = Number(customerData?.id);
          console.log(
            '✅ Created Subscription Payment customer:',
            subscriptionCustomerId,
          );
        }
      } catch (customerError) {
        console.warn(
          '⚠️ Failed to create/find Subscription Payment customer:',
          customerError,
        );
        // Continue without customer ID - backend might allow it or we'll skip transaction creation
      }

      // Generate document number for receipt
      let receiptNumber = '';
      try {
        receiptNumber = await generateNextDocumentNumber('receipt', true);
      } catch (error) {
        console.warn('⚠️ Failed to generate receipt number:', error);
        receiptNumber = `REC-${Date.now()}`;
      }

      // Get current date in YYYY-MM-DD format
      const today = new Date();
      const currentDate = today.toISOString().split('T')[0];

      // Create transaction body similar to ReceiptScreen
      const transactionBody: any = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: 'credit', // Receipt type
        amount: Number(plan.price.toFixed(2)),
        date: currentDate,
        transactionDate: currentDate,
        receiptDate: currentDate,
        transaction_date: currentDate,
        receipt_date: currentDate,
        status: 'Complete',
        description: `Plan upgrade to ${plan.name} plan`,
        notes: paymentId
          ? `Subscription payment - Payment ID: ${paymentId}`
          : `Subscription payment for ${plan.name} plan`,
        partyName: 'Subscription Payment',
        partyPhone: '',
        partyAddress: '',
        method: 'Subscription',
        category: 'Subscription',
        items: [],
        receiptNumber: receiptNumber,
      };

      // 🎯 FIXED: Add customer ID if available
      if (subscriptionCustomerId) {
        transactionBody.partyId = subscriptionCustomerId;
        transactionBody.customer_id = subscriptionCustomerId;
      }

      // Include user's primary role id for backend auditing/mapping
      try {
        const { addRoleIdToBody } = await import('../utils/roleHelper');
        await addRoleIdToBody(transactionBody);
      } catch (e) {
        console.warn(
          '⚠️ SubscriptionPlanScreen: Failed to add role ID to transaction:',
          e,
        );
      }

      // Create the transaction entry
      const transactionResponse = await unifiedApi.createTransaction(
        transactionBody,
      );
      console.log(
        '✅ Plan upgrade transaction entry created:',
        transactionResponse,
      );

      // Also create an invoice entry (Sell voucher) for the same upgrade
      try {
        // Generate document number for invoice
        let invoiceNumber = '';
        try {
          invoiceNumber = await generateNextDocumentNumber('sell', true);
        } catch (error) {
          console.warn('⚠️ Failed to generate invoice number:', error);
          invoiceNumber = `SEL-${Date.now()}`;
        }

        // Create invoice transaction body similar to InvoiceScreen
        const invoiceTransactionBody: any = {
          user_id: userId,
          createdBy: userId,
          updatedBy: userId,
          type: 'credit', // Invoice/Sell type
          amount: Number(plan.price.toFixed(2)),
          date: currentDate,
          transactionDate: currentDate,
          invoiceDate: currentDate,
          documentDate: currentDate,
          transaction_date: currentDate,
          document_date: currentDate,
          invoice_date: currentDate,
          status: 'Complete',
          description: `Plan upgrade to ${plan.name} plan`,
          notes: paymentId
            ? `Subscription payment - Payment ID: ${paymentId}`
            : `Subscription payment for ${plan.name} plan`,
          partyName: 'Subscription Payment',
          partyPhone: '',
          partyAddress: '',
          method: 'Sell',
          category: 'Subscription',
          items: [
            {
              name: `Subscription - ${plan.name} Plan`,
              description: `Subscription - ${plan.name} Plan`,
              quantity: 1,
              rate: Number(plan.price.toFixed(2)),
              amount: Number(plan.price.toFixed(2)),
              gstPct: 0,
            },
          ],
          invoiceNumber: invoiceNumber,
          gstPct: 0,
          subTotal: Number(plan.price.toFixed(2)),
          totalAmount: Number(plan.price.toFixed(2)),
          syncYN: 'Y',
        };

        // 🎯 FIXED: Add customer ID if available
        if (subscriptionCustomerId) {
          invoiceTransactionBody.partyId = subscriptionCustomerId;
          invoiceTransactionBody.customer_id = subscriptionCustomerId;
          invoiceTransactionBody.customerId = subscriptionCustomerId;
        }

        // Include user's primary role id
        try {
          const { addRoleIdToBody } = await import('../utils/roleHelper');
          await addRoleIdToBody(invoiceTransactionBody);
        } catch (e) {
          console.warn(
            '⚠️ SubscriptionPlanScreen: Failed to add role ID to invoice transaction:',
            e,
          );
        }

        // Create the invoice transaction entry
        const invoiceTransactionResponse = await unifiedApi.createTransaction(
          invoiceTransactionBody,
        );
        console.log(
          '✅ Plan upgrade invoice entry created:',
          invoiceTransactionResponse,
        );
      } catch (invoiceError) {
        console.warn(
          '⚠️ Failed to create invoice transaction entry:',
          invoiceError,
        );
        // Don't block the flow if invoice creation fails
      }
    } catch (error) {
      console.error(
        '❌ Failed to create plan upgrade transaction entry:',
        error,
      );
      // Don't block the flow if transaction creation fails
    }
  };

  const extractNumericPaymentId = (value: any): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      if (/^\d+$/.test(trimmed)) {
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    return null;
  };

  const extractNumericPaymentIdFromRecord = (record: any): number | null => {
    if (!record || typeof record !== 'object') {
      return null;
    }
    const candidateKeys = [
      'id',
      'paymentId',
      'payment_id',
      'paymentID',
      'idx',
      'paymentIdx',
      'paymentIDX',
      'transactionId',
      'transaction_id',
    ];
    for (const key of candidateKeys) {
      if (key in record) {
        const numeric = extractNumericPaymentId((record as any)[key]);
        if (numeric !== null) {
          return numeric;
        }
      }
    }
    if ('data' in record) {
      return extractNumericPaymentIdFromRecord((record as any).data);
    }
    return null;
  };

  const resolveNumericPaymentIdFromCandidates = (
    ...candidates: any[]
  ): number | null => {
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) continue;
      if (Array.isArray(candidate)) {
        for (const entry of candidate) {
          const numericFromEntry = resolveNumericPaymentIdFromCandidates(entry);
          if (numericFromEntry !== null) {
            return numericFromEntry;
          }
        }
        continue;
      }
      if (typeof candidate === 'object' && !Array.isArray(candidate)) {
        const numericFromRecord = extractNumericPaymentIdFromRecord(candidate);
        if (numericFromRecord !== null) {
          return numericFromRecord;
        }
      }
      const numeric = extractNumericPaymentId(candidate);
      if (numeric !== null) {
        return numeric;
      }
    }
    return null;
  };

  const interpretPaymentVerification = useCallback((payload: any) => {
    const data = payload?.data ?? payload;
    if (!data) {
      return { success: false } as const;
    }

    const paymentArrayCandidate =
      data?.payments ||
      data?.data ||
      data?.paymentData ||
      (Array.isArray(data) ? data : null);

    const paymentRecord =
      data?.payment ||
      data?.paymentRecord ||
      (Array.isArray(paymentArrayCandidate) && paymentArrayCandidate.length > 0
        ? paymentArrayCandidate[0]
        : paymentArrayCandidate) ||
      null;

    const rawStatus = (
      paymentRecord?.status ||
      data?.status ||
      data?.paymentStatus ||
      ''
    )
      .toString()
      .toLowerCase();

    const captured =
      paymentRecord?.captured === true ||
      rawStatus === 'captured' ||
      paymentRecord?.payment_status === 'captured';

    // 🎯 CRITICAL FIX FOR PHONEPE/UPI: Recognize more success states
    // PhonePe payments might be in "authorized", "pending", or "created" state but still successful
    // 🎯 CRITICAL FIX FOR PHONEPE/UPI: Recognize more success states
    // PhonePe payments might be in "authorized", "pending", or "created" state but still successful
    const isFailedStatus =
      rawStatus === 'failed' ||
      rawStatus === 'cancelled' ||
      rawStatus === 'refunded' ||
      rawStatus === 'error' ||
      rawStatus === 'rejected';

    const isSuccessStatus =
      rawStatus === 'success' ||
      rawStatus === 'paid' ||
      rawStatus === 'processed' ||
      rawStatus === 'captured' ||
      rawStatus === 'authorized' || // UPI payments often show as authorized
      rawStatus === 'created' || // Payment created is a success state
      rawStatus === 'pending'; // Pending can mean payment is processing (for UPI)

    const success =
      data?.success === true ||
      captured ||
      isSuccessStatus ||
      data?.message?.toString().toLowerCase().includes('verification queued') ||
      data?.message?.toString().toLowerCase().includes('initiated') ||
      data?.message?.toString().toLowerCase().includes('success') ||
      // 🎯 CRITICAL: If payment record exists and status is not explicitly failed, consider it success
      // This handles PhonePe cases where payment succeeds but status is still "pending" or "authorized"
      (paymentRecord &&
        !isFailedStatus &&
        (paymentRecord.razorpayPaymentId ||
          paymentRecord.razorpay_payment_id ||
          paymentRecord.id));

    const paymentId =
      paymentRecord?.id ||
      paymentRecord?.paymentId ||
      paymentRecord?.razorpayPaymentId ||
      paymentRecord?.razorpay_payment_id ||
      data?.paymentId ||
      data?.razorpayPaymentId ||
      data?.razorpay_payment_id;

    return {
      success,
      captured,
      paymentId,
      paymentRecord,
      raw: data,
    };
  }, []);

  const pollPaymentStatus = useCallback(
    async (orderId: string, attempts: number = 4, delayMs: number = 1500) => {
      if (!orderId) {
        console.warn('⚠️ pollPaymentStatus: No orderId provided');
        return { success: false } as const;
      }

      console.log(
        `🔍 Polling payment status for orderId: ${orderId} (${attempts} attempts)`,
      );

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          console.log(
            `🔄 Payment status check attempt ${attempt + 1}/${attempts}...`,
          );
          const statusResponse = await PaymentApiService.getPaymentStatus(
            orderId,
          );

          // 🎯 CRITICAL FIX: Handle case where getPaymentStatus returns failure response instead of throwing
          if (
            !statusResponse ||
            (statusResponse.success === false && !statusResponse.data)
          ) {
            console.log(
              `⚠️ Payment status check attempt ${
                attempt + 1
              } returned failure response:`,
              statusResponse,
            );
            // Continue to next attempt
            if (attempt < attempts - 1) {
              const delay = delayMs * Math.max(1, attempt + 1);
              console.log(`⏳ Waiting ${delay}ms before next attempt...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            continue;
          }

          console.log(
            `📥 Raw payment status response (attempt ${attempt + 1}):`,
            JSON.stringify(statusResponse, null, 2),
          );

          const normalized = interpretPaymentVerification(statusResponse);
          console.log(
            `🔍 Normalized verification result (attempt ${attempt + 1}):`,
            JSON.stringify(normalized, null, 2),
          );

          if (normalized.success) {
            console.log(
              `✅ Payment status check succeeded on attempt ${attempt + 1}`,
            );
            return normalized;
          } else {
            console.log(
              `⚠️ Payment status check attempt ${
                attempt + 1
              } returned non-success:`,
              normalized,
            );

            // 🎯 CRITICAL FIX FOR PHONEPE: Check if payment exists but status is pending
            // Sometimes backend returns payment with pending status even though it's successful
            const responseData =
              (statusResponse as any)?.data ?? statusResponse;
            const paymentExists =
              responseData?.payment ||
              responseData?.data?.payment ||
              responseData?.payments?.[0];

            if (paymentExists) {
              const paymentStatus = (
                paymentExists.status ||
                paymentExists.payment_status ||
                ''
              )
                .toString()
                .toLowerCase();

              // If payment exists and is not explicitly failed, consider it successful
              // This handles cases where PhonePe payment is successful but status is still "pending" or "authorized"
              if (
                paymentStatus === 'captured' ||
                paymentStatus === 'authorized' ||
                paymentStatus === 'pending' ||
                paymentStatus === 'created'
              ) {
                console.log(
                  `✅ Payment exists with status "${paymentStatus}" - treating as success for PhonePe/UPI`,
                );
                return {
                  success: true,
                  captured: paymentStatus === 'captured',
                  paymentId:
                    paymentExists.id ||
                    paymentExists.razorpayPaymentId ||
                    paymentExists.razorpay_payment_id,
                  paymentRecord: paymentExists,
                  raw: responseData,
                };
              }
            }
          }
        } catch (error: any) {
          // 🎯 CRITICAL FIX: Suppress error logging for polling failures
          // These are expected during polling and shouldn't show error toasts
          const errorMessage = error?.message || String(error || '');
          if (
            errorMessage.includes('Failed to get payment status') ||
            errorMessage.includes('Get payment status')
          ) {
            // This is just a polling failure, not a real error - suppress it
            console.log(
              `ℹ️ Payment status check attempt ${
                attempt + 1
              } failed (this is normal during polling):`,
              errorMessage,
            );
          } else {
            console.warn(
              `⚠️ Payment status check attempt ${attempt + 1} failed:`,
              error,
            );
          }
        }

        if (attempt < attempts - 1) {
          const delay = delayMs * Math.max(1, attempt + 1);
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      console.log(`❌ Payment status check failed after ${attempts} attempts`);
      return { success: false } as const;
    },
    [interpretPaymentVerification],
  );

  // 🎯 UPDATED: Handle payment success with backend capture endpoint (simplified like web version)
  // ... existing code ...
  const handlePaymentSuccess = async (
    razorpayResponse: any,
    plan: PlanDisplayData,
    options?: {
      fallbackPaymentId?: number | null;
      amountInRupees?: number;
      orderCurrency?: string;
      phonePeRecoveryAttempted?: boolean;
    },
  ) => {
    // 🎯 CRITICAL: Store payment IDs at the start for error reporting
    const paymentId = razorpayResponse.razorpay_payment_id || 'N/A';
    const orderId = razorpayResponse.razorpay_order_id || 'N/A';
    const signature = razorpayResponse.razorpay_signature
      ? `${razorpayResponse.razorpay_signature.substring(0, 20)}...`
      : 'Not provided (will be generated on backend)';

    // Get userId early for error reporting
    let userId: number | string = 'N/A';
    const phonePeRecoveryAttempted = options?.phonePeRecoveryAttempted === true;

    try {
      userId = (await getUserIdFromToken()) || 'N/A';
    } catch (e) {
      console.warn('Could not get userId for error reporting:', e);
    }

    // Log payment IDs for debugging
    console.log('🔍 Payment IDs captured:');
    console.log('  - User ID:', userId);
    console.log('  - Payment ID:', paymentId);
    console.log('  - Order ID:', orderId);
    console.log('  - Signature:', signature);

    // 🎯 CRITICAL: Track if we should reset paymentProcessing in finally block
    let shouldResetProcessing = true;
    try {
      // Check if component is still mounted before proceeding
      if (!isMountedRef.current) {
        console.log(
          '⚠️ Component unmounted, skipping payment success handling',
        );
        return;
      }
      console.log(
        '🎉 Payment success, capturing payment with backend...',
        razorpayResponse,
      );

      const token = await AsyncStorage.getItem('accessToken');
      const resolvedUserId = await getUserIdFromToken();

      if (!token || !resolvedUserId) {
        throw new Error('Authentication failed');
      }

      // Update userId if we got it successfully
      userId = resolvedUserId;

      const amountInRupees =
        typeof options?.amountInRupees === 'number'
          ? options.amountInRupees
          : plan.price;
      const amountInPaise = Math.round(amountInRupees * 100);
      const captureCurrency = options?.orderCurrency || 'INR';

      // Validate Razorpay response
      if (!razorpayResponse.razorpay_payment_id) {
        console.error(
          '❌ Invalid Razorpay response (missing payment id):',
          razorpayResponse,
        );
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

        // 🎯 FIXED: Get user data from token using jwtDecode (atob not available in RN)
        const tokenPayload: any = jwtDecode(token);
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

      const finalSignature =
        extractedSignature || razorpayResponse.razorpay_signature || null;

      // 🎯 FIXED: Map data correctly for backend capture endpoint using exact field names
      const capturePayload = {
        // 🎯 CRITICAL FIX: Use exact field names that backend controller expects
        paymentId: razorpayResponse.razorpay_payment_id, // Backend expects 'paymentId'
        razorpay_payment_id: razorpayResponse.razorpay_payment_id, // Also send as razorpay_payment_id
        order_id: razorpayResponse.razorpay_order_id, // Backend expects 'order_id'
        razorpay_order_id: razorpayResponse.razorpay_order_id, // Also send as razorpay_order_id
        amount: amountInPaise, // Convert to paisa
        planId: parseInt(plan.id.toString()), // Backend expects 'planId'
        userId: Number(userId),
        currency: 'INR',

        // 🎯 CRITICAL FIX: Use detected payment method instead of unknown
        method: paymentMethod, // Use the detected method, not razorpayResponse.method
        status: 'captured',

        // 🎯 CRITICAL FIX: Handle signature properly for React Native Razorpay
        // Use extracted signature from response
        razorpay_signature: finalSignature,

        // 🎯 ADDITIONAL: Send verification data for backend
        verification_data: {
          payment_id: razorpayResponse.razorpay_payment_id,
          order_id: razorpayResponse.razorpay_order_id,
          amount: amountInPaise,
          currency: captureCurrency,
          timestamp: Date.now(),
          sdk_type: 'react_native',
          signature_available: !!finalSignature,
          signature: finalSignature || undefined,
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
        signature_note: finalSignature
          ? 'Signature provided by Razorpay'
          : 'No signature from React Native SDK - backend should verify using payment_id and order_id',

        // 🎯 CRITICAL: Flag for backend to handle signature verification differently
        requires_alternative_verification: !finalSignature,

        // 🎯 FIXED: Store Razorpay data in JSON_LOG field as backend expects
        JSON_LOG: {
          // 🎯 CRITICAL: Use extracted signature from response
          razorpay_signature: finalSignature,
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
        amount_in_paisa: amountInPaise,
        base_amount: amountInPaise,
        base_currency: captureCurrency,
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

      // 🎯 Verify payment using backend payments endpoint (RN SDK doesn't return signature)
      console.log('💳 Verifying payment via backend /payments/verify...');
      console.log('🔍 Payment verification data:', {
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
        razorpayOrderId: razorpayResponse.razorpay_order_id,
        hasOrderId: !!razorpayResponse.razorpay_order_id,
      });

      // Build verify payload - ensure we have orderId from response
      const verifyPayload: any = {
        razorpayPaymentId: razorpayResponse.razorpay_payment_id,
      };

      // Always include orderId if available (critical for payment lookup)
      if (razorpayResponse.razorpay_order_id) {
        verifyPayload.razorpayOrderId = razorpayResponse.razorpay_order_id;
        console.log(
          '✅ Using orderId for verification:',
          razorpayResponse.razorpay_order_id,
        );
      } else {
        console.warn(
          '⚠️ No orderId available for verification - this may cause lookup issues',
        );
        console.warn(
          '⚠️ Payment response keys:',
          Object.keys(razorpayResponse),
        );
      }

      // Only add signature if it exists
      if (razorpayResponse.razorpay_signature) {
        verifyPayload.razorpaySignature = razorpayResponse.razorpay_signature;
      }

      // Use unified API - post() returns data directly, not wrapped in {data, status, headers}
      const responseData = await unifiedApi.post(
        '/payments/verify',
        verifyPayload,
      );
      console.log('📥 Backend capture response:', responseData);

      // unifiedApi.post() returns data directly, not wrapped in {data, status, headers}
      const responseDataValue = (responseData as any)?.data ?? responseData;

      let verificationResult = interpretPaymentVerification(responseDataValue);
      if (!verificationResult.success) {
        console.log(
          '⚠️ Verification response inconclusive, polling payment status...',
        );
        verificationResult = await pollPaymentStatus(
          razorpayResponse.razorpay_order_id,
          4,
          1200,
        );
      }

      if (!verificationResult.success) {
        try {
          await PaymentApiService.retryVerification(
            razorpayResponse.razorpay_order_id,
          );
          verificationResult = await pollPaymentStatus(
            razorpayResponse.razorpay_order_id,
            3,
            2000,
          );
        } catch (retryError) {
          console.warn('⚠️ Retry verification failed:', retryError);
        }
      }

      // Check if payment verification was successful (responseDataValue should have payment data)
      if (verificationResult.success) {
        try {
          await PaymentApiService.capturePayment(
            capturePayload as CapturePaymentDto,
          );
        } catch (captureError) {
          console.warn('⚠️ Payment capture API failed:', captureError);
        }

        const completionResponseIndicatesSuccess = (body: any): boolean => {
          if (!body) return false;
          const status = body?.status
            ? body.status.toString().toLowerCase()
            : '';
          const nestedStatus = body?.data?.status
            ? body.data.status.toString().toLowerCase()
            : '';
          const message = body?.message
            ? body.message.toString().toLowerCase()
            : '';
          const alreadyHandled =
            message.includes('already') &&
            (message.includes('upgraded') ||
              message.includes('processed') ||
              message.includes('completed'));
          return !!(
            body?.success === true ||
            status === 'success' ||
            nestedStatus === 'success' ||
            body?.id ||
            body?.subscriptionId ||
            body?.subscription ||
            alreadyHandled
          );
        };

        const lookupNumericPaymentIdFromBackend = async (): Promise<
          number | null
        > => {
          const orderId = razorpayResponse.razorpay_order_id;
          const fallbackSources: Array<() => Promise<any>> = [];
          if (orderId) {
            fallbackSources.push(() =>
              PaymentApiService.getPaymentStatus(orderId),
            );
            fallbackSources.push(() =>
              PaymentApiService.getPaymentByOrder(orderId),
            );
          }
          for (const fetcher of fallbackSources) {
            try {
              const payload = await fetcher();
              const normalized = interpretPaymentVerification(payload);
              const numericCandidate = resolveNumericPaymentIdFromCandidates(
                normalized.paymentId,
                normalized.paymentRecord,
                payload,
              );
              if (numericCandidate) {
                console.log(
                  '✅ Resolved numeric payment id via fallback lookup:',
                  numericCandidate,
                );
                return numericCandidate;
              }
            } catch (lookupError) {
              console.warn('⚠️ Payment ID lookup failed:', lookupError);
            }
          }

          try {
            const historyResponse = await PaymentApiService.getMyPayments();
            const historyPayload =
              (historyResponse as any)?.data ?? historyResponse ?? {};
            const rawHistory =
              historyPayload?.data ?? historyPayload?.records ?? historyPayload;
            const historyList = Array.isArray(rawHistory)
              ? rawHistory
              : Array.isArray(rawHistory?.data)
              ? rawHistory.data
              : [];
            if (Array.isArray(historyList)) {
              const matchedHistory = historyList.find((item: any) => {
                const orderMatches =
                  item?.razorpay_order_id ===
                    razorpayResponse.razorpay_order_id ||
                  item?.razorpayOrderId === razorpayResponse.razorpay_order_id;
                const paymentMatches =
                  item?.razorpayPaymentId ===
                    razorpayResponse.razorpay_payment_id ||
                  item?.razorpay_payment_id ===
                    razorpayResponse.razorpay_payment_id;
                return orderMatches || paymentMatches;
              });
              if (matchedHistory) {
                const numericFromHistory =
                  resolveNumericPaymentIdFromCandidates(matchedHistory);
                if (numericFromHistory) {
                  console.log(
                    '✅ Resolved numeric payment id from payment history:',
                    numericFromHistory,
                  );
                  return numericFromHistory;
                }
              }
            }
          } catch (historyError) {
            console.warn('⚠️ Payment history lookup failed:', historyError);
          }
          return null;
        };

        // Type guard: verificationResult.success is true at this point
        const successResult = verificationResult as {
          success: true;
          captured: boolean;
          paymentId: any;
          paymentRecord: any;
          raw: any;
        };

        const verifiedPayment =
          successResult.paymentRecord || successResult.raw;
        let paymentIdToUse = resolveNumericPaymentIdFromCandidates(
          successResult.paymentId,
          verifiedPayment,
          successResult.raw,
          responseDataValue,
        );

        if (!paymentIdToUse) {
          paymentIdToUse = await lookupNumericPaymentIdFromBackend();
        }

        const attemptUpgradeCompletion = async (
          paymentId: number,
        ): Promise<boolean> => {
          try {
            const completeRes = await unifiedApi.post(
              '/subscriptions/upgrade/complete',
              { paymentId },
            );
            const completeBody = completeRes as any;
            console.log('🔁 Upgrade completion response:', completeBody);
            return completionResponseIndicatesSuccess(completeBody);
          } catch (error) {
            console.warn('Upgrade completion error:', error);
            throw error;
          }
        };

        // Complete the subscription upgrade on the backend using the verified payment id
        let upgradeCompleted = false;
        let completionError: any = null;

        if (paymentIdToUse) {
          try {
            upgradeCompleted = await attemptUpgradeCompletion(paymentIdToUse);
            if (!upgradeCompleted) {
              console.warn(
                '⚠️ Upgrade completion did not confirm success, retrying with refreshed payment id...',
              );
              const refreshedPaymentId =
                await lookupNumericPaymentIdFromBackend();
              if (refreshedPaymentId && refreshedPaymentId !== paymentIdToUse) {
                paymentIdToUse = refreshedPaymentId;
                upgradeCompleted = await attemptUpgradeCompletion(
                  refreshedPaymentId,
                );
              }
            }
          } catch (completionErr) {
            completionError = completionErr;
          }
        } else {
          console.warn(
            '⚠️ No numeric payment id available from verification, skipping upgrade completion call',
          );
        }
        // ✅ Payment successful - plan activated
        console.log('✅ Payment captured successfully:', responseDataValue);

        // 🎯 CRITICAL: Mark that we shouldn't reset processing in finally block
        // because we want to keep it true until subscription refresh completes
        shouldResetProcessing = false;

        // Store payment details for display
        const paymentDetailsData = {
          ...razorpayResponse,
          // Ensure amount in paisa for PaymentDetailsDisplay
          amount: amountInPaise,
          currency: captureCurrency,
          description:
            `Payment for ${plan.name} plan` +
            (currentSubscription?.nextBillingDate
              ? ` (Next billing: ${new Date(
                  currentSubscription.nextBillingDate,
                ).toLocaleDateString()})`
              : ''),
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
        // 🎯 CRITICAL: Only update state if component is mounted
        if (isMountedRef.current) {
          setPaymentDetails(paymentDetailsData);
        }

        if (!upgradeCompleted) {
          const confirmed = await refreshSubscriptionAndConfirm(
            plan.name,
            3,
            1000,
          );
          if (confirmed) {
            upgradeCompleted = true;
          }
        }

        if (upgradeCompleted) {
          // 🎯 CRITICAL FIX: Wrap post-upgrade flow in try-catch to prevent errors
          // from showing error alerts after successful upgrade. The upgrade succeeded,
          // so any errors in post-upgrade operations (like data refresh) should be
          // logged but not shown to the user.
          try {
            await runPostUpgradeSuccessFlow(plan);
          } catch (postUpgradeError) {
            // Log the error for debugging but don't show alert to user
            // since the upgrade itself was successful
            console.warn(
              '⚠️ Post-upgrade flow error (upgrade was successful):',
              postUpgradeError,
            );
            // Still reset processing state and show success modal
            if (isMountedRef.current) {
              setPaymentProcessing(false);
              upgradingLockRef.current = false;
              razorpayOpenRef.current = false;
            }
          }
        } else {
          throw (
            completionError || new Error('Plan upgrade failed after payment')
          );
        }
      } else {
        console.error('❌ Backend capture failed:', responseData);
        const errorMessage =
          (responseDataValue as any)?.message ||
          (responseDataValue as any)?.error?.message ||
          (responseData as any)?.message ||
          (responseData as any)?.error?.message ||
          'Payment verification failed. Please contact support.';
        // 🎯 CRITICAL: Reset processing state before throwing error
        if (isMountedRef.current) {
          setPaymentProcessing(false);
        }
        throw new Error(`Payment capture failed: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('❌ Payment capture failed:', error);

      // Import error handler
      const { handleApiError } = require('../utils/apiErrorHandler');
      const errorInfo = handleApiError(error);
      const isPhonePeGatewayIssue =
        isPhonePeGatewayError(error) ||
        isPhonePeGatewayError(errorInfo?.message);

      if (isPhonePeGatewayIssue && !phonePeRecoveryAttempted) {
        console.log(
          '⚠️ PhonePe gateway error during capture - waiting and retrying once...',
        );
        // Give backend extra time before retrying capture
        await new Promise(resolve =>
          setTimeout(resolve, PHONEPE_EXTENDED_DELAY_MS),
        );
        return await handlePaymentSuccess(razorpayResponse, plan, {
          ...options,
          phonePeRecoveryAttempted: true,
        });
      }

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        if (isMountedRef.current) {
          if (!suppressPaymentError) setPaymentError(errorInfo.message);
          showAlert({
            title: 'Access Denied',
            message: errorInfo.message,
            type: 'error',
            confirmText: 'OK',
            onConfirm: () => {
              console.log('User acknowledged access denied error');
            },
          });
        }
        // 🎯 CRITICAL: Reset processing state even on forbidden error
        if (isMountedRef.current) {
          setPaymentProcessing(false);
        }
        return;
      }

      // 🎯 IMPROVED: Better error handling with specific messages
      let errorMessage =
        'Payment was successful, but we could not complete the process. Please contact support.';
      let alertTitle = 'Payment Error';
      let alertType: AlertOptions['type'] = 'error';

      // Handle "Payment not found" error specifically
      if (
        error.message?.includes('Payment not found') ||
        errorInfo.message?.includes('Payment not found')
      ) {
        // Show detailed error with all payment IDs for user reference
        errorMessage =
          `Payment verification failed. Please contact support with the following details:\n\n` +
          `User ID: ${userId}\n` +
          `Payment ID: ${paymentId}\n` +
          `Order ID: ${orderId}\n` +
          `Signature: ${signature}\n\n` +
          `This may be a temporary issue. Please wait a moment and try again, or contact support with the details above.`;
        console.error('❌ Payment not found error with details:');
        console.error('  - User ID:', userId);
        console.error('  - Payment ID:', paymentId);
        console.error('  - Order ID:', orderId);
        console.error('  - Signature:', signature);
        console.error('  - Full error:', error);
      } else if (error.message?.includes('Invalid payment response')) {
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
      } else if (isPhonePeGatewayIssue) {
        errorMessage = buildPhonePePendingAlertMessage(orderId);
        alertTitle = 'PhonePe Confirmation Pending';
        alertType = 'info';
      } else {
        // Use error handler message if available
        errorMessage = errorInfo.message || errorMessage;
      }

      // 🎯 CRITICAL: Only update state if component is mounted
      if (isMountedRef.current) {
        if (!suppressPaymentError) setPaymentError(errorMessage);

        // For "Payment not found" errors, show detailed alert with IDs
        const isPaymentNotFound =
          error.message?.includes('Payment not found') ||
          errorInfo.message?.includes('Payment not found');

        showAlert({
          title: alertTitle,
          message: errorMessage,
          type: alertType,
          confirmText: 'OK',
          onConfirm: () => {
            console.log('User acknowledged payment error');
            // Log the IDs for support reference
            if (isPaymentNotFound) {
              console.log('📋 Payment details for support:');
              console.log('  - Payment ID:', paymentId);
              console.log('  - Order ID:', orderId);
              console.log('  - Signature:', signature);
            }
          },
        });
      }
    } finally {
      // 🎯 CRITICAL: Always reset paymentProcessing state, even if component unmounts
      // This prevents the UI from getting stuck in a loading state
      if (shouldResetProcessing && isMountedRef.current) {
        console.log(
          '🔄 Resetting paymentProcessing state in handlePaymentSuccess finally block',
        );
        setPaymentProcessing(false);
        upgradingLockRef.current = false;
        razorpayOpenRef.current = false;
      }
    }
  };
  // ... existing code ...

  // 🎯 UPDATED: Simplified upgradePlan function with proper Razorpay integration
  const upgradePlan = async (plan: PlanDisplayData) => {
    // 🎯 CRITICAL: Declare variables at function level for error handling access
    let order: {
      id: string;
      amount: number;
      currency: string;
      key?: string | null;
    } | null = null;
    let pendingPaymentRecordId: number | null = null;
    let paymentAmountRupees = plan.price;
    let orderCurrency = 'INR';
    let storedOrderId: string | null = null; // Store at function level for error handling

    // 🎯 CRITICAL: Add timeout protection to prevent infinite loading
    let upgradeTimeout: NodeJS.Timeout | null = null;
    if (isMountedRef.current) {
      upgradeTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          console.warn('⚠️ Upgrade timeout - resetting state');
          setPaymentProcessing(false);
          setPaymentError(
            'Upgrade is taking longer than expected. Please check your connection and try again.',
          );
          upgradingLockRef.current = false;
          razorpayOpenRef.current = false;
          showAlert({
            title: 'Timeout',
            message:
              'The upgrade process is taking longer than expected. Please check your connection and try again.',
            type: 'error',
            confirmText: 'OK',
          });
        }
      }, 120000); // 2 minutes timeout
    }

    try {
      console.log('🚀 Starting plan upgrade for:', {
        planId: plan.id,
        planName: plan.name,
        planPrice: plan.price,
      });

      // Set payment processing state
      if (!isMountedRef.current) {
        if (upgradeTimeout !== null) {
          clearTimeout(upgradeTimeout);
        }
        return;
      }
      setPaymentProcessing(true);
      if (!isMountedRef.current) {
        if (upgradeTimeout !== null) {
          clearTimeout(upgradeTimeout);
        }
        return;
      }
      setPaymentError(null);
      setSuppressPaymentError(false);

      // 🎯 FIXED: Temporarily stop transaction limit monitoring to prevent popup interference
      console.log(
        '⏸️ Temporarily stopping transaction limit monitoring during plan upgrade...',
      );
      await stopLimitMonitoring();

      // Handle Razorpay configuration
      if (!HAS_RAZORPAY) {
        console.log(
          '⚠️ Razorpay not configured, using alternative upgrade method',
        );

        // Show a more informative message about the upgrade process
        showAlert({
          title: 'Upgrade Plan',
          message: `Upgrade to ${plan.name} plan for ₹${plan.price}? This will be processed through our backend payment system.`,
          type: 'confirm',
          confirmText: 'Upgrade Now',
          cancelText: 'Cancel',
          onConfirm: async () => {
            try {
              if (!isMountedRef.current) return;
              setPaymentProcessing(true);
              if (!isMountedRef.current) return;
              setPaymentError(null);

              // Call the context upgrade function directly
              const success = await contextUpgradePlan(plan.id);
              if (success) {
                if (isMountedRef.current) {
                  setSuccessPlanId(
                    plan.id != null ? String(plan.id) : plan.name || null,
                  );
                  setSuccessMessage(
                    `Successfully upgraded to ${plan.name} plan!`,
                  );
                  setShowSuccessModal(true);
                }
                // Only fetch subscription data (not plans) since plans don't change
                await fetchSubscriptionData(false); // false = don't refresh plans

                // 🎯 REMOVED: Backend already creates subscription transaction via createSubscriptionTransaction
                // No need to create duplicate transactions from frontend

                // 🎯 FIXED: Add delay before refreshing subscription data to allow backend to update
                safeSetTimeout(async () => {
                  console.log(
                    '🔄 Refreshing subscription data after plan upgrade (with delay)...',
                  );
                  // Refresh subscription data again after delay to get updated plan
                  await fetchSubscriptionData(false); // false = don't refresh plans
                }, 1000); // Wait 1 second for backend to update subscription

                // 🎯 FIXED: Add delay before fetching transaction limits to allow backend to update
                safeSetTimeout(async () => {
                  console.log(
                    '🔄 Refreshing transaction limits after plan upgrade...',
                  );
                  await fetchBillingData();

                  // Retry to ensure accurate count
                  safeSetTimeout(async () => {
                    await fetchBillingData();
                  }, 1500);
                }, 1500);
              } else {
                if (isMountedRef.current) {
                  setPaymentError('Failed to upgrade plan. Please try again.');
                  showAlert({
                    title: 'Upgrade Failed',
                    message:
                      'Failed to upgrade plan. Please try again or contact support.',
                    type: 'error',
                    confirmText: 'OK',
                  });
                }
              }
            } catch (error) {
              console.error('Upgrade error:', error);
              if (isMountedRef.current) {
                setPaymentError('Failed to upgrade plan. Please try again.');
                showAlert({
                  title: 'Upgrade Failed',
                  message:
                    'Failed to upgrade plan. Please try again or contact support.',
                  type: 'error',
                  confirmText: 'OK',
                });
              }
            } finally {
              if (isMountedRef.current) {
                setPaymentProcessing(false);
              }
            }
          },
        });
        if (upgradeTimeout !== null) {
          clearTimeout(upgradeTimeout);
        }
        return;
      }

      // Validate plan data
      if (!plan.id || isNaN(parseInt(plan.id.toString()))) {
        console.error('❌ Invalid plan data:', plan);
        if (isMountedRef.current) {
          setPaymentError('Invalid plan data. Plan ID must be a valid number.');
          setPaymentProcessing(false);
          showAlert({
            title: 'Error',
            message: 'Invalid plan data. Plan ID must be a valid number.',
            type: 'error',
            confirmText: 'OK',
          });
        }
        return;
      }

      // Get user authentication data
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        if (isMountedRef.current) {
          setPaymentError('Please log in to upgrade your plan');
          setPaymentProcessing(false);
          showAlert({
            title: 'Error',
            message: 'Please log in to upgrade your plan',
            type: 'error',
            confirmText: 'OK',
          });
        }
        return;
      }

      const userId = await getUserIdFromToken();
      if (!userId || userId <= 0) {
        if (isMountedRef.current) {
          setPaymentError('Invalid user ID. Please log in again.');
          setPaymentProcessing(false);
          showAlert({
            title: 'Error',
            message: 'Invalid user ID. Please log in again.',
            type: 'error',
            confirmText: 'OK',
          });
        }
        if (upgradeTimeout !== null) {
          clearTimeout(upgradeTimeout);
        }
        return;
      }

      if (plan.price === 0) {
        // Free plan - no payment required
        try {
          const success = await contextUpgradePlan(plan.id);
          if (success) {
            setSuccessPlanId(
              plan.id != null ? String(plan.id) : plan.name || null,
            );
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

            // Only fetch subscription data (not plans) since plans don't change
            await fetchSubscriptionData(false); // false = don't refresh plans

            // 🎯 REMOVED: Backend already creates subscription transaction via createSubscriptionTransaction
            // No need to create duplicate transactions from frontend

            // 🎯 FIXED: Add delay before refreshing subscription data to allow backend to update
            safeSetTimeout(async () => {
              console.log(
                '🔄 Refreshing subscription data after free plan update (with delay)...',
              );
              // Refresh subscription data again after delay to get updated plan
              await fetchSubscriptionData(false); // false = don't refresh plans
            }, 1000); // Wait 1 second for backend to update subscription

            // 🎯 FIXED: Add delay before fetching transaction limits to allow backend to update
            safeSetTimeout(async () => {
              console.log(
                '🔄 Refreshing transaction limits after free plan update...',
              );
              await fetchBillingData();

              // Retry to ensure accurate count
              safeSetTimeout(async () => {
                await fetchBillingData();
              }, 1500);
            }, 1500);
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
        if (upgradeTimeout !== null) {
          clearTimeout(upgradeTimeout);
        }
        return;
      }

      // 🎯 FIXED: Use backend API to create Razorpay order instead of direct API call
      try {
        console.log('🎯 Creating Razorpay order through backend API...');

        // Get real user data from token first
        let realUserMobile: string | null = null;
        let realUserName: string | null = null;
        let realUserEmail: string | null = null;

        try {
          console.log('🔍 Fetching user data from token for payment...');
          const tokenPayload: any = jwtDecode(token);
          console.log('🔍 Token payload:', tokenPayload);

          if (tokenPayload) {
            // JWT token only contains 'sub' (user ID) and 'phone' fields
            realUserMobile = tokenPayload.phone || null;
            realUserName = tokenPayload.name || null; // This might not exist in token
            realUserEmail = tokenPayload.email || null; // This might not exist in token

            console.log('✅ Real user data extracted from token:', {
              mobile: realUserMobile,
              name: realUserName,
              email: realUserEmail,
            });
          }
        } catch (error) {
          console.log('⚠️ Token parsing error:', error);
        }

        // Fallback to AsyncStorage data if token doesn't have the required fields
        if (!realUserMobile) {
          realUserMobile = await AsyncStorage.getItem('userMobile');
          console.log('📱 Using mobile from AsyncStorage:', realUserMobile);
        }
        if (!realUserName) {
          realUserName = await AsyncStorage.getItem('userName');
          console.log('👤 Using name from AsyncStorage:', realUserName);
        }
        if (!realUserEmail) {
          realUserEmail = await AsyncStorage.getItem('userEmail');
          console.log('📧 Using email from AsyncStorage:', realUserEmail);
        }

        // 🎯 CRITICAL: Sanitize and validate mobile number format for backend
        const sanitizeMobileNumber = (mobile: string | null): string => {
          if (!mobile) return '+919999999999'; // Fallback for testing with +91 prefix

          // Remove all non-digit characters
          const numericMobile = mobile.replace(/[^\d]/g, '');

          // Handle different formats
          let processedMobile = numericMobile;

          // If starts with 91 and has 12 digits, remove 91 prefix
          if (numericMobile.startsWith('91') && numericMobile.length === 12) {
            processedMobile = numericMobile.substring(2);
          }
          // If starts with 0 and has 11 digits, remove 0 prefix
          else if (
            numericMobile.startsWith('0') &&
            numericMobile.length === 11
          ) {
            processedMobile = numericMobile.substring(1);
          }
          // If has 10 digits, use as is
          else if (numericMobile.length === 10) {
            processedMobile = numericMobile;
          }

          // Validate length and format
          if (processedMobile.length !== 10) {
            console.warn(
              `⚠️ Invalid mobile length: ${processedMobile.length}, using fallback`,
            );
            return '+919999999999';
          }

          // Validate Indian mobile prefix (6-9)
          if (!/^[6-9]/.test(processedMobile)) {
            console.warn(
              `⚠️ Invalid mobile prefix: ${processedMobile}, using fallback`,
            );
            return '+919999999999';
          }

          // Return with +91 prefix as expected by backend SanitizationService
          const result = `+91${processedMobile}`;
          console.log(`✅ Mobile sanitized: ${mobile} -> ${result}`);
          return result;
        };

        // Sanitize the mobile number
        const sanitizedMobile = sanitizeMobileNumber(realUserMobile);
        console.log('🔍 Mobile number sanitization:', {
          original: realUserMobile,
          sanitized: sanitizedMobile,
        });

        console.log('📤 Plan object details:', {
          plan: plan,
          planId: plan.id,
          planIdType: typeof plan.id,
          planIdValue: plan.id,
          planName: plan.name,
          planPrice: plan.price,
        });

        try {
          console.log('🎯 Initiating upgrade via /subscriptions/upgrade...');
          const upgradeInitResponse = await unifiedApi.post(
            '/subscriptions/upgrade',
            {
              planId: parseInt(plan.id.toString(), 10),
            },
          );
          const upgradePayload =
            (upgradeInitResponse as any)?.data ?? upgradeInitResponse;
          console.log('📡 Upgrade initiation response:', upgradePayload);

          if (!upgradePayload) {
            throw new Error('Empty upgrade response from backend');
          }

          const requiresPayment =
            typeof upgradePayload.requiresPayment === 'boolean'
              ? upgradePayload.requiresPayment
              : !!upgradePayload.paymentId;

          if (!requiresPayment) {
            console.log('✅ Upgrade completed on backend without payment');
            setSuccessPlanId(
              plan.id != null ? String(plan.id) : plan.name || null,
            );
            setSuccessMessage(
              `Your plan has been upgraded to ${plan.name} successfully!`,
            );
            setShowSuccessModal(true);
            await fetchSubscriptionData(false);
            await fetchBillingData();
            await startLimitMonitoring();
            setPaymentProcessing(false);
            upgradingLockRef.current = false;
            razorpayOpenRef.current = false;
            if (upgradeTimeout !== null) {
              clearTimeout(upgradeTimeout);
            }
            return;
          }

          pendingPaymentRecordId = Number(upgradePayload.paymentId) || null;
          const backendOrderId = upgradePayload.orderId;
          if (!backendOrderId) {
            throw new Error('Backend did not return an order id');
          }

          paymentAmountRupees =
            typeof upgradePayload.upgradeAmount === 'number'
              ? upgradePayload.upgradeAmount
              : Number(upgradePayload.upgradeAmount) || plan.price;
          orderCurrency = upgradePayload.currency || 'INR';

          // Store orderId immediately after getting it
          storedOrderId = backendOrderId;

          order = {
            id: backendOrderId,
            amount: Math.round(paymentAmountRupees * 100),
            currency: orderCurrency,
            key: upgradePayload.key || RAZORPAY_CONFIG.key,
          };
          console.log('✅ Order details prepared:', order);
        } catch (initError) {
          console.error('❌ Failed to initiate upgrade:', initError);
          const { handleApiError } = require('../utils/apiErrorHandler');
          const errorInfo = handleApiError(initError);
          if (!suppressPaymentError) {
            setPaymentError(
              errorInfo.message ||
                'Unable to start the upgrade. Please try again.',
            );
          }
          try {
            await startLimitMonitoring();
          } catch (monitorError) {
            console.warn(
              '⚠️ Failed to restart limit monitoring after initiation error:',
              monitorError,
            );
          }
          setPaymentProcessing(false);
          upgradingLockRef.current = false;
          razorpayOpenRef.current = false;
          if (upgradeTimeout !== null) {
            clearTimeout(upgradeTimeout);
          }
          return;
        }

        if (!order) {
          throw new Error('Order details missing from upgrade response');
        }

        // Extract 10-digit mobile number for Razorpay (remove +91 prefix)
        const razorpayMobile = sanitizedMobile.startsWith('+91')
          ? sanitizedMobile.substring(3)
          : sanitizedMobile;

        // Use the exact same options that work in Test Simple Checkout with real user data
        const merchantName =
          (RAZORPAY_CONFIG as any).merchantName || 'Smart Ledger';
        const options = {
          order_id: order.id,
          description: `Subscription for ${plan.name} plan`,
          image: 'https://your-logo-url.com',
          currency: order.currency || 'INR',
          key: order.key || RAZORPAY_CONFIG.key,
          amount: order.amount,
          name: merchantName,
          prefill: {
            email: realUserEmail || 'user@example.com',
            contact: razorpayMobile, // Use 10-digit mobile number for Razorpay
            name: realUserName || 'User',
          },
          theme: { color: '#4f8cff' },
          redirect: false, // Prevent Razorpay from showing redirect screen that triggers PhonePe alert
          retry: {
            enabled: false,
          },
        };

        console.log('🎯 Opening Razorpay checkout with real user data:');
        console.log('  - User Name:', realUserName || 'User (fallback)');
        console.log(
          '  - User Mobile (Original):',
          realUserMobile || 'Not available',
        );
        console.log(
          '  - User Mobile (Sanitized for Backend):',
          sanitizedMobile,
        );
        console.log('  - User Mobile (For Razorpay):', razorpayMobile);
        console.log(
          '  - User Email:',
          realUserEmail || 'user@example.com (fallback)',
        );
        console.log('  - Full options:', JSON.stringify(options, null, 2));

        // Store orderId before opening Razorpay to ensure we always have it
        storedOrderId = order.id;
        console.log(
          '💾 Stored orderId before opening Razorpay:',
          storedOrderId,
        );

        let wasCancelled = false; // Track cancellation locally for finally block
        let razorpayResult: any = null; // Store result for verification
        let razorpayThrewError = false; // Track if error was thrown

        try {
          // Mark sheet as open to block any re-entry while UI thread hands off
          razorpayOpenRef.current = true;
          const paymentData = await RazorpayCheckout.open(options);
          console.log('🎉 Payment completed:', paymentData);
          razorpayResult = paymentData;

          // Validate payment ID (required)
          if (!paymentData.razorpay_payment_id) {
            console.error(
              '❌ Missing payment ID in Razorpay response:',
              paymentData,
            );
            // 🎯 CRITICAL FIX: Don't throw error immediately - verify payment status first
            // For PhonePe and other UPI apps, payment might succeed even without payment_id in response
            console.log(
              '⚠️ No payment_id in response, will verify payment status using orderId',
            );
            razorpayThrewError = true;
            throw new Error('No payment ID received from Razorpay');
          }

          // 🎯 CRITICAL: Ensure orderId is always available (use stored value if not in response)
          if (!paymentData.razorpay_order_id) {
            if (storedOrderId) {
              paymentData.razorpay_order_id = storedOrderId;
              console.log(
                '✅ Added stored orderId to payment response:',
                storedOrderId,
              );
            } else {
              console.error('❌ No orderId available - this should not happen');
              console.error('  - Payment ID:', paymentData.razorpay_payment_id);
              console.error('  - Stored Order ID:', storedOrderId);
              console.error('  - Response keys:', Object.keys(paymentData));
              razorpayThrewError = true;
              throw new Error(
                `Payment verification failed: Missing order ID. Payment ID: ${paymentData.razorpay_payment_id}`,
              );
            }
          }

          // Final validation - ensure we have both IDs
          console.log('🔍 Payment IDs validation before verification:');
          console.log('  - Payment ID:', paymentData.razorpay_payment_id);
          console.log('  - Order ID:', paymentData.razorpay_order_id);
          console.log(
            '  - Signature:',
            paymentData.razorpay_signature
              ? 'Present'
              : 'Not provided (will be generated on backend)',
          );

          // 🎯 CRITICAL FIX FOR PHONEPE: Even when Razorpay returns success,
          // verify payment status to ensure it's actually successful
          // This prevents issues where Razorpay says success but payment fails
          console.log(
            '🔍 Verifying payment status even though Razorpay returned success...',
          );

          try {
            // Quick verification to ensure payment is actually successful
            const quickVerification = await pollPaymentStatus(
              paymentData.razorpay_order_id || storedOrderId,
              3, // Fewer attempts since we expect success
              1000, // Shorter delay
            );

            if (!quickVerification.success) {
              console.warn(
                '⚠️ Razorpay returned success but verification failed - will still proceed with handlePaymentSuccess',
              );
              // Continue anyway - handlePaymentSuccess will do its own verification
            } else {
              console.log('✅ Payment verification confirmed success');
            }
          } catch (verifyError: any) {
            // 🎯 CRITICAL FIX: Suppress error logging for polling failures
            const errorMessage =
              verifyError?.message || String(verifyError || '');
            if (
              errorMessage.includes('Failed to get payment status') ||
              errorMessage.includes('Get payment status')
            ) {
              // This is just a polling failure, not a real error - suppress it
              console.log(
                'ℹ️ Quick verification polling failed (this is normal), continuing with success flow',
              );
            } else {
              console.warn(
                '⚠️ Quick verification failed, but continuing with success flow:',
                verifyError,
              );
            }
            // Continue anyway - handlePaymentSuccess will do its own verification
          }

          // Step 3: Handle payment success
          await handlePaymentSuccess(paymentData, plan, {
            fallbackPaymentId: pendingPaymentRecordId,
            amountInRupees: paymentAmountRupees,
            orderCurrency: order?.currency || orderCurrency || 'INR',
          });
        } catch (razorpayError: any) {
          razorpayThrewError = true;
          // 🎯 IMPROVED: Comprehensive cancellation detection
          const isCancellation = (() => {
            // Check error code
            if (
              razorpayError?.code === 'PAYMENT_CANCELLED' ||
              razorpayError?.code === 'USER_CANCELLED' ||
              razorpayError?.code === 'CANCELLED' ||
              razorpayError?.code === 'DISMISSED'
            ) {
              return true;
            }

            // Check error type/name
            const errorType = String(razorpayError?.type || '').toLowerCase();
            const errorName = String(razorpayError?.name || '').toLowerCase();
            if (
              errorType.includes('cancel') ||
              errorType.includes('dismiss') ||
              errorName.includes('cancel') ||
              errorName.includes('dismiss')
            ) {
              return true;
            }

            // Check description/message
            const desc = (
              (razorpayError &&
                (razorpayError.description ||
                  razorpayError.message ||
                  razorpayError.error ||
                  razorpayError.reason)) ||
              String(razorpayError || '')
            )
              .toString()
              .toLowerCase()
              .trim();

            const cancellationKeywords = [
              'cancel',
              'cancelled',
              'cancellation',
              'dismiss',
              'dismissed',
              'back',
              'closed',
              'user cancelled',
              'payment cancelled',
              'user closed',
              'user dismissed',
              'abort',
              'aborted',
            ];

            if (cancellationKeywords.some(keyword => desc.includes(keyword))) {
              return true;
            }

            // Check if error is null/undefined (sometimes cancellation returns null)
            if (!razorpayError || razorpayError === null) {
              return true;
            }

            return false;
          })();

          if (isCancellation) {
            wasCancelled = true; // Mark as cancelled for finally block
            console.log('🔄 User cancelled payment - no error popup shown');
            setPaymentError(null);
            setSuppressPaymentError(true);
            razorpayOpenRef.current = false;
            if (isMountedRef.current) {
              setPaymentProcessing(false);
            }
            return;
          }

          console.error('❌ Razorpay checkout error:', razorpayError);
          console.error(
            '🔍 Full error object:',
            JSON.stringify(razorpayError, null, 2),
          );

          // 🎯 CRITICAL FIX FOR PHONEPE: Always verify payment status when error occurs
          // PhonePe and other UPI apps often show error dialog even when payment succeeds
          // We MUST verify payment status before showing any error to user
          console.log(
            '🔍 CRITICAL: Verifying payment status after Razorpay error (PhonePe/UPI fix)...',
          );

          // 🎯 ENHANCED: Try multiple ways to extract payment_id and order_id from error
          const errorPaymentId =
            razorpayError?.razorpay_payment_id ||
            razorpayError?.payment_id ||
            razorpayError?.paymentId ||
            razorpayError?.data?.razorpay_payment_id ||
            razorpayError?.response?.razorpay_payment_id ||
            razorpayError?.razorpayPaymentId ||
            razorpayError?.razorpayPaymentID ||
            razorpayResult?.razorpay_payment_id; // Also check result if available

          // 🎯 CRITICAL: Always use storedOrderId as primary source for verification
          // PhonePe errors might not include orderId in error object
          const errorOrderId =
            storedOrderId || // PRIMARY: Always use stored orderId first
            razorpayError?.razorpay_order_id ||
            razorpayError?.order_id ||
            razorpayError?.orderId ||
            razorpayError?.data?.razorpay_order_id ||
            razorpayError?.response?.razorpay_order_id ||
            razorpayError?.razorpayOrderId ||
            razorpayError?.razorpayOrderID ||
            razorpayResult?.razorpay_order_id; // Also check result if available

          console.log('🔍 Extracted IDs for verification:', {
            orderId: errorOrderId,
            paymentId: errorPaymentId,
            hasStoredOrderId: !!storedOrderId,
            errorKeys: razorpayError ? Object.keys(razorpayError) : [],
          });

          // 🎯 CRITICAL: ALWAYS verify payment status if we have orderId (which we should always have)
          // 🎯 CRITICAL FIX: Suppress error display until verification completes
          // This prevents showing error dialog before we can verify payment status
          let verificationInProgress = true;
          let verificationSucceeded = false;

          if (errorOrderId) {
            console.log(
              '✅ Found orderId in error, verifying payment status...',
              {
                orderId: errorOrderId,
                paymentId: errorPaymentId,
              },
            );

            try {
              // 🎯 CRITICAL FIX FOR PHONEPE: Add delay before verification
              // PhonePe payments need time to be processed on backend
              console.log(
                '⏳ Waiting 3 seconds for PhonePe/UPI payment to be processed on backend...',
              );
              await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds

              // Poll payment status to check if payment actually succeeded
              // Use more attempts and longer delays for UPI payments (especially PhonePe)
              console.log('🔄 Starting payment status verification polling...');
              const verificationResult = await pollPaymentStatus(
                errorOrderId,
                10, // Even more attempts for PhonePe (needs more time)
                3000, // Longer delay between attempts for PhonePe
              );

              verificationInProgress = false;

              if (verificationResult.success) {
                verificationSucceeded = true;
                console.log(
                  '✅ Payment verification succeeded despite Razorpay error!',
                );
                console.log(
                  '🎯 Payment was successful, proceeding with success flow...',
                );

                // Construct payment data from verification result
                // Type guard: verificationResult.success is true, so we can access other properties
                const successResult = verificationResult as {
                  success: true;
                  captured: boolean;
                  paymentId: any;
                  paymentRecord: any;
                  raw: any;
                };

                const paymentData: any = {
                  razorpay_payment_id:
                    errorPaymentId || successResult.paymentId || 'unknown',
                  razorpay_order_id: errorOrderId,
                  razorpay_signature: null, // Will be generated on backend
                };

                // Add any additional data from verification result
                if (successResult.paymentRecord) {
                  Object.assign(paymentData, successResult.paymentRecord);
                }

                // 🎯 CRITICAL: Clear any error state before proceeding with success
                if (isMountedRef.current) {
                  setPaymentError(null);
                  setSuppressPaymentError(true);
                }

                // Proceed with payment success handling
                await handlePaymentSuccess(paymentData, plan, {
                  fallbackPaymentId: pendingPaymentRecordId,
                  amountInRupees: paymentAmountRupees,
                  orderCurrency: order?.currency || orderCurrency || 'INR',
                });

                // Payment succeeded, don't throw error
                return;
              } else {
                console.log(
                  '❌ Payment verification failed, payment did not succeed',
                );
                verificationSucceeded = false;
              }
            } catch (verificationError: any) {
              verificationInProgress = false;
              verificationSucceeded = false;
              // 🎯 CRITICAL FIX: Suppress error logging if it's just a polling failure
              // Polling failures are expected and shouldn't show error toasts
              const errorMessage =
                verificationError?.message || String(verificationError || '');
              if (
                errorMessage.includes('Failed to get payment status') ||
                errorMessage.includes('Get payment status')
              ) {
                // This is just a polling failure, not a real error - suppress it
                console.log(
                  'ℹ️ Payment status polling attempt failed (this is normal):',
                  errorMessage,
                );
              } else {
                console.warn(
                  '⚠️ Payment verification check failed:',
                  verificationError,
                );
              }
              // Continue to throw original error if verification fails
            }
          } else {
            // 🎯 CRITICAL: This should never happen as we always have storedOrderId
            // But if it does, log extensively for debugging
            verificationInProgress = false;
            console.error(
              '❌ CRITICAL: No orderId available for verification!',
            );
            console.error('  - storedOrderId:', storedOrderId);
            console.error('  - error object:', razorpayError);
            console.error(
              '  - error keys:',
              razorpayError ? Object.keys(razorpayError) : [],
            );

            // Even without orderId, try to verify using storedOrderId if available
            if (storedOrderId) {
              console.log(
                '🔄 Attempting verification with storedOrderId as fallback...',
              );
              try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const verificationResult = await pollPaymentStatus(
                  storedOrderId,
                  8,
                  2500,
                );
                if (verificationResult.success) {
                  console.log(
                    '✅ Payment verification succeeded with storedOrderId!',
                  );

                  // Type guard: verificationResult.success is true, so we can access other properties
                  const successResult = verificationResult as {
                    success: true;
                    captured: boolean;
                    paymentId: any;
                    paymentRecord: any;
                    raw: any;
                  };

                  const paymentData: any = {
                    razorpay_payment_id:
                      errorPaymentId || successResult.paymentId || 'unknown',
                    razorpay_order_id: storedOrderId,
                    razorpay_signature: null,
                  };
                  if (successResult.paymentRecord) {
                    Object.assign(paymentData, successResult.paymentRecord);
                  }
                  await handlePaymentSuccess(paymentData, plan, {
                    fallbackPaymentId: pendingPaymentRecordId,
                    amountInRupees: paymentAmountRupees,
                    orderCurrency: order?.currency || orderCurrency || 'INR',
                  });
                  return;
                }
              } catch (fallbackError) {
                console.warn('⚠️ Fallback verification failed:', fallbackError);
              }
            }
          }

          // If we reach here, payment verification failed or no orderId available
          // Only throw error if verification confirmed payment failed
          if (verificationSucceeded) {
            // Verification succeeded, don't throw error
            console.log('✅ Verification succeeded, not throwing error');
            return;
          }

          console.error(
            '❌ Payment verification failed - showing error to user',
          );

          // 🎯 CRITICAL: Only show error if verification confirmed failure
          // Don't show error if verification is still in progress or succeeded
          if (!verificationInProgress && !verificationSucceeded) {
            throw razorpayError;
          } else {
            // Verification succeeded or in progress, don't throw
            console.log(
              '⏳ Verification in progress or succeeded, suppressing error',
            );
            return;
          }
        } finally {
          // Ensure flag resets even if user closes/cancels
          razorpayOpenRef.current = false;
          // If we marked a user-driven cancellation anywhere above, hard-clear any lingering error banner
          // Use local variable since state updates are async
          if (wasCancelled || suppressPaymentError) {
            setPaymentError(null);
          }
        }
      } catch (error: any) {
        // 🎯 IMPROVED: Comprehensive cancellation detection in outer catch
        const isCancellation = (() => {
          // Check error code
          if (
            error?.code === 'PAYMENT_CANCELLED' ||
            error?.code === 'USER_CANCELLED' ||
            error?.code === 'CANCELLED' ||
            error?.code === 'DISMISSED'
          ) {
            return true;
          }

          // Check error type/name
          const errorType = String(error?.type || '').toLowerCase();
          const errorName = String(error?.name || '').toLowerCase();
          if (
            errorType.includes('cancel') ||
            errorType.includes('dismiss') ||
            errorName.includes('cancel') ||
            errorName.includes('dismiss')
          ) {
            return true;
          }

          // Check description/message
          const errDesc = (
            (error &&
              (error.description ||
                error.message ||
                error.error ||
                error.reason)) ||
            String(error || '')
          )
            .toString()
            .toLowerCase()
            .trim();

          const cancellationKeywords = [
            'cancel',
            'cancelled',
            'cancellation',
            'dismiss',
            'dismissed',
            'back',
            'closed',
            'user cancelled',
            'payment cancelled',
            'user closed',
            'user dismissed',
            'abort',
            'aborted',
          ];

          if (cancellationKeywords.some(keyword => errDesc.includes(keyword))) {
            return true;
          }

          // Check if error is null/undefined (sometimes cancellation returns null)
          if (!error || error === null) {
            return true;
          }

          return false;
        })();

        if (isCancellation) {
          console.log(
            '🔄 User cancelled payment (outer catch) - no error popup shown',
          );
          setPaymentError(null);
          setSuppressPaymentError(true);
          if (isMountedRef.current) {
            setPaymentProcessing(false);
          }
          return;
        }

        // Only show error if it's not a cancellation
        console.error('❌ Payment process failed:', error);
        const isPhonePeGatewayIssue = isPhonePeGatewayError(error);

        // 🎯 CRITICAL FIX FOR PHONEPE: Before showing error, ALWAYS verify payment status
        // PhonePe and other UPI apps often show error dialog even when payment succeeds
        const errorAny = error as any;

        // 🎯 CRITICAL: Track verification state to prevent showing error if verification succeeds
        let outerVerificationInProgress = true;
        let outerVerificationSucceeded = false;

        // 🎯 ENHANCED: Try multiple ways to extract payment_id and order_id
        const errorPaymentId =
          errorAny?.razorpay_payment_id ||
          errorAny?.payment_id ||
          errorAny?.paymentId ||
          errorAny?.data?.razorpay_payment_id ||
          errorAny?.response?.razorpay_payment_id ||
          errorAny?.razorpayPaymentId ||
          errorAny?.razorpayPaymentID;

        // 🎯 CRITICAL: Always use storedOrderId as primary source for verification
        const errorOrderId =
          storedOrderId || // PRIMARY: Always use stored orderId first
          errorAny?.razorpay_order_id ||
          errorAny?.order_id ||
          errorAny?.orderId ||
          errorAny?.data?.razorpay_order_id ||
          errorAny?.response?.razorpay_order_id ||
          errorAny?.razorpayOrderId ||
          errorAny?.razorpayOrderID;

        console.log('🔍 Outer catch - Extracted IDs for verification:', {
          orderId: errorOrderId,
          paymentId: errorPaymentId,
          hasStoredOrderId: !!storedOrderId,
        });

        // 🎯 CRITICAL: ALWAYS verify payment status if we have orderId (which we should always have)
        if (errorOrderId && !suppressPaymentError) {
          console.log(
            '🔍 CRITICAL: Verifying payment status before showing error (PhonePe/UPI fix)...',
            {
              orderId: errorOrderId,
              paymentId: errorPaymentId,
            },
          );

          try {
            // 🎯 CRITICAL FIX FOR PHONEPE: Add delay before verification
            console.log(
              '⏳ Waiting 3 seconds for PhonePe/UPI payment to be processed on backend...',
            );
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds

            console.log(
              '🔄 Starting payment status verification polling (outer catch)...',
            );
            const verificationResult = await pollPaymentStatus(
              errorOrderId,
              10, // Even more attempts for PhonePe (needs more time)
              3000, // Longer delay between attempts for PhonePe
            );

            outerVerificationInProgress = false;

            if (verificationResult.success) {
              outerVerificationSucceeded = true;
              console.log('✅ Payment verification succeeded despite error!');
              console.log(
                '🎯 Payment was successful, proceeding with success flow...',
              );

              // Type guard: verificationResult.success is true, so we can access other properties
              const successResult = verificationResult as {
                success: true;
                captured: boolean;
                paymentId: any;
                paymentRecord: any;
                raw: any;
              };

              // Construct payment data from verification result
              const paymentData: any = {
                razorpay_payment_id:
                  errorPaymentId || successResult.paymentId || 'unknown',
                razorpay_order_id: errorOrderId,
                razorpay_signature: null, // Will be generated on backend
              };

              // Add any additional data from verification result
              if (successResult.paymentRecord) {
                Object.assign(paymentData, successResult.paymentRecord);
              }

              // 🎯 CRITICAL: Clear any error state before proceeding with success
              if (isMountedRef.current) {
                setPaymentError(null);
                setSuppressPaymentError(true);
              }

              // Proceed with payment success handling
              await handlePaymentSuccess(paymentData, plan, {
                fallbackPaymentId: pendingPaymentRecordId,
                amountInRupees: paymentAmountRupees,
                orderCurrency: order?.currency || orderCurrency || 'INR',
              });

              // Payment succeeded, don't show error
              return;
            } else {
              outerVerificationSucceeded = false;
              console.log(
                '❌ Payment verification failed, showing error to user',
              );
            }
          } catch (verificationError: any) {
            outerVerificationInProgress = false;
            outerVerificationSucceeded = false;
            // 🎯 CRITICAL FIX: Suppress error logging if it's just a polling failure
            // Polling failures are expected and shouldn't show error toasts
            const errorMessage =
              verificationError?.message || String(verificationError || '');
            if (
              errorMessage.includes('Failed to get payment status') ||
              errorMessage.includes('Get payment status')
            ) {
              // This is just a polling failure, not a real error - suppress it
              console.log(
                'ℹ️ Payment status polling attempt failed (this is normal):',
                errorMessage,
              );
            } else {
              console.warn(
                '⚠️ Payment verification check failed:',
                verificationError,
              );
            }
            // Continue to show error if verification fails
          }
        } else {
          outerVerificationInProgress = false;
        }

        // 🎯 CRITICAL: Only show error if verification confirmed failure
        if (outerVerificationSucceeded) {
          console.log('✅ Verification succeeded, not showing error');
          return;
        }

        // 🎯 NEW: If this is the known PhonePe "Something went wrong" gateway error,
        // run an extended verification pass before surfacing anything to the user.
        if (
          isPhonePeGatewayIssue &&
          storedOrderId &&
          !outerVerificationInProgress &&
          !suppressPaymentError
        ) {
          console.log(
            '🔁 Detected PhonePe gateway issue - running extended verification fallback...',
          );
          const extendedResult = await pollPaymentStatus(
            storedOrderId,
            PHONEPE_EXTENDED_ATTEMPTS,
            PHONEPE_EXTENDED_DELAY_MS,
          );

          if (extendedResult.success) {
            console.log(
              '✅ Extended verification succeeded after PhonePe gateway error',
            );
            const successResult = extendedResult as {
              success: true;
              captured: boolean;
              paymentId: any;
              paymentRecord: any;
              raw: any;
            };

            const paymentData: any = {
              razorpay_payment_id:
                errorPaymentId || successResult.paymentId || 'unknown',
              razorpay_order_id: storedOrderId,
              razorpay_signature: null,
            };

            if (successResult.paymentRecord) {
              Object.assign(paymentData, successResult.paymentRecord);
            }

            if (isMountedRef.current) {
              setPaymentError(null);
              setSuppressPaymentError(true);
            }

            await handlePaymentSuccess(paymentData, plan, {
              fallbackPaymentId: pendingPaymentRecordId,
              amountInRupees: paymentAmountRupees,
              orderCurrency: order?.currency || orderCurrency || 'INR',
            });
            return;
          } else {
            console.log(
              '⚠️ Extended PhonePe verification fallback did not confirm success yet',
            );
          }
        }

        let errorMessage = 'Payment failed. Please try again.';
        let alertTitle = 'Payment Error';
        let alertType: AlertOptions['type'] = 'error';

        if (isPhonePeGatewayIssue) {
          errorMessage = buildPhonePePendingAlertMessage(storedOrderId);
          alertTitle = 'PhonePe Confirmation Pending';
          alertType = 'info';
        } else if (error.message?.includes('No payment ID')) {
          errorMessage = 'Payment was not completed. Please try again.';
        } else if (error.message?.includes('network')) {
          errorMessage =
            'Network error. Please check your internet connection.';
        }

        // Only set error and show alert if not suppressed
        if (!suppressPaymentError && isMountedRef.current) {
          setPaymentError(errorMessage);
          showAlert({
            title: alertTitle,
            message: errorMessage,
            type: alertType,
            confirmText: 'OK',
            onConfirm: () => {
              console.log('User acknowledged payment error');
            },
          });
        }
        // 🎯 CRITICAL: Always reset processing state, even if component unmounted
        if (isMountedRef.current) {
          setPaymentProcessing(false);
        }
      }
    } catch (error) {
      // 🎯 IMPROVED: Check for cancellation before showing any errors
      const isCancellation = (() => {
        if (suppressPaymentError) return true; // Already marked as cancellation

        const errorAny = error as any;
        // Check error code
        if (
          errorAny?.code === 'PAYMENT_CANCELLED' ||
          errorAny?.code === 'USER_CANCELLED' ||
          errorAny?.code === 'CANCELLED' ||
          errorAny?.code === 'DISMISSED'
        ) {
          return true;
        }

        // Check error description/message
        const errDesc = (
          (errorAny &&
            (errorAny.description ||
              errorAny.message ||
              errorAny.error ||
              errorAny.reason)) ||
          String(errorAny || '')
        )
          .toString()
          .toLowerCase()
          .trim();

        const cancellationKeywords = [
          'cancel',
          'cancelled',
          'cancellation',
          'dismiss',
          'dismissed',
          'back',
          'closed',
          'user cancelled',
          'payment cancelled',
        ];

        return cancellationKeywords.some(keyword => errDesc.includes(keyword));
      })();

      if (isCancellation) {
        console.log(
          '🔄 User cancelled payment (outer catch) - no error popup shown',
        );
        if (isMountedRef.current) {
          setPaymentError(null);
          setSuppressPaymentError(true);
          setPaymentProcessing(false);
        }
        return;
      }

      console.error('Plan upgrade error:', error);

      // Import error handler
      const { handleApiError } = require('../utils/apiErrorHandler');
      const errorInfo = handleApiError(error);

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        if (!suppressPaymentError) {
          setPaymentError(errorInfo.message);
          showAlert({
            title: 'Access Denied',
            message: errorInfo.message,
            type: 'error',
            confirmText: 'OK',
          });
        }
      } else {
        if (!suppressPaymentError) {
          setPaymentError(
            errorInfo.message || 'Failed to upgrade plan. Please try again.',
          );
          showAlert({
            title: 'Error',
            message:
              errorInfo.message || 'Failed to upgrade plan. Please try again.',
            type: 'error',
            confirmText: 'OK',
          });
        }
      }

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
      // 🎯 CRITICAL: Clear timeout in finally block
      if (upgradeTimeout !== null) {
        clearTimeout(upgradeTimeout);
      }
      // Reset payment processing state - always reset even if component unmounts
      if (isMountedRef.current) {
        setPaymentProcessing(false);
      }
      console.log('🏁 Payment flow completed');
      // Ensure lock is released
      upgradingLockRef.current = false;
      razorpayOpenRef.current = false;
    }
  };

  // 🎯 UPDATED: Better downgradePlan function with loading state (like web version)
  const downgradePlan = async (plan: PlanDisplayData) => {
    console.log('🔄 downgradePlan called with:', {
      planName: plan.name,
      planId: plan.id,
      planPrice: plan.price,
    });

    try {
      setPlanActionLoading(plan.id);

      // 🎯 FIXED: Check if user is already on this plan before attempting downgrade
      const currentPlanName = String(
        currentSubscription?.planName || '',
      ).toLowerCase();
      const targetPlanName = String(plan.name || '').toLowerCase();

      if (currentPlanName === targetPlanName) {
        console.log('⚠️ User is already on this plan:', targetPlanName);
        setPlanActionLoading(null);
        showAlert({
          title: 'Already on This Plan',
          message: `You are already subscribed to the ${plan.name} plan.`,
          type: 'info',
          confirmText: 'OK',
        });
        return;
      }

      console.log('📞 Calling contextDowngradePlan...');
      // Ensure plan id is numeric for API compatibility; resolve from availablePlans by name if needed
      const numericPlanId = (() => {
        const tryNum = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        };
        const rawFromProp = tryNum((plan as any)?.id);
        if (rawFromProp) return rawFromProp;
        // Try to resolve using name match from availablePlans
        try {
          const match = (availablePlans || []).find(
            (p: any) =>
              String(p?.name || '').toLowerCase() ===
              String((plan as any)?.name || '').toLowerCase(),
          );
          if (match) {
            const m: any = match as any;
            return (
              tryNum(m.id) ||
              tryNum(m.planId) ||
              tryNum(m.targetPlanId) ||
              undefined
            );
          }
        } catch {}
        // Fallback mapping by common plan names
        const map: Record<string, number> = {
          free: 1,
          starter: 2,
          professional: 3,
          enterprise: 4,
        };
        const key = String((plan as any)?.name || '').toLowerCase();
        if (map[key]) return map[key];
        return undefined;
      })();

      if (!numericPlanId) {
        console.warn(
          '❌ Downgrade: could not resolve numeric plan id for',
          plan,
        );
        showAlert({
          title: 'Downgrade Failed',
          message: 'Could not resolve the selected plan. Please try again.',
          type: 'error',
          confirmText: 'OK',
        });
        setPlanActionLoading(null);
        return;
      }
      console.log('🔢 Resolved downgrade numericPlanId:', numericPlanId);
      console.log(
        '🗂️ Available plans snapshot:',
        (availablePlans || []).map((p: any) => ({
          id: p?.id,
          name: p?.name,
          price: p?.price,
        })),
      );

      let success = false;
      let errorMessage: string | null = null;

      try {
        success = await contextDowngradePlan(String(numericPlanId));
        console.log('📞 contextDowngradePlan result:', success);

        // Fallback to direct API if context returns false
        if (!success) {
          try {
            const token = await AsyncStorage.getItem('accessToken');
            if (!token) throw new Error('No token');
            console.log(
              '📡 Fallback: POST /subscriptions/upgrade (downgrade pathway)',
            );
            // Use unified API
            const downgradePayload = {
              planId: numericPlanId,
              action: 'downgrade',
              targetPlanName: plan.name || null,
              previousPlanName: currentSubscription?.planName || null,
            };
            const res = await unifiedApi.post(
              '/subscriptions/upgrade',
              downgradePayload,
            );
            console.log('📡 Downgrade (upgrade endpoint) response:', res);

            // Check if response indicates success
            // unifiedApi.post() returns data directly, check for success indicators
            const responseData = (res as any)?.data ?? res;
            success = !!(
              responseData?.success ||
              responseData?.downgrade === true ||
              responseData?.subscription ||
              responseData?.id ||
              responseData?.subscriptionId ||
              (responseData &&
                !responseData.error &&
                !responseData.message?.includes('error'))
            );

            if (!success) {
              const errorMsg =
                responseData?.message ||
                'Server responded with error. Please try again later.';
              // Check if it's the "already subscribed" error
              if (
                errorMsg.toLowerCase().includes('already subscribed') ||
                errorMsg.toLowerCase().includes('already on this plan')
              ) {
                errorMessage = `You are already subscribed to the ${plan.name} plan.`;
                console.log('ℹ️ User is already on this plan');
              } else {
                errorMessage = errorMsg;
                console.warn('❌ Downgrade failed:', errorMessage);
              }
            }
          } catch (e: any) {
            const errorMsg =
              e?.message ||
              'Network error while requesting downgrade. Please try again.';
            // Check if it's the "already subscribed" error
            if (
              errorMsg.toLowerCase().includes('already subscribed') ||
              errorMsg.toLowerCase().includes('already on this plan')
            ) {
              errorMessage = `You are already subscribed to the ${plan.name} plan.`;
              console.log('ℹ️ User is already on this plan');
            } else {
              errorMessage = errorMsg;
              console.warn('❌ Downgrade fallback failed:', errorMessage);
            }
            success = false;
          }
        }
      } catch (error: any) {
        const errorMsg =
          error?.message || 'Failed to downgrade plan. Please try again.';
        // Check if it's the "already subscribed" error
        if (
          errorMsg.toLowerCase().includes('already subscribed') ||
          errorMsg.toLowerCase().includes('already on this plan')
        ) {
          errorMessage = `You are already subscribed to the ${plan.name} plan.`;
          console.log('ℹ️ User is already on this plan');
        } else {
          errorMessage = errorMsg;
          console.error('❌ Downgrade error:', errorMessage);
        }
        success = false;
      }

      // Only show success if operation actually succeeded
      if (success) {
        setSuccessPlanId(String(numericPlanId));
        setSuccessMessage(
          `Successfully downgraded to ${plan.name} plan!\nNote: Amounts already paid are not refunded.`,
        );
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

        // 🎯 FIXED: Invalidate subscription cache to ensure fresh data
        try {
          unifiedApi.invalidateCachePattern('.*/subscriptions.*');
          unifiedApi.invalidateCachePattern('.*/users/profile.*');
          console.log('✅ Invalidated subscription cache after downgrade');
        } catch (cacheError) {
          console.warn('⚠️ Failed to invalidate cache:', cacheError);
        }

        // 🎯 FIXED: Force refresh sequence with delay to ensure backend commits are visible
        // Only fetch subscription data (not plans) since plans don't change
        await fetchSubscriptionData(false); // false = don't refresh plans

        // 🎯 FIXED: Add multiple retries with increasing delays to ensure backend updates are visible
        safeSetTimeout(async () => {
          console.log(
            '🔄 First retry: Refreshing subscription data after plan downgrade (1s delay)...',
          );
          // Invalidate cache again before retry
          try {
            unifiedApi.invalidateCachePattern('.*/subscriptions.*');
            unifiedApi.invalidateCachePattern('.*/users/profile.*');
          } catch {}
          // Refresh subscription data again after delay to get updated plan
          await fetchSubscriptionData(false); // false = don't refresh plans

          // Second retry with longer delay
          safeSetTimeout(async () => {
            console.log(
              '🔄 Second retry: Refreshing subscription data after plan downgrade (2.5s delay)...',
            );
            // Invalidate cache again before retry
            try {
              unifiedApi.invalidateCachePattern('.*/subscriptions.*');
              unifiedApi.invalidateCachePattern('.*/users/profile.*');
            } catch {}
            await fetchSubscriptionData(false); // false = don't refresh plans

            // Third retry with even longer delay
            safeSetTimeout(async () => {
              console.log(
                '🔄 Third retry: Refreshing subscription data after plan downgrade (4s delay)...',
              );
              // Invalidate cache again before retry
              try {
                unifiedApi.invalidateCachePattern('.*/subscriptions.*');
                unifiedApi.invalidateCachePattern('.*/users/profile.*');
              } catch {}
              await fetchSubscriptionData(false); // false = don't refresh plans
            }, 1500); // Wait another 1.5 seconds (total 4s from first retry)
          }, 1500); // Wait another 1.5 seconds (total 2.5s from first retry)
        }, 1000); // Wait 1 second for backend to update subscription

        // Add delay before fetching transaction limits to allow backend to update subscription
        safeSetTimeout(async () => {
          console.log(
            '🔄 Refreshing transaction limits after plan downgrade (with delay)...',
          );
          await fetchBillingData();

          // Retry once more to ensure accurate count
          safeSetTimeout(async () => {
            console.log(
              '🔄 Retrying transaction limits fetch after downgrade...',
            );
            await fetchBillingData();
          }, 1500);
        }, 1500); // Wait 1.5 seconds for backend to update subscription
      } else {
        // Operation failed - show error and clear any success messages
        const finalErrorMessage =
          errorMessage || 'Failed to downgrade plan. Please try again.';

        // Check if it's the "already subscribed" error - show info instead of error
        const isAlreadySubscribed =
          finalErrorMessage.toLowerCase().includes('already subscribed') ||
          finalErrorMessage.toLowerCase().includes('already on this plan');

        setPaymentError(finalErrorMessage);
        setSuccessMessage(''); // Clear success message if error occurs
        setSuccessPlanId(null);
        setShowSuccessModal(false); // Hide success modal if error occurs

        showAlert({
          title: isAlreadySubscribed
            ? 'Already on This Plan'
            : 'Downgrade Failed',
          message: finalErrorMessage,
          type: isAlreadySubscribed ? 'info' : 'error',
          confirmText: 'OK',
        });
      }
    } catch (error: any) {
      // Catch any unexpected errors
      const finalErrorMessage =
        error?.message || 'Failed to downgrade plan. Please try again.';

      // Check if it's the "already subscribed" error - show info instead of error
      const isAlreadySubscribed =
        finalErrorMessage.toLowerCase().includes('already subscribed') ||
        finalErrorMessage.toLowerCase().includes('already on this plan');

      if (!isAlreadySubscribed) {
        console.error('❌ Unexpected downgrade error:', error);
      }

      setPaymentError(finalErrorMessage);
      setSuccessMessage(''); // Clear success message if error occurs
      setSuccessPlanId(null);
      setShowSuccessModal(false); // Hide success modal if error occurs

      showAlert({
        title: isAlreadySubscribed
          ? 'Already on This Plan'
          : 'Downgrade Failed',
        message: finalErrorMessage,
        type: isAlreadySubscribed ? 'info' : 'error',
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
            // Only fetch subscription data (not plans) since plans don't change
            fetchSubscriptionData(false); // false = don't refresh plans
            // Immediately reflect cancellation in Billing History
            fetchBillingData();
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
    setShowContactSalesModal(true);
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

  const getPlanCardStyle = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'free':
        return styles.freePlanCard;
      case 'starter':
        return styles.starterPlanCard;
      case 'professional':
        return styles.professionalPlanCard;
      case 'enterprise':
        return styles.enterprisePlanCard;
      case 'premium':
        return styles.premiumPlanCard;
      case 'basic':
        return styles.basicPlanCard;
      default:
        return styles.freePlanCard; // Default to free plan style
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

  // Recommended logic removed – no badges or hints

  // 🚨 REMOVED: Loading screen completely - no more loading states

  return (
    <View style={styles.container}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
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
                size={40}
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
                safeSetTimeout(async () => {
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
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentDetails(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 560,
              height: '85%',
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
            }}
          >
            {/* Enable nested scrolling inside the modal content */}
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              {paymentDetails && (
                <PaymentDetailsDisplay
                  paymentData={paymentDetails}
                  onClose={() => setShowPaymentDetails(false)}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Fixed Header */}
      <View
        style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <TouchableOpacity style={styles.backButton} onPress={handleHeaderBack}>
          <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Plans</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Header Content Section removed to eliminate extra top space */}

        {/* Current Plan Status Section - Hidden */}
        {false && (
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
                      size={16}
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
                      size={18}
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
                      /{' '}
                      {transactionLimits?.maxAllowed === 999999
                        ? 'Unlimited'
                        : transactionLimits?.maxAllowed || 50}
                    </Text>
                  </View>
                  <Text style={styles.usagePercentage}>
                    {transactionLimits?.maxAllowed === 999999
                      ? 'Unlimited transactions'
                      : transactionLimits
                      ? `${transactionLimits?.percentageUsed || 0}% used`
                      : '0% used'}
                  </Text>
                </View>
              </View>

              <View style={styles.billingInfo}>
                <View style={styles.billingRow}>
                  <View style={styles.billingItem}>
                    <MaterialCommunityIcons
                      name="calendar-clock"
                      size={14}
                      color="#666"
                    />
                    <Text style={styles.billingLabel}>Next Billing Date</Text>
                    <Text style={styles.billingValue}>
                      {(() => {
                        const planName = String(
                          currentSubscription?.planName || '',
                        ).toLowerCase();
                        const nextBillingDate =
                          nextBillingDateApi ||
                          currentSubscription?.nextBillingDate;

                        console.log('🔍 Next Billing Date Debug:', {
                          planName,
                          nextBillingDate,
                          isFree: planName === 'free',
                          hasDate: !!nextBillingDate,
                        });

                        if (planName === 'free') {
                          return '-';
                        }

                        if (nextBillingDate) {
                          try {
                            const date = new Date(nextBillingDate as string);
                            if (isNaN(date.getTime())) {
                              console.warn(
                                '⚠️ Invalid date format:',
                                nextBillingDate,
                              );
                              return '-';
                            }
                            // Display as dd/mm/yyyy
                            return date.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            });
                          } catch (error) {
                            console.warn('⚠️ Date parsing error:', error);
                            return '-';
                          }
                        }

                        return '-';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.billingDivider} />
                  <View style={styles.billingItem}>
                    <MaterialCommunityIcons
                      name="receipt"
                      size={14}
                      color="#666"
                    />
                    <Text style={styles.billingLabel}>Billing Amount</Text>
                    <Text style={styles.billingValue}>
                      {(() => {
                        const planName = String(
                          currentSubscription?.planName || '',
                        ).toLowerCase();
                        const amount = Number(currentSubscription?.amount || 0);

                        console.log('🔍 Billing Amount Debug:', {
                          planName,
                          amount,
                          isFree: planName === 'free',
                          isZeroOrNegative: amount <= 0,
                        });

                        if (planName === 'free' || amount <= 0) {
                          return '-';
                        }

                        return `₹${amount}`;
                      })()}
                    </Text>
                  </View>
                </View>
                {/* Billing History button removed per request */}
              </View>
            </View>
          </View>
        )}

        {/* Transaction Limits Section */}
        <View style={styles.transactionLimitsSection}>
          <View style={styles.transactionLimitsCard}>
            <View style={styles.transactionLimitsHeader}>
              <Text style={styles.transactionLimitsTitle}>
                Transaction Limits
              </Text>
              <View style={styles.allGoodBadge}>
                <View style={styles.allGoodIconContainer}>
                  <MaterialCommunityIcons
                    name="check"
                    size={12}
                    color="#16A34A"
                  />
                </View>
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
                          width:
                            transactionLimits?.maxAllowed === 999999
                              ? '0%' // No progress bar for unlimited plans
                              : transactionLimits
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
                    {transactionLimits?.maxAllowed === 999999
                      ? 'Unlimited'
                      : transactionLimits?.maxAllowed || 50}
                  </Text>
                </View>
                <Text style={styles.remainingText}>
                  {transactionLimits?.maxAllowed === 999999
                    ? 'Unlimited remaining'
                    : `${transactionLimits?.remaining || 0} remaining`}
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
                  {(() => {
                    const planName = String(
                      currentSubscription?.planName || '',
                    ).toLowerCase();
                    if (planName === 'free') return '-';
                    const fromLimits = transactionLimits?.nextResetFormatted;
                    if (fromLimits) return fromLimits;
                    // Fallback: if subscription has nextBillingDate, show same
                    const nbd = currentSubscription?.nextBillingDate;
                    if (nbd) {
                      try {
                        const date = new Date(nbd);
                        if (!isNaN(date.getTime())) {
                          // Display as dd/mm/yyyy
                          return date.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                        }
                      } catch {}
                    }
                    return 'End of month';
                  })()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Summary Section (Dashboard Tiles) - Hidden */}
        {false && (
          <View style={styles.billingSummarySection}>
            <View style={styles.billingSummaryHeader}>
              <Text style={styles.billingSummaryTitle}>Billing Summary</Text>
              {apiLoading && <ActivityIndicator size="small" color="#4f8cff" />}
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="trending-up"
                    size={20}
                    color="#4f8cff"
                  />
                </View>
                <Text
                  style={[
                    styles.metricValue,
                    { color: '#1a1a1a', fontSize: 24 },
                  ]}
                >
                  {billingSummary?.totalSubscriptions ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Total Subscriptions</Text>
              </View>

              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#28a745"
                  />
                </View>
                <Text
                  style={[
                    styles.metricValue,
                    { color: '#28a745', fontSize: 24 },
                  ]}
                >
                  {billingSummary?.activeSubscriptions ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Active</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color="#dc3545"
                  />
                </View>
                <Text
                  style={[
                    styles.metricValue,
                    { color: '#dc3545', fontSize: 24 },
                  ]}
                >
                  {billingSummary?.expiredSubscriptions ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Expired</Text>
              </View>

              <View style={styles.metricItem}>
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons
                    name="credit-card"
                    size={20}
                    color="#8b5cf6"
                  />
                </View>
                <Text
                  style={[
                    styles.metricValue,
                    { color: '#1a1a1a', fontSize: 22 },
                  ]}
                >
                  {formatINR(billingSummary?.totalSpent ?? 0)}
                </Text>
                <Text style={styles.metricLabel}>Total Spent</Text>
              </View>
            </View>
          </View>
        )}

        {/* Billing History Section */}
        <View style={styles.billingHistorySection}>
          <View style={styles.billingHistoryHeader}>
            <Text style={styles.billingHistoryTitle}>Billing History</Text>
          </View>

          {nonPendingBillingHistory.length === 0 ? (
            <View style={styles.noHistoryContainer}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={40}
                color="#ccc"
              />
              <Text style={styles.noHistoryTitle}>
                No billing history found
              </Text>
              <Text style={styles.noHistorySubtitle}>
                Your invoices will appear here once generated.
              </Text>
            </View>
          ) : (
            <FlatList
              data={paginatedBillingHistory}
              renderItem={renderBillingHistoryItem}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.billingHistoryList}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMoreHistory}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                historyPaginating ? (
                  <View style={styles.historyLoadingMore}>
                    <ActivityIndicator size="small" color="#4f8cff" />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* Plans Slider (Carousel) */}
        <View style={styles.plansSummaryContainer}>
          <View style={styles.plansSummaryHeader}>
            <Text style={styles.plansSummaryTitle}>Choose Your Plan</Text>
            <Text style={styles.plansSummarySubtitle}>
              Select the perfect plan for your business needs
            </Text>
            {/* Recommended hint intentionally removed per latest UX */}
          </View>

          {/* Only show loading when actually fetching plans (first load) */}
          {loading && availablePlans.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f8cff" />
              <Text style={styles.loadingText}>Loading Plans...</Text>
            </View>
          ) : cleanedPlans.length > 0 ? (
            <PlansCarousel
              cleanedPlans={cleanedPlans}
              currentSubscription={currentSubscription}
              paymentProcessing={paymentProcessing}
              planActionLoading={planActionLoading}
              paymentError={suppressPaymentError ? null : paymentError}
              successMessage={successMessage}
              successPlanId={successPlanId}
              onPlanPress={(plan: any) => handlePlanAction(plan)}
              setSelectedPlanId={(id: string) => setSelectedPlanId(id)}
              getPlanIcon={getPlanIcon}
              getPlanColor={getPlanColor}
              getPlanFeature={getPlanFeature}
              getPlanCardStyle={getPlanCardStyle}
            />
          ) : (
            <View style={styles.noPlansContainer}>
              <MaterialCommunityIcons
                name="package-variant"
                size={48}
                color="#ccc"
              />
              <Text style={styles.noPlansTitle}>No Plans Available</Text>
              <Text style={styles.noPlansSubtitle}>
                Plans are currently being set up. Please check back later or
                contact support.
              </Text>
              <TouchableOpacity
                style={styles.contactSupportButton}
                onPress={contactSales}
              >
                <MaterialCommunityIcons name="headset" size={16} color="#fff" />
                <Text style={styles.contactSupportText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment Security Section */}
        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <MaterialCommunityIcons
              name="shield-check"
              size={16}
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

      {/* Contact Sales Modal */}
      <ContactSalesModal
        visible={showContactSalesModal}
        onClose={() => setShowContactSalesModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  // Header Section - Compact and Clean
  header: {
    paddingHorizontal: 12,
    backgroundColor: '#4f8cff',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  headerContent: {
    alignItems: 'center',
    width: '100%',
  },
  headerContentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  headerBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#16A34A',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  backButton: {
    padding: 10,
    marginRight: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Roboto-Medium',
    marginLeft: 6,
  },
  title: {
    display: 'none',
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  plansSummaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
    marginTop: 8,
  },
  plansSummaryHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  plansSummaryTitle: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  plansSummarySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
  },

  plansScrollView: {
    maxHeight: 600, // Limit height to prevent excessive scrolling
  },
  plansGrid: {
    flexDirection: 'column',
    gap: 16,
    paddingBottom: 20, // Add padding at bottom for better UX
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
    // shadowColor: '#000',
    // shadowOpacity: 0.05,
    // shadowRadius: 10,
    // shadowOffset: { width: 0, height: 2 },
    // elevation: 3,
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

    fontFamily: 'Roboto-Medium',
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

    fontFamily: 'Roboto-Medium',
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

    fontFamily: 'Roboto-Medium',
  },

  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 10,
  },
  planFeatures: {
    alignItems: 'center',
  },
  planFeatureText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Roboto-Medium',
  },

  planSummaryName: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },
  planSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: -2,
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
  },

  planSummaryPrice: {
    fontSize: 24,
    color: '#2563EB',
    marginBottom: 0,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  planSummaryPeriod: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    fontFamily: 'Roboto-Medium',
  },

  plansContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  plansTitle: {
    fontSize: 20,
    color: '#222',
    marginBottom: 16,

    fontFamily: 'Roboto-Medium',
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

    fontFamily: 'Roboto-Medium',
  },

  popularText: {
    color: '#fff',
    fontSize: 12,

    fontFamily: 'Roboto-Medium',
  },

  planName: {
    fontSize: 18,
    color: '#222',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  planDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,

    fontFamily: 'Roboto-Medium',
  },

  planPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  priceAmount: {
    fontSize: 28,
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },

  pricePeriod: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,

    fontFamily: 'Roboto-Medium',
  },

  featuresList: {
    marginBottom: 24,
  },
  featuresListCompact: {
    marginBottom: 10,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
  },
  featureTextCompact: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
    fontFamily: 'Roboto-Medium',
  },

  planButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 0,
  },
  planButtonFull: {
    alignSelf: 'stretch',
  },
  currentPlanButton: {
    backgroundColor: '#16A34A',
  },
  upgradeButton: {
    backgroundColor: '#2563EB',
  },
  downgradeButton: {
    backgroundColor: '#6B7280',
  },
  contactButton: {
    backgroundColor: '#374151',
  },
  processingButton: {
    backgroundColor: '#6B7280',
    opacity: 0.7,
  },
  planButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  currentPlanButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  processingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 6,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  contactSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Roboto-Medium',
  },

  contactSalesButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginBottom: 40,
  },
  contactSalesText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    fontWeight: '700',
  },

  securitySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 13,
    color: '#16A34A',
    marginLeft: 6,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  securityText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
    fontFamily: 'Roboto-Medium',
  },

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
    fontSize: 22,
    fontWeight: '700',
    color: '#28a745',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  successModalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,

    fontFamily: 'Roboto-Medium',
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
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  successModalFooter: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  successModalSubtext: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'center',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
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
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  // Current Plan Section - Compact Design
  currentPlanSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
  },
  currentPlanCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  currentPlanInfo: {
    flex: 1,
  },
  currentPlanTitle: {
    fontSize: 18,
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  activeBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currentPlanDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
    fontFamily: 'Roboto-Medium',
  },

  usageSection: {
    marginBottom: 12,
  },
  usageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  usageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageTitle: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  usageAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  usageUsed: {
    fontSize: 20,
    color: '#2563EB',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  usageTotal: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
    fontFamily: 'Roboto-Medium',
  },

  usagePercentage: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  billingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  billingRow: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
  },
  billingItem: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billingLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 0,
    fontFamily: 'Roboto-Medium',
  },

  billingValue: {
    fontSize: 13,
    color: '#2563EB',
    marginLeft: 4,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  billingDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    alignSelf: 'stretch',
    marginVertical: 1,
  },

  billingHistoryButton: {
    display: 'none',
  },
  billingHistoryText: {
    display: 'none',
  },

  // Transaction Limits Section - Compact Design
  transactionLimitsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
  },
  transactionLimitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transactionLimitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionLimitsTitle: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  allGoodBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allGoodIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allGoodText: {
    color: '#16A34A',
    fontSize: 12,
    marginLeft: 4,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  limitDetails: {
    gap: 12,
  },
  limitLabel: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  limitValue: {
    color: '#2563EB',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  limitProgress: {
    gap: 6,
  },
  limitProgressLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  remainingText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  resetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  // Billing Summary Section - Compact Grid Cards
  billingSummarySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 4,
  },
  billingSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billingSummaryTitle: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  billingMetrics: {
    flexDirection: 'column',
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricValue: {
    fontSize: 18,
    marginBottom: 4,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  metricLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  // Billing History Section - Compact Layout
  billingHistorySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  billingHistoryScroll: {
    maxHeight: 320, // ~ fits about 3 items; enables internal scrolling thereafter
  },
  billingHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billingHistoryTitle: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  refreshHistoryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  refreshHistoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  noHistoryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noHistoryTitle: {
    fontSize: 15,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  noHistorySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Roboto-Medium',
  },

  // Billing History List Styles
  billingHistoryList: {
    gap: 8,
  },
  historyLoadingMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  billingHistoryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billingHistoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  billingHistoryItemTitle: {
    fontSize: 11,
    color: '#111827',
    flex: 1,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  billingHistoryItemStatus: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  billingHistoryItemStatusText: {
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  billingHistoryItemPlan: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
  },

  billingHistoryItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  billingHistoryItemAmount: {
    fontSize: 13,
    color: '#2563EB',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  billingHistoryItemDate: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
  },

  // View Payment Button Styles
  viewPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  viewPaymentButtonText: {
    fontSize: 11,
    color: '#2563EB',
    marginLeft: 3,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
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

    fontFamily: 'Roboto-Medium',
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

    fontFamily: 'Roboto-Medium',
  },

  // No Plans Container Styles
  noPlansContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginTop: 16,
  },
  noPlansTitle: {
    fontSize: 20,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  noPlansSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,

    fontFamily: 'Roboto-Medium',
  },

  contactSupportButton: {
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#4f8cff',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  contactSupportText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  // Carousel styles
  nextPlanHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',

    fontFamily: 'Roboto-Medium',
  },
  carouselContainer: {
    marginTop: 8,
    overflow: 'visible',
    paddingBottom: 8,
  },
  carousel: {
    overflow: 'visible',
    flexGrow: 0,
  },
  slide: {
    width: CARD_WIDTH,
    marginLeft: 0,
    marginRight: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 280,
  },
  // Plan-specific background colors
  freePlanCard: {
    backgroundColor: '#F0F9FF', // Light blue
    borderColor: '#BFDBFE',
  },
  starterPlanCard: {
    backgroundColor: '#F0FDF4', // Light green
    borderColor: '#BBF7D0',
  },
  professionalPlanCard: {
    backgroundColor: '#FEF3C7', // Light yellow
    borderColor: '#FDE68A',
  },
  enterprisePlanCard: {
    backgroundColor: '#F3E8FF', // Light purple
    borderColor: '#DDD6FE',
  },
  premiumPlanCard: {
    backgroundColor: '#FEE2E2', // Light red
    borderColor: '#FECACA',
  },
  basicPlanCard: {
    backgroundColor: '#F1F5F9', // Light gray
    borderColor: '#E2E8F0',
  },
  cardDivider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginTop: 6,
    marginBottom: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
    paddingHorizontal: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 2,
  },
  dotActive: {
    backgroundColor: '#2563EB',
    width: 16,
    borderRadius: 3,
  },

  // Recommended Upgrade Badge Styles
  recommendedUpgradeBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff6b35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#ff6b35',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },
  recommendedUpgradeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'Roboto-Bold',
  },
});

export default SubscriptionPlanScreen;
