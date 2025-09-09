import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AttachDocument from '../../components/AttachDocument';
import Modal from 'react-native-modal';
import { useTransactionLimit } from '../../context/TransactionLimitContext';

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

  // Add safety check for required params
  if (!customer || !partyType || !entryType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorDisplayText}>Required data not found</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
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
    const initializeForm = async () => {
      if (editingItem) {
        console.log('🔍 Loading editing item data:', editingItem);
        console.log('🔍 Editing item items structure:', editingItem.items);
        if (editingItem.items && editingItem.items.length > 0) {
          console.log('🔍 First item structure:', editingItem.items[0]);
        }
        // Pre-fill form for editing
        setDate(new Date(editingItem.date));
        setAmount(String(editingItem.amount || ''));
        setPaymentMethod(editingItem.method || null);
        setDescription(editingItem.description || '');
        setNotes(editingItem.notes || '');
        setAttachedDocument(editingItem.attachedDocument || null);

        // Load items if editing invoice/purchase
        if (editingItem.items && editingItem.items.length > 0) {
          console.log('🔍 Loading items:', editingItem.items);
          // Map API response items to component format
          const mappedItems = editingItem.items.map((item: any) => ({
            id: item.id || Date.now().toString(),
            description: item.description || '',
            quantity: item.qty || item.quantity || 0, // Handle both 'qty' and 'quantity' fields
            rate: item.rate || 0,
            amount: item.amount || 0,
            gstPct: item.gstPct || gstPercentage,
            gstAmount: item.gstAmount || 0,
          }));
          console.log('🔍 Mapped items:', mappedItems);
          setItems(mappedItems);
        } else if (isPurchaseEntry || isSellEntry) {
          // If no items but it's a purchase/sell entry, add default item
          console.log(
            '🔍 No items found, adding default item for purchase/sell entry',
          );
          addNewItem();
        }

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
        if (editingItem.cGST !== undefined) {
          console.log('🔍 Loading tax amount (cGST):', editingItem.cGST);
          setTaxAmount(parseFloat(editingItem.cGST) || 0);
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

    initializeForm();
  }, [editingItem, entryType, isPurchaseEntry, isSellEntry]);

  // Calculate totals when items change
  useEffect(() => {
    if (isPurchaseEntry || isSellEntry) {
      calculateTotals();
    }
  }, [items, gstPercentage]);

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

    // Calculate total including tax amount and discount
    const newTotal =
      newSubtotal + newTotalGST + (taxAmount || 0) - (discountAmount || 0);

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
    if (!validateForm()) {
      return;
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

      if (isSimpleEntry) {
        // Simple payment/receipt entry - these fields are required
        apiEndpoint = `${BASE_URL}/vouchers`;
        body = {
          user_id: userId,
          customerId: customer?.id ? parseInt(customer.id) : undefined,
          type: entryType === 'gave' ? 'payment' : 'receipt',
          amount: parseFloat(amount).toFixed(2),
          date: date.toISOString(),
          status: 'complete',
          description: description || '',
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: customer?.phoneNumber || '',
          partyAddress: customer?.address || '',
          method: paymentMethod,
          gstNumber: customer?.gstNumber || '',
          items: [],
          createdBy: userId,
          updatedBy: userId,
        };
      } else if (isPurchaseEntry) {
        // Purchase entry with items - no simple entry fields required
        apiEndpoint = `${BASE_URL}/vouchers`;
        body = {
          user_id: userId,
          createdBy: userId,
          updatedBy: userId,
          type: 'Purchase',
          amount: total.toFixed(2),
          date: new Date(date).toISOString(),
          status: 'complete',
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: customer?.phoneNumber || '',
          partyAddress: customer?.address || '',
          items: items.map(item => ({
            description: item.description,
            qty: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
          gstPct: gstPercentage, // Global GST percentage
          discount: discountAmount, // Discount amount
          cGST: taxAmount, // Tax amount (using cGST field)
        };
      } else if (isSellEntry) {
        // Sell entry with items - no simple entry fields required
        apiEndpoint = `${BASE_URL}/vouchers`;
        body = {
          user_id: userId,
          createdBy: userId,
          updatedBy: userId,
          type: 'Sell',
          amount: total.toFixed(2),
          date: new Date(date).toISOString(),
          status: 'complete',
          notes: notes || '',
          partyName: customer?.name || '',
          partyPhone: customer?.phoneNumber || '',
          partyAddress: customer?.address || '',
          items: items.map(item => ({
            description: item.description,
            qty: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
          gstPct: gstPercentage, // Global GST percentage
          discount: discountAmount, // Discount amount
          cGST: taxAmount, // Tax amount (using cGST field)
        };
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

        res = await fetch(`${apiEndpoint}/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patchBody),
        });
      } else {
        // POST create
        res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: 'Unknown error occurred' }));

        // Check if it's a transaction limit error
        if (
          err.message?.includes('transaction limit') ||
          err.message?.includes('limit exceeded') ||
          err.message?.includes('Internal server error')
        ) {
          // Trigger transaction limit popup
          await forceShowPopup();
          return;
        }

        // Handle specific HTTP status codes
        if (res.status === 401) {
          throw new Error('Authentication failed - Please login again');
        } else if (res.status === 403) {
          throw new Error('Access forbidden - Please check your permissions');
        } else if (res.status >= 500) {
          throw new Error('Server error - Please try again later');
        } else {
          throw new Error(
            err.message ||
              `Failed to ${editingItem ? 'update' : 'save'} entry. Status: ${
                res.status
              }`,
          );
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

      // Handle specific authentication errors
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
              // Navigation will be handled by the auth system
            });
          },
        );
      } else {
        showCustomAlert(
          'Error',
          error.message ||
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

          // All entries use the same /vouchers endpoint
          const apiEndpoint = `${BASE_URL}/vouchers/${editingItem.id}`;

          const res = await fetch(apiEndpoint, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ message: 'Unknown error occurred' }));

            // Handle specific HTTP status codes
            if (res.status === 401) {
              throw new Error('Authentication failed - Please login again');
            } else if (res.status === 403) {
              throw new Error(
                'Access forbidden - Please check your permissions',
              );
            } else if (res.status >= 500) {
              throw new Error('Server error - Please try again later');
            } else {
              throw new Error(
                err.message || `Failed to delete entry. Status: ${res.status}`,
              );
            }
          }

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

  const getEntryTypeText = () => {
    if (isPurchaseEntry) return 'Purchase';
    if (isSellEntry) return 'Sell';
    return entryType === 'gave' ? 'Payment' : 'Receipt';
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
        <TouchableOpacity onPress={() => removeItem(item.id)}>
          <MaterialCommunityIcons name="delete" size={20} color="#dc3545" />
        </TouchableOpacity>
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
            onChangeText={text => updateItem(item.id, 'description', text)}
            placeholderTextColor="#666"
            onFocus={() => {
              console.log('🔍 Item description input focused, centering...');
              // Close any open dropdowns when Item description field gets focus
              setShowPaymentMethodModal(false);
              setShowGstModal(false);
              scrollToInputCenter(descriptionRef);
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
              placeholderTextColor="#666"
              keyboardType="numeric"
              onFocus={() => {
                console.log('🔍 Item quantity input focused, centering...');
                // Close any open dropdowns when Item quantity field gets focus
                setShowPaymentMethodModal(false);
                setShowGstModal(false);
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
              placeholderTextColor="#666"
              keyboardType="numeric"
              onFocus={() => {
                console.log('🔍 Item rate input focused, centering...');
                // Close any open dropdowns when Item rate field gets focus
                setShowPaymentMethodModal(false);
                setShowGstModal(false);
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4f8cff" />

      {/* Header */}
      <View style={styles.header}>
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
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
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
          paddingBottom: 120, // Increased to account for fixed buttons
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
          }}
        >
          <View>
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
              <Text style={styles.inputLabel}>Date *</Text>
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
                <Text style={styles.inputLabel}>Amount *</Text>
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
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    onFocus={() => {
                      console.log('🔍 Amount input focused, centering...');
                      // Close any open dropdowns when Amount field gets focus
                      setShowPaymentMethodModal(false);
                      setShowGstModal(false);
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
                <Text style={styles.inputLabel}>Payment Method *</Text>
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
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  ref={descriptionRef}
                  style={[
                    styles.textInput,
                    errors.description ? styles.inputError : {},
                  ]}
                  placeholder="Enter description"
                  value={description}
                  onChangeText={handleDescriptionChange}
                  placeholderTextColor="#666"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  onFocus={() => {
                    console.log('🔍 Description input focused, centering...');
                    // Close any open dropdowns when Description field gets focus
                    setShowPaymentMethodModal(false);
                    setShowGstModal(false);
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
                <Text style={styles.inputLabel}>GST Percentage *</Text>
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
                  <Text style={styles.taxDiscountTitle}>₹ Amount Details</Text>
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
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        onFocus={() => {
                          console.log(
                            '🔍 Tax amount input focused, centering...',
                          );
                          // Close any open dropdowns when Tax amount field gets focus
                          setShowPaymentMethodModal(false);
                          setShowGstModal(false);
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
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        onFocus={() => {
                          console.log(
                            '🔍 Discount amount input focused, centering...',
                          );
                          // Close any open dropdowns when Discount amount field gets focus
                          setShowPaymentMethodModal(false);
                          setShowGstModal(false);
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
                  <Text style={styles.totalLabel}>GST ({gstPercentage}%):</Text>
                  <Text style={styles.totalAmount}>
                    ₹{(totalGST || 0).toFixed(2)}
                  </Text>
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
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                onFocus={() => {
                  console.log('🔍 Notes input focused, centering...');
                  // Close any open dropdowns when Notes field gets focus
                  setShowPaymentMethodModal(false);
                  setShowGstModal(false);
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
                styles.submitButton,
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
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={loading}
            >
              <Text style={styles.deleteButtonText}>DELETE ENTRY</Text>
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
      <Modal
        isVisible={showPaymentMethodModal}
        onBackdropPress={() => setShowPaymentMethodModal(false)}
        style={{ justifyContent: 'flex-end', margin: 0, marginBottom: 0 }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        animationInTiming={300}
        animationOutTiming={250}
        backdropOpacity={0.5}
        backdropTransitionInTiming={300}
        backdropTransitionOutTiming={250}
      >
        <View style={styles.paymentMethodModalContainer}>
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
          <View style={styles.paymentMethodModalContent}>
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
          </View>
        </View>
      </Modal>

      {/* GST Percentage Filter Modal */}
      <Modal
        isVisible={showGstModal}
        onBackdropPress={() => setShowGstModal(false)}
        style={{ justifyContent: 'flex-end', margin: 0, marginBottom: 0 }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        animationInTiming={300}
        animationOutTiming={250}
        backdropOpacity={0.5}
        backdropTransitionInTiming={300}
        backdropTransitionOutTiming={250}
      >
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
              <Text style={styles.gstModalTitle}>Select GST Percentage</Text>
              <Text style={styles.gstModalSubtitle}>
                Choose the applicable GST rate
              </Text>
            </View>
            <View style={{ width: 22 }} />
          </View>

          {/* GST Percentage Options */}
          <View style={styles.gstModalContent}>
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
                        gstPercentage === percentage && styles.gstIconSelected,
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16, // Add bottom padding
  },
  infoText: {
    fontSize: 12,
    color: '#1e293b',
    lineHeight: 18,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorDisplayText: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#1e293b',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  partyTypeText: {
    fontSize: 11,
    color: '#64748b',
  },
  purchaseInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  sellInfo: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
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
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#1e293b',
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 1.5,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 10,
    marginTop: 4,
    marginBottom: 4,
    lineHeight: 12,
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
    fontSize: 12,
    color: '#333',
  },
  amountInput: {
    flex: 1,
    fontSize: 12,
    color: '#333',
    paddingVertical: 0,
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
    fontSize: 12,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.3,
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
    fontSize: 10.5,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0.3,
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
    fontWeight: '700',
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
    fontSize: 10,
    color: '#4f8cff',
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemDescriptionInput: {
    fontSize: 12,
    color: '#333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'center',
    minHeight: 40,
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
    fontSize: 12,
    color: '#333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    minHeight: 40,
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
    fontSize: 13,
    color: '#4f8cff',
    fontWeight: '700',
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
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  finalTotalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#f0f0f0',
  },
  finalTotalLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.3,
  },
  finalTotalAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4f8cff',
    letterSpacing: 0.3,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 0,
    paddingVertical: 9,
    paddingBottom: 15, // Extra padding for safe area
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1.5 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10, // Ensure buttons stay above content
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
  },
  submitButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonFullWidth: {
    width: '100%',
    flex: 0,
    borderRadius: 0,
    marginHorizontal: 0,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    fontWeight: '600',
    color: '#333',
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
    fontSize: 12,
    color: '#333',
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
    fontSize: 12,
    color: '#333',
    flex: 1,
    marginLeft: 6,
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
    fontSize: 13.5,
    fontWeight: '700',
    color: '#333',
    marginLeft: 6,
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
    fontSize: 12,
    color: '#333',
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
    fontSize: 13.5,
    fontWeight: '700',
    color: '#333',
    marginLeft: 6,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#6c757d',
    letterSpacing: 0.3,
  },
  alertButtonConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
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
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  paymentMethodModalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '400',
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
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentMethodOptionTextSelected: {
    color: '#4f8cff',
    fontWeight: '700',
  },
  paymentMethodDescription: {
    fontSize: 12,
    color: '#888',
    fontWeight: '400',
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
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  gstModalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '400',
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
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  gstOptionTextSelected: {
    color: '#4f8cff',
    fontWeight: '700',
  },
  gstDescription: {
    fontSize: 12,
    color: '#888',
    fontWeight: '400',
  },
  gstCheckContainer: {
    marginLeft: 12,
  },
});

export default AddNewEntryScreen;
