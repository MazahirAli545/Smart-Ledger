import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import NetInfo from '@react-native-community/netinfo';
import { useAlert } from '../context/AlertContext';

const { width, height } = Dimensions.get('window');

const NetworkStatusModal: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const { showAlert } = useAlert();

  useEffect(() => {
    console.log('🌐 NetworkStatusModal: Initializing...');

    const checkNetworkStatus = async () => {
      try {
        const state = await NetInfo.fetch();
        console.log('🌐 Initial network state:', state);

        const connected = state.isConnected ?? false;
        const internetReachable = state.isInternetReachable ?? true;
        const hasInternet = connected && internetReachable;

        setIsConnected(hasInternet);
        setConnectionType(state.type || 'unknown');

        if (!hasInternet) {
          console.log('🚨 No internet connection detected');
          setIsModalVisible(true);
        }
      } catch (error) {
        console.error('❌ Network check failed:', error);
        setIsConnected(false);
        setIsModalVisible(true);
      }
    };

    checkNetworkStatus();

    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('🌐 Network state changed:', state);

      const connected = state.isConnected ?? false;
      const internetReachable = state.isInternetReachable ?? true;
      const hasInternet = connected && internetReachable;

      setIsConnected(prevConnected => {
        const wasConnected = prevConnected;

        if (!hasInternet && wasConnected) {
          console.log('🚨 Internet connection lost - showing popup');
          setIsModalVisible(true);
        } else if (hasInternet && !wasConnected) {
          console.log('✅ Internet connection restored - hiding popup');
          setTimeout(() => {
            setIsModalVisible(false);
          }, 1500);
        }

        return hasInternet;
      });

      setConnectionType(state.type || 'unknown');
    });

    return () => {
      console.log('🌐 NetworkStatusModal: Cleaning up...');
      unsubscribe();
    };
  }, []); // Remove isConnected from dependencies to fix stale closure

  const handleRetry = async () => {
    console.log('🔄 Retrying network connection...');
    try {
      const state = await NetInfo.fetch();
      const connected = state.isConnected ?? false;
      const internetReachable = state.isInternetReachable ?? true;
      const hasInternet = connected && internetReachable;

      if (hasInternet) {
        setIsModalVisible(false);
        showAlert({
          title: 'Success',
          message: 'Internet connection restored!',
          type: 'success',
        });
      } else {
        showAlert({
          title: 'No Internet',
          message: 'Please check your network settings and try again',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('❌ Retry failed:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to check network status',
        type: 'error',
      });
    }
  };

  const handleDismiss = () => {
    console.log('❌ User dismissed network popup');
    setIsModalVisible(false);
  };

  return (
    <Modal
      visible={isModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <StatusBar backgroundColor="rgba(0,0,0,0.7)" barStyle="light-content" />

        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalContent}>
            {/* Header with Icon */}
            <View style={styles.headerSection}>
              <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                  name="wifi-off"
                  size={64}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.titleText}>No Internet Connection</Text>
              <Text style={styles.subtitleText}>
                Please check your network settings and try again
              </Text>
            </View>

            {/* Connection Status */}
            <View style={styles.statusSection}>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name="wifi"
                  size={20}
                  color="#ffffff"
                  style={styles.statusIcon}
                />
                <Text style={styles.statusText}>
                  Status: {isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>

              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name="cellphone"
                  size={20}
                  color="#ffffff"
                  style={styles.statusIcon}
                />
                <Text style={styles.statusText}>
                  Type:{' '}
                  {connectionType.charAt(0).toUpperCase() +
                    connectionType.slice(1)}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={20}
                  color="#ffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.primaryButtonText}>Retry Connection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>

            {/* Help Section */}
            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>Troubleshooting Tips:</Text>
              <Text style={styles.helpItem}>
                • Check your WiFi or mobile data
              </Text>
              <Text style={styles.helpItem}>
                • Move to an area with better signal
              </Text>
              <Text style={styles.helpItem}>
                • Restart your router if using WiFi
              </Text>
              <Text style={styles.helpItem}>
                • Check your device's network settings
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: width - 40,
    maxHeight: height * 0.8,
    backgroundColor: '#ff4757',
    borderRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContent: {
    padding: 24,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  subtitleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,

    fontFamily: 'Roboto-Medium',
  },

  // Status Section
  statusSection: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },

  // Button Section
  buttonSection: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#ffffff',

    fontFamily: 'Roboto-Medium',
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'underline',

    fontFamily: 'Roboto-Medium',
  },

  // Help Section
  helpSection: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 16,
  },
  helpTitle: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  helpItem: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    marginBottom: 4,

    fontFamily: 'Roboto-Medium',
  },
});

export default NetworkStatusModal;
