import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

const NotificationSettings: React.FC = () => {
  const { settings, updateSettings, refreshFCMToken, isNotificationsEnabled } =
    useNotifications();
  const [loading, setLoading] = useState(false);

  const handleToggleSetting = async (
    key: keyof typeof settings,
    value: boolean,
  ) => {
    try {
      await updateSettings({ [key]: value });
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert('Error', 'Failed to update notification setting');
    }
  };

  const handleRefreshToken = async () => {
    setLoading(true);
    try {
      const token = await refreshFCMToken();
      if (token) {
        Alert.alert('Success', 'FCM token refreshed successfully');
      } else {
        Alert.alert('Error', 'Failed to refresh FCM token');
      }
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
      Alert.alert('Error', 'Failed to refresh FCM token');
    } finally {
      setLoading(false);
    }
  };

  const renderSettingItem = (
    title: string,
    description: string,
    key: keyof typeof settings,
    icon: string,
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#4f8cff" />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={settings[key] as boolean}
        onValueChange={value => handleToggleSetting(key, value)}
        trackColor={{ false: '#e0e0e0', true: '#4f8cff' }}
        thumbColor={settings[key] ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#4f8cff', '#6ba3ff']} style={styles.header}>
        <MaterialCommunityIcons name="bell-outline" size={32} color="#ffffff" />
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <Text style={styles.headerSubtitle}>
          Manage your notification preferences
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Main Toggle */}
        <View style={styles.mainToggle}>
          <View style={styles.mainToggleLeft}>
            <MaterialCommunityIcons
              name="bell-ring"
              size={28}
              color="#4f8cff"
            />
            <View style={styles.mainToggleText}>
              <Text style={styles.mainToggleTitle}>Enable Notifications</Text>
              <Text style={styles.mainToggleDescription}>
                Turn on/off all notifications
              </Text>
            </View>
          </View>
          <Switch
            value={isNotificationsEnabled()}
            onValueChange={value => handleToggleSetting('enabled', value)}
            trackColor={{ false: '#e0e0e0', true: '#4f8cff' }}
            thumbColor={isNotificationsEnabled() ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>

          {renderSettingItem(
            'Invoice Notifications',
            'Get notified about new invoices and updates',
            'invoiceNotifications',
            'file-document-outline',
          )}

          {renderSettingItem(
            'Payment Notifications',
            'Receive alerts for payment reminders and confirmations',
            'paymentNotifications',
            'currency-inr',
          )}

          {renderSettingItem(
            'System Notifications',
            'Important app updates and maintenance alerts',
            'systemNotifications',
            'cog-outline',
          )}
        </View>

        {/* Notification Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          {renderSettingItem(
            'Sound',
            'Play sound for notifications',
            'soundEnabled',
            'volume-high',
          )}

          {renderSettingItem(
            'Vibration',
            'Vibrate device for notifications',
            'vibrationEnabled',
            'vibrate',
          )}
        </View>

        {/* FCM Token Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced</Text>

          <TouchableOpacity
            style={styles.tokenButton}
            onPress={handleRefreshToken}
            disabled={loading}
          >
            <View style={styles.tokenButtonLeft}>
              <MaterialCommunityIcons
                name="refresh"
                size={24}
                color="#4f8cff"
              />
              <View style={styles.tokenButtonText}>
                <Text style={styles.tokenButtonTitle}>Refresh FCM Token</Text>
                <Text style={styles.tokenButtonDescription}>
                  Update your device token for notifications
                </Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color="#4f8cff" />
            ) : (
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="#cccccc"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <MaterialCommunityIcons
            name="information-outline"
            size={20}
            color="#666666"
          />
          <Text style={styles.infoText}>
            Notifications help you stay updated with important business
            activities. You can customize which types of notifications you want
            to receive.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    color: '#ffffff',
    marginTop: 10,

    fontFamily: 'Roboto-Medium',
  },

  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 5,

    fontFamily: 'Roboto-Medium',
  },

  content: {
    padding: 20,
  },
  mainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mainToggleText: {
    marginLeft: 15,
    flex: 1,
  },
  mainToggleTitle: {
    fontSize: 18,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  mainToggleDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#333333',
    padding: 20,
    paddingBottom: 10,

    fontFamily: 'Roboto-Medium',
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 15,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  settingDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  tokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  tokenButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenButtonText: {
    marginLeft: 15,
    flex: 1,
  },
  tokenButtonTitle: {
    fontSize: 16,
    color: '#333333',

    fontFamily: 'Roboto-Medium',
  },

  tokenButtonDescription: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },
});

export default NotificationSettings;
