import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Generate next document number
export const generateNextDocumentNumber = async (
  documentType: DocumentType | string,
): Promise<string> => {
  try {
    const storageKey = getStorageKey(documentType);
    const lastNumberStr = await AsyncStorage.getItem(storageKey);

    let nextNumber = 1;

    if (lastNumberStr) {
      // Extract the numeric part from the last number (e.g., "PAY-001" -> 1)
      const match = lastNumberStr.match(/\d+/g);
      if (match && match.length > 0) {
        // Get the last numeric part and remove commas
        const lastNumericPart = match[match.length - 1].replace(/,/g, '');
        nextNumber = parseInt(lastNumericPart, 10) + 1;
      }
    }

    // Format the next number
    const formattedNumber = formatNumberWithLeadingZeros(nextNumber);

    // Get prefix based on document type
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      // For dynamic folder types
      prefix = getFolderPrefix(documentType);
    }

    const newDocumentNumber = `${prefix}-${formattedNumber}`;

    // Store the new number for next time
    await AsyncStorage.setItem(storageKey, newDocumentNumber);

    console.log(`📝 Generated ${documentType} number: ${newDocumentNumber}`);
    return newDocumentNumber;
  } catch (error) {
    console.error(`Error generating ${documentType} number:`, error);

    // Fallback: generate number based on current timestamp
    let prefix: string;
    if (documentType in DOCUMENT_PREFIXES) {
      prefix = DOCUMENT_PREFIXES[documentType as DocumentType];
    } else {
      prefix = getFolderPrefix(documentType);
    }

    const fallbackNumber = `${prefix}-${Date.now()}`;
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
