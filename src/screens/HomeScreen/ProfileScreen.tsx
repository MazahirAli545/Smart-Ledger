import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  businessTypes,
  businessSizes,
  industries,
  transactionVolumes,
  teamSizes,
  languages,
  goals,
} from '../../utils/dropdownOptions';

const GRADIENT = ['#4f8cff', '#1ecb81'];

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeField, setActiveField] = useState('');

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();
      const res = await axios.get(`${BASE_URL}/user/${userId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser(res.data.data);
      setForm(res.data.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch profile');
    } finally {
      setLoading(false);
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
  const handleSave = async () => {
    setSaving(true);
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const userId = await getUserIdFromToken();
      // Only send allowed user-editable fields
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
      setUser({ ...user, ...body });
      setEditMode(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      const error = err as any;
      let message = 'Failed to update profile';
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#f6fafc',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={GRADIENT[0]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6fafc' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
      {/* Gradient Header with Back and Edit/Save Button */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editMode && (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </LinearGradient>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {showSuccess && (
              <View
                style={{
                  backgroundColor: '#1ecb81',
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: 15,
                  }}
                >
                  Profile updated successfully
                </Text>
              </View>
            )}
            {/* Top section: Business Name, Name, Phone Number */}
            {editMode ? (
              <>
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        marginTop: 0,
                        marginBottom: 4,
                        fontWeight: 'bold',
                        fontSize: 15,
                      },
                    ]}
                  >
                    Business Name
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      activeField === 'businessName' && styles.inputActive,
                      activeField === 'businessName' && styles.inputFocusShadow,
                      {
                        marginBottom: 8,
                        backgroundColor: '#fff',
                        borderRadius: 10,
                        borderColor: '#e3e7ee',
                        borderWidth: 1,
                        height: 46,
                        fontSize: 15,
                        color: '#222',
                        paddingHorizontal: 16,
                      },
                    ]}
                    value={form.businessName}
                    editable={true}
                    onChangeText={v =>
                      setForm((prev: any) => ({ ...prev, businessName: v }))
                    }
                    placeholder="Enter your business name"
                    placeholderTextColor="#8a94a6"
                    onFocus={() => setActiveField('businessName')}
                    onBlur={() => setActiveField('')}
                  />
                </View>
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        marginTop: 0,
                        marginBottom: 4,
                        fontWeight: 'bold',
                        fontSize: 15,
                      },
                    ]}
                  >
                    Name
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      activeField === 'ownerName' && styles.inputActive,
                      activeField === 'ownerName' && styles.inputFocusShadow,
                      {
                        marginBottom: 8,
                        backgroundColor: '#fff',
                        borderRadius: 10,
                        borderColor: '#e3e7ee',
                        borderWidth: 1,
                        height: 46,
                        fontSize: 15,
                        color: '#222',
                        paddingHorizontal: 16,
                      },
                    ]}
                    value={form.ownerName}
                    editable={true}
                    onChangeText={v =>
                      setForm((prev: any) => ({ ...prev, ownerName: v }))
                    }
                    placeholder="Enter your name"
                    placeholderTextColor="#8a94a6"
                    onFocus={() => setActiveField('ownerName')}
                    onBlur={() => setActiveField('')}
                  />
                </View>
                <View style={{ marginBottom: 8 }}>
                  <Text
                    style={[
                      styles.label,
                      {
                        marginTop: 0,
                        marginBottom: 4,
                        fontWeight: 'bold',
                        fontSize: 15,
                      },
                    ]}
                  >
                    Phone Number
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: '#f0f0f0',
                        color: '#888',
                        borderRadius: 10,
                        borderColor: '#e3e7ee',
                        borderWidth: 1,
                        height: 46,
                        fontSize: 15,
                        paddingHorizontal: 16,
                      },
                    ]}
                    value={user?.mobileNumber || ''}
                    editable={false}
                    placeholder="Phone Number"
                    placeholderTextColor="#8a94a6"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={[styles.row, { minHeight: 28 }]}>
                  {' '}
                  {/* more vertical space */}
                  <Text
                    style={[
                      styles.label,
                      { fontWeight: 'bold', color: '#444', minWidth: 130 },
                    ]}
                  >
                    Business Name:
                  </Text>
                  <Text
                    style={[
                      styles.value,
                      { marginLeft: 8, color: '#222', fontSize: 15 },
                    ]}
                  >
                    {user?.businessName || ''}
                  </Text>
                </View>
                <View style={[styles.row, { minHeight: 28 }]}>
                  {' '}
                  {/* more vertical space */}
                  <Text
                    style={[
                      styles.label,
                      { fontWeight: 'bold', color: '#444', minWidth: 130 },
                    ]}
                  >
                    Name:
                  </Text>
                  <Text
                    style={[
                      styles.value,
                      { marginLeft: 8, color: '#222', fontSize: 15 },
                    ]}
                  >
                    {user?.ownerName || ''}
                  </Text>
                </View>
                <View style={[styles.row, { minHeight: 28 }]}>
                  {' '}
                  {/* more vertical space */}
                  <Text
                    style={[
                      styles.label,
                      { fontWeight: 'bold', color: '#444', minWidth: 130 },
                    ]}
                  >
                    Phone Number:
                  </Text>
                  <Text
                    style={[
                      styles.value,
                      { marginLeft: 8, color: '#222', fontSize: 15 },
                    ]}
                  >
                    {user?.mobileNumber || ''}
                  </Text>
                </View>
              </>
            )}
            {/* Business Info Section */}
            <SectionHeader title="Business Info" />
            {renderField(
              'Business Type',
              'businessType',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'GST Number',
              'gstNumber',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Business Size',
              'businessSize',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Industry',
              'industry',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Monthly Transaction Volume',
              'monthlyTransactionVolume',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Current Accounting Software',
              'currentAccountingSoftware',
              user,
              form,
              editMode,
              handleChange,
            )}
            <View style={styles.divider} />

            {/* Team Info Section */}
            <SectionHeader title="Team Info" />
            {renderField(
              'Team Size',
              'teamSize',
              user,
              form,
              editMode,
              handleChange,
            )}
            <View style={styles.divider} />

            {/* Preferences Section */}
            <SectionHeader title="Preferences" />
            {renderField(
              'Preferred Language',
              'preferredLanguage',
              user,
              form,
              editMode,
              handleChange,
            )}
            {user.features &&
              Array.isArray(user.features) &&
              user.features.length > 0 &&
              !editMode && (
                <View style={{ marginTop: 2, marginBottom: 8 }}>
                  <Text style={[styles.label, { marginBottom: 2 }]}>
                    Features:
                  </Text>
                  <FeatureChips features={user.features} />
                </View>
              )}
            <View style={styles.divider} />

            {/* Bank Info Section */}
            <SectionHeader title="Bank Info" />
            {renderField(
              'Bank Name',
              'bankName',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Account Number',
              'accountNumber',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'IFSC Code',
              'ifscCode',
              user,
              form,
              editMode,
              handleChange,
            )}
            <View style={styles.divider} />

            {/* Goals Section */}
            <SectionHeader title="Goals" />
            {renderField(
              'Primary Goal',
              'primaryGoal',
              user,
              form,
              editMode,
              handleChange,
            )}
            {renderField(
              'Current Challenges',
              'currentChallenges',
              user,
              form,
              editMode,
              handleChange,
            )}

            {editMode && (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function renderField(
  label: string,
  key: string,
  user: any,
  form: any,
  editMode: boolean,
  handleChange: (k: string, v: string) => void,
) {
  if (!user[key] && !editMode) return null;

  // Dropdown fields mapping
  const dropdownFields: Record<
    string,
    { data: { label: string; value: string }[]; icon: string }
  > = {
    businessType: {
      data: businessTypes.map(v => ({ label: v, value: v })),
      icon: 'business',
    },
    businessSize: {
      data: businessSizes.map(v => ({ label: v, value: v })),
      icon: 'people',
    },
    industry: {
      data: industries.map(v => ({ label: v, value: v })),
      icon: 'briefcase',
    },
    monthlyTransactionVolume: {
      data: transactionVolumes.map(v => ({ label: v, value: v })),
      icon: 'swap-vertical',
    },
    teamSize: {
      data: teamSizes.map(v => ({ label: v, value: v })),
      icon: 'people',
    },
    preferredLanguage: {
      data: languages.map(v => ({ label: v, value: v })),
      icon: 'language',
    },
    primaryGoal: {
      data: goals.map(v => ({ label: v, value: v })),
      icon: 'flag',
    },
  };

  if (editMode && dropdownFields[key]) {
    const { data, icon } = dropdownFields[key];
    return (
      <View style={styles.editRow}>
        <Text style={styles.label}>{label}:</Text>
        <Dropdown
          style={[styles.input, { backgroundColor: '#f9f9f9' }]}
          placeholderStyle={{ color: '#aaa', fontSize: 15 }}
          selectedTextStyle={{ color: '#222', fontSize: 15 }}
          inputSearchStyle={{
            color: '#222',
            fontSize: 15,
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            paddingLeft: 8,
            borderBottomColor: '#e3e7ee',
            borderBottomWidth: 1,
          }}
          iconStyle={{ width: 24, height: 24 }}
          data={data}
          search
          searchPlaceholder={`Search ${label.toLowerCase()}...`}
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder={`Select ${label.toLowerCase()}`}
          value={form[key] || ''}
          onChange={item => handleChange(key, item.value)}
          renderLeftIcon={() => (
            <Ionicons
              name={icon}
              size={20}
              color="#4f8cff"
              style={{ marginRight: 10 }}
            />
          )}
          renderItem={(item, selected) => (
            <View
              style={{
                padding: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, color: '#222' }}>{item.label}</Text>
              {selected && (
                <Ionicons name="checkmark" size={18} color="#4f8cff" />
              )}
            </View>
          )}
          flatListProps={{ keyboardShouldPersistTaps: 'always' }}
          containerStyle={{
            marginTop: 10,
            borderRadius: 12,
            borderColor: '#e3e7ee',
            borderWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
            zIndex: 1000,
          }}
          itemContainerStyle={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: '#f0f0f0',
          }}
        />
      </View>
    );
  }

  return editMode ? (
    <View style={styles.editRow}>
      <Text style={styles.label}>{label}:</Text>
      <TextInput
        style={styles.input}
        value={form[key] || ''}
        onChangeText={v => handleChange(key, v)}
        placeholder={label}
        placeholderTextColor="#aaa"
      />
    </View>
  ) : (
    <ProfileRow label={label} value={user[key]} />
  );
}

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 15,
        fontWeight: 'bold',
        color: '#4f8cff',
        marginTop: 18,
        marginBottom: 8,
        marginLeft: 2,
        letterSpacing: 0.2,
      }}
    >
      {title}
    </Text>
  );
}

function FeatureChips({ features }: { features: string[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 }}>
      {features.map((feature, idx) => (
        <View
          key={feature + idx}
          style={{
            backgroundColor: '#e6f0ff',
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginRight: 8,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: '#4f8cff', fontSize: 13, fontWeight: '500' }}>
            {feature}
          </Text>
        </View>
      ))}
    </View>
  );
}

const ProfileRow = ({ label, value }: { label: string; value: string }) => (
  <View style={[styles.row, { minHeight: 28 }]}>
    {' '}
    {/* more vertical space */}
    <Text
      style={[
        styles.label,
        { fontWeight: 'bold', color: '#444', minWidth: 130 },
      ]}
    >
      {label}:
    </Text>
    <Text
      style={[styles.value, { marginLeft: 8, color: '#222', fontSize: 15 }]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 24,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    flex: 1,
  },
  editButton: {
    marginLeft: 12,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  saveButton: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  saveButtonText: {
    color: GRADIENT[0],
    fontWeight: 'bold',
    fontSize: 16,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginBottom: 18,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 2,
  },
  phone: {
    fontSize: 15,
    color: '#4f8cff',
    marginBottom: 2,
  },
  business: {
    fontSize: 15,
    color: '#666',
    marginBottom: 10,
  },
  section: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    color: '#888',
    minWidth: 120,
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    color: '#222',
    flex: 1,
    fontWeight: '400',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#f9f9f9',
    marginLeft: 8,
  },
  inputActive: {
    borderColor: '#4f8cff',
    borderWidth: 2,
  },
  inputFocusShadow: {
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4f8cff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#4f8cff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  dropdown1: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginLeft: 8,
    marginTop: 5,
  },
  placeholderStyle1: {
    color: '#aaa',
    fontSize: 15,
  },
  selectedTextStyle1: {
    color: '#222',
    fontSize: 15,
  },
  inputSearchStyle1: {
    color: '#222',
    fontSize: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingLeft: 8,
    borderBottomColor: '#e3e7ee',
    borderBottomWidth: 1,
  },
  iconStyle1: {
    width: 24,
    height: 24,
  },
  dropdownContainer: {
    marginTop: 10,
    borderRadius: 12,
    borderColor: '#e3e7ee',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItemContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#222',
  },
});

export default ProfileScreen;
