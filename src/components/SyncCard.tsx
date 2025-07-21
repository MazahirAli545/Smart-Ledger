import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SyncCardProps {
  status: string;
  amount: string;
  onSync: () => void;
  syncLabel?: string;
  style?: any;
}

const SyncCard: React.FC<SyncCardProps> = ({
  status,
  amount,
  onSync,
  syncLabel = 'Sync1',
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.topSection}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        <Text style={styles.amountText}>{amount}</Text>
      </View>
      <TouchableOpacity style={styles.syncButton} onPress={onSync}>
        <Text style={styles.syncButtonText}>{syncLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    width: 400,
    minHeight: 180,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 24,
    // width: 300,
  },
  statusBadge: {
    backgroundColor: '#e6f7ec',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  statusText: {
    color: '#28a745',
    fontWeight: 'bold',
    fontSize: 16,
  },
  amountText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  syncButton: {
    marginTop: 10,
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
});

export default SyncCard;
