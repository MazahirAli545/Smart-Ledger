import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  StatusBar,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import {
  DrawerActions,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { getUserIdFromToken } from '../../utils/storage';

const { width } = Dimensions.get('window');

interface Transaction {
  id: number;
  title: string;
  type: 'income' | 'expense' | 'purchase';
  amount: number;
  gstAmount?: number;
  date: string;
  party: string;
  invoiceNumber?: string;
  category: string;
  paymentMethod: string;
  tags: string[];
}

interface SummaryCard {
  title: string;
  amount: number;
  color: string;
  icon: string;
}

const DailyLedgerScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showFilters, setShowFilters] = useState(false);

  // Mock data for demonstration - replace with actual API calls
  const mockTransactions: Transaction[] = [
    {
      id: 1,
      title: 'Product sale to ABC Corp',
      type: 'income',
      amount: 25000,
      gstAmount: 4500,
      date: '2024-01-15',
      party: 'ABC Corp',
      invoiceNumber: 'INV-2024-001',
      category: 'Sales',
      paymentMethod: 'Bank',
      tags: ['income', 'GST'],
    },
    {
      id: 2,
      title: 'Office supplies purchase',
      type: 'expense',
      amount: 3500,
      gstAmount: 630,
      date: '2024-01-15',
      party: 'XYZ Stationery',
      invoiceNumber: 'BILL-456',
      category: 'Office Supplies',
      paymentMethod: 'Cash',
      tags: ['expense', 'GST'],
    },
    {
      id: 3,
      title: 'Service charges',
      type: 'income',
      amount: 12000,
      gstAmount: 2160,
      date: '2024-01-14',
      party: 'DEF Company',
      category: 'Services',
      paymentMethod: 'Upi',
      tags: ['income', 'GST'],
    },
    {
      id: 4,
      title: 'Fuel expenses',
      type: 'expense',
      amount: 2500,
      date: '2024-01-14',
      party: 'Petrol Pump',
      category: 'Travel',
      paymentMethod: 'Card',
      tags: ['expense'],
    },
    {
      id: 5,
      title: 'Raw materials',
      type: 'purchase',
      amount: 45000,
      gstAmount: 8100,
      date: '2024-01-13',
      party: 'Material Supplier',
      invoiceNumber: 'PUR-789',
      category: 'Inventory',
      paymentMethod: 'Cheque',
      tags: ['purchase', 'GST'],
    },
  ];

  // Calculate summary data
  const calculateSummary = (): SummaryCard[] => {
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter(t => t.type === 'expense' || t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);

    const netAmount = totalIncome - totalExpense;

    return [
      {
        title: 'Total Income',
        amount: totalIncome,
        color: '#10b981',
        icon: 'trending-up',
      },
      {
        title: 'Total Expense',
        amount: totalExpense,
        color: '#ef4444',
        icon: 'trending-down',
      },
      {
        title: 'Net Amount',
        amount: netAmount,
        color: netAmount >= 0 ? '#10b981' : '#ef4444',
        icon: 'calculator',
      },
      {
        title: 'Total Transactions',
        amount: transactions.length,
        color: '#6b7280',
        icon: 'format-list-bulleted',
      },
    ];
  };

  const fetchTransactions = async (isRefresh = false) => {
    try {
      setLoading(!isRefresh);
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchTransactions();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions(true);
  };

  // Filter transactions based on search and filter criteria
  useEffect(() => {
    let filtered = transactions;

    if (searchText) {
      filtered = filtered.filter(
        t =>
          t.title.toLowerCase().includes(searchText.toLowerCase()) ||
          t.party.toLowerCase().includes(searchText.toLowerCase()) ||
          t.invoiceNumber?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    if (selectedType !== 'All Types') {
      filtered = filtered.filter(t => t.type === selectedType.toLowerCase());
    }

    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (selectedDate) {
      filtered = filtered.filter(t => t.date === selectedDate);
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchText, selectedType, selectedCategory, selectedDate]);

  const clearFilters = () => {
    setSearchText('');
    setSelectedDate('');
    setSelectedType('All Types');
    setSelectedCategory('All Categories');
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return 'trending-up';
      case 'expense':
        return 'trending-down';
      case 'purchase':
        return 'cart-outline';
      default:
        return 'currency-inr';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'income':
        return '#10b981';
      case 'expense':
        return '#ef4444';
      case 'purchase':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const handleTransactionPress = (transaction: Transaction) => {
    Alert.alert('Transaction', `View details for: ${transaction.title}`);
  };

  const handleAddEntry = () => {
    Alert.alert('Add Entry', 'Navigate to add entry form');
  };

  const handleExport = () => {
    Alert.alert('Export', 'Export transactions to PDF/Excel');
  };

  const renderSummaryCard = (card: SummaryCard) => (
    <View key={card.title} style={styles.summaryCard}>
      <View style={styles.summaryCardContent}>
        <View
          style={[
            styles.summaryIconContainer,
            { backgroundColor: `${card.color}15` },
          ]}
        >
          <MaterialCommunityIcons
            name={card.icon as any}
            size={20}
            color={card.color}
          />
        </View>
        <View style={styles.summaryTextContainer}>
          <Text style={styles.summaryCardTitle}>{card.title}</Text>
          <Text style={[styles.summaryCardAmount, { color: card.color }]}>
            {card.title === 'Total Transactions'
              ? card.amount.toString()
              : formatCurrency(card.amount)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.transactionIconContainer,
              { backgroundColor: `${getTransactionColor(item.type)}15` },
            ]}
          >
            <MaterialCommunityIcons
              name={getTransactionIcon(item.type)}
              size={20}
              color={getTransactionColor(item.type)}
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionTitle}>{item.title}</Text>
            <Text style={styles.transactionDetails}>
              {item.party} • {item.invoiceNumber || 'N/A'} • {item.category}
            </Text>
            <Text style={styles.transactionDate}>
              {formatDate(item.date)} • {item.paymentMethod}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={[
              styles.transactionAmount,
              { color: item.type === 'income' ? '#10b981' : '#ef4444' },
            ]}
          >
            {item.type === 'income' ? '+' : '-'}
            {formatCurrency(item.amount)}
          </Text>
          {item.gstAmount && (
            <Text style={styles.gstAmount}>
              GST: {formatCurrency(item.gstAmount)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.transactionTags}>
        {item.tags.map((tag, index) => (
          <View
            key={index}
            style={[
              styles.tag,
              {
                backgroundColor:
                  tag === 'income'
                    ? '#d1fae5'
                    : tag === 'expense'
                    ? '#fee2e2'
                    : tag === 'purchase'
                    ? '#dbeafe'
                    : '#f3f4f6',
              },
            ]}
          >
            <Text
              style={[
                styles.tagText,
                {
                  color:
                    tag === 'income'
                      ? '#065f46'
                      : tag === 'expense'
                      ? '#991b1b'
                      : tag === 'purchase'
                      ? '#1e40af'
                      : '#374151',
                },
              ]}
            >
              {tag}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.transactionActions}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons
            name="eye-outline"
            size={18}
            color="#6b7280"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={18}
            color="#6b7280"
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={18}
            color="#ef4444"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModal}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Search & Filter</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterContent}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Search</Text>
              <View style={styles.searchInputContainer}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
                  color="#9ca3af"
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search transactions"
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Date</Text>
              <TouchableOpacity style={styles.dateInputContainer}>
                <Text
                  style={
                    selectedDate
                      ? styles.dateInputText
                      : styles.dateInputPlaceholder
                  }
                >
                  {selectedDate || 'dd-mm-yyyy'}
                </Text>
                <MaterialCommunityIcons
                  name="calendar"
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Type</Text>
              <View style={styles.filterOptions}>
                {['All Types', 'Income', 'Expense', 'Purchase'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterOption,
                      selectedType === type && styles.filterOptionSelected,
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedType === type &&
                          styles.filterOptionTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterOptions}>
                {[
                  'All Categories',
                  'Sales',
                  'Services',
                  'Office Supplies',
                  'Travel',
                  'Inventory',
                ].map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterOption,
                      selectedCategory === category &&
                        styles.filterOptionSelected,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedCategory === category &&
                          styles.filterOptionTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.filterFooter}>
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialCommunityIcons name="menu" size={24} color="#1f2937" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Daily Ledger</Text>
          <Text style={styles.headerSubtitle}>
            Search, filter, and manage all your transactions
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
            <MaterialCommunityIcons name="download" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddEntry}>
            <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryGrid}>
            {calculateSummary().map(renderSummaryCard)}
          </View>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchContainer}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setShowFilters(true)}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={20}
              color="#3b82f6"
            />
            <Text style={styles.searchButtonText}>Search & Filter</Text>
          </TouchableOpacity>
          {(searchText ||
            selectedDate ||
            selectedType !== 'All Types' ||
            selectedCategory !== 'All Categories') && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Transactions List */}
        <View style={styles.transactionsContainer}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>
              Transactions ({filteredTransactions.length})
            </Text>
            <Text style={styles.transactionsSubtitle}>
              All your business transactions in one place
            </Text>
          </View>

          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.transactionCard}
                onPress={() => handleTransactionPress(item)}
              >
                {renderTransactionItem({ item })}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={48}
                color="#d1d5db"
              />
              <Text style={styles.emptyStateText}>No transactions found</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchText ||
                selectedDate ||
                selectedType !== 'All Types' ||
                selectedCategory !== 'All Categories'
                  ? 'Try adjusting your filters'
                  : 'Add your first transaction to get started'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {renderFilterModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuButton: {
    padding: 8,
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportButton: {
    padding: 10,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: (width - 60) / 2,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  summaryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryCardTitle: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryCardAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchButtonText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  clearFiltersButton: {
    marginLeft: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearFiltersText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  transactionsContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  transactionsHeader: {
    marginBottom: 20,
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  transactionsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  transactionCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  transactionDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 13,
    color: '#9ca3af',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  gstAmount: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  transactionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  filterContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateInputText: {
    fontSize: 16,
    color: '#1f2937',
  },
  dateInputPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  filterOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterOptionTextSelected: {
    color: '#ffffff',
  },
  filterFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  clearButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DailyLedgerScreen;
