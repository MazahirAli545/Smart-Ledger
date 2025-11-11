import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserIdFromToken } from '../../utils/storage';
import { useSubscription } from '../../context/SubscriptionContext';
import { AppStackParamList } from '../../types/navigation';
import LoadingScreen from '../../components/LoadingScreen';
import { showFolderCreatedNotification } from '../../utils/notificationHelper';
import { useAlert } from '../../context/AlertContext';

// Global cache for AddFolderScreen
let globalFolderCache: any[] = [];
let globalUserPlanCache: string = 'free';
let globalFolderCacheChecked = false;
let globalUserPlanCacheChecked = false;

// Function to clear global cache
export const clearAddFolderCache = () => {
  globalFolderCache = [];
  globalUserPlanCache = 'free';
  globalFolderCacheChecked = false;
  globalUserPlanCacheChecked = false;
};

const FOLDER_TYPES = [
  {
    label: 'Sell',
    value: 'sell',
    icon: 'cart-plus',
    planRequired: 'free',
  },
  { label: 'Receipt', value: 'receipt', icon: 'receipt', planRequired: 'free' },
  {
    label: 'Payment',
    value: 'payment',
    icon: 'credit-card-outline',
    planRequired: 'free',
  },
  {
    label: 'Purchase',
    value: 'purchase',
    icon: 'cart-outline',
    planRequired: 'free',
  },
];

const AddFolderScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const { currentSubscription, getPlanAccess } = useSubscription();
  const { showAlert } = useAlert();
  const [folderName, setFolderName] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState('');
  const [typeError, setTypeError] = useState('');
  const [userPlan, setUserPlan] = useState<string>(globalUserPlanCache);
  const [loading, setLoading] = useState(
    !globalFolderCacheChecked && !globalUserPlanCacheChecked,
  );
  const [existingFolders, setExistingFolders] =
    useState<any[]>(globalFolderCache);

  const cardAnim = useRef(new Animated.Value(0)).current;

  // Plan hierarchy for comparison
  const PLAN_HIERARCHY = {
    free: 0,
    starter: 1,
    professional: 2,
    enterprise: 3,
  };

  // Check if user can access a specific plan level
  const isPlanAccessible = (userPlan: string, featurePlan: string): boolean => {
    const userLevel =
      PLAN_HIERARCHY[userPlan as keyof typeof PLAN_HIERARCHY] ?? 0;
    const featureLevel =
      PLAN_HIERARCHY[featurePlan as keyof typeof PLAN_HIERARCHY] ?? 0;
    return userLevel >= featureLevel;
  };

  // Check for cached data on component mount
  const checkCachedData = async () => {
    // If we already have global cache, use it immediately
    if (globalFolderCacheChecked && globalUserPlanCacheChecked) {
      setExistingFolders(globalFolderCache);
      setUserPlan(globalUserPlanCache);
      setLoading(false);
      // Fetch fresh data in background
      setTimeout(() => {
        fetchUserData(true);
        fetchExistingFolders(true);
      }, 100);
      return;
    }

    // Check cache and fetch data
    await Promise.all([fetchUserData(), fetchExistingFolders()]);
  };

  // Fetch existing folders to check limit
  const fetchExistingFolders = async (isRefresh = false) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      // Use unified API with caching
      const response = (await unifiedApi.get('/menus')) as {
        data: any;
        status: number;
        headers: Headers;
      };

      // Filter for user's custom folders (excluding default system folders)
      const responseData = response?.data ?? response ?? [];
      const userFolders = (
        Array.isArray(responseData) ? responseData : []
      ).filter(
        (item: any) =>
          item.parentId === null &&
          item.isCustom === true &&
          !['sell', 'receipt', 'payment', 'purchase', 'add folder'].includes(
            item.title?.toLowerCase(),
          ),
      );

      // Update global cache
      globalFolderCache = userFolders;
      globalFolderCacheChecked = true;

      setExistingFolders(userFolders);
      console.log('Existing folders count:', userFolders.length);
    } catch (err) {
      console.error('Error fetching existing folders:', err);
      setExistingFolders([]);
      globalFolderCache = [];
      globalFolderCacheChecked = true;
    }
  };

  // Fetch user data to get current plan
  const fetchUserData = async (isRefresh = false) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      if (!userId) {
        setUserPlan('free');
        globalUserPlanCache = 'free';
        globalUserPlanCacheChecked = true;
        if (!isRefresh) setLoading(false);
        return;
      }

      // Use unified API with caching
      const response = (await unifiedApi.getUserProfile()) as {
        data: any;
        status: number;
        headers: Headers;
      };
      const userData = response?.data ?? response ?? {};
      const planType = userData?.planType?.toLowerCase() || 'free';

      // Update global cache
      globalUserPlanCache = planType;
      globalUserPlanCacheChecked = true;

      setUserPlan(planType);

      console.log('User plan type:', planType);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setUserPlan('free'); // Default to free plan on error
      globalUserPlanCache = 'free';
      globalUserPlanCacheChecked = true;
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    checkCachedData();
  }, []);

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [cardAnim]);

  const handleBack = () => {
    navigation.goBack();
  };

  // Check if user has reached folder limit
  const hasReachedFolderLimit = () => {
    if (userPlan === 'free') {
      return existingFolders.length >= 3;
    }
    if (userPlan === 'starter') {
      return existingFolders.length >= 13; // 3 (free) + 10 (starter) = 13
    }
    if (userPlan === 'professional' || userPlan === 'premium') {
      return existingFolders.length >= 23; // 3 (free) + 10 (starter) + 10 (professional) = 23
    }
    if (userPlan === 'enterprise') {
      return false; // Unlimited folders for enterprise plan
    }
    return false; // Default case
  };

  const handleSave = async () => {
    console.log('🚀 handleSave called with:', {
      folderName,
      selectedType,
      userPlan,
    });
    let hasError = false;
    if (!folderName.trim()) {
      setError('Folder name is required');
      hasError = true;
    } else {
      setError('');
    }
    if (!selectedType) {
      setTypeError('Please select a folder type');
      hasError = true;
    } else {
      setTypeError('');
    }
    if (hasError) {
      console.log('❌ Validation errors, returning early');
      return;
    }

    // Check folder limit for free users
    if (hasReachedFolderLimit()) {
      console.log('📊 Folder limit reached, navigating to subscription plan');
      navigation.navigate('SubscriptionPlan');
      return;
    }

    // For free users, allow folder creation up to the limit (3 folders)
    // For paid users, no restrictions
    // Only check plan access for features beyond basic folder creation

    console.log('✅ Validation passed, starting folder creation...');
    setSaving(true);

    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();

      console.log('🔑 Auth tokens retrieved:', {
        hasAccessToken: !!accessToken,
        userId: userId,
      });

      if (!accessToken) {
        throw new Error('No access token found');
      }

      if (!userId) {
        throw new Error('No user ID found');
      }
      // Get the icon name from the selected folder type
      const selectedFolderType = FOLDER_TYPES.find(
        t => t.value === selectedType,
      );
      const iconName = selectedFolderType?.icon || 'folder-outline';

      console.log('🎨 Icon mapping for folder creation:', {
        selectedType: selectedType,
        selectedFolderType: selectedFolderType,
        iconName: iconName,
      });

      const body = {
        title: folderName.trim(),
        route: `/transaction/${folderName.trim().replace(/\s+/g, '')}`,
        icon: iconName, // Send the actual icon name, not the type value
        parentId: null, // Custom folders should be top-level menus
        orderNo: 6, // Same as "Sell/Invoice" but custom folders will be sorted by creation date
        isActive: true,
        isVisible: true,
        menuType: 'default',
        planType: userPlan, // Send as string, not object
      };

      console.log('📤 Making API call to create folder:', {
        url: '/menus',
        body: body,
      });

      // Use unified API for create
      const response = await unifiedApi.post('/menus', body);

      console.log('✅ Folder created successfully:', response);
      setSaving(false);

      // Show real Firebase notification
      console.log('🔔 Attempting to show notification for:', folderName);
      try {
        await showFolderCreatedNotification(folderName);
        console.log('✅ Notification shown successfully');
      } catch (notificationError) {
        console.error(
          '❌ Failed to show folder creation notification:',
          notificationError,
        );
        // Continue with the flow even if notification fails
      }

      // Reset form and navigate back after a short delay to show notification
      console.log('🔄 Resetting form and navigating back...');
      resetForm();
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (err: any) {
      console.error('❌ Error creating folder:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
      });

      setSaving(false);

      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to create folder. Please try again.';

      if (err.response?.status === 409) {
        errorMessage =
          'A folder with this name already exists. Please choose a different name.';
      } else if (err.response?.status === 500) {
        errorMessage =
          'Server error occurred. Please try again later or contact support.';
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }

      setError(errorMessage);
      // Reset form on error
      resetForm();
    }
  };

  const handleInputFocus = () => setInputFocused(true);
  const handleInputBlur = () => setInputFocused(false);

  const resetForm = () => {
    setFolderName('');
    setSelectedType('');
    setError('');
    setTypeError('');
  };

  const handleTypeSelect = (type: string) => {
    const selectedFolderType = FOLDER_TYPES.find(t => t.value === type);
    if (
      selectedFolderType &&
      !isPlanAccessible(userPlan, selectedFolderType.planRequired)
    ) {
      showAlert({
        title: 'Plan Restriction',
        message: `This folder type requires ${selectedFolderType.planRequired} plan or above.`,
        type: 'confirm',
        confirmText: 'Upgrade Plan',
        cancelText: 'Cancel',
        onConfirm: () => navigation.navigate('SubscriptionPlan'),
      });
      return;
    }
    setSelectedType(type);
  };

  // Modal handlers removed - direct navigation used instead

  if (loading) {
    return (
      <LoadingScreen
        title="Loading Folders"
        subtitle="Preparing folder options..."
        icon="folder-plus"
        tip="Tip: Organize your documents with custom folders"
        backgroundColor="#f6fafc"
        gradientColors={['#4f8cff', '#1ecb81']}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Folder</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Top spacing container */}
      <View style={styles.topSpacing} />

      {/* Enhanced Upgrade Banner - Only show when limit is reached */}
      {((userPlan === 'free' && existingFolders.length >= 3) ||
        (userPlan === 'starter' && existingFolders.length >= 13) ||
        (userPlan === 'professional' && existingFolders.length >= 23) ||
        (userPlan === 'premium' && existingFolders.length >= 23)) && (
        <View style={styles.upgradeBanner}>
          <View style={styles.upgradeBannerLeft}>
            <View style={styles.upgradeIconContainer}>
              <MaterialCommunityIcons name="crown" size={20} color="#ff6b35" />
            </View>
            <View style={styles.upgradeTextContainer}>
              <Text style={styles.upgradeTitle}>Folder Limit Reached!</Text>
              <Text style={styles.upgradeSubtitle}>
                Upgrade your plan to create more folders
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.upgradeButtonEnhanced}
            onPress={() => navigation.navigate('SubscriptionPlan')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="crown"
              size={16}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.upgradeButtonTextEnhanced}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Removed redundant warning banner - upgrade banner and modal are sufficient */}

      {/* Dismiss keyboard on outside tap */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.inputLabel}>Enter Folder Name</Text>
            <TextInput
              style={[
                styles.input,
                inputFocused && styles.inputActive,
                error && styles.inputError,
              ]}
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name"
              placeholderTextColor="#aaa"
              autoFocus
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              returnKeyType="done"
              accessibilityLabel="Folder name input"
            />
            {!!error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={[styles.inputLabel, { marginTop: 18 }]}>
              Choose Type
            </Text>
            <View style={styles.typeRow}>
              {FOLDER_TYPES.map(type => {
                const isAccessible = isPlanAccessible(
                  userPlan,
                  type.planRequired,
                );
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      selectedType === type.value && styles.typeButtonSelected,
                      !isAccessible && styles.typeButtonDisabled,
                    ]}
                    onPress={() => handleTypeSelect(type.value)}
                    activeOpacity={0.8}
                    disabled={!isAccessible}
                    accessibilityLabel={`Select ${type.label}`}
                  >
                    <MaterialCommunityIcons
                      name={type.icon}
                      size={22}
                      color={
                        selectedType === type.value
                          ? '#fff'
                          : !isAccessible
                          ? '#ccc'
                          : '#222'
                      }
                      style={{ marginBottom: 2 }}
                    />
                    <Text
                      style={[
                        styles.typeButtonText,
                        selectedType === type.value &&
                          styles.typeButtonTextSelected,
                        !isAccessible && styles.typeButtonTextDisabled,
                      ]}
                    >
                      {type.label}
                    </Text>
                    {!isAccessible && (
                      <View style={styles.lockIcon}>
                        <MaterialCommunityIcons
                          name="lock"
                          size={12}
                          color="#ccc"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!typeError ? (
              <Text style={styles.errorText}>{typeError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!folderName || !selectedType || hasReachedFolderLimit()) && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleSave}
              disabled={
                !folderName ||
                !selectedType ||
                hasReachedFolderLimit() ||
                saving
              }
              activeOpacity={0.85}
              accessibilityLabel="Save folder"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>

      {/* Modal removed - direct navigation to subscription plan */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 0,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    color: '#222',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  topSpacing: {
    height: 20,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  inputLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  input: {
    width: '100%',
    height: 48,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#222',
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  inputActive: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  inputError: {
    borderColor: '#e53e3e',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 2,

    fontFamily: 'Roboto-Medium',
  },

  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 18,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'column',
    minWidth: 70,
  },
  typeButtonSelected: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  typeButtonText: {
    color: '#222',
    fontSize: 15,
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  typeButtonTextSelected: {
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },
  typeButtonTextDisabled: {
    color: '#ccc',

    fontFamily: 'Roboto-Medium',
  },
  typeButtonDisabled: {
    backgroundColor: '#e0e0e0',
    borderColor: '#ccc',
    opacity: 0.7,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff9c4',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginBottom: 18,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#ffb300',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  upgradeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  upgradeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff3e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeTextContainer: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 17,
    color: '#d84315',
    marginBottom: 3,
    letterSpacing: 0.2,

    fontFamily: 'Roboto-Medium',
  },

  upgradeSubtitle: {
    fontSize: 14,
    color: '#e65100',
    lineHeight: 18,

    fontFamily: 'Roboto-Medium',
  },

  upgradeButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,

    fontFamily: 'Roboto-Medium',
  },

  upgradeButtonEnhanced: {
    backgroundColor: '#ff6b35',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff6b35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e65100',
  },
  upgradeButtonTextEnhanced: {
    color: '#fff',
    fontSize: 16,
    letterSpacing: 0.3,

    fontFamily: 'Roboto-Medium',
  },

  lockIcon: {
    position: 'absolute',
    bottom: -5,
    right: -5,
  },
  restrictionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  restrictionText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#f59e0b',

    fontFamily: 'Roboto-Medium',
  },

  limitWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  limitWarningText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#f59e0b',

    fontFamily: 'Roboto-Medium',
  },

  saveButton: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,

    fontFamily: 'Roboto-Medium',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    width: '80%',
    maxWidth: 350,
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    color: '#222',
    marginBottom: 10,

    fontFamily: 'Roboto-Medium',
  },

  modalDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,

    fontFamily: 'Roboto-Medium',
  },

  featureList: {
    width: '100%',
    marginBottom: 25,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,

    fontFamily: 'Roboto-Medium',
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalCancelButton: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  modalCancelButtonText: {
    color: '#222',
    fontSize: 16,

    fontFamily: 'Roboto-Medium',
  },

  modalUpgradeButton: {
    backgroundColor: '#4f8cff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  modalUpgradeButtonText: {
    color: '#fff',
    fontSize: 16,

    fontFamily: 'Roboto-Medium',
  },
});

export default AddFolderScreen;
