import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import type { Permission } from 'react-native';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { uiColors, uiFonts } from '../../config/uiSizing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStackParamList } from '../../types/navigation';
import { useStatusBarWithGradient } from '../../hooks/useStatusBar';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';

// Import contacts properly
import Contacts from 'react-native-contacts';

const { width } = Dimensions.get('window');
// Responsive sizes for ADD button (slightly smaller overall)
const ADD_BTN_FONT_SIZE = width >= 400 ? 13 : width <= 360 ? 11 : 12;
const ADD_BTN_ICON_SIZE = width >= 400 ? 16 : width <= 360 ? 14 : 15;
const ADD_BTN_HEIGHT = width >= 400 ? 40 : width <= 360 ? 36 : 38;
const ADD_BTN_MIN_WIDTH = width >= 400 ? 88 : width <= 360 ? 80 : 84;

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  avatar: string;
}

// Global cache to persist contacts across component unmounts and prevent loading screen flash
let globalContactsCache: Contact[] | null = null;
let globalContactsCacheChecked = false;

// Function to clear global cache (called from logout)
export const clearContactsCache = () => {
  globalContactsCache = null;
  globalContactsCacheChecked = false;
};

const ANDROID_READ_CONTACTS = 'android.permission.READ_CONTACTS';
const ANDROID_WRITE_CONTACTS = 'android.permission.WRITE_CONTACTS';
const ANDROID_GET_ACCOUNTS = 'android.permission.GET_ACCOUNTS';

