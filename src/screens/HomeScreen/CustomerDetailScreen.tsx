import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
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
import { AppStackParamList } from '../../types/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { getToken, getUserIdFromToken } from '../../utils/storage';

const { width } = Dimensions.get('window');

const CustomerDetailScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'CustomerDetail'>>();
  const { customer, partyType, refresh } = route.params || {};
  const isFocused = useIsFocused();

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

      // Fetch all vouchers and filter by party name
      const res = await fetch(`${BASE_URL}/vouchers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || `Failed to fetch transactions: ${res.status}`,
        );
      }

      const data = await res.json();

      // Add validation for API response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid API response format');
      }

      const vouchers = Array.isArray(data.data) ? data.data : [];

      console.log('🔍 CustomerDetailScreen: Raw voucher data:', {
        totalVouchers: vouchers.length,
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phoneNumber,
        sampleVouchers: vouchers.slice(0, 5).map((v: any) => ({
          id: v.id,
          customerId: v.customerId,
          partyName: v.partyName,
          supplierName: v.supplierName,
          phoneNumber: v.phoneNumber,
          type: v.type,
          amount: v.amount,
        })),
      });

      // Filter transactions by this customer/supplier
      // Priority: customerId > partyName (to avoid confusion with similar names)
      const customerTransactions = vouchers.filter((v: any) => {
        // First try to match by customerId if available
        if (
          v.customerId &&
          customer?.id &&
          String(v.customerId) === String(customer.id)
        ) {
          return true;
        }

        // Fallback to party name matching (for backward compatibility)
        // But add additional validation to ensure it's the same customer
        if (
          v.partyName === customer?.name ||
          v.supplierName === customer?.name
        ) {
          // Additional check: if we have phone number, verify it matches
          if (customer?.phoneNumber && v.phoneNumber) {
            return customer.phoneNumber === v.phoneNumber;
          }
          // If no phone number, use name matching but log a warning
          console.warn(
            `⚠️ Using name-based matching for customer: ${customer?.name}. Consider using customerId for more accurate results.`,
          );
          return true;
        }

        return false;
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

      customerTransactions.forEach((voucher: any) => {
        const amount = parseFloat(voucher.amount) || 0;
        if (voucher.type === 'receipt' || voucher.type === 'Sell') {
          totalReceipts += amount; // Money coming in (you get)
        } else if (voucher.type === 'payment' || voucher.type === 'Purchase') {
          totalPayments += amount; // Money going out (you give)
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
    showCustomAlert(
      'Set Reminder',
      'Set collection reminder for this customer',
      'info',
    );
  };

  const handleGenerateReport = () => {
    showCustomAlert(
      'Generate Report',
      'Generate report for this customer',
      'info',
    );
  };

  const handleSendReminder = () => {
    showCustomAlert('Send Reminder', 'Send reminder via WhatsApp', 'info');
  };

  const handleSendSMS = () => {
    showCustomAlert('Send SMS', 'Send reminder via SMS', 'info');
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

          const res = await fetch(`${BASE_URL}/vouchers/${transaction.id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ message: 'Unknown error occurred' }));
            throw new Error(
              err.message ||
                `Failed to delete transaction. Status: ${res.status}`,
            );
          }

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4f8cff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log(
              '🔄 CustomerDetailScreen: Back button pressed, navigating to CustomerScreen with refresh',
            );
            navigation.navigate('Customer', { shouldRefresh: true });
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{customer.avatar}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.customerName}>{customer.name}</Text>
            <View style={styles.partyTypeContainer}>
              <Text style={styles.partyTypeText}>
                {partyType === 'customer' ? 'Customer' : 'Supplier'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleViewSettings}>
              <Text style={styles.viewSettingsText}>View settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <MaterialCommunityIcons name="phone" size={20} color="#fff" />
        </TouchableOpacity>
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
              onPress={handleSetReminder}
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
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    color: '#4f8cff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  customerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  partyTypeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  partyTypeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  viewSettingsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  setDateButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  setDateText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
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
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    marginHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transactionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  transactionColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  columnText: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.1,
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
  //   fontWeight: '600',
  //   marginTop: 6,
  //   textAlign: 'center',
  //   letterSpacing: 0.2,
  // },
  // actionButtonTextSmallSelected: {
  //   color: '#FFFFFF',
  //   fontWeight: '700',
  //   fontSize: 13,
  //   letterSpacing: 0.3,
  // },
  // Inside the styles = StyleSheet.create({...}) block

  // Remove the old bottom button styles and replace with these:

  bottomButtons: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b', // Neutral gray for inactive text
    marginTop: 4,
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
    color: '#dc3545',
    fontWeight: 'bold',
  },
  noEntriesContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
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
  },
  noEntriesSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  noEntriesHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
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
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#4f8cff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 7.5,
    marginBottom: 7.5,
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
    fontSize: 11.25,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
    lineHeight: 16.5,
    letterSpacing: 0.2,
  },
  transactionMetaContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  transactionDate: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 1.5,
  },
  transactionMethod: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  amountText: {
    fontSize: 12.75,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: 0.4,
  },
  amountLabel: {
    fontSize: 8.25,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  openingBalanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 7.5,
    padding: 12,
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
    fontSize: 8.25,
    color: '#64748b',
    marginBottom: 4.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  openingBalanceText: {
    fontSize: 9.75,
    color: '#334155',
    marginBottom: 4.5,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    fontSize: 8.25,
    color: '#92400e',
    fontWeight: '700',
    letterSpacing: 0.3,
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
    fontSize: 12.75,
    fontWeight: '800',
    letterSpacing: 0.4,
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
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 9,
    letterSpacing: 0.3,
  },
  alertMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 6,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
    letterSpacing: 0.2,
  },
  alertButtonConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
});

export default CustomerDetailScreen;
