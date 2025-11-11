import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import SubscriptionNotificationService, {
  RenewalNotificationData,
} from '../services/subscriptionNotificationService';

interface SubscriptionRenewalNotificationProps {
  visible: boolean;
  notificationData: RenewalNotificationData | null;
  onClose: () => void;
  onUpgrade: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SubscriptionRenewalNotification: React.FC<
  SubscriptionRenewalNotificationProps
> = ({ visible, notificationData, onClose, onUpgrade }) => {
  const navigation = useNavigation();
  const [slideAnim] = useState(new Animated.Value(screenHeight));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleUpgrade = () => {
    onClose();
    onUpgrade();
    // Navigate to subscription plan screen
    (navigation as any).navigate('App', {
      screen: 'AppStack',
      params: { screen: 'SubscriptionPlan' },
    });
  };

  const handleRemindLater = () => {
    onClose();
    // Notification will show again in 24 hours
  };

  const getUrgencyLevel = (daysUntilExpiry: number) => {
    if (daysUntilExpiry <= 3) return 'critical';
    if (daysUntilExpiry <= 7) return 'high';
    return 'medium';
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'critical':
        return ['#ff6b6b', '#ee5a52'];
      case 'high':
        return ['#ffa726', '#ff9800'];
      default:
        return ['#8f5cff', '#6f4cff'];
    }
  };

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return 'warning';
      case 'high':
        return 'time';
      default:
        return 'calendar';
    }
  };

  const getUrgencyMessage = (daysUntilExpiry: number) => {
    if (daysUntilExpiry === 1) {
      return 'Your subscription expires tomorrow!';
    }
    if (daysUntilExpiry <= 3) {
      return `Your subscription expires in ${daysUntilExpiry} days!`;
    }
    if (daysUntilExpiry <= 7) {
      return `Your subscription expires in ${daysUntilExpiry} days`;
    }
    return `Your subscription expires in ${daysUntilExpiry} days`;
  };

  if (!visible || !notificationData) {
    return null;
  }

  const urgencyLevel = getUrgencyLevel(notificationData.daysUntilExpiry);
  const urgencyColors = getUrgencyColor(urgencyLevel);
  const urgencyIcon = getUrgencyIcon(urgencyLevel);
  const urgencyMessage = getUrgencyMessage(notificationData.daysUntilExpiry);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header with gradient */}
          <LinearGradient
            colors={urgencyColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name={urgencyIcon} size={32} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Subscription Renewal</Text>
                <Text style={styles.subtitle}>{urgencyMessage}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>
                {notificationData.subscription.plan.displayName}
              </Text>
              <Text style={styles.planPrice}>
                ₹{notificationData.subscription.plan.price}/
                {notificationData.subscription.plan.billingCycle}
              </Text>
            </View>

            <View style={styles.messageContainer}>
              <Text style={styles.message}>
                {notificationData.daysUntilExpiry <= 3
                  ? 'Your subscription is expiring soon! Renew now to continue enjoying all premium features without interruption.'
                  : "Don't miss out on your premium features. Renew your subscription to maintain uninterrupted access."}
              </Text>
            </View>

            {/* Features reminder */}
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>Premium Features:</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Unlimited transactions</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Advanced reporting</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Priority support</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.featureText}>Data backup & sync</Text>
                </View>
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={handleUpgrade}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={urgencyColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.upgradeButtonGradient}
                >
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.upgradeButtonText}>
                    {notificationData.daysUntilExpiry <= 3
                      ? 'Renew Now'
                      : 'Upgrade Plan'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.remindLaterButton}
                onPress={handleRemindLater}
                activeOpacity={0.7}
              >
                <Text style={styles.remindLaterText}>Remind me later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    color: '#fff',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',

    fontFamily: 'Roboto-Medium',
  },

  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  planInfo: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  planName: {
    fontSize: 18,
    color: '#1a202c',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  planPrice: {
    fontSize: 16,
    color: '#718096',

    fontFamily: 'Roboto-Medium',
  },

  messageContainer: {
    marginBottom: 24,
  },
  message: {
    fontSize: 15,
    color: '#4a5568',
    lineHeight: 22,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 16,
    color: '#1a202c',
    marginBottom: 12,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 8,
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },

  buttonContainer: {
    gap: 12,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#8f5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 16,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  remindLaterButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  remindLaterText: {
    fontSize: 14,
    color: '#718096',

    fontFamily: 'Roboto-Medium',
  },
});

export default SubscriptionRenewalNotification;
