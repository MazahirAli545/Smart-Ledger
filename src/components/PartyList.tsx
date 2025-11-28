import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

export interface PartyItem {
  id: string;
  name: string;
  partyType?: 'customer' | 'supplier';
  amount?: number;
  type?: 'give' | 'get';
  phoneNumber?: string;
}

interface PartyListProps {
  items: PartyItem[];
  emptyTitle: string;
  emptySubtitle: string;
  onPressItem: (item: PartyItem) => void;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

const PartyList: React.FC<PartyListProps> = ({
  items,
  emptyTitle,
  emptySubtitle,
  onPressItem,
  onEndReached,
  isLoadingMore = false,
  hasMore = true,
}) => {
  if (!Array.isArray(items)) items = [];

  // Helper function to format phone number for display (Indian format)
  const formatPhoneNumber = (phone: string | undefined): string | undefined => {
    if (!phone) return undefined;
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(-10);
    if (digits.length === 10) return `+91-${digits}`;
    return undefined;
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => String(item.id || index)}
      style={styles.list}
      contentContainerStyle={
        items.length === 0 ? styles.emptyContent : undefined
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => onPressItem(item)}
          activeOpacity={0.8}
        >
          <View style={styles.itemLeftWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item?.name || 'U').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.itemLeft}>
              <Text style={styles.itemName}>{item.name || 'Unknown'}</Text>
              {(() => {
                const phoneNum = formatPhoneNumber(
                  (item as any)?.phoneNumber || item.phoneNumber,
                );
                return phoneNum ? (
                  <Text style={styles.itemType}>{phoneNum}</Text>
                ) : null;
              })()}
            </View>
          </View>
          <View style={styles.itemRight}>
            <Text
              style={[
                styles.itemAmount,
                { color: item.type === 'get' ? '#28a745' : '#dc3545' },
              ]}
            >
              ₹{Math.abs(Number(item.amount || 0)).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.itemAmountLabel}>
              {item.type === 'get' ? 'Receipt' : 'Payment'}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={() => (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
        </View>
      )}
      ListFooterComponent={() => {
        if (!items.length) return null;
        if (isLoadingMore) {
          return (
            <View style={styles.footerContainer}>
              <ActivityIndicator size="small" color="#4f8cff" />
              <Text style={styles.footerText}>Loading more...</Text>
            </View>
          );
        }
        return null;
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },
  itemLeft: {
    flex: 1,
    paddingRight: 10,
  },
  itemRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  itemName: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  itemType: {
    fontSize: 12,
    color: '#64748b',

    fontFamily: 'Roboto-Medium',
  },

  itemAmount: {
    fontSize: 14,

    fontFamily: 'Roboto-Medium',
  },

  itemAmountLabel: {
    fontSize: 11,
    color: '#64748b',

    fontFamily: 'Roboto-Medium',
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  emptySubtitle: {
    fontSize: 11,
    color: '#64748b',

    fontFamily: 'Roboto-Medium',
  },
  footerContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontFamily: 'Roboto-Medium',
  },
});

export default PartyList;
