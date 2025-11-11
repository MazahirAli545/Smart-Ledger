import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Image,
  Animated,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { unifiedApi } from '../../api/unifiedApiService';
import { getUserIdFromToken } from '../../utils/storage';
import { Dropdown } from 'react-native-element-dropdown';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LoadingScreen from '../../components/LoadingScreen';
import { useAlert } from '../../context/AlertContext';
import {
  businessTypes,
  businessSizes,
  industries,
  transactionVolumes,
  teamSizes,
  languages,
  goals,
} from '../../utils/dropdownOptions';
import { profileUpdateManager } from '../../utils/profileUpdateManager';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getGradientHeaderStyle,
} from '../../utils/headerLayout';

const { width } = Dimensions.get('window');

const GRADIENT = ['#4f8cff', '#1ecb81'];

// Enforce exact UI/UX text sizing regardless of OS accessibility scaling
// so component sizes and spacings remain consistent with design
// (scoped to this screen via module execution)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (Text && (Text as any).defaultProps == null) (Text as any).defaultProps = {};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (TextInput && (TextInput as any).defaultProps == null)
  (TextInput as any).defaultProps = {};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
(Text as any).defaultProps.allowFontScaling = false;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
(Text as any).defaultProps.maxFontSizeMultiplier = 1;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
(TextInput as any).defaultProps.allowFontScaling = false;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;

// Dummy profile image component
const DummyProfileImage = ({ size = 68 }: { size?: number }) => (
  <View
    style={[
      styles.dummyProfileImage,
      { width: size, height: size, borderRadius: size / 2 },
    ]}
  >
    <MaterialCommunityIcons name="account" size={size * 0.6} color="#4f8cff" />
  </View>
);

// Global cache to persist across component unmounts and prevent loading screen flash
let globalUserCache: any = null;
let globalCacheChecked = false;

