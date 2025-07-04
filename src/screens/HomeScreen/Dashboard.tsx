import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { PieChart, BarChart } from 'react-native-chart-kit';

const LOGO = require('../../../android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png');
const PROFILE_ICON =
  'https://img.icons8.com/ios-filled/100/4f8cff/user-male-circle.png';
const TRANSACTION_ICON =
  'https://img.icons8.com/ios-filled/100/1ecb81/transaction.png';
const REPORT_ICON =
  'https://img.icons8.com/ios-filled/100/fa7d09/combo-chart.png';
const SETTINGS_ICON =
  'https://img.icons8.com/ios-filled/100/9b5de5/settings.png';

type RootStackParamList = {
  Onboarding: undefined;
  Dashboard: undefined;
  // Add other screens as needed
};

interface UserData {
  id: number;
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  businessType: string;
  businessSize: string;
  industry: string;
  profileComplete: boolean;
}

interface Transaction {
  id: number;
  type: 'Invoice' | 'Purchase' | 'Receipt' | 'Payment';
  party: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Pending' | 'Received';
}

const Dashboard: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const screenWidth = Dimensions.get('window').width;

  // Mock data for GST Summary
  const gstData = [
    {
      name: 'CGST',
      amount: 12000,
      color: '#4285F4',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'SGST',
      amount: 12000,
      color: '#0F9D58',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'IGST',
      amount: 8000,
      color: '#F4B400',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
  ];

  // Mock data for transactions
  const transactions: Transaction[] = [
    {
      id: 1,
      type: 'Invoice',
      party: 'ABC Corp',
      amount: 15000,
      date: '2024-01-15',
      status: 'Paid',
    },
    {
      id: 2,
      type: 'Purchase',
      party: 'XYZ Supplies',
      amount: 8500,
      date: '2024-01-14',
      status: 'Pending',
    },
    {
      id: 3,
      type: 'Receipt',
      party: 'DEF Ltd',
      amount: 22000,
      date: '2024-01-13',
      status: 'Received',
    },
    {
      id: 4,
      type: 'Payment',
      party: 'GHI Services',
      amount: 12000,
      date: '2024-01-12',
      status: 'Paid',
    },
  ];

  // Mock data for cash flow chart
  const cashFlowData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        data: [45000, 52000, 48000, 60000, 55000, 68000],
        color: (opacity = 1) => `rgba(15, 157, 88, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: [32000, 38000, 35000, 42000, 39000, 45000],
        color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Income', 'Expenses'],
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const mobileNumber =
        (await AsyncStorage.getItem('userMobileNumber')) || '9844587867';

      if (!accessToken) {
        throw new Error('Authentication token not found');
      }

      // This is a placeholder for the actual API call
      // In a real app, you would make an API call to get user data
      // For now, we'll use mock data

      // Simulating API call with timeout
      setTimeout(() => {
        // Mock user data - replace with actual API call in production
        const mockUserData: UserData = {
          id: 1,
          businessName: 'Smart Business Solutions',
          ownerName: 'John Doe',
          mobileNumber: mobileNumber,
          businessType: 'Private Limited',
          businessSize: 'Small',
          industry: 'Technology',
          profileComplete: true,
        };

        setUserData(mockUserData);
        setLoading(false);
      }, 1000);
    } catch (err: any) {
      console.error('Error fetching user data:', err);
      setError(err.message || 'Failed to load user data');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            // Clear all stored tokens and data
            await AsyncStorage.multiRemove([
              'accessToken',
              'refreshToken',
              'userMobileNumber',
            ]);

            // Navigate back to onboarding screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Onboarding' }],
            });
          } catch (err) {
            console.error('Error during logout:', err);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
        <Image source={LOGO} style={styles.logo} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuButton}>
              <MaterialCommunityIcons name="menu" size={24} color="#222" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Smart Ledger</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialCommunityIcons name="magnify" size={24} color="#222" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialCommunityIcons
                name="bell-outline"
                size={24}
                color="#222"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <LinearGradient
          colors={['#4f8cff', '#1ecb81']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.profileCard}
        >
          <View style={styles.profileInfo}>
            <Image source={{ uri: PROFILE_ICON }} style={styles.profileIcon} />
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {userData?.ownerName || 'User'}
              </Text>
              <Text style={styles.profilePhone}>
                {userData?.mobileNumber || ''}
              </Text>
              <Text style={styles.profileBusiness}>
                {userData?.businessType || 'Business'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.viewProfileButton}>
            <Text style={styles.viewProfileText}>View Profile</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Today's Sales and Pending */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Today's Sales</Text>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>₹45,230</Text>
              <MaterialCommunityIcons
                name="trending-up"
                size={20}
                color="#0F9D58"
              />
            </View>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, { color: '#F4B400' }]}>
                ₹12,450
              </Text>
              <MaterialCommunityIcons
                name="trending-down"
                size={20}
                color="#DB4437"
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={24}
                color="#222"
              />
              <Text style={styles.actionText}>Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons name="receipt" size={24} color="#222" />
              <Text style={styles.actionText}>Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={24}
                color="#222"
              />
              <Text style={styles.actionText}>Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={24}
                color="#222"
              />
              <Text style={styles.actionText}>Purchase</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* GST Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>GST Summary</Text>
          <Text style={styles.sectionSubtitle}>Current month breakdown</Text>

          <View style={styles.chartContainer}>
            <PieChart
              data={gstData}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute={false}
              hasLegend={false}
              center={[screenWidth / 4, 0]}
            />
          </View>

          <View style={styles.gstLegend}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#4285F4' }]}
              />
              <Text style={styles.legendLabel}>CGST:</Text>
              <Text style={styles.legendValue}>₹12,000</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#0F9D58' }]}
              />
              <Text style={styles.legendLabel}>SGST:</Text>
              <Text style={styles.legendValue}>₹12,000</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#F4B400' }]}
              />
              <Text style={styles.legendLabel}>IGST:</Text>
              <Text style={styles.legendValue}>₹8,000</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          {transactions.map(transaction => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View style={styles.transactionTypeContainer}>
                  <Text style={styles.transactionTypeText}>
                    {transaction.type}
                  </Text>
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionParty}>
                    {transaction.party}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.date)}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={styles.transactionAmount}>
                  {formatCurrency(transaction.amount)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    transaction.status === 'Paid'
                      ? styles.paidBadge
                      : transaction.status === 'Received'
                      ? styles.receivedBadge
                      : styles.pendingBadge,
                  ]}
                >
                  <Text style={styles.statusText}>{transaction.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Cash Flow Overview */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cash Flow Overview</Text>
          <Text style={styles.sectionSubtitle}>
            Income vs Expenses (Last 6 months)
          </Text>

          <BarChart
            data={cashFlowData}
            width={screenWidth - 64}
            height={220}
            yAxisLabel="₹"
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              barPercentage: 0.7,
              propsForBackgroundLines: {
                strokeDasharray: '5, 5',
                stroke: '#e3e3e3',
              },
            }}
            fromZero
            showBarTops={false}
            showValuesOnTopOfBars={false}
            withInnerLines={true}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>

        {/* Customer & Suppliers Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={styles.tab}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={20}
              color="#222"
            />
            <Text style={styles.tabText}>Customers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab}>
            <MaterialCommunityIcons
              name="truck-outline"
              size={20}
              color="#222"
            />
            <Text style={styles.tabText}>Suppliers</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6fafc',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#4f8cff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  profileCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    tintColor: '#fff',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 2,
  },
  profileBusiness: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  viewProfileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F9D58',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  gstLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    color: '#222',
    marginTop: 8,
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionTypeContainer: {
    backgroundColor: '#222',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 12,
  },
  transactionTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  transactionDetails: {
    justifyContent: 'center',
  },
  transactionParty: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  paidBadge: {
    backgroundColor: '#222',
  },
  receivedBadge: {
    backgroundColor: '#0F9D58',
  },
  pendingBadge: {
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    marginLeft: 8,
  },
  logoutButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});

export default Dashboard;
