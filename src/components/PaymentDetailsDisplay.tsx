import React from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface PaymentDetailsDisplayProps {
  paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    method: string;
    amount: number;
    currency: string;
    bank?: string;
    wallet?: string;
    card_id?: string;
    card_network?: string;
    card_type?: string;
    card_last4?: string;
    card_issuer?: string;
    upi_transaction_id?: string;
    upi_vpa?: string;
    international?: boolean;
    fee?: number;
    tax?: number;
    contact?: string;
    name?: string;
    email?: string;
    status?: string;
    captured?: boolean;
    description?: string;
    created_at?: number;
  };
  onClose?: () => void;
}

// Local Text wrapper to enforce Roboto font in this component
const Text: React.FC<RNTextProps> = ({ style, ...rest }) => (
  <RNText {...rest} style={[{ fontFamily: 'Roboto-Medium' }, style]} />
);

const PaymentDetailsDisplay: React.FC<PaymentDetailsDisplayProps> = ({
  paymentData,
  onClose,
}) => {
  // Debug logging to understand the data being passed
  console.log('🔍 PaymentDetailsDisplay received data:', {
    amount: paymentData.amount,
    amountType: typeof paymentData.amount,
    amountValue: paymentData.amount,
    currency: paymentData.currency,
    method: paymentData.method,
    fullPaymentData: paymentData,
  });

  // Additional safety check
  if (!paymentData) {
    console.error('❌ PaymentDetailsDisplay: paymentData is null/undefined');
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment Details</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.errorText}>No payment data available</Text>
        </View>
      </View>
    );
  }
  // Helper function to format amount
  const formatAmount = (amount: number, currency: string = 'INR') => {
    console.log('🔍 formatAmount called with:', {
      amount,
      amountType: typeof amount,
      currency,
    });

    // Handle null/undefined amounts
    if (amount === null || amount === undefined) {
      console.log('⚠️ Amount is null/undefined, returning 0.00');
      return `${currency} 0.00`;
    }

    // Convert to number if it's a string
    const numericAmount =
      typeof amount === 'string' ? parseFloat(amount) : amount;

    // Check if conversion resulted in NaN
    if (isNaN(numericAmount)) {
      console.log('⚠️ Amount is NaN after conversion, returning 0.00');
      return `${currency} 0.00`;
    }

    // Smart conversion: if amount > 1000, assume it's in paisa and convert to rupees
    // if amount <= 1000, assume it's already in rupees
    const amountInRupees =
      numericAmount > 1000 ? numericAmount / 100 : numericAmount;

    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(amountInRupees);
    } catch {
      // Fallback without Intl support
      const symbol = currency === 'INR' ? '₹' : currency + ' ';
      return `${symbol}${amountInRupees.toFixed(2)}`;
    }
  };

  // Helper function to format date
  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to get payment method icon
  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return 'credit-card';
      case 'upi':
        return 'cellphone';
      case 'netbanking':
        return 'bank';
      case 'wallet':
        return 'wallet';
      case 'emi':
        return 'credit-card-clock';
      default:
        return 'credit-card';
    }
  };

  // Helper function to get payment method color
  const getPaymentMethodColor = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
        return '#3b82f6';
      case 'upi':
        return '#10b981';
      case 'netbanking':
        return '#8b5cf6';
      case 'wallet':
        return '#f59e0b';
      case 'emi':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Helper function to capitalize first letter
  const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment Details</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color="#28a745"
            />
            <Text style={styles.sectionTitle}>Payment Successful</Text>
          </View>
          <Text style={styles.statusText}>
            Your payment has been processed successfully
          </Text>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name={getPaymentMethodIcon(paymentData.method)}
              size={24}
              color={getPaymentMethodColor(paymentData.method)}
            />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>

          <View style={styles.methodCard}>
            <Text style={styles.methodText}>
              {capitalize(paymentData.method || 'Unknown')}
            </Text>

            {/* Debug information for unknown method */}
            {(!paymentData.method || paymentData.method === 'unknown') && (
              <View style={styles.debugInfo}>
                <Text style={styles.debugText}>
                  ⚠️ Payment method not detected
                </Text>
                <Text style={styles.debugSubtext}>
                  This usually happens with test payments or when payment method
                  details are not fully captured.
                </Text>
                <Text style={styles.debugSubtext}>
                  Check console logs for full Razorpay response.
                </Text>

                {/* Show raw response data for debugging */}
                <View style={styles.rawDataContainer}>
                  <Text style={styles.rawDataTitle}>Raw Response Data:</Text>
                  <Text style={styles.rawDataText}>
                    {JSON.stringify(paymentData, null, 2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Card Details */}
            {paymentData.method?.toLowerCase() === 'card' && (
              <View style={styles.detailsRow}>
                {paymentData.card_network && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Network</Text>
                    <Text style={styles.detailValue}>
                      {paymentData.card_network}
                    </Text>
                  </View>
                )}
                {paymentData.card_type && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>
                      {capitalize(paymentData.card_type)}
                    </Text>
                  </View>
                )}
                {paymentData.card_last4 && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Last 4 Digits</Text>
                    <Text style={styles.detailValue}>
                      **** {paymentData.card_last4}
                    </Text>
                  </View>
                )}
                {paymentData.card_issuer && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Issuer</Text>
                    <Text style={styles.detailValue}>
                      {paymentData.card_issuer}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* UPI Details */}
            {paymentData.method?.toLowerCase() === 'upi' && (
              <View style={styles.detailsRow}>
                {paymentData.upi_vpa && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>VPA</Text>
                    <Text style={styles.detailValue}>
                      {paymentData.upi_vpa}
                    </Text>
                  </View>
                )}
                {paymentData.upi_transaction_id && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Transaction ID</Text>
                    <Text style={styles.detailValue}>
                      {paymentData.upi_transaction_id}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Net Banking Details */}
            {paymentData.method?.toLowerCase() === 'netbanking' && (
              <View style={styles.detailsRow}>
                {paymentData.bank && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Bank</Text>
                    <Text style={styles.detailValue}>{paymentData.bank}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Wallet Details */}
            {paymentData.method?.toLowerCase() === 'wallet' && (
              <View style={styles.detailsRow}>
                {paymentData.wallet && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Wallet</Text>
                    <Text style={styles.detailValue}>{paymentData.wallet}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Transaction Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="receipt" size={24} color="#8b5cf6" />
            <Text style={styles.sectionTitle}>Transaction Details</Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailValue}>
                {formatAmount(paymentData.amount, paymentData.currency)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment ID</Text>
              <Text
                selectable
                style={[styles.detailValue, styles.idText, styles.idMono]}
              >
                {paymentData.razorpay_payment_id}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text
                selectable
                style={[styles.detailValue, styles.idText, styles.idMono]}
              >
                {paymentData.razorpay_order_id}
              </Text>
            </View>

            {paymentData.description && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>
                  {paymentData.description}
                </Text>
              </View>
            )}

            {paymentData.created_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formatDate(paymentData.created_at)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Financial Details */}
        {(paymentData.fee || paymentData.tax || paymentData.international) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="calculator"
                size={24}
                color="#f59e0b"
              />
              <Text style={styles.sectionTitle}>Financial Details</Text>
            </View>

            <View style={styles.detailsCard}>
              {paymentData.fee !== null && paymentData.fee !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Processing Fee</Text>
                  <Text style={styles.detailValue}>
                    {formatAmount(paymentData.fee, paymentData.currency)}
                  </Text>
                </View>
              )}

              {paymentData.tax !== null && paymentData.tax !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tax</Text>
                  <Text style={styles.detailValue}>
                    {formatAmount(paymentData.tax, paymentData.currency)}
                  </Text>
                </View>
              )}

              {paymentData.international !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>International</Text>
                  <Text style={styles.detailValue}>
                    {paymentData.international ? 'Yes' : 'No'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* User Details */}
        {(paymentData.contact || paymentData.name || paymentData.email) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="account"
                size={24}
                color="#ef4444"
              />
              <Text style={styles.sectionTitle}>User Details</Text>
            </View>

            <View style={styles.detailsCard}>
              {paymentData.name && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{paymentData.name}</Text>
                </View>
              )}

              {paymentData.contact && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contact</Text>
                  <Text style={styles.detailValue}>{paymentData.contact}</Text>
                </View>
              )}

              {paymentData.email && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{paymentData.email}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Security Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="shield-check"
              size={24}
              color="#28a745"
            />
            <Text style={styles.sectionTitle}>Security Information</Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Signature Verified</Text>
              <View style={styles.successPill}>
                <MaterialCommunityIcons
                  name="check"
                  size={14}
                  color="#16A34A"
                />
                <Text style={styles.successPillText}>Yes</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Status</Text>
              <View style={styles.successPill}>
                <MaterialCommunityIcons
                  name="check"
                  size={14}
                  color="#16A34A"
                />
                <Text style={styles.successPillText}>
                  {(paymentData.status || 'success').toString().toLowerCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.securityNote}>
              This payment was processed securely through Razorpay's encrypted
              payment gateway.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    color: '#111827',
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 10,
    fontFamily: 'Roboto-Bold',
    fontWeight: '700',
  },

  statusText: {
    fontSize: 14,
    color: '#16A34A',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    fontFamily: 'Roboto-Medium',
  },

  methodCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  methodText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
    fontFamily: 'Roboto-Medium',
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 10,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Roboto-Medium' },

  detailValue: {
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  idText: { fontSize: 12, color: '#6B7280', fontFamily: 'Roboto-Medium' },
  idMono: { fontFamily: 'Roboto-Mono, monospace' as unknown as string },

  successText: {
    color: '#16A34A',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  successPillText: {
    color: '#16A34A',
    marginLeft: 6,
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  securityNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    fontFamily: 'Roboto-Medium',
  },

  // Debug Information Styles
  debugInfo: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  debugText: {
    fontSize: 13,
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },

  debugSubtext: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 16,
    fontFamily: 'Roboto-Medium',
  },

  // Raw Data Display Styles
  rawDataContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  rawDataTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontFamily: 'Roboto-Medium',
  },

  rawDataText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Roboto-Medium',
    lineHeight: 14,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    fontFamily: 'Roboto-Medium',
  },
});

export default PaymentDetailsDisplay;