// Function to clear global cache (called from logout)
export const clearProfileCache = () => {
  globalUserCache = null;
  globalCacheChecked = false;
};

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();

  // Configure StatusBar for gradient header
  const { statusBarSpacer } = useStatusBarWithGradient(
    'ProfileScreen',
    GRADIENT,
  );
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const [user, setUser] = useState<any>(globalUserCache); // Use global cache immediately
  const [loading, setLoading] = useState(!globalUserCache); // Only loading if no global cache
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(globalUserCache || {});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeField, setActiveField] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(globalCacheChecked);

  const [error, setError] = useState<string | null>(null);

  // Check for cached user data on component mount
  useEffect(() => {
    checkCachedUserData();
  }, []);

  // Handle navigation back to screen - immediately hide loading if we have data
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        setLoading(false);
      }
    }, [user]),
  );

  // Ensure form is synchronized with user data
  useEffect(() => {
    if (user && !editMode) {
      console.log('🔄 ProfileScreen: Syncing form with user data:', user);
      setForm(user);
    }
  }, [user, editMode]);

  const checkCachedUserData = async () => {
    // If we already have global cache, use it immediately
    if (globalUserCache) {
      setUser(globalUserCache);
      setForm(globalUserCache);
      setLoading(false);
      setCacheChecked(true);
      globalCacheChecked = true;
      // Fetch fresh data in background
      setTimeout(() => fetchUser(true), 100);
      return;
    }

    try {
      const cachedUser = await AsyncStorage.getItem('cachedUserData');
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        // Update global cache
        globalUserCache = userData;
        globalCacheChecked = true;

        setUser(userData);
        setForm(userData);
        setLoading(false);
        setCacheChecked(true);

        // Fetch fresh data in background
        setTimeout(() => fetchUser(true), 100);
      } else {
        // No cached data, show loading and fetch from API
        setLoading(true);
        setCacheChecked(true);
        globalCacheChecked = true;
        fetchUser();
      }
    } catch (error) {
      // If cache reading fails, show loading and fetch from API
      setLoading(true);
      setCacheChecked(true);
      globalCacheChecked = true;
      fetchUser();
    }
  };

  const fetchUser = async (isRefresh = false) => {
    // Only set loading if it's not a refresh and we don't have cached data
    if (!isRefresh && !user) {
      setLoading(true);
    }
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('No access token found. Please login again.');
      }

      // Use unified API with caching
      const res = await unifiedApi.getUserProfile();
      const payload = (res as any)?.data ?? res ?? {};
      const normalized = {
        ownerName:
          payload.ownerName || payload.name || payload.fullName || 'User',
        businessName:
          payload.businessName || payload.companyName || 'My Business',
        mobileNumber:
          payload.mobileNumber || payload.phone || payload.mobile || '',
        planType:
          payload.planType ||
          payload.plan ||
          payload.subscription?.planName ||
          'free',
        ...payload,
      };

      // Ensure we have proper fallback values
      if (!normalized.ownerName || normalized.ownerName === 'User') {
        normalized.ownerName = 'User';
      }
      if (
        !normalized.businessName ||
        normalized.businessName === 'My Business'
      ) {
        normalized.businessName = 'My Business';
      }

      console.log('🔄 ProfileScreen: Normalized user data:', {
        ownerName: normalized.ownerName,
        businessName: normalized.businessName,
        mobileNumber: normalized.mobileNumber,
      });

      // Update global cache
      globalUserCache = normalized;

      // Cache the user data
      await AsyncStorage.setItem('cachedUserData', JSON.stringify(normalized));

      setUser(normalized);
      setForm(normalized);
    } catch (err: any) {
      console.error('❌ ProfileScreen: Error fetching user data:', err);

      let message = 'Failed to fetch profile';
      let title = 'Error';

      if (err.response) {
        if (err.response.status === 401) {
          title = 'Authentication Error';
          message = 'Your session has expired. Please login again.';
        } else if (err.response.status === 403) {
          title = 'Permission Denied';
          message = 'You do not have permission to access this profile.';
        } else if (err.response.status >= 500) {
          title = 'Server Error';
          message = 'Server error occurred. Please try again later.';
        } else if (err.response.data?.message) {
          message = err.response.data.message;
        }
      } else if (err.message) {
        message = err.message;
      }

      showAlert({
        title,
        message,
        type: 'error',
      });
    } finally {
      if (!isRefresh && !user) {
        setLoading(false);
      }
    }
  };

  const handleEdit = () => setEditMode(true);
  const handleCancel = () => {
    setEditMode(false);
    setForm(user);
  };

  const handleChange = (key: string, value: string) => {
    console.log('🔄 ProfileScreen: Form field changed:', { key, value });
    setForm((prev: any) => {
      const updated = { ...prev, [key]: value };
      console.log('🔄 ProfileScreen: Updated form state:', updated);
      return updated;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser(true); // Pass true to indicate it's a refresh
    setRefreshing(false);
  };

  const handleSave = async () => {
    console.log('🔄 ProfileScreen: Save button pressed!');
    setSaving(true);

    // Declare finalUserId at the function scope
    let finalUserId: number | undefined;

    try {
      console.log('🔄 ProfileScreen: Starting save process...');
      console.log('🔄 ProfileScreen: Current form data:', form);

      const accessToken = await AsyncStorage.getItem('accessToken');
      console.log('🔑 Access token exists:', !!accessToken);

      const userId = await getUserIdFromToken();
      console.log('👤 User ID:', userId);
      console.log('👤 User ID type:', typeof userId);

      if (!userId) {
        console.error('❌ ProfileScreen: No user ID found in token');
        throw new Error('User ID not found. Please login again.');
      }

      if (isNaN(Number(userId))) {
        console.error('❌ ProfileScreen: Invalid user ID format:', userId);
        throw new Error('Invalid user ID format. Please login again.');
      }

      // Debug: Log the user data structure
      console.log('🔍 ProfileScreen: User data structure:', {
        user: user,
        userId: userId,
        userKeys: user ? Object.keys(user) : 'no user data',
      });

      // Get user ID from profile endpoint (more reliable across environments)
      // If it fails, fall back to token user ID
      let profileUserId: number | null = null;
      try {
        // Use unified API with caching
        const profileRes = await unifiedApi.getUserProfile();
        const profileUser = (profileRes as any)?.data ?? profileRes ?? {};
        profileUserId = Number(
          (profileUser?.id ?? profileUser?.userId ?? profileUser?.user_id) || 0,
        );
        if (profileUserId && !isNaN(profileUserId)) {
          console.log(
            '🔄 ProfileScreen: Resolved user ID from profile:',
            profileUserId,
          );
        }
      } catch (e) {
        console.warn(
          '⚠️ ProfileScreen: Failed to resolve ID from /users/profile, using token ID',
        );
      }

      // Prefer profile ID; fallback to token sub/id
      finalUserId = Number(profileUserId || userId);

      console.log('🔄 ProfileScreen: Using final user ID:', finalUserId);

      // Additional validation: Check if the user ID is valid
      if (!finalUserId || isNaN(finalUserId) || finalUserId <= 0) {
        console.error('❌ ProfileScreen: Invalid user ID:', finalUserId);
        throw new Error('Invalid user ID. Please login again.');
      }

      console.log('🔄 ProfileScreen: Final user ID for API call:', finalUserId);

      if (!accessToken) {
        throw new Error('Access token not found. Please login again.');
      }

      const allowedFields = [
        'businessName',
        'ownerName',
        'businessType',
        'businessSize',
        'industry',
        'monthlyTransactionVolume',
        'currentAccountingSoftware',
        'teamSize',
        'preferredLanguage',
        'features',
        'bankName',
        'accountNumber',
        'ifscCode',
        'CAAccountID',
        'primaryGoal',
        'currentChallenges',
        'profileComplete',
        'gstNumber', // Added missing GST Number field
      ];

      const body: { [key: string]: any } = {};
      allowedFields.forEach(key => {
        if (form[key] !== undefined && form[key] !== null) {
          body[key] = form[key];
        }
      });

      // Include user's primary role id for backend auditing/mapping
      try {
        const { getRoleId } = await import('../../utils/roleHelper');
        const roleId = await getRoleId();
        if (roleId !== null && roleId !== undefined) {
          body.roleId = roleId;
          body.role_id = roleId; // alias for alternate DTOs
          console.log(
            '✅ ProfileScreen: Added role ID to request body:',
            roleId,
          );
        }
      } catch (e) {
        console.warn('⚠️ ProfileScreen: Failed to add role ID:', e);
      }

      console.log('📤 ProfileScreen: Preparing update request with data:', {
        originalUserId: userId,
        finalUserId,
        body,
        // Use unified API - no need for url/baseUrl
      });

      // Check if we have any data to send
      if (Object.keys(body).length === 0) {
        console.warn(
          '⚠️ ProfileScreen: No data to update, form might be empty',
        );
        console.log('⚠️ ProfileScreen: Form data:', form);
        console.log('⚠️ ProfileScreen: User data:', user);
        console.log('⚠️ ProfileScreen: Form vs User comparison:', {
          formKeys: Object.keys(form || {}),
          userKeys: Object.keys(user || {}),
          formValues: form,
          userValues: user,
        });
        showAlert({
          title: 'No Changes',
          message:
            'No changes detected to save. Please make some changes first.',
          type: 'info',
        });
        setSaving(false);
        return;
      }

      // Additional check: compare form with user data to see if there are actual changes
      const hasChanges = Object.keys(body).some(key => {
        const formValue = form[key];
        const userValue = user[key];
        return formValue !== userValue;
      });

      if (!hasChanges) {
        console.warn('⚠️ ProfileScreen: No actual changes detected');
        showAlert({
          title: 'No Changes',
          message:
            'No changes detected to save. Please make some changes first.',
          type: 'info',
        });
        setSaving(false);
        return;
      }

      console.log(
        '📤 ProfileScreen: Making API call to:',
        // Use unified API
      );

      // No need to verify user exists - the JWT token already validates the user
      // and the backend will handle the validation

      // Use PATCH to update user profile
      console.log('📤 ProfileScreen: Final API call details:', {
        // Use unified API
        userId: finalUserId,
        bodyKeys: Object.keys(body),
        body: body,
      });

      // Make the API call to update user profile, retrying with alternate ID on 404
      let response: any;
      try {
        // Use unified API for update
        response = await unifiedApi.updateUserProfile(body);
      } catch (firstErr: any) {
        // unifiedApi handles errors automatically, but we can still retry if needed
        const altId =
          Number(userId) !== Number(finalUserId) ? Number(userId) : null;
        if (firstErr?.message?.includes('404') && altId) {
          console.warn(
            '⚠️ ProfileScreen: 404 for ID',
            finalUserId,
            'retrying with token ID',
            altId,
          );
          // Use unified API for update (retry)
          response = await unifiedApi.updateUserProfile(body);
          // Update finalUserId to altId for downstream logging
          finalUserId = altId;
        } else {
          throw firstErr;
        }
      }

      console.log(
        '✅ ProfileScreen: API response received:',
        response?.status,
        response?.data,
      );

      // Update cached data with new user data
      const updatedUser = { ...user, ...body };
      await AsyncStorage.setItem('cachedUserData', JSON.stringify(updatedUser));

      // Update global cache
      globalUserCache = updatedUser;

      setUser(updatedUser);
      setForm(updatedUser);
      setEditMode(false);
      setShowSuccess(true);

      // Emit profile update event to notify other screens
      console.log(
        '📢 ProfileScreen: Emitting profile update event with data:',
        {
          businessName: updatedUser.businessName,
          ownerName: updatedUser.ownerName,
        },
      );
      profileUpdateManager.emitProfileUpdate();

      // Also emit React Native DeviceEventEmitter event to update drawer instantly
      try {
        const payload = {
          name: updatedUser.ownerName || '',
          mobile:
            updatedUser.mobileNumber ||
            (updatedUser as any).phone ||
            (updatedUser as any).phoneNumber ||
            '',
        };
        console.log(
          '📡 ProfileScreen: Emitting DeviceEvent profile-updated:',
          payload,
        );
        DeviceEventEmitter.emit('profile-updated', payload);
      } catch (emitErr) {
        console.warn(
          '⚠️ ProfileScreen: Failed to emit DeviceEvent profile-updated',
          emitErr,
        );
      }

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      const error = err as any;
      console.error('❌ ProfileScreen: Save error:', error);

      let message = 'Failed to update profile';
      let title = 'Error';

      if (error.response) {
        console.error('❌ API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });

        if (error.response.status === 401) {
          title = 'Authentication Error';
          message = 'Your session has expired. Please login again.';
        } else if (error.response.status === 403) {
          title = 'Permission Denied';
          message =
            'You do not have permission to update this profile. Please check your role permissions.';
        } else if (error.response.status === 404) {
          title = 'User Not Found';
          message = `User profile not found (ID: ${
            finalUserId || 'unknown'
          }). This might be a temporary issue. Please try refreshing the app or contact support if the problem persists.`;
        } else if (error.response.status === 422) {
          title = 'Validation Error';
          message =
            error.response.data?.message || 'Please check your input data.';
        } else if (error.response.status >= 500) {
          title = 'Server Error';
          message = 'Server error occurred. Please try again later.';
        } else if (error.response.data?.message) {
          message = error.response.data.message;
        }
      } else if (
        error.code === 'NETWORK_ERROR' ||
        error.message?.includes('Network Error')
      ) {
        title = 'Network Error';
        message = 'Please check your internet connection and try again.';
      } else if (error.message) {
        message = error.message;
      }

      console.error('❌ Final error message:', { title, message });

      showAlert({
        title,
        message,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Only show loading screen if we're actually loading and haven't checked cache yet
  if (loading && !cacheChecked) {
    return (
      <LoadingScreen
        title="Loading Profile"
        subtitle="Preparing your business information..."
        icon="account-circle"
        tip="Tip: Keep your profile updated for better insights"
        backgroundColor="#f6fafc"
        gradientColors={GRADIENT}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Seamless Header with Status Bar Integration */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.header,
          getGradientHeaderStyle(
            preciseStatusBarHeight || statusBarSpacer.height,
          ),
        ]}
      >
        <View style={[styles.headerTop, { height: HEADER_CONTENT_HEIGHT }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          {!editMode && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <DummyProfileImage size={68} />
            <View style={styles.profileStatus}>
              <MaterialCommunityIcons
                name="check-circle"
                size={16}
                color="#28a745"
              />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.ownerName || 'User Name'}
            </Text>
            <Text style={styles.profileBusiness}>
              {user?.businessName || 'Business Name'}
            </Text>
            <View style={styles.profileBadge}>
              <MaterialCommunityIcons name="crown" size={14} color="#FF7043" />
              <Text style={styles.profileBadgeText}>
                {user?.planType || 'Free Member'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <SafeAreaView style={styles.scrollContainer} edges={['bottom']}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          extraScrollHeight={20}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Success Message */}
          {showSuccess && (
            <View style={styles.successMessage}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#fff"
              />
              <Text style={styles.successText}>
                Profile updated successfully!
              </Text>
            </View>
          )}

          {/* Profile Completion Card */}
          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <MaterialCommunityIcons
                name="account-check"
                size={20}
                color="#4f8cff"
              />
              <Text style={styles.completionTitle}>Profile Completion</Text>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${user?.profileComplete ? 100 : 85}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {user?.profileComplete ? '100% Complete' : '85% Complete'}
              </Text>
            </View>
          </View>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <SectionHeader title="Personal Information" icon="account" />
            <View style={styles.card}>
              {editMode ? (
                <>
                  <FormField
                    label="Full Name"
                    value={form.ownerName}
                    onChangeText={value => handleChange('ownerName', value)}
                    placeholder="Enter your full name"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="ownerName"
                  />
                  <FormField
                    label="Business Name"
                    value={form.businessName}
                    onChangeText={value => handleChange('businessName', value)}
                    placeholder="Enter your business name"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="businessName"
                  />
                  <FormField
                    label="Phone Number"
                    value={user?.mobileNumber || ''}
                    editable={false}
                    placeholder="Phone number"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="mobileNumber"
                  />
                </>
              ) : (
                <>
                  <InfoRow label="Full Name" value={user?.ownerName || '-'} />
                  <InfoRow
                    label="Business Name"
                    value={user?.businessName || '-'}
                  />
                  <InfoRow
                    label="Phone Number"
                    value={user?.mobileNumber || '-'}
                  />
                </>
              )}
            </View>
          </View>

          {/* Business Information Section */}
          <View style={styles.section}>
            <SectionHeader title="Business Information" icon="briefcase" />
            <View style={styles.card}>
              {editMode ? (
                <>
                  <DropdownField
                    label="Business Type"
                    value={form.businessType}
                    data={businessTypes.map(item => ({
                      label: item,
                      value: item,
                    }))}
                    onChange={item => handleChange('businessType', item.value)}
                    placeholder="Select business type"
                  />
                  <DropdownField
                    label="Business Size"
                    value={form.businessSize}
                    data={businessSizes.map(item => ({
                      label: item,
                      value: item,
                    }))}
                    onChange={item => handleChange('businessSize', item.value)}
                    placeholder="Select business size"
                  />
                  <DropdownField
                    label="Industry"
                    value={form.industry}
                    data={industries.map(item => ({
                      label: item,
                      value: item,
                    }))}
                    onChange={item => handleChange('industry', item.value)}
                    placeholder="Select industry"
                  />
                  <DropdownField
                    label="Monthly Transaction Volume"
                    value={form.monthlyTransactionVolume}
                    data={transactionVolumes.map(item => ({
                      label: item,
                      value: item,
                    }))}
                    onChange={item =>
                      handleChange('monthlyTransactionVolume', item.value)
                    }
                    placeholder="Select transaction volume"
                  />
                  <FormField
                    label="Current Accounting Software"
                    value={form.currentAccountingSoftware}
                    onChangeText={value =>
                      handleChange('currentAccountingSoftware', value)
                    }
                    placeholder="Enter your current accounting software"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="currentAccountingSoftware"
                  />
                  <FormField
                    label="GST Number"
                    value={form.gstNumber}
                    onChangeText={value => handleChange('gstNumber', value)}
                    placeholder="Enter your GST number (optional)"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="gstNumber"
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    label="Business Type"
                    value={user?.businessType || '-'}
                  />
                  <InfoRow
                    label="Business Size"
                    value={user?.businessSize || '-'}
                  />
                  <InfoRow label="Industry" value={user?.industry || '-'} />
                  <InfoRow
                    label="Transaction Volume"
                    value={user?.monthlyTransactionVolume || '-'}
                  />
                  <InfoRow
                    label="Accounting Software"
                    value={user?.currentAccountingSoftware || '-'}
                  />
                  <InfoRow label="GST Number" value={user?.gstNumber || '-'} />
                </>
              )}
            </View>
          </View>

          {/* Team & Preferences Section */}
          <View style={styles.section}>
            <SectionHeader title="Team & Preferences" icon="account-group" />
            <View style={styles.card}>
              {editMode ? (
                <>
                  <DropdownField
                    label="Team Size"
                    value={form.teamSize}
                    data={teamSizes.map(item => ({ label: item, value: item }))}
                    onChange={item => handleChange('teamSize', item.value)}
                    placeholder="Select team size"
                  />
                  <DropdownField
                    label="Preferred Language"
                    value={form.preferredLanguage}
                    data={languages.map(item => ({ label: item, value: item }))}
                    onChange={item =>
                      handleChange('preferredLanguage', item.value)
                    }
                    placeholder="Select language"
                  />
                </>
              ) : (
                <>
                  <InfoRow label="Team Size" value={user?.teamSize || '-'} />
                  <InfoRow
                    label="Preferred Language"
                    value={user?.preferredLanguage || '-'}
                  />
                </>
              )}
            </View>
          </View>

          {/* Features Section */}
          {user?.features && user.features.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Enabled Features" icon="star" />
              <View style={styles.card}>
                <FeatureChips features={user.features} />
              </View>
            </View>
          )}

          {/* Banking Information Section */}
          <View style={styles.section}>
            <SectionHeader title="Banking Information" icon="bank" />
            <View style={styles.card}>
              {editMode ? (
                <>
                  <FormField
                    label="Bank Name"
                    value={form.bankName}
                    onChangeText={value => handleChange('bankName', value)}
                    placeholder="Enter bank name"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="bankName"
                  />
                  <FormField
                    label="Account Number"
                    value={form.accountNumber}
                    onChangeText={value => handleChange('accountNumber', value)}
                    placeholder="Enter account number"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="accountNumber"
                  />
                  <FormField
                    label="IFSC Code"
                    value={form.ifscCode}
                    onChangeText={value => handleChange('ifscCode', value)}
                    placeholder="Enter IFSC code"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="ifscCode"
                  />
                </>
              ) : (
                <>
                  <InfoRow label="Bank Name" value={user?.bankName || '-'} />
                  <InfoRow
                    label="Account Number"
                    value={user?.accountNumber || '-'}
                  />
                  <InfoRow label="IFSC Code" value={user?.ifscCode || '-'} />
                </>
              )}
            </View>
          </View>

          {/* Goals & Challenges Section */}
          <View style={styles.section}>
            <SectionHeader title="Goals & Challenges" icon="target" />
            <View style={styles.card}>
              {editMode ? (
                <>
                  <DropdownField
                    label="Primary Goal"
                    value={form.primaryGoal}
                    data={goals.map(item => ({ label: item, value: item }))}
                    onChange={item => handleChange('primaryGoal', item.value)}
                    placeholder="Select primary goal"
                  />
                  <FormField
                    label="Current Challenges"
                    value={form.currentChallenges}
                    onChangeText={value =>
                      handleChange('currentChallenges', value)
                    }
                    placeholder="Describe your current challenges"
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldKey="currentChallenges"
                    multiline={true}
                    numberOfLines={3}
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    label="Primary Goal"
                    value={user?.primaryGoal || '-'}
                  />
                  <InfoRow
                    label="Current Challenges"
                    value={user?.currentChallenges || '-'}
                  />
                </>
              )}
            </View>
          </View>

          {/* Bottom Spacing */}
          <View
            style={[styles.bottomSpacing, editMode ? { height: 70 } : {}]}
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>

      {/* Fixed Action Bar for Edit Mode */}
      {editMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionCancelButton}
            onPress={handleCancel}
          >
            <Text style={styles.actionCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionSaveButton,
              saving && styles.actionSaveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionSaveText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Component: Section Header
const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <View style={styles.sectionHeader}>
    <MaterialCommunityIcons name={icon as any} size={20} color="#4f8cff" />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

// Component: Form Field
const FormField = ({
  label,
  value,
  onChangeText,
  placeholder,
  activeField,
  setActiveField,
  fieldKey,
  editable = true,
  multiline = false,
  numberOfLines = 1,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder: string;
  activeField: string;
  setActiveField: (field: string) => void;
  fieldKey: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}) => {
  const handleTextChange = (text: string) => {
    console.log(
      `🔄 FormField: ${fieldKey} changed from "${value}" to "${text}"`,
    );
    if (onChangeText) {
      onChangeText(text);
    }
  };

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[
          styles.formInput,
          activeField === fieldKey && styles.formInputActive,
          !editable && styles.formInputDisabled,
          multiline && styles.formInputMultiline,
        ]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor="#8a94a6"
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onFocus={() => setActiveField(fieldKey)}
        onBlur={() => setActiveField('')}
      />
    </View>
  );
};

// Component: Dropdown Field
const DropdownField = ({
  label,
  value,
  data,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  data: Array<{ label: string; value: string }>;
  onChange: (item: { label: string; value: string }) => void;
  placeholder: string;
}) => {
  const handleDropdownChange = (item: { label: string; value: string }) => {
    console.log(
      `🔄 DropdownField: ${label} changed from "${value}" to "${item.value}"`,
    );
    onChange(item);
  };

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <Dropdown
        style={styles.dropdown}
        placeholderStyle={styles.dropdownPlaceholder}
        selectedTextStyle={styles.dropdownSelectedText}
        itemTextStyle={{ color: '#333333', fontFamily: 'Roboto-Medium' }}
        data={data}
        maxHeight={200}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
        value={value}
        onChange={handleDropdownChange}
        containerStyle={styles.dropdownContainer}
      />
    </View>
  );
};

// Component: Info Row
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel} numberOfLines={1} ellipsizeMode="tail">
      {label}
    </Text>
    <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
      {value}
    </Text>
  </View>
);

// Component: Feature Chips
const FeatureChips = ({ features }: { features: string[] }) => (
  <View style={styles.featureChips}>
    {features.map((feature, index) => (
      <View key={index} style={styles.featureChip}>
        <MaterialCommunityIcons name="check" size={14} color="#28a745" />
        <Text style={styles.featureChipText}>{feature}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusBarSpacer: {
    height: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    // fontWeight: '900',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    flex: 1,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
    fontWeight: '800',
  },

  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  editButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.5,
  },
  editModeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: GRADIENT[0],
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 20,
  },
  profileImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dummyProfileImage: {
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileStatus: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    fontFamily: 'Roboto-Medium',

    textShadowRadius: 2,
  },
  profileBusiness: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  profileBadgeText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,

    fontFamily: 'Roboto-Medium',
  },

  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  completionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    // elevation: 3,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  completionTitle: {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: GRADIENT[0],
    borderRadius: 4,
  },
  progressText: { fontSize: 14, color: '#666', fontFamily: 'Roboto-Medium' },

  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#222',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    // elevation: 1,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  formInput: {
    borderWidth: 1,
    borderColor: '#e3e7ee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333333',
    backgroundColor: '#f8fafc',

    fontFamily: 'Roboto-Medium',
  },

  formInputActive: {
    borderColor: GRADIENT[0],
    borderWidth: 2,
    backgroundColor: '#fff',
    shadowColor: GRADIENT[0],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#888',

    fontFamily: 'Roboto-Medium',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#e3e7ee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
  },
  dropdownPlaceholder: {
    color: '#8a94a6',
    fontSize: 15,
    fontFamily: 'Roboto-Medium',
  },

  dropdownSelectedText: {
    color: '#333333',
    fontSize: 15,
    fontFamily: 'Roboto-Medium',
  },

  dropdownContainer: {
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flexShrink: 0,
    width: '60%',
    fontFamily: 'Roboto-Medium',
  },

  infoValue: {
    fontSize: 14,
    color: '#222',
    flexGrow: 1,
    textAlign: 'right',

    fontFamily: 'Roboto-Medium',
  },

  featureChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  featureChipText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 4,

    fontFamily: 'Roboto-Medium',
  },

  bottomSpacing: {
    height: 40,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e3e7ee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  actionCancelButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e7ee',
    backgroundColor: '#fff',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCancelText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  actionSaveButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: GRADIENT[0],
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSaveButtonDisabled: {
    opacity: 0.7,
  },
  actionSaveText: { color: '#fff', fontSize: 14, fontFamily: 'Roboto-Medium' },
});

export default ProfileScreen;
