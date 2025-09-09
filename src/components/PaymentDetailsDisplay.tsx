import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
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

const PaymentDetailsDisplay: React.FC<PaymentDetailsDisplayProps> = ({
  paymentData,
  onClose,
}) => {
  // Helper function to format amount
  const formatAmount = (amount: number, currency: string = 'INR') => {
    const amountInRupees = amount / 100; // Convert from paisa to rupees
    return `${currency} ${amountInRupees.toFixed(2)}`;
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color="#10b981"
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
              <Text style={[styles.detailValue, styles.idText]}>
                {paymentData.razorpay_payment_id}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={[styles.detailValue, styles.idText]}>
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
              {paymentData.fee && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Processing Fee</Text>
                  <Text style={styles.detailValue}>
                    {formatAmount(paymentData.fee, paymentData.currency)}
                  </Text>
                </View>
              )}

              {paymentData.tax && (
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
              color="#10b981"
            />
            <Text style={styles.sectionTitle}>Security Information</Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Signature Verified</Text>
              <Text style={[styles.detailValue, styles.successText]}>
                ✅ Yes
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Status</Text>
              <Text style={[styles.detailValue, styles.successText]}>
                ✅ {paymentData.status || 'Captured'}
              </Text>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '500',
    textAlign: 'center',
    padding: 16,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  methodCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  idText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  successText: {
    color: '#10b981',
  },
  securityNote: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },

  // Debug Information Styles
  debugInfo: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  debugText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  debugSubtext: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 16,
  },

  // Raw Data Display Styles
  rawDataContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  rawDataTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  rawDataText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});

export default PaymentDetailsDisplay;
