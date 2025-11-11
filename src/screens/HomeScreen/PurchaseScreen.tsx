import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  PermissionsAndroid,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';

import { RootStackParamList } from '../../types/navigation';
// Removed SafeAreaView to allow full control over StatusBar area
import DateTimePicker from '@react-native-community/datetimepicker';
import { getUserIdFromToken } from '../../utils/storage';
import Modal from 'react-native-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
import { updateSupplier, Supplier } from '../../api/suppliers';
import SupplierSelector from '../../components/SupplierSelector';
import { useSupplierContext } from '../../context/SupplierContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import StableStatusBar from '../../components/StableStatusBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uiColors, uiFonts } from '../../config/uiSizing';
import { getStatusBarSpacerHeight } from '../../utils/statusBarManager';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import { useAlert } from '../../context/AlertContext';
import SearchAndFilter from '../../components/SearchAndFilter';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { launchImageLibrary } from 'react-native-image-picker';
import { upsertItemNames } from '../../api/items';
import ItemNameSuggestions from '../../components/ItemNameSuggestions';

// Add missing interfaces
interface PaymentSearchFilterState {
  searchText: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  status?: string;
  reference?: string;
  description?: string;
}

// Use the interface from SearchAndFilter component
import type { RecentSearch } from '../../components/SearchAndFilter';

interface ParsedPurchaseData {
  purchaseNumber: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  purchaseDate: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  notes: string;
}

function parsePurchaseOcrText(text: string): ParsedPurchaseData {
  return {
    purchaseNumber: '',
    supplierName: '',
    supplierPhone: '',
    supplierAddress: '',
    purchaseDate: '',
    items: [],
    notes: '',
  };
}

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

const GST_OPTIONS = [0, 5, 12, 18, 28];

interface FolderProp {
  folder?: { id?: number; title?: string; icon?: string };
}

