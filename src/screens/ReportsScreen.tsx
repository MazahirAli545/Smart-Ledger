import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../types/navigation';
import { BarChart, PieChart } from 'react-native-chart-kit';
import DateTimePicker from '@react-native-community/datetimepicker';
import { unifiedApi } from '../api/unifiedApiService';
import { BASE_URL } from '../api';
import { getToken } from '../utils/storage';
import axios from 'axios';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../utils/headerLayout';
import StableStatusBar from '../components/StableStatusBar';
import { getStatusBarSpacerHeight } from '../utils/statusBarManager';

const { width } = Dimensions.get('window');

// Small legend row used below charts
const LegendRow = ({
  items,
}: {
  items: Array<{ color: string; label: string }>;
}) => (
  <View style={styles.legendRow}>
    {items.map((it, idx) => (
      <View key={`${it.label}-${idx}`} style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: it.color }]} />
        <Text style={styles.legendText}>{it.label}</Text>
      </View>
    ))}
  </View>
);

interface ReportData {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  totalCustomers: number;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  expenseByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  customerBalance: {
    positiveBalance: { count: number; amount: number };
    negativeBalance: { count: number; amount: number };
    totalTransactions: { count: number; income: number; expense: number };
  };
}

const ReportsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();

  // Simple StatusBar configuration - let StableStatusBar handle it
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  // Global header total height constant
  const HEADER_TOTAL_HEIGHT = effectiveStatusBarHeight + HEADER_CONTENT_HEIGHT;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date()); // Default to current date
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch report data from API
  const fetchReportData = async (start?: Date, end?: Date) => {
    try {
      setLoading(true);
      setError(null);

      // Use provided dates or current state dates
      const selectedStartDate = start || startDate;
      const selectedEndDate = end || endDate;

      // 🎯 FIXED: Ensure dates are valid Date objects
      const startDateObj = new Date(selectedStartDate);
      if (isNaN(startDateObj.getTime())) {
        throw new Error('Invalid start date');
      }
      startDateObj.setHours(0, 0, 0, 0); // Start of day

      const endDateObj = new Date(selectedEndDate);
      if (isNaN(endDateObj.getTime())) {
        throw new Error('Invalid end date');
      }
      endDateObj.setHours(23, 59, 59, 999); // End of day

      // 🎯 FIXED: Format dates to YYYY-MM-DD format in LOCAL timezone (not UTC)
      // Using toISOString() converts to UTC which can cause date shifts
      // Instead, format manually using local date components
      const formatDateToYYYYMMDD = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateToYYYYMMDD(startDateObj);
      const endDateStr = formatDateToYYYYMMDD(endDateObj);

      console.log('📊 Fetching report data from API:', {
        startDate: startDateStr,
        endDate: endDateStr,
        startDateObj: startDateObj.toISOString(),
        endDateObj: endDateObj.toISOString(),
        originalStart: selectedStartDate,
        originalEnd: selectedEndDate,
      });

      // 🎯 FIXED: Invalidate cache for reports to ensure fresh data with new date range
      // Also add timestamp to URL to prevent caching
      unifiedApi.invalidateCachePattern('.*/reports/advanced.*');

      // 🎯 FIXED: Add timestamp to query string to ensure fresh data and prevent caching
      const timestamp = Date.now();
      const url = `/reports/advanced?startDate=${startDateStr}&endDate=${endDateStr}&_t=${timestamp}`;

      console.log('📤 Making API request to:', url);

      // Use unified API with query parameters
      // unifiedApi.get() returns data directly, not wrapped in {data, status, headers}
      // Disable cache for reports since they depend on date parameters
      const response = await unifiedApi.get(url, {
        cache: false, // Disable cache to ensure fresh data for each date range
      });

      console.log('📥 API Response received:', {
        responseType: typeof response,
        hasData: !!(response as any)?.data,
        hasSuccess: !!(response as any)?.success,
        responseKeys: response ? Object.keys(response as any) : [],
      });

      // Backend returns: { success: true, data: {...} }
      // unifiedApi.get() returns response.data directly, so response = { success: true, data: {...} }
      // We need to extract the actual report data
      let reportDataToSet: any = null;

      if (response && typeof response === 'object') {
        // Check if response has the wrapped format: { success: true, data: {...} }
        if ((response as any).success && (response as any).data) {
          reportDataToSet = (response as any).data;
          console.log('📦 Extracted data from wrapped format');
        }
        // Check if response is the data directly (has report properties)
        else if (
          typeof (response as any).totalIncome !== 'undefined' ||
          typeof (response as any).totalExpense !== 'undefined' ||
          typeof (response as any).netBalance !== 'undefined'
        ) {
          reportDataToSet = response;
          console.log('📦 Using direct data format');
        }
        // Fallback: try response.data if it exists
        else if ((response as any).data) {
          reportDataToSet = (response as any).data;
          console.log('📦 Extracted data from response.data');
        } else {
          reportDataToSet = response;
          console.log('📦 Using response as-is');
        }
      }

      console.log('📊 Final report data to set:', {
        hasData: !!reportDataToSet,
        totalIncome: reportDataToSet?.totalIncome,
        totalExpense: reportDataToSet?.totalExpense,
        netBalance: reportDataToSet?.netBalance,
        dataKeys: reportDataToSet ? Object.keys(reportDataToSet) : [],
      });

      if (
        reportDataToSet &&
        typeof reportDataToSet === 'object' &&
        !reportDataToSet.error
      ) {
        // 🎯 FIXED: Always update the report data, even if it's empty
        setReportData(reportDataToSet);
        setError(null); // Clear any previous errors

        console.log('✅ Report data set successfully for date range:', {
          startDate: startDateStr,
          endDate: endDateStr,
          totalIncome: reportDataToSet?.totalIncome,
          totalExpense: reportDataToSet?.totalExpense,
          netBalance: reportDataToSet?.netBalance,
          transactionCount:
            reportDataToSet?.customerBalance?.totalTransactions?.count,
          hasData: !!reportDataToSet,
        });
      } else {
        // Error response
        const errorMessage =
          (response as any)?.message ||
          (response as any)?.error ||
          reportDataToSet?.message ||
          reportDataToSet?.error ||
          'Failed to fetch report data';
        console.error('❌ API returned error:', errorMessage);
        setError(errorMessage);
        // Don't clear existing data on error - keep showing previous data
      }
    } catch (error: any) {
      console.error('Error fetching report data:', error);

      // Import error handler for consistent error handling
      const { handleApiError } = require('../utils/apiErrorHandler');
      const errorInfo = handleApiError(error);

      if (errorInfo.isForbidden) {
        setError('Access denied. You do not have permission to view reports.');
      } else if (errorInfo.isAuthError) {
        setError('Authentication failed. Please login again.');
      } else if (errorInfo.isNetworkError) {
        setError(
          'Network error. Please check your internet connection and try again.',
        );
      } else if (errorInfo.isServerError) {
        setError('Server error. Please try again later.');
      } else {
        // Check for 404 specifically
        if (errorInfo.status === 404) {
          setError('Reports API not found. Please contact support.');
        } else {
          setError(
            errorInfo.message ||
              'Failed to fetch report data. Please try again.',
          );
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Export functions
  const handleExport = async (
    format: 'csv' | 'pdf',
    type: 'report' | 'audit',
  ) => {
    try {
      setLoading(true);

      const token = await getToken();
      if (!token) {
        Alert.alert(
          'Authentication Error',
          'Please login again to export reports.',
        );
        return;
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log('Exporting report:', {
        format,
        type,
        startDate: startDateStr,
        endDate: endDateStr,
        url: `${BASE_URL}/reports/export`,
      });

      // 🎯 FIXED: Use axios directly for file downloads (unifiedApi doesn't handle file downloads well)
      // File downloads need special handling with responseType: 'blob'
      const exportUrl = `${BASE_URL}/reports/export?format=${format}&type=${type}&startDate=${startDateStr}&endDate=${endDateStr}`;

      const response = await axios.get(exportUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'blob', // Important for file downloads
      });

      console.log('Export response received:', {
        status: response.status,
        contentType: response.headers['content-type'],
        dataSize: response.data?.size,
      });

      // For React Native, we need to handle file downloads differently
      // Since we can't directly download files, we'll show success message
      // In a real app, you might want to use a library like react-native-fs or expo-file-system
      Alert.alert(
        'Success',
        `${type.toUpperCase()} ${format.toUpperCase()} exported successfully. The file download feature is not yet implemented in the mobile app.`,
      );
    } catch (error: any) {
      console.error('Export error:', error);

      // Import error handler for consistent error handling
      const { handleApiError } = require('../utils/apiErrorHandler');
      const errorInfo = handleApiError(error);

      if (errorInfo.isForbidden) {
        Alert.alert(
          'Access Denied',
          'You do not have permission to export reports.',
        );
      } else if (errorInfo.isAuthError) {
        Alert.alert(
          'Authentication Error',
          'Please login again to export reports.',
        );
      } else if (errorInfo.isNetworkError) {
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.',
        );
      } else if (errorInfo.isServerError) {
        Alert.alert(
          'Server Error',
          'Server error occurred. Please try again later.',
        );
      } else {
        Alert.alert(
          'Export Failed',
          errorInfo.message || 'Failed to export report. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const retryFetch = () => {
    setError(null);
    fetchReportData();
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // 🎯 FIXED: Ensure endDate is always >= startDate and not in the future
  useEffect(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (endDate < startDate) {
      // If end date is before start date, set it to start date
      setEndDate(new Date(startDate));
    } else if (endDate > today) {
      // If end date is in the future, set it to today
      setEndDate(new Date(today));
    }
  }, [startDate]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
      {/* Fixed Header */}
      <View
        style={[
          styles.header,
          getSolidHeaderStyle(effectiveStatusBarHeight),
          { height: HEADER_TOTAL_HEIGHT },
        ]}
      >
        <View style={styles.headerContentRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Advanced Reports</Text>
            <Text style={styles.headerSubtitle}>
              Comprehensive analytics and insights
            </Text>
          </View>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Date Filter */}
        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <MaterialCommunityIcons name="filter" size={22} color="#666" />
            <Text style={styles.filterTitle}>Filter by Date Range</Text>
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.applyButton, loading && styles.applyButtonDisabled]}
            onPress={async () => {
              console.log('🔘 Apply Filter button pressed:', {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                startDateISO: startDate.toISOString(),
                endDateISO: endDate.toISOString(),
                startDateType: typeof startDate,
                endDateType: typeof endDate,
              });

              // 🎯 FIXED: Ensure we're using the current state values
              // Create new Date objects to avoid any reference issues
              const start = new Date(startDate);
              const end = new Date(endDate);

              // Validate dates
              if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                Alert.alert(
                  'Invalid Date',
                  'Please select valid start and end dates.',
                );
                return;
              }

              // Ensure end date is not before start date
              if (end < start) {
                Alert.alert(
                  'Invalid Date Range',
                  'End date cannot be before start date.',
                );
                return;
              }

              // Fetch data with the selected dates
              await fetchReportData(start, end);
            }}
            disabled={loading}
          >
            <Text style={styles.applyButtonText}>
              {loading ? 'Loading...' : 'Apply Filter'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Export Buttons */}
        <View style={styles.exportSection}>
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('csv', 'report')}
            >
              <MaterialCommunityIcons
                name="file-delimited-outline"
                size={20}
                color="#666"
              />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('pdf', 'report')}
            >
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={20}
                color="#666"
              />
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('csv', 'audit')}
            >
              <MaterialCommunityIcons
                name="file-delimited-outline"
                size={20}
                color="#666"
              />
              <Text style={styles.exportButtonText}>Audit CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('pdf', 'audit')}
            >
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={20}
                color="#666"
              />
              <Text style={styles.exportButtonText}>Audit PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && !reportData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4f8cff" />
            <Text style={styles.loadingText}>Loading report data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={48}
              color="#ff6b6b"
            />
            <Text style={styles.errorTitle}>Unable to Load Reports</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
              <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : reportData ? (
          <>
            {/* Check if there are any transactions in the date range */}
            {/* Use totalTransactions count as the primary indicator - it's the most reliable */}
            {(() => {
              const transactionCount =
                reportData.customerBalance?.totalTransactions?.count ?? 0;
              const hasNoTransactions =
                transactionCount === 0 &&
                reportData.totalIncome === 0 &&
                reportData.totalExpense === 0;

              console.log('🔍 Checking for empty transactions:', {
                transactionCount,
                totalIncome: reportData.totalIncome,
                totalExpense: reportData.totalExpense,
                hasNoTransactions,
                monthlyTrendLength: reportData.monthlyTrend?.length ?? 0,
              });

              return hasNoTransactions;
            })() ? (
              <View style={styles.noDataContainer}>
                <MaterialCommunityIcons
                  name="calendar-remove"
                  size={64}
                  color="#ccc"
                />
                <Text style={styles.noDataTitle}>No Transactions Found</Text>
                <Text style={styles.noDataText}>
                  There are no transactions in the selected date range.
                </Text>
                <Text style={styles.noDataSubtext}>
                  Please select a different date range or create transactions
                  for this period.
                </Text>
              </View>
            ) : (
              <>
                {/* Summary Cards */}
                <View style={styles.summaryCards}>
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <MaterialCommunityIcons
                        name="trending-up"
                        size={20}
                        color="#4CAF50"
                      />
                      <Text style={styles.summaryCardTitle}>Total Income</Text>
                    </View>
                    <Text
                      style={[styles.summaryCardValue, { color: '#4CAF50' }]}
                    >
                      {formatCurrency(reportData.totalIncome)}
                    </Text>
                  </View>

                  <View style={styles.summaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <MaterialCommunityIcons
                        name="trending-down"
                        size={20}
                        color="#F44336"
                      />
                      <Text style={styles.summaryCardTitle}>Total Expense</Text>
                    </View>
                    <Text
                      style={[styles.summaryCardValue, { color: '#F44336' }]}
                    >
                      {formatCurrency(reportData.totalExpense)}
                    </Text>
                  </View>

                  <View style={styles.summaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <MaterialCommunityIcons
                        name="currency-inr"
                        size={20}
                        color="#2196F3"
                      />
                      <Text style={styles.summaryCardTitle}>Net Balance</Text>
                    </View>
                    <Text
                      style={[
                        styles.summaryCardValue,
                        {
                          color:
                            reportData.netBalance >= 0 ? '#4CAF50' : '#F44336',
                        },
                      ]}
                    >
                      {formatCurrency(reportData.netBalance)}
                    </Text>
                  </View>

                  <View style={styles.summaryCard}>
                    <View style={styles.summaryCardHeader}>
                      <MaterialCommunityIcons
                        name="account-group"
                        size={20}
                        color="#2196F3"
                      />
                      <Text style={styles.summaryCardTitle}>
                        Total Customers
                      </Text>
                    </View>
                    <Text
                      style={[styles.summaryCardValue, { color: '#2196F3' }]}
                    >
                      {reportData.totalCustomers}
                    </Text>
                  </View>
                </View>

                {/* Monthly Trend Chart */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>
                    Monthly Income vs Expense Trend
                  </Text>
                  {reportData.monthlyTrend.length > 0 ? (
                    <View style={styles.chartContainer}>
                      <BarChart
                        data={{
                          labels: reportData.monthlyTrend.map(item =>
                            item.month.substring(5),
                          ),
                          datasets: [
                            {
                              data: reportData.monthlyTrend.map(
                                item => item.income,
                              ),
                              color: (opacity = 1) =>
                                `rgba(76, 175, 80, ${opacity})`,
                            },
                            {
                              data: reportData.monthlyTrend.map(
                                item => item.expense,
                              ),
                              color: (opacity = 1) =>
                                `rgba(244, 67, 54, ${opacity})`,
                            },
                          ],
                        }}
                        width={width - 40}
                        height={280}
                        fromZero
                        showValuesOnTopOfBars
                        withInnerLines
                        yAxisLabel="₹"
                        chartConfig={{
                          backgroundColor: '#ffffff',
                          backgroundGradientFrom: '#ffffff',
                          backgroundGradientTo: '#ffffff',
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                          labelColor: (opacity = 1) =>
                            `rgba(0, 0, 0, ${opacity})`,
                          propsForBackgroundLines: { strokeDasharray: '3 8' },
                        }}
                        style={styles.chart}
                      />
                    </View>
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Text style={styles.noDataText}>
                        No trend data available
                      </Text>
                    </View>
                  )}
                  <View style={styles.legendContainerCentered}>
                    <LegendRow
                      items={[
                        { color: '#4CAF50', label: 'Income' },
                        { color: '#F44336', label: 'Expense' },
                      ]}
                    />
                  </View>
                </View>

                {/* Expense by Category */}
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Expense by Category</Text>
                  {reportData.expenseByCategory.filter(c => c.amount > 0)
                    .length > 0 ? (
                    <PieChart
                      data={reportData.expenseByCategory
                        .filter(c => c.amount > 0)
                        .map((item, index) => ({
                          name: item.category,
                          population: item.amount,
                          color: `hsl(${index * 60}, 70%, 50%)`,
                          legendFontColor: '#7F7F7F',
                          legendFontSize: 12,
                          amount: item.amount,
                        }))}
                      width={width - 40}
                      height={200}
                      chartConfig={{
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      }}
                      accessor="population"
                      backgroundColor="transparent"
                      paddingLeft="15"
                      style={styles.chart}
                    />
                  ) : (
                    <View style={styles.noDataContainer}>
                      <MaterialCommunityIcons
                        name="chart-pie"
                        size={48}
                        color="#ccc"
                      />
                      <Text style={styles.noDataText}>
                        No category data available
                      </Text>
                    </View>
                  )}
                  {reportData.expenseByCategory.filter(c => c.amount > 0)
                    .length > 0 && (
                    <LegendRow
                      items={reportData.expenseByCategory
                        .filter(c => c.amount > 0)
                        .slice(0, 4)
                        .map((c, i) => ({
                          color: `hsl(${i * 60}, 70%, 50%)`,
                          label: c.category,
                        }))}
                    />
                  )}
                </View>

                {/* Customer Balance Summary */}
                <View style={[styles.summaryCard, styles.summaryCardFull]}>
                  <Text style={styles.chartTitle}>
                    Customer Balance Summary
                  </Text>
                  <View style={styles.metricsColumn}>
                    <View style={[styles.metricRow, styles.metricRowBorder]}>
                      <View
                        style={[
                          styles.metricIconContainer,
                          { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="cash-plus"
                          size={20}
                          color="#4CAF50"
                        />
                      </View>
                      <View style={styles.metricContent}>
                        <Text style={styles.metricLabel}>Positive Balance</Text>
                        <View style={styles.metricValueRow}>
                          <Text
                            style={[styles.metricValue, { color: '#4CAF50' }]}
                          >
                            {reportData.customerBalance.positiveBalance.count}
                          </Text>
                          <Text style={styles.metricSub}>
                            {formatCurrency(
                              reportData.customerBalance.positiveBalance.amount,
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.metricRow, styles.metricRowBorder]}>
                      <View
                        style={[
                          styles.metricIconContainer,
                          { backgroundColor: 'rgba(244, 67, 54, 0.1)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="cash-minus"
                          size={20}
                          color="#F44336"
                        />
                      </View>
                      <View style={styles.metricContent}>
                        <Text style={styles.metricLabel}>Negative Balance</Text>
                        <View style={styles.metricValueRow}>
                          <Text
                            style={[styles.metricValue, { color: '#F44336' }]}
                          >
                            {reportData.customerBalance.negativeBalance.count}
                          </Text>
                          <Text style={styles.metricSub}>
                            {formatCurrency(
                              reportData.customerBalance.negativeBalance.amount,
                            )}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.metricRow}>
                      <View
                        style={[
                          styles.metricIconContainer,
                          { backgroundColor: 'rgba(33, 150, 243, 0.1)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="swap-vertical"
                          size={20}
                          color="#2196F3"
                        />
                      </View>
                      <View style={styles.metricContent}>
                        <Text style={styles.metricLabel}>
                          Total Transactions
                        </Text>
                        <View style={styles.metricValueRow}>
                          <Text
                            style={[styles.metricValue, { color: '#2196F3' }]}
                          >
                            {reportData.customerBalance.totalTransactions.count}
                          </Text>
                          <Text style={styles.metricSub}>
                            {
                              reportData.customerBalance.totalTransactions
                                .income
                            }{' '}
                            income ·{' '}
                            {
                              reportData.customerBalance.totalTransactions
                                .expense
                            }{' '}
                            expense
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.noDataContainer}>
            <MaterialCommunityIcons name="chart-line" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No report data available</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchReportData()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          maximumDate={endDate} // Start date cannot be after end date
          onChange={(event, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate && event.type !== 'dismissed') {
              // 🎯 FIXED: Create a new Date object to ensure proper state update
              const newStartDate = new Date(selectedDate);
              newStartDate.setHours(0, 0, 0, 0); // Normalize to start of day
              setStartDate(newStartDate);

              // If end date is before the new start date, update end date
              if (endDate < newStartDate) {
                const newEndDate = new Date(newStartDate);
                newEndDate.setHours(23, 59, 59, 999); // End of day
                setEndDate(newEndDate);
              }

              console.log('📅 Start date selected:', {
                selected: selectedDate,
                normalized: newStartDate,
                formatted: formatDate(newStartDate),
              });
            }
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={endDate >= startDate ? endDate : new Date(startDate)}
          mode="date"
          display="default"
          minimumDate={startDate} // End date cannot be before start date
          maximumDate={new Date()} // End date cannot be a future date (limited to current date)
          onChange={(event, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate && event.type !== 'dismissed') {
              // 🎯 FIXED: Ensure selected date is not before start date and not in the future
              const today = new Date();
              today.setHours(23, 59, 59, 999); // End of today

              // Create a new Date object to ensure proper state update
              let validEndDate: Date;
              if (selectedDate < startDate) {
                validEndDate = new Date(startDate);
                validEndDate.setHours(23, 59, 59, 999);
              } else if (selectedDate > today) {
                validEndDate = new Date(today);
              } else {
                validEndDate = new Date(selectedDate);
                validEndDate.setHours(23, 59, 59, 999); // End of day
              }

              setEndDate(validEndDate);

              console.log('📅 End date selected:', {
                selected: selectedDate,
                normalized: validEndDate,
                formatted: formatDate(validEndDate),
              });
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    backgroundColor: '#4f8cff',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    position: 'relative',
    paddingBottom: 0,
    minHeight: 120, // Global minimum header height (status bar + content)
  },
  headerContentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: HEADER_CONTENT_HEIGHT,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
  },
  menuButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  headerRightPlaceholder: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Roboto-Medium',
  },

  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontFamily: 'Roboto-Medium',
  },

  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  exportSection: {
    marginVertical: 16,
  },
  exportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 48,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontFamily: 'Roboto-Medium',
  },

  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateInputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
  },

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 48,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Roboto-Medium',
  },

  applyButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  applyButtonDisabled: {
    backgroundColor: '#9bb5ff',
    opacity: 0.7,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontFamily: 'Roboto-Medium',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorTitle: {
    fontSize: 18,
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
  },

  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
    fontFamily: 'Roboto-Medium',
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f8cff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    minHeight: 48,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryCardFull: {
    width: '100%',
    padding: 20,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryCardTitle: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  summaryCardValue: {
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
  },

  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  legendContainerCentered: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    color: '#222',
    marginBottom: 16,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  chartContainer: {
    marginVertical: 8,
    paddingTop: 24,
    paddingBottom: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
    minHeight: 200,
  },
  noDataTitle: {
    fontSize: 20,
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    fontFamily: 'Roboto-Medium',
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Roboto-Regular',
  },

  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Roboto-Medium',
  },

  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  balanceValue: {
    fontSize: 18,
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
  },

  balanceLabel: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 15,
    fontFamily: 'Roboto-Medium',
  },

  balanceAmount: {
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },

  metricsColumn: {
    flexDirection: 'column',
    marginTop: 8,
    paddingTop: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  metricRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  metricContent: {
    flex: 1,
    marginLeft: 16,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    gap: 12,
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  metricLabel: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Roboto-Medium',
  },

  metricSub: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Roboto-Medium',
  },
});

export default ReportsScreen;
