import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Image,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../api';
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

const { width } = Dimensions.get('window');

const GRADIENT = ['#4f8cff', '#1ecb81'];
const PROFILE_IMAGE =
  'https://img.icons8.com/ios-filled/100/4f8cff/user-male-circle.png';

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
  const [user, setUser] = useState<any>(globalUserCache); // Use global cache immediately
  const [loading, setLoading] = useState(!globalUserCache); // Only loading if no global cache
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(globalUserCache || {});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeField, setActiveField] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(globalCacheChecked);

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
      const userId = await getUserIdFromToken();
      const res = await axios.get(`${BASE_URL}/user/${userId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Update global cache
      globalUserCache = res.data.data;

      // Cache the user data
      await AsyncStorage.setItem(
        'cachedUserData',
        JSON.stringify(res.data.data),
      );

      setUser(res.data.data);
      setForm(res.data.data);
    } catch (err) {
      showAlert({
        title: 'Error',
        message: 'Failed to fetch profile',
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
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser(true); // Pass true to indicate it's a refresh
    setRefreshing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();
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
      ];
      const body: { id: any; [key: string]: any } = { id: userId };
      allowedFields.forEach(key => {
        if (form[key] !== undefined) body[key] = form[key];
      });
      await axios.patch(`${BASE_URL}/user/edit-profile`, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Update cached data with new user data
      const updatedUser = { ...user, ...body };
      await AsyncStorage.setItem('cachedUserData', JSON.stringify(updatedUser));

      // Update global cache
      globalUserCache = updatedUser;

      setUser(updatedUser);
      setEditMode(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      const error = err as any;
      let message = 'Failed to update profile';
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      showAlert({
        title: 'Error',
        message: message,
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
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Seamless Header with Status Bar Integration */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        {/* Status Bar Spacer */}
        <View style={styles.statusBarSpacer} />

        <View style={styles.headerTop}>
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
                size={24}
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
}) => (
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
      onChangeText={onChangeText}
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
}) => (
  <View style={styles.formField}>
    <Text style={styles.formLabel}>{label}</Text>
    <Dropdown
      style={styles.dropdown}
      placeholderStyle={styles.dropdownPlaceholder}
      selectedTextStyle={styles.dropdownSelectedText}
      data={data}
      maxHeight={200}
      labelField="label"
      valueField="value"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      containerStyle={styles.dropdownContainer}
    />
  </View>
);

// Component: Info Row
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
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
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusBarSpacer: {
    height: 44, // Standard status bar height for most devices
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
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: 'bold',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileBusiness: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
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
    fontWeight: '600',
    marginLeft: 6,
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
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 8,
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
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
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
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 8,
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#e3e7ee',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#f8fafc',
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
  },
  dropdownSelectedText: {
    color: '#222',
    fontSize: 15,
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
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '400',
    flex: 2,
    textAlign: 'right',
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
    fontWeight: '500',
    marginLeft: 4,
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
    fontWeight: '600',
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
  actionSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreen;