const PurchaseScreen: React.FC<FolderProp> = ({ folder }) => {
  const folderName = folder?.title || 'Purchase';

  // Debug logging for folder name
  console.log('🔍 PurchaseScreen: folder prop received:', folder);
  console.log('🔍 PurchaseScreen: folderName calculated:', folderName);

  // Helper functions for date handling without timezone conversion
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateLocal = (dateString: string): Date => {
    if (!dateString || dateString.trim() === '') {
      return new Date();
    }
    // Parse YYYY-MM-DD format directly to avoid timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showAlert } = useAlert();
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Track when we are fetching data for editing an existing purchase
  const [isFetchingEdit, setIsFetchingEdit] = useState(false);

  // Mock data for past purchases
  const pastPurchases: Purchase[] = [
    {
      id: '1',
      purchaseNumber: 'PUR-001',
      supplierName: 'Supplier A',
      date: '2024-01-10',
      amount: 12000,
      status: 'Paid',
    },
    {
      id: '2',
      purchaseNumber: 'PUR-002',
      supplierName: 'Supplier B',
      date: '2024-01-18',
      amount: 22000,
      status: 'Pending',
    },
    {
      id: '3',
      purchaseNumber: 'PUR-003',
      supplierName: 'Supplier C',
      date: '2024-01-22',
      amount: 9000,
      status: 'Overdue',
    },
  ];

  // States for purchase creation form
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ]);
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGstModal, setShowGstModal] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  // Track the selected supplier to mirror PaymentScreen behavior
  const [selectedSupplier, setSelectedSupplier] = useState<{
    id?: number;
    name?: string;
    partyName?: string;
    phoneNumber?: string;
    address?: string;
  } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isSupplierFocused, setIsSupplierFocused] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [gstPct, setGstPct] = useState(18);
  const [taxAmount, setTaxAmount] = useState(0); // Tax amount field
  const [discountAmount, setDiscountAmount] = useState(0); // Discount amount field
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [gstDropdownOpen, setGstDropdownOpen] = useState(false);
  const [gstDropdownLayout, setGstDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const gstFieldRef = useRef<View>(null);
  const [syncYN, setSyncYN] = useState('N');
  const [apiPurchases, setApiPurchases] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key to force re-renders
  const [forceUpdate, setForceUpdate] = useState(0); // Additional force update state
  const [loadingApi, setLoadingApi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Add missing state variables for UploadDocument and filters
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [isRecording, setIsRecording] = useState(false);
  const [itemsSectionRef] = useState(useRef<View>(null));
  const [lastGstPctByVoice, setLastGstPctByVoice] = useState<number | null>(
    null,
  );
  const [lastPurchaseDateByVoice, setLastPurchaseDateByVoice] = useState<
    string | null
  >(null);
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const [nlpStatus, setNlpStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>(
    'info',
  );
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState<PaymentSearchFilterState>({
    searchText: '',
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [filterBadgeCount, setFilterBadgeCount] = useState(0);
  const [filterVisible, setFilterVisible] = useState(false);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);

  // Helper for pluralizing folder name
  const pluralize = (name: string | undefined) => {
    if (!name) return 'items';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };

  // Core functions
  const deletePurchase = async (id: string) => {
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      // Use unified API for delete
      const numericId = typeof id === 'string' ? Number(id) : id;
      await unifiedApi.deleteTransaction(numericId);
      await fetchPurchases();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete purchase.');
      setShowModal(true);
    }
  };

  const fetchPurchasesFn = async (page = 1) => {
    console.log('🔄 fetchPurchases called');
    setLoadingApi(true);
    setApiError(null);
    try {
      // Parallel API calls with caching - optimized!
      const [suppliersResponse, transactionsResponse] = await Promise.all([
        unifiedApi.getSuppliers(),
        unifiedApi.getPurchases(page, 20), // Paginated for better performance
      ]);

      // Normalize suppliers response
      const suppliersData =
        (suppliersResponse as any)?.data || suppliersResponse || [];
      const currentSuppliersAny: any[] = Array.isArray(suppliersData)
        ? suppliersData
        : [];

      console.log('📊 Suppliers data:', {
        totalSuppliers: currentSuppliersAny.length,
        sampleSupplier: currentSuppliersAny[0] || 'No suppliers',
        supplierFields: currentSuppliersAny[0]
          ? Object.keys(currentSuppliersAny[0])
          : [],
      });

      // Normalize transactions response
      const transactionsData =
        (transactionsResponse as any)?.data || transactionsResponse || [];
      const vouchers = Array.isArray(transactionsData) ? transactionsData : [];

      // Helper: normalize items shapes (flatten nested single array like [ [] ])
      const flattenItems = (val: any): any[] => {
        if (Array.isArray(val) && val.length === 1 && Array.isArray(val[0])) {
          return val[0];
        }
        return Array.isArray(val) ? val : [];
      };
      // Verbose log: raw vouchers snapshot with GST and Items presence
      try {
        console.log('🧾 PURCHASE_LIST_API_RESPONSE', {
          count: vouchers.length,
          ids: vouchers.map((v: any) => v.id).slice(0, 50),
          sample: vouchers.slice(0, 3).map((v: any) => ({
            id: v.id,
            type: v.type,
            partyName: v.partyName,
            gstKeys: {
              gstPct: (v as any).gstPct,
              gst_pct: (v as any).gst_pct,
              gst: (v as any).gst,
              cGST: (v as any).cGST,
              subTotal: (v as any).subTotal,
              totalAmount: (v as any).totalAmount,
            },
            itemsInfo: {
              itemsType: Array.isArray(v.items) ? 'array' : typeof v.items,
              itemsLen: Array.isArray(v.items) ? v.items.length : 0,
              transactionItemsLen: Array.isArray((v as any).transactionItems)
                ? (v as any).transactionItems.length
                : 0,
              voucherItemsLen: Array.isArray((v as any).voucherItems)
                ? (v as any).voucherItems.length
                : 0,
            },
          })),
        });
      } catch {}

      // Debug: Check voucher types before filtering
      console.log('🔍 Voucher types found:', {
        folderName: 'purchase',
        allVoucherTypes: [...new Set(vouchers.map((v: any) => v.type))],
        vouchersBeforeFilter: vouchers.length,
      });

      // Merge supplier data with vouchers; purchase maps to 'debit' transactions
      const enrichedPurchases = await Promise.all(
        vouchers
          .filter((v: any) => {
            const isDebit = String(v.type).toLowerCase() === 'debit';
            const itemsLen = Array.isArray(v.items)
              ? v.items.length
              : Array.isArray((v as any).transactionItems)
              ? (v as any).transactionItems.length
              : Array.isArray((v as any).voucherItems)
              ? (v as any).voucherItems.length
              : 0;
            const hasLineItems = itemsLen > 0; // distinguish from payments
            // Do not filter by method; purchases are debit with line items
            const matches = isDebit && hasLineItems;
            if (!matches) {
              console.log('❌ Voucher filtered out:', {
                id: v.id,
                type: v.type,
                expectedType: 'debit+items',
                partyName: v.partyName,
              });
            }
            return matches;
          })
          .map(async (voucher: any) => {
            console.log('🔍 Processing voucher:', {
              id: voucher.id,
              partyName: voucher.partyName,
              partyId: voucher.partyId,
              type: voucher.type,
            });

            // Find matching customer/supplier using multiple strategies
            let party = null;
            if (voucher.partyName) {
              party = currentSuppliersAny.find(
                (s: any) =>
                  s.name?.toLowerCase() === voucher.partyName?.toLowerCase(),
              );
              if (party)
                console.log('✅ Matched by exact partyName:', party.name);
            }
            if (!party && voucher.partyName) {
              party = currentSuppliersAny.find((s: any) => {
                const sName = s.name?.toLowerCase() || '';
                const vName = voucher.partyName?.toLowerCase() || '';
                return sName.includes(vName) || vName.includes(sName);
              });
              if (party)
                console.log('✅ Matched by partial partyName:', party.name);
            }
            if (!party && voucher.partyId) {
              party = currentSuppliersAny.find(
                (s: any) => s.id === voucher.partyId,
              );
              if (party) console.log('✅ Matched by partyId:', party.name);
            }
            if (!party) {
              console.log('❌ No supplier match found for voucher:', {
                voucherId: voucher.id,
                voucherPartyName: voucher.partyName,
                availableSuppliers: currentSuppliersAny.map((s: any) => ({
                  id: s.id,
                  name: s.name,
                })),
              });
            }

            const phoneFallback =
              (party as any)?.phoneNumber ||
              voucher.partyPhone ||
              voucher.phone ||
              voucher.phoneNumber ||
              '';
            const addressFallback =
              (party as any)?.address ||
              voucher.partyAddress ||
              voucher.address ||
              voucher.addressLine1 ||
              '';

            // Determine GST first (so cache can fill only if missing)
            let gstFallbackRaw: any =
              (voucher as any).gstPct ??
              (voucher as any).gst_pct ??
              (voucher as any).gst ??
              (voucher as any).taxPct ??
              undefined;
            let gstFallback: number | undefined =
              typeof gstFallbackRaw === 'string'
                ? Number(gstFallbackRaw)
                : typeof gstFallbackRaw === 'number'
                ? gstFallbackRaw
                : undefined;
            // If still undefined, try deriving from cGST/subTotal
            if (
              gstFallback === undefined &&
              (voucher as any).cGST != null &&
              (voucher as any).subTotal != null &&
              Number((voucher as any).subTotal) > 0
            ) {
              const cg = Number((voucher as any).cGST) || 0;
              const st = Number((voucher as any).subTotal) || 0;
              const pct = Math.round((cg / st) * 100 * 100) / 100;
              if (isFinite(pct)) gstFallback = pct;
            }

            let mergedItems = Array.isArray(voucher.items)
              ? flattenItems(voucher.items)
              : typeof (voucher as any).items === 'string'
              ? (() => {
                  try {
                    const parsed = JSON.parse((voucher as any).items);
                    return flattenItems(parsed);
                  } catch {
                    return [];
                  }
                })()
              : Array.isArray((voucher as any).transactionItems)
              ? flattenItems((voucher as any).transactionItems)
              : Array.isArray((voucher as any).voucherItems)
              ? flattenItems((voucher as any).voucherItems)
              : [];

            // If backend omits items/GST, try local cache
            if (
              !mergedItems ||
              mergedItems.length === 0 ||
              gstFallback === undefined
            ) {
              try {
                const cacheKey = `voucherItemsCache:${voucher.id}`;
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                  const parsed = JSON.parse(cached);
                  if (
                    (!mergedItems || mergedItems.length === 0) &&
                    Array.isArray(parsed?.items)
                  ) {
                    mergedItems = parsed.items;
                  }
                  if (
                    gstFallback === undefined &&
                    typeof parsed?.gstPct === 'number'
                  ) {
                    gstFallback = parsed.gstPct;
                  }
                }
              } catch {}
            }

            // If still no items but have amounts, synthesize one display item
            if (
              (!mergedItems || mergedItems.length === 0) &&
              ((voucher as any).subTotal != null ||
                (voucher as any).totalAmount != null)
            ) {
              const st = Number((voucher as any).subTotal) || 0;
              const ta = Number((voucher as any).totalAmount) || 0;
              const g = typeof gstFallback === 'number' ? gstFallback : 0;
              const base = st > 0 ? st : ta > 0 ? ta / (1 + g / 100) : 0;
              const amount = base * (1 + g / 100);
              mergedItems = [
                {
                  id: '1',
                  name:
                    (voucher as any).description ||
                    (voucher as any).partyName ||
                    'Item 1',
                  description:
                    (voucher as any).description ||
                    (voucher as any).partyName ||
                    'Item 1',
                  quantity: 1,
                  rate: base,
                  amount: amount,
                },
              ];
            }

            return {
              ...voucher,
              partyName: party?.name || voucher.partyName || 'Unknown Party',
              partyPhone: phoneFallback,
              partyAddress: addressFallback,
              partyType: 'supplier',
              items: mergedItems,
              gstPct: typeof gstFallback === 'number' ? gstFallback : undefined,
              _debug: {
                matched: !!party,
                matchedPartyId: party?.id,
                matchedPartyName: (party as any)?.name,
                originalPartyName: voucher.partyName,
              },
            };
          }),
      );

      // Final pass: if any voucher still lacks items/GST (e.g., ID 1188), fetch detail by id
      const finalizedPurchases = await Promise.all(
        (enrichedPurchases as any[]).map(async v => {
          if (
            v &&
            (!Array.isArray(v.items) ||
              v.items.length === 0 ||
              v.gstPct === undefined)
          ) {
            try {
              // Use unified API with caching
              const detailRaw2 = await unifiedApi.getTransactionById(v.id);
              // Verbose log: detail API response for voucher id
              try {
                console.log(
                  '🧾 PURCHASE_DETAIL_API_RESPONSE',
                  v.id,
                  detailRaw2,
                );
              } catch {}
              const d = (detailRaw2 as any)?.data || detailRaw2 || {};
              const normalizedItems = Array.isArray(d.items)
                ? flattenItems(d.items)
                : Array.isArray(d.transactionItems)
                ? flattenItems(d.transactionItems)
                : Array.isArray(d.voucherItems)
                ? flattenItems(d.voucherItems)
                : v.items || [];
              const gstRaw =
                (d as any).gstPct ??
                (d as any).gst_pct ??
                (d as any).gst ??
                v.gstPct;
              const normalizedGst =
                typeof gstRaw === 'string'
                  ? Number(gstRaw)
                  : typeof gstRaw === 'number'
                  ? gstRaw
                  : undefined;
              return {
                ...v,
                ...d,
                items: normalizedItems,
                gstPct: normalizedGst,
              };
            } catch {}

            // Fallback to local cache
            try {
              const cached = await AsyncStorage.getItem(
                `voucherItemsCache:${v.id}`,
              );
              if (cached) {
                const parsed = JSON.parse(cached);
                const normalizedItems = Array.isArray(parsed?.items)
                  ? parsed.items
                  : v.items;
                const normalizedGst =
                  v.gstPct !== undefined
                    ? v.gstPct
                    : typeof parsed?.gstPct === 'number'
                    ? parsed.gstPct
                    : undefined;
                return { ...v, items: normalizedItems, gstPct: normalizedGst };
              }
            } catch {}
          }
          return v;
        }),
      );

      // Force a new array reference to trigger re-render
      setApiPurchases(prev => {
        console.log(
          '🔄 State update triggered with:',
          finalizedPurchases.length,
          'items',
        );
        console.log(
          '🔄 First purchase details:',
          finalizedPurchases[0]
            ? {
                id: finalizedPurchases[0].id,
                partyName: finalizedPurchases[0].partyName,
                partyPhone: finalizedPurchases[0].partyPhone,
                partyAddress: finalizedPurchases[0].partyAddress,
                amount: finalizedPurchases[0].amount,
                date: finalizedPurchases[0].date,
              }
            : 'No purchases',
        );
        return [...finalizedPurchases] as any;
      });

      // Increment refresh key to force FlatList to re-render
      setRefreshKey(prev => {
        const newKey = prev + 1;
        console.log('🔄 Refresh key updated to:', newKey);
        return newKey;
      });

      // Also trigger a force update
      setForceUpdate(prev => prev + 1);

      console.log(
        '✅ Fetched purchases with supplier data:',
        enrichedPurchases.length,
      );
      console.log(
        '✅ Updated apiPurchases state with:',
        finalizedPurchases.length,
        'items',
      );
      console.log(
        '✅ Sample purchase data:',
        finalizedPurchases[0]
          ? {
              id: finalizedPurchases[0].id,
              partyName: finalizedPurchases[0].partyName,
              partyPhone: finalizedPurchases[0].partyPhone,
              partyAddress: finalizedPurchases[0].partyAddress,
              amount: finalizedPurchases[0].amount,
              date: finalizedPurchases[0].date,
            }
          : 'No purchases',
      );
    } catch (e: any) {
      setApiError(e.message || 'Error fetching purchases');
    } finally {
      setLoadingApi(false);
    }
  };

  // Wrap in useCallback with stable dependencies
  const fetchPurchases = useCallback(() => {
    fetchPurchasesFn();
  }, []); // Empty deps - fetchPurchasesFn will always have access to latest state through closure

  useEffect(() => {
    fetchPurchases();
    const initializePurchaseNumber = async () => {
      try {
        // Preview only - don't store until transaction is saved
        const nextNumber = await generateNextDocumentNumber('purchase', false);
        setPurchaseNumber(nextNumber);
      } catch (error) {
        console.error('Error initializing purchase number:', error);
        // Generator fallback will return 'PUR-001' for new users
        setPurchaseNumber('PUR-001');
      }
    };
    initializePurchaseNumber();
  }, []);

  // Refresh data when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 PurchaseScreen: useFocusEffect triggered', {
        showCreateForm,
        editingItemId: editingItem?.id,
      });

      // Don't refresh while editing
      if (showCreateForm || editingItem) {
        console.log('🔍 PurchaseScreen: Skipping refresh - in edit mode');
        return;
      }

      console.log('🔍 PurchaseScreen: Screen focused, refreshing purchases...');

      // Small delay to ensure form has fully closed before refreshing
      setTimeout(() => {
        fetchPurchases();
      }, 100);

      return () => {
        console.log('🔍 PurchaseScreen: Screen unfocused');
      };
    }, [showCreateForm, editingItem, fetchPurchases]),
  );

  const handleEditItem = async (item: any) => {
    if (!item) {
      console.warn('handleEditItem: item is undefined or null');
      return;
    }
    console.log(
      '🔍 PurchaseScreen: handleEditItem called with item:',
      JSON.stringify(item, null, 2),
    );
    console.log('🔍 PurchaseScreen: Item partyName from list:', item.partyName);
    console.log(
      '🔍 PurchaseScreen: Item partyAddress from list:',
      item.partyAddress,
    );
    setShowModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);

    // DO NOT set editingItem yet - wait for API data to avoid flicker
    // Show form in loading state first and mark fetching
    setIsFetchingEdit(true);
    setShowCreateForm(true);
    setEditingItem(null);

    // Fetch full transaction details to ensure items/phone/address are complete
    // Always fetch from API to get the absolute latest data
    try {
      // Use unified API - disable cache to get fresh data
      const detailRaw = await unifiedApi.getTransactionById(item.id);
      if (detailRaw) {
        const detail = (detailRaw as any)?.data || detailRaw || {};
        console.log(
          '🔍 PurchaseScreen: Fetched transaction detail:',
          JSON.stringify(detail, null, 2),
        );
        console.log(
          '🔍 PurchaseScreen: Detail object keys:',
          Object.keys(detail),
        );
        console.log('🔍 PurchaseScreen: Detail partyName:', detail.partyName);
        console.log(
          '🔍 PurchaseScreen: Detail customerName:',
          detail.customerName,
        );
        console.log(
          '🔍 PurchaseScreen: Detail supplierName:',
          detail.supplierName,
        );
        console.log(
          '🔍 PurchaseScreen: Original item partyName:',
          item.partyName,
        );
        console.log(
          '🔍 PurchaseScreen: Original item customerName:',
          item.customerName,
        );
        console.log(
          '🔍 PurchaseScreen: Original item supplierName:',
          item.supplierName,
        );
        const detailGstRaw =
          (detail as any).gstPct ??
          (detail as any).gst_pct ??
          (detail as any).gst;
        const detailGst =
          typeof detailGstRaw === 'string'
            ? Number(detailGstRaw)
            : typeof detailGstRaw === 'number'
            ? detailGstRaw
            : undefined;
        // Helper function to flatten and validate items
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

        let mergedDetailItems: any[] = flattenAndValidateItems(detail.items);

        // If still no items, try alternative fields
        if (!mergedDetailItems || mergedDetailItems.length === 0) {
          mergedDetailItems = flattenAndValidateItems(
            (detail as any).transactionItems,
          );
        }

        if (!mergedDetailItems || mergedDetailItems.length === 0) {
          mergedDetailItems = flattenAndValidateItems(
            (detail as any).voucherItems,
          );
        }

        // Try cache if still no items
        if (!mergedDetailItems || mergedDetailItems.length === 0) {
          try {
            const cacheKey = `voucherItemsCache:${item.id}`;
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed?.items)) {
                mergedDetailItems = flattenAndValidateItems(parsed.items);
              }
              if (
                typeof parsed?.gstPct === 'number' &&
                typeof detailGst !== 'number'
              ) {
                (detail as any).gstPct = parsed.gstPct;
              }
            }
          } catch {}
        }
        // If backend returns no item rows but we have amounts, synthesize one display item
        if (
          (!mergedDetailItems || mergedDetailItems.length === 0) &&
          (typeof (detail as any).subTotal === 'number' ||
            typeof (detail as any).totalAmount === 'number')
        ) {
          const base =
            typeof (detail as any).subTotal === 'number'
              ? (detail as any).subTotal
              : 0;
          const gPct = typeof detailGst === 'number' ? detailGst : 0;
          const rateVal = base > 0 ? base : Number(item.amount) || 0;
          const amountVal = rateVal * (1 + gPct / 100);
          mergedDetailItems = [
            {
              id: '1',
              name:
                (detail as any).description ||
                (detail as any).partyName ||
                'Item 1',
              description:
                (detail as any).description ||
                (detail as any).partyName ||
                'Item 1',
              quantity: 1,
              rate: rateVal,
              amount: amountVal,
            },
          ];
        }

        // Build enriched object: API data is THE source of truth
        const enriched = {
          // Start with item (local state from list) as base for metadata
          ...item,
          // OVERRIDE with API detail - this is the fresh data from the database
          ...detail,
          // Force use API's party fields - these are what was just saved
          partyName:
            detail.partyName ||
            detail.customerName ||
            detail.supplierName ||
            item.partyName ||
            item.customerName ||
            item.supplierName ||
            '',
          partyPhone:
            detail.partyPhone ||
            detail.phone ||
            detail.phoneNumber ||
            item.partyPhone ||
            '',
          partyAddress:
            detail.partyAddress ||
            detail.address ||
            detail.addressLine1 ||
            item.partyAddress ||
            '',
          // Use mergedDetailItems if valid, otherwise fallback to item.items from list view
          // Priority: Detail API items > List view items > Empty
          items: (() => {
            // If detail has valid items, use them
            if (mergedDetailItems && mergedDetailItems.length > 0) {
              return mergedDetailItems;
            }
            // Fallback to list view items if they exist and are valid
            if (Array.isArray(item.items) && item.items.length > 0) {
              // Check if items from list are actually valid (not nested empty arrays)
              const firstItem = item.items[0];
              if (
                firstItem &&
                typeof firstItem === 'object' &&
                !Array.isArray(firstItem)
              ) {
                return item.items;
              }
            }
            return [];
          })(),
          gstPct: typeof detailGst === 'number' ? detailGst : item.gstPct,
          // Ensure date is properly preserved from API
          date:
            detail.date ||
            detail.transactionDate ||
            detail.purchaseDate ||
            item.date ||
            item.transactionDate ||
            item.purchaseDate,
          notes: detail.notes || item.notes || '',
        };
        console.log(
          '🔍 PurchaseScreen: Setting editingItem to enriched:',
          JSON.stringify(enriched, null, 2),
        );
        console.log('🔍 PurchaseScreen: Enriched date field:', enriched.date);
        console.log(
          '🔍 PurchaseScreen: Enriched partyName field:',
          enriched.partyName,
        );
        console.log(
          '🔍 PurchaseScreen: Enriched partyAddress field:',
          enriched.partyAddress,
        );
        console.log(
          '🔍 PurchaseScreen: Enriched partyPhone field:',
          enriched.partyPhone,
        );
        console.log(
          '🔍 PurchaseScreen: detail.partyName from API:',
          detail.partyName,
        );
        console.log(
          '🔍 PurchaseScreen: item.partyName from list:',
          item.partyName,
        );
        console.log(
          '🔍 PurchaseScreen: Enriched partyPhone field:',
          enriched.partyPhone,
        );
        console.log(
          '🔍 PurchaseScreen: Enriched partyAddress field:',
          enriched.partyAddress,
        );
        console.log(
          '🔍 PurchaseScreen: Enriched object keys:',
          Object.keys(enriched),
        );
        console.log(
          '🔍 PurchaseScreen: Final enriched partyName value:',
          enriched.partyName,
        );
        // NOW set editingItem with fresh data - this will populate the form
        setEditingItem(enriched);
        setIsFetchingEdit(false);
      } else {
        // API failed, use item from list as fallback
        console.log(
          '🔍 PurchaseScreen: API failed, using item from list as fallback:',
          JSON.stringify(item, null, 2),
        );
        setEditingItem(item);
        setIsFetchingEdit(false);
      }
    } catch (error) {
      console.log(
        '🔍 PurchaseScreen: Error in handleEditItem, using item from list:',
        JSON.stringify(item, null, 2),
        error,
      );
      // On error, use item from list as fallback
      setEditingItem(item);
      setIsFetchingEdit(false);
    }
  };

  const addItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (
    id: string,
    field: keyof PurchaseItem,
    value: string | number,
  ) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };
        if (field === 'quantity' || field === 'rate') {
          const numValue =
            typeof value === 'string' ? parseFloat(value) : value;
          updatedItem[field] = isNaN(numValue) ? 0 : numValue;
          // Calculate amount without GST - GST will be added in final total only
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        } else {
          (updatedItem as any)[field] = value;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);
  };

  const removeItem = (id: string) => {
    setItems((items || []).filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return (items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return sum + quantity * rate;
    }, 0);
  };

  const calculateGST = () => {
    return (items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const itemSubtotal = quantity * rate;
      const itemGST = itemSubtotal * (gstPct / 100);
      return sum + itemGST;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    // GST is included in taxAmount, so no need to add it separately
    return subtotal + taxAmount - discountAmount;
  };

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '₹0';
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    if (!status) return '#6c757d';
    switch (status) {
      case 'Paid':
        return '#28a745';
      case 'Pending':
        return '#ffc107';
      case 'Overdue':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const renderPurchaseItem = ({ item }: { item: any }) => {
    if (!item) {
      console.warn('renderPurchaseItem: item is undefined or null');
      return null;
    }

    return (
      <View
        style={[
          styles.invoiceCard,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={async () => await handleEditItem(item)}
          activeOpacity={0.8}
        >
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceNumber}>
              {item.billNumber || item.purchaseNumber || `PUR-${item.id}`}
            </Text>
            <StatusBadge status={item.status} />
          </View>
          <Text style={styles.customerName}>
            {item.partyName || 'Unknown Supplier'}
          </Text>
          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceDate}>
              {item.date?.slice(0, 10) || 'No Date'}
            </Text>
            <Text style={styles.invoiceAmount}>
              {formatCurrency(Number(item.amount) || 0)}
            </Text>
          </View>
        </TouchableOpacity>
        {/* Sync button hidden as requested */}
        {false && (
          <TouchableOpacity
            style={[
              styles.syncButton,
              item.syncYN === 'Y' && {
                backgroundColor: '#bdbdbd',
                borderColor: '#bdbdbd',
              },
            ]}
            onPress={() => handleSync(item)}
            activeOpacity={0.85}
            disabled={item.syncYN === 'Y'}
          >
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getStatusLabel = (status: string) => {
    if (!status) return 'Unknown';
    switch (status) {
      case 'complete':
        return 'Paid';
      case 'draft':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status || 'Unknown';
    }
  };

  const handleSync = async (item: any) => {
    if (!item || !item.id) {
      console.warn('handleSync: item or item.id is undefined');
      return;
    }
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Use PUT instead of PATCH - backend requires full transaction object
      // Get userId for the update
      const userId = await getUserIdFromToken();
      if (!userId) {
        throw new Error('User not authenticated. Please login again.');
      }

      // Use raw data if available (original transaction data), otherwise use enriched data
      const rawData = item._raw || item;

      // Build PUT body with all required fields plus syncYN
      const putBody: any = {
        user_id: rawData.user_id || userId,
        createdBy: rawData.createdBy || rawData.user_id || userId,
        updatedBy: userId,
        type: rawData.type || 'debit',
        amount: Number(rawData.amount || item.amount || 0),
        date:
          rawData.date ||
          rawData.paymentDate ||
          rawData.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transactionDate:
          rawData.transactionDate ||
          rawData.date ||
          rawData.paymentDate ||
          item.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        purchaseDate:
          rawData.purchaseDate ||
          rawData.date ||
          rawData.transactionDate ||
          item.purchaseDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transaction_date:
          rawData.transaction_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        purchase_date:
          rawData.purchase_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        status: rawData.status || item.status || 'Complete',
        description: rawData.description || item.description || '',
        notes: rawData.notes || item.notes || '',
        partyName: rawData.partyName || item.partyName || '',
        partyId:
          rawData.partyId ||
          rawData.customer_id ||
          item.partyId ||
          item.customer_id ||
          null,
        customer_id:
          rawData.customer_id ||
          rawData.partyId ||
          item.customer_id ||
          item.partyId ||
          null,
        partyPhone:
          rawData.partyPhone ||
          rawData.phone ||
          rawData.phoneNumber ||
          item.partyPhone ||
          '',
        partyAddress:
          rawData.partyAddress ||
          rawData.address ||
          rawData.addressLine1 ||
          item.partyAddress ||
          '',
        method: rawData.method || item.method || 'Purchase',
        category: rawData.category || item.category || '',
        items: rawData.items || item.items || [],
        gstPct: rawData.gstPct || item.gstPct || 0,
        discount: rawData.discount || item.discount || 0,
        cGST: rawData.cGST || item.cGST || 0,
        subTotal: rawData.subTotal || item.subTotal || 0,
        totalAmount:
          rawData.totalAmount ||
          item.totalAmount ||
          Number(rawData.amount || item.amount || 0),
        billNumber:
          rawData.billNumber || item.billNumber || item.purchaseNumber || '', // Include billNumber for sync
        syncYN: 'Y', // Set sync flag
      };

      // Use unified API for update
      await unifiedApi.updateTransaction(item.id, putBody);

      // Refresh the list to show updated sync status
      await fetchPurchasesFn();

      showAlert({
        title: 'Success',
        message: 'Purchase synced successfully!',
        type: 'success',
      });
    } catch (e: any) {
      console.error('handleSync error:', e);
      showAlert({
        title: 'Error',
        message: e.message || 'Failed to sync purchase. Please try again.',
        type: 'error',
      });
    }
  };

  const handleBackToList = async () => {
    setShowCreateForm(false);
    setEditingItem(null);
    setSupplierName('');
    setSupplierPhone('');
    setSupplierAddress('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
    try {
      // Preview only - don't store until transaction is saved
      const nextPurchaseNumber = await generateNextDocumentNumber(
        'purchase',
        false,
      );
      setPurchaseNumber(nextPurchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      // Generator fallback returns 'PUR-001' for new users
      setPurchaseNumber('PUR-001');
    }
    setNotes('');
    setSupplier('');
    setTriedSubmit(false);
    setError(null);
  };

  const isFieldInvalid = (field: string, fieldType?: string) => {
    if (!triedSubmit) return false;
    if (fieldType === 'phone') {
      const phoneDigits = field.replace(/\D/g, '');
      return !field || phoneDigits.length !== 10;
    }
    if (fieldType === 'address') {
      return !field;
    }
    return !field;
  };

  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'purchaseDate':
        return !purchaseDate ? 'Date is required' : '';
      case 'supplier':
        return !supplier ? 'Supplier is required' : '';
      case 'supplierPhone':
        if (!supplierPhone) return 'Phone is required';
        {
          const phoneDigits = supplierPhone.replace(/\D/g, '');
          if (!/^([6-9])\d{9}$/.test(phoneDigits)) {
            return 'Indian mobile number must start with 6, 7, 8, or 9';
          }
        }
        return '';
      case 'supplierAddress':
        if (!supplierAddress) return 'Address is required';
        return '';
      default:
        return '';
    }
  };

  // Indian mobile validation helper (10 digits, starts with 6-9)
  const isValidIndianMobile = (val?: string) => {
    if (!val) return false;
    const digits = String(val).replace(/\D/g, '');
    return /^([6-9])\d{9}$/.test(digits);
  };

  const {
    suppliers,
    add: addSupplierCtx,
    fetchAll: fetchSuppliersCtx,
  } = useSupplierContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const purchaseNumberRef = useRef<TextInput>(null);
  const purchaseDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const supplierInputRef = useRef<TextInput>(null);
  const supplierPhoneRef = useRef<TextInput>(null);
  const supplierAddressRef = useRef<TextInput>(null);

  // Field refs mapping for error scrolling
  const fieldRefs = {
    purchaseDate: purchaseDateRef,
    supplierInput: supplierInputRef,
    supplierPhone: supplierPhoneRef,
    supplierAddress: supplierAddressRef,
    notes: notesRef,
  } as const;

  // Scroll to error field helper (aligned with PaymentScreen)
  const scrollToErrorField = (
    errorType?: string,
    fieldName?: keyof typeof fieldRefs,
  ) => {
    if (!scrollRef.current) return;

    const fieldScrollPositions: Record<string, number> = {
      purchaseDate: 120,
      supplierInput: 200,
      supplierPhone: 280,
      supplierAddress: 360,
      notes: 800,
    };

    const targetKey = fieldName || 'supplierInput';
    const targetRef = fieldRefs[targetKey];

    if (targetRef && targetRef.current) {
      try {
        (targetRef.current as any).measure?.(
          (
            _x: number,
            _y: number,
            _w: number,
            _h: number,
            _pageX: number,
            pageY: number,
          ) => {
            const scrollY = Math.max(0, pageY - 150);
            scrollRef.current?.scrollToPosition(0, scrollY, true);
          },
        );
        return;
      } catch {}
    }

    const fallbackY = fieldScrollPositions[targetKey] || 200;
    try {
      scrollRef.current.scrollToPosition(0, fallbackY, true);
    } catch {
      try {
        scrollRef.current.scrollToEnd(true);
      } catch {}
    }
  };
  const itemRefs = useRef<{
    [itemId: string]: { [field: string]: TextInput | null };
  }>({});

  // Filtered purchases
  const filteredPurchases = apiPurchases;

  // Add missing functions for UploadDocument and filters
  const handleRecentSearchPress = (search: RecentSearch) => {
    setSearchFilter(prev => ({ ...prev, searchText: search.text }));
  };

  const startVoiceRecording = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'App needs access to your microphone to record voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({
            title: 'Permission Denied',
            message: 'Microphone permission is required for voice recording.',
            type: 'error',
          });
          return;
        }
      }

      setIsRecording(true);
      setVoiceError(null);
      const result = await audioRecorderPlayer.startRecorder();
      console.log('Recording started:', result);
    } catch (error) {
      console.error('Error starting recording:', error);
      setVoiceError('Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      setIsRecording(false);
      const result = await audioRecorderPlayer.stopRecorder();
      console.log('Recording stopped:', result);
      await sendAudioForTranscription(result);
    } catch (error) {
      console.error('Error stopping recording:', error);
      setVoiceError('Failed to stop recording');
    }
  };

  const sendAudioForTranscription = async (audioUri: string) => {
    try {
      setVoiceLoading(true);
      setVoiceError(null);

      // Simulate API call for voice transcription
      setTimeout(() => {
        const mockTranscription = `${folderName} from ABC Supplier for 5000 rupees with 18% GST on 15th January 2024`;
        setLastVoiceText(mockTranscription);
        setVoiceLoading(false);

        // Process the transcribed text
        processVoiceText(mockTranscription);
      }, 2000);
    } catch (error) {
      console.error('Error sending audio for transcription:', error);
      setVoiceError('Failed to transcribe audio');
      setVoiceLoading(false);
    }
  };

  const processVoiceText = (text: string) => {
    try {
      // Extract supplier name
      const supplierMatch = text.match(
        /from\s+([A-Za-z\s]+?)\s+(?:for|with|on)/i,
      );
      if (supplierMatch) {
        setSupplier(supplierMatch[1].trim());
      }

      // Extract amount
      const amountMatch = text.match(/(\d+)\s+rupees?/i);
      if (amountMatch) {
        const amount = parseInt(amountMatch[1]);
        if (items.length > 0) {
          updateItem(items[0].id, 'rate', amount);
        }
      }

      // Extract GST percentage
      const gstMatch = text.match(/(\d+)%\s*GST/i);
      if (gstMatch) {
        const gstPct = parseInt(gstMatch[1]);
        setGstPct(gstPct);
        // Recalculate all item amounts without GST - GST will be added in final total only
        const updatedItems = items.map(item => ({
          ...item,
          amount: item.quantity * item.rate,
        }));
        setItems(updatedItems);
      }

      // Extract date
      const dateMatch = text.match(
        /(\d+)(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      );
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = dateMatch[2];
        const year = parseInt(dateMatch[3]);
        const monthIndex = new Date(`${month} 1, 2000`).getMonth();
        const date = new Date(year, monthIndex, day);
        setPurchaseDate(formatDateLocal(date)); // Use formatDateLocal to avoid timezone issues
      }

      setNlpStatus('Voice data processed successfully');
    } catch (error) {
      console.error('Error processing voice text:', error);
      setVoiceError('Failed to process voice data');
    }
  };

  // Update GST percentage for all items
  const updateGstPctForAllItems = (value: number) => {
    const oldGstPct = gstPct;
    const updatedItems = items.map(item => ({
      ...item,
      gstPct: value,
      // Amount without GST - GST will be added in final total only
      amount: item.quantity * item.rate,
    }));
    setItems(updatedItems);
    // Update taxAmount to include new GST amount
    const subtotal = calculateSubtotal();
    const oldGstAmount = subtotal * (oldGstPct / 100);
    const newGstAmount = subtotal * (value / 100);
    // Adjust taxAmount: remove old GST, add new GST
    setTaxAmount(prev => prev - oldGstAmount + newGstAmount);
  };

  const handleFileTypeSelection = async (type: string) => {
    setShowFileTypeModal(false);
    setFileType(type);

    try {
      let result;
      if (type === 'image') {
        result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
        });
      } else if (type === 'pdf') {
        // This part of the code was removed as per the edit hint.
        // If DocumentPicker is no longer used, this block will be removed.
        // For now, keeping it as a placeholder.
        showAlert({
          title: 'Document Picker',
          message: 'Document picker is not available.',
          type: 'error',
        });
      } else if (type === 'excel') {
        // This part of the code was removed as per the edit hint.
        // If DocumentPicker is no longer used, this block will be removed.
        // For now, keeping it as a placeholder.
        showAlert({
          title: 'Document Picker',
          message: 'Document picker is not available.',
          type: 'error',
        });
      }

      if (result && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile(file);
        setDocumentName(file.fileName || 'Document');

        if (type === 'image' || type === 'pdf') {
          await processDocumentWithOCR(file);
        } else if (type === 'excel') {
          // This part of the code was removed as per the edit hint.
          // If DocumentPicker is no longer used, this block will be removed.
          // For now, keeping it as a placeholder.
          showAlert({
            title: 'Document Picker',
            message: 'Document picker is not available.',
            type: 'error',
          });
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to select file',
        type: 'error',
      });
    }
  };

  const processDocumentWithOCR = async (file: any) => {
    try {
      setOcrLoading(true);
      setOcrError(null);

      // Simulate OCR processing
      setTimeout(() => {
        const mockOcrText = `${folderName} Bill
        
Supplier: ABC Electronics Pvt Ltd
Phone: 9876543210
Address: 123 Tech Street, Bangalore, Karnataka 560001
GST Number: 29ABCDE1234F1Z5

Purchase Date: 15-01-2025
Bill Number: PB-2025-001

Items:
1. Laptop - Qty: 2, Rate: ₹45,000, GST: 18%, Amount: ₹106,200
2. Mouse - Qty: 5, Rate: ₹500, GST: 18%, Amount: ₹2,950
3. Keyboard - Qty: 3, Rate: ₹1,200, GST: 18%, Amount: ₹4,248

Subtotal: ₹113,400
Total GST: ₹20,412
Total Amount: ₹133,812

Notes: Delivery within 3 business days, warranty included for all items.`;
        setOcrLoading(false);

        // Process OCR text
        processOcrText(mockOcrText);
      }, 3000);
    } catch (error) {
      console.error('Error processing document with OCR:', error);
      setOcrError('Failed to process document');
      setOcrLoading(false);
    }
  };

  const processOcrText = (text: string) => {
    try {
      // Extract supplier name
      const supplierMatch = text.match(/Supplier:\s*([^\n]+)/i);
      if (supplierMatch) {
        setSupplier(supplierMatch[1].trim());
      }

      // Extract supplier phone
      const phoneMatch = text.match(/Phone:\s*(\d+)/i);
      if (phoneMatch) {
        setSupplierPhone(phoneMatch[1].trim());
      }

      // Extract supplier address
      const addressMatch = text.match(/Address:\s*([^\n]+)/i);
      if (addressMatch) {
        setSupplierAddress(addressMatch[1].trim());
      }

      // Extract amount
      const amountMatch = text.match(/Amount:\s*(\d+)/i);
      if (amountMatch) {
        const amount = parseInt(amountMatch[1]);
        if (items.length > 0) {
          updateItem(items[0].id, 'rate', amount);
        }
      }

      // Extract date
      const dateMatch = text.match(/Date:\s*(\d{2})-(\d{2})-(\d{4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = parseInt(dateMatch[3]);
        const date = new Date(year, month, day);
        setPurchaseDate(formatDateLocal(date)); // Use formatDateLocal to avoid timezone issues
      }

      // Extract GST
      const gstMatch = text.match(/GST:\s*(\d+)%/i);
      if (gstMatch) {
        const gstPct = parseInt(gstMatch[1]);
        setGstPct(gstPct);
        // Recalculate all item amounts without GST - GST will be added in final total only
        const updatedItems = items.map(item => ({
          ...item,
          amount: item.quantity * item.rate,
        }));
        setItems(updatedItems);
      }

      // Extract items from OCR text if available
      const itemsMatch = text.match(
        /Items:\s*([\s\S]*?)(?=Subtotal:|Total:|Notes:|$)/i,
      );
      if (itemsMatch) {
        const itemsText = itemsMatch[1];
        const itemLines = itemsText
          .split('\n')
          .filter(line => line.trim() && line.includes('-'));

        if (itemLines.length > 0) {
          const extractedItems = itemLines.map((line, index) => {
            // Parse item line: "1. Laptop - Qty: 2, Rate: ₹45,000, GST: 18%, Amount: ₹106,200"
            const descriptionMatch = line.match(/\d+\.\s*([^-]+)/);
            const qtyMatch = line.match(/Qty:\s*(\d+)/i);
            const rateMatch = line.match(/Rate:\s*₹?([\d,]+)/i);
            const gstMatch = line.match(/GST:\s*(\d+)%/i);
            const amountMatch = line.match(/Amount:\s*₹?([\d,]+)/i);

            return {
              id: (index + 1).toString(),
              description: descriptionMatch
                ? descriptionMatch[1].trim()
                : `Item ${index + 1}`,
              quantity: qtyMatch ? parseInt(qtyMatch[1]) : 1,
              rate: rateMatch ? parseFloat(rateMatch[1].replace(/,/g, '')) : 0,

              amount: amountMatch
                ? parseFloat(amountMatch[1].replace(/,/g, ''))
                : 0,
            };
          });

          setItems(extractedItems);
        }
      }

      // Extract notes
      const notesMatch = text.match(/Notes:\s*([^\n]+)/i);
      if (notesMatch) {
        setNotes(notesMatch[1].trim());
      }

      setShowPopup(true);
      setPopupTitle('OCR Processing Complete');
      setPopupMessage(
        `${folderName.toLowerCase()} bill data has been extracted and filled into the form successfully.`,
      );
      setPopupType('success');
    } catch (error) {
      console.error('Error processing OCR text:', error);
      setOcrError('Failed to process OCR data');
    }
  };

  const processExcelFile = async (file: any) => {
    try {
      // Simulate Excel processing
      setTimeout(() => {
        const mockExcelData = {
          supplier: 'Excel Electronics Ltd',
          phone: '8765432109',
          address: '456 Business Park, Mumbai, Maharashtra 400001',
          date: '20-01-2025',
          items: [
            {
              description: 'Desktop Computer',
              quantity: 3,
              rate: 35000,
              amount: 123900,
            },
            {
              description: 'Monitor 24"',
              quantity: 3,
              rate: 8000,
              amount: 28320,
            },
            {
              description: 'UPS 1KVA',
              quantity: 3,
              rate: 3000,
              amount: 10620,
            },
          ],
          notes: 'Bulk order for office setup, delivery required by month end',
        };

        // Fill form with Excel data
        setSupplier(mockExcelData.supplier);
        setSupplierPhone(mockExcelData.phone);
        setSupplierAddress(mockExcelData.address);

        // Parse date
        const [day, month, year] = mockExcelData.date.split('-');
        const excelDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
        setPurchaseDate(formatDateLocal(excelDate)); // Use formatDateLocal to avoid timezone issues

        // Set items
        const excelItems = mockExcelData.items.map((item, index) => ({
          id: (index + 1).toString(),
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }));
        setItems(excelItems);

        setNotes(mockExcelData.notes);

        setShowPopup(true);
        setPopupTitle('Excel Processing Complete');
        setPopupMessage(
          'Excel data has been extracted and filled into the form successfully.',
        );
        setPopupType('success');
      }, 2000);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to process Excel file',
        type: 'error',
      });
    }
  };

  const showCustomPopup = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  // Utility functions for filtering
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }

  function inRange(num: number, min?: number, max?: number) {
    const n = Number(num);
    const minN = min !== undefined && min !== null ? Number(min) : undefined;
    const maxN = max !== undefined && max !== null ? Number(max) : undefined;
    if (minN !== undefined && n < minN) return false;
    if (maxN !== undefined && n > maxN) return false;
    return true;
  }

  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }

  // Enhanced filtering logic
  const getFilteredPurchases = () => {
    if (
      !searchFilter.searchText &&
      !searchFilter.amountMin &&
      !searchFilter.amountMax &&
      !searchFilter.dateFrom &&
      !searchFilter.dateTo &&
      !searchFilter.paymentMethod &&
      !searchFilter.status &&
      !searchFilter.reference &&
      !searchFilter.description
    ) {
      return apiPurchases;
    }

    return apiPurchases.filter(purchase => {
      // Text search
      if (searchFilter.searchText) {
        const searchLower = searchFilter.searchText.toLowerCase();
        const matchesSearch =
          fuzzyMatch(purchase.partyName || '', searchLower) ||
          fuzzyMatch(purchase.billNumber || '', searchLower) ||
          fuzzyMatch(purchase.notes || '', searchLower) ||
          fuzzyMatch(purchase.amount?.toString() || '', searchLower);

        if (!matchesSearch) return false;
      }

      // Amount range
      if (searchFilter.amountMin || searchFilter.amountMax) {
        if (
          !inRange(
            purchase.amount,
            searchFilter.amountMin,
            searchFilter.amountMax,
          )
        ) {
          return false;
        }
      }

      // Date range
      if (searchFilter.dateFrom || searchFilter.dateTo) {
        if (
          !inDateRange(
            purchase.date,
            searchFilter.dateFrom,
            searchFilter.dateTo,
          )
        ) {
          return false;
        }
      }

      // Payment method
      if (
        searchFilter.paymentMethod &&
        purchase.method !== searchFilter.paymentMethod
      ) {
        return false;
      }

      // Status
      if (searchFilter.status && purchase.status !== searchFilter.status) {
        return false;
      }

      // Reference
      if (
        searchFilter.reference &&
        !fuzzyMatch(purchase.billNumber || '', searchFilter.reference)
      ) {
        return false;
      }

      // Description
      if (
        searchFilter.description &&
        !fuzzyMatch(purchase.notes || '', searchFilter.description)
      ) {
        return false;
      }

      return true;
    });
  };

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    console.log('🔍 PurchaseScreen: handleSubmit called with status:', status);
    console.log('🔍 PurchaseScreen: editingItem exists:', !!editingItem);
    console.log('🔍 PurchaseScreen: editingItem.id:', editingItem?.id);
    setTriedSubmit(true);
    setError(null);

    // Check transaction limits BEFORE making API call
    try {
      console.log('🔍 Checking transaction limits before purchase creation...');
      await forceCheckTransactionLimit();
    } catch (limitError) {
      console.error('❌ Error checking transaction limits:', limitError);
      // Continue with API call if limit check fails
    }

    // Validate required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      purchaseNumber,
      purchaseDate,
      supplier,
      supplierPhone,
      supplierAddress,
    });

    if (!purchaseDate || !supplier) {
      console.log('Required fields validation failed');
      setError('Please fill all required fields correctly.');
      setTimeout(
        () =>
          scrollToErrorField(
            'validation',
            !purchaseDate ? 'purchaseDate' : 'supplierInput',
          ),
        200,
      );
      return;
    }

    // Validate optional fields if they have values
    if (supplierPhone && isFieldInvalid(supplierPhone, 'phone')) {
      setError(
        'Phone number must be at least 10 digits and cannot exceed 16 digits.',
      );
      setTimeout(() => scrollToErrorField('validation', 'supplierPhone'), 200);
      return;
    }

    if (supplierAddress && isFieldInvalid(supplierAddress, 'address')) {
      setError('Address is required.');
      setTimeout(
        () => scrollToErrorField('validation', 'supplierAddress'),
        200,
      );
      return;
    }

    // Validate items array - ensure at least one valid item
    const validItems = items.filter(
      item => item.description?.trim() && item.quantity > 0 && item.rate > 0,
    );

    if (validItems.length === 0) {
      setError(
        'Please add at least one item with description, quantity, and rate.',
      );
      setTimeout(() => scrollToErrorField('validation'), 200);
      return;
    }

    // Block API when transaction limit reached
    try {
      await forceCheckTransactionLimit();
    } catch (e) {
      await forceShowPopup();
      setError(
        'Transaction limit reached. Please upgrade your plan to continue.',
      );
      return;
    }

    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);

    console.log('🔍 PurchaseScreen: ========== STARTING SUBMIT ==========');
    console.log('🔍 PurchaseScreen: editingItem exists:', !!editingItem);
    console.log('🔍 PurchaseScreen: editingItem.id:', editingItem?.id);
    console.log('🔍 PurchaseScreen: form values:', {
      supplier,
      supplierPhone,
      supplierAddress,
      purchaseDate,
      items: items.length,
    });

    try {
      // Check if supplier exists, if not, create (only for new purchases, not updates)
      let supplierNameToUse = supplier.trim();
      let supplierIdToUse: number | null = supplierId;

      console.log('🔍 PurchaseScreen: Editing item exists:', !!editingItem);

      // For updates, don't create new supplier - use the existing one
      if (!editingItem) {
        let existingSupplier = suppliers.find(
          (s: any) =>
            s.name?.trim().toLowerCase() === supplierNameToUse.toLowerCase(),
        );
        if (!existingSupplier) {
          console.log(
            '🔍 PurchaseScreen: Creating new supplier:',
            supplierNameToUse,
          );

          // Log what we're about to send
          console.log('🔍 PurchaseScreen: Supplier details to send:', {
            name: supplierNameToUse,
            phoneNumber: supplierPhone,
            address: supplierAddress,
          });

          // Build supplier data - only include phone/address if they exist
          const supplierData: any = {
            name: supplierNameToUse,
            partyName: supplierNameToUse,
          };

          // Validate phone strictly; block save if invalid
          if (supplierPhone?.trim()) {
            if (!isValidIndianMobile(supplierPhone)) {
              setError(
                'Please enter a valid Indian mobile number (starts with 6-9, 10 digits).',
              );
              setTimeout(
                () => scrollToErrorField('validation', 'supplierPhone'),
                200,
              );
              return;
            }
            supplierData.phoneNumber = supplierPhone.trim();
          }

          // Only add address if it has actual value
          if (supplierAddress?.trim()) {
            supplierData.address = supplierAddress.trim();
          }

          console.log('🔍 PurchaseScreen: Final supplier data:', supplierData);

          // Pass all supplier details including phone and address
          let newSupplier: any = null;
          try {
            newSupplier = await addSupplierCtx(supplierData);
          } catch (createErr) {
            console.log('❌ Supplier create failed:', createErr);
            setError(
              'Failed to create supplier. Please verify phone and address, then try again.',
            );
            setTimeout(
              () => scrollToErrorField('validation', 'supplierInput'),
              200,
            );
            return;
          }

          console.log('✅ Created new supplier with details:', {
            name: supplierNameToUse,
            phone: supplierPhone,
            address: supplierAddress,
            newSupplier: newSupplier,
          });
          if (newSupplier) {
            supplierNameToUse = newSupplier.name || '';
            supplierIdToUse = Number(newSupplier.id) || null;
            await fetchSuppliersCtx('');
          }
        }
        if (existingSupplier && !supplierIdToUse) {
          supplierIdToUse = Number((existingSupplier as any).id) || null;
        }
      } else {
        // For updates, use the existing supplier from editingItem
        console.log('🔍 PurchaseScreen: Using existing supplier for update');
        if (editingItem.partyId) {
          supplierIdToUse = Number(editingItem.partyId);
        }
      }
      const userId = await getUserIdFromToken();
      if (!userId) throw new Error('User not authenticated.');

      // Hard block if supplierId is still missing
      if (
        !supplierIdToUse ||
        supplierIdToUse <= 0 ||
        isNaN(Number(supplierIdToUse))
      ) {
        setError(
          'Supplier not selected/created. Please choose a valid supplier.',
        );
        setTimeout(
          () => scrollToErrorField('validation', 'supplierInput'),
          200,
        );
        return;
      }

      // Always regenerate document number on submit for new transactions (not editing)
      // This ensures accuracy even if other transactions were created since initialization
      let finalPurchaseNumber = purchaseNumber || billNumber || '';
      if (!editingItem) {
        // New transaction - regenerate based on current backend state
        try {
          finalPurchaseNumber = await generateNextDocumentNumber(
            'purchase',
            true, // Store now - transaction is being saved
          );
          setPurchaseNumber(finalPurchaseNumber);
          console.log(
            '🔍 Generated purchaseNumber on submit:',
            finalPurchaseNumber,
          );
        } catch (error) {
          console.error('Error generating purchase number:', error);
          // Fallback: use preview number if available, otherwise default to PUR-001
          finalPurchaseNumber = purchaseNumber || 'PUR-001';
        }
      } else {
        // Editing - use existing number or preview number
        finalPurchaseNumber =
          purchaseNumber ||
          editingItem.billNumber ||
          editingItem.purchaseNumber ||
          '';
      }

      // Filter out invalid items (empty description or zero values)
      const validItemsForCalc = items.filter(
        item => item.description?.trim() && item.quantity > 0 && item.rate > 0,
      );

      // Calculate GST, subtotal, total using only valid items
      const subTotal = validItemsForCalc.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0,
      );
      const gstAmount = subTotal * (gstPct / 100);
      const totalAmount = subTotal + gstAmount - discountAmount;

      // Prepare item payloads (align with Sell): include per-line gstPct, array-of-arrays, and JSON mirrors
      const simpleItemPayload = validItemsForCalc.map(item => {
        const qtyNum = Number(item.quantity) || 0;
        const rateNum = Number(item.rate) || 0;
        const lineGstPct = Number((item as any).gstPct ?? gstPct) || 0;
        const amountNum =
          item.amount != null && !isNaN(Number(item.amount))
            ? Number(item.amount)
            : qtyNum * rateNum * (1 + lineGstPct / 100);
        return {
          name: item.description?.trim() || '',
          quantity: qtyNum,
          rate: rateNum,
          amount: amountNum,
          gstPct: lineGstPct,
        } as any;
      });

      const itemsForText = simpleItemPayload.map(it => ({
        Description: (it as any).name || '',
        Quantity: Number((it as any).quantity) || 0,
        Rate: Number((it as any).rate) || 0,
        GST: Number((it as any).gstPct) || 0,
        Amount: Number((it as any).amount) || 0,
      }));

      // API body - matching AddNewEntryScreen and AddPartyScreen behavior
      // Critical: Get fresh supplier data before sending update
      let finalPartyName = supplierNameToUse;
      let finalPartyPhone = supplierPhone;
      let finalPartyAddress = supplierAddress;

      // If we're updating and supplier fields changed, ensure we're using the form values
      if (editingItem) {
        console.log('🔍 PurchaseScreen: Update mode - checking supplier data', {
          formSupplier: supplier,
          formPhone: supplierPhone,
          formAddress: supplierAddress,
          existingPartyName: editingItem.partyName,
          existingPartyPhone: editingItem.partyPhone,
          existingPartyAddress: editingItem.partyAddress,
        });

        // Use form values which are the updated values
        finalPartyName = supplier || editingItem.partyName || '';
        finalPartyPhone = supplierPhone || editingItem.partyPhone || '';
        finalPartyAddress = supplierAddress || editingItem.partyAddress || '';
      }

      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: 'debit',
        amount: Number(totalAmount.toFixed(2)),
        date: purchaseDate, // keep as YYYY-MM-DD to preserve exact selected date
        documentDate: purchaseDate, // keep as YYYY-MM-DD
        transactionDate: purchaseDate,
        purchaseDate: purchaseDate,
        // snake_case aliases
        transaction_date: purchaseDate,
        document_date: purchaseDate,
        purchase_date: purchaseDate,
        status,
        notes: notes || '',
        description: '', // Align with Sell: do not copy Notes into Description
        method: 'Purchase', // Match AddPartyScreen voucher creation pattern
        partyName: finalPartyName,
        partyId: supplierIdToUse,
        customer_id: supplierIdToUse,
        partyPhone: finalPartyPhone,
        partyAddress: finalPartyAddress,
        gstNumber: '', // AddPartyScreen pattern - include for consistency
        items: simpleItemPayload,
        // Alternative keys
        transactionItems: simpleItemPayload,
        voucherItems: simpleItemPayload,
        gstPct: gstPct, // Global GST percentage
        discount: discountAmount, // Discount amount
        cGST: taxAmount, // Tax amount (using cGST field)
        subTotal: subTotal,
        totalAmount: totalAmount,
        billNumber: finalPurchaseNumber, // Include billNumber (purchase number like "PUR-1333")
        syncYN: syncYNOverride || syncYN, // Include sync field
      };

      // Include user's primary role id for backend auditing/mapping
      try {
        const { addRoleIdToBody } = await import('../../utils/roleHelper');
        await addRoleIdToBody(body);
      } catch (e) {
        console.warn('⚠️ PurchaseScreen: Failed to add role ID:', e);
      }

      console.log('🔍 PurchaseScreen: Final body being sent to API:', {
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        partyId: body.partyId,
        customer_id: body.customer_id,
      });

      // Debug: print full submit payload and calculations
      console.log('🧾 PURCHASE_SUBMIT_DEBUG', {
        status,
        purchaseDate,
        supplier: supplierNameToUse,
        supplierId: supplierIdToUse,
        partyPhone: supplierPhone,
        partyAddress: supplierAddress,
        subTotal,
        gstPct,
        discountAmount,
        taxAmount,
        totalAmount,
        itemCount: simpleItemPayload.length,
        items: simpleItemPayload,
        rawBody: body,
      });

      // Debug: Log items being sent
      console.log('📦 Items being sent to API:', {
        totalItems: items.length,
        validItems: validItemsForCalc.length,
        filteredItems: simpleItemPayload,
      });

      // Additional debugging for supplier data
      console.log('🔍 PurchaseScreen: Supplier data debugging:', {
        supplier: supplier,
        supplierNameToUse: supplierNameToUse,
        supplierId: supplierId,
        supplierIdToUse: supplierIdToUse,
        supplierPhone: supplierPhone,
        supplierAddress: supplierAddress,
        editingItem: editingItem
          ? {
              id: editingItem.id,
              partyName: editingItem.partyName,
              partyPhone: editingItem.partyPhone,
              partyAddress: editingItem.partyAddress,
            }
          : null,
      });

      // Clean the body object to only include fields that exist in backend schema
      // Matching AddNewEntryScreen and AddPartyScreen field structure
      const cleanBody = {
        user_id: body.user_id,
        type: body.type,
        amount: body.amount,
        date: body.date,
        transactionDate: body.transactionDate, // Added for consistency
        purchaseDate: body.purchaseDate, // Added for consistency
        documentDate: body.documentDate, // Add for consistency with AddNewEntryScreen
        // snake_case aliases for date fields
        transaction_date: body.transaction_date,
        purchase_date: body.purchase_date,
        document_date: body.document_date,
        status: body.status,
        notes: body.notes,
        description: '',
        method: body.method, // Match AddPartyScreen
        partyId: body.partyId,
        customer_id: (body as any).customer_id,
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        gstNumber: body.gstNumber, // Match AddPartyScreen
        items: body.items,
        transactionItems: (body as any).transactionItems,
        voucherItems: (body as any).voucherItems,
        gstPct: body.gstPct,
        discount: body.discount,
        cGST: body.cGST,
        subTotal: body.subTotal,
        totalAmount: body.totalAmount,
        billNumber: body.billNumber, // Include billNumber for backend
        createdBy: body.createdBy,
        updatedBy: body.updatedBy,
        syncYN: body.syncYN, // Include sync field
      };
      let responseData: any = null; // Declare outside if block

      try {
        if (editingItem) {
          // PUT update (backend supports PUT). Send all required and updated fields.
          // Matching AddNewEntryScreen and AddPartyScreen field structure
          const putBody: any = {
            user_id: body.user_id,
            type: body.type,
            date: purchaseDate, // ensure exact selected date is persisted
            documentDate: purchaseDate, // keep as YYYY-MM-DD
            transactionDate: purchaseDate,
            purchaseDate: purchaseDate,
            // snake_case aliases
            transaction_date: purchaseDate,
            document_date: purchaseDate,
            purchase_date: purchaseDate,
            amount: Number(body.amount),
            status: body.status,
            notes: body.notes,
            description: '',
            method: body.method, // Match AddPartyScreen
            partyName: body.partyName,
            partyPhone: body.partyPhone,
            partyAddress: body.partyAddress,
            gstNumber: body.gstNumber, // Match AddPartyScreen
            // Customer ID is required by backend
            customerId: supplierIdToUse,
            customer_id: supplierIdToUse,
            // Items and financial fields - send array-of-arrays and mirrors (align with Sell)
            billNumber: finalPurchaseNumber || editingItem.billNumber || '', // Include billNumber for updates
            items:
              simpleItemPayload.length > 0
                ? simpleItemPayload.map(it => [
                    (it as any).name,
                    Number((it as any).quantity) || 0,
                    Number((it as any).rate) || 0,
                    Number((it as any).amount) || 0,
                    Number((it as any).gstPct) || 0,
                  ])
                : Array.isArray((body as any).items)
                ? (body as any).items
                : [],
            transactionItems:
              simpleItemPayload.length > 0 ? simpleItemPayload : [],
            voucherItems: simpleItemPayload.length > 0 ? simpleItemPayload : [],
            lineItems: simpleItemPayload.length > 0 ? simpleItemPayload : [],
            line_items: simpleItemPayload.length > 0 ? simpleItemPayload : [],
            items_text: JSON.stringify(itemsForText),
            transaction_items_json: JSON.stringify(itemsForText),
            voucher_items_json: JSON.stringify(itemsForText),
            itemsString: JSON.stringify(simpleItemPayload),
            transactionItemsString: JSON.stringify(simpleItemPayload),
            voucherItemsString: JSON.stringify(simpleItemPayload),
            itemsRawJson: JSON.stringify(simpleItemPayload),
            gstPct: body.gstPct,
            discount: body.discount,
            cGST: body.cGST,
            subTotal: body.subTotal,
            totalAmount: body.totalAmount,
            syncYN: body.syncYN, // Include sync field
          };

          console.log('🔍 PurchaseScreen: PUT request data:', {
            editingItemId: editingItem.id,
            formValues: {
              supplier: supplier,
              supplierAddress: supplierAddress,
              supplierPhone: supplierPhone,
              purchaseDate: purchaseDate,
              itemsCount: simpleItemPayload.length,
            },
            bodyValues: {
              partyName: body.partyName,
              partyAddress: body.partyAddress,
              partyPhone: body.partyPhone,
            },
            itemsPayload: {
              count: simpleItemPayload.length,
              sample: simpleItemPayload.slice(0, 2),
              allItems: simpleItemPayload,
            },
            putBody: putBody,
            putBodyJSON: JSON.stringify(putBody, null, 2),
            originalEditingItem: {
              partyName: editingItem.partyName,
              partyAddress: editingItem.partyAddress,
              partyPhone: editingItem.partyPhone,
              itemsCount: Array.isArray(editingItem.items)
                ? editingItem.items.length
                : 0,
            },
          });

          console.log(
            '🔍 PurchaseScreen: Sending PUT request to:',
            `transactions/${editingItem.id}`,
          );
          console.log(
            '🔍 PurchaseScreen: PUT request body:',
            JSON.stringify(putBody, null, 2),
          );

          // Use unified API for update
          const rawResponse = await unifiedApi.updateTransaction(
            editingItem.id,
            putBody,
          );

          console.log('🔍 PurchaseScreen: PUT response received');

          // Parse response and validate it has updated data
          console.log(
            '🔍 PurchaseScreen: PUT raw response:',
            JSON.stringify(rawResponse, null, 2),
          );

          // Backend returns the transaction directly, not wrapped in {data: ...}
          responseData = (rawResponse as any)?.data || rawResponse;

          console.log(
            '🔍 PurchaseScreen: Parsed responseData:',
            JSON.stringify(responseData, null, 2),
          );

          // Validate the response contains our updated data
          if (responseData) {
            console.log('🔍 PurchaseScreen: Response validation:', {
              hasPartyName: !!responseData.partyName,
              hasPartyPhone: !!responseData.partyPhone,
              hasPartyAddress: !!responseData.partyAddress,
              responsePartyName: responseData.partyName,
              responsePartyPhone: responseData.partyPhone,
              responsePartyAddress: responseData.partyAddress,
              formPartyName: supplier,
              formPartyPhone: supplierPhone,
              formPartyAddress: supplierAddress,
            });
          }
        } else {
          // POST create: build transaction body like Sell
          const transBody: any = {
            ...cleanBody,
            items: simpleItemPayload.map(it => [
              (it as any).name,
              Number((it as any).quantity) || 0,
              Number((it as any).rate) || 0,
              Number((it as any).amount) || 0,
              Number((it as any).gstPct) || 0,
            ]),
            lineItems: simpleItemPayload,
            line_items: simpleItemPayload,
            items_text: JSON.stringify(itemsForText),
            transaction_items_json: JSON.stringify(itemsForText),
            voucher_items_json: JSON.stringify(itemsForText),
            itemsString: JSON.stringify(simpleItemPayload),
            transactionItemsString: JSON.stringify(simpleItemPayload),
            voucherItemsString: JSON.stringify(simpleItemPayload),
            itemsRawJson: JSON.stringify(simpleItemPayload),
          };

          // Use unified API for create
          const newVoucher = await unifiedApi.createTransaction(transBody);
          responseData = (newVoucher as any)?.data || newVoucher;
          console.log('✅ PURCHASE_CREATE_RESPONSE', responseData);
          try {
            if (responseData?.id) {
              const cacheKey = `voucherItemsCache:${responseData.id}`;
              const cacheValue = JSON.stringify({
                items: simpleItemPayload,
                gstPct: gstPct,
                date: body.date,
              });
              await AsyncStorage.setItem(cacheKey, cacheValue);
              console.log('💾 PURCHASE_CACHE_SAVED', cacheKey, cacheValue);
            }
          } catch {}
        }
      } catch (error: any) {
        // Import error handler
        const { handleApiError } = require('../../utils/apiErrorHandler');
        const errorInfo = handleApiError(error);

        // Check if it's a transaction limit error
        const errorMessage =
          error?.message || String(error) || 'Unknown error occurred';
        if (
          errorMessage.includes('transaction limit') ||
          errorMessage.includes('limit exceeded') ||
          errorMessage.includes('Internal server error')
        ) {
          // Trigger transaction limit popup
          await forceShowPopup();
          setError(
            'Transaction limit reached. Please upgrade your plan to continue.',
          );
          return;
        }

        // Handle 403 Forbidden errors with user-friendly message
        if (errorInfo.isForbidden) {
          showCustomPopup('Access Denied', errorInfo.message, 'error');
          setError(errorInfo.message);
          return;
        }

        throw new Error(errorInfo.message || 'Failed to save purchase.');
      }

      // Read response once - responseData is already set for both POST and PUT
      const serverResponse = responseData;
      console.log('🔍 PurchaseScreen: Server response:', serverResponse);
      console.log('🔍 PurchaseScreen: Server response data structure:', {
        hasData: !!serverResponse?.data,
        responseKeys: Object.keys(serverResponse || {}),
        isArray: Array.isArray(serverResponse),
        responseType: typeof serverResponse,
      });

      // Silent upsert of item names to Items API (populate suggestions table)
      try {
        const upsertNames = (simpleItemPayload || [])
          .map(it => String((it as any).name || ''))
          .map(s => s.trim())
          .filter(s => s.length > 0);
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

      // Force refresh suppliers to ensure we have latest data
      // This ensures supplier changes in purchases are reflected immediately
      try {
        const refreshedSuppliers = await fetchSuppliersCtx('');
        console.log('✅ Suppliers refreshed:', refreshedSuppliers?.length || 0);
      } catch (err) {
        console.warn('⚠️ Supplier refresh failed:', err);
      }

      // Force refresh purchases by calling the actual fetch function directly
      // Bypass the memoized callback to ensure we get fresh data
      console.log(
        '🔄 PurchaseScreen: Refreshing purchases to show updated data...',
      );

      // Small delay to ensure backend has fully processed the update
      await new Promise(resolve => setTimeout(resolve, 200));

      // Call fetchPurchasesFn directly (not the memoized wrapper) to ensure fresh data
      await fetchPurchasesFn();

      // Remember if this was an update before clearing editingItem
      const wasEdit = !!editingItem;

      // Close the form first
      setEditingItem(null);
      setShowCreateForm(false);
      resetForm();

      // Mark CustomerScreen's cache as stale so it will refetch when focused
      // This ensures other screens pick up the updated data
      try {
        // Dynamically import and invalidate the cache by setting timestamp to 0
        const {
          clearVoucherCache,
          markCacheStale,
        } = require('./CustomerScreen');

        // Clear the cache to force a refetch
        clearVoucherCache();
        console.log('✅ PurchaseScreen: Cleared CustomerScreen voucher cache');

        // Also mark cache as stale for any other related caches
        if (markCacheStale && typeof markCacheStale === 'function') {
          markCacheStale();
          console.log(
            '✅ PurchaseScreen: Marked CustomerScreen cache as stale',
          );
        }
      } catch (err) {
        console.warn('⚠️ Could not clear CustomerScreen cache:', err);
      }

      // Success - no popup needed
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
      setShowModal(true);
    } finally {
      if (status === 'complete') setLoadingSave(false);
      if (status === 'draft') setLoadingDraft(false);
    }
  };

  // Add a helper to reset the form
  const resetForm = async () => {
    setSupplierName('');
    setSupplierPhone('');
    setSupplierAddress('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setBillNumber('');
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);

    // Auto-generate next purchase number
    try {
      // Preview only - don't store until transaction is saved
      const nextPurchaseNumber = await generateNextDocumentNumber(
        'purchase',
        false,
      );
      setPurchaseNumber(nextPurchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      // Generator fallback returns 'PUR-001' for new users
      setPurchaseNumber('PUR-001');
    }

    setNotes('');
    setSupplier('');
    setSupplierId(null);
    setGstPct(18);
    setTaxAmount(0);
    setDiscountAmount(0);
    setTriedSubmit(false);
    setError(null);
    setLoadingSave(false);
    setLoadingDraft(false);
  };

  // In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem && showCreateForm) {
      console.log(
        '🔍 PurchaseScreen: useEffect triggered with editingItem:',
        editingItem,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem keys:',
        Object.keys(editingItem),
      );
      console.log('🔍 PurchaseScreen: editingItem.date:', editingItem.date);
      console.log(
        '🔍 PurchaseScreen: editingItem.transactionDate:',
        editingItem.transactionDate,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.purchaseDate:',
        editingItem.purchaseDate,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.partyName:',
        editingItem.partyName,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.partyPhone:',
        editingItem.partyPhone,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.partyAddress:',
        editingItem.partyAddress,
      );
      // Use the date from editingItem if available, otherwise use today's date
      let isoDate = new Date().toISOString().split('T')[0]; // Default to today

      // Check multiple possible date field names
      const possibleDateFields = [
        'date',
        'transactionDate',
        'purchaseDate',
        'createdAt',
        'created_at',
        'transaction_date',
        'purchase_date',
      ];

      let foundDate = null;
      for (const field of possibleDateFields) {
        console.log(
          `🔍 PurchaseScreen: Checking field '${field}':`,
          editingItem[field],
        );
        if (editingItem[field]) {
          foundDate = editingItem[field];
          console.log(
            `🔍 PurchaseScreen: Found date in field '${field}':`,
            foundDate,
          );
          break;
        }
      }

      if (foundDate) {
        try {
          // Try to parse the date from various possible formats
          const dateValue = new Date(foundDate);
          if (!isNaN(dateValue.getTime())) {
            isoDate = dateValue.toISOString().split('T')[0];
            console.log(
              '🔍 PurchaseScreen: Successfully parsed date:',
              isoDate,
            );
          } else {
            console.log('🔍 PurchaseScreen: Invalid date value:', foundDate);
          }
        } catch (error) {
          console.log(
            '🔍 PurchaseScreen: Error parsing date:',
            foundDate,
            error,
          );
        }
      } else {
        console.log('🔍 PurchaseScreen: No date field found in editingItem');
      }

      console.log(
        '🔍 PurchaseScreen: Setting purchase date to:',
        isoDate,
        'from editingItem.date:',
        editingItem.date,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem object:',
        JSON.stringify(editingItem, null, 2),
      );
      console.log(
        '🔍 PurchaseScreen: Final isoDate before setPurchaseDate:',
        isoDate,
      );

      // Resolve GST%: prefer explicit gstPct, else derive from cGST/subTotal
      let newGstPct: number | undefined =
        typeof editingItem.gstPct === 'number' && !isNaN(editingItem.gstPct)
          ? Number(editingItem.gstPct)
          : undefined;
      if (
        newGstPct === undefined &&
        typeof (editingItem as any).cGST === 'number' &&
        typeof (editingItem as any).subTotal === 'number' &&
        (editingItem as any).subTotal > 0
      ) {
        const pct = Math.round(
          ((editingItem as any).cGST / (editingItem as any).subTotal) * 100,
        );
        if (isFinite(pct)) newGstPct = pct;
      }
      if (newGstPct === undefined) newGstPct = 18;

      // Helper to flatten nested arrays without breaking tuple rows
      const flattenItemsForForm = (items: any): any[] => {
        if (!items) {
          console.log('🔍 flattenItemsForForm: items is null/undefined');
          return [];
        }

        console.log('🔍 flattenItemsForForm: input:', {
          type: typeof items,
          isArray: Array.isArray(items),
          value: items,
        });

        // If items is a JSON string (common for TEXT columns), parse and recurse
        if (typeof items === 'string') {
          try {
            const parsed = JSON.parse(items);
            console.log('🔍 flattenItemsForForm: parsed string:', parsed);
            return flattenItemsForForm(parsed);
          } catch (e) {
            console.error('🔍 flattenItemsForForm: JSON parse error:', e);
            return [];
          }
        }

        if (!Array.isArray(items)) {
          console.log('🔍 flattenItemsForForm: not an array');
          return [];
        }

        // Check if it's a nested array like [[...]] (tuple format)
        if (items.length === 1 && Array.isArray(items[0])) {
          const unwrapped = items[0];
          console.log('🔍 flattenItemsForForm: unwrapped tuple:', unwrapped);

          // Check if unwrapped is itself a tuple [name, qty, rate, amount, gstPct]
          // If it has length >= 2 and first element is not an array, it's a tuple row
          if (
            unwrapped.length >= 2 &&
            !Array.isArray(unwrapped[0]) &&
            typeof unwrapped[0] === 'string'
          ) {
            // This is a single tuple row like ["Mobile", 101, 22, 2333.1, 5]
            // Return it wrapped in an array: [[...]]
            console.log('🔍 flattenItemsForForm: returning tuple row:', [
              unwrapped,
            ]);
            return [unwrapped];
          }

          // Only unwrap if it's extra-wrapped like [[[row1],[row2]]]
          // If unwrapped contains multiple tuples
          if (Array.isArray(unwrapped[0]) && Array.isArray(unwrapped[0][0])) {
            console.log(
              '🔍 flattenItemsForForm: extra-wrapped, returning unwrapped:',
              unwrapped,
            );
            return unwrapped.filter((it: any) => {
              if (Array.isArray(it) && it.length === 0) return false;
              if (
                !it ||
                (typeof it === 'object' && Object.keys(it).length === 0)
              )
                return false;
              return true;
            });
          }

          // Unwrapped is a single tuple or array of tuples - return as is
          console.log(
            '🔍 flattenItemsForForm: returning unwrapped as is:',
            unwrapped,
          );
          return [unwrapped];
        }

        // Filter out empty arrays and invalid items
        const filtered = items.filter((it: any) => {
          if (Array.isArray(it) && it.length === 0) return false;
          if (!it || (typeof it === 'object' && Object.keys(it).length === 0))
            return false;
          return true;
        });

        console.log(
          '🔍 flattenItemsForForm: returning filtered items:',
          filtered,
        );
        return filtered;
      };

      // Map backend items (support multiple possible fields) into local state shape
      let sourceItems: any[] = flattenItemsForForm(editingItem.items);

      // If no items in main field, try alternatives
      if (!sourceItems || sourceItems.length === 0) {
        sourceItems = flattenItemsForForm(
          (editingItem as any).transactionItems,
        );
      }

      if (!sourceItems || sourceItems.length === 0) {
        sourceItems = flattenItemsForForm((editingItem as any).voucherItems);
      }
      // Try JSON string mirrors often used by TEXT columns
      if (!sourceItems || sourceItems.length === 0) {
        const tryJson = (val: any): any[] => {
          try {
            if (typeof val === 'string' && val.trim()) {
              const parsed = JSON.parse(val);
              return flattenItemsForForm(parsed);
            }
          } catch {}
          return [];
        };
        const fromItemsJson = tryJson((editingItem as any).itemsJson);
        const fromTxJson = tryJson((editingItem as any).transactionItemsJson);
        const fromVJson = tryJson((editingItem as any).voucherItemsJson);
        sourceItems =
          (fromItemsJson && fromItemsJson.length > 0 && fromItemsJson) ||
          (fromTxJson && fromTxJson.length > 0 && fromTxJson) ||
          (fromVJson && fromVJson.length > 0 && fromVJson) ||
          sourceItems;
      }

      // Final fallback: if raw items looks like a tuple string (e.g., "[[\"name\", 1, 10, 11.2, 12]]"), parse directly
      if (!sourceItems || sourceItems.length === 0) {
        try {
          const raw =
            (editingItem as any).items ?? (editingItem as any)._raw?.items;
          if (typeof raw === 'string' && /\[\s*\[.*\]\s*\]/.test(raw)) {
            console.log('🔧 PurchaseScreen: parsing tuple string items');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              sourceItems = flattenItemsForForm(parsed);
            }
          }
        } catch {}
      }

      let mappedItems: PurchaseItem[] = [];
      if (sourceItems && sourceItems.length > 0) {
        // If sourceItems is a tuple row like [[name, qty, rate, amount, gstPct]]
        // keep it as a single row; otherwise map objects directly
        const rows: any[] = Array.isArray(sourceItems[0])
          ? (sourceItems as any[])
          : (sourceItems as any[]);
        mappedItems = rows.map((it: any, index: number) => {
          if (Array.isArray(it)) {
            const nameCandidate = it[0];
            const qtyNum = Number(it[1]) || 0;
            const rateNum = Number(it[2]) || 0;
            const amtNum =
              it.length > 3 && it[3] != null && !isNaN(Number(it[3]))
                ? Number(it[3])
                : qtyNum * rateNum * (1 + ((newGstPct as number) || 0) / 100);
            return {
              id: (index + 1).toString(),
              description:
                typeof nameCandidate === 'string'
                  ? nameCandidate
                  : `Item ${index + 1}`,
              quantity: qtyNum > 0 ? qtyNum : 1,
              rate: rateNum > 0 ? rateNum : 0,
              amount: isNaN(amtNum) ? 0 : amtNum,
            };
          }
          const qty =
            it?.qty != null ? Number(it.qty) : Number(it?.quantity) || 1;
          const rate = it?.rate != null ? Number(it.rate) : 0;
          const amount =
            it?.amount != null
              ? Number(it.amount)
              : (qty || 0) *
                (rate || 0) *
                (1 + ((newGstPct as number) || 0) / 100);
          return {
            id: (index + 1).toString(),
            description: it?.description || it?.name || it?.itemName || '',
            quantity: isNaN(qty) ? 1 : qty,
            rate: isNaN(rate) ? 0 : rate,
            amount: isNaN(amount) ? 0 : amount,
          };
        });
      } else {
        // No line items returned: synthesize one item from amounts if available
        const stRaw = (editingItem as any).subTotal;
        const taRaw = (editingItem as any).totalAmount;
        const st =
          typeof stRaw === 'string' ? Number(stRaw) : Number(stRaw) || 0;
        const ta =
          typeof taRaw === 'string' ? Number(taRaw) : Number(taRaw) || 0;
        const g = typeof newGstPct === 'number' ? newGstPct : 0;
        if (st > 0 || ta > 0) {
          const base = st > 0 ? st : ta > 0 ? ta / (1 + g / 100) : 0;
          const amount = base * (1 + g / 100);
          mappedItems = [
            {
              id: '1',
              description:
                (editingItem as any).description ||
                (editingItem as any).partyName ||
                'Item 1',
              quantity: 1,
              rate: base,
              amount: amount,
            },
          ];
        } else {
          mappedItems = [
            { id: '1', description: '', quantity: 1, rate: 0, amount: 0 },
          ];
        }
      }

      // Try multiple possible fields for supplier name with fallback logic
      const supplierName =
        editingItem.partyName ||
        editingItem.customerName ||
        editingItem.supplierName ||
        editingItem.party_name ||
        editingItem.customer_name ||
        editingItem.supplier_name ||
        '';

      console.log('🔍 PurchaseScreen: Setting supplier to:', supplierName);
      console.log(
        '🔍 PurchaseScreen: editingItem.partyName:',
        editingItem.partyName,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.customerName:',
        editingItem.customerName,
      );
      console.log(
        '🔍 PurchaseScreen: editingItem.supplierName:',
        editingItem.supplierName,
      );
      console.log(
        '🔍 PurchaseScreen: EditingItem object:',
        JSON.stringify(editingItem, null, 2),
      );
      console.log('🔍 PurchaseScreen: Final supplier name used:', supplierName);
      setSupplier(supplierName);
      setSupplierId(
        typeof editingItem.partyId === 'number'
          ? editingItem.partyId
          : Number(
              (editingItem as any)?.customer_id ||
                (editingItem as any)?.customerId,
            ) || null,
      );
      // Try multiple possible fields for phone with fallback logic
      let supplierPhone =
        editingItem.partyPhone ||
        editingItem.phone ||
        editingItem.phoneNumber ||
        editingItem.party_phone ||
        editingItem.phone_number ||
        '';

      // Remove "+91-" prefix if present
      supplierPhone = supplierPhone.replace(/^\+?91-?/, '');
      // Remove non-digits and take last 10 digits
      supplierPhone = supplierPhone.replace(/\D/g, '').slice(-10);

      setSupplierPhone(supplierPhone);
      console.log(
        '🔍 PurchaseScreen: Setting supplierPhone to:',
        supplierPhone,
      );

      // Try multiple possible fields for address with fallback logic
      const supplierAddress =
        editingItem.partyAddress ||
        editingItem.address ||
        editingItem.addressLine1 ||
        editingItem.party_address ||
        editingItem.address_line1 ||
        '';

      setSupplierAddress(supplierAddress);
      console.log(
        '🔍 PurchaseScreen: Setting supplierAddress to:',
        supplierAddress,
      );

      // Debug: Check if the values are actually being set
      console.log('🔍 PurchaseScreen: Form field values after setting:', {
        supplier: supplierName,
        supplierPhone: supplierPhone,
        supplierAddress: supplierAddress,
        editingItemKeys: Object.keys(editingItem),
        editingItemPartyName: editingItem.partyName,
        editingItemPartyPhone: editingItem.partyPhone,
        editingItemPartyAddress: editingItem.partyAddress,
      });
      console.log('🔍 PurchaseScreen: Current supplier state:', supplier);
      console.log(
        '🔍 PurchaseScreen: Current supplierAddress state:',
        supplierAddress,
      );
      console.log(
        '🔍 PurchaseScreen: Current supplierPhone state:',
        supplierPhone,
      );
      console.log('🔍 PurchaseScreen: All field values being set:', {
        supplier: supplierName,
        supplierPhone: supplierPhone,
        supplierAddress: supplierAddress,
        purchaseDate: isoDate,
      });
      setPurchaseDate(isoDate);
      console.log('🔍 PurchaseScreen: setPurchaseDate called with:', isoDate);
      console.log(
        '🔍 PurchaseScreen: Current purchaseDate state after setPurchaseDate:',
        purchaseDate,
      );
      setBillNumber(editingItem.billNumber || '');
      setItems(mappedItems);
      setNotes(editingItem.notes || '');
      setGstPct(newGstPct);
      // Tax Amount should show ONLY GST amount, not other taxes
      const subtotal = calculateSubtotal();
      const gstAmount = subtotal * (newGstPct / 100);
      setTaxAmount(gstAmount);
      setDiscountAmount(Number(editingItem.discount) || 0);
      setPurchaseNumber(
        editingItem.purchaseNumber || editingItem.billNumber || 'PUR-001',
      );
    } else if (!editingItem && showCreateForm) {
      // If not editing, reset to default
      setSupplierName('');
      setSupplierPhone('');
      setSupplierAddress('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setBillNumber('');
      setItems([
        {
          id: '1',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      setNotes('');
      setSupplier('');
      setGstPct(18);
      setTaxAmount(0);
      setDiscountAmount(0);
    }
  }, [editingItem, showCreateForm]);

  // Debug: Log when purchaseDate changes
  useEffect(() => {
    console.log(
      '🔍 PurchaseScreen: purchaseDate state changed to:',
      purchaseDate,
    );
  }, [purchaseDate]);

  // Debug: Log when supplier changes
  useEffect(() => {
    console.log('🔍 PurchaseScreen: supplier state changed to:', supplier);
    console.log('🔍 PurchaseScreen: supplier state type:', typeof supplier);
    console.log('🔍 PurchaseScreen: supplier state length:', supplier?.length);
    console.log(
      '🔍 PurchaseScreen: supplier state change triggered by editingItem:',
      editingItem?.id,
    );
  }, [supplier]);

  // Debug: Log when editingItem changes
  useEffect(() => {
    console.log('🔍 PurchaseScreen: editingItem changed:', editingItem);
    console.log(
      '🔍 PurchaseScreen: editingItem.partyName:',
      editingItem?.partyName,
    );
    console.log(
      '🔍 PurchaseScreen: editingItem.customerName:',
      editingItem?.customerName,
    );
    console.log(
      '🔍 PurchaseScreen: editingItem.supplierName:',
      editingItem?.supplierName,
    );
  }, [editingItem]);

  // Debug: Log when form is shown
  useEffect(() => {
    if (showCreateForm) {
      console.log('🔍 PurchaseScreen: Form is shown with values:', {
        supplier,
        supplierPhone,
        supplierAddress,
        purchaseDate,
        editingItem: editingItem?.id,
      });
    }
  }, [
    showCreateForm,
    supplier,
    supplierPhone,
    supplierAddress,
    purchaseDate,
    editingItem,
  ]);

  // Debug: Log when supplierAddress changes
  useEffect(() => {
    console.log(
      '🔍 PurchaseScreen: supplierAddress state changed to:',
      supplierAddress,
    );
    console.log(
      '🔍 PurchaseScreen: supplierAddress state type:',
      typeof supplierAddress,
    );
    console.log(
      '🔍 PurchaseScreen: supplierAddress state length:',
      supplierAddress?.length,
    );
    console.log(
      '🔍 PurchaseScreen: supplierAddress state change triggered by editingItem:',
      editingItem?.id,
    );
  }, [supplierAddress]);

  // Debug: Log when supplierPhone changes
  useEffect(() => {
    console.log(
      '🔍 PurchaseScreen: supplierPhone state changed to:',
      supplierPhone,
    );
    console.log(
      '🔍 PurchaseScreen: supplierPhone state change triggered by editingItem:',
      editingItem?.id,
    );
  }, [supplierPhone]);

  // Update taxAmount when items or GST percentage changes
  // Use refs to track previous values to calculate difference
  const prevGstAmountRef = useRef(0);
  const prevSubtotalRef = useRef(0);
  useEffect(() => {
    if (items.length > 0 && showCreateForm) {
      const subtotal = calculateSubtotal();
      const newGstAmount = subtotal * (gstPct / 100);
      // Calculate old GST amount based on previous subtotal
      const oldGstAmount = prevSubtotalRef.current * (gstPct / 100);
      const gstDifference = newGstAmount - oldGstAmount;

      setTaxAmount(prev => {
        // If taxAmount is 0 or very close to old GST, set it to new GST
        if (prev === 0 || Math.abs(prev - oldGstAmount) < 0.01) {
          prevGstAmountRef.current = newGstAmount;
          prevSubtotalRef.current = subtotal;
          return newGstAmount;
        }
        // Otherwise, adjust by the difference in GST
        prevGstAmountRef.current = newGstAmount;
        prevSubtotalRef.current = subtotal;
        return prev + gstDifference;
      });
    }
  }, [items, gstPct, showCreateForm]);

  // Update filtered purchases after all functions are defined
  const enhancedFilteredPurchases = getFilteredPurchases();

  // Calculate filter badge count
  useEffect(() => {
    let count = 0;
    if (searchFilter.amountMin !== undefined) count++;
    if (searchFilter.amountMax !== undefined) count++;
    if (searchFilter.dateFrom) count++;
    if (searchFilter.dateTo) count++;
    if (searchFilter.paymentMethod) count++;
    if (searchFilter.status) count++;
    if (searchFilter.reference) count++;
    if (searchFilter.description) count++;
    setFilterBadgeCount(count);
  }, [searchFilter]);

  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  if (showCreateForm) {
    // Show loading indicator only when fetching details for edit
    const isLoadingEditData = isFetchingEdit;

    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <StableStatusBar
          backgroundColor="#4f8cff"
          barStyle="light-content"
          translucent={false}
          animated={true}
        />
        {/* Header */}
        <View
          style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
        >
          <View style={{ height: HEADER_CONTENT_HEIGHT }} />
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={25}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isLoadingEditData
                ? `Loading...`
                : editingItem
                ? `Edit ${folderName}`
                : `Create ${folderName}`}
            </Text>
          </View>
        </View>
        {isLoadingEditData ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 100,
            }}
          >
            <ActivityIndicator size="large" color="#4f8cff" />
            <Text style={{ marginTop: 16, color: '#666', fontSize: 16 }}>
              Loading purchase details...
            </Text>
          </View>
        ) : (
          <KeyboardAwareScrollView
            ref={scrollRef}
            style={styles.container}
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={120}
            enableAutomaticScroll
            enableResetScrollToCoords={false}
            keyboardOpeningTime={0}
          >
            {/* Show last voice response above Purchase Details */}
            {lastVoiceText && (
              <View
                style={{
                  backgroundColor: '#f0f6ff',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#b3d1ff',
                }}
              >
                <Text
                  style={{
                    color: '#333333',
                    fontSize: 15,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  <Text
                    style={{ color: '#4f8cff', fontFamily: 'Roboto-Medium' }}
                  >
                    Voice Response:
                  </Text>
                  {lastVoiceText}
                </Text>
              </View>
            )}
            {voiceLoading && (
              <ActivityIndicator
                size="small"
                color="#333333"
                style={{ marginTop: 8 }}
              />
            )}
            {voiceError ? (
              <Text
                style={{
                  color: 'red',
                  marginTop: 8,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {voiceError}
              </Text>
            ) : null}
            {nlpStatus && !voiceError ? (
              <Text
                style={{
                  color: '#666666',
                  marginTop: 8,
                  fontSize: 12,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {nlpStatus}
              </Text>
            ) : null}

            {/* OCR Loading and Error States */}
            {ocrLoading && (
              <View
                style={{
                  backgroundColor: '#fff3cd',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#ffeaa7',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator
                  size="small"
                  color="#856404"
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={{
                    color: '#856404',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Processing document with OCR...
                </Text>
              </View>
            )}
            {ocrError && (
              <View
                style={{
                  backgroundColor: '#f8d7da',
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#f5c6cb',
                }}
              >
                <Text
                  style={{
                    color: '#721c24',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  <Text style={{ fontFamily: 'Roboto-Medium' }}>
                    OCR Error:{' '}
                  </Text>
                  {ocrError}
                </Text>
              </View>
            )}

            {/* Purchase Details Card */}
            <View style={[styles.card, { marginTop: 0 }]}>
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>
                    {folderName} Date{' '}
                    <Text style={{ color: '#d32f2f' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      console.log(
                        '🔍 PurchaseScreen: Rendering date field with value:',
                        purchaseDate,
                      );
                      setShowDatePicker(true);
                    }}
                  >
                    <TextInput
                      ref={purchaseDateRef}
                      style={[
                        styles.input,
                        triedSubmit &&
                          !purchaseDate && { borderColor: '#d32f2f' },
                      ]}
                      value={purchaseDate}
                      editable={false}
                      pointerEvents="none"
                      key={`purchase-date-${purchaseDate}`}
                      onChangeText={text => {
                        console.log(
                          '🔍 PurchaseScreen: Date field onChangeText called with:',
                          text,
                        );
                      }}
                      onFocus={() => {
                        if (scrollRef.current && purchaseDateRef.current) {
                          scrollRef.current.scrollToFocusedInput(
                            purchaseDateRef.current,
                            120,
                          );
                        }
                      }}
                    />
                  </TouchableOpacity>
                  {triedSubmit && !purchaseDate ? (
                    <Text style={styles.errorTextField}>Date is required.</Text>
                  ) : null}
                  {showDatePicker ? (
                    <DateTimePicker
                      value={parseDateLocal(purchaseDate)}
                      mode="date"
                      display="default"
                      onChange={(event: unknown, date?: Date | undefined) => {
                        setShowDatePicker(false);
                        if (date) {
                          // Use formatDateLocal to avoid timezone conversion issues
                          setPurchaseDate(formatDateLocal(date));
                        }
                      }}
                    />
                  ) : null}
                </View>
              </View>
              {/* Supplier Field */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  {folderName} Supplier{' '}
                  <Text style={{ color: '#d32f2f' }}>*</Text>
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor:
                      triedSubmit && getFieldError('supplier')
                        ? '#d32f2f'
                        : '#e0e0e0',
                    borderRadius: 8,
                    backgroundColor: '#f9f9f9',
                    zIndex: 999999999,
                  }}
                  ref={supplierInputRef as any}
                >
                  <SupplierSelector
                    key={`supplier-${editingItem?.id || 'new'}`}
                    value={supplier}
                    onChange={(name, supplierObj) => {
                      console.log(
                        '🔍 PurchaseScreen: SupplierSelector value prop:',
                        supplier,
                      );
                      console.log(
                        '🔍 PurchaseScreen: SupplierSelector rendering with supplier:',
                        supplier,
                      );
                      console.log(
                        '🔍 PurchaseScreen: SupplierSelector value type:',
                        typeof supplier,
                      );
                      console.log(
                        '🔍 PurchaseScreen: SupplierSelector value length:',
                        supplier?.length,
                      );
                      console.log(
                        '🔍 PurchaseScreen: SupplierSelector onChange called with:',
                        name,
                        supplierObj,
                      );
                      console.log(
                        '🔍 PurchaseScreen: Current supplier value:',
                        supplier,
                      );
                      // Always update text value
                      setSupplier(name);

                      // If a supplier object is provided from dropdown selection, populate fields
                      if (supplierObj) {
                        const phoneValue =
                          (supplierObj as any).phoneNumber ||
                          (supplierObj as any).phone ||
                          (supplierObj as any).phone_number ||
                          '';
                        const addressValue =
                          (supplierObj as any).address ||
                          (supplierObj as any).addressLine1 ||
                          (supplierObj as any).address_line1 ||
                          (supplierObj as any).address1 ||
                          '';
                        setSupplierPhone(String(phoneValue));
                        setSupplierAddress(String(addressValue));
                        setSelectedSupplier(supplierObj as any);
                        setSupplierId(Number((supplierObj as any)?.id) || null);
                      } else {
                        // If user types a different name than selected supplier, clear dependent fields
                        if (
                          selectedSupplier &&
                          name.trim().toLowerCase() !==
                            (
                              selectedSupplier.name ||
                              selectedSupplier.partyName ||
                              ''
                            )
                              .trim()
                              .toLowerCase()
                        ) {
                          setSelectedSupplier(null);
                          setSupplierPhone('');
                          setSupplierAddress('');
                          setSupplierId(null);
                        }
                      }
                    }}
                    placeholder="Type or search supplier"
                    onSupplierSelect={supplierObj => {
                      console.log(
                        '🔍 PurchaseScreen: onSupplierSelect called with:',
                        supplierObj,
                      );
                      console.log(
                        '🔍 PurchaseScreen: Setting supplier to:',
                        supplierObj.name || (supplierObj as any).partyName,
                      );
                      console.log(
                        '🔍 PurchaseScreen: Setting supplierPhone to:',
                        supplierObj.phoneNumber,
                      );
                      console.log(
                        '🔍 PurchaseScreen: Setting supplierAddress to:',
                        supplierObj.address,
                      );
                      const selectedName =
                        supplierObj.name ||
                        (supplierObj as any).partyName ||
                        '';
                      setSupplier(selectedName);
                      setSupplierId(Number((supplierObj as any)?.id) || null);
                      const phoneValue =
                        (supplierObj as any).phoneNumber ||
                        (supplierObj as any).phone ||
                        (supplierObj as any).phone_number ||
                        '';
                      const addressValue =
                        (supplierObj as any).address ||
                        (supplierObj as any).addressLine1 ||
                        (supplierObj as any).address_line1 ||
                        (supplierObj as any).address1 ||
                        '';
                      setSupplierPhone(String(phoneValue));
                      setSupplierAddress(String(addressValue));
                      setSelectedSupplier(supplierObj as any);
                    }}
                  />
                </View>
                {triedSubmit && !supplier ? (
                  <Text style={styles.errorTextField}>
                    Supplier is required.
                  </Text>
                ) : null}
              </View>
              {/* Phone Field */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Phone <Text style={{ color: '#d32f2f' }}>*</Text>
                </Text>
                <TextInput
                  ref={supplierPhoneRef}
                  style={[
                    styles.input,
                    { color: '#333333' },
                    triedSubmit &&
                      getFieldError('supplierPhone') && {
                        borderColor: 'red',
                      },
                  ]}
                  value={supplierPhone}
                  onChangeText={text => {
                    // Only keep digits and limit to 10
                    const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
                    console.log(
                      '🔍 PurchaseScreen: Phone field onChangeText - input:',
                      text,
                      'filtered:',
                      digitsOnly,
                    );
                    setSupplierPhone(digitsOnly);
                  }}
                  placeholder="9876543210"
                  placeholderTextColor="#666666"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                {getFieldError('supplierPhone') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('supplierPhone')}
                  </Text>
                ) : null}
              </View>
              {/* Address Field */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>
                  Address <Text style={{ color: '#d32f2f' }}>*</Text>
                </Text>
                <TextInput
                  ref={supplierAddressRef}
                  style={[
                    styles.input,
                    {
                      minHeight: 60,
                      textAlignVertical: 'top',
                      color: '#333333',
                    },
                    triedSubmit &&
                      getFieldError('supplierAddress') && {
                        borderColor: '#d32f2f',
                      },
                  ]}
                  value={supplierAddress}
                  onChangeText={text => {
                    console.log(
                      '🔍 PurchaseScreen: Address field value prop:',
                      supplierAddress,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Address field rendering with supplierAddress:',
                      supplierAddress,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Address field value type:',
                      typeof supplierAddress,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Address field value length:',
                      supplierAddress?.length,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Address field onChangeText called with:',
                      text,
                    );
                    console.log(
                      '🔍 PurchaseScreen: Current supplierAddress value:',
                      supplierAddress,
                    );
                    setSupplierAddress(text);
                  }}
                  placeholder="Supplier address"
                  placeholderTextColor="#666666"
                  multiline
                />
                {getFieldError('supplierAddress') ? (
                  <Text style={styles.errorTextField}>
                    {getFieldError('supplierAddress')}
                  </Text>
                ) : null}
              </View>
              {/* GST Field */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.inputLabel}>GST (%)</Text>
                <TouchableOpacity
                  style={styles.pickerInput}
                  onPress={() => setShowGstModal(true)}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="percent"
                      size={20}
                      color="#666666"
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.pickerText,
                        gstPct === undefined ? styles.placeholderText : {},
                      ]}
                    >
                      {gstPct !== undefined
                        ? `${gstPct}% GST`
                        : 'Select GST percentage'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </View>
            {/* Items Section */}
            <View style={styles.itemsSection}>
              <View style={styles.itemsHeader}>
                <Text style={styles.itemsTitle}>Items</Text>
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={addItem}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                  <Text style={styles.addItemText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, index) => (
                <View key={item.id} style={styles.itemRow}>
                  {index > 0 && <View style={styles.itemDivider} />}
                  <View style={styles.itemRowHeader}>
                    <View style={styles.itemIndexContainer}>
                      <Text style={styles.itemIndex}>{index + 1}</Text>
                    </View>
                    {items.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(item.id)}>
                        <MaterialCommunityIcons
                          name="delete"
                          size={20}
                          color="#dc3545"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.itemDescriptionContainer}>
                      <Text style={styles.itemFieldLabel}>Description</Text>
                      <TextInput
                        ref={ref => {
                          if (!itemRefs.current) itemRefs.current = {};
                          if (!itemRefs.current[item?.id || ''])
                            itemRefs.current[item?.id || ''] = {};
                          itemRefs.current[item?.id || '']['description'] =
                            ref || null;
                        }}
                        style={[
                          styles.itemDescriptionInput,
                          triedSubmit &&
                            (!item?.description ||
                              !String(item?.description).trim()) && {
                              borderColor: '#d32f2f',
                            },
                        ]}
                        placeholder="Item description"
                        value={item?.description || ''}
                        onChangeText={text =>
                          updateItem(item.id, 'description', text)
                        }
                        placeholderTextColor="#666666"
                        onFocus={() => {
                          setShowGstModal(false);
                          setFocusedItemId(item.id);
                        }}
                        onBlur={() => {
                          setFocusedItemId(prev =>
                            prev === item.id ? null : prev,
                          );
                        }}
                      />
                      <ItemNameSuggestions
                        query={item?.description || ''}
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
                    </View>
                    <View style={styles.itemDetailsRow}>
                      <View style={styles.itemDetailColumn}>
                        <Text style={styles.itemFieldLabel}>Quantity</Text>
                        <TextInput
                          ref={ref => {
                            if (!itemRefs.current) itemRefs.current = {};
                            if (!itemRefs.current[item?.id || ''])
                              itemRefs.current[item?.id || ''] = {};
                            itemRefs.current[item?.id || '']['quantity'] =
                              ref || null;
                          }}
                          style={[
                            styles.itemQuantityInput,
                            triedSubmit &&
                              !(Number(item?.quantity) > 0) && {
                                borderColor: '#d32f2f',
                              },
                          ]}
                          placeholder="Qty"
                          value={item?.quantity ? String(item.quantity) : ''}
                          onChangeText={text =>
                            updateItem(
                              item.id,
                              'quantity',
                              parseFloat(text) || 0,
                            )
                          }
                          placeholderTextColor="#666666"
                          keyboardType="numeric"
                          onFocus={() => {
                            setShowGstModal(false);
                            setFocusedItemId(null);
                          }}
                        />
                      </View>
                      <View style={styles.itemDetailColumn}>
                        <Text style={styles.itemFieldLabel}>Rate</Text>
                        <TextInput
                          ref={ref => {
                            if (!itemRefs.current) itemRefs.current = {};
                            if (!itemRefs.current[item?.id || ''])
                              itemRefs.current[item?.id || ''] = {};
                            itemRefs.current[item?.id || '']['rate'] =
                              ref || null;
                          }}
                          style={[
                            styles.itemQuantityInput,
                            triedSubmit &&
                              !(Number(item?.rate) > 0) && {
                                borderColor: '#d32f2f',
                              },
                          ]}
                          placeholder="Rate"
                          value={item?.rate ? String(item.rate) : ''}
                          onChangeText={text =>
                            updateItem(item.id, 'rate', parseFloat(text) || 0)
                          }
                          placeholderTextColor="#666666"
                          keyboardType="numeric"
                          onFocus={() => {
                            setShowGstModal(false);
                            setFocusedItemId(null);
                          }}
                        />
                      </View>
                    </View>
                    <View style={styles.itemAmountDisplay}>
                      <Text style={styles.itemAmountText}>
                        ₹{(item?.amount || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              {triedSubmit &&
                !(items || []).some(
                  it =>
                    (it?.description || '').toString().trim() &&
                    Number(it?.quantity) > 0 &&
                    Number(it?.rate) > 0,
                ) && (
                  <Text style={[styles.errorTextField, { marginTop: 6 }]}>
                    Please add at least one item with description, quantity, and
                    rate.
                  </Text>
                )}
            </View>

            {/* Amount Details Card */}
            <View style={styles.card}>
              <View style={[styles.rowBetween, { marginBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <MaterialCommunityIcons
                    name="currency-inr"
                    size={22}
                    color="#333"
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        fontSize: scale(22),
                        color: '#333',
                        fontFamily: 'Roboto-Medium',
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Amount Details
                  </Text>
                </View>
              </View>
              <View
                style={{
                  height: 1,
                  backgroundColor: '#e0e0e0',
                  marginVertical: scale(16),
                }}
              />
              <View style={[styles.rowBetween, { gap: scale(16) }]}>
                <View style={[styles.flex1, { maxWidth: '48%' }]}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        marginBottom: scale(8),
                        fontSize: 16,
                        color: '#333333',
                        fontFamily: 'Roboto-Medium',
                      },
                    ]}
                  >
                    Tax Amount
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        paddingVertical: scale(22),
                        fontSize: scale(18),
                        paddingHorizontal: scale(12),
                        backgroundColor: '#f9f9f9',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        fontFamily: 'Roboto-Medium',
                      },
                    ]}
                    value={taxAmount.toString()}
                    onChangeText={text => {
                      const value = parseFloat(text) || 0;
                      setTaxAmount(value);
                      // Tax Amount now includes GST, so no separate GST calculation needed
                    }}
                    placeholderTextColor="#666666"
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.flex1, { maxWidth: '48%' }]}>
                  <Text
                    style={[
                      styles.inputLabel,
                      {
                        marginBottom: scale(8),
                        fontSize: 16,
                        color: '#333333',
                        fontFamily: 'Roboto-Medium',
                      },
                    ]}
                  >
                    Discount Amount
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        paddingVertical: scale(22),
                        fontSize: scale(18),
                        paddingHorizontal: scale(12),
                        backgroundColor: '#f9f9f9',
                        borderColor: '#e0e0e0',
                        borderWidth: 1,
                        fontFamily: 'Roboto-Medium',
                      },
                    ]}
                    value={discountAmount.toString()}
                    onChangeText={text => {
                      const value = parseFloat(text) || 0;
                      setDiscountAmount(value);
                      // Recalculate total with new discount amount
                      const subtotal = calculateSubtotal();
                      const gst = calculateGST();
                      const total = subtotal + gst + taxAmount - value;
                      // Update items with new amounts (without GST - GST added in final total only)
                      const updatedItems = items.map(item => ({
                        ...item,
                        amount: item.quantity * item.rate,
                      }));
                      setItems(updatedItems);
                    }}
                    placeholderTextColor="#666666"
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {/* Summary */}
              <View
                style={{
                  marginTop: scale(24),
                  padding: scale(20),
                  backgroundColor: '#f8f9fa',
                  borderRadius: scale(12),
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: scale(12),
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Subtotal:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    ₹{calculateSubtotal().toFixed(2)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: scale(12),
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    GST:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {gstPct}%
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: scale(12),
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Tax Amount:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    ₹{taxAmount.toFixed(2)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: scale(12),
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Discount:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    -₹{discountAmount.toFixed(2)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: scale(16),
                    paddingTop: scale(16),
                    borderTopWidth: 1,
                    borderTopColor: '#dee2e6',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Total:
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      color: '#333333',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    ₹{calculateTotal().toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
            {/* Notes Card */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Notes</Text>
              <TextInput
                ref={notesRef}
                style={[
                  styles.input,
                  { minHeight: 60, textAlignVertical: 'top' },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes or terms..."
                placeholderTextColor="#666666"
                multiline
                onFocus={() => {
                  if (scrollRef.current && notesRef.current) {
                    scrollRef.current.scrollToFocusedInput(
                      notesRef.current,
                      120,
                    );
                  }
                }}
              />
            </View>
          </KeyboardAwareScrollView>
        )}

        {/* Action Buttons - Only show when not loading */}
        {!isLoadingEditData && (
          <View style={styles.buttonContainer}>
            {editingItem ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.updateButtonEdit}
                  onPress={() => handleSubmit('complete')}
                  disabled={loadingSave}
                >
                  <Text style={styles.submitButtonText}>
                    {loadingSave
                      ? `SAVING ${folderName.toUpperCase()}...`
                      : `UPDATE ${folderName.toUpperCase()}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButtonEdit}
                  onPress={() => deletePurchase(editingItem.id)}
                >
                  <MaterialCommunityIcons
                    name="delete"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.deleteButtonText}>DELETE</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.submitButtonFullWidth}
                onPress={() => handleSubmit('complete')}
                disabled={loadingSave}
              >
                <Text style={styles.submitButtonText}>
                  {loadingSave
                    ? `SAVING ${folderName.toUpperCase()}...`
                    : `SAVE ${folderName.toUpperCase()}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* GST Modal */}
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
            <View style={styles.gstModalContainer}>
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
                  <Text style={styles.gstModalTitle}>
                    Select GST Percentage
                  </Text>
                  <Text style={styles.gstModalSubtitle}>
                    Choose the applicable GST rate
                  </Text>
                </View>
                <View style={{ width: 22 }} />
              </View>

              {/* GST Percentage Options */}
              <ScrollView
                style={styles.gstModalContent}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingVertical: 20,
                  paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
                scrollEnabled={true}
              >
                {GST_OPTIONS.map((percentage, index) => (
                  <TouchableOpacity
                    key={percentage}
                    style={[
                      styles.gstOption,
                      gstPct === percentage && styles.gstOptionSelected,
                      index === GST_OPTIONS.length - 1 && styles.gstOptionLast,
                    ]}
                    onPress={() => {
                      const oldGstPct = gstPct;
                      setGstPct(percentage);
                      // Recalculate all item amounts without GST - GST will be added in final total only
                      const updatedItems = items.map(item => ({
                        ...item,
                        amount: item.quantity * item.rate,
                      }));
                      setItems(updatedItems);
                      // Update taxAmount to include new GST amount
                      const subtotal = calculateSubtotal();
                      const oldGstAmount = subtotal * (oldGstPct / 100);
                      const newGstAmount = subtotal * (percentage / 100);
                      // Adjust taxAmount: remove old GST, add new GST
                      setTaxAmount(prev => prev - oldGstAmount + newGstAmount);
                      setShowGstModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.gstOptionContent}>
                      <View style={styles.gstOptionLeft}>
                        <View
                          style={[
                            styles.gstIcon,
                            gstPct === percentage && styles.gstIconSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="percent"
                            size={22}
                            color={gstPct === percentage ? '#fff' : '#4f8cff'}
                          />
                        </View>
                        <View style={styles.gstTextContainer}>
                          <Text
                            style={[
                              styles.gstOptionText,
                              gstPct === percentage &&
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
                      {gstPct === percentage && (
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

        {/* Enhanced Error/Success Modal */}
        <Modal
          isVisible={showModal}
          animationIn="zoomIn"
          animationOut="zoomOut"
          animationInTiming={300}
          animationOutTiming={300}
          onBackdropPress={() => setShowModal(false)}
          style={{ justifyContent: 'center', margin: 20 }}
          backdropOpacity={0.7}
          useNativeDriver={true}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 32,
              alignItems: 'center',
              maxWidth: 380,
              width: '100%',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 20,
              },
              shadowOpacity: 0.3,
              shadowRadius: 30,
              elevation: 15,
            }}
          >
            {error ? (
              <>
                <View
                  style={{
                    backgroundColor: '#fee',
                    borderRadius: 50,
                    padding: 16,
                    marginBottom: 20,
                    borderWidth: 2,
                    borderColor: '#fcc',
                  }}
                >
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={40}
                    color="#dc3545"
                  />
                </View>
                <Text
                  style={{
                    color: '#dc3545',
                    fontSize: 22,
                    marginBottom: 12,
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Error
                </Text>
                <Text
                  style={{
                    color: '#333',
                    fontSize: 16,
                    marginBottom: 28,
                    textAlign: 'center',
                    lineHeight: 22,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {error}
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#dc3545',
                    paddingVertical: 16,
                    paddingHorizontal: 32,
                    borderRadius: 12,
                    alignItems: 'center',
                    shadowColor: '#dc3545',
                    shadowOffset: {
                      width: 0,
                      height: 4,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                  onPress={() => setShowModal(false)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </Modal>

        {/* File Type Selection Modal */}
        <Modal
          isVisible={showFileTypeModal}
          onBackdropPress={() => setShowFileTypeModal(false)}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            margin: 0,
            padding: 0,
          }}
          backdropOpacity={0.6}
          useNativeDriver={true}
          propagateSwipe={true}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              maxHeight: '90%',
              minHeight: 600,
              width: '90%',
              alignSelf: 'center',
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 10,
              },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  color: '#333333',
                  textAlign: 'center',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Choose File Type
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#666666',
                  textAlign: 'center',
                  lineHeight: 20,
                  marginTop: 8,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Select the type of file you want to upload for OCR processing
              </Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={{
                flex: 1,
                paddingHorizontal: 24,
              }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                paddingVertical: 20,
                paddingBottom: 40,
              }}
              nestedScrollEnabled={true}
              bounces={true}
              alwaysBounceVertical={false}
            >
              {/* File Type Options */}
              <View style={{ marginBottom: 20 }}>
                {/* Image Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('image')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#4f8cff',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="image"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Image
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload {folderName.toLowerCase()} bill images (JPG, PNG)
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#4f8cff"
                  />
                </TouchableOpacity>

                {/* PDF Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('pdf')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#dc3545',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      PDF Document
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload PDF files for OCR processing
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#dc3545"
                  />
                </TouchableOpacity>
              </View>

              {/* Shared Example */}
              <View
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: '#e9ecef',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    marginBottom: 12,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Real {folderName} Bill Example:
                </Text>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#dee2e6',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#333333',
                      marginBottom: 8,
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {folderName} Bill
                  </Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Purchase Date:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        2025-01-15{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Supplier Name:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        ABC Electronics{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Phone:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        9876543210{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Address:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        123 Tech Street, Bangalore
                      </Text>
                    </Text>
                  </View>

                  {/* Table Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#f8f9fa',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 2,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Description
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      GST
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Qty
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Rate
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Amount
                    </Text>
                  </View>

                  {/* Table Rows */}
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Laptop
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        18%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        2
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        45000
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        106200.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Mouse
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        18%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        5
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        500
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        2950.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Keyboard
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        18%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        3
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        1200
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        4248.00
                      </Text>
                    </View>
                  </View>

                  {/* Calculations */}
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Calculations
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#666666',
                        lineHeight: 16,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        SubTotal:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        ₹113,400{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Total GST:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        ₹20,412{'\n'}
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Total:
                      </Text>
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        {' '}
                        ₹133,812
                      </Text>
                    </Text>
                  </View>

                  {/* Notes */}
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#666666',
                        lineHeight: 16,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text style={{ fontFamily: 'Roboto-Medium' }}>
                        Notes:
                      </Text>{' '}
                      Delivery within 3 business days, warranty included for all
                      items.
                    </Text>
                  </View>
                </View>

                {/* Tip */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginTop: 12,
                    backgroundColor: '#fff3cd',
                    borderRadius: 6,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: '#ffeaa7',
                  }}
                >
                  <MaterialCommunityIcons
                    name="lightbulb-outline"
                    size={16}
                    color="#ffc107"
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#856404',
                      marginLeft: 6,
                      flex: 1,
                      lineHeight: 16,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Tip: Clear, well-lit images or text-based PDFs with
                    structured tables work best for OCR
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: '#f0f0f0',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderWidth: 1,
                  borderColor: '#dee2e6',
                  alignItems: 'center',
                }}
                onPress={() => setShowFileTypeModal(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#666666',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main purchase list view
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
      {/* Header */}
      <View
        style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{folderName}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <SearchAndFilter
        value={searchFilter}
        onChange={setSearchFilter}
        onFilterPress={() => setFilterVisible(true)}
        recentSearches={recentSearches}
        onRecentSearchPress={handleRecentSearchPress}
        filterBadgeCount={filterBadgeCount}
        inputTextColor="#333333"
        placeholderTextColor="#666666"
      />

      {/* Purchase List */}
      <View style={styles.listContainer}>
        {loadingApi && (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 40 }}
          />
        )}
        {!loadingApi && apiError && (
          <Text
            style={{
              color: 'red',
              textAlign: 'center',
              marginTop: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {apiError.replace(/purchase/gi, folderName)}
          </Text>
        )}
        {!loadingApi && !apiError && enhancedFilteredPurchases.length === 0 && (
          <Text
            style={{
              color: '#888',
              textAlign: 'center',
              marginTop: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        )}
        {!loadingApi && !apiError && enhancedFilteredPurchases.length > 0 && (
          <FlatList
            key={`purchase-list-${refreshKey}-${forceUpdate}`}
            data={[...enhancedFilteredPurchases].reverse()}
            renderItem={renderPurchaseItem}
            keyExtractor={item => `purchase-${item.id}-${refreshKey}`}
            extraData={refreshKey + forceUpdate}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    await fetchPurchases();
                  } catch (error) {
                    console.error('Pull to refresh error:', error);
                  } finally {
                    setRefreshing(false);
                  }
                }}
                colors={['#4f8cff']}
                tintColor="#4f8cff"
              />
            }
          />
        )}
      </View>
      {/* Add Purchase Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => {
          setShowModal(false);
          setLoadingSave(false);
          setLoadingDraft(false);
          setIsFetchingEdit(false);
          setShowCreateForm(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>

      {/* Filter Bottom Sheet */}
      {filterVisible && (
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
            onPress={() => setFilterVisible(false)}
          />
          <KeyboardAwareScrollView
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: scale(18),
              borderTopRightRadius: scale(18),
              height: '90%',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
            contentContainerStyle={{ padding: scale(20), flexGrow: 1 }}
            enableOnAndroid
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                position: 'absolute',
                left: scale(16),
                top: scale(16),
                zIndex: 10,
                padding: scale(8),
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: scale(20),
              }}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#333333"
              />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 18,
                marginBottom: scale(16),
                marginLeft: 0,
                textAlign: 'center',
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Filter {pluralize(folderName)}
            </Text>
            {/* Amount Range */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Amount Range
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: scale(16) }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                  color: '#333333',
                }}
                placeholder="Min"
                placeholderTextColor="#666666"
                keyboardType="numeric"
                value={
                  searchFilter.amountMin !== undefined
                    ? String(searchFilter.amountMin)
                    : ''
                }
                onChangeText={v =>
                  setSearchFilter(f => ({
                    ...f,
                    amountMin: v ? Number(v) : undefined,
                  }))
                }
              />
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                  color: '#333333',
                }}
                placeholder="Max"
                placeholderTextColor="#666666"
                keyboardType="numeric"
                value={
                  searchFilter.amountMax !== undefined
                    ? String(searchFilter.amountMax)
                    : ''
                }
                onChangeText={v =>
                  setSearchFilter(f => ({
                    ...f,
                    amountMax: v ? Number(v) : undefined,
                  }))
                }
              />
            </View>
            {/* Date Range */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Date Range
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: scale(16),
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                }}
                onPress={() => setShowDatePickerFrom(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateFrom ? '#333333' : '#666666',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {searchFilter.dateFrom || 'From'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                }}
                onPress={() => setShowDatePickerTo(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateTo ? '#333333' : '#666666',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {searchFilter.dateTo || 'To'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Date Pickers */}
            {showDatePickerFrom && (
              <DateTimePicker
                value={
                  searchFilter.dateFrom
                    ? new Date(searchFilter.dateFrom)
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePickerFrom(false);
                  if (date)
                    setSearchFilter(f => ({
                      ...f,
                      dateFrom: date.toISOString().split('T')[0],
                    }));
                }}
              />
            )}
            {showDatePickerTo && (
              <DateTimePicker
                value={
                  searchFilter.dateTo
                    ? new Date(searchFilter.dateTo)
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePickerTo(false);
                  if (date)
                    setSearchFilter(f => ({
                      ...f,
                      dateTo: date.toISOString().split('T')[0],
                    }));
                }}
              />
            )}
            {/* Payment Method filter */}
            <Text
              style={{
                fontSize: 14,
                color: '#333333',
                marginBottom: scale(12),
                marginTop: scale(8),
                fontFamily: 'Roboto-Medium',
              }}
            >
              Payment Method
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: scale(20),
                gap: scale(10),
              }}
            >
              {[
                'Cash',
                'Bank Transfer',
                'UPI',
                'Credit Card',
                'Debit Card',
                'Cheque',
              ].map((method, idx) => (
                <TouchableOpacity
                  key={method}
                  style={{
                    backgroundColor:
                      searchFilter.paymentMethod === method
                        ? '#e5e7eb'
                        : '#ffffff',
                    borderColor:
                      searchFilter.paymentMethod === method
                        ? '#9ca3af'
                        : '#d1d5db',
                    borderWidth: 1.5,
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scale(68),
                  }}
                  onPress={() =>
                    setSearchFilter(f => ({
                      ...f,
                      paymentMethod: method,
                    }))
                  }
                >
                  <Text
                    style={{
                      color:
                        searchFilter.paymentMethod === method
                          ? '#1f2937'
                          : '#6b7280',
                      fontSize: 13,
                      fontWeight:
                        searchFilter.paymentMethod === method ? '600' : '500',
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Status filter */}
            <Text
              style={{
                fontSize: 14,
                color: '#333333',
                marginBottom: scale(12),
                fontFamily: 'Roboto-Medium',
              }}
            >
              Status
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: scale(20),
                gap: scale(12),
              }}
            >
              {['', 'Paid', 'Pending'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={{
                    flex: 1,
                    backgroundColor:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '#e5e7eb'
                        : '#ffffff',
                    borderColor:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '#9ca3af'
                        : '#d1d5db',
                    borderWidth: 1.5,
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() =>
                    setSearchFilter(f => ({
                      ...f,
                      status: status || undefined,
                    }))
                  }
                >
                  <Text
                    style={{
                      color:
                        (status === '' && !searchFilter.status) ||
                        searchFilter.status === status
                          ? '#1f2937'
                          : '#6b7280',
                      fontSize: 13,
                      fontWeight:
                        (status === '' && !searchFilter.status) ||
                        searchFilter.status === status
                          ? '600'
                          : '500',
                      textTransform: 'capitalize',
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    {status || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reference Number Filter */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Reference Number
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
                color: '#333333',
              }}
              placeholder="Reference number"
              placeholderTextColor="#666666"
              value={searchFilter.reference || ''}
              onChangeText={v =>
                setSearchFilter(f => ({ ...f, reference: v || undefined }))
              }
            />
            {/* Description/Notes Filter */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Description/Notes
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
                color: '#333333',
              }}
              placeholder="Description or notes keywords"
              placeholderTextColor="#666666"
              value={searchFilter.description || ''}
              onChangeText={v =>
                setSearchFilter(f => ({ ...f, description: v || undefined }))
              }
            />
            {/* Reset/Apply buttons */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: scale(20),
                marginTop: scale(12),
                gap: scale(16),
              }}
            >
              <TouchableOpacity
                onPress={() => setSearchFilter({ searchText: '' })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#f8f9fa',
                  borderWidth: 1.5,
                  borderColor: '#dc3545',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
                }}
              >
                <Text
                  style={{
                    color: '#dc3545',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#4f8cff',
                  borderWidth: 1.5,
                  borderColor: '#4f8cff',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 16,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      )}

      {/* Custom Popup */}
      <Modal
        isVisible={showPopup}
        onBackdropPress={() => setShowPopup(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        style={{ justifyContent: 'center', margin: 20 }}
        backdropOpacity={0.6}
        useNativeDriver={true}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 10,
            },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor:
                popupType === 'success'
                  ? '#d4edda'
                  : popupType === 'error'
                  ? '#f8d7da'
                  : '#d1ecf1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons
              name={
                popupType === 'success'
                  ? 'check-circle'
                  : popupType === 'error'
                  ? 'alert-circle'
                  : 'information'
              }
              size={32}
              color={
                popupType === 'success'
                  ? '#155724'
                  : popupType === 'error'
                  ? '#721c24'
                  : '#0c5460'
              }
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              color: '#333333',
              marginBottom: 8,
              textAlign: 'center',
              fontFamily: 'Roboto-Medium',
            }}
          >
            {popupTitle}
          </Text>

          {/* Message */}
          <Text
            style={{
              fontSize: 16,
              color: '#666666',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {popupMessage}
          </Text>

          {/* OK Button */}
          <TouchableOpacity
            style={{
              backgroundColor:
                popupType === 'success'
                  ? '#28a745'
                  : popupType === 'error'
                  ? '#dc3545'
                  : '#17a2b8',
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: 8,
              minWidth: 100,
            }}
            onPress={() => setShowPopup(false)}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontFamily: 'Roboto-Medium',
              }}
            >
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const SCALE = 0.75;
const scale = (value: number) => Math.round(value * SCALE);

const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {
  container: {
    flex: 1,
    padding: scale(20),
    paddingBottom: scale(140), // Adequate space for fixed buttons
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(20),
    marginBottom: scale(24),
    marginTop: scale(8),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: scale(5),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  cardTitle: {
    fontSize: scale(23.5), // 18 + 2
    color: '#333333', // Card titles - black for maximum contrast
    marginBottom: scale(20),
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center' as ViewStyle['alignItems'],
  },
  flex1: { flex: 1 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    height: scale(66),
    justifyContent: 'center',
  },
  picker: {
    height: scale(66),
    width: '100%',
    marginTop: scale(-4),
    marginBottom: scale(-4),
  },
  actionButtonsContainer: {
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  actionButtonsBottom: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingVertical: scale(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  fixedActionButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    paddingTop: scale(16),
    paddingBottom: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  fullWidthButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  primaryButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: scale(22),
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginLeft: scale(8),
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    color: '#333333',
    fontSize: scale(18), // 16 + 2
  },
  iconButton: {
    backgroundColor: '#fff',
    padding: scale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(22),
    fontSize: scale(18),
    color: '#333333', // Input field text - black for better readability
    backgroundColor: '#f9f9f9',
    fontFamily: 'Roboto-Medium',
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: scale(12),
    fontFamily: 'Roboto-Medium',
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  invoiceNumber: {
    fontSize: scale(18), // 16 + 2
    color: '#333333', // Important text - black for maximum contrast
  },
  statusBadge: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(8),
    borderRadius: scale(5),
  },
  statusText: {
    color: '#fff',
    fontSize: scale(14), // 12 + 2
  },
  customerName: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
    marginBottom: scale(8),
    fontWeight: 'normal',
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
  },
  invoiceAmount: {
    fontSize: scale(18), // 16 + 2
    color: '#333333', // Important text - black for maximum contrast
  },
  listContainer: {
    flex: 1,
    padding: scale(16),
  },
  addInvoiceButton: {
    position: 'absolute',
    bottom: scale(30),
    right: scale(30),
    backgroundColor: '#4f8cff',
    borderRadius: scale(28),
    paddingVertical: scale(16),
    paddingHorizontal: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: scale(8),
    shadowOffset: { width: 0, height: scale(4) },
  },
  addInvoiceText: {
    color: '#fff',
    fontSize: scale(18), // 16 + 2
    marginLeft: scale(8),
    fontWeight: '700',
  },
  dropdownItem: {
    padding: scale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOpacity: 0.15,
    shadowRadius: scale(6),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  dropdownItemText: {
    fontSize: scale(14), // Match input field size
    color: '#333333', // Dropdown text - black for better readability
    fontFamily: 'Roboto-Medium',
  },
  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(36),
    paddingHorizontal: scale(30),
    marginLeft: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: scale(14),
  },
  // Item management styles
  itemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(8),
    padding: scale(16),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemTitle: {
    fontSize: scale(16),
    fontFamily: 'Roboto-Medium',
    color: '#333333',
    marginBottom: scale(12),
  },
  removeItemButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeItemText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
    marginLeft: scale(4),
  },
  // GST Modal Styles
  gstModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: '50%',
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
  // Items Section Styles
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
    backgroundColor: '#4f8cff',
    paddingVertical: 7.5,
    paddingHorizontal: 12,
    borderRadius: 18.75,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  addItemText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
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
    fontFamily: 'Roboto-Medium',
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
    color: '#4f8cff',
    fontFamily: 'Roboto-Medium',
  },
  // Picker Input Styles
  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    backgroundColor: '#fff',
    paddingHorizontal: scale(12),
    paddingVertical: scale(16),
    height: scale(70),
    marginTop: scale(4),
  },
  pickerText: {
    fontSize: scale(19),
    color: '#333333',
    fontFamily: 'Roboto-Medium',
    flex: 1,
  },
  placeholderText: {
    color: '#666666',
    fontSize: scale(16),
  },
};

const styles: StyleSheet.NamedStyles<any> = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: '#4f8cff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: scale(12),
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    marginLeft: scale(12),
    fontFamily: 'Roboto-Medium',
  },
  ...invoiceLikeStyles,
  // Bottom buttons UI (unified)
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
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  submitButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: scale(4) },
  },
  modalTitle: {
    fontSize: scale(18),
    color: '#28a745', // Keep success color for modal titles
    marginBottom: scale(8),
    fontFamily: 'Roboto-Medium',
  },
  modalMessage: {
    fontSize: scale(14),
    color: '#333333', // Modal content - black for better readability
    marginBottom: scale(20),
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
  modalButton: {
    backgroundColor: '#28a745',
    borderRadius: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(32),
  },
  modalButtonText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
  },
  errorTextField: {
    color: '#d32f2f', // Error text - darker red for better visibility
    fontSize: scale(14), // 12 + 2
    marginTop: scale(4),
    fontFamily: 'Roboto-Medium',
  },
  fieldWrapper: {
    marginBottom: scale(20),
    width: '100%',
  },
});

export default PurchaseScreen;
