import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api';

// Document type prefixes
export const DOCUMENT_PREFIXES = {
  sell: 'SEL',
  invoice: 'INV',
  payment: 'PAY',
  purchase: 'PUR',
  receipt: 'REC',
  // Add new folder types
  folder: 'FOL',
  // Add any other folder types that might be created
} as const;

export type DocumentType = keyof typeof DOCUMENT_PREFIXES;

// Dynamic prefix generator for any folder type
export const getFolderPrefix = (folderName: string): string => {
  const normalizedName = folderName.toLowerCase().trim();

  // Check if it's a known type first
  if (normalizedName in DOCUMENT_PREFIXES) {
    return DOCUMENT_PREFIXES[normalizedName as DocumentType];
  }

  // For new folder types, generate prefix from first 3 letters
  if (normalizedName.length >= 3) {
    return normalizedName.substring(0, 3).toUpperCase();
  }

  // Fallback for very short names
  return normalizedName.toUpperCase().padEnd(3, 'X');
};

// Storage keys for each document type
const getStorageKey = (documentType: DocumentType | string): string => {
  return `last_${documentType.toLowerCase()}_number`;
};

// Export storage key getter for use in screens
export const getDocumentNumberStorageKey = (
  documentType: DocumentType | string,
): string => {
  return getStorageKey(documentType);
};

// Format number with leading zeros (e.g., 1 -> 001, 100 -> 100, 1000 -> 1,000)
export const formatNumberWithLeadingZeros = (
  num: number,
  minDigits: number = 3,
): string => {
  // Convert to string with leading zeros
  const paddedNumber = num.toString().padStart(minDigits, '0');

  // Add commas for thousands (e.g., 1,000, 10,000)
  if (num >= 1000) {
    const parts = paddedNumber.split('');
    const formattedParts = [];

    // Add commas every 3 digits from right
    for (let i = parts.length - 1; i >= 0; i--) {
      if ((parts.length - 1 - i) % 3 === 0 && i !== 0) {
        formattedParts.unshift(',');
      }
      formattedParts.unshift(parts[i]);
    }

    return formattedParts.join('');
  }

  return paddedNumber;
};

// Helper function to extract numeric part from document number (e.g., "PAY-001" -> 1)
const extractNumberFromDocument = (
  docNumber: string | null | undefined,
): number => {
  if (!docNumber) return 0;
  const match = docNumber.match(/\d+/g);
  if (match && match.length > 0) {
    // Get the last numeric part and remove commas
    const lastNumericPart = match[match.length - 1].replace(/,/g, '');
    return parseInt(lastNumericPart, 10) || 0;
  }
  return 0;
};

