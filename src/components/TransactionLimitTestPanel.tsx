import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTransactionLimit } from '../context/TransactionLimitContext';

const TransactionLimitTestPanel: React.FC = () => {
  const { forceTriggerNotification, getServiceStatus } = useTransactionLimit();
  const [status, setStatus] = useState<any>(null);

  const handleTestPopup = async () => {
    try {
      await forceTriggerNotification();
      Alert.alert('Test', 'Transaction limit popup triggered');
    } catch (error) {
      Alert.alert('Error', 'Failed to trigger popup');
    }
  };

  const handleCheckStatus = async () => {
    try {
      const serviceStatus = await getServiceStatus();
      setStatus(serviceStatus);
      Alert.alert(
        'Service Status',
        `Active: ${serviceStatus.serviceActive}\nPopup Shown: ${
          serviceStatus.popupShown
        }\nLast Notification: ${
          serviceStatus.lastNotificationTime
            ? new Date(serviceStatus.lastNotificationTime).toLocaleString()
            : 'Never'
        }\nHours Since: ${serviceStatus.hoursSinceLastNotification || 'N/A'}`,
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get service status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction Limit Test Panel</Text>

      <TouchableOpacity style={styles.button} onPress={handleTestPopup}>
        <Text style={styles.buttonText}>Test Popup</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleCheckStatus}>
        <Text style={styles.buttonText}>Check Status</Text>
      </TouchableOpacity>

      {status && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Service Status:</Text>
          <Text style={styles.statusText}>
            Active: {status.serviceActive ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.statusText}>
            Popup Shown: {status.popupShown ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.statusText}>
            Last Notification:{' '}
            {status.lastNotificationTime
              ? new Date(status.lastNotificationTime).toLocaleString()
              : 'Never'}
          </Text>
          <Text style={styles.statusText}>
            Hours Since: {status.hoursSinceLastNotification || 'N/A'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4f8cff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});

export default TransactionLimitTestPanel;