const AddCustomerFromContactsScreen: React.FC = () => {
  // StatusBar like ProfileScreen for colored header
  const { statusBarSpacer } = useStatusBarWithGradient(
    'AddCustomerFromContacts',
    ['#4f8cff', '#4f8cff'],
  );
  const preciseStatusBarHeight = getStatusBarHeight(true);
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route =
    useRoute<RouteProp<AppStackParamList, 'AddCustomerFromContacts'>>();
  const incomingPartyType = (route.params as any)?.partyType as
    | 'customer'
    | 'supplier'
    | undefined;
  const [searchQuery, setSearchQuery] = useState('');
  const entityLabel =
    incomingPartyType === 'supplier' ? 'Supplier' : 'Customer';
  const [contacts, setContacts] = useState<Contact[]>(
    globalContactsCache || [],
  );
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>(
    globalContactsCache || [],
  );
  const [loading, setLoading] = useState(!globalContactsCache);
  const [error, setError] = useState<string | null>(null);
  const [showSettingsButton, setShowSettingsButton] = useState(false);
  // Check for cached contacts on component mount
  useEffect(() => {
    checkCachedContacts();
  }, []);

  const checkCachedContacts = () => {
    // If we already have global cache, use it immediately
    if (globalContactsCache && globalContactsCache.length > 0) {
      setContacts(globalContactsCache);
      setFilteredContacts(globalContactsCache);
      setLoading(false);
      globalContactsCacheChecked = true;
      console.log(
        '✅ Using cached contacts:',
        globalContactsCache.length,
        'contacts',
      );
      return;
    }

    // No cached data – show loader and request permission to fetch real contacts
    setLoading(true);
    globalContactsCacheChecked = true;
    requestContactsPermission();
  };

  const requestContactsPermission = async () => {
    try {
      setShowSettingsButton(false);
      setError(null);
      console.log('🔍 Starting contacts permission request...');

      if (Platform.OS === 'android') {
        // First verify Contacts module is available
        if (!Contacts) {
          throw new Error('Contacts module not available');
        }

        // On Android, use PermissionsAndroid (checkPermission is iOS-only)
        const hasPermission = await PermissionsAndroid.check(
          ANDROID_READ_CONTACTS,
        );
        console.log('📱 Android permission check result:', hasPermission);

        if (hasPermission) {
          console.log('✅ Contacts permission already granted');
          // Small delay to ensure native module is ready
          await new Promise(resolve => setTimeout(resolve, 200));
          fetchDeviceContacts();
          return;
        }

        // Request permission using Android API
        console.log('📱 Requesting contacts permission...');
        const grantedMap = await PermissionsAndroid.requestMultiple(
          [
            ANDROID_READ_CONTACTS,
            ANDROID_WRITE_CONTACTS,
            ANDROID_GET_ACCOUNTS,
          ].filter(Boolean) as Permission[],
        );
        const readContactsStatus = grantedMap[ANDROID_READ_CONTACTS];
        console.log('📱 Permission request result:', grantedMap);

        if (readContactsStatus === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Contacts permission granted');
          // Wait for native module to recognize the new permission
          // This delay is critical - the native bridge needs time to sync
          await new Promise(resolve => setTimeout(resolve, 500));

          // Double-check permission was actually granted
          const verifyPermission = await PermissionsAndroid.check(
            ANDROID_READ_CONTACTS,
          );
          if (verifyPermission) {
            console.log('✅ Permission verified, fetching contacts...');
            fetchDeviceContacts();
          } else {
            console.error('❌ Permission verification failed after grant');
            setError(
              'Permission was granted but could not be verified. Please try again.',
            );
            setShowSettingsButton(true);
            setLoading(false);
          }
          return;
        }

        const isNeverAskAgain =
          readContactsStatus === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

        console.log(
          isNeverAskAgain
            ? '❌ Contacts permission permanently denied'
            : '❌ Contacts permission denied',
        );
        setError(
          isNeverAskAgain
            ? 'Contacts permission denied with "Don\'t ask again". Please enable it from Settings.'
            : 'Contacts permission denied. Please grant permission in settings.',
        );
        setShowSettingsButton(true);
        setLoading(false);
        return;
      } else {
        // iOS - Check permission status first
        console.log('🍎 iOS platform, checking contact permission status...');
        try {
          if (!Contacts) {
            throw new Error('Contacts module not available');
          }

          const permission = await Contacts.checkPermission();
          console.log('🍎 iOS permission check result:', permission);

          if (permission === 'authorized') {
            console.log('✅ iOS contacts permission already granted');
            fetchDeviceContacts();
            return;
          } else if (permission === 'denied') {
            setError(
              'Contacts permission denied. Please grant permission in settings.',
            );
            setShowSettingsButton(true);
            setLoading(false);
            return;
          } else {
            // Permission not determined, request it
            const requestResult = await Contacts.requestPermission();
            console.log('🍎 iOS permission request result:', requestResult);

            if (requestResult === 'authorized') {
              console.log('✅ iOS contacts permission granted');
              // Small delay to ensure native module is ready
              await new Promise(resolve => setTimeout(resolve, 300));
              fetchDeviceContacts();
            } else {
              setError(
                'Contacts permission denied. Please grant permission in settings.',
              );
              setShowSettingsButton(true);
              setLoading(false);
            }
          }
        } catch (iosError) {
          console.error('❌ iOS permission error:', iosError);
          setError(
            iosError instanceof Error
              ? `iOS permission error: ${iosError.message}`
              : 'Failed to check iOS contacts permission.',
          );
          setShowSettingsButton(true);
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('❌ Error requesting contacts permission:', err);
      setError(
        err instanceof Error
          ? `Error requesting contacts permission: ${err.message}`
          : 'Error requesting contacts permission. Please try again.',
      );
      setShowSettingsButton(true);
      setLoading(false);
    }
  };

  const fetchDeviceContacts = async (retryCount = 0) => {
    try {
      console.log(
        `🔍 Starting device contacts fetch... (attempt ${retryCount + 1})`,
      );
      setLoading(true);
      setError(null);

      // Check if Contacts module is properly available
      if (!Contacts) {
        console.log('❌ Contacts module is null/undefined');
        throw new Error('Contacts module not available');
      }

      // Verify permission one more time before fetching
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          ANDROID_READ_CONTACTS,
        );
        if (!hasPermission) {
          console.error('❌ Permission check failed before fetch');
          throw new Error('READ_CONTACTS permission not granted');
        }
        console.log('✅ Permission verified before fetch');
      }

      console.log('📱 Contacts module type:', typeof Contacts);
      console.log('📱 Available methods:', Object.keys(Contacts));

      // Try multiple methods to get contacts with fallbacks
      let deviceContacts: any[] = [];
      let fetchMethod = '';
      let lastError: Error | null = null;

      // Method 1: getAll() - most reliable but may have limits
      if (typeof Contacts.getAll === 'function') {
        console.log('📞 Using Contacts.getAll() method...');
        try {
          deviceContacts = await Contacts.getAll();
          fetchMethod = 'getAll';
          console.log(`✅ getAll() returned ${deviceContacts.length} contacts`);

          // Validate we got actual contact data
          if (
            deviceContacts &&
            Array.isArray(deviceContacts) &&
            deviceContacts.length > 0
          ) {
            console.log('✅ Contacts array is valid and non-empty');
          } else {
            console.warn('⚠️ getAll() returned empty or invalid array');
            deviceContacts = [];
          }
        } catch (getAllError: any) {
          lastError = getAllError instanceof Error ? getAllError : null;
          console.error(
            '❌ getAll() failed with error:',
            getAllError?.message || getAllError,
            getAllError?.stack,
          );
          deviceContacts = [];
        }
      } else {
        console.warn('⚠️ Contacts.getAll is not a function');
      }

      // Method 2: getAllWithoutPhotos() - often more reliable
      if (
        (!deviceContacts || deviceContacts.length === 0) &&
        typeof Contacts.getAllWithoutPhotos === 'function'
      ) {
        console.log('📞 Using Contacts.getAllWithoutPhotos() method...');
        try {
          deviceContacts = await Contacts.getAllWithoutPhotos();
          fetchMethod = 'getAllWithoutPhotos';
          console.log(
            `✅ getAllWithoutPhotos() returned ${deviceContacts.length} contacts`,
          );
        } catch (getAllWithoutPhotosError: any) {
          lastError =
            getAllWithoutPhotosError instanceof Error
              ? getAllWithoutPhotosError
              : lastError;
          console.warn(
            '⚠️ getAllWithoutPhotos() failed:',
            getAllWithoutPhotosError,
          );
          deviceContacts = [];
        }
      }

      // Method 3: getContactsMatchingString() with empty string
      if (
        (!deviceContacts || deviceContacts.length === 0) &&
        typeof Contacts.getContactsMatchingString === 'function'
      ) {
        console.log(
          '📞 Using Contacts.getContactsMatchingString("") method...',
        );
        try {
          deviceContacts = await Contacts.getContactsMatchingString('');
          fetchMethod = 'getContactsMatchingString';
          console.log(
            `✅ getContactsMatchingString("") returned ${deviceContacts.length} contacts`,
          );
        } catch (getContactsMatchingStringError: any) {
          lastError =
            getContactsMatchingStringError instanceof Error
              ? getContactsMatchingStringError
              : lastError;
          console.warn(
            '⚠️ getContactsMatchingString("") failed:',
            getContactsMatchingStringError,
          );
          deviceContacts = [];
        }
      }

      // Method 4: Progressive contact fetching with alphabet search
      if (
        (!deviceContacts || deviceContacts.length === 0) &&
        typeof Contacts.getContactsMatchingString === 'function'
      ) {
        console.log('📞 Using progressive alphabet search method...');
        try {
          deviceContacts = await fetchContactsProgressive();
          fetchMethod = 'progressive_search';
          console.log(
            `✅ Progressive search returned ${deviceContacts.length} contacts`,
          );
        } catch (progressiveError: any) {
          lastError =
            progressiveError instanceof Error ? progressiveError : lastError;
          console.warn('⚠️ Progressive search failed:', progressiveError);
          deviceContacts = [];
        }
      }

      // Method 5: Batch getContactById() as last resort
      if (
        (!deviceContacts || deviceContacts.length === 0) &&
        typeof Contacts.getContactById === 'function'
      ) {
        console.log('📞 Using batch getContactById() method...');
        try {
          deviceContacts = await fetchContactsBatch();
          fetchMethod = 'getContactById_batch';
          console.log(
            `✅ Batch getContactById returned ${deviceContacts.length} contacts`,
          );
        } catch (batchError: any) {
          lastError = batchError instanceof Error ? batchError : lastError;
          console.warn('⚠️ Batch getContactById failed:', batchError);
          deviceContacts = [];
        }
      }

      // If still no contacts, throw error
      if (!deviceContacts || deviceContacts.length === 0) {
        const errorToThrow =
          lastError ??
          new Error(
            'All contact fetching methods failed or returned 0 contacts',
          );
        console.error('❌ Unable to fetch contacts from device:', errorToThrow);
        throw errorToThrow;
      }

      console.log(
        `✅ Contacts fetched using ${fetchMethod}: ${deviceContacts.length} contacts`,
      );

      // Process contacts with detailed logging
      console.log('🔄 Processing contacts...');
      const startTime = Date.now();

      const processedContacts = await processContactsBatch(deviceContacts);

      const processingTime = Date.now() - startTime;

      console.log('✅ Contact processing completed:', {
        totalFound: deviceContacts.length,
        validContacts: processedContacts.length,
        processingTime: `${processingTime}ms`,
        fetchMethod,
      });

      // Update global cache
      globalContactsCache = processedContacts;
      globalContactsCacheChecked = true;

      // Set real contacts (no limit - show all valid contacts)
      setContacts(processedContacts);
      setFilteredContacts(processedContacts);
      setError(null);

      console.log('🎉 Real device contacts loaded successfully!');
    } catch (err) {
      console.error('❌ Error fetching device contacts:', err);

      // Provide more specific error messages
      let errorMessage =
        'Failed to load contacts. Please check your permissions.';

      if (err instanceof Error) {
        if (err.message.includes('permission')) {
          errorMessage =
            'Contacts permission denied. Please grant permission in settings.';
        } else if (err.message.includes('No contacts found')) {
          errorMessage = 'No contacts found on your device.';
        } else if (err.message.includes('All methods failed')) {
          errorMessage =
            'Unable to fetch contacts. This may be due to device limitations or permission issues.';
        } else if (
          err.message.includes('module not available') ||
          err.message.includes('getAll is not available') ||
          err.message.includes('getAll is not a function')
        ) {
          errorMessage = 'Contacts feature not available on this device.';
        } else if (err.message.includes('Failed to fetch contacts')) {
          errorMessage = `Contact fetching failed: ${err.message}`;
        }
      }

      if (
        err instanceof Error &&
        err.message &&
        !errorMessage.includes(err.message)
      ) {
        errorMessage = `${errorMessage}\nDetails: ${err.message}`;
      }

      setError(errorMessage);
      if (
        err instanceof Error &&
        err.message.toLowerCase().includes('permission')
      ) {
        setShowSettingsButton(true);
      }
      // Try retry logic for certain errors
      if (
        retryCount < 2 &&
        err instanceof Error &&
        !err.message.includes('permission')
      ) {
        console.log(
          `🔄 Retrying contact fetch in 2 seconds... (attempt ${
            retryCount + 1
          })`,
        );
        setTimeout(() => {
          fetchDeviceContacts(retryCount + 1);
        }, 2000);
        return;
      }

      if (!globalContactsCache || globalContactsCache.length === 0) {
        setContacts([]);
        setFilteredContacts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Progressive contact fetching using alphabet search (helps with large contact databases)
  const fetchContactsProgressive = async (): Promise<any[]> => {
    try {
      console.log('📞 Starting progressive contact fetch...');

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
      const allContacts: any[] = [];
      const seenIds = new Set<string>();

      for (const char of alphabet) {
        try {
          console.log(`📞 Searching contacts starting with "${char}"...`);
          const contacts = await Contacts.getContactsMatchingString(char);

          // Filter out duplicates and add new contacts
          const newContacts = contacts.filter((contact: any) => {
            if (contact.recordID && !seenIds.has(contact.recordID)) {
              seenIds.add(contact.recordID);
              return true;
            }
            return false;
          });

          allContacts.push(...newContacts);
          console.log(
            `✅ Found ${newContacts.length} new contacts starting with "${char}"`,
          );

          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (charError) {
          console.warn(
            `⚠️ Failed to search contacts starting with "${char}":`,
            charError,
          );
          continue; // Continue with next character
        }
      }

      console.log(
        `✅ Progressive search completed: ${allContacts.length} unique contacts found`,
      );
      return allContacts;
    } catch (error) {
      console.error('❌ Progressive contact fetch failed:', error);
      throw error;
    }
  };

  // Batch fetch contacts using getContactById (fallback method)
  const fetchContactsBatch = async (): Promise<any[]> => {
    try {
      console.log('📞 Starting batch contact fetch...');

      // First, try to get a list of contact IDs
      let contactIds: string[] = [];

      if (typeof Contacts.getAllWithoutPhotos === 'function') {
        const contactsWithoutPhotos = await Contacts.getAllWithoutPhotos();
        contactIds = contactsWithoutPhotos.map((c: any) => c.recordID);
      } else if (typeof Contacts.getContactsMatchingString === 'function') {
        // Use empty string to get all contacts
        const allContacts = await Contacts.getContactsMatchingString('');
        contactIds = allContacts.map((c: any) => c.recordID);
      }

      if (contactIds.length === 0) {
        throw new Error('No contact IDs found for batch processing');
      }

      console.log(
        `📞 Found ${contactIds.length} contact IDs for batch processing`,
      );

      // Process in batches of 50 to avoid memory issues
      const batchSize = 50;
      const allContacts: any[] = [];

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batch = contactIds.slice(i, i + batchSize);
        console.log(
          `📞 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            contactIds.length / batchSize,
          )}`,
        );

        const batchPromises = batch.map(async id => {
          try {
            return await Contacts.getContactById(id);
          } catch (error) {
            console.warn(`⚠️ Failed to fetch contact ${id}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(contact => contact !== null);
        allContacts.push(...validResults);

        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < contactIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(
        `✅ Batch processing completed: ${allContacts.length} contacts`,
      );
      return allContacts;
    } catch (error) {
      console.error('❌ Batch contact fetch failed:', error);
      throw error;
    }
  };

  // Process contacts in batches for better performance
  const processContactsBatch = async (
    rawContacts: any[],
  ): Promise<Contact[]> => {
    try {
      console.log('🔄 Starting contact processing...');

      const batchSize = 100;
      const processedContacts: Contact[] = [];
      let skippedCount = 0;

      for (let i = 0; i < rawContacts.length; i += batchSize) {
        const batch = rawContacts.slice(i, i + batchSize);
        console.log(
          `🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            rawContacts.length / batchSize,
          )}`,
        );

        const batchResults = batch
          .map((contact: any, index: number) => {
            try {
              return processSingleContact(contact, i + index);
            } catch (error) {
              console.warn(`⚠️ Failed to process contact ${i + index}:`, error);
              skippedCount++;
              return null;
            }
          })
          .filter((contact: Contact | null) => contact !== null) as Contact[];

        processedContacts.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < rawContacts.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(
        `✅ Contact processing completed: ${processedContacts.length} valid, ${skippedCount} skipped`,
      );
      return processedContacts;
    } catch (error) {
      console.error('❌ Contact processing failed:', error);
      throw error;
    }
  };

  // Process a single contact with comprehensive validation
  const processSingleContact = (
    contact: any,
    index: number,
  ): Contact | null => {
    try {
      // Log raw contact data for debugging (first few contacts only)
      if (index < 5) {
        console.log(`🔍 Raw contact ${index}:`, {
          recordID: contact.recordID,
          displayName: contact.displayName,
          givenName: contact.givenName,
          familyName: contact.familyName,
          phoneNumbers: contact.phoneNumbers?.length || 0,
          hasEmail: !!contact.emailAddresses?.length,
          rawData: Object.keys(contact),
        });
      }

      // Validate contact has essential data
      if (!contact) {
        console.warn(`⚠️ Contact ${index} is null/undefined`);
        return null;
      }

      // Check for phone numbers - try multiple phone number fields
      let phoneNumber = '';
      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        // Try to find a valid phone number
        for (const phone of contact.phoneNumbers) {
          if (phone && phone.number && phone.number.trim() !== '') {
            phoneNumber = phone.number.trim();
            break;
          }
        }
      }

      // If no phone numbers found, try alternative fields
      if (!phoneNumber) {
        if (contact.phone && contact.phone.trim() !== '') {
          phoneNumber = contact.phone.trim();
        } else if (contact.mobile && contact.mobile.trim() !== '') {
          phoneNumber = contact.mobile.trim();
        } else if (contact.telephone && contact.telephone.trim() !== '') {
          phoneNumber = contact.telephone.trim();
        }
      }

      if (!phoneNumber) {
        if (index < 10)
          console.log(`⚠️ Contact ${index} has no valid phone numbers`);
        return null;
      }

      // Get contact name with comprehensive fallbacks
      let name = '';

      // Try all possible name fields
      const nameFields = [
        contact.displayName,
        contact.givenName,
        contact.familyName,
        contact.organizationName,
        contact.nickname,
        contact.middleName,
        contact.namePrefix,
        contact.nameSuffix,
        contact.jobTitle,
        contact.department,
      ];

      for (const field of nameFields) {
        if (field && field.trim() !== '') {
          name = field.trim();
          break;
        }
      }

      // If multiple name fields exist, combine them
      if (contact.givenName && contact.familyName) {
        const given = contact.givenName.trim();
        const family = contact.familyName.trim();
        if (given && family) {
          name = `${given} ${family}`.trim();
        }
      }

      // If still no name, use phone number
      if (!name || name === '') {
        name = phoneNumber;
      }

      // Generate avatar from name
      let avatar = '';
      if (name && name !== phoneNumber) {
        const words = name.split(' ').filter(word => word.length > 0);
        if (words.length >= 2) {
          avatar = (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        } else {
          avatar = name.charAt(0).toUpperCase();
        }
      } else {
        avatar = phoneNumber.charAt(0).toUpperCase();
      }

      // Create processed contact
      const processedContact: Contact = {
        id: contact.recordID || contact.id || `contact_${index}`,
        name: name,
        phoneNumber: phoneNumber,
        avatar: avatar,
      };

      return processedContact;
    } catch (error) {
      console.warn(`⚠️ Error processing contact ${index}:`, error);
      return null;
    }
  };

  // Filter contacts based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(
        contact =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.phoneNumber.includes(searchQuery),
      );
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  // Handle focus events - no need to reload contacts if we have cached data
  useFocusEffect(
    React.useCallback(() => {
      console.log('🎯 AddCustomerFromContactsScreen: Focus event triggered');

      // If we have cached contacts, no need to reload
      if (globalContactsCache && globalContactsCache.length > 0) {
        console.log(
          '✅ AddCustomerFromContactsScreen: Using cached contacts, no reload needed',
        );
        return;
      }

      // Only reload if we don't have cached data
      console.log(
        '🔄 AddCustomerFromContactsScreen: No cached data, loading contacts...',
      );
      checkCachedContacts();
    }, []),
  );

  const handleAddNewCustomer = () => {
    navigation.navigate('AddParty', {
      shouldRefresh: true, // Tell the CustomerScreen to refresh when returning
      partyType: incomingPartyType === 'supplier' ? 'supplier' : 'customer',
    });
  };

  const handleAddContact = (contact: Contact) => {
    // Extract phone number without country code for the form
    let phoneNumber = contact.phoneNumber;
    if (phoneNumber.startsWith('+91-')) {
      phoneNumber = phoneNumber.substring(4);
    } else if (phoneNumber.startsWith('+91')) {
      phoneNumber = phoneNumber.substring(3);
    }

    navigation.navigate('AddParty', {
      contactData: {
        name: contact.name,
        phoneNumber: phoneNumber,
      },
      shouldRefresh: true, // Tell the CustomerScreen to refresh when returning
      partyType: incomingPartyType === 'supplier' ? 'supplier' : 'customer',
    });
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const handleRetryFetch = () => {
    requestContactsPermission();
  };

  const renderContactItem = (contact: Contact) => (
    <View key={contact.id} style={styles.contactItem}>
      <View style={styles.contactAvatar}>
        <Text style={styles.avatarText}>{contact.avatar}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleAddContact(contact)}
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons
            name="plus"
            size={ADD_BTN_ICON_SIZE}
            color={uiColors.textHeader}
          />
          <Text style={[styles.addButtonText, { fontSize: ADD_BTN_FONT_SIZE }]}>
            ADD
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          getSolidHeaderStyle(preciseStatusBarHeight || statusBarSpacer.height),
        ]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <TouchableOpacity
          style={styles.headerBackButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            console.log(
              '🔄 AddCustomerFromContactsScreen: Back button pressed, navigating to CustomerScreen with refresh',
            );
            navigation.navigate('Customer', { shouldRefresh: true });
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add {entityLabel} from Contacts</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or number"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666666"
          />
          <MaterialCommunityIcons name="magnify" size={20} color="#666" />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add New Customer Option */}
        <TouchableOpacity
          style={styles.addNewCustomerItem}
          onPress={handleAddNewCustomer}
        >
          <View style={styles.addNewCustomerAvatar}>
            <MaterialCommunityIcons
              name="account-plus"
              size={24}
              color="#4f8cff"
            />
          </View>
          <View style={styles.addNewCustomerInfo}>
            <Text style={styles.addNewCustomerText}>Add New {entityLabel}</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#4f8cff"
          />
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color="#f97316"
            />
            <Text style={styles.errorBannerText}>{error}</Text>
            <View style={styles.errorBannerButtons}>
              <TouchableOpacity
                style={styles.retryButtonSmall}
                onPress={handleRetryFetch}
              >
                <Text style={styles.retryButtonTextSmall}>Retry</Text>
              </TouchableOpacity>
              {showSettingsButton && (
                <TouchableOpacity
                  style={styles.settingsButtonSmall}
                  onPress={openAppSettings}
                >
                  <Text style={styles.settingsButtonTextSmall}>Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Contacts List */}
        <View style={styles.contactsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f8cff" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={48}
                color="#666"
              />
              <Text style={styles.emptyText}>No contacts found</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'No contacts available on your device'}
              </Text>
            </View>
          ) : (
            <>
              {/* Always show contacts if available */}
              {filteredContacts.map(renderContactItem)}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: uiColors.primaryBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 30,
  },
  headerBackButton: {
    padding: 10,
    borderRadius: 20,
  },
  headerTitle: {
    color: uiColors.textHeader,
    fontSize: 19,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    fontFamily: uiFonts.family,
  },

  headerRight: {
    width: 44, // Match back button touch area for perfect centering
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: uiFonts.sizeSearchInput,
    color: '#333333',
    marginRight: 8,

    fontFamily: uiFonts.family,
  },

  content: {
    flex: 1,
  },
  addNewCustomerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 16,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  addNewCustomerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addNewCustomerInfo: {
    flex: 1,
  },
  addNewCustomerText: {
    fontSize: 14,
    color: uiColors.primaryBlue,
    fontFamily: uiFonts.family,
  },

  contactsList: {
    backgroundColor: '#fff',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: uiColors.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,

    fontFamily: uiFonts.family,
  },

  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: uiFonts.sizeCustomerName,
    color: '#333333',
    marginBottom: 4,

    fontFamily: uiFonts.family,
  },

  contactPhone: {
    fontSize: uiFonts.sizeCustomerMeta,
    color: '#64748b',

    fontFamily: uiFonts.family,
  },

  addButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: ADD_BTN_MIN_WIDTH,
    height: ADD_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  addButtonText: {
    color: uiColors.textHeader,
    fontSize: 12,
    fontFamily: uiFonts.family,

    letterSpacing: 0.3,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748b',
    fontFamily: uiFonts.family,
  },

  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 12,
    fontSize: 12,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,

    fontFamily: 'Roboto-Medium',
  },

  retryButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: uiColors.textHeader,
    fontSize: 12,
    fontFamily: uiFonts.family,
  },

  errorButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  settingsButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 12,

    fontFamily: 'Roboto-Medium',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#333333',
    marginBottom: 6,

    fontFamily: 'Roboto-Medium',
  },

  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#4f8cff',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },

  errorBannerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  retryButtonSmall: {
    backgroundColor: '#4f8cff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonTextSmall: {
    color: '#fff',
    fontSize: 10,

    fontFamily: 'Roboto-Medium',
  },

  settingsButtonSmall: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  settingsButtonTextSmall: {
    color: '#fff',
    fontSize: 10,

    fontFamily: 'Roboto-Medium',
  },
});

export default AddCustomerFromContactsScreen;
