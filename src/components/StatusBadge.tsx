import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid':
    case 'complete':
      return '#28a745'; // Green
    case 'pending':
    case 'draft':
      return '#ffc107'; // Yellow
    case 'overdue':
      return '#dc3545'; // Red
    default:
      return '#6c757d'; // Gray
  }
};

const getStatusLabel = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'complete':
      return 'Paid';
    case 'draft':
      return 'Pending';
    case 'overdue':
      return 'Overdue';
    default:
      return status?.charAt(0).toUpperCase() + status?.slice(1) || 'Status';
  }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <View
    style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}
  >
    <Text style={styles.statusText}>{getStatusLabel(status)}</Text>
  </View>
);

const styles = StyleSheet.create({
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default StatusBadge;
