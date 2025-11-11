import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  RouteProp,
  useIsFocused,
  useFocusEffect,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  uiColors,
  uiFonts,
  uiButtons,
  uiLayout,
  uiIcons,
} from '../../config/uiSizing';
import { AppStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
import { getToken, getUserIdFromToken } from '../../utils/storage';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';

const { width } = Dimensions.get('window');

const CustomerDetailScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CustomerDetail'>>();
  const { customer, partyType, refresh } = route.params || {};
  const isFocused = useIsFocused();

  // StatusBar like ProfileScreen
  const { statusBarSpacer } = useStatusBarWithGradient('CustomerDetail', [
    '#4f8cff',
    '#4f8cff',
  ]);
  const preciseStatusBarHeight = getStatusBarHeight(true);

  // Four action buttons available:
  // 1. Payment (Red) - Money going out (gave)
  // 2. Receipt (Green) - Money coming in (got)
  // 3. Purchase (Orange) - Goods/services bought (gave)
  // 4. Sell (Purple) - Goods/services sold (got)

  // State for recent transactions
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Add state for selected bottom action
  const [selectedAction, setSelectedAction] = useState<
    'payment' | 'receipt' | 'purchase' | 'sell' | null
  >(null);

  // State for date and time pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

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

  // Custom Alert Helper Function
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

  // Add null check for route params with early return
  if (!customer || !partyType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Customer data not found</Text>
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

  // Calculate real-time balance from vouchers instead of static opening balance
  const [balance, setBalance] = useState(0);
  const [balanceType, setBalanceType] = useState<'receipt' | 'payment'>(
    'payment',
  );

  // Fetch transactions for this customer
  const fetchTransactions = useCallback(async () => {
    setLoadingTransactions(true);
    setApiError(null);

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setApiError('Authentication token not found');
        return;
      }

      const userId = await getUserIdFromToken();
      if (!userId) {
        setApiError('User not authenticated');
        return;
      }

      // Fetch transactions for this customer only (server-side filtered)
      // Use unified API with server-side filtering
      const response = (await unifiedApi.getTransactionsByCustomer(
        customer.id,
      )) as { data: any; status: number; headers: Headers };
      // Validate API shape
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid API response format');
      }

      const data = response.data || response;
      const rawItems = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      // Normalize transactions to a consistent shape
      const transactions = rawItems.map((t: any) => {
        const backendType = String(t.type || '').toLowerCase();
        const hasItems = Array.isArray(t.items) && t.items.length > 0;
        let unifiedType:
          | 'payment'
          | 'receipt'
          | 'Purchase'
          | 'Sell'
          | 'transaction' = 'transaction';
        if (backendType === 'debit' || backendType === 'payment') {
          unifiedType = hasItems ? 'Purchase' : 'payment';
        } else if (backendType === 'credit' || backendType === 'receipt') {
          unifiedType = hasItems ? 'Sell' : 'receipt';
        } else if (backendType === 'purchase') unifiedType = 'Purchase';
        else if (
          backendType === 'sell' ||
          backendType === 'sale' ||
          backendType === 'invoice'
        )
          unifiedType = 'Sell';

        return {
          id:
            t.id ??
            t.transactionId ??
            t._id ??
            Math.random().toString(36).slice(2),
          type: unifiedType,
          amount: Number(t.amount ?? t.total ?? 0),
          customerId:
            t.customerId ?? t.customer_id ?? t.partyId ?? t.party_id ?? null,
          partyName: t.partyName ?? t.customerName ?? t.supplierName ?? '',
          phoneNumber: t.phoneNumber ?? t.partyPhone ?? '',
          date: t.date ?? t.createdAt ?? t.updatedAt ?? null,
          method: t.method ?? t.paymentMethod ?? '',
          _raw: t,
        };
      });

      console.log('🔍 CustomerDetailScreen: Raw transactions data:', {
        totalTransactions: transactions.length,
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phoneNumber,
        sample: transactions.slice(0, 5).map((v: any) => ({
          id: v.id,
          customerId: v.customerId,
          partyName: v.partyName,
          phoneNumber: v.phoneNumber,
          type: v.type,
          amount: v.amount,
        })),
      });

      // Since the API is filtered by customerId, we only keep records that match id as a hard guard.
      const customerTransactions = transactions.filter((v: any) => {
        const vId = v.customerId ?? v._raw?.customerId ?? v._raw?.customer_id;
        return vId && customer?.id && String(vId) === String(customer.id);
      });

      console.log('🔍 CustomerDetailScreen: Filtered transactions:', {
        totalFiltered: customerTransactions.length,
        customerId: customer?.id,
        customerName: customer?.name,
        filteredTransactions: customerTransactions.map((v: any) => ({
          id: v.id,
          customerId: v.customerId,
          partyName: v.partyName,
          type: v.type,
          amount: v.amount,
          date: v.date,
        })),
      });

      // Calculate real-time balance from vouchers
      // Color Logic:
      // - "Receipt" (positive balance) = GREEN (#28a745) - you are owed money (profit)
      // - "Payment" (negative balance) = RED (#dc3545) - you owe money (loss)
      let totalReceipts = 0;
      let totalPayments = 0;

      customerTransactions.forEach((txn: any) => {
        const amount = Number(txn.amount) || 0;
        if (txn.type === 'receipt' || txn.type === 'Sell') {
          totalReceipts += amount; // Money coming in
        } else if (txn.type === 'payment' || txn.type === 'Purchase') {
          totalPayments += amount; // Money going out
        }
      });

      // Calculate net balance: receipts - payments
      const netBalance = totalReceipts - totalPayments;

      // Update balance state
      setBalance(Math.abs(netBalance));
      setBalanceType(netBalance > 0 ? 'receipt' : 'payment');

      console.log('💰 Customer balance calculated:', {
        customerName: customer?.name,
        totalReceipts,
        totalPayments,
        netBalance,
        balanceType: netBalance > 0 ? 'receipt' : 'payment',
        displayAmount: Math.abs(netBalance),
      });

      // Sort all entries by date (newest first) with safe date parsing
      const sortedEntries = customerTransactions.sort((a: any, b: any) => {
        const getSafeDate = (item: any) => {
          try {
            const dateStr = item.date || item.createdAt || item.updatedAt;
            if (!dateStr) return new Date(0);
            const parsed = new Date(dateStr);
            return isNaN(parsed.getTime()) ? new Date(0) : parsed;
          } catch {
            return new Date(0);
          }
        };

        const dateA = getSafeDate(a);
        const dateB = getSafeDate(b);
        return dateB.getTime() - dateA.getTime();
      });

      setRecentTransactions(sortedEntries);
    } catch (e: any) {
      console.error('Error fetching transactions:', e);
      setApiError(e.message || 'Error fetching transactions');
    } finally {
      setLoadingTransactions(false);
    }
  }, [customer?.id, customer?.name, customer?.phoneNumber]);

  // Fetch transactions on component mount and when refresh is triggered
  useEffect(() => {
    if (isFocused && customer?.id) {
      fetchTransactions();
    }
  }, [isFocused, customer?.id, refresh, fetchTransactions]);

  // Handle focus events to refresh data when returning from AddNewEntry screen
  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 CustomerDetailScreen: Focus event triggered');

      // Check if we should refresh data (e.g., returning from AddNewEntry)
      if (isFocused && customer?.id) {
        console.log('🔄 CustomerDetailScreen: Refreshing transactions data');
        fetchTransactions();
      }
    }, [isFocused, customer?.id, fetchTransactions]),
  );

  const handleViewSettings = () => {
    // Navigate to AddPartyScreen in edit mode
    navigation.navigate('AddParty', {
      partyType: partyType,
      editMode: true,
      customerData: customer,
    });
  };

  const handleSetReminder = () => {
    // Reset previous selections
    setSelectedDate(null);
    setSelectedTime(null);
    // Show date picker first
    setShowDatePicker(true);
  };

  // Handle date selection
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);

      if (event.type === 'set' && date) {
        setSelectedDate(date);
        // After date is selected, show time picker
        setTimeout(() => {
          setShowTimePicker(true);
        }, 300);
      } else if (event.type === 'dismissed') {
        setSelectedDate(null);
      }
    } else {
      // iOS handling
      if (date) {
        setSelectedDate(date);
        // On iOS, close date picker and show time picker
        setShowDatePicker(false);
        setTimeout(() => {
          setShowTimePicker(true);
        }, 300);
      }
      if (event.type === 'dismissed') {
        setShowDatePicker(false);
        setSelectedDate(null);
      }
    }
  };

  // Handle time selection
  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);

      if (event.type === 'set' && time && selectedDate) {
        setSelectedTime(time);

        // Combine date and time
        const reminderDateTime = new Date(selectedDate);
        reminderDateTime.setHours(time.getHours());
        reminderDateTime.setMinutes(time.getMinutes());
        reminderDateTime.setSeconds(0);

        // Automatically send messages after both date and time are selected
        sendReminderMessages(reminderDateTime);
      } else if (event.type === 'dismissed') {
        setSelectedTime(null);
        setSelectedDate(null);
      }
    } else {
      // iOS handling
      if (time && selectedDate) {
        setSelectedTime(time);
        setShowTimePicker(false);

        // Combine date and time
        const reminderDateTime = new Date(selectedDate);
        reminderDateTime.setHours(time.getHours());
        reminderDateTime.setMinutes(time.getMinutes());
        reminderDateTime.setSeconds(0);

        // Automatically send messages after both date and time are selected
        sendReminderMessages(reminderDateTime);
      }
      if (event.type === 'dismissed') {
        setShowTimePicker(false);
        setSelectedTime(null);
        setSelectedDate(null);
      }
    }
  };

  // Function to send reminder messages via WhatsApp and SMS
  const sendReminderMessages = async (reminderDateTime: Date) => {
    if (!customer?.phoneNumber) {
      showCustomAlert(
        'No Phone Number',
        'Phone number not available for this contact',
        'warning',
      );
      return;
    }

    try {
      // Format phone number
      let phoneNumber = customer.phoneNumber.replace(/[\s\-\(\)]/g, '');

      if (!phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '+91' + phoneNumber.substring(1);
        } else if (phoneNumber.length === 10) {
          phoneNumber = '+91' + phoneNumber;
        } else {
          phoneNumber = '+91' + phoneNumber;
        }
      }

      // Format date and time
      const formattedDate = reminderDateTime.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const formattedTime = reminderDateTime.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      // Create message with balance amount and reminder date/time
      const balanceText = balanceType === 'receipt' ? 'Receipt' : 'Payment';
      const amountText = `₹${Math.abs(balance).toLocaleString('en-IN')}`;
      const customerName = customer.name || 'Customer';

      const message = `Hi ${customerName},\n\nThis is a reminder regarding your ${balanceText.toLowerCase()} of ${amountText}.\n\nReminder Date: ${formattedDate}\nReminder Time: ${formattedTime}\n\nPlease review and confirm.\n\nThank you!`;

      // Send WhatsApp message
      try {
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`;
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);

        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappUrl);
        } else {
          const webWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
          await Linking.openURL(webWhatsappUrl);
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp:', whatsappError);
      }

      // Small delay before sending SMS
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send SMS message
      try {
        const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
        const canOpenSMS = await Linking.canOpenURL(smsUrl);

        if (canOpenSMS) {
          await Linking.openURL(smsUrl);
        } else {
          const localPhoneNumber = phoneNumber.replace('+91', '');
          const fallbackSmsUrl = `sms:${localPhoneNumber}?body=${encodeURIComponent(
            message,
          )}`;
          await Linking.openURL(fallbackSmsUrl);
        }
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
      }

      // Show success message
      showCustomAlert(
        'Reminder Set',
        `Reminder messages sent successfully for ${formattedDate} at ${formattedTime}`,
        'success',
      );
    } catch (error) {
      console.error('Error sending reminder messages:', error);
      showCustomAlert(
        'Error',
        'Failed to send reminder messages. Please try again.',
        'error',
      );
    } finally {
      // Reset picker states
      setShowDatePicker(false);
      setShowTimePicker(false);
      setSelectedDate(null);
      setSelectedTime(null);
    }
  };

  const handleGenerateReport = () => {
    showCustomAlert(
      'Generate Report',
      'Generate report for this customer',
      'info',
    );
  };

  const handleSendReminder = async () => {
    if (!customer?.phoneNumber) {
      showCustomAlert(
        'No Phone Number',
        'Phone number not available for this contact',
        'warning',
      );
      return;
    }

    try {
      // Format phone number (remove spaces, dashes, and ensure country code)
      let phoneNumber = customer.phoneNumber.replace(/[\s\-\(\)]/g, '');

      // If phone number doesn't start with country code, add +91 for India
      if (!phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '+91' + phoneNumber.substring(1);
        } else if (phoneNumber.length === 10) {
          phoneNumber = '+91' + phoneNumber;
        } else {
          phoneNumber = '+91' + phoneNumber;
        }
      }

      // Create message with balance amount
      const balanceText = balanceType === 'receipt' ? 'Receipt' : 'Payment';
      const amountText = `₹${Math.abs(balance).toLocaleString('en-IN')}`;
      const customerName = customer.name || 'Customer';

      const message = `Hi ${customerName},\n\nThis is a reminder regarding your ${balanceText.toLowerCase()} of ${amountText}.\n\nPlease review and confirm.\n\nThank you!`;

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodedMessage}`;

      // Check if WhatsApp can be opened
      const canOpen = await Linking.canOpenURL(whatsappUrl);

      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp if app is not installed
        const webWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        await Linking.openURL(webWhatsappUrl);
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      showCustomAlert(
        'Error',
        'Failed to open WhatsApp. Please make sure WhatsApp is installed on your device.',
        'error',
      );
    }
  };

  const handleSendSMS = async () => {
    if (!customer?.phoneNumber) {
      showCustomAlert(
        'No Phone Number',
        'Phone number not available for this contact',
        'warning',
      );
      return;
    }

    try {
      // Format phone number (remove spaces, dashes, and parentheses)
      let phoneNumber = customer.phoneNumber.replace(/[\s\-\(\)]/g, '');

      // If phone number doesn't start with country code, add +91 for India
      if (!phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '+91' + phoneNumber.substring(1);
        } else if (phoneNumber.length === 10) {
          phoneNumber = '+91' + phoneNumber;
        } else {
          phoneNumber = '+91' + phoneNumber;
        }
      }

      // Create message with balance amount
      const balanceText = balanceType === 'receipt' ? 'Receipt' : 'Payment';
      const amountText = `₹${Math.abs(balance).toLocaleString('en-IN')}`;
      const customerName = customer.name || 'Customer';

      const message = `Hi ${customerName},\n\nThis is a reminder regarding your ${balanceText.toLowerCase()} of ${amountText}.\n\nPlease review and confirm.\n\nThank you!`;

      // Create SMS URL
      const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;

      // Check if SMS can be opened
      const canOpen = await Linking.canOpenURL(smsUrl);

      if (canOpen) {
        await Linking.openURL(smsUrl);
      } else {
        // Fallback: try without country code
        const localPhoneNumber = phoneNumber.replace('+91', '');
        const fallbackSmsUrl = `sms:${localPhoneNumber}?body=${encodeURIComponent(
          message,
        )}`;
        await Linking.openURL(fallbackSmsUrl);
      }
    } catch (error) {
      console.error('Error opening SMS:', error);
      showCustomAlert(
        'Error',
        'Failed to open SMS. Please make sure your device supports SMS.',
        'error',
      );
    }
  };

  const handleCall = async () => {
    if (customer?.phoneNumber) {
      try {
        const phoneUrl = `tel:${customer.phoneNumber}`;
        const canOpen = await Linking.canOpenURL(phoneUrl);

        if (canOpen) {
          await Linking.openURL(phoneUrl);
        } else {
          showCustomAlert(
            'Error',
            'Unable to make phone calls on this device',
            'error',
          );
        }
      } catch (error) {
        console.error('Error opening phone dialer:', error);
        showCustomAlert(
          'Error',
          'Failed to open phone dialer. Please try again.',
          'error',
        );
      }
    } else {
      showCustomAlert(
        'No Phone Number',
        'Phone number not available for this contact',
        'warning',
      );
    }
  };

  const handleYouGave = () => {
    // Navigate to AddNewEntry screen for "gave" entry
    navigation.navigate('AddNewEntry', {
      customer: customer,
      partyType: partyType,
      entryType: 'gave',
      shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
    });
  };

  const handleYouGot = () => {
    // Navigate to AddNewEntry screen for "got" entry
    navigation.navigate('AddNewEntry', {
      customer: customer,
      partyType: partyType,
      entryType: 'got',
      shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
    });
  };

  const handleEditTransaction = (transaction: any) => {
    // Navigate to AddNewEntry screen in edit mode
    let entryType: 'gave' | 'got' = 'gave'; // default
    let showInvoiceUI = false;
    let showPurchaseUI = false;

    if (transaction.type === 'payment') {
      entryType = 'gave';
    } else if (transaction.type === 'receipt') {
      entryType = 'got';
    } else if (transaction.type === 'Purchase') {
      entryType = 'gave';
      showPurchaseUI = true;
    } else if (transaction.type === 'Sell') {
      entryType = 'got';
      showInvoiceUI = true;
    }

    navigation.navigate('AddNewEntry', {
      customer: customer,
      partyType: partyType,
      entryType: entryType,
      editingItem: transaction,
      showInvoiceUI: showInvoiceUI,
      showPurchaseUI: showPurchaseUI,
      shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
    });
  };

  const handleDeleteTransaction = async (transaction: any) => {
    showCustomAlert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
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
          await unifiedApi.deleteTransaction(transaction.id);

          showCustomAlert(
            'Success',
            'Transaction deleted successfully!',
            'success',
          );
          // Refresh the transactions list
          fetchTransactions();
        } catch (error: any) {
          console.error('Error deleting transaction:', error);
          showCustomAlert(
            'Error',
            error.message || 'Failed to delete transaction. Please try again.',
            'error',
          );
        }
      },
      undefined,
      'Delete',
      'Cancel',
    );
  };

  const renderTransactionItem = ({ item }: { item: any }) => {
    // Regular transaction rendering
    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => handleEditTransaction(item)}
        activeOpacity={0.8}
      >
        <View style={styles.transactionLeft}>
          <Text style={styles.transactionDescription}>
            {item.billNumber ||
              `${
                item.type === 'payment'
                  ? 'PAY'
                  : item.type === 'receipt'
                  ? 'REC'
                  : item.type === 'Purchase'
                  ? 'PUR'
                  : item.type === 'Sell'
                  ? 'SEL'
                  : 'TXN'
              }-${item.id}`}
          </Text>
          <View style={styles.transactionMetaContainer}>
            <Text style={styles.transactionDate}>
              {new Date(item.date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.transactionMethod}>
              {item.method && item.method.trim() !== '' ? item.method : 'Cash'}
            </Text>
          </View>
        </View>

        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.amountText,
              {
                color:
                  item.type === 'payment' || item.type === 'Purchase'
                    ? '#dc3545'
                    : '#28a745',
              },
            ]}
          >
            ₹{Math.abs(Number(item.amount)).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.amountLabel}>
            {item.type === 'payment'
              ? 'Payment'
              : item.type === 'receipt'
              ? 'Receipt'
              : item.type === 'Purchase'
              ? 'Purchase'
              : item.type === 'Sell'
              ? 'Sell'
              : 'Transaction'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOpeningBalanceCard = () => {
    // Only show opening balance if there are no voucher transactions
    if (
      recentTransactions.length === 0 &&
      customer?.openingBalance &&
      customer.openingBalance !== 0
    ) {
      const hasTime =
        customer?.createdAt &&
        new Date(customer.createdAt).getHours() !== 0 &&
        new Date(customer.createdAt).getMinutes() !== 0;

      return (
        <View style={styles.openingBalanceItem}>
          <View style={styles.openingBalanceLeft}>
            <Text style={styles.openingBalanceDateTime}>
              {customer?.createdAt
                ? new Date(customer.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'N/A'}
              {hasTime
                ? ` • ${new Date(customer.createdAt).toLocaleTimeString(
                    'en-US',
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    },
                  )}`
                : ''}
            </Text>
            <Text style={styles.openingBalanceText}>
              Balance:{' '}
              {customer?.openingBalance && customer.openingBalance > 0
                ? '+'
                : ''}
              {customer?.openingBalance
                ? Math.abs(Number(customer.openingBalance)).toLocaleString(
                    'en-IN',
                  )
                : '0'}
            </Text>
            <View style={styles.openingBalanceHighlight}>
              <Text style={styles.openingBalanceLabel}>Opening Balance</Text>
            </View>
          </View>

          <View style={styles.openingBalanceRight}>
            <View style={styles.openingBalanceAmountContainer}>
              <Text
                style={[
                  styles.openingBalanceAmount,
                  {
                    color:
                      customer?.openingBalance && customer.openingBalance > 0
                        ? '#28a745'
                        : '#dc3545',
                  },
                ]}
              >
                ₹
                {customer?.openingBalance
                  ? Number(Math.abs(customer.openingBalance)).toLocaleString(
                      'en-IN',
                    )
                  : '0'}
              </Text>
            </View>
            <View style={styles.openingBalanceIndicator} />
          </View>
        </View>
      );
    }
    return null;
  };

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
          style={styles.backButton}
          onPress={() => {
            console.log(
              '🔄 CustomerDetailScreen: Back button pressed, navigating to CustomerScreen with refresh',
            );
            navigation.navigate('Customer', { shouldRefresh: true });
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={27} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{customer.avatar}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text
                style={styles.customerName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {customer.name}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleViewSettings}
            style={styles.viewSettingsButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={23}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <MaterialCommunityIcons name="phone" size={25} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Fixed Content - Balance Summary Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>
              {balanceType === 'receipt' ? 'Receipt' : 'Payment'}
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                { color: balanceType === 'receipt' ? '#28a745' : '#dc3545' },
              ]}
            >
              ₹{Math.abs(balance).toLocaleString()}
            </Text>
          </View>

          <View style={styles.reminderSection}>
            <View style={styles.reminderInfo}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={20}
                color="#666"
              />
              <Text style={styles.reminderText}>Set collection reminder</Text>
            </View>
            <TouchableOpacity
              style={styles.setDateButton}
              onPress={undefined}
              disabled={true}
            >
              <Text style={styles.setDateText}>SET DATE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fixed Content - Action Buttons */}
        {recentTransactions.length > 0 ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleGenerateReport}
            >
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={24}
                color="#666"
              />
              <Text style={styles.actionButtonText}>Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSendReminder}
            >
              <MaterialCommunityIcons
                name="whatsapp"
                size={24}
                color="#25D366"
              />
              <Text style={styles.actionButtonText}>Reminder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSendSMS}
            >
              <MaterialCommunityIcons
                name="message-text"
                size={24}
                color="#666"
              />
              <Text style={styles.actionButtonText}>SMS</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Fixed Content - Transaction Header */}
        {recentTransactions.length > 0 ? (
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionTitle}>ENTRIES</Text>
            <View style={styles.transactionColumns}>
              <Text style={styles.columnText}>Amount</Text>
            </View>
          </View>
        ) : null}

        {/* Scrollable Content - Transactions List Only */}
        <View style={styles.scrollableContainer}>
          {loadingTransactions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f8cff" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : apiError ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={48}
                color="#dc3545"
              />
              <Text style={styles.errorText}>{apiError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchTransactions}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : recentTransactions.length === 0 ? (
            <View style={styles.noEntriesContainer}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={48}
                color="#ccc"
              />
              <Text style={styles.noEntriesTitle}>No Recent Entries</Text>
              <Text style={styles.noEntriesSubtitle}>
                {partyType === 'customer'
                  ? 'No transactions found for this customer yet.'
                  : 'No transactions found for this supplier yet.'}
              </Text>
              <Text style={styles.noEntriesHint}>
                Use the buttons below to add new transactions
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.transactionsScrollView}
              contentContainerStyle={styles.transactionsScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={true}
            >
              {recentTransactions.map((item, index) => (
                <View key={String(item.id)}>
                  {renderTransactionItem({ item })}
                </View>
              ))}
              {renderOpeningBalanceCard()}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Bottom Action Buttons - Four Options */}
      {/* <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'payment' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('payment');
            handleYouGave();
          }}
        >
          <MaterialCommunityIcons
            name="credit-card-outline"
            size={selectedAction === 'payment' ? 24 : 22}
            color={selectedAction === 'payment' ? '#dc3545' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'payment' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Payment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'receipt' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('receipt');
            handleYouGot();
          }}
        >
          <MaterialCommunityIcons
            name="receipt"
            size={selectedAction === 'receipt' ? 24 : 22}
            color={selectedAction === 'receipt' ? '#28a745' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'receipt' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Receipt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'purchase' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('purchase');
            // Navigate to Purchase entry (using 'gave' as entryType)
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'gave',
            });
          }}
        >
          <MaterialCommunityIcons
            name="cart-outline"
            size={selectedAction === 'purchase' ? 24 : 22}
            color={selectedAction === 'purchase' ? '#ff9500' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'purchase' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Purchase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'sell' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('sell');
            // Navigate to Sell entry (using 'got' as entryType)
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'got',
              showInvoiceUI: true, // Show invoice UI for Sell entries
            });
          }}
        >
          <MaterialCommunityIcons
            name="trending-up"
            size={selectedAction === 'sell' ? 24 : 22}
            color={selectedAction === 'sell' ? '#9c27b0' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'sell' && styles.actionButtonTextSmallSelected,
            ]}
          >
            Sell
          </Text>
        </TouchableOpacity>
      </View> */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'payment' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('payment');
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'gave',
              shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
            });
          }}
        >
          <MaterialCommunityIcons
            name="credit-card-outline"
            size={selectedAction === 'payment' ? 22 : 20}
            color={selectedAction === 'payment' ? '#4f8cff' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'payment' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Payment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'receipt' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('receipt');
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'got',
              shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
            });
          }}
        >
          <MaterialCommunityIcons
            name="receipt"
            size={selectedAction === 'receipt' ? 22 : 20}
            color={selectedAction === 'receipt' ? '#4f8cff' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'receipt' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Receipt
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'purchase' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('purchase');
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'gave',
              showPurchaseUI: true, // New parameter to show purchase UI
              shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
            });
          }}
        >
          <MaterialCommunityIcons
            name="cart-outline"
            size={selectedAction === 'purchase' ? 22 : 20}
            color={selectedAction === 'purchase' ? '#4f8cff' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'purchase' &&
                styles.actionButtonTextSmallSelected,
            ]}
          >
            Purchase
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButtonSmall,
            selectedAction === 'sell' && styles.actionButtonSmallSelected,
          ]}
          onPress={() => {
            setSelectedAction('sell');
            navigation.navigate('AddNewEntry', {
              customer: customer,
              partyType: partyType,
              entryType: 'got',
              showInvoiceUI: true, // Show invoice UI for Sell entries
              shouldRefresh: true, // Tell CustomerDetailScreen to refresh when returning
            });
          }}
        >
          <MaterialCommunityIcons
            name="trending-up"
            size={selectedAction === 'sell' ? 22 : 20}
            color={selectedAction === 'sell' ? '#4f8cff' : '#64748b'}
          />
          <Text
            style={[
              styles.actionButtonTextSmall,
              selectedAction === 'sell' && styles.actionButtonTextSmallSelected,
            ]}
          >
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          is24Hour={false}
        />
      )}

      {/* Custom Alert Modal */}
      {customAlert.visible && (
        <View style={styles.alertOverlay}>
          <View style={styles.alertContainer}>
            {/* Alert Icon with Background Circle */}
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
                size={40}
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

            {/* Alert Title */}
            <Text style={styles.alertTitle}>{customAlert.title}</Text>

            {/* Alert Message */}
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            {/* Alert Buttons */}
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
    paddingHorizontal: uiLayout.containerPaddingH,
    paddingVertical: 30,
  },
  headerBackButton: {
    padding: 10,
    borderRadius: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: uiColors.primaryBlue,
    fontSize: 20,
    fontFamily: uiFonts.family,
  },

  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  customerName: {
    color: uiColors.textHeader,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 0,
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
    flex: 1,
    marginRight: 8,
  },

  partyTypeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  partyTypeText: {
    color: uiColors.textHeader,
    fontSize: 9,
    letterSpacing: 0.1,
    fontFamily: uiFonts.family,
  },

  viewSettingsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    letterSpacing: 0.1,
    fontFamily: uiFonts.family,
  },
  viewSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: uiLayout.containerPaddingH,
  },
  scrollableContainer: {
    flex: 1,
    marginTop: 12,
  },
  transactionsScrollView: {
    flex: 1,
  },
  transactionsScrollContent: {
    paddingBottom: 80,
  },
  balanceCard: {
    backgroundColor: uiColors.bgCard,
    borderRadius: 12,
    padding: uiLayout.cardPadding,
    marginTop: 12,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: uiFonts.family,
  },

  balanceAmount: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  reminderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: uiFonts.family,
  },

  setDateButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  setDateText: {
    color: uiColors.textHeader,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: uiColors.bgCard,
    borderRadius: 12,
    paddingHorizontal: uiLayout.cardPadding,
    paddingVertical: 10,
    marginTop: 10,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: uiFonts.family,
  },

  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: uiColors.bgMain,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    marginHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: uiColors.borderLight,
  },
  transactionTitle: {
    fontSize: 14,
    color: '#334155',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  transactionColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  columnText: {
    // fontSize: 8,
    fontSize: 12,
    color: '#64748b',
    letterSpacing: 0.1,
    fontFamily: uiFonts.family,
  },

  // bottomButtons: {
  //   position: 'absolute',
  //   bottom: 0,
  //   left: 0,
  //   right: 0,
  //   flexDirection: 'row',
  //   margin: 8,
  //   paddingHorizontal: 16,
  //   paddingBottom: 4,
  //   paddingTop: 4,
  //   backgroundColor: '#86a1ce',
  //   borderTopWidth: 1,
  //   borderTopColor: '#f1f5f9',
  //   gap: 12,
  // },
  // actionButtonSmall: {
  //   flex: 1,
  //   backgroundColor: '#86a1ce',
  //   paddingVertical: 8,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   borderRadius: 10,
  //   minHeight: 60,
  //   // borderWidth: 1,
  //   // borderColor: '#e2e8f0',
  // },
  // actionButtonSmallSelected: {
  //   backgroundColor: '#86a1ce',
  //   borderColor: '#0ea5e9',
  //   // borderWidth: 2,
  // },
  // actionButtonTextSmall: {
  //   color: '#000000',
  //   fontSize: 12,
  //,
  //   marginTop: 6,
  //   textAlign: 'center',
  //   letterSpacing: 0.2,
  //   fontFamily: 'Roboto-Medium',
  // },

  // actionButtonTextSmallSelected: {
  //   color: '#FFFFFF',
  //,
  //   fontSize: 13,
  //   letterSpacing: 0.3,
  //   fontFamily: 'Roboto-Medium',
  // },

  // Inside the styles = StyleSheet.create({...}) block

  // Remove the old bottom button styles and replace with these:

  bottomButtons: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Subtle primary-tinted background to match screen theme
    backgroundColor: '#eef4ff',
    borderRadius: 30,
    // Tightened paddings for a slimmer pill
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },

  actionButtonSmall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  actionButtonSmallSelected: {
    backgroundColor: '#e8f0fe', // A light blue tint for the background
    borderRadius: 20,
    paddingVertical: 6,
  },

  actionButtonTextSmall: {
    // Slightly larger for readability
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 4,
    fontFamily: uiFonts.family,
  },

  actionButtonTextSmallSelected: {
    color: '#2563eb', // A slightly darker, more vivid blue for the active text
    fontWeight: '700',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6fafc',
  },
  errorText: {
    fontSize: 16,
    color: uiColors.errorRed,

    fontFamily: uiFonts.family,
  },

  noEntriesContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: uiColors.bgCard,
    borderRadius: 10,
    marginTop: 14,
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  noEntriesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  noEntriesSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
    fontFamily: uiFonts.family,
  },

  noEntriesHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
    fontFamily: uiFonts.family,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: uiFonts.family,
  },

  retryButton: {
    marginTop: 20,
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: uiColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 7.5,
    marginBottom: 10,
    marginHorizontal: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  transactionLeft: {
    flex: 1,
    marginRight: 13.5,
  },
  transactionRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
    lineHeight: 18,
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  transactionMetaContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  transactionDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 1.5,
    fontFamily: uiFonts.family,
  },

  transactionMethod: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  amountText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: 0.4,
    fontFamily: uiFonts.family,
  },

  amountLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  openingBalanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 7.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 7.5,
    marginBottom: 7.5,
    marginHorizontal: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  openingBalanceLeft: {
    flex: 1,
    marginRight: 13.5,
  },
  openingBalanceRight: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  openingBalanceDateTime: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  openingBalanceText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  openingBalanceHighlight: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7.5,
    paddingVertical: 3.75,
    borderRadius: 4.5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  openingBalanceLabel: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  openingBalanceAmountContainer: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  openingBalanceAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: uiFonts.family,
  },

  openingBalanceIndicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#fbbf24',
    marginTop: 7.5,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  // Custom Alert Styles - Mobile App Design
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 15,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 24,
    marginHorizontal: 15,
    maxWidth: 255,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  alertIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 15,
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 9,
    letterSpacing: 0.3,
    fontFamily: uiFonts.family,
  },

  alertMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 6,
    fontFamily: uiFonts.family,
  },

  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1.5,
    borderColor: '#e9ecef',
  },
  alertButtonConfirm: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  alertButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },

  alertButtonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: uiColors.textHeader,
    letterSpacing: 0.2,
    fontFamily: uiFonts.family,
  },
});

export default CustomerDetailScreen;
