/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-use-before-define */
// @ts-nocheck - Allow styles and functions to be used before declaration (common React Native pattern)
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { uiColors, uiFonts } from '../../config/uiSizing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
import { getUserIdFromToken } from '../../utils/storage';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AttachDocument from '../../components/AttachDocument';
import ItemNameSuggestions from '../../components/ItemNameSuggestions';
import { upsertItemNames } from '../../api/items';
import Modal from 'react-native-modal';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';

const { width } = Dimensions.get('window');

interface AddNewEntryScreenParams {
  customer: any;
  partyType: 'customer' | 'supplier';
  entryType: 'gave' | 'got';
  editingItem?: any;
  showInvoiceUI?: boolean; // New parameter to show invoice UI when needed
  showPurchaseUI?: boolean; // New parameter to show purchase UI when needed
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  gstPct: number;
  gstAmount: number;
}

const AddNewEntryScreen: React.FC = () => {
  // StatusBar like ProfileScreen for colored header
  const { statusBarSpacer } = useStatusBarWithGradient('AddNewEntry', [
    '#4f8cff',
    '#4f8cff',
  ]);
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'AddNewEntry'>>();
  const {
    customer,
    partyType,
    entryType,
    editingItem,
    showInvoiceUI,
    showPurchaseUI,
  } = route.params;

  // Normalizers for phone/address coming from various shapes
  const normalizePhone = (value: any): string => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length >= 11 && digits.startsWith('91'))
      return digits.slice(-10);
    if (digits.length === 10) return digits;
    return '';
  };
  const extractCustomerPhone = (c: any): string =>
    normalizePhone(c?.phoneNumber ?? c?.phone ?? c?.phone_number);
  const extractCustomerAddress = (c: any): string => {
    const addr =
      c?.address ??
      c?.addressLine1 ??
      c?.address_line1 ??
      (Array.isArray(c?.addresses)
        ? c.addresses[0]?.addressLine1 || c.addresses[0]?.address_line1
        : '') ??
      '';
    return String(addr || '');
  };

  // Add safety check for required params
  if (!customer || !partyType || !entryType) {
    return (
      // @ts-ignore - styles defined at bottom of file
      <SafeAreaView style={styles.container}>
        {/* @ts-ignore - styles defined at bottom of file */}
        <View style={styles.errorContainer}>
          {/* @ts-ignore - styles defined at bottom of file */}
          <Text style={styles.errorDisplayText}>Required data not found</Text>
          <TouchableOpacity
            // @ts-ignore - styles defined at bottom of file
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            {/* @ts-ignore - styles defined at bottom of file */}
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Determine entry type for enhanced functionality
  const isPurchaseEntry = showPurchaseUI && entryType === 'gave'; // Show purchase UI when explicitly requested
  const isSellEntry = showInvoiceUI; // Show invoice UI when explicitly requested (Sell button)
  const isSimpleEntry = !isPurchaseEntry && !isSellEntry; // Simple entry only when not Purchase or Sell

  // Form states
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState(''); // Only for simple entries
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null); // Only for simple entries
  const [description, setDescription] = useState(''); // Only for simple entries
  const [notes, setNotes] = useState('');
  const [attachedDocument, setAttachedDocument] = useState<{
    name: string;
    type: 'image' | 'pdf';
    uri: string;
    size?: number;
  } | null>(null);

  // Invoice/Purchase specific states
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [gstPercentage, setGstPercentage] = useState(18);
  const [subtotal, setSubtotal] = useState(0);
  const [totalGST, setTotalGST] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0); // Tax amount field
  const [discountAmount, setDiscountAmount] = useState(0); // Discount amount field
  const [total, setTotal] = useState(0);

  // UI states
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showGstModal, setShowGstModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  // Track blur timeout to cancel it if field is focused again
  const blurTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const logDebug = (label: string, payload: any) => {
    try {
      const msg = `${label}: ${JSON.stringify(payload)}`;
      setDebugMessages(prev => [msg, ...prev].slice(0, 12));
    } catch (e) {
      setDebugMessages(prev =>
        [`${label}: [unserializable]`, ...prev].slice(0, 12),
      );
    }
  };

  // Custom Alert State
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'confirm';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' | 'confirm' = 'info',
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      onConfirm,
      onCancel,
      confirmText: confirmText || (type === 'confirm' ? 'Confirm' : 'OK'),
      cancelText: cancelText || 'Cancel',
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert(prev => ({ ...prev, visible: false }));
  };

  const [errors, setErrors] = useState<{
    amount?: string;
    paymentMethod?: string;
    description?: string;
    items?: string;
  }>({});

  // Per-item inline validation errors
  const [itemErrors, setItemErrors] = useState<
    Record<
      string,
      {
        description?: string;
        quantity?: string;
        rate?: string;
      }
    >
  >({});

  // Transaction limit context
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  // Refs for keyboard handling
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const amountRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const taxAmountRef = useRef<TextInput>(null);
  const discountAmountRef = useRef<TextInput>(null);

  // Refs for tracking GST amount changes
  const prevGstAmountRef = useRef(0);
  const prevSubtotalRef = useRef(0);
  const prevGstPercentageRef = useRef(18); // Track previous GST percentage

  // Local cache helpers for items by transaction id (for backends that don't persist line items)
  const ITEMS_CACHE_KEY = 'transactionItemsCache_v1';

  const loadCachedItems = async (
    txId: number | string,
  ): Promise<InvoiceItem[] | null> => {
    try {
      const raw = await AsyncStorage.getItem(ITEMS_CACHE_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw || '{}');
      const list = map[String(txId)];
      if (!Array.isArray(list)) return null;
      return list.map((it: any, idx: number) => ({
        id: it.id || `${txId}_${idx}`,
        description: it.description || it.name || '',
        quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
        rate: Number(it.rate ?? 0) || 0,
        amount: Number(
          (it.amount ?? Number(it.quantity ?? 0) * Number(it.rate ?? 0)) || 0,
        ),
        gstPct: Number(it.gstPct ?? gstPercentage ?? 0) || 0,
        gstAmount: Number(it.gstAmount ?? 0) || 0,
      }));
    } catch {
      return null;
    }
  };

  const saveCachedItems = async (
    txId: number | string,
    itemsToSave: InvoiceItem[],
  ) => {
    try {
      const raw = await AsyncStorage.getItem(ITEMS_CACHE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[String(txId)] = itemsToSave.map(it => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
        amount: it.amount,
        gstPct: it.gstPct,
        gstAmount: it.gstAmount,
      }));
      await AsyncStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify(map));
    } catch {}
  };

  const getEntryTypeText = () => {
    if (isPurchaseEntry) return 'Purchase';
    if (isSellEntry) return 'Sell';
    return entryType === 'gave' ? 'Payment' : 'Receipt';
  };

  const addNewItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
      gstPct: gstPercentage,
      gstAmount: 0,
    };
    setItems([...items, newItem]);
  };

  const hasMeaningfulItems = (arr: InvoiceItem[] | any[]): boolean => {
    try {
      if (!Array.isArray(arr)) return false;
      return arr.some(
        (it: any) =>
          Number(it.amount) > 0 ||
          (Number(it.quantity) > 0 && Number(it.rate) > 0),
      );
    } catch {
      return false;
    }
  };

  // Function to scroll to center the focused input field
  const scrollToInputCenter = (inputRef: React.RefObject<TextInput | null>) => {
    if (scrollRef.current && inputRef.current) {
      console.log('🔍 Attempting to scroll to input center');

      // Use a controlled scrolling approach
      setTimeout(() => {
        try {
          // Use KeyboardAwareScrollView's scrollToFocusedInput method
          if (inputRef.current) {
            scrollRef.current?.scrollToFocusedInput(inputRef.current, 200);
            console.log('🔍 ScrollToFocusedInput completed successfully');
          }
        } catch (error) {
          console.log('🔍 Error scrolling:', error);
          // Fallback: try to scroll to a reasonable position using scrollToPosition
          try {
            scrollRef.current?.scrollToPosition(0, 250, true);
          } catch (fallbackError) {
            console.log('🔍 Fallback scroll also failed:', fallbackError);
            // Final fallback: measure and scroll manually
            try {
              inputRef.current?.measure((x, y, width, height, pageX, pageY) => {
                const screenHeight = Dimensions.get('window').height;
                const targetY = Math.max(
                  0,
                  pageY - screenHeight / 2 + height / 2,
                );
                // Use scrollToPosition for KeyboardAwareScrollView
                scrollRef.current?.scrollToPosition(0, targetY, true);
              });
            } catch (measureError) {
              console.log('🔍 Measure scroll also failed:', measureError);
            }
          }
        }
      }, 200); // Slightly longer delay for better reliability
    }
  };

  // Payment method options
  const paymentMethods = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Bank Transfer', value: 'Bank Transfer' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Cheque', value: 'Cheque' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Debit Card', value: 'Debit Card' },
    { label: 'Other', value: 'Other' },
  ];

  // GST percentage options
  const gstPercentages = [0, 5, 12, 18, 28];

  // Initialize form data
  useEffect(() => {
    console.log('🔍 useEffect called - editingItem:', !!editingItem);
    console.log('🔍 useEffect called - isPurchaseEntry:', isPurchaseEntry);
    console.log('🔍 useEffect called - isSellEntry:', isSellEntry);

    const initializeForm = async () => {
      if (editingItem) {
        console.log('🔍 ===== EDITING ITEM DATA =====');
        console.log(
          '🔍 Full editingItem object:',
          JSON.stringify(editingItem, null, 2),
        );
        console.log('🔍 Editing item keys:', Object.keys(editingItem));
        console.log('🔍 Editing item items structure:', editingItem.items);
        console.log('🔍 Editing item items type:', typeof editingItem.items);
        console.log('🔍 Editing item items length:', editingItem.items?.length);
        console.log('🔍 ===== END EDITING ITEM DATA =====');

        // Check for alternative item properties
        console.log('🔍 editingItem.products:', editingItem.products);
        console.log('🔍 editingItem.invoiceItems:', editingItem.invoiceItems);
        console.log(
          '🔍 editingItem.transactionItems:',
          editingItem.transactionItems,
        );
        console.log('🔍 editingItem.voucherItems:', editingItem.voucherItems);

        if (editingItem.items && editingItem.items.length > 0) {
          console.log('🔍 First item structure:', editingItem.items[0]);
        }
        // Pre-fill form for editing
        setDate(new Date(editingItem.date));
        setAmount(String(editingItem.amount || ''));
        setPaymentMethod(editingItem.method || null);
        setDescription(
          editingItem.description ||
            editingItem._raw?.description ||
            editingItem._raw?.narration ||
            '',
        );
        setNotes(editingItem.notes || editingItem._raw?.notes || '');
        setAttachedDocument(editingItem.attachedDocument || null);

        // Helper function to flatten and validate items (matching PurchaseScreen logic exactly)
        const flattenAndValidateItems = (items: any): any[] => {
          if (!items) {
            console.log('🔍 flattenAndValidateItems: items is null/undefined');
            return [];
          }

          console.log('🔍 flattenAndValidateItems: input:', {
            type: typeof items,
            isArray: Array.isArray(items),
            value: items,
          });

          // If it's a string, try to parse it
          if (typeof items === 'string') {
            try {
              const parsed = JSON.parse(items);
              console.log('🔍 flattenAndValidateItems: parsed string:', parsed);
              return flattenAndValidateItems(parsed);
            } catch (e) {
              console.error('🔍 flattenAndValidateItems: JSON parse error:', e);
              return [];
            }
          }

          // If it's not an array, return empty
          if (!Array.isArray(items)) {
            console.log('🔍 flattenAndValidateItems: not an array');
            return [];
          }

          // Check if it's a nested array like [[...]] (tuple format)
          if (items.length === 1 && Array.isArray(items[0])) {
            const unwrapped = items[0];
            console.log(
              '🔍 flattenAndValidateItems: unwrapped tuple:',
              unwrapped,
            );

            // Check if unwrapped is itself a tuple [name, qty, rate, amount, gstPct]
            // If it has length >= 2 and first element is not an array, it's a tuple row
            if (
              unwrapped.length >= 2 &&
              !Array.isArray(unwrapped[0]) &&
              typeof unwrapped[0] === 'string'
            ) {
              // This is a single tuple row like ["Mobile", 101, 22, 2333.1, 5]
              // Return it wrapped in an array: [[...]]
              console.log('🔍 flattenAndValidateItems: returning tuple row:', [
                unwrapped,
              ]);
              return [unwrapped];
            }

            // If unwrapped is empty or contains invalid data, return empty
            if (
              unwrapped.length === 0 ||
              (unwrapped.length === 1 &&
                Array.isArray(unwrapped[0]) &&
                unwrapped[0].length === 0)
            ) {
              console.log('🔍 flattenAndValidateItems: unwrapped is empty');
              return [];
            }

            // Unwrapped contains multiple items - return as array of tuples
            console.log(
              '🔍 flattenAndValidateItems: returning unwrapped items:',
              unwrapped,
            );
            return unwrapped.filter(
              (it: any) => !Array.isArray(it) || it.length > 0,
            );
          }

          // Filter out any nested empty arrays
          const filtered = items.filter((it: any) => {
            if (Array.isArray(it)) {
              // If it's an empty array, skip it
              if (it.length === 0) return false;
              // If it contains valid data, include it
              return true;
            }
            return true;
          });

          console.log(
            '🔍 flattenAndValidateItems: returning filtered items:',
            filtered,
          );
          return filtered;
        };

        // Load items if editing invoice/purchase - check multiple possible item properties (matching PurchaseScreen logic exactly)
        let mergedDetailItems: any[] = flattenAndValidateItems(editingItem.items);

        // If still no items, try alternative fields
        if (!mergedDetailItems || mergedDetailItems.length === 0) {
          mergedDetailItems = flattenAndValidateItems(
            (editingItem as any).transactionItems,
          );
        }

        if (!mergedDetailItems || mergedDetailItems.length === 0) {
          mergedDetailItems = flattenAndValidateItems(
            (editingItem as any).voucherItems,
          );
        }

        console.log('🔍 ===== SOURCE ITEMS DETECTION =====');
        console.log('🔍 Merged detail items:', mergedDetailItems);
        console.log('🔍 Merged detail items length:', mergedDetailItems.length);
        console.log(
          '🔍 Available editingItem properties:',
          Object.keys(editingItem),
        );
        console.log('🔍 editingItem.items:', editingItem.items);
        console.log('🔍 editingItem.products:', editingItem.products);
        console.log('🔍 editingItem.invoiceItems:', editingItem.invoiceItems);
        console.log(
          '🔍 editingItem.transactionItems:',
          editingItem.transactionItems,
        );
        console.log('🔍 editingItem.voucherItems:', editingItem.voucherItems);
        console.log('🔍 editingItem.lineItems:', editingItem.lineItems);
        console.log('🔍 editingItem.line_items:', editingItem.line_items);
        console.log('🔍 ===== END SOURCE ITEMS DETECTION =====');

        if (mergedDetailItems && mergedDetailItems.length > 0) {
          console.log('🔍 ===== MAPPING SOURCE ITEMS =====');
          console.log('🔍 Source items to map:', mergedDetailItems);
          console.log('🔍 First source item:', mergedDetailItems[0]);
          console.log('🔍 ===== END MAPPING SOURCE ITEMS =====');

          // Map source items to component format (matching PurchaseScreen logic exactly)
          const mappedItems = mergedDetailItems.map((item: any, idx: number) => {
            // Handle tuple format: [name, qty, rate, amount, gstPct]
            if (Array.isArray(item) && item.length >= 2) {
              const [name, qty, rate, amount, gstPct] = item;
              return {
                id: `${Date.now()}_${idx}`,
                description: String(name || ''),
                quantity: Number(qty) || 1,
                rate: Number(rate) || 0,
                amount: Number(amount) || (Number(qty) || 1) * (Number(rate) || 0),
                gstPct: Number(gstPct ?? gstPercentage ?? 0) || 0,
                gstAmount: 0,
              };
            }

            // Handle object format
            const qty =
              item?.qty != null
                ? Number(item.qty)
                : Number(item?.quantity) || 1;
            const rate = item?.rate != null ? Number(item.rate) : 0;
            const amount =
              item?.amount != null
                ? Number(item.amount)
                : qty * rate;

            console.log('🔍 Item data for mapping:', {
              item,
              qty,
              rate,
              amount,
              gstPercentage,
            });

            // Match PurchaseScreen description logic exactly
            const itemDescription =
              item?.description || item?.name || item?.itemName || '';

            console.log('🔍 Item description mapping:', {
              item,
              description: itemDescription,
              itemName: item.name,
              itemName_field: item.itemName,
            });

            return {
              id: item.id || `${Date.now()}_${idx}`,
              description: itemDescription,
              quantity: isNaN(qty) ? 1 : qty,
              rate: isNaN(rate) ? 0 : rate,
              amount: isNaN(amount) ? 0 : amount,
              gstPct: Number(item.gstPct ?? gstPercentage ?? 0) || 0,
              gstAmount: Number(item.gstAmount ?? 0) || 0,
            };
          });
          console.log('🔍 ===== INITIAL MAPPED ITEMS =====');
          console.log('🔍 Mapped items:', mappedItems);
          console.log('🔍 Mapped items length:', mappedItems.length);
          console.log('🔍 First mapped item:', mappedItems[0]);
          console.log(
            '🔍 Final mapped items details:',
            JSON.stringify(mappedItems, null, 2),
          );
          console.log('🔍 ===== END INITIAL MAPPED ITEMS =====');
          setItems(mappedItems);
        } else {
          // No line items returned: synthesize one item from amounts if available (matching PurchaseScreen logic)
          console.log('🔍 ===== NO SOURCE ITEMS - CREATING FALLBACK =====');
          console.log(
            '🔍 No source items found, will try API call or create fallback',
          );
          const stRaw = (editingItem as any).subTotal;
          const taRaw = (editingItem as any).totalAmount;
          const st =
            typeof stRaw === 'string' ? Number(stRaw) : Number(stRaw) || 0;
          const ta =
            typeof taRaw === 'string' ? Number(taRaw) : Number(taRaw) || 0;
          const g = typeof gstPercentage === 'number' ? gstPercentage : 0;

          console.log('🔍 Fallback calculation:', {
            stRaw,
            taRaw,
            st,
            ta,
            g,
            editingItemAmount: editingItem.amount,
          });

          if (st > 0 || ta > 0) {
            const base = st > 0 ? st : ta > 0 ? ta / (1 + g / 100) : 0;
            const amount = base * (1 + g / 100);
            const fallbackItems = [
              {
                id: '1',
                description:
                  (editingItem as any).description ||
                  (editingItem as any).partyName ||
                  'Item 1',
                quantity: 1,
                rate: base,
                amount: amount,
                gstPct: g,
                gstAmount: 0,
              },
            ];

            console.log('🔍 ===== FALLBACK ITEMS CREATED =====');
            console.log('🔍 Fallback items:', fallbackItems);
            console.log('🔍 Base amount:', base);
            console.log('🔍 Calculated amount:', amount);
            console.log('🔍 GST percentage:', g);
            console.log('🔍 ===== END FALLBACK ITEMS =====');

            setItems(fallbackItems);
          } else {
            const emptyItems = [
              {
                id: '1',
                description: '',
                quantity: 1,
                rate: 0,
                amount: 0,
                gstPct: 0,
                gstAmount: 0,
              },
            ];

            console.log('🔍 ===== EMPTY ITEMS CREATED =====');
            console.log('🔍 Empty items:', emptyItems);
            console.log('🔍 ===== END EMPTY ITEMS =====');

            setItems(emptyItems);
          }
        }

        // If items are not present on the navigation payload, fetch full transaction detail
        console.log('🔍 ===== STARTING API CALL FOR ITEMS =====');
        console.log('🔍 editingItem.id exists:', !!editingItem?.id);
        console.log('🔍 editingItem.id value:', editingItem?.id);
        try {
          const token = await AsyncStorage.getItem('accessToken');
          console.log('🔍 Token exists:', !!token);
          if (token && editingItem?.id) {
            // Try cache first for a fast, stable prefill
            const cached = await loadCachedItems(editingItem.id);
            if (cached && cached.length > 0 && items.length === 0) {
              setItems(cached);
            }
            // Use unified API with caching
            console.log(
              '🔍 Fetching transaction detail for editing:',
              editingItem.id,
            );
            // Debug
            try {
              setDebugMessages(prev =>
                [`GET detail id: ${editingItem.id}`, ...prev].slice(0, 12),
              );
            } catch {}
            const detailResponse = (await unifiedApi.getTransactionById(
              editingItem.id,
            )) as { data: any; status: number; headers: Headers };
            const detail = detailResponse.data || detailResponse;
            console.log('🔍 ===== API TRANSACTION DETAIL RESPONSE =====');
            console.log(
              '🔍 Full API response:',
              JSON.stringify(detail, null, 2),
            );
            console.log('🔍 Response data:', detail?.data);
            console.log('🔍 Response items:', detail?.data?.items);
            console.log('🔍 Response lineItems:', detail?.data?.lineItems);
            console.log('🔍 Response products:', detail?.data?.products);
            console.log(
              '🔍 Response invoiceItems:',
              detail?.data?.invoiceItems,
            );
            console.log('🔍 ===== END API RESPONSE =====');
            try {
              setDebugMessages(prev =>
                [`GET detail body: ${JSON.stringify(detail)}`, ...prev].slice(
                  0,
                  12,
                ),
              );
            } catch {}
            const tx = detail?.data || detail;
            // Use the same flattenAndValidateItems function for API response
            let apiItems: any[] = flattenAndValidateItems(tx?.items);

            // If still no items, try alternative fields
            if (!apiItems || apiItems.length === 0) {
              apiItems = flattenAndValidateItems((tx as any).transactionItems);
            }

            if (!apiItems || apiItems.length === 0) {
              apiItems = flattenAndValidateItems((tx as any).voucherItems);
            }

            console.log('🔍 ===== ITEMS CANDIDATES =====');
            console.log('🔍 API items:', apiItems);
            console.log('🔍 API items length:', apiItems.length);
            console.log('🔍 First API item:', apiItems[0]);
            console.log('🔍 ===== END ITEMS CANDIDATES =====');
            if (apiItems.length > 0) {
              const mapped = apiItems.map((it: any, idx: number) => {
                // Handle tuple format: [name, qty, rate, amount, gstPct]
                if (Array.isArray(it) && it.length >= 2) {
                  const [name, qty, rate, amount, gstPct] = it;
                  return {
                    id: `${Date.now()}_${idx}`,
                    description: String(name || ''),
                    quantity: Number(qty) || 1,
                    rate: Number(rate) || 0,
                    amount: Number(amount) || (Number(qty) || 1) * (Number(rate) || 0),
                    gstPct: Number(gstPct ?? gstPercentage ?? 0) || 0,
                    gstAmount: 0,
                  };
                }

                // Handle object format - Match PurchaseScreen logic for API items exactly
                const qty =
                  it?.qty != null ? Number(it.qty) : Number(it?.quantity) || 1;
                const rate = it?.rate != null ? Number(it.rate) : 0;
                const amount =
                  it?.amount != null
                    ? Number(it.amount)
                    : qty * rate;

                const apiItemDescription =
                  it?.description || it?.name || it?.itemName || '';

                console.log('🔍 API Item description mapping:', {
                  item: it,
                  description: apiItemDescription,
                  itemName: it.name,
                  itemTitle: it.title,
                  productName: it.productName,
                  itemName_field: it.itemName,
                });

                return {
                  id: it.id || `${Date.now()}_${idx}`,
                  description: apiItemDescription,
                  quantity: isNaN(qty) ? 1 : qty,
                  rate: isNaN(rate) ? 0 : rate,
                  amount: isNaN(amount) ? 0 : amount,
                  gstPct: it.gstPct || gstPercentage,
                  gstAmount: it.gstAmount || 0,
                };
              });

              console.log('🔍 ===== MAPPED API ITEMS =====');
              console.log('🔍 Mapped items:', mapped);
              console.log('🔍 Mapped items length:', mapped.length);
              console.log('🔍 First mapped item:', mapped[0]);
              console.log('🔍 ===== END MAPPED API ITEMS =====');

              // Only replace if mapped has meaningful values. Ignore empty/zero-only payloads
              const filteredMapped = mapped.filter((m: any) =>
                hasMeaningfulItems([m] as any),
              );
              const mappedMeaningful = hasMeaningfulItems(
                filteredMapped as any,
              );

              console.log('🔍 ===== FILTERED MAPPED ITEMS =====');
              console.log('🔍 Filtered mapped items:', filteredMapped);
              console.log('🔍 Mapped meaningful:', mappedMeaningful);
              console.log('🔍 ===== END FILTERED MAPPED ITEMS =====');
              if (mappedMeaningful) {
                setItems(filteredMapped);
                // Update cache for stability in future edits
                await saveCachedItems(editingItem.id, filteredMapped);
                try {
                  setDebugMessages(prev =>
                    [
                      `Applied mapped items: ${JSON.stringify(filteredMapped)}`,
                      ...prev,
                    ].slice(0, 12),
                  );
                } catch {}
              } else {
                // Keep existing/cached items; log that API items were ignored as empty
                try {
                  setDebugMessages(prev =>
                    [
                      'Ignored API items because they were empty/zero-only',
                      ...prev,
                    ].slice(0, 12),
                  );
                } catch {}
              }
            } else {
              // If backend returns no item rows but we have amounts, synthesize one display item (matching PurchaseScreen)
              console.log(
                '🔍 ===== NO API ITEMS - CREATING API FALLBACK =====',
              );
              if (
                typeof (tx as any).subTotal === 'number' ||
                typeof (tx as any).totalAmount === 'number'
              ) {
                const base =
                  typeof (tx as any).subTotal === 'number'
                    ? (tx as any).subTotal
                    : 0;
                const gPct = typeof tx?.gstPct === 'number' ? tx.gstPct : 0;
                const rateVal =
                  base > 0 ? base : Number(editingItem.amount) || 0;
                const amountVal = rateVal * (1 + gPct / 100);
                const apiFallbackItems = [
                  {
                    id: '1',
                    name:
                      (tx as any).description ||
                      (tx as any).partyName ||
                      'Item 1',
                    description:
                      (tx as any).description ||
                      (tx as any).partyName ||
                      'Item 1',
                    quantity: 1,
                    rate: rateVal,
                    amount: amountVal,
                    gstPct: gPct,
                    gstAmount: 0,
                  },
                ];

                console.log('🔍 ===== API FALLBACK ITEMS CREATED =====');
                console.log('🔍 API fallback items:', apiFallbackItems);
                console.log('🔍 Base amount:', base);
                console.log('🔍 Rate value:', rateVal);
                console.log('🔍 Amount value:', amountVal);
                console.log('🔍 GST percentage:', gPct);
                console.log('🔍 ===== END API FALLBACK ITEMS =====');

                const currentMeaningful = hasMeaningfulItems(items as any);
                setItems(currentMeaningful ? items : apiFallbackItems);
                await saveCachedItems(editingItem.id, apiFallbackItems);
              }
            }
            // Load header-level fields if present (with fallbacks)
            const gstPctHeader =
              tx?.gstPct ?? tx?.gst_percentage ?? tx?.gstRate;
            if (gstPctHeader !== undefined)
              setGstPercentage(Number(gstPctHeader) || 0);
            const subTotalHeader =
              tx?.subTotal ?? tx?.sub_total ?? tx?.subtotal;
            if (subTotalHeader !== undefined)
              setSubtotal(Number(subTotalHeader) || 0);
            // Tax Amount should show ONLY GST amount, not other taxes
            const cGstHeader = tx?.cGST ?? tx?.cgst ?? tx?.taxAmount;
            if (cGstHeader !== undefined) {
              // Calculate GST amount from subtotal and GST percentage
              const subtotalForGst = Number(subTotalHeader || subtotal || 0);
              const gstPctForGst = Number(gstPctHeader || gstPercentage || 0);
              const gstAmount = subtotalForGst * (gstPctForGst / 100);
              setTaxAmount(gstAmount);
            }
            const discountHeader = tx?.discount ?? tx?.discountAmount;
            if (discountHeader !== undefined)
              setDiscountAmount(Number(discountHeader) || 0);
            const totalFromApi =
              tx?.totalAmount ?? tx?.total ?? tx?.grandTotal ?? tx?.amount;
            if (totalFromApi !== undefined) setTotal(Number(totalFromApi) || 0);
            const docDate = tx?.documentDate || tx?.date || tx?.createdAt;
            if (docDate) setDate(new Date(docDate));
            const desc = tx?.description || tx?.narration;
            const notes = tx?.notes;
            if (desc) {
              setDescription(desc);
            }
            if (notes) {
              setNotes(notes);
            }
          } else {
            console.log('🔍 Failed to fetch transaction detail');
            console.log('🔍 API call failed, adding new item');
            addNewItem();
          }
        } catch (detailErr) {
          console.log('🔍 Error loading transaction detail:', detailErr);
          console.log('🔍 Exception occurred, adding new item');
          addNewItem();
        }
        // If no items but it's a purchase/sell entry, add default item
        console.log('🔍 Item list prepared for edit (fetched or default).');

        // Load GST percentage
        if (editingItem.gstPct !== undefined) {
          console.log('🔍 Loading GST percentage:', editingItem.gstPct);
          setGstPercentage(editingItem.gstPct);
        } else {
          console.log(
            '🔍 No GST percentage found in editing item, using default:',
            gstPercentage,
          );
        }

        // Load tax amount and discount amount
        // Tax Amount should show ONLY GST amount, not other taxes
        if (editingItem.cGST !== undefined) {
          console.log('🔍 Loading tax amount (cGST):', editingItem.cGST);
          // Calculate GST amount from subtotal and GST percentage
          const subtotalForGst = items.reduce(
            (sum, item) => sum + (item.amount || 0),
            0,
          );
          const gstPctForGst = editingItem.gstPct || gstPercentage || 0;
          const gstAmount = subtotalForGst * (gstPctForGst / 100);
          setTaxAmount(gstAmount);
        }
        if (editingItem.discount !== undefined) {
          console.log('🔍 Loading discount amount:', editingItem.discount);
          setDiscountAmount(parseFloat(editingItem.discount) || 0);
        }
      } else {
        // Initialize with default item for new invoice/purchase
        if (isPurchaseEntry || isSellEntry) {
          addNewItem();
        }
      }
    };

    console.log('🔍 About to call initializeForm');
    initializeForm();
    console.log('🔍 initializeForm called');
  }, [editingItem, entryType, isPurchaseEntry, isSellEntry]);

  // Final guard: if editing a Sell/Purchase and items are empty, synthesize one from known totals
  useEffect(() => {
    if ((isPurchaseEntry || isSellEntry) && items.length === 0) {
      const baseFromSubtotal = Number(subtotal || 0);
      const baseFromTotal = Number(total || 0);
      const baseFromEdit = Number((editingItem && editingItem.amount) || 0);
      const base =
        baseFromSubtotal > 0
          ? baseFromSubtotal
          : baseFromTotal > 0
          ? baseFromTotal
          : baseFromEdit;
      if (base > 0) {
        const baseAmount = base / (1 + (gstPercentage || 0) / 100);
        setItems([
          {
            id: `${Date.now()}_auto`,
            description:
              (editingItem &&
                (editingItem.description ||
                  (editingItem._raw && editingItem._raw.description) ||
                  editingItem.narration)) ||
              'Purchase Item',
            quantity: 1,
            rate: baseAmount,
            amount: base,
            gstPct: gstPercentage,
            gstAmount: 0,
          } as any,
        ]);
      }
    }
  }, [
    isPurchaseEntry,
    isSellEntry,
    items.length,
    subtotal,
    total,
    gstPercentage,
  ]);

  // Calculate totals when items change
  useEffect(() => {
    if (isPurchaseEntry || isSellEntry) {
      console.log('🔍 ===== ITEMS STATE CHANGED =====');
      console.log('🔍 Current items state:', items);
      console.log('🔍 Items length:', items.length);
      console.log('🔍 First item:', items[0]);
      console.log('🔍 ===== END ITEMS STATE =====');
      calculateTotals();
    }
  }, [items, gstPercentage]);

  // Update taxAmount when items or GST percentage changes
  // Use refs to track previous values to calculate difference
  useEffect(() => {
    if ((isPurchaseEntry || isSellEntry) && items.length > 0) {
      const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
      const newGstAmount = subtotal * (gstPercentage / 100);
      // Calculate old GST amount based on previous subtotal and previous GST percentage
      const oldGstAmount =
        prevSubtotalRef.current * (prevGstPercentageRef.current / 100);

      // Check if GST percentage changed
      const gstPercentageChanged =
        prevGstPercentageRef.current !== gstPercentage;

      setTaxAmount(prev => {
        // If GST percentage changed, always recalculate taxAmount to new GST amount
        if (gstPercentageChanged) {
          prevGstAmountRef.current = newGstAmount;
          prevSubtotalRef.current = subtotal;
          prevGstPercentageRef.current = gstPercentage;
          return newGstAmount;
        }

        // If taxAmount is 0 or very close to old GST, set it to new GST
        if (prev === 0 || Math.abs(prev - oldGstAmount) < 0.01) {
          prevGstAmountRef.current = newGstAmount;
          prevSubtotalRef.current = subtotal;
          prevGstPercentageRef.current = gstPercentage;
          return newGstAmount;
        }

        // Otherwise, adjust by the difference in GST (only when subtotal changes, not GST percentage)
        const gstDifference = newGstAmount - oldGstAmount;
        prevGstAmountRef.current = newGstAmount;
        prevSubtotalRef.current = subtotal;
        prevGstPercentageRef.current = gstPercentage;
        return prev + gstDifference;
      });
    } else {
      // Update refs even when items are empty or not purchase/sell entry
      prevGstPercentageRef.current = gstPercentage;
    }
  }, [items, gstPercentage, isPurchaseEntry, isSellEntry]);

  // Calculate totals when tax or discount amounts change
  useEffect(() => {
    if (isPurchaseEntry || isSellEntry) {
      calculateTotals();
    }
  }, [taxAmount, discountAmount]);

  // Force dropdown to update when gstPercentage changes
  useEffect(() => {
    console.log('🔍 GST Percentage changed to:', gstPercentage);
  }, [gstPercentage]);

  const updateItem = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number,
  ) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate amount (GST is calculated globally)
          if (field === 'quantity' || field === 'rate') {
            const quantity =
              typeof updatedItem.quantity === 'string'
                ? parseFloat(updatedItem.quantity) || 0
                : updatedItem.quantity;
            const rate =
              typeof updatedItem.rate === 'string'
                ? parseFloat(updatedItem.rate) || 0
                : updatedItem.rate;
            updatedItem.amount = quantity * rate;
            // GST is calculated globally, not per item
            updatedItem.gstAmount = 0;
          }

          return updatedItem;
        }
        return item;
      }),
    );

    // Clear field-level error when value becomes valid
    setItemErrors(prev => {
      const next = { ...prev };
      const current = next[id] || {};
      const numeric = (val: any) =>
        typeof val === 'number' ? val : parseFloat(val);
      if (field === 'description') {
        if (String(value).trim().length >= 1) {
          delete current.description;
        }
      }
      if (field === 'quantity') {
        if (!isNaN(numeric(value)) && numeric(value) > 0) {
          delete current.quantity;
        }
      }
      if (field === 'rate') {
        if (!isNaN(numeric(value)) && numeric(value) > 0) {
          delete current.rate;
        }
      }
      if (Object.keys(current).length === 0) {
        delete next[id];
      } else {
        next[id] = current;
      }
      return next;
    });
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    }
  };

  const calculateTotals = () => {
    const newSubtotal = items.reduce(
      (sum, item) => sum + (item.amount || 0),
      0,
    );

    // Calculate GST based on subtotal and global GST percentage
    const newTotalGST = (newSubtotal * gstPercentage) / 100;

    // Calculate total: GST is included in taxAmount, so no need to add totalGST separately
    const newTotal = newSubtotal + (taxAmount || 0) - (discountAmount || 0);

    console.log('🔍 Calculate Totals:', {
      newSubtotal,
      gstPercentage,
      newTotalGST,
      taxAmount,
      discountAmount,
      newTotal,
    });

    setSubtotal(newSubtotal);
    setTotalGST(newTotalGST);
    setTotal(newTotal);
  };

  const clearFieldError = (field: keyof typeof errors) => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAmountChange = (text: string) => {
    // Keep only digits and one decimal point
    const numericValue = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) return;

    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) return;

    setAmount(numericValue);

    if (
      numericValue.trim() &&
      !isNaN(parseFloat(numericValue)) &&
      parseFloat(numericValue) > 0
    ) {
      clearFieldError('amount');
    }
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (text.trim().length >= 3) {
      clearFieldError('description');
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      amount?: string;
      paymentMethod?: string;
      description?: string;
      items?: string;
    } = {};

    const newItemErrors: Record<
      string,
      {
        description?: string;
        quantity?: string;
        rate?: string;
      }
    > = {};

    // Validate simple entry fields (Payment/Receipt only)
    if (isSimpleEntry) {
      // Validate amount
      if (!amount.trim()) {
        newErrors.amount = 'Amount is required';
      } else {
        const amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
          newErrors.amount = 'Amount must be a valid positive number';
        }
      }

      // Validate payment method
      if (!paymentMethod || !paymentMethod.trim()) {
        newErrors.paymentMethod = 'Payment method is required';
      }

      // Validate description
      if (!description.trim()) {
        newErrors.description = 'Description is required';
      } else if (description.trim().length < 3) {
        newErrors.description = 'Description must be at least 3 characters';
      }
    }

    // Validate items for invoice/purchase (Purchase/Sell entries)
    if (isPurchaseEntry || isSellEntry) {
      if (items.length === 0) {
        newErrors.items = 'At least one item is required';
      } else {
        items.forEach(item => {
          const errs: {
            description?: string;
            quantity?: string;
            rate?: string;
          } = {};
          if (!item.description || !item.description.trim()) {
            errs.description = 'Required';
          }
          if (!item.quantity || item.quantity <= 0) {
            errs.quantity = 'Must be > 0';
          }
          if (!item.rate || item.rate <= 0) {
            errs.rate = 'Must be > 0';
          }
          if (Object.keys(errs).length > 0) {
            newItemErrors[item.id] = errs;
          }
        });
        if (Object.keys(newItemErrors).length > 0) {
          newErrors.items = 'Please fix highlighted item fields';
        }
      }
    }

    setErrors(newErrors);
    setItemErrors(newItemErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Hard guard: block submit if monthly limit reached
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        // Use unified API for transaction limits
        const limitsData = (await unifiedApi.getTransactionLimits()) as {
          canCreate?: boolean;
        };
        if (limitsData && limitsData.canCreate === false) {
          await forceShowPopup();
          showCustomAlert(
            'Monthly Limit Reached',
            'You have reached your monthly transaction limit. Please upgrade your plan to continue.',
            'error',
          );
          return;
        }
      }
    } catch {}
    // For simple Payment/Receipt entries, enforce strict form validation
    if (isSimpleEntry) {
      if (!validateForm()) {
        return;
      }
    }

    setLoading(true);
    setErrors({});

    try {
      // Check transaction limit before API call
      await forceCheckTransactionLimit();
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        showCustomAlert(
          'Error',
          'Authentication token not found. Please login again.',
          'error',
        );
        return;
      }

      const userId = await getUserIdFromToken();
      if (!userId) {
        showCustomAlert(
          'Error',
          'User not authenticated. Please login again.',
          'error',
        );
        return;
      }

      let apiEndpoint = '';
      let body: any = {};

      // Build a safe items list for Purchase/Sell submissions even if fields are incomplete
      const hasValidItems =
        items.length > 0 &&
        items.every(
          it =>
            it &&
            String(it.description || '').trim().length > 0 &&
            Number(it.quantity) > 0 &&
            Number(it.rate) > 0,
        );
      const fallbackAmount = subtotal > 0 ? subtotal : total > 0 ? total : 0;

      // Extract description from actual items if available, otherwise use 'Item' as fallback
      const firstItemDescription =
        items.length > 0 && items[0]?.description
          ? String(items[0].description).trim()
          : 'Item';

      const safeItems = hasValidItems
        ? items
        : fallbackAmount > 0
        ? [
            {
              id: Date.now().toString(),
              description: firstItemDescription || 'Item',
              quantity: 1,
              rate: fallbackAmount,
              amount: fallbackAmount,
              gstPct: gstPercentage,
              gstAmount: 0,
            },
          ]
        : items.length > 0
        ? items // Preserve items even if not fully valid
        : [];

      // Normalize items for POST
      const postItems = safeItems.map(it => ({
        name: (it.description || '').toString().trim() || 'Item',
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
        amount:
          Number(it.amount) ||
          (Number(it.quantity) || 0) * (Number(it.rate) || 0),
        gstPct: Number((it as any).gstPct ?? gstPercentage ?? 0) || 0,
      }));

      // Text/JSON mirrors similar to Purchase/Sell screens
      const itemsForText = postItems.map(it => ({
        Description: it.name,
        Quantity: Number(it.quantity) || 0,
        Rate: Number(it.rate) || 0,
        GST: Number((it as any).gstPct) || 0,
        Amount: Number(it.amount) || 0,
      }));

      // Ensure we never send a negative amount to backend
      // GST is included in taxAmount, so no need to add totalGST separately
      const computedTotal =
        (subtotal || 0) + (taxAmount || 0) - (discountAmount || 0);
      const safeTotal = Number(Math.max(0.01, computedTotal).toFixed(2));
      const safeSubTotal = Number(Math.max(0.01, subtotal || 0).toFixed(2));

      if (isSimpleEntry) {
        // Simple payment/receipt entry -> backend transactions (debit/credit)
        // Use unified API - no need for apiEndpoint
        const combinedDescription =
          (description && String(description).trim()) || '';

        // Generate document number based on entry type (starts at 001 for new users)
        let documentNumber = '';
        try {
          if (entryType === 'gave') {
            // Payment - use billNumber
            documentNumber = await generateNextDocumentNumber('payment', true); // Store - transaction being saved
          } else {
            // Receipt - use receiptNumber
            documentNumber = await generateNextDocumentNumber('receipt', true); // Store - transaction being saved
          }
        } catch (error) {
          console.error('Error generating document number:', error);
          // Fallback: generator returns PREFIX-001 for new users
          documentNumber = entryType === 'gave' ? 'PAY-001' : 'REC-001';
        }

        body = {
          customer_id: customer?.id ? parseInt(customer.id) : undefined,
          type: entryType === 'gave' ? 'debit' : 'credit',
          amount: Number(Math.max(0.01, parseFloat(amount) || 0).toFixed(2)),
          documentDate: date.toISOString(),
          date: date.toISOString(),
          description: combinedDescription,
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: extractCustomerPhone(customer),
          partyAddress: extractCustomerAddress(customer),
          method: paymentMethod || 'Cash',
          gstNumber: customer?.gstNumber || '',
          items: [],
          status: 'complete',
          // Include document number (starts at 001 for new users)
          ...(entryType === 'gave'
            ? { billNumber: documentNumber }
            : { receiptNumber: documentNumber }),
        };

        // Include user's primary role id for backend auditing/mapping
        try {
          const { addRoleIdToBody } = await import('../../utils/roleHelper');
          await addRoleIdToBody(body);
        } catch (e) {
          console.warn(
            '⚠️ AddNewEntryScreen: Failed to add role ID to payment/receipt body:',
            e,
          );
        }
      } else if (isPurchaseEntry) {
        // Purchase entry with items
        // Use unified API - no need for apiEndpoint

        // Generate document number for purchase (starts at 001 for new users)
        let purchaseNumber = '';
        try {
          purchaseNumber = await generateNextDocumentNumber('purchase', true); // Store - transaction being saved
        } catch (error) {
          console.error('Error generating purchase number:', error);
          // Fallback: generator returns 'PUR-001' for new users
          purchaseNumber = 'PUR-001';
        }

        body = {
          customer_id: customer?.id ? parseInt(customer.id) : undefined,
          type: 'debit',
          amount: safeTotal,
          documentDate: new Date(date).toISOString(),
          date: new Date(date).toISOString(),
          description: (description && String(description).trim()) || '',
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: extractCustomerPhone(customer),
          partyAddress: extractCustomerAddress(customer),
          // Items as array-of-arrays and mirrors for robust backend compatibility
          items: postItems.map(it => [
            (it as any).name,
            Number((it as any).quantity) || 0,
            Number((it as any).rate) || 0,
            Number((it as any).amount) || 0,
            Number((it as any).gstPct) || 0,
          ]),
          lineItems: postItems,
          line_items: postItems,
          items_text: JSON.stringify(itemsForText),
          transaction_items_json: JSON.stringify(itemsForText),
          voucher_items_json: JSON.stringify(itemsForText),
          itemsString: JSON.stringify(postItems),
          transactionItemsString: JSON.stringify(postItems),
          voucherItemsString: JSON.stringify(postItems),
          itemsRawJson: JSON.stringify(postItems),
          gstPct: gstPercentage,
          discount: discountAmount,
          cGST: taxAmount,
          subTotal: safeSubTotal,
          totalAmount: safeTotal,
          status: 'complete',
          // Include billNumber for purchase (starts at 001 for new users)
          billNumber: purchaseNumber,
          // Include GST number if customer has one
          gstNumber: customer?.gstNumber || '',
        };

        // Include user's primary role id for backend auditing/mapping
        try {
          const { addRoleIdToBody } = await import('../../utils/roleHelper');
          await addRoleIdToBody(body);
        } catch (e) {
          console.warn(
            '⚠️ AddNewEntryScreen: Failed to add role ID to purchase body:',
            e,
          );
        }
      } else if (isSellEntry) {
        // Sell entry with items
        // Use unified API - no need for apiEndpoint

        // Generate document number for sell/invoice (starts at 001 for new users)
        let invoiceNumber = '';
        try {
          invoiceNumber = await generateNextDocumentNumber('sell', true); // Store - transaction being saved
        } catch (error) {
          console.error('Error generating invoice number:', error);
          // Fallback: generator returns 'SEL-001' for new users
          invoiceNumber = 'SEL-001';
        }

        body = {
          customer_id: customer?.id ? parseInt(customer.id) : undefined,
          type: 'credit',
          amount: safeTotal,
          documentDate: new Date(date).toISOString(),
          date: new Date(date).toISOString(),
          description: (description && String(description).trim()) || '',
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: extractCustomerPhone(customer),
          partyAddress: extractCustomerAddress(customer),
          // Items as array-of-arrays and mirrors for robust backend compatibility
          items: postItems.map(it => [
            (it as any).name,
            Number((it as any).quantity) || 0,
            Number((it as any).rate) || 0,
            Number((it as any).amount) || 0,
            Number((it as any).gstPct) || 0,
          ]),
          lineItems: postItems,
          line_items: postItems,
          items_text: JSON.stringify(itemsForText),
          transaction_items_json: JSON.stringify(itemsForText),
          voucher_items_json: JSON.stringify(itemsForText),
          itemsString: JSON.stringify(postItems),
          transactionItemsString: JSON.stringify(postItems),
          voucherItemsString: JSON.stringify(postItems),
          itemsRawJson: JSON.stringify(postItems),
          gstPct: gstPercentage,
          discount: discountAmount,
          cGST: taxAmount,
          subTotal: safeSubTotal,
          totalAmount: safeTotal,
          status: 'complete',
          // Include invoiceNumber for sell (starts at 001 for new users)
          invoiceNumber: invoiceNumber,
          // Include GST number if customer has one
          gstNumber: customer?.gstNumber || '',
        };

        // Include user's primary role id for backend auditing/mapping
        try {
          const { addRoleIdToBody } = await import('../../utils/roleHelper');
          await addRoleIdToBody(body);
        } catch (e) {
          console.warn(
            '⚠️ AddNewEntryScreen: Failed to add role ID to sell body:',
            e,
          );
        }
      }

      let res;
      if (editingItem) {
        // PATCH update
        const patchBody: any = {};
        Object.keys(body).forEach(key => {
          if (body[key] !== undefined && body[key] !== '') {
            patchBody[key] = body[key];
          }
        });

        let methodToUse: 'PUT' | 'PATCH' = 'PUT';
        // Log request
        try {
          setDebugMessages(prev =>
            [`${methodToUse} body: ${JSON.stringify(body)}`, ...prev].slice(
              0,
              12,
            ),
          );
        } catch {}
        // Use unified API for update
        const resultBody = (await unifiedApi.updateTransaction(
          editingItem.id,
          patchBody,
        )) as { data: any; status: number; headers: Headers };
        const createdTx: any = resultBody?.data || resultBody || {};
      } else {
        // POST create
        console.log('📤 AddNewEntry POST', { body });
        try {
          setDebugMessages(prev =>
            [`POST body: ${JSON.stringify(body)}`, ...prev].slice(0, 12),
          );
        } catch {}
        // Use unified API for create
        const resultBody = (await unifiedApi.createTransaction(body)) as {
          data: any;
          status: number;
          headers: Headers;
        };
        console.log('✅ AddNewEntry: Server response body', resultBody);
        try {
          setDebugMessages(prev =>
            [
              `Create/Update response: ${JSON.stringify(resultBody)}`,
              ...prev,
            ].slice(0, 12),
          );
        } catch {}
        const createdTx: any = resultBody?.data || resultBody || {};
        if (createdTx?.id) {
          // Persist items to local cache as the backend may not store them
          if (Array.isArray(safeItems) && safeItems.length > 0) {
            await saveCachedItems(createdTx.id, safeItems as any);
            // Silent upsert of item names to items API (does not change transaction behavior)
            try {
              const upsertNames = (safeItems || [])
                .map((it: any) => String(it.description || it.name || ''))
                .filter(s => s && s.trim().length > 0);
              if (upsertNames.length > 0) {
                upsertItemNames(Array.from(new Set(upsertNames)).slice(0, 50))
                  .then(result => {
                    console.log('✅ Items upserted successfully:', result);
                  })
                  .catch(error => {
                    console.error('❌ Items upsert failed:', error);
                  });
              } else {
                console.log('⚠️ No item names to upsert (all empty)');
              }
            } catch (error) {
              console.error('❌ Items upsert error:', error);
            }
            // Update recent item names list for suggestions across sessions
            try {
              const existing = await AsyncStorage.getItem('recentItemNames_v1');
              const existingArr: string[] = existing
                ? JSON.parse(existing)
                : [];
              const newNames = safeItems
                .map((it: any) => String(it.description || it.name || ''))
                .filter(s => s && s.trim().length > 0);
              const merged = Array.from(
                new Set([...(newNames || []), ...(existingArr || [])]),
              ).slice(0, 50);
              await AsyncStorage.setItem(
                'recentItemNames_v1',
                JSON.stringify(merged),
              );
            } catch {}
          }
          console.log(
            '🔎 Verifying stored transaction by GET /transactions/:id',
          );
          const tokenVerify = await AsyncStorage.getItem('accessToken');
          // Use unified API for verification
          try {
            const verifyJson = await unifiedApi.getTransactionById(
              createdTx.id,
            );
            console.log('📦 Fetched stored transaction detail', verifyJson);
            try {
              setDebugMessages(prev =>
                [
                  `Verify detail body: ${JSON.stringify(verifyJson)}`,
                  ...prev,
                ].slice(0, 12),
              );
            } catch {}
          } catch (debugErr) {
            console.log('🔍 Debug verify skipped due to error:', debugErr);
            try {
              setDebugMessages(prev =>
                [`Debug verify error: ${String(debugErr)}`, ...prev].slice(
                  0,
                  12,
                ),
              );
            } catch {}
          }
        }
      }

      const entryTypeText = isPurchaseEntry
        ? 'Purchase'
        : isSellEntry
        ? 'Sell'
        : entryType === 'gave'
        ? 'Payment'
        : 'Receipt';

      // Format customer name properly
      const customerName = customer?.name?.trim() || 'Unknown Customer';
      const partyTypeText = partyType === 'customer' ? 'Customer' : 'Supplier';

      showCustomAlert(
        'Success',
        `${entryTypeText} ${editingItem ? 'updated' : 'added'} successfully!${
          isSimpleEntry
            ? `\n₹${amount} ${
                entryType === 'gave' ? 'paid to' : 'received from'
              } ${customerName}`
            : `\nTotal: ₹${total.toFixed(
                2,
              )} for ${partyTypeText}: ${customerName}`
        }`,
        'success',
        () => {
          console.log(
            '🔄 AddNewEntryScreen: Success navigation to CustomerDetailScreen with refresh',
          );
          navigation.navigate('CustomerDetail', {
            customer: customer,
            partyType: partyType,
            refresh: true,
          });
        },
      );
    } catch (error: any) {
      console.error('Error saving entry:', error);

      // Import error handler
      const { handleApiError } = require('../../utils/apiErrorHandler');
      const errorInfo = handleApiError(error);

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        showCustomAlert('Access Denied', errorInfo.message, 'error');
        return;
      }

      // Handle specific authentication errors
      if (
        error.message.includes('Authentication failed') ||
        error.message.includes('login again') ||
        errorInfo.status === 401
      ) {
        showCustomAlert(
          'Authentication Required',
          'Please login again to continue.',
          'error',
          () => {
            AsyncStorage.clear().then(() => {
              // Navigation will be handled by the auth system
            });
          },
        );
      } else {
        showCustomAlert(
          'Error',
          errorInfo.message ||
            `Failed to ${
              editingItem ? 'update' : 'add'
            } ${getEntryTypeText().toLowerCase()}. Please try again.`,
          'error',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;

    showCustomAlert(
      `Delete ${getEntryTypeText()}`,
      `Are you sure you want to delete this ${getEntryTypeText().toLowerCase()}? This action cannot be undone.`,
      'confirm',
      async () => {
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (!token) {
            showCustomAlert(
              'Error',
              'Authentication token not found. Please login again.',
              'error',
            );
            return;
          }

          // Use unified API for delete
          await unifiedApi.deleteTransaction(editingItem.id);

          showCustomAlert(
            'Success',
            `${getEntryTypeText()} deleted successfully!`,
            'success',
            () => {
              console.log(
                '🔄 AddNewEntryScreen: Delete success navigation to CustomerDetailScreen with refresh',
              );
              navigation.navigate('CustomerDetail', {
                customer: customer,
                partyType: partyType,
                refresh: true,
              });
            },
          );
        } catch (error: any) {
          console.error('Error deleting entry:', error);

          if (
            error.message.includes('Authentication failed') ||
            error.message.includes('login again')
          ) {
            showCustomAlert(
              'Authentication Required',
              'Please login again to continue.',
              'error',
              () => {
                AsyncStorage.clear().then(() => {
                  // Navigation handled by auth system
                });
              },
            );
          } else {
            showCustomAlert(
              'Error',
              error.message ||
                `Failed to delete ${getEntryTypeText().toLowerCase()}. Please try again.`,
              'error',
            );
          }
        }
      },
      undefined,
      'Delete',
      'Cancel',
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Debug logging
  console.log('🔍 AddNewEntryScreen Entry Type Detection:', {
    customer: customer?.name,
    partyType,
    entryType,
    showInvoiceUI,
    showPurchaseUI,
    isSimpleEntry,
    isPurchaseEntry,
    isSellEntry,
    entryTypeText: getEntryTypeText(),
  });

  console.log('🔍 Field Visibility Logic:', {
    'Amount field shown': isSimpleEntry,
    'Payment Method field shown': isSimpleEntry,
    'Description field shown': isSimpleEntry,
    'Items section shown': isPurchaseEntry || isSellEntry,
  });

  console.log('🔍 GST Percentage Debug:', {
    gstPercentage,
    gstPercentageType: typeof gstPercentage,
    isEditing: !!editingItem,
  });

  const getEntryTypeColor = () => {
    if (isPurchaseEntry) return '#ff9500';
    if (isSellEntry) return '#9c27b0';
    return entryType === 'gave' ? '#dc3545' : '#28a745';
  };

  const renderItemRow = (item: InvoiceItem, index: number) => (
    <View key={item.id} style={styles.itemRow}>
      {index > 0 && <View style={styles.itemDivider} />}
      <View style={styles.itemRowHeader}>
        <View style={styles.itemIndexContainer}>
          <Text style={styles.itemIndex}>{index + 1}</Text>
        </View>
        {items.length > 1 && (
          <TouchableOpacity onPress={() => removeItem(item.id)}>
            <MaterialCommunityIcons name="delete" size={20} color="#dc3545" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemDescriptionContainer}>
          <Text style={styles.itemFieldLabel}>Description</Text>
          <TextInput
            style={[
              styles.itemDescriptionInput,
              itemErrors[item.id]?.description ? styles.inputError : {},
            ]}
            placeholder="Item description"
            value={item.description}
            onChangeText={text => {
              updateItem(item.id, 'description', text);
            }}
            placeholderTextColor="#666666"
            onFocus={() => {
              console.log('🔍 Item description input focused, centering...');
              // Close any open dropdowns when Item description field gets focus
              setShowPaymentMethodModal(false);
              setShowGstModal(false);
              scrollToInputCenter(descriptionRef);
              // Cancel any pending blur timeout for this item
              if (blurTimeoutRef.current[item.id]) {
                clearTimeout(blurTimeoutRef.current[item.id]);
                delete blurTimeoutRef.current[item.id];
              }
              // Always set focusedItemId when field is focused to open dropdown
              setFocusedItemId(item.id);
            }}
            // Don't close dropdown on blur - only close when another field is focused
          />
          <ItemNameSuggestions
            query={item.description || ''}
            visible={focusedItemId === item.id}
            localCandidates={
              (items || [])
                .map(it => it.description)
                .filter(Boolean) as string[]
            }
            onSelect={(name: string) => {
              updateItem(item.id, 'description', name);
              setFocusedItemId(null);
            }}
          />
          {itemErrors[item.id]?.description ? (
            <Text style={styles.errorText}>
              {itemErrors[item.id]?.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemDetailsRow}>
          <View style={styles.itemDetailColumn}>
            <Text style={styles.itemFieldLabel}>Quantity</Text>
            <TextInput
              style={[
                styles.itemQuantityInput,
                itemErrors[item.id]?.quantity ? styles.inputError : {},
              ]}
              placeholder="Qty"
              value={item.quantity ? String(item.quantity) : ''}
              onChangeText={text =>
                updateItem(item.id, 'quantity', parseFloat(text) || 0)
              }
              placeholderTextColor="#666666"
              keyboardType="numeric"
              onFocus={() => {
                console.log('🔍 Item quantity input focused, centering...');
                // Close any open dropdowns when Item quantity field gets focus
                setShowPaymentMethodModal(false);
                setShowGstModal(false);
                setFocusedItemId(null);
                scrollToInputCenter(amountRef);
              }}
            />
            {itemErrors[item.id]?.quantity ? (
              <Text style={styles.errorText}>
                {itemErrors[item.id]?.quantity}
              </Text>
            ) : null}
          </View>
          <View style={styles.itemDetailColumn}>
            <Text style={styles.itemFieldLabel}>Rate</Text>
            <TextInput
              style={[
                styles.itemQuantityInput,
                itemErrors[item.id]?.rate ? styles.inputError : {},
              ]}
              placeholder="Rate"
              value={item.rate ? String(item.rate) : ''}
              onChangeText={text =>
                updateItem(item.id, 'rate', parseFloat(text) || 0)
              }
              placeholderTextColor="#666666"
              keyboardType="numeric"
              onFocus={() => {
                console.log('🔍 Item rate input focused, centering...');
                // Close any open dropdowns when Item rate field gets focus
                setShowPaymentMethodModal(false);
                setShowGstModal(false);
                setFocusedItemId(null);
                scrollToInputCenter(amountRef);
              }}
            />
            {itemErrors[item.id]?.rate ? (
              <Text style={styles.errorText}>{itemErrors[item.id]?.rate}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.itemAmountDisplay}>
          <Text style={styles.itemAmountText}>
            ₹{(item.amount || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          getSolidHeaderStyle(preciseStatusBarHeight || statusBarSpacer.height),
        ]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <TouchableOpacity
          onPress={() => {
            console.log(
              '🔄 AddNewEntryScreen: Back button pressed, navigating to CustomerDetailScreen with refresh',
            );
            navigation.navigate('CustomerDetail', {
              customer: customer,
              partyType: partyType,
              refresh: true,
            });
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editingItem
            ? `Edit ${getEntryTypeText()}`
            : `Add New ${getEntryTypeText()}`}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: 80,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={100}
        enableAutomaticScroll={true}
        enableResetScrollToCoords={false}
        keyboardOpeningTime={0}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        bounces={true}
        scrollEventThrottle={16}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            // Close any open dropdowns when user touches blank space
            setShowPaymentMethodModal(false);
            setShowGstModal(false);
            setFocusedItemId(null);
          }}
        >
          <View>
            {false && (
              <View style={styles.debugPanel}>
                <View style={styles.debugHeaderRow}>
                  <Text style={styles.debugTitle}>Debug</Text>
                  <TouchableOpacity onPress={() => setDebugMessages([])}>
                    <Text style={styles.debugClear}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {debugMessages.slice(0, 6).map((m, idx) => (
                  <Text
                    key={`dbg-${idx}`}
                    style={styles.debugLine}
                    numberOfLines={3}
                  >
                    {m}
                  </Text>
                ))}
              </View>
            )}
            {/* Customer Info Card */}
            <View style={styles.customerCard}>
              <View style={styles.customerInfo}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {customer?.avatar ||
                      customer?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.customerDetails}>
                  <Text style={styles.customerName}>{customer?.name}</Text>
                  <Text style={styles.partyTypeText}>
                    {partyType === 'customer' ? 'Customer' : 'Supplier'}
                  </Text>
                  {isPurchaseEntry && (
                    <Text style={styles.purchaseInfo}>
                      Purchase from{' '}
                      {partyType === 'supplier' ? 'supplier' : 'vendor'}
                    </Text>
                  )}
                  {isSellEntry && (
                    <Text style={styles.sellInfo}>
                      Sell for{' '}
                      {partyType === 'customer' ? 'customer' : 'client'}
                    </Text>
                  )}
                </View>
                <View style={styles.entryTypeContainer}>
                  <View
                    style={[
                      styles.entryTypeBadge,
                      { backgroundColor: getEntryTypeColor() },
                    ]}
                  >
                    <Text style={styles.entryTypeText}>
                      {getEntryTypeText()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Date Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Date <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#666"
                />
                <Text style={styles.dateText}>{formatDate(date)}</Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {/* Amount Field - Only for simple entries */}
            {isSimpleEntry && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Amount <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View
                  style={[
                    styles.amountInputWrapper,
                    errors.amount ? styles.inputError : {},
                  ]}
                >
                  <View style={styles.amountPrefix}>
                    <Text style={styles.amountPrefixText}>₹</Text>
                  </View>
                  <TextInput
                    ref={amountRef}
                    style={[
                      styles.amountInput,
                      errors.amount ? styles.inputError : {},
                    ]}
                    placeholder="Enter amount"
                    value={amount}
                    onChangeText={handleAmountChange}
                    placeholderTextColor="#666666"
                    keyboardType="numeric"
                    onFocus={() => {
                      console.log('🔍 Amount input focused, centering...');
                      // Close any open dropdowns when Amount field gets focus
                      setShowPaymentMethodModal(false);
                      setShowGstModal(false);
                      setFocusedItemId(null);
                      scrollToInputCenter(amountRef);
                    }}
                  />
                </View>
                {errors.amount ? (
                  <Text style={styles.errorText}>{errors.amount}</Text>
                ) : null}
              </View>
            )}

            {/* Payment Method Field - Only for simple entries */}
            {isSimpleEntry && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Payment Method <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pickerInput,
                    errors.paymentMethod ? styles.inputError : {},
                  ]}
                  onPress={() => setShowPaymentMethodModal(true)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      !paymentMethod ? styles.placeholderText : {},
                    ]}
                  >
                    {paymentMethod || 'Select payment method'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
                {errors.paymentMethod ? (
                  <Text style={styles.errorText}>{errors.paymentMethod}</Text>
                ) : null}
              </View>
            )}

            {/* Description Field - Only for simple entries */}
            {isSimpleEntry && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Description <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  ref={descriptionRef}
                  style={[
                    styles.textInput,
                    errors.description ? styles.inputError : {},
                  ]}
                  placeholder="Enter description"
                  value={description}
                  onChangeText={handleDescriptionChange}
                  placeholderTextColor="#666666"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  onFocus={() => {
                    console.log('🔍 Description input focused, centering...');
                    // Close any open dropdowns when Description field gets focus
                    setShowPaymentMethodModal(false);
                    setShowGstModal(false);
                    setFocusedItemId(null);
                    scrollToInputCenter(descriptionRef);
                  }}
                />
                {errors.description ? (
                  <Text style={styles.errorText}>{errors.description}</Text>
                ) : null}
              </View>
            )}

            {/* Items Section for Invoice/Purchase */}
            {(isPurchaseEntry || isSellEntry) && (
              <View style={styles.itemsSection}>
                <View style={styles.itemsHeader}>
                  <Text style={styles.itemsTitle}>Items</Text>
                  <TouchableOpacity
                    style={styles.addItemButton}
                    onPress={addNewItem}
                  >
                    <MaterialCommunityIcons
                      name="plus"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {items.map((item, index) => renderItemRow(item, index))}

                {errors.items ? (
                  <Text style={styles.errorText}>{errors.items}</Text>
                ) : null}
              </View>
            )}

            {/* GST Section for Invoice/Purchase */}
            {(isPurchaseEntry || isSellEntry) && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  GST Percentage <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.pickerInput}
                  onPress={() => setShowGstModal(true)}
                >
                  <Text
                    style={[
                      styles.pickerText,
                      gstPercentage === undefined ? styles.placeholderText : {},
                    ]}
                  >
                    {gstPercentage !== undefined
                      ? `${gstPercentage}% GST`
                      : 'Select GST percentage'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Tax and Discount Amount Section for Invoice/Purchase */}
            {(isPurchaseEntry || isSellEntry) && (
              <View style={styles.taxDiscountSection}>
                <View style={styles.taxDiscountHeader}>
                  <MaterialCommunityIcons
                    name="calculator"
                    size={20}
                    color="#4f8cff"
                  />
                  <Text style={styles.taxDiscountTitle}>Amount Details</Text>
                </View>
                <View style={styles.taxDiscountContent}>
                  <View style={styles.taxDiscountRow}>
                    <View style={styles.taxDiscountColumn}>
                      <Text style={styles.inputLabel}>Tax Amount</Text>
                      <TextInput
                        ref={taxAmountRef}
                        style={styles.textInput}
                        placeholder="0.00"
                        value={taxAmount ? String(taxAmount) : ''}
                        onChangeText={text => {
                          const value = parseFloat(text) || 0;
                          setTaxAmount(value);
                        }}
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                        onFocus={() => {
                          console.log(
                            '🔍 Tax amount input focused, centering...',
                          );
                          // Close any open dropdowns when Tax amount field gets focus
                          setShowPaymentMethodModal(false);
                          setShowGstModal(false);
                          setFocusedItemId(null);
                          scrollToInputCenter(taxAmountRef);
                        }}
                      />
                    </View>
                    <View style={styles.taxDiscountColumn}>
                      <Text style={styles.inputLabel}>Discount Amount</Text>
                      <TextInput
                        ref={discountAmountRef}
                        style={styles.textInput}
                        placeholder="0.00"
                        value={discountAmount ? String(discountAmount) : ''}
                        onChangeText={text => {
                          const value = parseFloat(text) || 0;
                          setDiscountAmount(value);
                        }}
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                        onFocus={() => {
                          console.log(
                            '🔍 Discount amount input focused, centering...',
                          );
                          // Close any open dropdowns when Discount amount field gets focus
                          setShowPaymentMethodModal(false);
                          setShowGstModal(false);
                          setFocusedItemId(null);
                          scrollToInputCenter(discountAmountRef);
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Totals Section for Invoice/Purchase */}
            {(isPurchaseEntry || isSellEntry) && (
              <View style={styles.totalsSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal:</Text>
                  <Text style={styles.totalAmount}>
                    ₹{(subtotal || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST:</Text>
                  <Text style={styles.totalAmount}>{gstPercentage}%</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax Amount:</Text>
                  <Text style={styles.totalAmount}>
                    ₹{(taxAmount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount:</Text>
                  <Text style={styles.totalAmount}>
                    -₹{(discountAmount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.totalRow, styles.finalTotalRow]}>
                  <Text style={styles.finalTotalLabel}>Total:</Text>
                  <Text style={styles.finalTotalAmount}>
                    ₹{(total || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Notes Field */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                ref={notesRef}
                style={styles.textInput}
                placeholder="Enter notes"
                value={notes}
                onChangeText={handleNotesChange}
                placeholderTextColor="#666666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => {
                  console.log('🔍 Notes input focused, centering...');
                  // Close any open dropdowns when Notes field gets focus
                  setShowPaymentMethodModal(false);
                  setShowGstModal(false);
                  setFocusedItemId(null);
                  scrollToInputCenter(notesRef);
                }}
              />
            </View>

            {/* Attach Document */}
            <AttachDocument
              attachedDocument={attachedDocument}
              onDocumentAttached={setAttachedDocument}
              onDocumentRemoved={() => setAttachedDocument(null)}
              label="Attach Document (Optional)"
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAwareScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {editingItem ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.updateButtonEdit,
                loading ? styles.buttonDisabled : {},
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>UPDATE ENTRY</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButtonEdit}
              onPress={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="delete"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.deleteButtonText}>DELETE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.submitButton,
              styles.submitButtonFullWidth,
              loading ? styles.buttonDisabled : {},
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>ADD ENTRY</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Date Picker Modal */}
      {showDatePicker ? (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      ) : null}

      {/* Custom Alert Modal */}
      {customAlert.visible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            <View
              style={[
                styles.alertIconContainer,
                {
                  backgroundColor:
                    customAlert.type === 'success'
                      ? '#e8f5e8'
                      : customAlert.type === 'error'
                      ? '#fdeaea'
                      : customAlert.type === 'warning'
                      ? '#fff8e1'
                      : customAlert.type === 'confirm'
                      ? '#e1f5fe'
                      : '#f0f6ff',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  customAlert.type === 'success'
                    ? 'check-circle'
                    : customAlert.type === 'error'
                    ? 'close-circle'
                    : customAlert.type === 'warning'
                    ? 'alert-circle'
                    : customAlert.type === 'confirm'
                    ? 'help-circle'
                    : 'information'
                }
                size={50}
                color={
                  customAlert.type === 'success'
                    ? '#28a745'
                    : customAlert.type === 'error'
                    ? '#dc3545'
                    : customAlert.type === 'warning'
                    ? '#ff9800'
                    : customAlert.type === 'confirm'
                    ? '#2196f3'
                    : '#4f8cff'
                }
              />
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <View style={styles.alertButtons}>
              {customAlert.type === 'confirm' && (
                <TouchableOpacity
                  style={styles.alertButtonCancel}
                  onPress={() => {
                    customAlert.onCancel?.();
                    hideCustomAlert();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.alertButtonCancelText}>
                    {customAlert.cancelText}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.alertButtonConfirm,
                  {
                    backgroundColor:
                      customAlert.type === 'success'
                        ? '#28a745'
                        : customAlert.type === 'error'
                        ? '#dc3545'
                        : customAlert.type === 'warning'
                        ? '#ff9800'
                        : customAlert.type === 'confirm'
                        ? '#2196f3'
                        : '#4f8cff',
                  },
                ]}
                onPress={() => {
                  customAlert.onConfirm?.();
                  hideCustomAlert();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.alertButtonConfirmText}>
                  {customAlert.confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Payment Method Filter Modal */}
      {showPaymentMethodModal && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowPaymentMethodModal(false)}
          />
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: '80%',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            {/* Modal Handle */}
            <View style={styles.paymentMethodModalHandle} />

            {/* Header */}
            <View style={styles.paymentMethodModalHeader}>
              <TouchableOpacity
                onPress={() => setShowPaymentMethodModal(false)}
                style={styles.paymentMethodModalCloseButton}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
              <View style={styles.paymentMethodModalTitleContainer}>
                <Text style={styles.paymentMethodModalTitle}>
                  Select Payment Method
                </Text>
                <Text style={styles.paymentMethodModalSubtitle}>
                  Choose your preferred payment method
                </Text>
              </View>
              <View style={{ width: 22 }} />
            </View>

            {/* Payment Method Options */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                ...styles.paymentMethodModalContent,
                flexGrow: 1,
                paddingBottom: 20,
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
              scrollEnabled={true}
            >
              {paymentMethods.map((method, index) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === method.value &&
                      styles.paymentMethodOptionSelected,
                    index === paymentMethods.length - 1 &&
                      styles.paymentMethodOptionLast,
                  ]}
                  onPress={() => {
                    setPaymentMethod(method.value);
                    clearFieldError('paymentMethod');
                    setShowPaymentMethodModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.paymentMethodOptionContent}>
                    <View style={styles.paymentMethodOptionLeft}>
                      <View
                        style={[
                          styles.paymentMethodIcon,
                          paymentMethod === method.value &&
                            styles.paymentMethodIconSelected,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            method.value === 'Cash'
                              ? 'cash'
                              : method.value === 'Bank Transfer'
                              ? 'bank-transfer'
                              : method.value === 'UPI'
                              ? 'cellphone'
                              : method.value === 'Cheque'
                              ? 'checkbook'
                              : method.value === 'Credit Card'
                              ? 'credit-card'
                              : method.value === 'Debit Card'
                              ? 'credit-card-outline'
                              : 'wallet'
                          }
                          size={22}
                          color={
                            paymentMethod === method.value ? '#fff' : '#4f8cff'
                          }
                        />
                      </View>
                      <View style={styles.paymentMethodTextContainer}>
                        <Text
                          style={[
                            styles.paymentMethodOptionText,
                            paymentMethod === method.value &&
                              styles.paymentMethodOptionTextSelected,
                          ]}
                        >
                          {method.label}
                        </Text>
                        <Text style={styles.paymentMethodDescription}>
                          {method.value === 'Cash'
                            ? 'Physical cash payment'
                            : method.value === 'Bank Transfer'
                            ? 'Direct bank transfer'
                            : method.value === 'UPI'
                            ? 'UPI payment method'
                            : method.value === 'Cheque'
                            ? 'Cheque payment'
                            : method.value === 'Credit Card'
                            ? 'Credit card payment'
                            : method.value === 'Debit Card'
                            ? 'Debit card payment'
                            : 'Other payment method'}
                        </Text>
                      </View>
                    </View>
                    {paymentMethod === method.value && (
                      <View style={styles.paymentMethodCheckContainer}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color="#4f8cff"
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* GST Percentage Filter Modal */}
      {showGstModal && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowGstModal(false)}
          />
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: '80%',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
          >
            {/* Modal Handle */}
            <View style={styles.gstModalHandle} />

            {/* Header */}
            <View style={styles.gstModalHeader}>
              <TouchableOpacity
                onPress={() => setShowGstModal(false)}
                style={styles.gstModalCloseButton}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
              <View style={styles.gstModalTitleContainer}>
                <Text style={styles.gstModalTitle}>Select GST Percentage</Text>
                <Text style={styles.gstModalSubtitle}>
                  Choose the applicable GST rate
                </Text>
              </View>
              <View style={{ width: 22 }} />
            </View>

            {/* GST Percentage Options */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                ...styles.gstModalContent,
                flexGrow: 1,
                paddingBottom: 20,
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
              scrollEnabled={true}
            >
              {gstPercentages.map((percentage, index) => (
                <TouchableOpacity
                  key={percentage}
                  style={[
                    styles.gstOption,
                    gstPercentage === percentage && styles.gstOptionSelected,
                    index === gstPercentages.length - 1 && styles.gstOptionLast,
                  ]}
                  onPress={() => {
                    console.log('🔍 Setting GST percentage to:', percentage);
                    setGstPercentage(percentage);
                    setShowGstModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.gstOptionContent}>
                    <View style={styles.gstOptionLeft}>
                      <View
                        style={[
                          styles.gstIcon,
                          gstPercentage === percentage &&
                            styles.gstIconSelected,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="percent"
                          size={22}
                          color={
                            gstPercentage === percentage ? '#fff' : '#4f8cff'
                          }
                        />
                      </View>
                      <View style={styles.gstTextContainer}>
                        <Text
                          style={[
                            styles.gstOptionText,
                            gstPercentage === percentage &&
                              styles.gstOptionTextSelected,
                          ]}
                        >
                          {percentage}% GST
                        </Text>
                        <Text style={styles.gstDescription}>
                          {percentage === 0
                            ? 'No GST applicable'
                            : percentage === 5
                            ? 'Reduced GST rate'
                            : percentage === 12
                            ? 'Standard GST rate'
                            : percentage === 18
                            ? 'Standard GST rate'
                            : 'Higher GST rate'}
                        </Text>
                      </View>
                    </View>
                    {gstPercentage === percentage && (
                      <View style={styles.gstCheckContainer}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color="#4f8cff"
                        />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: uiColors.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 30,
  },
  headerTitle: {
    color: uiColors.textHeader,
    fontSize: 19,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    fontFamily: uiFonts.family,
  },

  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16, // Add bottom padding
  },
  infoText: {
    fontSize: 12,
    color: '#333333',
    lineHeight: 18,

    fontFamily: 'Roboto-Medium',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorDisplayText: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  retryButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: uiColors.textHeader,
    fontSize: 12,
    fontFamily: uiFonts.family,
  },

  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  partyTypeText: {
    fontSize: 12,
    color: '#64748b',

    fontFamily: 'Roboto-Medium',
  },

  purchaseInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,

    fontFamily: 'Roboto-Medium',
  },

  sellInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,

    fontFamily: 'Roboto-Medium',
  },

  entryTypeContainer: {
    marginLeft: 8,
  },
  entryTypeBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTypeText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  inputContainer: {
    marginBottom: 16,
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#e2e8f0',

    fontFamily: 'Roboto-Medium',
  },

  inputError: {
    borderColor: '#dc3545',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
    lineHeight: 12,

    fontFamily: 'Roboto-Medium',
  },

  requiredStar: {
    color: '#dc3545',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7.5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  amountPrefix: {
    marginRight: 6,
  },
  amountPrefixText: {
    fontSize: 20,
    color: '#333333',
    paddingHorizontal: 2,

    fontFamily: 'Roboto-Medium',
  },

  amountInput: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    paddingVertical: 0,

    fontFamily: 'Roboto-Medium',
  },

  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerText: {
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  placeholderText: {
    fontSize: 14,
    color: '#666666',

    fontFamily: 'Roboto-Medium',
  },
  itemsSection: {
    backgroundColor: '#fff',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemsTitle: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 7.5,
    paddingHorizontal: 12,
    borderRadius: 18.75,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  addItemText: {
    marginLeft: 6,
    fontSize: 14,
    color: uiColors.textHeader,
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  itemRow: {
    marginBottom: 20,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
    marginHorizontal: 0,
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemIndexContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  itemIndex: {
    fontSize: 12,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  removeItemButton: {
    padding: 6,
    borderRadius: 15,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  itemContent: {
    flex: 1,
  },
  itemDescriptionContainer: {
    marginBottom: 12,
  },
  itemFieldLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
    letterSpacing: 0.1,
    fontFamily: uiFonts.family,
  },

  itemDescriptionInput: {
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'center',
    minHeight: 40,

    fontFamily: 'Roboto-Medium',
  },

  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemDetailColumn: {
    flex: 1,
    marginBottom: 4,
  },
  itemQuantityInput: {
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    minHeight: 40,

    fontFamily: 'Roboto-Medium',
  },

  itemAmountDisplay: {
    backgroundColor: '#f0f6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#4f8cff',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemAmountText: {
    fontSize: 14,
    color: uiColors.primaryBlue,
    fontFamily: uiFonts.family,
  },

  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 9,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 15,
    color: '#666666',

    fontFamily: 'Roboto-Medium',
  },

  totalAmount: {
    fontSize: 16,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  finalTotalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#f0f0f0',
  },
  finalTotalLabel: {
    fontSize: 17,
    color: '#333333',
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  finalTotalAmount: {
    fontSize: 20,
    color: '#4f8cff',
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  debugPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  debugHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  debugTitle: {
    fontSize: 12,
    color: '#666666',

    fontFamily: 'Roboto-Medium',
  },

  debugClear: {
    fontSize: 11,
    color: '#dc2626',

    fontFamily: 'Roboto-Medium',
  },

  debugLine: {
    fontSize: 10,
    color: '#334155',
    marginBottom: 3,

    fontFamily: 'Roboto-Medium',
  },

  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
  },
  submitButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonFullWidth: {
    width: '100%',
    alignSelf: 'center',
    flex: 0,
    borderRadius: 8,
    marginLeft: 0,
    marginRight: 0,
  },
  updateButtonEdit: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    fontWeight: '700',
  },
  deleteButtonEdit: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    fontWeight: '700',
  },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 7.5,
    width: '80%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 15,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  pickerList: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    marginTop: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    marginLeft: 6,

    fontFamily: 'Roboto-Medium',
  },

  gstSection: {
    backgroundColor: '#fff',
    borderRadius: 9,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  gstHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  gstTitle: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 6,

    fontFamily: 'Roboto-Medium',
  },

  gstContent: {
    marginBottom: 12,
  },
  gstPickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 7.5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  gstPickerText: {
    fontSize: 14,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  taxDiscountSection: {
    backgroundColor: '#fff',
    borderRadius: 9,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  taxDiscountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  taxDiscountTitle: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 6,

    fontFamily: 'Roboto-Medium',
  },

  taxDiscountContent: {
    marginBottom: 12,
  },
  taxDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  taxDiscountColumn: {
    flex: 1,
  },

  // DropDownPicker styles
  dropdownPicker: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 6,
    minHeight: 36,
  },
  dropdownPickerList: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 20,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 0,
  },
  alertIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    fontFamily: 'Roboto-Medium',
  },

  alertMessage: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
    fontFamily: 'Roboto-Medium',
  },

  alertButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  alertButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  alertButtonConfirm: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  alertButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },

  alertButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },

  // Payment Method Modal Styles
  paymentMethodModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 15,
  },
  paymentMethodModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  paymentMethodModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  paymentMethodModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  paymentMethodModalTitle: {
    fontSize: 20,
    color: '#333333',
    marginBottom: 4,
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  paymentMethodModalSubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  paymentMethodModalContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  paymentMethodOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#fafbfc',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  paymentMethodOptionSelected: {
    backgroundColor: '#f0f6ff',
    borderColor: '#4f8cff',
    borderWidth: 2,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentMethodOptionLast: {
    marginBottom: 0,
  },
  paymentMethodOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentMethodOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodIconSelected: {
    backgroundColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  paymentMethodTextContainer: {
    flex: 1,
  },
  paymentMethodOptionText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  paymentMethodOptionTextSelected: {
    color: '#4f8cff',

    fontFamily: 'Roboto-Medium',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#666666',

    fontFamily: 'Roboto-Medium',
  },

  paymentMethodCheckContainer: {
    marginLeft: 12,
  },

  // GST Modal Styles
  gstModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 15,
  },
  gstModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  gstModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  gstModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gstModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  gstModalTitle: {
    fontSize: 20,
    color: '#333333',
    marginBottom: 4,
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  gstModalSubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  gstModalContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  gstOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#fafbfc',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  gstOptionSelected: {
    backgroundColor: '#f0f6ff',
    borderColor: '#4f8cff',
    borderWidth: 2,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  gstOptionLast: {
    marginBottom: 0,
  },
  gstOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gstIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gstIconSelected: {
    backgroundColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  gstTextContainer: {
    flex: 1,
  },
  gstOptionText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  gstOptionTextSelected: {
    color: '#4f8cff',

    fontFamily: 'Roboto-Medium',
  },
  gstDescription: {
    fontSize: 12,
    color: '#666666',

    fontFamily: 'Roboto-Medium',
  },

  gstCheckContainer: {
    marginLeft: 12,
  },
});

export default AddNewEntryScreen;
