import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types/navigation';
import { useVouchers } from '../../context/VoucherContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
import LoadingScreen from '../../components/LoadingScreen';

// Global cache for GSTSummaryScreen
let globalGSTCache: any = null;
let globalGSTCacheChecked = false;

// Function to clear global cache
export const clearGSTCache = () => {
  globalGSTCache = null;
  globalGSTCacheChecked = false;
};

const { width, height } = Dimensions.get('window');

const GSTSummaryScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { vouchers } = useVouchers();
  const [selectedPeriod, setSelectedPeriod] = useState('Current Month');
  const [loading, setLoading] = useState(!globalGSTCacheChecked);
  const [refreshing, setRefreshing] = useState(false);
  const [gstData, setGstData] = useState<any>(globalGSTCache);

  // Check for cached data on component mount
  useEffect(() => {
    checkCachedData();
  }, []);

  const checkCachedData = () => {
    // If we already have global cache, use it immediately
    if (globalGSTCacheChecked) {
      setGstData(globalGSTCache);
      setLoading(false);
      // Calculate fresh data in background
      setTimeout(() => calculateGSTData(true), 100);
      return;
    }

    // Calculate data and update cache
    calculateGSTData();
  };

  // Calculate GST data from vouchers
  useEffect(() => {
    if (globalGSTCacheChecked) {
      calculateGSTData(true);
    }
  }, [vouchers]);

  const calculateGSTData = (isRefresh = false) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyVouchers = vouchers.filter(voucher => {
      const voucherDate = new Date(voucher.date);
      return (
        voucherDate.getMonth() === currentMonth &&
        voucherDate.getFullYear() === currentYear
      );
    });

    const sales = monthlyVouchers.filter(v => v.type === 'invoice');
    const purchases = monthlyVouchers.filter(v => v.type === 'purchase');

    // Calculate output GST (from sales)
    const outputGST = sales.reduce((total, sale) => {
      return total + Number(sale.amount) * 0.18; // Assuming 18% GST
    }, 0);

    // Calculate input GST (from purchases)
    const inputGST = purchases.reduce((total, purchase) => {
      return total + Number(purchase.amount) * 0.18; // Assuming 18% GST
    }, 0);

    // Calculate net GST payable
    const netGST = outputGST - inputGST;

    // Calculate total sales
    const totalSales = sales.reduce(
      (total, sale) => total + Number(sale.amount),
      0,
    );

    const newGSTData = {
      totalSales,
      outputGST,
      inputGST,
      netGST,
      salesCount: sales.length,
      purchaseCount: purchases.length,
    };

    // Update global cache
    globalGSTCache = newGSTData;
    globalGSTCacheChecked = true;

    setGstData(newGSTData);

    if (!isRefresh) {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API refresh
    setTimeout(() => {
      calculateGSTData(true);
      setRefreshing(false);
    }, 1000);
  };

  const gstRates = [
    {
      rate: '28% GST',
      amount: '₹2,45,000',
      percentage: '29% of sales',
      color: '#dc3545',
    },
    {
      rate: '18% GST',
      amount: '₹4,20,000',
      percentage: '50% of sales',
      color: '#fd7e14',
    },
    {
      rate: '12% GST',
      amount: '₹1,25,000',
      percentage: '15% of sales',
      color: '#0d6efd',
    },
    {
      rate: '5% GST',
      amount: '₹55,000',
      percentage: '6% of sales',
      color: '#198754',
    },
  ];

  const recentTransactions = vouchers
    .filter(v => v.type === 'invoice' || v.type === 'purchase')
    .slice(0, 5)
    .map(voucher => ({
      title:
        voucher.type === 'invoice'
          ? `Sale to ${voucher.partyName}`
          : `Purchase from ${voucher.partyName}`,
      invoice:
        voucher.type === 'invoice'
          ? `Invoice #${voucher.invoiceNumber}`
          : `Bill #${voucher.billNumber}`,
      gstRate: '18% GST',
      amount: `₹${Number(voucher.amount).toLocaleString('en-IN')}`,
      gstAmount: `₹${(Number(voucher.amount) * 0.18).toLocaleString('en-IN')}`,
      type: voucher.type === 'invoice' ? 'sale' : 'purchase',
    }));

  if (loading) {
    return (
      <LoadingScreen
        title="Loading GST Summary"
        subtitle="Preparing your tax data..."
        icon="file-document-outline"
        tip="Tip: Keep your GST records updated for compliance"
        backgroundColor="#f6fafc"
        gradientColors={['#4f8cff', '#1ecb81']}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#222"
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>GST Summary</Text>
              <Text style={styles.headerSubtitle}>Tax compliance overview</Text>
            </View>
            <TouchableOpacity style={styles.exportButton}>
              <MaterialCommunityIcons name="download" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Period Selector */}
          <View style={styles.periodContainer}>
            <TouchableOpacity style={styles.periodButton}>
              <Text style={styles.periodText}>{selectedPeriod}</Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats Cards */}
        <View style={styles.quickStatsContainer}>
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatCard}>
              <View style={styles.quickStatIconContainer}>
                <MaterialCommunityIcons
                  name="trending-up"
                  size={20}
                  color="#198754"
                />
              </View>
              <Text style={styles.quickStatAmount}>
                {gstData
                  ? `₹${gstData.totalSales.toLocaleString('en-IN')}`
                  : '₹0'}
              </Text>
              <Text style={styles.quickStatLabel}>Total Sales</Text>
            </View>

            <View style={styles.quickStatCard}>
              <View style={styles.quickStatIconContainer}>
                <MaterialCommunityIcons
                  name="bank-outline"
                  size={20}
                  color="#dc3545"
                />
              </View>
              <Text style={styles.quickStatAmount}>
                {gstData ? `₹${gstData.netGST.toLocaleString('en-IN')}` : '₹0'}
              </Text>
              <Text style={styles.quickStatLabel}>Net GST</Text>
            </View>
          </View>
        </View>

        {/* Filing Status Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Filing Status</Text>
          <View style={styles.filingStatusContainer}>
            <TouchableOpacity style={styles.filingStatusCard}>
              <View style={styles.filingStatusHeader}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={24}
                  color="#0d6efd"
                />
                <View
                  style={[styles.statusBadge, { backgroundColor: '#198754' }]}
                >
                  <Text style={styles.statusBadgeText}>Filed</Text>
                </View>
              </View>
              <Text style={styles.filingStatusTitle}>GSTR-1</Text>
              <Text style={styles.filingStatusDate}>Due: 11th Jan</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.filingStatusCard}>
              <View style={styles.filingStatusHeader}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={24}
                  color="#dc3545"
                />
                <View
                  style={[styles.statusBadge, { backgroundColor: '#dc3545' }]}
                >
                  <Text style={styles.statusBadgeText}>Pending</Text>
                </View>
              </View>
              <Text style={styles.filingStatusTitle}>GSTR-3B</Text>
              <Text style={styles.filingStatusDate}>Due: 20th Jan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GST Breakdown Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>GST Breakdown</Text>
          <View style={styles.gstBreakdownContainer}>
            <View style={styles.gstBreakdownItem}>
              <View style={styles.gstBreakdownLeft}>
                <View
                  style={[
                    styles.gstRateIndicator,
                    { backgroundColor: '#0d6efd' },
                  ]}
                />
                <Text style={styles.gstBreakdownLabel}>Output GST</Text>
              </View>
              <Text style={styles.gstBreakdownAmount}>
                {gstData
                  ? `₹${gstData.outputGST.toLocaleString('en-IN')}`
                  : '₹0'}
              </Text>
            </View>

            <View style={styles.gstBreakdownItem}>
              <View style={styles.gstBreakdownLeft}>
                <View
                  style={[
                    styles.gstRateIndicator,
                    { backgroundColor: '#6f42c1' },
                  ]}
                />
                <Text style={styles.gstBreakdownLabel}>Input GST</Text>
              </View>
              <Text style={styles.gstBreakdownAmount}>
                {gstData
                  ? `₹${gstData.inputGST.toLocaleString('en-IN')}`
                  : '₹0'}
              </Text>
            </View>

            <View style={styles.gstBreakdownDivider} />

            <View style={styles.gstBreakdownItem}>
              <View style={styles.gstBreakdownLeft}>
                <View
                  style={[
                    styles.gstRateIndicator,
                    { backgroundColor: '#dc3545' },
                  ]}
                />
                <Text
                  style={[
                    styles.gstBreakdownLabel,
                    styles.gstBreakdownLabelBold,
                  ]}
                >
                  Net Payable
                </Text>
              </View>
              <Text
                style={[
                  styles.gstBreakdownAmount,
                  styles.gstBreakdownAmountBold,
                ]}
              >
                {gstData ? `₹${gstData.netGST.toLocaleString('en-IN')}` : '₹0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllButtonText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsContainer}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction, index) => (
                <TouchableOpacity key={index} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    <View style={styles.transactionIconContainer}>
                      <MaterialCommunityIcons
                        name={
                          transaction.type === 'sale'
                            ? 'trending-up'
                            : 'trending-down'
                        }
                        size={16}
                        color={
                          transaction.type === 'sale' ? '#198754' : '#dc3545'
                        }
                      />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionTitle} numberOfLines={1}>
                        {transaction.title}
                      </Text>
                      <Text style={styles.transactionInvoice} numberOfLines={1}>
                        {transaction.invoice}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text
                      style={[
                        styles.transactionAmount,
                        {
                          color:
                            transaction.type === 'sale' ? '#198754' : '#dc3545',
                        },
                      ]}
                    >
                      {transaction.amount}
                    </Text>
                    <Text style={styles.transactionGst}>
                      GST: {transaction.gstAmount}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyTransactionsContainer}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={48}
                  color="#ccc"
                  style={{ marginBottom: 16 }}
                />
                <Text style={styles.emptyTransactionsTitle}>
                  No GST Transactions
                </Text>
                <Text style={styles.emptyTransactionsSubtitle}>
                  Your GST transactions will appear here once you start creating
                  invoices or purchases.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Alerts Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.alertsHeader}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={20}
              color="#fd7e14"
            />
            <Text style={styles.alertsTitle}>Compliance Alerts</Text>
          </View>

          {/* GSTR-3B Alert */}
          <TouchableOpacity style={styles.alertCard}>
            <View style={styles.alertCardHeader}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={20}
                color="#dc3545"
              />
              <Text style={styles.alertCardTitle}>GSTR-3B Filing Due</Text>
            </View>
            <Text style={styles.alertMessage}>
              Due on 20th January • Net payable:
              <Text style={styles.alertAmount}>
                {gstData
                  ? ` ₹${gstData.netGST.toLocaleString('en-IN')}`
                  : ' ₹0'}
              </Text>
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertPrimaryButton}>
                <Text style={styles.alertPrimaryButtonText}>File Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertSecondaryButton}>
                <Text style={styles.alertSecondaryButtonText}>
                  Remind Later
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Input Credit Alert */}
          <TouchableOpacity style={styles.alertCard}>
            <View style={styles.alertCardHeader}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={20}
                color="#198754"
              />
              <Text style={styles.alertCardTitle}>Input Credit Ready</Text>
            </View>
            <Text style={styles.alertMessage}>
              Input GST credit of
              <Text style={[styles.alertAmount, { color: '#198754' }]}>
                {gstData
                  ? ` ₹${gstData.inputGST.toLocaleString('en-IN')}`
                  : ' ₹0'}
              </Text>{' '}
              available for claim
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#222',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f8cff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodContainer: {
    alignItems: 'center',
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,

    fontFamily: 'Roboto-Medium',
  },

  quickStatsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickStatIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStatAmount: {
    fontSize: 18,
    color: '#222',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  quickStatLabel: {
    fontSize: 12,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#222',
    marginBottom: 12,

    fontFamily: 'Roboto-Medium',
  },

  filingStatusContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  filingStatusCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filingStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  filingStatusTitle: {
    fontSize: 16,
    color: '#222',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  filingStatusDate: {
    fontSize: 12,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  gstBreakdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  gstBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  gstBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gstRateIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  gstBreakdownLabel: {
    fontSize: 16,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  gstBreakdownLabelBold: {
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },
  gstBreakdownAmount: {
    fontSize: 16,
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },

  gstBreakdownAmountBold: {
    fontSize: 18,

    fontFamily: 'Roboto-Medium',
  },

  gstBreakdownDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f6ff',
  },
  viewAllButtonText: {
    fontSize: 12,
    color: '#4f8cff',

    fontFamily: 'Roboto-Medium',
  },

  transactionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    color: '#222',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  transactionInvoice: {
    fontSize: 12,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 14,
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  transactionGst: {
    fontSize: 11,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  emptyTransactionsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTransactionsTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  emptyTransactionsSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  alertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertsTitle: {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertCardTitle: {
    fontSize: 16,
    color: '#222',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  alertMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,

    fontFamily: 'Roboto-Medium',
  },

  alertAmount: {
    color: '#dc3545',

    fontFamily: 'Roboto-Medium',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alertPrimaryButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  alertPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,

    fontFamily: 'Roboto-Medium',
  },

  alertSecondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  alertSecondaryButtonText: {
    color: '#666',
    fontSize: 14,

    fontFamily: 'Roboto-Medium',
  },
});

export default GSTSummaryScreen;
