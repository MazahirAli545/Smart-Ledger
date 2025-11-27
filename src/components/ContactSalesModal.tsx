import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Dropdown } from 'react-native-element-dropdown';
import { unifiedApi } from '../api/unifiedApiService';
import { showLocalNotification } from '../utils/notificationHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../context/AlertContext';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import {
  hasUserDeclinedNotifications,
  markNotificationsAsDeclined,
} from '../utils/notificationPrefs';

interface ContactSalesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface IssueOption {
  label: string;
  value: string;
}

const ISSUE_OPTIONS: IssueOption[] = [
  { label: 'Pricing Inquiry', value: 'pricing_inquiry' },
  { label: 'Feature Request', value: 'feature_request' },
  { label: 'Technical Support', value: 'technical_support' },
  { label: 'Billing Issue', value: 'billing_issue' },
  { label: 'Account Management', value: 'account_management' },
  { label: 'General Inquiry', value: 'general_inquiry' },
  { label: 'Partnership Opportunity', value: 'partnership_opportunity' },
  { label: 'Other', value: 'other' },
];

const ContactSalesModal: React.FC<ContactSalesModalProps> = ({
  visible,
  onClose,
}) => {
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertShowing, setAlertShowing] = useState(false);
  const [errors, setErrors] = useState<{
    userName?: string;
    userPhone?: string;
    businessName?: string;
    selectedIssue?: string;
    description?: string;
  }>({});
  const { showAlert } = useAlert();

  // Refs for auto-focus
  const descriptionInputRef = useRef<TextInput>(null);

  // Load user data when modal opens
  useEffect(() => {
    if (visible) {
      loadUserData();
      setAlertShowing(false); // Reset alert state when modal opens
      setErrors({}); // Clear errors when modal opens
      // Auto-focus on description field after a short delay
      setTimeout(() => {
        descriptionInputRef.current?.focus();
      }, 300);
    } else {
      // Reset form when modal closes
      resetForm();
      setAlertShowing(false); // Reset alert state when modal closes
      setErrors({}); // Clear errors when modal closes
    }
  }, [visible]);

  const loadUserData = async () => {
    try {
      const storedName = await AsyncStorage.getItem('userName');
      const storedPhone = await AsyncStorage.getItem('userMobile');
      const storedBusinessName = await AsyncStorage.getItem('businessName');

      if (storedName) setUserName(storedName);
      if (storedPhone) setUserPhone(storedPhone);
      if (storedBusinessName) setBusinessName(storedBusinessName);

      // Also try to get from token if available
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          // Try to get user profile from API
          // Use unified API
          const profile = (await unifiedApi.getUserProfile()) as
            | { data: any; status: number; headers: Headers }
            | any;
          const profileData = (profile as any)?.data ?? profile ?? {};
          if (profileData?.ownerName && !userName)
            setUserName(profileData.ownerName);
          if (profileData?.mobileNumber && !userPhone)
            setUserPhone(profileData.mobileNumber);
          if (profileData?.businessName && !businessName)
            setBusinessName(profileData.businessName);
        }
      } catch (error) {
        console.log('Could not fetch user profile:', error);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const resetForm = () => {
    setUserName('');
    setUserPhone('');
    setBusinessName('');
    setSelectedIssue('');
    setDescription('');
    setErrors({});
  };

  const handleSubmit = async () => {
    // Clear previous errors
    const newErrors: typeof errors = {};

    // Auto-load user data if not already loaded
    if (!userName.trim() || !userPhone.trim() || !businessName.trim()) {
      await loadUserData();
    }

    // Validation with inline errors
    if (!userName.trim()) {
      newErrors.selectedIssue =
        'User information not found. Please log in again.';
    }

    if (!selectedIssue) {
      newErrors.selectedIssue = 'Please select an issue';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    // If there are errors, set them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Focus on first error field
      if (newErrors.description) {
        descriptionInputRef.current?.focus();
      }
      return;
    }

    // Clear errors if validation passes
    setErrors({});

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Please log in to submit a request');
      }

      const response = (await unifiedApi.post('/contact/sales', {
        userName: userName.trim(),
        userPhone: userPhone.trim(),
        businessName: businessName.trim(),
        selectedProblem: selectedIssue,
        problemDescription: description.trim(),
      })) as { data: any; status: number; headers: Headers };

      // unifiedApi returns { data, status, headers } structure
      const data = response.data || response;
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', data);

      // Check response status (201 is success for POST, 200-299 is success)
      if (response.status < 200 || response.status >= 300) {
        const errorMessage =
          data?.message || 'Failed to submit request. Please try again.';
        console.error('❌ Request failed:', errorMessage);
        throw new Error(errorMessage);
      }

      // Success - response status is 200-299
      console.log('✅ Contact request submitted successfully:', data);

      // Reset form
      resetForm();

      // Show success popup (modal will stay open until user clicks OK)
      console.log('🔔 Showing success alert...');
      setAlertShowing(true); // Track that alert is showing
      showAlert({
        title: 'Request Submitted',
        message:
          'Your request has been submitted successfully. Our sales team will contact you soon.',
        type: 'success',
        confirmText: 'OK',
        onConfirm: () => {
          console.log('✅ User acknowledged alert, closing modal');
          setAlertShowing(false); // Alert is dismissed
          // Close modal after user acknowledges the alert
          onClose();
        },
      });
      console.log('🔔 Alert called, should be visible now');

      // Show a foreground notification after a small delay to ensure it displays
      // Use setTimeout to ensure notification shows even if alert is displayed
      setTimeout(async () => {
        try {
          console.log('🔔 Attempting to show foreground notification...');

          const userDeclined = await hasUserDeclinedNotifications();
          if (userDeclined) {
            console.log(
              '⚠️ ContactSalesModal: User declined notifications - skipping foreground notification prompt',
            );
            return;
          }

          // Request permission if needed
          const permissionStatus = await notifee.requestPermission();
          if (
            permissionStatus?.authorizationStatus === AuthorizationStatus.DENIED
          ) {
            console.log(
              '⚠️ ContactSalesModal: Notifee permission denied - respecting preference',
            );
            await markNotificationsAsDeclined();
            return;
          }

          // Create or get channel
          await notifee.createChannel({
            id: 'contact_sales',
            name: 'Contact Sales Notifications',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
            vibrationPattern: [300, 500],
          });

          // Display notification with explicit foreground settings
          await notifee.displayNotification({
            title: 'Contact Request Submitted',
            body: 'Thanks! Our team will reach out to you shortly.',
            data: {
              type: 'contact_sales_submitted',
              timestamp: new Date().toISOString(),
            },
            android: {
              channelId: 'contact_sales',
              importance: AndroidImportance.HIGH,
              sound: 'default',
              color: '#2563EB',
              pressAction: {
                id: 'default',
              },
              smallIcon: 'ic_launcher',
              autoCancel: true,
            },
            ios: {
              foregroundPresentationOptions: {
                badge: true,
                sound: true,
                banner: true,
                list: true,
              },
              sound: 'default',
            },
          });
          console.log('✅ Foreground notification displayed successfully');
        } catch (e) {
          console.error('❌ Notification error:', e);
          // Fallback to showLocalNotification helper
          try {
            await showLocalNotification({
              title: 'Contact Request Submitted',
              body: 'Thanks! Our team will reach out to you shortly.',
              data: {
                type: 'contact_sales_submitted',
                timestamp: new Date().toISOString(),
              },
              color: '#2563EB',
            });
            console.log('✅ Notification displayed via fallback');
          } catch (fallbackError) {
            console.error(
              '❌ Fallback notification also failed:',
              fallbackError,
            );
          }
        }
      }, 1000); // Increased delay to ensure alert is fully shown first
    } catch (error: any) {
      console.error('Error submitting contact request:', error);
      showAlert({
        title: 'Submission Failed',
        message:
          error.message ||
          'Failed to submit your request. Please try again later.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        // Prevent auto-close when alert is showing or loading
        // Only allow close if no alert is visible and not loading
        if (!loading && !alertShowing) {
          onClose();
        }
      }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            // Prevent closing modal when loading or when alert is showing
            if (!loading && !alertShowing) {
              onClose();
            }
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalWrapper}
            onPress={e => {
              // Prevent closing when clicking inside modal content
              e.stopPropagation();
            }}
          >
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Contact Sales</Text>
                <TouchableOpacity
                  onPress={() => {
                    // Prevent closing modal when loading or when alert is showing
                    if (!loading && !alertShowing) {
                      onClose();
                    }
                  }}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  disabled={loading || alertShowing}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* Issue Dropdown */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>
                    Select Issue <Text style={styles.required}>*</Text>
                  </Text>
                  <Dropdown
                    style={[
                      styles.dropdown,
                      errors.selectedIssue && styles.dropdownError,
                    ]}
                    placeholderStyle={styles.dropdownPlaceholder}
                    selectedTextStyle={styles.dropdownSelectedText}
                    itemTextStyle={styles.dropdownItemText}
                    containerStyle={styles.dropdownContainer}
                    activeColor="#EFF6FF"
                    data={ISSUE_OPTIONS}
                    maxHeight={300}
                    labelField="label"
                    valueField="value"
                    placeholder="Select an issue"
                    value={selectedIssue}
                    onChange={item => {
                      setSelectedIssue(item.value);
                      if (errors.selectedIssue) {
                        setErrors(prev => ({
                          ...prev,
                          selectedIssue: undefined,
                        }));
                      }
                    }}
                    renderLeftIcon={() => (
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={20}
                        color={errors.selectedIssue ? '#DC2626' : '#2563EB'}
                        style={styles.dropdownIcon}
                      />
                    )}
                    renderRightIcon={() => (
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={20}
                        color={errors.selectedIssue ? '#DC2626' : '#2563EB'}
                      />
                    )}
                    renderItem={item => {
                      // Get icon based on issue type
                      const getIcon = (value: string) => {
                        switch (value) {
                          case 'pricing_inquiry':
                            return 'currency-usd';
                          case 'feature_request':
                            return 'lightbulb-outline';
                          case 'technical_support':
                            return 'tools';
                          case 'billing_issue':
                            return 'credit-card-outline';
                          case 'account_management':
                            return 'account-cog-outline';
                          case 'general_inquiry':
                            return 'help-circle-outline';
                          case 'partnership_opportunity':
                            return 'handshake-outline';
                          case 'other':
                            return 'dots-horizontal';
                          default:
                            return 'alert-circle-outline';
                        }
                      };

                      const isSelected = selectedIssue === item.value;
                      return (
                        <View
                          style={[
                            styles.dropdownItem,
                            isSelected && styles.dropdownItemSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={getIcon(item.value)}
                            size={20}
                            color={isSelected ? '#2563EB' : '#6B7280'}
                            style={styles.dropdownItemIcon}
                          />
                          <Text
                            style={[
                              styles.dropdownItemText,
                              isSelected && styles.dropdownItemTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {isSelected && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={20}
                              color="#2563EB"
                              style={styles.dropdownItemCheck}
                            />
                          )}
                        </View>
                      );
                    }}
                  />
                  {errors.selectedIssue && (
                    <Text style={styles.errorText}>{errors.selectedIssue}</Text>
                  )}
                </View>

                {/* Description Field */}
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>
                    Problem Description <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    ref={descriptionInputRef}
                    style={[
                      styles.textArea,
                      errors.description && styles.inputError,
                    ]}
                    value={description}
                    onChangeText={text => {
                      setDescription(text);
                      if (errors.description) {
                        setErrors(prev => ({
                          ...prev,
                          description: undefined,
                        }));
                      }
                    }}
                    placeholder="Describe your issue or inquiry..."
                    placeholderTextColor="#6B7280"
                    multiline={true}
                    numberOfLines={5}
                    textAlignVertical="top"
                    selectionColor="#2563EB"
                  />
                  {errors.description && (
                    <Text style={styles.errorText}>{errors.description}</Text>
                  )}
                </View>
              </ScrollView>

              {/* Footer with Save Button */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    loading && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="send"
                        size={18}
                        color="#fff"
                        style={styles.saveButtonIcon}
                      />
                      <Text style={styles.saveButtonText}>Submit Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalWrapper: {
    width: '95%',
    maxWidth: '95%',
    alignSelf: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    minHeight: '65%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#EFF6FF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Roboto-Bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
    backgroundColor: '#F0F9FF',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Roboto-Regular',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  dropdown: {
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  dropdownContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'Roboto-Regular',
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Roboto-Medium',
    fontWeight: '500',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  dropdownItemIcon: {
    marginRight: 12,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    fontFamily: 'Roboto-Regular',
  },
  dropdownItemTextSelected: {
    color: '#2563EB',
    fontFamily: 'Roboto-Medium',
    fontWeight: '500',
  },
  dropdownItemCheck: {
    marginLeft: 8,
  },
  dropdownIcon: {
    marginRight: 10,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    height: 120,
    fontFamily: 'Roboto-Regular',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
    fontFamily: 'Roboto-Regular',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#EFF6FF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Roboto-Medium',
  },
});

export default ContactSalesModal;
