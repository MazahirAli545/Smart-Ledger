import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  TEST_CREDENTIALS,
  TEST_USERS,
  getTestCredentials,
  getTestUser,
  TestCredentials,
  TestUser,
} from '../config/testCredentials';

interface TestCredentialsPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelectCredentials?: (credentials: TestCredentials) => void;
  onSelectUser?: (user: TestUser) => void;
  mode: 'registration' | 'login';
}

const TestCredentialsPanel: React.FC<TestCredentialsPanelProps> = ({
  visible,
  onClose,
  onSelectCredentials,
  onSelectUser,
  mode,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleSelectCredentials = (index: number) => {
    setSelectedIndex(index);
    const credentials = getTestCredentials(index);

    if (mode === 'registration' && onSelectCredentials) {
      onSelectCredentials(credentials);
      Alert.alert(
        'Test Credentials Selected',
        `Selected: ${credentials.businessName}\nMobile: ${credentials.mobileNumber}\nOwner: ${credentials.ownerName}`,
        [{ text: 'OK', onPress: onClose }],
      );
    }
  };

  const handleSelectUser = (index: number) => {
    setSelectedIndex(index);
    const user = getTestUser(index);

    if (mode === 'login' && onSelectUser) {
      onSelectUser(user);
      Alert.alert(
        'Test User Selected',
        `Selected: ${user.businessName}\nMobile: ${user.mobileNumber}\nPlan: ${
          user.planType
        }\nProfile Complete: ${user.profileComplete ? 'Yes' : 'No'}`,
        [{ text: 'OK', onPress: onClose }],
      );
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
    } else {
      // For React Native, you might want to use a clipboard library
      Alert.alert(
        'Copy to Clipboard',
        `${label}: ${text}\n\nCopy this manually for now.`,
      );
    }
  };

  const renderCredentialsList = () => {
    if (mode === 'registration') {
      return (
        <ScrollView style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Test Registration Credentials</Text>
          {TEST_CREDENTIALS.map((credentials, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.credentialItem,
                selectedIndex === index && styles.selectedItem,
              ]}
              onPress={() => handleSelectCredentials(index)}
            >
              <View style={styles.credentialHeader}>
                <Text style={styles.businessName}>
                  {credentials.businessName}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>#{index + 1}</Text>
                </View>
              </View>

              <View style={styles.credentialDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Owner:</Text>
                  <Text style={styles.value}>{credentials.ownerName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Mobile:</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopyToClipboard(
                        credentials.mobileNumber,
                        'Mobile Number',
                      )
                    }
                  >
                    <Text style={[styles.value, styles.copyable]}>
                      {credentials.mobileNumber}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>{credentials.businessType}</Text>
                </View>

                {credentials.gstNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>GST:</Text>
                    <TouchableOpacity
                      onPress={() =>
                        handleCopyToClipboard(
                          credentials.gstNumber!,
                          'GST Number',
                        )
                      }
                    >
                      <Text style={[styles.value, styles.copyable]}>
                        {credentials.gstNumber}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelectCredentials(index)}
                >
                  <Text style={styles.selectButtonText}>Select</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    } else {
      return (
        <ScrollView style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Test Login Users</Text>
          {TEST_USERS.map((user, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.credentialItem,
                selectedIndex === index && styles.selectedItem,
              ]}
              onPress={() => handleSelectUser(index)}
            >
              <View style={styles.credentialHeader}>
                <Text style={styles.businessName}>{user.businessName}</Text>
                <View
                  style={[
                    styles.badge,
                    styles[
                      `plan${
                        user.planType.charAt(0).toUpperCase() +
                        user.planType.slice(1)
                      }`
                    ],
                  ]}
                >
                  <Text style={styles.badgeText}>{user.planType}</Text>
                </View>
              </View>

              <View style={styles.credentialDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Owner:</Text>
                  <Text style={styles.value}>{user.ownerName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Mobile:</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopyToClipboard(user.mobileNumber, 'Mobile Number')
                    }
                  >
                    <Text style={[styles.value, styles.copyable]}>
                      {user.mobileNumber}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>{user.businessType}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.label}>Profile:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      user.profileComplete
                        ? styles.statusComplete
                        : styles.statusIncomplete,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {user.profileComplete ? 'Complete' : 'Incomplete'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelectUser(index)}
                >
                  <Text style={styles.selectButtonText}>Select</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {mode === 'registration'
                ? 'Test Registration Credentials'
                : 'Test Login Users'}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>{renderCredentialsList()}</View>

          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>
              💡 Select test credentials to quickly fill forms during
              development
            </Text>
            <Text style={styles.warningText}>
              ⚠️ These are for testing only. Never use in production!
            </Text>
          </View>
        </View>
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
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 11,
    color: '#dc3545',
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  credentialItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: '#4f8cff',
    backgroundColor: '#e3f2fd',
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  badge: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  planFree: {
    backgroundColor: '#28a745',
  },
  planStarter: {
    backgroundColor: '#17a2b8',
  },
  planProfessional: {
    backgroundColor: '#ffc107',
  },
  planEnterprise: {
    backgroundColor: '#dc3545',
  },
  credentialDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    width: 60,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
  copyable: {
    color: '#4f8cff',
    textDecorationLine: 'underline',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusComplete: {
    backgroundColor: '#28a745',
  },
  statusIncomplete: {
    backgroundColor: '#ffc107',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  selectButton: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TestCredentialsPanel;