// Get highest transaction number from backend for the user
const getHighestTransactionNumberFromBackend = async (
  documentType: DocumentType | string,
): Promise<number> => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      console.log('⚠️ No token found, cannot check backend');
      return 0;
    }

    // Map document types to transaction types and field names
    const typeMapping: Record<
      string,
      { transactionType?: string; fieldName: string }
    > = {
      payment: { transactionType: 'debit', fieldName: 'billNumber' },
      purchase: { transactionType: 'debit', fieldName: 'billNumber' },
      receipt: { transactionType: 'credit', fieldName: 'receiptNumber' },
      invoice: { transactionType: 'credit', fieldName: 'invoiceNumber' },
      sell: { transactionType: 'credit', fieldName: 'invoiceNumber' },
    };

    const normalizedType = documentType.toLowerCase().trim();
    const mapping = typeMapping[normalizedType];

    if (!mapping) {
      console.log(`⚠️ No mapping found for document type: ${documentType}`);
      return 0;
    }

    // Fetch transactions from backend
    const query = mapping.transactionType
      ? `?type=${encodeURIComponent(mapping.transactionType)}`
      : '';
    const res = await fetch(`${BASE_URL}/transactions${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.log(`⚠️ Failed to fetch transactions: ${res.status}`);
      return 0;
    }

    const data = await res.json();
    const transactions = data.data || data || [];

    if (!Array.isArray(transactions) || transactions.length === 0) {
      console.log(`📊 No existing transactions found for ${documentType}`);
      return 0;
    }

    // Get prefix to filter by (e.g., PAY, PUR, REC, SEL)
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      prefix = getFolderPrefix(documentType);
    }

    // Extract numbers from the relevant field, filtering by prefix
    const numbers: number[] = [];
    for (const transaction of transactions) {
      const fieldValue = transaction[mapping.fieldName];
      if (fieldValue && typeof fieldValue === 'string') {
        // Only count numbers that match the expected prefix (e.g., PAY-XXX for payment)
        if (fieldValue.toUpperCase().startsWith(`${prefix}-`)) {
          const num = extractNumberFromDocument(fieldValue);
          if (num > 0) {
            numbers.push(num);
          }
        }
      }
    }

    if (numbers.length === 0) {
      console.log(`📊 No document numbers found in existing transactions`);
      return 0;
    }

    const maxNumber = Math.max(...numbers);
    console.log(
      `📊 Found highest ${documentType} number from backend: ${maxNumber}`,
    );
    return maxNumber;
  } catch (error) {
    console.error(`❌ Error fetching transactions from backend:`, error);
    return 0;
  }
};

// Generate next document number (preview only - doesn't store until transaction is saved)
export const generateNextDocumentNumber = async (
  documentType: DocumentType | string,
  store: boolean = true, // Only store when transaction is actually saved
): Promise<string> => {
  try {
    // Get prefix based on document type
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      // For dynamic folder types
      prefix = getFolderPrefix(documentType);
    }

    // Step 1: Check backend for highest existing number
    const backendMaxNumber = await getHighestTransactionNumberFromBackend(
      documentType,
    );

    // Step 2: Check local storage for last saved number (not just generated)
    const storageKey = getStorageKey(documentType);
    const lastNumberStr = await AsyncStorage.getItem(storageKey);
    const localMaxNumber = extractNumberFromDocument(lastNumberStr);

    // Step 3: Calculate next number based on backend (source of truth)
    // If backend has transactions, use backend max + 1
    // If backend has no transactions (new user), start at 1 (001)
    // Local storage should match backend (it's just a cache)
    let nextNumber: number;
    if (backendMaxNumber > 0) {
      // Backend has transactions - increment from backend max
      nextNumber = backendMaxNumber + 1;
    } else if (localMaxNumber > 0) {
      // Backend has no transactions, but local has a number
      // This means a number was generated but transaction not saved yet
      // Reuse the local number (don't increment)
      nextNumber = localMaxNumber;
    } else {
      // Both are 0 - new user, start at 1 (001)
      nextNumber = 1;
    }

    // Format the next number
    const formattedNumber = formatNumberWithLeadingZeros(nextNumber);
    const newDocumentNumber = `${prefix}-${formattedNumber}`;

    // Only store if explicitly requested (when transaction is saved)
    if (store) {
      await AsyncStorage.setItem(storageKey, newDocumentNumber);
    }

    console.log(
      `📝 Generated ${documentType} number: ${newDocumentNumber} (backend max: ${backendMaxNumber}, local max: ${localMaxNumber}, store: ${store})`,
    );
    return newDocumentNumber;
  } catch (error) {
    console.error(`Error generating ${documentType} number:`, error);

    // Fallback: return first number (001) for new users
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      prefix = getFolderPrefix(documentType);
    }

    const fallbackNumber = `${prefix}-001`;
    console.log(`📝 Using fallback ${documentType} number: ${fallbackNumber}`);
    return fallbackNumber;
  }
};

// Reset document number counter (useful for testing or manual reset)
export const resetDocumentNumber = async (
  documentType: DocumentType | string,
): Promise<void> => {
  try {
    const storageKey = getStorageKey(documentType);
    await AsyncStorage.removeItem(storageKey);
    console.log(`🔄 Reset ${documentType} number counter`);
  } catch (error) {
    console.error(`Error resetting ${documentType} number:`, error);
  }
};

// Get current document number without incrementing
export const getCurrentDocumentNumber = async (
  documentType: DocumentType | string,
): Promise<string> => {
  try {
    const storageKey = getStorageKey(documentType);
    const lastNumberStr = await AsyncStorage.getItem(storageKey);

    if (lastNumberStr) {
      return lastNumberStr;
    }

    // If no number exists, return the first number
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      prefix = getFolderPrefix(documentType);
    }
    return `${prefix}-001`;
  } catch (error) {
    console.error(`Error getting current ${documentType} number:`, error);
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      prefix = getFolderPrefix(documentType);
    }
    return `${prefix}-001`;
  }
};

// Set a specific document number (useful for manual override)
export const setDocumentNumber = async (
  documentType: DocumentType | string,
  number: string,
): Promise<void> => {
  try {
    const storageKey = getStorageKey(documentType);
    await AsyncStorage.setItem(storageKey, number);
    console.log(`📝 Set ${documentType} number to: ${number}`);
  } catch (error) {
    console.error(`Error setting ${documentType} number:`, error);
  }
};

// Generate next document number for any folder type
export const generateNextFolderNumber = async (
  folderName: string,
): Promise<string> => {
  return generateNextDocumentNumber(folderName);
};

// Get current document number for any folder type
export const getCurrentFolderNumber = async (
  folderName: string,
): Promise<string> => {
  return getCurrentDocumentNumber(folderName);
};

// Get all document numbers for debugging
export const getAllDocumentNumbers = async (): Promise<
  Record<string, string>
> => {
  const result: Record<string, string> = {};

  // Get known document types
  for (const documentType of Object.keys(DOCUMENT_PREFIXES) as DocumentType[]) {
    result[documentType] = await getCurrentDocumentNumber(documentType);
  }

  // You can also add logic here to scan for other folder types in storage
  // This would require scanning AsyncStorage keys

  return result;
};
