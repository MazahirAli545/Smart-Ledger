import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getNextPlanName } from '../utils/planUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TransactionLimitPopupProps {
  visible: boolean;
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  planName: string;
  percentageUsed: number;
  isAtLimit: boolean;
  nextResetDate: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const TransactionLimitPopup: React.FC<TransactionLimitPopupProps> = ({
  visible,
  currentCount,
  maxAllowed,
  remaining,
  planName,
  percentageUsed,
  isAtLimit,
  nextResetDate,
  onClose,
  onUpgrade,
}) => {
  const nextPlanName = getNextPlanName(planName);
  const isLastPlan = nextPlanName === null;

  const handleUpgrade = () => {
    onUpgrade();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.popupContainer}>
          <LinearGradient
            colors={['#fff', '#f8f9fa']}
            style={styles.popupContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="alert-circle" size={32} color="#ffffff" />
              </View>
              <Text style={styles.title}>
                {isAtLimit
                  ? 'Transaction Limit Reached'
                  : 'Transaction Limit Warning'}
              </Text>
              <Text style={styles.subtitle}>
                {planName} Plan • {currentCount}/{maxAllowed} transactions used
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(percentageUsed, 100)}%`,
                      backgroundColor: isAtLimit ? '#dc3545' : '#dc3545',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {percentageUsed}% used • {remaining} remaining
              </Text>
            </View>

            {/* Message */}
            <View style={styles.messageSection}>
              <Text style={styles.message}>
                {isAtLimit
                  ? 'You have reached your monthly transaction limit. Please upgrade your plan to continue creating transactions.'
                  : 'You are approaching your monthly transaction limit. Consider upgrading your plan to avoid interruptions.'}
              </Text>
              <Text style={styles.resetInfo}>Next reset: {nextResetDate}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {!isLastPlan ? (
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={handleUpgrade}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                  <Text style={styles.upgradeButtonText}>
                    Upgrade your plan for {nextPlanName}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.lastPlanMessage}>
                  <Ionicons name="trophy" size={24} color="#28a745" />
                  <Text style={styles.lastPlanText}>
                    You're on our highest plan! 🎉
                  </Text>
                  <Text style={styles.lastPlanSubtext}>
                    Contact support for custom enterprise solutions.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>
                  {isLastPlan ? 'Continue' : 'Dismiss'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  popupContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  popupContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  progressSection: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#dc2626',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  messageSection: {
    marginBottom: 24,
  },
  message: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,

    fontFamily: 'Roboto-Medium',
  },

  resetInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  actionButtons: {
    gap: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f8cff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  dismissButton: {
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 14,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  lastPlanMessage: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  lastPlanText: {
    fontSize: 16,
    color: '#28a745',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  lastPlanSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },
});

export default TransactionLimitPopup;
