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
import { BarChart, PieChart } from 'react-native-chart-kit';
import LoadingScreen from '../../components/LoadingScreen';

// Global cache for CashFlowScreen
let globalCashFlowCache: any = null;
let globalCashFlowCacheChecked = false;

// Function to clear global cache
export const clearCashFlowCache = () => {
  globalCashFlowCache = null;
  globalCashFlowCacheChecked = false;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenWidth < 400;

type CashFlowNavigationProp = StackNavigationProp<RootStackParamList, 'App'>;

interface CashFlowData {
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
  cashInChange: number;
  cashOutChange: number;
  netFlowChange: number;
}

interface MonthlyData {
  month: string;
  cashIn: number;
  cashOut: number;
  netFlow: number;
}

interface WeeklyData {
  week: string;
  cashIn: number;
  cashOut: number;
}

interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface CashFlowInsight {
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}

const CashFlowScreen: React.FC = () => {
  console.log('CashFlowScreen rendered');
  const navigation = useNavigation<CashFlowNavigationProp>();
  const { vouchers, setAllVouchers } = useVouchers();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(!globalCashFlowCacheChecked);
  const [selectedPeriod, setSelectedPeriod] = useState('Current Month');
  const [cashFlowData, setCashFlowData] = useState<CashFlowData>(
    globalCashFlowCache || {
      totalCashIn: 175000,
      totalCashOut: 112000,
      netCashFlow: 63000,
      openingBalance: 245000,
      closingBalance: 308000,
      cashInChange: 12,
      cashOutChange: 8,
      netFlowChange: 15,
    },
  );

  const [monthlyData] = useState<MonthlyData[]>([
    { month: 'Jan', cashIn: 125000, cashOut: 85000, netFlow: 40000 },
    { month: 'Feb', cashIn: 140000, cashOut: 90000, netFlow: 50000 },
    { month: 'Mar', cashIn: 135000, cashOut: 88000, netFlow: 48000 },
    { month: 'Apr', cashIn: 170000, cashOut: 105000, netFlow: 65000 },
    { month: 'May', cashIn: 150000, cashOut: 95000, netFlow: 55000 },
    { month: 'Jun', cashIn: 175000, cashOut: 110000, netFlow: 65000 },
  ]);

  const [weeklyData] = useState<WeeklyData[]>([
    { week: 'Week 1', cashIn: 45000, cashOut: 30000 },
    { week: 'Week 2', cashIn: 48000, cashOut: 32000 },
    { week: 'Week 3', cashIn: 42000, cashOut: 31000 },
    { week: 'Week 4', cashIn: 58000, cashOut: 29000 },
  ]);

  const [expenseCategories] = useState<ExpenseCategory[]>([
    {
      name: 'Operating Expenses',
      amount: 65000,
      percentage: 58.0,
      color: '#FF6B6B',
    },
    { name: 'Inventory', amount: 25000, percentage: 22.3, color: '#FFA726' },
    { name: 'Marketing', amount: 12000, percentage: 10.7, color: '#FF80AB' },
    {
      name: 'Other Expenses',
      amount: 10000,
      percentage: 8.9,
      color: '#9E9E9E',
    },
  ]);

  const [cashFlowInsights] = useState<CashFlowInsight[]>([
    {
      title: 'Positive Trend',
      description:
        'Your net cash flow has improved by 15% compared to last month, indicating healthy business growth.',
      icon: 'trending-up',
      color: '#4CAF50',
      bgColor: '#E8F5E8',
    },
    {
      title: 'Cash Position',
      description:
        'Current cash position is strong with ₹3.08L closing balance, providing good liquidity cushion.',
      icon: 'currency-inr',
      color: '#2196F3',
      bgColor: '#E3F2FD',
    },
    {
      title: 'Seasonal Pattern',
      description:
        'Cash inflows show consistent growth pattern. Consider planning for seasonal variations.',
      icon: 'calendar',
      color: '#FF9800',
      bgColor: '#FFF3E0',
    },
  ]);

  const [forecastData] = useState([
    { month: 'Next Month', value: 68000, growth: 8, color: '#2196F3' },
    { month: 'Month 2', value: 72000, growth: 6, color: '#4CAF50' },
    { month: 'Month 3', value: 75000, growth: 4, color: '#9C27B0' },
  ]);

  // Check for cached data on component mount
  useEffect(() => {
    checkCachedData();
  }, []);

  const checkCachedData = () => {
    // If we already have global cache, use it immediately
    if (globalCashFlowCacheChecked) {
      setCashFlowData(globalCashFlowCache);
      setLoading(false);
      // Calculate fresh data in background
      setTimeout(() => calculateCashFlowData(true), 100);
      return;
    }

    // Calculate data and update cache
    calculateCashFlowData();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      calculateCashFlowData(true);
    } catch (error) {
      console.error('Error refreshing cash flow data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const calculateCashFlowData = (isRefresh = false) => {
    if (!vouchers) return;

    let totalCashIn = 0;
    let totalCashOut = 0;

    vouchers.forEach(voucher => {
      if (voucher.type === 'Invoice' || voucher.type === 'Receipt') {
        totalCashIn += voucher.amount || 0;
      } else if (voucher.type === 'Payment' || voucher.type === 'Purchase') {
        totalCashOut += voucher.amount || 0;
      }
    });

    const netCashFlow = totalCashIn - totalCashOut;
    const closingBalance = cashFlowData.openingBalance + netCashFlow;

    const newCashFlowData = {
      ...cashFlowData,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      closingBalance,
    };

    // Update global cache
    globalCashFlowCache = newCashFlowData;
    globalCashFlowCacheChecked = true;

    setCashFlowData(newCashFlowData);

    if (!isRefresh) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (globalCashFlowCacheChecked) {
      calculateCashFlowData(true);
    }
  }, [vouchers]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value}%`;
  };

  // Enhanced mobile-friendly chart configuration
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#f0f0f0',
      strokeWidth: 1,
    },
  };

  const barChartData = {
    labels: monthlyData.map(d => d.month),
    datasets: [
      {
        data: monthlyData.map(d => d.cashIn),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: monthlyData.map(d => d.cashOut),
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: monthlyData.map(d => d.netFlow),
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const weeklyBarChartData = {
    labels: weeklyData.map(d => d.week),
    datasets: [
      {
        data: weeklyData.map(d => d.cashIn),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: weeklyData.map(d => d.cashOut),
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const pieChartData = [
    {
      name: 'Sales Revenue',
      amount: 175000,
      color: '#4CAF50',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'Service Income',
      amount: 45000,
      color: '#2196F3',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'Other Income',
      amount: 15000,
      color: '#9C27B0',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
  ];

  if (loading) {
    return (
      <LoadingScreen
        title="Loading Cash Flow"
        subtitle="Preparing your financial data..."
        icon="cash-multiple"
        tip="Tip: Monitor your cash flow regularly for better financial health"
        backgroundColor="#f6fafc"
        gradientColors={['#4f8cff', '#1ecb81']}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Mobile Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
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
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Cash Flow Report</Text>
              <Text style={styles.headerSubtitle}>
                Monitor your business cash inflows and outflows
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.periodButton}>
              <Text style={styles.periodText}>{selectedPeriod}</Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color="#666"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton}>
              <MaterialCommunityIcons name="download" size={16} color="#fff" />
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Key Metrics Cards */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { borderLeftColor: '#4CAF50' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>Total Cash In</Text>
                <MaterialCommunityIcons
                  name="trending-up"
                  size={18}
                  color="#4CAF50"
                />
              </View>
              <Text style={[styles.metricValue, { color: '#4CAF50' }]}>
                {formatCurrency(cashFlowData.totalCashIn)}
              </Text>
              <Text style={[styles.metricChange, { color: '#4CAF50' }]}>
                {formatPercentage(cashFlowData.cashInChange)} from last month
              </Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: '#F44336' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>Total Cash Out</Text>
                <MaterialCommunityIcons
                  name="trending-down"
                  size={18}
                  color="#F44336"
                />
              </View>
              <Text style={[styles.metricValue, { color: '#F44336' }]}>
                {formatCurrency(cashFlowData.totalCashOut)}
              </Text>
              <Text style={[styles.metricChange, { color: '#F44336' }]}>
                {formatPercentage(cashFlowData.cashOutChange)} from last month
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { borderLeftColor: '#2196F3' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>Net Cash Flow</Text>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={18}
                  color="#2196F3"
                />
              </View>
              <Text style={[styles.metricValue, { color: '#2196F3' }]}>
                {formatCurrency(cashFlowData.netCashFlow)}
              </Text>
              <Text style={[styles.metricChange, { color: '#2196F3' }]}>
                {formatPercentage(cashFlowData.netFlowChange)} from last month
              </Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: '#9C27B0' }]}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricTitle}>Closing Balance</Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={18}
                  color="#9C27B0"
                />
              </View>
              <Text style={[styles.metricValue, { color: '#9C27B0' }]}>
                {formatCurrency(cashFlowData.closingBalance)}
              </Text>
              <Text style={styles.metricSubtitle}>Current balance</Text>
            </View>
          </View>
        </View>

        {/* Enhanced Monthly Trend Chart */}
        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly Cash Flow Trend</Text>
            <Text style={styles.sectionSubtitle}>
              6-month cash flow analysis
            </Text>
          </View>
          <View style={styles.chartContainer}>
            <BarChart
              data={barChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showBarTops
              showValuesOnTopOfBars
              withInnerLines={false}
            />
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: '#4CAF50' }]}
                />
                <Text style={styles.legendText}>Cash In</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: '#F44336' }]}
                />
                <Text style={styles.legendText}>Cash Out</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: '#2196F3' }]}
                />
                <Text style={styles.legendText}>Net Flow</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Weekly and Sources Section - Stacked for Mobile */}
        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Cash Flow</Text>
            <Text style={styles.sectionSubtitle}>Current month breakdown</Text>
          </View>
          <BarChart
            data={weeklyBarChartData}
            width={screenWidth - 64}
            height={200}
            chartConfig={chartConfig}
            style={styles.chart}
            fromZero
            showBarTops
            withInnerLines={false}
          />
        </View>

        {/* Cash Inflow Sources Section - Hidden/Commented Out */}
        {/*
        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cash Inflow Sources</Text>
            <Text style={styles.sectionSubtitle}>Revenue breakdown by category</Text>
          </View>
          <View style={styles.pieChartContainer}>
            <View style={styles.pieChartWrapper}>
              <PieChart
                data={pieChartData}
                width={screenWidth - 100}
                height={200}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute
                hasLegend={false}
                center={[(screenWidth - 100) / 2, 100]}
              />
            </View>
            <View style={styles.pieChartLegend}>
              {pieChartData.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        */}

        {/* Enhanced Expense Categories and Insights - Stacked for Mobile */}
        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expense Categories</Text>
            <Text style={styles.sectionSubtitle}>
              Breakdown of your expenses
            </Text>
          </View>
          {expenseCategories.map((category, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryLeft}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: category.color },
                  ]}
                />
                <Text style={styles.categoryName}>{category.name}</Text>
              </View>
              <View style={styles.categoryRight}>
                <Text style={styles.categoryAmount}>
                  {formatCurrency(category.amount)}
                </Text>
                <Text style={styles.categoryPercentage}>
                  {category.percentage}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.chartSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cash Flow Insights</Text>
            <Text style={styles.sectionSubtitle}>
              Key insights about your cash flow
            </Text>
          </View>
          {cashFlowInsights.map((insight, index) => (
            <View
              key={index}
              style={[styles.insightCard, { backgroundColor: insight.bgColor }]}
            >
              <MaterialCommunityIcons
                name={insight.icon}
                size={20}
                color={insight.color}
              />
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: insight.color }]}>
                  {insight.title}
                </Text>
                <Text
                  style={[styles.insightDescription, { color: insight.color }]}
                >
                  {insight.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Enhanced Cash Flow Forecast */}
        <View style={styles.forecastSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cash Flow Forecast</Text>
            <Text style={styles.sectionSubtitle}>
              Projected cash flow for next 3 months
            </Text>
          </View>
          <View style={styles.forecastContainer}>
            {forecastData.map((forecast, index) => (
              <View
                key={index}
                style={[
                  styles.forecastCard,
                  { backgroundColor: `${forecast.color}15` },
                ]}
              >
                <Text style={styles.forecastMonth}>{forecast.month}</Text>
                <Text style={[styles.forecastValue, { color: forecast.color }]}>
                  {formatCurrency(forecast.value)}
                </Text>
                <Text style={styles.forecastLabel}>Projected net flow</Text>
                <View
                  style={[
                    styles.growthBadge,
                    { backgroundColor: forecast.color },
                  ]}
                >
                  <Text style={styles.growthText}>
                    +{forecast.growth}% growth
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Enhanced Recommendations */}
        <View style={styles.recommendationsSection}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="lightbulb-outline"
              size={20}
              color="#FF9800"
            />
            <Text style={styles.sectionTitle}>Cash Flow Recommendations</Text>
          </View>
          <View style={styles.recommendationsList}>
            <Text style={styles.recommendationItem}>
              • Maintain current growth trajectory by focusing on high-margin
              services
            </Text>
            <Text style={styles.recommendationItem}>
              • Consider setting aside 10-15% of monthly cash flow for emergency
              fund
            </Text>
            <Text style={styles.recommendationItem}>
              • Optimize payment terms with customers to improve cash collection
            </Text>
            <Text style={styles.recommendationItem}>
              • Monitor operating expenses to maintain healthy profit margins
            </Text>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    color: '#222',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,

    fontFamily: 'Roboto-Medium',
  },

  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 4,
  },
  periodText: {
    fontSize: 14,
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },

  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f8cff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  metricsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 14,
    color: '#666',

    fontFamily: 'Roboto-Medium',
  },

  metricValue: {
    fontSize: 22,
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  metricChange: {
    fontSize: 12,

    fontFamily: 'Roboto-Medium',
  },

  metricSubtitle: {
    fontSize: 12,
    color: '#999',

    fontFamily: 'Roboto-Medium',
  },

  chartSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#222',
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  sectionSubtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    borderRadius: 16,
    marginBottom: 16,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  legendText: {
    fontSize: 14,
    color: '#333',

    fontFamily: 'Roboto-Medium',
  },

  chartsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pieChartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 16,
  },
  analysisRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pieChartContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    justifyContent: 'center',
  },
  pieChartWrapper: {
    width: screenWidth - 100,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#222',
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },

  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },

  categoryPercentage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightTitle: {
    fontSize: 16,
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  insightDescription: {
    fontSize: 14,
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  forecastSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  forecastContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  forecastCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  forecastMonth: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  forecastValue: {
    fontSize: 18,
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  forecastLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  growthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  growthText: {
    fontSize: 10,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  recommendationsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  recommendationsList: {
    gap: 8,
  },
  recommendationItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  bottomSpacing: {
    height: 20,
  },
});

export default CashFlowScreen;
