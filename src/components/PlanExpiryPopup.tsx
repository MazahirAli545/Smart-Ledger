import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

interface PlanExpiryPopupProps {
  visible: boolean;
  planName: string;
  expiredDate: string;
  onClose: () => void;
  onRenew: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const PlanExpiryPopup: React.FC<PlanExpiryPopupProps> = ({
  visible,
  planName,
  expiredDate,
  onClose,
  onRenew,
}) => {
  const navigation = useNavigation();
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      // Animate in with scale and fade
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation for urgency
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      // Animate out with scale and fade
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim, pulseAnim]);

  const handleRenew = () => {
    onClose();
    onRenew();
    // Navigate to subscription plan screen
    (navigation as any).navigate('App', {
      screen: 'AppStack',
      params: { screen: 'SubscriptionPlan' },
    });
  };

  const formatExpiredDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Modal Header with gradient */}
          <LinearGradient
            colors={['#dc3545', '#c82333']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalHeader}
          >
            <View style={styles.headerContent}>
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <Ionicons name="warning" size={24} color="#fff" />
              </Animated.View>
              <View style={styles.headerText}>
                <Text style={styles.modalTitle}>Subscription Expired</Text>
                <Text style={styles.modalSubtitle}>
                  {planName} Plan • Expired {formatExpiredDate(expiredDate)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Modal Body */}
          <View style={styles.modalBody}>
            <View style={styles.expiryInfo}>
              <View style={styles.expiryIcon}>
                <Ionicons name="time" size={32} color="#dc3545" />
              </View>
              <Text style={styles.expiryTitle}>
                Your subscription has expired
              </Text>
              <Text style={styles.expiryDescription}>
                Your {planName} plan expired on {formatExpiredDate(expiredDate)}
                . Renew now to continue enjoying all premium features.
              </Text>
            </View>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.featureText}>Unlimited transactions</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.featureText}>Priority support</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#28a745" />
                <Text style={styles.featureText}>Advanced analytics</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.renewButton}
                onPress={handleRenew}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.renewButtonText}>Renew Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>
                  Continue with Free Plan
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },

  modalSubtitle: {
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
  modalBody: {
    padding: 20,
  },
  expiryInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  expiryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  expiryTitle: {
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  expiryDescription: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,

    fontFamily: 'Roboto-Medium',
  },

  actionButtons: {
    gap: 12,
  },
  renewButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  renewButtonText: {
    fontSize: 16,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  dismissButton: {
    backgroundColor: '#6c757d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  dismissButtonText: {
    fontSize: 14,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },
});

export default PlanExpiryPopup;
