import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNotifications } from '../../context/NotificationContext';
import NotificationSettings from '../../components/NotificationSettings';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type?: string;
  data?: Record<string, string>;
}

const NotificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { pendingNotifications, clearPendingNotifications } =
    useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh notifications - this will be handled by the context
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearPendingNotifications();
          },
        },
      ],
    );
  };

  const handleNotificationPress = (notification: any) => {
    // Handle navigation based on notification type
    const { type, id, screen } = notification;

    if (type && id) {
      switch (type) {
        case 'invoice':
          (navigation as any).navigate('Invoice', { invoiceId: id });
          break;
        case 'payment':
          (navigation as any).navigate('Payment', { paymentId: id });
          break;
        case 'receipt':
          (navigation as any).navigate('Receipt', { receiptId: id });
          break;
        case 'purchase':
          (navigation as any).navigate('Purchase', { purchaseId: id });
          break;
        default:
          if (screen) {
            (navigation as any).navigate(screen);
          }
          break;
      }
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'invoice':
        return 'file-document-outline';
      case 'payment':
        return 'currency-inr';
      case 'receipt':
        return 'receipt';
      case 'purchase':
        return 'cart-outline';
      default:
        return 'bell-outline';
    }
  };

  const renderNotificationItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <MaterialCommunityIcons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color="#4f8cff"
        />
      </View>

      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>
          {item.title || item.type || 'Notification'}
        </Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body || 'You have a new notification'}
        </Text>
        <Text style={styles.notificationTime}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={20} color="#cccccc" />
    </TouchableOpacity>
  );

  if (showSettings) {
    return <NotificationSettings />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#4f8cff', '#6ba3ff']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notifications</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowSettings(true)}
            >
              <MaterialCommunityIcons name="cog" size={24} color="#ffffff" />
            </TouchableOpacity>

            {pendingNotifications.length > 0 && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleClearAll}
              >
                <MaterialCommunityIcons
                  name="delete-sweep"
                  size={24}
                  color="#ffffff"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={pendingNotifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="bell-off-outline"
              size={64}
              color="#cccccc"
            />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              You're all caught up! Check back later for new updates.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  listContainer: {
    padding: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default NotificationScreen;
