import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');

const CustomAlert: React.FC = () => {
  const { alert, isVisible, hideAlert } = useAlert();
  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [scaleAnim] = React.useState(new Animated.Value(0.8));

  React.useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  if (!alert || !isVisible) return null;

  const getAlertConfig = () => {
    switch (alert.type) {
      case 'success':
        return {
          icon: 'check-circle',
          color: '#28a745',
          backgroundColor: '#d4edda',
          iconColor: '#28a745',
        };
      case 'error':
        return {
          icon: 'alert-circle',
          color: '#dc3545',
          backgroundColor: '#f8d7da',
          iconColor: '#dc3545',
        };
      case 'warning':
        return {
          icon: 'alert',
          color: '#ffc107',
          backgroundColor: '#fff3cd',
          iconColor: '#ffc107',
        };
      case 'confirm':
        return {
          icon: 'help-circle',
          color: '#007bff',
          backgroundColor: '#d1ecf1',
          iconColor: '#007bff',
        };
      default: // info
        return {
          icon: 'information',
          color: '#17a2b8',
          backgroundColor: '#d1ecf1',
          iconColor: '#17a2b8',
        };
    }
  };

  const config = getAlertConfig();

  const handleConfirm = () => {
    if (alert.onConfirm) {
      alert.onConfirm();
    }
    hideAlert();
  };

  const handleCancel = () => {
    if (alert.onCancel) {
      alert.onCancel();
    }
    hideAlert();
  };

  const handleBackdropPress = () => {
    if (alert.type !== 'confirm') {
      hideAlert();
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={hideAlert}
      statusBarTranslucent={true}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />

      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
        onTouchEnd={handleBackdropPress}
      >
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: config.backgroundColor,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: config.color + '20' },
              ]}
            >
              <MaterialCommunityIcons
                name={config.icon}
                size={48}
                color={config.iconColor}
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: config.color }]}>
              {alert.title}
            </Text>

            {/* Message */}
            <Text style={styles.message}>{alert.message}</Text>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {alert.type === 'confirm' && alert.showCancel !== false && (
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelButtonText}>
                    {alert.cancelText || 'Cancel'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  { backgroundColor: config.color },
                  alert.type === 'confirm'
                    ? styles.confirmButtonWithCancel
                    : styles.confirmButtonFull,
                ]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>
                  {alert.confirmText ||
                    (alert.type === 'confirm' ? 'Confirm' : 'OK')}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  safeArea: {
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Roboto-Medium',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    color: '#333',
    marginBottom: 24,
    fontFamily: 'Roboto-Medium',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  confirmButton: {
    // backgroundColor will be set dynamically
  },
  confirmButtonWithCancel: {
    flex: 1,
  },
  confirmButtonFull: {
    width: '100%',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
});

export default CustomAlert;
