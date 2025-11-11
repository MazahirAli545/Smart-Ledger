import React, { useState, useEffect } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppStackParamList } from '../types/navigation';

const LinkToCAScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const [loading, setLoading] = useState(false);
  const [caDetails, setCaDetails] = useState({
    name: '',
    email: '',
    phone: '',
    firmName: '',
    gstNumber: '',
    address: '',
  });

  // Local Text wrapper to enforce Roboto font in this screen
  const Text: React.FC<React.ComponentProps<typeof RNText>> = ({
    style,
    ...rest
  }) => <RNText {...rest} style={[{ fontFamily: 'Roboto-Medium' }, style]} />;

  const caFeatures = [
    {
      id: 1,
      title: 'GST Filing',
      description: 'Automated GST return filing and compliance',
      icon: 'file-document',
      color: '#4CAF50',
    },
    {
      id: 2,
      title: 'Tax Planning',
      description: 'Strategic tax planning and optimization',
      icon: 'calculator',
      color: '#2196F3',
    },
    {
      id: 3,
      title: 'Audit Support',
      description: 'Comprehensive audit preparation and support',
      icon: 'magnify',
      color: '#FF9800',
    },
    {
      id: 4,
      title: 'Compliance Monitoring',
      description: 'Real-time compliance tracking and alerts',
      icon: 'shield-check',
      color: '#9C27B0',
    },
    {
      id: 5,
      title: 'Financial Reports',
      description: 'Professional financial statement preparation',
      icon: 'chart-bar',
      color: '#F44336',
    },
    {
      id: 6,
      title: 'Advisory Services',
      description: 'Expert business and tax advisory',
      icon: 'account-tie',
      color: '#00BCD4',
    },
  ];

  const handleConnectCA = () => {
    if (!caDetails.name || !caDetails.email || !caDetails.phone) {
      Alert.alert(
        'Required Fields',
        'Please fill in all required fields (Name, Email, Phone)',
      );
      return;
    }

    Alert.alert(
      'Connect with CA',
      'This feature will connect you with certified chartered accountants in your area. Would you like to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          style: 'default',
          onPress: () => {
            // Here you would typically make an API call to connect with CA
            Alert.alert(
              'Request Sent',
              'Your request has been sent to our CA partners. You will be contacted within 24 hours.',
              [{ text: 'OK' }],
            );
          },
        },
      ],
    );
  };

  const handleFeaturePress = (feature: any) => {
    Alert.alert(
      'CA Service Feature',
      `${feature.title} is available through our CA partners. Connect with a CA to access this service.`,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'Connect CA',
          style: 'default',
          onPress: () => {
            // Scroll to CA details form
            // You could implement scroll to form functionality here
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Link to CA</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Premium Badge */}
      <View style={styles.premiumBanner}>
        <MaterialCommunityIcons name="crown" size={20} color="#ffd700" />
        <Text style={styles.premiumText}>Premium Service</Text>
        <Text style={styles.premiumSubtext}>
          Connect with certified chartered accountants
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* CA Services Section */}
        <Text style={styles.sectionTitle}>CA Services Available</Text>
        <Text style={styles.sectionSubtitle}>
          Professional chartered accountants ready to help with your business
          needs
        </Text>

        <View style={styles.servicesGrid}>
          {caFeatures.map(feature => (
            <TouchableOpacity
              key={feature.id}
              style={styles.serviceCard}
              onPress={() => handleFeaturePress(feature)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.serviceIcon, { backgroundColor: feature.color }]}
              >
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={24}
                  color="#fff"
                />
              </View>
              <Text style={styles.serviceTitle}>{feature.title}</Text>
              <Text style={styles.serviceDescription}>
                {feature.description}
              </Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>CA SERVICE</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* CA Details Form */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Connect with CA</Text>
          <Text style={styles.formSubtitle}>
            Fill in your details and we'll connect you with the right CA
          </Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CA Name *</Text>
              <TextInput
                style={styles.input}
                value={caDetails.name}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, name: text })
                }
                placeholder="Enter CA name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={caDetails.email}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, email: text })
                }
                placeholder="Enter email address"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={caDetails.phone}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, phone: text })
                }
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Firm Name</Text>
              <TextInput
                style={styles.input}
                value={caDetails.firmName}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, firmName: text })
                }
                placeholder="Enter firm name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GST Number</Text>
              <TextInput
                style={styles.input}
                value={caDetails.gstNumber}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, gstNumber: text })
                }
                placeholder="Enter GST number"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={caDetails.address}
                onChangeText={text =>
                  setCaDetails({ ...caDetails, address: text })
                }
                placeholder="Enter address"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnectCA}
            >
              <MaterialCommunityIcons name="link" size={20} color="#fff" />
              <Text style={styles.connectButtonText}>Connect with CA</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Why Connect with CA?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.benefitText}>
                Expert tax advice and planning
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.benefitText}>
                Automated compliance and filing
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.benefitText}>
                Audit support and preparation
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#4CAF50"
              />
              <Text style={styles.benefitText}>
                Real-time compliance monitoring
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  menuButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#222',

    fontFamily: 'Roboto-Medium',
  },

  headerRight: {
    width: 40,
  },
  premiumBanner: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumText: {
    fontSize: 16,
    color: '#856404',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  premiumSubtext: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 24,
    color: '#222',
    marginTop: 16,
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,

    fontFamily: 'Roboto-Medium',
  },

  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  serviceTitle: {
    fontSize: 16,
    color: '#222',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  serviceDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,

    fontFamily: 'Roboto-Medium',
  },

  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff6b35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeText: {
    fontSize: 10,
    color: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  formSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    color: '#222',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,

    fontFamily: 'Roboto-Medium',
  },

  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',

    fontFamily: 'Roboto-Medium',
  },

  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  connectButton: {
    backgroundColor: '#4f8cff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  benefitsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  benefitsTitle: {
    fontSize: 18,
    color: '#222',
    marginBottom: 16,

    fontFamily: 'Roboto-Medium',
  },

  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,

    fontFamily: 'Roboto-Medium',
  },
});

export default LinkToCAScreen;
