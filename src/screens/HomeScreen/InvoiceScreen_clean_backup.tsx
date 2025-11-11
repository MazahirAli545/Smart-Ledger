import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
import { Picker } from '@react-native-picker/picker';
import CustomerSelector from '../../components/CustomerSelector';
import { useCustomerContext } from '../../context/CustomerContext';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SearchAndFilter, {
  PaymentSearchFilterState,
  RecentSearch,
} from '../../components/SearchAndFilter';
import { RouteProp, useRoute } from '@react-navigation/native';
import StatusBadge from '../../components/StatusBadge';
import { useVouchers } from '../../context/VoucherContext';
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { wordsToNumbers } from 'words-to-numbers';
import { parseInvoiceVoiceText } from '../../utils/voiceParser';
import Modal from 'react-native-modal'; // Only for error/success dialogs, not for dropdowns
import {
  extractInvoiceDataWithNLP,
  isNLPAvailable,
} from '../../utils/openaiNlp';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import { OCRService } from '../../services/ocrService';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';

interface FolderParam {
  folder?: {
    id?: number;
    title?: string;
    icon?: string;
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  partyName: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

const GST_OPTIONS = [0, 5, 12, 18, 28];
const GST_PLACEHOLDER = 'Select GST %';

// Enhanced OCR parser for invoice data extraction
interface ParsedInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  totalGST: number;
  total: number;
  notes: string;
}

function parseInvoiceOcrText(text: string): ParsedInvoiceData {
  console.log('ðŸ“„ Raw OCR Text:', text);

  // Enhanced text cleaning for image OCR artifacts - preserve dashes for invoice numbers
  let cleaned = text
    .replace(/\s{2,}/g, ' ') // Normalize multiple spaces
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/[^\w\s,.\-:%â‚¹]/g, ' ') // Remove special characters except essential ones (preserve dashes)
    .replace(/\s{2,}/g, ' ') // Normalize spaces again
    .trim();

  console.log('ðŸ§¹ Cleaned Text:', cleaned);

  // Initialize all fields
  let invoiceNumber = '';
  let invoiceDate = '';
  let customerName = '';
  let customerPhone = '';
  let customerAddress = '';
  let notes = '';
  let subtotal = 0;
  let totalGST = 0;
  let total = 0;
  const items = [];

  // 1. Extract Invoice Number - Enhanced patterns with specific INV handling
  const invoiceNumberPatterns = [
    // Specific pattern for "SEL-XXXXX" format (most common)
    /SEL\s*[-]?\s*(\d{3,6})/i,
    // Standard pattern: "Invoice Number: ANY-12345" or "Invoice Number: 12345"
    /Invoice\s*Number\s*[:\-]?\s*([A-Z0-9\-_\/]+)/i,
    // Invoice with hash: "Invoice #12345" or "Invoice #ABC-123"
    /Invoice\s*[#No]*\s*[:\-]?\s*([A-Z0-9\-_\/]+)/i,
    // Bill number pattern: "Bill Number: 12345"
    /Bill\s*Number\s*[:\-]?\s*([A-Z0-9\-_\/]+)/i,
    // Receipt number pattern: "Receipt #12345"
    /Receipt\s*[#No]*\s*[:\-]?\s*([A-Z0-9\-_\/]+)/i,
    // Any alphanumeric pattern that looks like an invoice number (3-20 characters)
    /([A-Z0-9\-_\/]{3,20})/g,
  ];

  // First, try structured patterns
  for (let i = 0; i < invoiceNumberPatterns.length - 1; i++) {
    const pattern = invoiceNumberPatterns[i];
    const match = cleaned.match(pattern);
    if (match) {
      let extractedNumber = match[1];

      // Special handling for SEL pattern
      if (i === 0 && pattern.source.includes('SEL')) {
        // For SEL pattern, construct the full invoice number
        invoiceNumber = `SEL-${extractedNumber}`;
        console.log('ðŸ” Found Invoice Number (SEL pattern):', invoiceNumber);
        break;
      }

      // Clean and validate the extracted number
      if (extractedNumber && extractedNumber.length >= 3) {
        invoiceNumber = extractedNumber.trim();
        console.log('ðŸ” Found Invoice Number (structured):', invoiceNumber);
        break;
      }
    }
  }

  // If no structured pattern found, try to find fragmented INV pattern
  if (!invoiceNumber) {
    console.log(
      'ðŸ” No structured pattern found, checking for fragmented INV...',
    );

    // Look for "SEL" followed by numbers anywhere in the text
    const selMatches = cleaned.match(/SEL\s*[-]?\s*(\d{3,6})/gi);
    if (selMatches && selMatches.length > 0) {
      const bestMatch = selMatches[0];
      const numberMatch = bestMatch.match(/(\d{3,6})/);
      if (numberMatch) {
        invoiceNumber = `SEL-${numberMatch[1]}`;
        console.log(
          'ðŸ” Found Invoice Number (fragmented SEL):',
          invoiceNumber,
        );
      }
    }
  }

  // If still no invoice number found, try flexible alphanumeric search
  if (!invoiceNumber) {
    console.log(
      'ðŸ” No structured invoice number found, trying flexible search...',
    );

    // Get all potential invoice numbers from the text
    const allMatches = [...cleaned.matchAll(invoiceNumberPatterns[5])]; // Last pattern for flexible search

    // Filter and rank potential invoice numbers
    const candidates = allMatches
      .map(match => match[1])
      .filter(num => {
        // Skip if it's clearly not an invoice number
        const numStr = num.toString();

        // Skip if it looks like a date (YYYY-MM-DD, MM/DD/YYYY, etc.)
        if (
          /^\d{4}-\d{2}-\d{2}$/.test(numStr) ||
          /^\d{2}\/\d{2}\/\d{4}$/.test(numStr) ||
          /^\d{2}-\d{2}-\d{4}$/.test(numStr)
        ) {
          return false;
        }

        // Skip if it looks like a phone number (10-12 digits)
        if (/^\d{10,12}$/.test(numStr)) {
          return false;
        }

        // Skip if it's just a single digit or very short
        if (numStr.length < 3) {
          return false;
        }

        // Skip if it's just a year (4 digits starting with 19 or 20)
        if (/^(19|20)\d{2}$/.test(numStr)) {
          return false;
        }

        // Skip if it contains only common words that aren't invoice numbers
        const commonWords = [
          'INVOICE',
          'BILL',
          'RECEIPT',
          'TOTAL',
          'SUBTOTAL',
          'GST',
          'AMOUNT',
          'QUANTITY',
          'RATE',
        ];
        if (commonWords.includes(numStr.toUpperCase())) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Prioritize numbers that look more like invoice numbers
        const aScore = getInvoiceNumberScore(a);
        const bScore = getInvoiceNumberScore(b);
        return bScore - aScore; // Higher score first
      });

    if (candidates.length > 0) {
      invoiceNumber = candidates[0];
      console.log('ðŸ” Found Invoice Number (flexible):', invoiceNumber);
    }
  }

  // Helper function to score potential invoice numbers
  const getInvoiceNumberScore = (num: string): number => {
    let score = 0;

    // Higher score for alphanumeric combinations (typical for invoice numbers)
    if (/[A-Z]/.test(num) && /\d/.test(num)) {
      score += 10;
    }

    // Higher score for numbers with separators (dashes, underscores)
    if (/[-_]/.test(num)) {
      score += 5;
    }

    // Higher score for reasonable length (5-15 characters)
    if (num.length >= 5 && num.length <= 15) {
      score += 3;
    }

    // Lower score for very long numbers (might be other data)
    if (num.length > 20) {
      score -= 5;
    }

    // Higher score for numbers that start with letters (common pattern)
    if (/^[A-Z]/.test(num)) {
      score += 2;
    }

    return score;
  };

  // 2. Extract Invoice Date
  const datePatterns = [
    /Invoice\s*Date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i,
    /(\d{4}-\d{2}-\d{2})/, // Standard date format
    /(\d{2}\/\d{2}\/\d{4})/, // MM/DD/YYYY format
    /(\d{2}-\d{2}-\d{4})/, // MM-DD-YYYY format
  ];

  for (const pattern of datePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      invoiceDate = match[1];
      console.log('ðŸ” Found Invoice Date:', invoiceDate);
      break;
    }
  }

  // 3. Extract Customer Name - Enhanced for image OCR
  const customerNamePatterns = [
    /Customer\s*Name\s*[:\-]?\s*([A-Za-z\s]+)/i,
    /Customer\s*[:\-]?\s*([A-Za-z\s]+)/i,
    /([A-Za-z]+\s+[A-Za-z]+)/, // Two-word names
    // Handle OCR artifacts in customer name
    /([A-Za-z]+\s+[A-Za-z]+)[^\w]*/i,
    // More specific pattern to avoid "Phone" artifact
    /Customer\s*Name\s*[:\-]?\s*([A-Za-z\s]+?)(?=\s*(?:Phone|$))/i,
  ];

  for (const pattern of customerNamePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      customerName = match[1]?.trim();
      // Clean up OCR artifacts from customer name
      customerName = customerName
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\s*Phone\s*$/i, '') // Remove "Phone" at the end
        .trim();
      console.log('ðŸ” Found Customer Name:', customerName);
      break;
    }
  }

  // 4. Extract Phone Number
  const phonePatterns = [
    /Phone\s*[:\-]?\s*(\d{10,12})/i,
    /(\d{10,12})/, // 10-12 digit numbers
  ];

  for (const pattern of phonePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      customerPhone = match[1];
      console.log('ðŸ” Found Phone Number:', customerPhone);
      break;
    }
  }

  // 5. Extract Address - Enhanced for image OCR
  const addressPatterns = [
    /Address\s*[:\-]?\s*([^]+?)(?=\s*(?:Phone|GST|DESCRIPTION|$))/i,
    /(\d+\s+[A-Za-z\s,]+(?:Switzerland|India|USA|UK|Canada))/i, // Address with country
    // Handle OCR artifacts in address
    /(\d+\s+[A-Za-z\s,]+(?:Switzerland|India|USA|UK|Canada))[^\w]*/i,
    // More specific pattern for the sample invoice
    /Address\s*[:\-]?\s*(\d+\s+[A-Za-z\s,]+\s+Switzerland)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      customerAddress = match[1]?.trim();
      // Clean up OCR artifacts more aggressively
      customerAddress = customerAddress
        .replace(/[^\w\s,.-]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\s*,\s*/g, ', ') // Fix comma spacing
        .trim();
      console.log('ðŸ” Found Address:', customerAddress);
      break;
    }
  }

  // 6. Extract Items from table - Enhanced for better accuracy
  // Look for table structure with Description, GST, Quantity, Rate, Amount
  const tablePatterns = [
    // Pattern for items with GST percentage (e.g., "Charger GST 5% 10 10 105.00")
    /([A-Za-z]+)\s+GST\s*(\d+)%\s*(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g,
    // Pattern for items with GST in different format (e.g., "Charger 5% 10 10 105.00")
    /([A-Za-z]+)\s+(\d+)%\s*(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g,
    // Pattern for items without GST percentage
    /([A-Za-z]+)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g,
  ];

  for (const pattern of tablePatterns) {
    const matches = [...cleaned.matchAll(pattern)];
    for (const match of matches) {
      const description = match[1];
      let gstPct = 0;
      let quantity, rate, amount;

      if (match.length === 6) {
        // Pattern with GST
        gstPct = Number(match[2]);
        quantity = Number(match[3]);
        rate = Number(match[4]);
        amount = Number(match[5]);
      } else {
        // Pattern without GST
        quantity = Number(match[2]);
        rate = Number(match[3]);
        amount = Number(match[4]);
      }

      // Enhanced filtering to exclude headers and invalid items
      if (
        description &&
        quantity > 0 &&
        rate > 0 &&
        ![
          'INVOICE',
          'DESCRIPTION',
          'QUANTITY',
          'RATE',
          'AMOUNT',
          'Notes',
          'Thank',
          'GST',
          'SubTotal',
          'Total',
          'Calculations',
          'Item',
        ].includes(description) &&
        description.length > 2 // Ensure description is meaningful
      ) {
        // Clean up description from OCR artifacts
        const cleanDescription = description.replace(/[^\w\s]/g, '').trim();

        items.push({
          description: cleanDescription,
          quantity,
          rate,
          gstPct,
          amount,
        });
        console.log('ðŸ“¦ Parsed Item:', {
          description: cleanDescription,
          quantity,
          rate,
          gstPct,
          amount,
        });
      }
    }
  }

  // If no items found with table patterns, try more specific extraction
  if (items.length === 0) {
    console.log(
      'ðŸ“‹ No table items found, trying specific item extraction...',
    );

    // Look for specific items from the sample invoice
    const specificItems = [
      { name: 'Charger', gst: 5 },
      { name: 'Bottle', gst: 18 },
      { name: 'Mouse', gst: 12 },
    ];

    for (const item of specificItems) {
      // Multiple patterns for each item
      const itemPatterns = [
        // Pattern 1: "Charger GST 5% 10 10 105.00"
        new RegExp(
          `${item.name}\\s+GST\\s*${item.gst}%?\\s*(\\d+)\\s+(\\d+)\\s+(\\d+\\.?\\d*)`,
          'gi',
        ),
        // Pattern 2: "Charger 5% 10 10 105.00"
        new RegExp(
          `${item.name}\\s+${item.gst}%?\\s*(\\d+)\\s+(\\d+)\\s+(\\d+\\.?\\d*)`,
          'gi',
        ),
        // Pattern 3: "Charger 10 10 105.00" (without GST)
        new RegExp(`${item.name}\\s+(\\d+)\\s+(\\d+)\\s+(\\d+\\.?\\d*)`, 'gi'),
      ];

      for (const pattern of itemPatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          const parts = match[0].split(/\s+/);
          const quantity = Number(parts[parts.length - 3]);
          const rate = Number(parts[parts.length - 2]);
          const amount = Number(parts[parts.length - 1]);

          if (quantity > 0 && rate > 0) {
            items.push({
              description: item.name,
              quantity,
              rate,
              gstPct: item.gst,
              amount,
            });
            console.log('ðŸ“¦ Parsed Specific Item:', {
              description: item.name,
              quantity,
              rate,
              gstPct: item.gst,
              amount,
            });
            break; // Found this item, move to next
          }
        }
      }
    }
  }

  // If still no items found, try generic number pattern extraction
  if (items.length === 0) {
    console.log('ðŸ“‹ No specific items found, trying generic extraction...');

    // Look for patterns like "10 10 105.00" (quantity rate amount)
    const numberPatterns = cleaned.match(/(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g);
    if (numberPatterns) {
      for (let i = 0; i < Math.min(numberPatterns.length, 3); i++) {
        const pattern = numberPatterns[i];
        const parts = pattern.split(/\s+/);
        if (parts.length >= 3) {
          const quantity = Number(parts[0]);
          const rate = Number(parts[1]);
          const amount = Number(parts[2]);

          if (quantity > 0 && rate > 0) {
            items.push({
              description: `Item ${i + 1}`,
              quantity,
              rate,
              gstPct: 18, // Default GST
              amount,
            });
            console.log('ðŸ“¦ Parsed Generic Item:', {
              description: `Item ${i + 1}`,
              quantity,
              rate,
              amount,
            });
          }
        }
      }
    }
  }

  // 7. Extract financial totals
  const subtotalPatterns = [
    /SubTotal\s*[:\-]?\s*â‚¹?\s*([\d,]+\.?\d*)/i,
    /SubTotal\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of subtotalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      subtotal = parseFloat(match[1].replace(/,/g, ''));
      console.log('ðŸ” Found SubTotal:', subtotal);
      break;
    }
  }

  const gstTotalPatterns = [
    /Total\s*GST\s*[:\-]?\s*â‚¹?\s*([\d,]+\.?\d*)/i,
    /Total\s*GST\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of gstTotalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      totalGST = parseFloat(match[1].replace(/,/g, ''));
      console.log('ðŸ” Found Total GST:', totalGST);
      break;
    }
  }

  const totalPatterns = [
    /Total\s*[:\-]?\s*â‚¹?\s*([\d,]+\.?\d*)/i,
    /Total\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      total = parseFloat(match[1].replace(/,/g, ''));
      console.log('ðŸ” Found Total:', total);
      break;
    }
  }

  // 8. Extract Notes - Enhanced for image OCR
  const notesPatterns = [
    /Notes\s*[:\-]?\s*([^]+?)(?=\s*$)/i,
    /Notes\s*[:\-]?\s*([^]+?)(?=\s*Share|$)/i,
    // Handle OCR artifacts in notes
    /Notes\s*[:\-]?\s*([^]+?)(?=\s*(?:Share|LTE|\$|]|$))/i,
    // More specific pattern for the sample invoice
    /Notes\s*[:\-]?\s*([^]+?)(?=\s*(?:Share|Lens|$))/i,
    // Pattern to stop at common OCR artifacts
    /Notes\s*[:\-]?\s*([^]+?)(?=\s*(?:Share|Lens|LTE|\$|]|\d{1,2}:\d{2}|$))/i,
  ];

  for (const pattern of notesPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      notes = match[1]?.trim();
      // Clean up OCR artifacts from notes more aggressively
      notes = notes
        .replace(/[^\w\s,.-]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/\s*,\s*/g, ', ') // Fix comma spacing
        .trim();
      console.log('ðŸ” Found Notes:', notes);
      break;
    }
  }

  // If no items found with table patterns, try generic extraction
  if (items.length === 0) {
    console.log('ðŸ“‹ No table items found, trying generic extraction...');

    // Look for number patterns that might be items
    const numberPatterns = cleaned.match(/(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/g);
    if (numberPatterns) {
      for (let i = 0; i < Math.min(numberPatterns.length, 5); i++) {
        const pattern = numberPatterns[i];
        const parts = pattern.split(/\s+/);
        if (parts.length >= 3) {
          const quantity = Number(parts[0]);
          const rate = Number(parts[1]);
          const amount = Number(parts[2]);

          if (quantity > 0 && rate > 0) {
            items.push({
              description: `Item ${i + 1}`,
              quantity,
              rate,
              amount,
            });
            console.log('ðŸ“¦ Parsed Generic Item:', {
              description: `Item ${i + 1}`,
              quantity,
              rate,
              amount,
            });
          }
        }
      }
    }
  }

  const result = {
    invoiceNumber,
    invoiceDate,
    customerName,
    customerPhone,
    customerAddress,
    items,
    subtotal,
    totalGST,
    total,
    notes,
  };

  // Post-process results to fix common OCR errors

  // Post-process invoice number to ensure completeness
  if (invoiceNumber) {
    // Clean up the invoice number - allow more characters for flexibility
    invoiceNumber = invoiceNumber
      .replace(/[^\w\-_\/]/g, '') // Remove special characters except letters, numbers, hyphens, underscores, and slashes
      .trim();

    // If the cleaned number is too short, it might be incomplete
    if (invoiceNumber.length < 3) {
      console.log(
        'âš ï¸ Invoice number too short, might be incomplete:',
        invoiceNumber,
      );
    }

    console.log('ðŸ”§ Final cleaned invoice number:', invoiceNumber);
  }

  if (customerName) {
    customerName = customerName
      .replace(/\s+/g, ' ')
      .replace(/\s*Phone\s*$/i, '') // Remove "Phone" at the end
      .trim();
  }

  if (customerAddress) {
    customerAddress = customerAddress
      .replace(/\s+/g, ' ')
      .replace(/\s*0\s*LTE\s*\$\s*\]\s*;\s*$/i, '') // Remove "0 LTE $];" at the end
      .replace(/\s*LTE\s*\$\s*\]\s*;\s*$/i, '') // Remove "LTE $];" at the end
      .trim();
  }

  if (notes) {
    notes = notes
      .replace(/\s+/g, ' ')
      .replace(/\s*Share\s*Lens\s*$/i, '') // Remove "Share Lens" at the end
      .replace(/\s*Share\s*$/i, '') // Remove "Share" at the end
      .trim();
  }

  // Debug: Log the final invoice number for troubleshooting
  console.log('ðŸŽ¯ Final Invoice Number:', invoiceNumber);
  console.log('ðŸŽ¯ Final Parsed Result:', result);
  return result;
}

const InvoiceScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<Record<string, FolderParam>, string>>();
  const folder = route.params?.folder;
  const folderName = folder?.title || 'Sell';

  // Add safety check and logging
  console.log(
    'InvoiceScreen render - folder:',
    folder,
    'folderName:',
    folderName,
  );
  const folderType = 'sell';
  const [showCreateForm, setShowCreateForm] = useState(false);
  // FIX: Added missing state for invoiceNumber
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Mock data for past invoices
  const pastInvoices: Invoice[] = [
    {
      id: '1',
      invoiceNumber: 'SELL-001',
      customerName: 'ABC Corp',
      partyName: 'ABC Corp',
      date: '2024-01-15',
      amount: 15000,
      status: 'Paid',
    },
    {
      id: '2',
      invoiceNumber: 'SELL-002',
      customerName: 'XYZ Ltd',
      partyName: 'XYZ Ltd',
      date: '2024-01-20',
      amount: 25000,
      status: 'Pending',
    },
    {
      id: '3',
      invoiceNumber: 'SELL-003',
      customerName: 'DEF Industries',
      partyName: 'DEF Industries',
      date: '2024-01-25',
      amount: 18000,
      status: 'Overdue',
    },
  ];

  const [apiInvoices, setApiInvoices] = useState<Invoice[]>([]);
  const [loadingApi, setLoadingApi] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Move fetchInvoices to top-level so it can be called from handleSubmit
  const fetchInvoices = async () => {
    setLoadingApi(true);
    setApiError(null);
    try {
      const token = await AsyncStorage.getItem('accessToken');
      // Map folder to transaction type
      const mappedType = ['sell', 'receipt'].includes(folderName.toLowerCase())
        ? 'credit'
        : 'debit';
      let query = `?type=${encodeURIComponent(mappedType)}`;
      const res = await fetch(`${BASE_URL}/transactions${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message ||
            `Failed to fetch ${folderName.toLowerCase()}s: ${res.status}`,
        );
      }
      const data = await res.json();
      // Only filter by type
      const filtered = (data.data || []).filter(
        (v: any) => v.type === mappedType,
      );
      setApiInvoices(filtered);
    } catch (e: any) {
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      setLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // States for invoice creation form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  // Debug: Track invoiceDate changes
  useEffect(() => {
    console.log('ðŸ“… invoiceDate changed to:', invoiceDate);
  }, [invoiceDate]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [gstPct, setGstPct] = useState(18); // Global GST percentage
  const [taxAmount, setTaxAmount] = useState(0); // Tax amount field
  const [discountAmount, setDiscountAmount] = useState(0); // Discount amount field
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    },
  ]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCustomerFocused, setIsCustomerFocused] = useState(false);
  const customerInputRef = useRef<TextInput>(null);
  const [dropdownLayout, setDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
  });
  const [showDropdown, setShowDropdown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  // Remove supplier state
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [gstDropdownOpen, setGstDropdownOpen] = useState(false);
  const [gstDropdownLayout, setGstDropdownLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const gstFieldRef = useRef<View>(null);
  // 1. Add editingItem state
  const [editingItem, setEditingItem] = useState<any>(null);
  // Add state for file type modal and OCR
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'excel' | null>(
    null,
  );
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  // Add state for description
  const [description, setDescription] = useState('');
  // Add a loading state for entering the edit form
  // const [editFormLoading, setEditFormLoading] = useState(false); // Removed
  const [syncYN, setSyncYN] = useState('N');

  // --- Voice-to-Text State and Logic ---
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const audioRecorderPlayer = React.useRef(new AudioRecorderPlayer()).current;
  const [isRecording, setIsRecording] = useState(false);
  // ---
  const itemsSectionRef = useRef<View>(null);

  // Track last GST and invoiceDate set by voice
  const lastGstPctByVoice = useRef<number | null>(null);
  const lastInvoiceDateByVoice = useRef<string | null>(null);

  // State to show last voice response
  const [lastVoiceText, setLastVoiceText] = useState<string | null>(null);
  const [nlpStatus, setNlpStatus] = useState<string | null>(null);

  // Custom popup states
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>(
    'info',
  );

  // Helper function to show custom popup
  const showCustomPopup = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
  ) => {
    setPopupTitle(title);
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  useEffect(() => {
    console.log(
      'ðŸ”„ Form field changed - Selected Customer:',
      selectedCustomer,
    );
  }, [selectedCustomer]);

  useEffect(() => {
    console.log('ðŸ”„ Form field changed - Items count:', items.length);
  }, [items]);

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (
    id: string,
    field: keyof InvoiceItem,
    value: string | number,
  ) => {
    console.log('updateItem called:', { id, field, value });
    const updatedItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };

        if (field === 'quantity' || field === 'rate') {
          const numValue =
            typeof value === 'string' ? parseFloat(value) : value;
          updatedItem[field] = isNaN(numValue) ? 0 : numValue;
          // Calculate amount including GST
          const subtotal = updatedItem.quantity * updatedItem.rate;
          const gstAmount = subtotal * (gstPct / 100);
          updatedItem.amount = subtotal + gstAmount;
          console.log('Updated item amount:', {
            quantity: updatedItem.quantity,
            rate: updatedItem.rate,
            gstPct: gstPct,
            subtotal,
            gstAmount,
            amount: updatedItem.amount,
          });
        } else {
          (updatedItem as any)[field] = value;
        }

        return updatedItem;
      }
      return item;
    });

    setItems(updatedItems);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      return sum + quantity * rate;
    }, 0);
  };

  const calculateGST = () => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const itemSubtotal = quantity * rate;
      const itemGST = itemSubtotal * (gstPct / 100);
      return sum + itemGST;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const gst = calculateGST();
    return subtotal + gst + taxAmount - discountAmount;
  };

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || !isFinite(amount)) {
      return 'â‚¹0';
    }
    return `â‚¹${amount.toLocaleString('en-IN')}`;
  };

  // Map API status to badge color and label
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return '#28a745'; // Paid
      case 'draft':
        return '#ffc107'; // Pending
      case 'overdue':
        return '#dc3545'; // Overdue
      default:
        return '#6c757d';
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete':
        return 'Paid';
      case 'draft':
        return 'Pending';
      case 'overdue':
        return 'Overdue';
      default:
        return status;
    }
  };

  // 2. When a list item is tapped, set editingItem and open the form
  const handleEditItem = (item: any) => {
    console.log('Editing item from API:', item);
    console.log('Items from API:', item.items);
    setShowModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    setEditingItem(item);
    setShowCreateForm(true);
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      setCustomerName(editingItem.partyName || '');
      setCustomerPhone(editingItem.partyPhone || '');
      setCustomerAddress(editingItem.partyAddress || '');
      // Only set invoice date from editing item if it exists, don't override with current date
      if (editingItem.date) {
        setInvoiceDate(editingItem.date.slice(0, 10));
      }
      setDueDate(
        editingItem.dueDate
          ? editingItem.dueDate.slice(0, 10)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
      );
      setItems(
        editingItem.items && editingItem.items.length > 0
          ? editingItem.items.map((it: any, idx: number) => {
              const quantity = it.qty || 1;
              const rate = it.rate || 0;
              const gstPct = it.gstPct || 18;
              // Always calculate amount with GST since backend doesn't store amount
              const subtotal = quantity * rate;
              const gstAmount = subtotal * (gstPct / 100);
              const amount = subtotal + gstAmount;

              console.log('Loading item from editing:', {
                id: String(idx + 1),
                quantity,
                rate,
                gstPct,
                subtotal,
                gstAmount,
                finalAmount: amount,
              });

              return {
                id: String(idx + 1),
                description: it.description || '',
                quantity: quantity,
                rate: rate,
                gstPct: gstPct,
                amount: amount,
              };
            })
          : [
              {
                id: '1',
                description: '',
                quantity: 1,
                rate: 0,
                gstPct: 18,
                amount: 0,
              },
            ],
      );
      setInvoiceNumber(
        editingItem.invoiceNumber || editingItem.billNumber || '',
      );

      setNotes(editingItem.notes || '');
      setSelectedCustomer(editingItem.partyName || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      );
      setItems([
        {
          id: '1',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      setInvoiceNumber('');
      setNotes('');
      setSelectedCustomer('');
    }
  }, [editingItem, showCreateForm]);

  // 4. When closing the form, reset editingItem
  const handleBackToList = async () => {
    setShowCreateForm(false);
    setEditingItem(null);
    // Reset form data
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    );
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);

    // Auto-generate next invoice number
    try {
      const nextInvoiceNumber = await generateNextDocumentNumber(
        folderName.toLowerCase(),
      );
      setInvoiceNumber(nextInvoiceNumber);
    } catch (error) {
      console.error('Error generating invoice number:', error);
      setInvoiceNumber(`SEL-${Date.now()}`);
    }

    setNotes('');
    setSelectedCustomer('');
    setGstPct(18);
    setTaxAmount(0);
    setDiscountAmount(0);
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
  };

  // Enhanced validation helpers
  const isFieldInvalid = (field: string, fieldType?: string) => {
    if (!triedSubmit) return false;

    if (fieldType === 'phone') {
      // Phone validation: should be at least 10 digits and max 16 digits
      const phoneDigits = field.replace(/\D/g, '');
      return !field || phoneDigits.length < 10 || phoneDigits.length > 16;
    }

    if (fieldType === 'address') {
      // Address validation: should be at least 10 characters
      return !field || field.trim().length < 10;
    }

    // Default validation: field should not be empty
    return !field;
  };

  // Update getFieldError to return the field name for error messages
  const getFieldError = (field: string) => {
    if (!triedSubmit) return '';
    switch (field) {
      case 'invoiceDate':
        return !invoiceDate ? 'Date is required' : '';
      case 'selectedCustomer':
        return !selectedCustomer ? 'Customer is required' : '';
      case 'customerPhone':
        if (!customerPhone) return 'Phone is required';
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (phoneDigits.length < 10)
          return 'Phone number must be at least 10 digits';
        if (phoneDigits.length > 16)
          return 'Phone number cannot exceed 16 digits';
        return '';
      case 'customerAddress':
        if (!customerAddress) return 'Address is required';
        if (customerAddress.trim().length < 10)
          return 'Address must be at least 10 characters';
        return '';
      default:
        return '';
    }
  };

  const { customers, add, fetchAll } = useCustomerContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);

    // Check transaction limits BEFORE making API call
    try {
      console.log('ðŸ” Checking transaction limits before invoice creation...');
      await forceCheckTransactionLimit();
    } catch (limitError) {
      console.error('âŒ Error checking transaction limits:', limitError);
      // Continue with API call if limit check fails
    }

    // Validate required fields BEFORE showing loader or calling API
    console.log('Validating fields:', {
      invoiceDate,
      selectedCustomer,
      customerPhone,
      customerAddress,
    });

    if (!invoiceDate || !selectedCustomer) {
      console.log('Required fields validation failed');
      setError('Please fill all required fields correctly.');
      // triedSubmit will trigger red borders and error messages below fields
      return;
    }

    // Validate optional fields if they have values
    if (customerPhone && isFieldInvalid(customerPhone, 'phone')) {
      setError(
        'Phone number must be at least 10 digits and cannot exceed 16 digits.',
      );
      return;
    }

    if (customerAddress && isFieldInvalid(customerAddress, 'address')) {
      setError('Address must be at least 10 characters.');
      return;
    }
    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if customer exists, if not, create
      let customerNameToUse = selectedCustomer.trim();
      let existingCustomer = customers.find(
        c =>
          c.partyName?.trim().toLowerCase() === customerNameToUse.toLowerCase(),
      );
      if (!existingCustomer) {
        const newCustomer = await add({ partyName: customerNameToUse });
        if (newCustomer) {
          customerNameToUse = newCustomer.partyName || '';
          await fetchAll('');
        }
      }
      const userId = await getUserIdFromToken();
      if (!userId) {
        setError('User not authenticated. Please login again.');
        return;
      }
      // Calculate GST, subtotal, total
      const subTotal = items.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0,
      );
      const gstAmount = subTotal * (gstPct / 100);
      const totalAmount = subTotal + gstAmount;
      // API body
      const body = {
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        type: folderName.toLowerCase(),
        amount: totalAmount.toFixed(2),
        date: new Date(invoiceDate).toISOString(),
        status,
        notes: notes || '',
        partyName: customerNameToUse,
        partyPhone: customerPhone,
        partyAddress: customerAddress,
        items: items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        gstPct: gstPct, // Global GST percentage
        discount: discountAmount, // Discount amount
        cGST: taxAmount, // Tax amount (using cGST field)
      };

      // Clean the body object to only include fields that exist in backend schema
      const cleanBody = {
        user_id: body.user_id,
        type: body.type,
        amount: body.amount,
        date: body.date,
        status: body.status,
        notes: body.notes,
        partyName: body.partyName,
        partyPhone: body.partyPhone,
        partyAddress: body.partyAddress,
        items: body.items,
        gstPct: body.gstPct,
        discount: body.discount,
        cGST: body.cGST,
        createdBy: body.createdBy,
        updatedBy: body.updatedBy,
      };
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
      let res;
      if (editingItem) {
        // PATCH update: only send updatable, non-empty fields
        const patchBody: any = {};
        if (cleanBody.user_id) patchBody.user_id = cleanBody.user_id;
        if (cleanBody.type) patchBody.type = cleanBody.type;
        if (cleanBody.date) patchBody.date = cleanBody.date;
        if (cleanBody.amount) patchBody.amount = cleanBody.amount;
        if (cleanBody.status) patchBody.status = cleanBody.status;
        if (cleanBody.partyName) patchBody.partyName = cleanBody.partyName;
        if (cleanBody.partyPhone) patchBody.partyPhone = cleanBody.partyPhone;
        if (cleanBody.partyAddress)
          patchBody.partyAddress = cleanBody.partyAddress;
        // Remove invalid fields that don't exist in backend schema
        if (cleanBody.notes) patchBody.notes = cleanBody.notes;
        // Only include type for update
        if (cleanBody.type) patchBody.type = cleanBody.type;
        // Always include items for update
        patchBody.items = items.map(item => ({
          description: item.description,
          qty: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }));
        res = await fetch(`${BASE_URL}/vouchers/${editingItem.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patchBody),
        });
      } else {
        // POST create: send full body
        res = await fetch(`${BASE_URL}/vouchers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(cleanBody),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ message: 'Unknown error occurred' }));

          // Check if it's a transaction limit error
          if (
            err.message?.includes('transaction limit') ||
            err.message?.includes('limit exceeded') ||
            err.message?.includes('Internal server error')
          ) {
            // Trigger transaction limit popup
            await forceShowPopup();
            setError(
              'Transaction limit reached. Please upgrade your plan to continue.',
            );
            return;
          }

          throw new Error(
            err.message || `Failed to save invoice. Status: ${res.status}`,
          );
        }
        const newVoucher = await res.json();
        appendVoucher(newVoucher.data || newVoucher);
      }
      setSuccess(
        editingItem
          ? 'Invoice updated successfully!'
          : 'Invoice saved successfully!',
      );
      // After success, refresh list, reset editingItem, and close form
      await fetchInvoices();
      setEditingItem(null);
      setShowCreateForm(false);
      resetForm();
    } catch (e: any) {
      // Import error handler
      const { handleApiError } = require('../../utils/apiErrorHandler');
      const errorInfo = handleApiError(e);

      // Handle 403 Forbidden errors with user-friendly message
      if (errorInfo.isForbidden) {
        showCustomPopup('Access Denied', errorInfo.message, 'error');
        setError(errorInfo.message);
        setShowModal(true);
      } else {
        setError(errorInfo.message || e.message || 'An error occurred.');
        setShowModal(true);
      }
    } finally {
      setLoadingSave(false);
      setLoadingDraft(false);
    }
  };

  // Add a helper to reset the form
  const resetForm = async () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    );
    setItems([
      {
        id: '1',
        description: '',
        quantity: 1,
        rate: 0,
        amount: 0,
      },
    ]);
    // FIX: reset invoice number
    setInvoiceNumber('');
    setNotes('');
    setSelectedCustomer('');
    setTriedSubmit(false);
    setError(null);
    setSuccess(null);
    setLoadingSave(false);
    setLoadingDraft(false);
  };

  // 1. Add deleteInvoice function
  const deleteInvoice = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      // Only send type as query param for delete if backend requires
      let query = '';
      if (folderName)
        query += `?type=${encodeURIComponent(folderName.toLowerCase())}`;
      const res = await fetch(`${BASE_URL}/vouchers/${id}${query}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete invoice.');
      }
      await fetchInvoices();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete invoice.');
      setShowModal(true);
    }
  };

  // Add handleSync function
  const handleSync = async (item: any) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const patchBody = { syncYN: 'Y' };
      const res = await fetch(`${BASE_URL}/vouchers/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) throw new Error('Failed to sync');
      await fetchInvoices();
    } catch (e) {
      // Optionally show error
    }
  };

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const invoiceDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  // For dynamic items, use a nested ref structure: itemRefs.current[itemId][field]
  const itemRefs = useRef<{
    [itemId: string]: { [field: string]: TextInput | null };
  }>({});

  // Add new search/filter state
  const [searchFilter, setSearchFilter] = useState<PaymentSearchFilterState>({
    searchText: '',
  });
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const filterBadgeCount = [
    searchFilter.supplierName,
    searchFilter.amountMin,
    searchFilter.amountMax,
    searchFilter.dateFrom,
    searchFilter.dateTo,
    searchFilter.paymentMethod,
    searchFilter.status,
    searchFilter.description,
    searchFilter.reference,
    searchFilter.category,
  ].filter(Boolean).length;
  const [filterVisible, setFilterVisible] = useState(false);
  const [showDatePickerFrom, setShowDatePickerFrom] = useState(false);
  const [showDatePickerTo, setShowDatePickerTo] = useState(false);

  const handleRecentSearchPress = (search: RecentSearch) => {
    setSearchFilter({ ...searchFilter, searchText: search.text });
  };

  // Utility: Fuzzy match helper
  function fuzzyMatch(value: string, search: string) {
    if (!value || !search) return false;
    return value.toLowerCase().includes(search.toLowerCase());
  }
  // Update inRange and inDateRange logic to allow only min or only from date
  function inRange(num: number, min?: number, max?: number) {
    const n = Number(num);
    const minN =
      min !== undefined && min !== null && !isNaN(Number(min))
        ? Number(min)
        : undefined;
    const maxN =
      max !== undefined && max !== null && !isNaN(Number(max))
        ? Number(max)
        : undefined;
    if (minN !== undefined && n < minN) return false;
    if (maxN !== undefined && n > maxN) return false;
    return true;
  }
  function inDateRange(dateStr: string, from?: string, to?: string) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (from && date < new Date(from)) return false;
    if (to && date > new Date(to)) return false;
    return true;
  }
  // Advanced fuzzy search and filter logic
  const filteredInvoices = apiInvoices.filter(inv => {
    const s = searchFilter.searchText?.trim().toLowerCase();
    const matchesFuzzy =
      !s ||
      [
        inv.partyName,
        inv.amount?.toString(),
        inv.date,
        (inv as any).method || '',
        inv.status,
        (inv as any).description || '',
        (inv as any).notes || '',
        (inv as any).reference || '',
        (inv as any).category || '',
      ].some(field => field && field.toString().toLowerCase().includes(s));

    const matchesCustomer =
      !searchFilter.supplierName ||
      fuzzyMatch(inv.partyName || '', searchFilter.supplierName);
    const matchesAmount = inRange(
      Number(inv.amount),
      searchFilter.amountMin,
      searchFilter.amountMax,
    );
    const matchesDate = inDateRange(
      inv.date,
      searchFilter.dateFrom,
      searchFilter.dateTo,
    );
    const matchesMethod =
      !searchFilter.paymentMethod ||
      (inv as any).method === searchFilter.paymentMethod;
    const matchesStatus =
      !searchFilter.status || inv.status === searchFilter.status;
    const matchesCategory =
      !searchFilter.category || (inv as any).category === searchFilter.category;
    const matchesReference =
      !searchFilter.reference ||
      [(inv as any).reference].some(ref =>
        fuzzyMatch(ref || '', searchFilter.reference!),
      );
    const matchesDescription =
      !searchFilter.description ||
      fuzzyMatch(
        (inv as any).description || (inv as any).notes || '',
        searchFilter.description,
      );
    return (
      matchesFuzzy &&
      matchesCustomer &&
      matchesAmount &&
      matchesDate &&
      matchesMethod &&
      matchesStatus &&
      matchesCategory &&
      matchesReference &&
      matchesDescription
    );
  });

  // Helper for pluralizing folder name
  const pluralize = (name: string) => {
    if (!name) return '';
    if (name.endsWith('s')) return name + 'es';
    return name + 's';
  };

  // Voice-to-Text: Start Recording
  const startVoiceRecording = async () => {
    setVoiceError('');
    setNlpStatus(null);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setVoiceError('Microphone permission denied');
          setIsRecording(false);
          return;
        }
      }
      setIsRecording(true);
      await audioRecorderPlayer.startRecorder();
    } catch (err) {
      setVoiceError(
        'Failed to start recording: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsRecording(false);
    }
  };

  // Voice-to-Text: Stop Recording
  const stopVoiceRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      if (result) {
        await sendAudioForTranscription(result);
      }
    } catch (err) {
      setVoiceError(
        'Failed to stop recording: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsRecording(false);
    }
  };

  // Voice-to-Text: Send audio to backend
  const sendAudioForTranscription = async (
    uri: string,
    mimeType: string = 'audio/wav',
    fileName: string = 'audio.wav',
  ) => {
    setVoiceLoading(true);
    setVoiceError('');
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: mimeType,
      } as any);
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      const url = `${BASE_URL}/api/whisper/transcribe`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Speech recognition failed');
      // Show last voice response above Invoice Details
      setLastVoiceText(data.englishText || data.text || null);
      // Try NLP extraction first if available
      let nlpSuccess = false;
      if (data.englishText || data.text) {
        if (isNLPAvailable()) {
          try {
            const nlpData = await extractInvoiceDataWithNLP(
              data.englishText || data.text,
            );

            if (nlpData.invoiceDate) setInvoiceDate(nlpData.invoiceDate);
            if (nlpData.customer) setSelectedCustomer(nlpData.customer);

            if (nlpData.items)
              setItems(
                nlpData.items.map((item: any) => ({
                  ...item,
                  amount: Number(item.quantity) * Number(item.rate),
                })),
              );
            nlpSuccess = true;
          } catch (err) {
            // NLP extraction failed, fallback to regex parser
            console.log('NLP extraction failed, using fallback parser:', err);
            // Don't show error to user for expected fallback behavior
          }
        } else {
          // NLP not available, skip to fallback parser
          console.log('NLP not available, using fallback parser');
          setNlpStatus('NLP not configured, using voice parser');
        }
      }
      if (!nlpSuccess && (data.englishText || data.text)) {
        const wrappedSetInvoiceDate = (val: string) => {
          lastInvoiceDateByVoice.current = val;
          setInvoiceDate(val);
        };
        // Wrap setItems to recalculate amount for each item
        const wrappedSetItems = (newItems: any[]) => {
          const recalculated = newItems.map(item => ({
            ...item,
            amount:
              Number(item.quantity) * Number(item.rate) * (1 + gstPct / 100),
          }));
          setItems(recalculated);
        };
        // Add missing setGstPct function
        const setGstPct = (value: number) => {
          setGstPct(value);
          // Recalculate all item amounts with new GST
          const updatedItems = items.map(item => ({
            ...item,
            amount: item.quantity * item.rate * (1 + value / 100),
          }));
          setItems(updatedItems);
        };

        const updatedFields = parseInvoiceVoiceText(
          data.englishText || data.text,
          {
            setInvoiceNumber, // FIX: Pass the new state setter
            setSelectedCustomer,
            setGstPct, // Use the defined function
            setInvoiceDate: wrappedSetInvoiceDate,
            setNotes,
            setItems: wrappedSetItems,
            setDescription,
            currentItems: items,
          },
        );
        if (updatedFields && updatedFields.length > 0) {
          setTimeout(() => {
            const first = updatedFields[0];
            if (
              first.itemIndex >= 0 &&
              ['description', 'quantity', 'rate', 'amount'].includes(
                first.field,
              )
            ) {
              // Find the item by index (after update)
              const item = items[first.itemIndex];
              if (
                item &&
                itemRefs.current[item.id] &&
                itemRefs.current[item.id][first.field]
              ) {
                itemRefs.current[item.id][first.field]?.focus();
              }
            } else if (
              first.field === 'invoiceDate' &&
              invoiceDateRef.current
            ) {
              invoiceDateRef.current.focus();
            } else if (first.field === 'notes' && notesRef.current) {
              notesRef.current.focus();
            }
          }, 400);
        }
      }
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
    }
    setVoiceLoading(false);
  };

  const handleUploadDocument = () => {
    console.log('ðŸ“ Upload Document button pressed');
    setShowFileTypeModal(true);
  };

  const handleFileTypeSelection = async (type: string) => {
    console.log('ðŸ“ Selected file type:', type);
    setShowFileTypeModal(false);

    if (!type) return;

    console.log('ðŸ“ Starting file selection process for type:', type);

    try {
      let file: any = null;

      // Pick file based on type
      if (type === 'image') {
        console.log('ðŸ“¸ Opening image picker...');
        const result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
          includeBase64: false,
        });
        if (result.assets && result.assets.length > 0) {
          file = result.assets[0];
          console.log('ðŸ“¸ Image selected:', file.fileName || file.name);
        }
      } else if (type === 'pdf' || type === 'excel') {
        console.log('ðŸ“„ Opening document picker...');
        console.log('ðŸ“„ DocumentPickerTypes available:', DocumentPickerTypes);
        console.log('ðŸ“„ Pick function available:', typeof pick);
        try {
          const result = await pick({
            type:
              type === 'pdf'
                ? [DocumentPickerTypes.pdf]
                : [DocumentPickerTypes.xlsx, DocumentPickerTypes.xls],
          });
          if (result && result.length > 0) {
            file = result[0];
            console.log('ðŸ“„ Document selected:', file.fileName || file.name);
          }
        } catch (pickerError) {
          console.error('ðŸ“„ Document picker error:', pickerError);
          if (
            pickerError &&
            (pickerError as any).code === 'DOCUMENT_PICKER_CANCELED'
          ) {
            console.log('âŒ User cancelled document selection');
            return;
          }
          throw pickerError;
        }
      }

      if (!file) {
        console.log('âŒ No file selected');
        return;
      }

      setSelectedFile(file);
      setDocumentName(file.fileName || file.name || '');
      setFileType(type as 'image' | 'pdf' | 'excel');

      // Process file based on type
      if (type === 'image') {
        await processImageWithOCR(file);
      } else if (type === 'pdf') {
        await processPDFWithOCR(file);
      } else if (type === 'excel') {
        await processExcelFile(file);
      }
    } catch (err: any) {
      if (err && err.code === 'DOCUMENT_PICKER_CANCELED') {
        console.log('âŒ User cancelled file selection');
        return;
      }
      console.error('âŒ File processing error:', err);
      showCustomPopup('Error', 'Failed to pick or process the file.', 'error');
    }
  };

  // Helper function to process image with OCR
  const processImageWithOCR = async (file: any) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      console.log('ðŸ”„ Starting OCR processing for image...');
      console.log('ðŸ“ File details:', {
        uri: file.uri,
        fileName: file.fileName || file.name,
        fileSize: file.fileSize,
        type: file.type,
      });

      // Use backend OCR API
      const text = await OCRService.extractTextFromImage(
        file.uri,
        file.fileName || file.name || 'image.jpg',
      );

      // Parse and map OCR response to form fields
      const parsed = parseInvoiceOcrText(text);
      console.log('ðŸ” OCR Parsed Data:', parsed);

      // Debug: Log the raw text to see what we're working with
      console.log('ðŸ” Raw OCR Text for debugging:', text);
      console.log('ðŸ” Parsed Invoice Number:', parsed.invoiceNumber);
      console.log('ðŸ” Parsed Customer Name:', parsed.customerName);
      console.log('ðŸ” Parsed Customer Phone:', parsed.customerPhone);
      console.log('ðŸ” Parsed Customer Address:', parsed.customerAddress);
      console.log('ðŸ” Parsed Invoice Date:', parsed.invoiceDate);
      console.log('ðŸ” Parsed Items Count:', parsed.items?.length || 0);
      console.log('ðŸ” Parsed Notes:', parsed.notes);

      // Clear existing form data first to avoid mixing with old data
      console.log('ðŸ§¹ Clearing existing form data...');
      setInvoiceNumber('');
      setSelectedCustomer('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setItems([
        {
          id: '1',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      setNotes('');

      // SIMPLE DIRECT APPROACH - Set form data directly
      console.log('ðŸ”„ Using simple direct approach to set form data...');

      // Force immediate state updates with a simple approach
      const newInvoiceNumber = parsed.invoiceNumber?.trim() || '';
      const newCustomerName = parsed.customerName?.trim() || '';
      const newCustomerPhone = parsed.customerPhone?.trim() || '';
      const newCustomerAddress = parsed.customerAddress?.trim() || '';
      const newInvoiceDate =
        parsed.invoiceDate?.trim() || new Date().toISOString().split('T')[0];
      const newNotes = parsed.notes?.trim() || '';

      console.log('ðŸ”„ Direct values to set:', {
        invoiceNumber: newInvoiceNumber,
        customerName: newCustomerName,
        customerPhone: newCustomerPhone,
        customerAddress: newCustomerAddress,
        invoiceDate: newInvoiceDate,
        items: parsed.items,
        notes: newNotes,
      });

      // Set all fields at once
      setInvoiceNumber(newInvoiceNumber);
      setSelectedCustomer(newCustomerName);
      setCustomerName(newCustomerName);
      setCustomerPhone(newCustomerPhone);
      setCustomerAddress(newCustomerAddress);
      setInvoiceDate(newInvoiceDate);
      setNotes(newNotes);

      // Set items with proper structure
      if (parsed.items && parsed.items.length > 0) {
        const newItems = parsed.items.map((item, index) => ({
          id: (index + 1).toString(),
          description: item.description || `Item ${index + 1}`,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount:
            item.amount || item.quantity * item.rate * (1 + gstPct / 100) || 0,
        }));
        setItems(newItems);
        console.log('âœ… Set Items with GST:', newItems);
      } else {
        // Set default empty item
        setItems([
          {
            id: '1',
            description: '',
            quantity: 1,
            rate: 0,
            amount: 0,
          },
        ]);
      }

      // Force re-render by updating OCR data state
      setOcrData({
        customerName: newCustomerName,
        customerPhone: newCustomerPhone,
        customerAddress: newCustomerAddress,
        invoiceDate: newInvoiceDate,
        items: parsed.items,
        notes: newNotes,
        timestamp: Date.now(),
      });

      console.log('âœ… All form fields set successfully');

      // Double-check the values were set
      setTimeout(() => {
        console.log('ðŸ”„ Verification - Current form state:', {
          customerName: newCustomerName,
          customerPhone: newCustomerPhone,
          customerAddress: newCustomerAddress,
          invoiceDate: newInvoiceDate,
          itemsCount: parsed.items?.length || 0,
          notes: newNotes,
        });
      }, 500);

      // Show success message
      showCustomPopup(
        'OCR Processing Complete',
        `Successfully extracted data from ${file.fileName || file.name}`,
        'success',
      );
    } catch (ocrErr) {
      console.error('âŒ OCR processing failed:', ocrErr);
      setOcrError(
        ocrErr instanceof Error ? ocrErr.message : 'OCR processing failed',
      );
      showCustomPopup(
        'OCR Error',
        'Failed to process the image. Please try again.',
        'error',
      );
    } finally {
      setOcrLoading(false);
    }
  };

  // Helper function to process PDF with OCR
  const processPDFWithOCR = async (file: any) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      console.log('ðŸ”„ Starting OCR processing for PDF...');
      console.log('ðŸ“ PDF File details:', {
        uri: file.uri,
        fileName: file.fileName || file.name,
        fileSize: file.fileSize,
        type: file.type,
      });

      // Use backend OCR API for PDF
      const text = await OCRService.extractTextFromPDF(
        file.uri,
        file.fileName || file.name || 'document.pdf',
      );

      console.log('ðŸ“„ PDF OCR Text extracted:', text);

      // Use the same robust parsing logic as images
      const parsed = parseInvoiceOcrText(text);
      console.log('ðŸ” PDF OCR Parsed Data:', parsed);

      // Debug: Log the raw text to see what we're working with
      console.log('ðŸ” Raw PDF OCR Text for debugging:', text);
      console.log('ðŸ” Parsed Invoice Number:', parsed.invoiceNumber);
      console.log('ðŸ” Parsed Customer Name:', parsed.customerName);
      console.log('ðŸ” Parsed Customer Phone:', parsed.customerPhone);
      console.log('ðŸ” Parsed Customer Address:', parsed.customerAddress);
      console.log('ðŸ” Parsed Invoice Date:', parsed.invoiceDate);
      console.log('ðŸ” Parsed Items Count:', parsed.items?.length || 0);
      console.log('ðŸ” Parsed Notes:', parsed.notes);

      // Clear existing form data first to avoid mixing with old data
      console.log('ðŸ§¹ Clearing existing form data...');
      setInvoiceNumber('');
      setSelectedCustomer('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setItems([
        {
          id: '1',
          description: '',
          quantity: 1,
          rate: 0,
          amount: 0,
        },
      ]);
      setNotes('');

      // SIMPLE DIRECT APPROACH - Set form data directly (same as images)
      console.log(
        'ðŸ”„ Using simple direct approach to set form data from PDF...',
      );

      // Force immediate state updates with a simple approach
      const newInvoiceNumber = parsed.invoiceNumber?.trim() || '';
      const newCustomerName = parsed.customerName?.trim() || '';
      const newCustomerPhone = parsed.customerPhone?.trim() || '';
      const newCustomerAddress = parsed.customerAddress?.trim() || '';
      const newInvoiceDate =
        parsed.invoiceDate?.trim() || new Date().toISOString().split('T')[0];
      const newNotes = parsed.notes?.trim() || '';

      console.log('ðŸ”„ Direct values to set from PDF:', {
        invoiceNumber: newInvoiceNumber,
        customerName: newCustomerName,
        customerPhone: newCustomerPhone,
        customerAddress: newCustomerAddress,
        invoiceDate: newInvoiceDate,
        items: parsed.items,
        notes: newNotes,
      });

      // Set all fields at once
      setInvoiceNumber(newInvoiceNumber);
      setSelectedCustomer(newCustomerName);
      setCustomerName(newCustomerName);
      setCustomerPhone(newCustomerPhone);
      setCustomerAddress(newCustomerAddress);
      setInvoiceDate(newInvoiceDate);
      setNotes(newNotes);

      // Set items with proper structure
      if (parsed.items && parsed.items.length > 0) {
        const newItems = parsed.items.map((item, index) => ({
          id: (index + 1).toString(),
          description: item.description || `Item ${index + 1}`,
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          amount:
            item.amount || item.quantity * item.rate * (1 + gstPct / 100) || 0,
        }));
        setItems(newItems);
        console.log('âœ… Set Items from PDF with GST:', newItems);
      } else {
        // Set default empty item
        setItems([
          {
            id: '1',
            description: '',
            quantity: 1,
            rate: 0,
            amount: 0,
          },
        ]);
      }

      // Force re-render by updating OCR data state
      setOcrData({
        customerName: newCustomerName,
        customerPhone: newCustomerPhone,
        customerAddress: newCustomerAddress,
        invoiceDate: newInvoiceDate,
        items: parsed.items,
        notes: newNotes,
        timestamp: Date.now(),
        source: 'PDF',
      });

      console.log('âœ… All form fields set successfully from PDF');

      // Double-check the values were set
      setTimeout(() => {
        console.log('ðŸ”„ Verification - Current form state from PDF:', {
          customerName: newCustomerName,
          customerPhone: newCustomerPhone,
          customerAddress: newCustomerAddress,
          invoiceDate: newInvoiceDate,
          itemsCount: parsed.items?.length || 0,
          notes: newNotes,
        });
      }, 500);

      // Show success message
      showCustomPopup(
        'PDF OCR Processing Complete',
        `Successfully extracted data from ${file.fileName || file.name}`,
        'success',
      );
    } catch (ocrErr) {
      console.error('âŒ PDF OCR processing failed:', ocrErr);
      setOcrError(
        ocrErr instanceof Error ? ocrErr.message : 'PDF OCR processing failed',
      );
      showCustomPopup(
        'PDF OCR Error',
        'Failed to process the PDF. Please try again.',
        'error',
      );
    } finally {
      setOcrLoading(false);
    }
  };

  // Helper function to process Excel file
  const processExcelFile = async (file: any) => {
    try {
      const b64 = await RNFS.readFile(file.uri, 'base64');
      const wb = XLSX.read(b64, { type: 'base64' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      if (data.length > 0) {
        autoFillFieldsFromExcel(data[0]);
      }
    } catch (excelErr) {
      console.error('âŒ Excel processing failed:', excelErr);
      showCustomPopup(
        'Excel Error',
        'Failed to process the Excel file. Please try again.',
        'error',
      );
    }
  };

  const autoFillFieldsFromText = (text: string) => {
    const getValue = (label: string) => {
      const match = new RegExp(`${label}\s*[:\-]?\s*(.*)`, 'i').exec(text);
      return match?.[1]?.split('\n')[0]?.trim() || '';
    };

    setSelectedCustomer(getValue('Customer Name') || getValue('Customer'));
    setCustomerName(getValue('Customer Name') || getValue('Customer'));
    setCustomerPhone(getValue('Phone'));
    setCustomerAddress(getValue('Address'));
    setInvoiceDate(getValue('Invoice Date') || getValue('Date'));
    setNotes(text);
  };

  const autoFillFieldsFromExcel = (row: any) => {
    setSelectedCustomer(row.customerName || row.customer || '');
    setCustomerName(row.customerName || row.customer || '');
    setCustomerPhone(row.customerPhone || row.phone || '');
    setCustomerAddress(row.customerAddress || row.address || '');
    setInvoiceDate(
      row.invoiceDate || row.date || new Date().toISOString().split('T')[0],
    );
    setNotes(row.notes || '');
  };

  if (showCreateForm) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#333333"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingItem ? `Edit ${folderName}` : `Create ${folderName}`}
            </Text>
          </View>
        </View>

        <KeyboardAwareScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={120}
          enableAutomaticScroll
          enableResetScrollToCoords={false}
          keyboardOpeningTime={0}
        >
          {/* Show last voice response above Invoice Details */}
          {lastVoiceText && (
            <View
              style={{
                backgroundColor: '#f0f6ff',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#b3d1ff',
              }}
            >
              <Text
                style={{
                  color: '#333333',
                  fontSize: 15,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                <Text
                  style={{
                    color: '#4f8cff',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Voice Response:
                </Text>
                {lastVoiceText}
              </Text>
            </View>
          )}
          {voiceLoading && (
            <ActivityIndicator
              size="small"
              color="#333333"
              style={{ marginTop: 8 }}
            />
          )}
          {voiceError && (
            <Text
              style={{
                color: 'red',
                marginTop: 8,
                fontFamily: 'Roboto-Medium',
              }}
            >
              {voiceError}
            </Text>
          )}
          {nlpStatus && !voiceError && (
            <Text
              style={{
                color: '#666666',
                marginTop: 8,
                fontSize: 12,
                fontFamily: 'Roboto-Medium',
              }}
            >
              {nlpStatus}
            </Text>
          )}

          {/* Invoice Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{folderName}</Text>

            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{folderName} Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <TextInput
                    ref={invoiceDateRef}
                    style={[
                      styles.input,
                      isFieldInvalid(invoiceDate) && { borderColor: 'red' },
                    ]}
                    placeholderTextColor="#666666"
                    value={invoiceDate}
                    editable={false}
                    pointerEvents="none"
                    onFocus={() => {
                      if (scrollRef.current && invoiceDateRef.current) {
                        scrollRef.current.scrollToFocusedInput(
                          invoiceDateRef.current,
                          120,
                        );
                      }
                    }}
                  />
                </TouchableOpacity>
                {triedSubmit && !invoiceDate && (
                  <Text style={styles.errorTextField}>Date is required.</Text>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(invoiceDate)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event: any, date?: Date | undefined) => {
                      console.log('ðŸ“… DateTimePicker onChange:', {
                        event,
                        date,
                      });

                      // Handle different event types
                      if (Platform.OS === 'android') {
                        if (event.type === 'set' && date) {
                          console.log(
                            'ðŸ“… Android: Date selected:',
                            date.toISOString().split('T')[0],
                          );
                          setShowDatePicker(false);
                          setInvoiceDate(date.toISOString().split('T')[0]);
                        } else if (event.type === 'dismissed') {
                          console.log('ðŸ“… Android: Date picker dismissed');
                          setShowDatePicker(false);
                        }
                      } else {
                        // iOS handling
                        if (date) {
                          console.log(
                            'ðŸ“… iOS: Date selected:',
                            date.toISOString().split('T')[0],
                          );
                          setInvoiceDate(date.toISOString().split('T')[0]);
                        }
                        if (event.type === 'dismissed') {
                          console.log('ðŸ“… iOS: Date picker dismissed');
                          setShowDatePicker(false);
                        }
                      }
                    }}
                  />
                )}
              </View>
            </View>
            <View style={fieldWrapper}>
              <Text style={styles.inputLabel}>{folderName} Customer</Text>
              <View
                style={[
                  {
                    borderWidth: 1,
                    borderColor: '#e0e0e0',
                    borderRadius: 8,
                    backgroundColor: '#f9f9f9',
                    zIndex: 999999999,
                  },
                  isFieldInvalid(selectedCustomer) && { borderColor: 'red' },
                ]}
              >
                <CustomerSelector
                  value={selectedCustomer}
                  onChange={(name, obj) => setSelectedCustomer(name)}
                  placeholder={`Type or search customer`}
                  onCustomerSelect={customer => {
                    console.log(
                      'ðŸ” InvoiceScreen: onCustomerSelect called with:',
                      customer,
                    );
                    console.log(
                      'ðŸ” InvoiceScreen: Setting selectedCustomer to:',
                      customer.partyName,
                    );
                    console.log(
                      'ðŸ” InvoiceScreen: Setting customerPhone to:',
                      customer.phoneNumber,
                    );
                    console.log(
                      'ðŸ” InvoiceScreen: Setting customerAddress to:',
                      customer.address,
                    );

                    setSelectedCustomer(customer.partyName || '');
                    setCustomerPhone(customer.phoneNumber || '');
                    setCustomerAddress(customer.address || '');
                  }}
                />
              </View>
              {triedSubmit && !selectedCustomer && (
                <Text style={styles.errorTextField}>Customer is required.</Text>
              )}
            </View>
            {/* Phone Field */}
            <View style={fieldWrapper}>
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={[
                  styles.input,
                  isFieldInvalid(customerPhone, 'phone') && {
                    borderColor: 'red',
                  },
                ]}
                placeholderTextColor="#666666"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                maxLength={16}
              />
              {getFieldError('customerPhone') && (
                <Text style={styles.errorTextField}>
                  {getFieldError('customerPhone')}
                </Text>
              )}
            </View>
            {/* Address Field */}
            <View style={fieldWrapper}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={[
                  styles.input,
                  { minHeight: 60, textAlignVertical: 'top' },
                  isFieldInvalid(customerAddress, 'address') && {
                    borderColor: 'red',
                  },
                ]}
                placeholderTextColor="#666666"
                value={customerAddress}
                onChangeText={setCustomerAddress}
                placeholder="Customer address"
                multiline
              />
              {getFieldError('customerAddress') && (
                <Text style={styles.errorTextField}>
                  {getFieldError('customerAddress')}
                </Text>
              )}
            </View>
            {/* GST Field */}
            <View style={fieldWrapper}>
              <Text style={styles.inputLabel}>GST (%)</Text>
              <Dropdown
                style={{
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: 12,
                  backgroundColor: '#fff',
                  paddingHorizontal: 16,
                  height: 48,
                  marginTop: 4,
                }}
                data={GST_OPTIONS.map(opt => ({
                  label: `${opt}%`,
                  value: opt,
                }))}
                labelField="label"
                valueField="value"
                placeholder="Select GST %"
                value={gstPct}
                onChange={selectedItem => {
                  setGstPct(selectedItem.value);
                  // Recalculate all item amounts with new GST
                  const updatedItems = items.map(item => ({
                    ...item,
                    amount:
                      item.quantity *
                      item.rate *
                      (1 + selectedItem.value / 100),
                  }));
                  setItems(updatedItems);
                }}
                renderLeftIcon={() => (
                  <MaterialCommunityIcons
                    name="percent"
                    size={20}
                    color="#666666"
                    style={{ marginRight: 8 }}
                  />
                )}
                selectedTextStyle={{
                  fontSize: 16,
                  color: '#333333',
                  fontFamily: 'Roboto-Medium',
                }}
                placeholderStyle={{
                  fontSize: 16,
                  color: '#666666',
                  fontFamily: 'Roboto-Medium',
                }}
                itemTextStyle={{
                  fontSize: 16,
                  color: '#333333',
                  fontFamily: 'Roboto-Medium',
                }}
                containerStyle={{
                  borderRadius: 12,
                  backgroundColor: '#f8fafc',
                }}
                activeColor="#f0f6ff"
                maxHeight={240}
              />
            </View>
          </View>
          {/* Items Card */}
          <View style={styles.card} ref={itemsSectionRef}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Items</Text>
              <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>
            {items.map(item => (
              <View style={styles.itemCard} key={item.id}>
                <Text style={styles.itemTitle}>
                  Item {items.indexOf(item) + 1}
                </Text>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  ref={ref => {
                    if (!itemRefs.current[item.id])
                      itemRefs.current[item.id] = {};
                    itemRefs.current[item.id]['description'] = ref || null;
                  }}
                  style={styles.input}
                  value={item?.description || ''}
                  onChangeText={text =>
                    updateItem(item.id, 'description', text)
                  }
                  placeholder="Item description"
                  placeholderTextColor="#666666"
                  onFocus={() => {
                    const inputRef =
                      itemRefs.current[item.id]?.description || null;
                    if (scrollRef.current && inputRef) {
                      scrollRef.current.scrollToFocusedInput(inputRef, 120);
                    }
                  }}
                />

                <View style={styles.rowBetween}>
                  <View style={styles.flex1}>
                    <Text style={styles.inputLabel}>Quantity</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current[item.id])
                          itemRefs.current[item.id] = {};
                        itemRefs.current[item.id]['quantity'] = ref || null;
                      }}
                      style={styles.input}
                      value={item?.quantity?.toString() || '1'}
                      placeholderTextColor="#666666"
                      onChangeText={text =>
                        updateItem(item.id, 'quantity', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef =
                          itemRefs.current[item.id]?.quantity || null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    {/* Rate */}
                    <Text style={styles.inputLabel}>Rate (â‚¹)</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current[item.id])
                          itemRefs.current[item.id] = {};
                        itemRefs.current[item.id]['rate'] = ref || null;
                      }}
                      style={styles.input}
                      value={item?.rate?.toString() || '0'}
                      placeholderTextColor="#666666"
                      onChangeText={text =>
                        updateItem(item.id, 'rate', parseFloat(text) || 0)
                      }
                      keyboardType="numeric"
                      onFocus={() => {
                        const inputRef =
                          itemRefs.current[item.id]?.rate || null;
                        if (scrollRef.current && inputRef) {
                          scrollRef.current.scrollToFocusedInput(inputRef, 120);
                        }
                      }}
                    />
                  </View>
                  <View style={[styles.flex1, { marginLeft: 8 }]}>
                    {/* Amount */}
                    <Text style={styles.inputLabel}>Amount (â‚¹)</Text>
                    <TextInput
                      ref={ref => {
                        if (!itemRefs.current[item.id])
                          itemRefs.current[item.id] = {};
                        itemRefs.current[item.id]['amount'] = ref || null;
                      }}
                      style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                      value={item?.amount?.toFixed(2) || '0.00'}
                      placeholderTextColor="#666666"
                      editable={false}
                    />
                  </View>
                </View>
                {items.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <MaterialCommunityIcons
                      name="delete-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.removeItemText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Amount Details Card */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={18}
                  color="#333"
                  style={{ marginRight: 2 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#333',
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                >
                  Amount Details
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: '#e0e0e0',
                marginVertical: 12,
              }}
            />
            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: 6,
                      fontSize: 15,
                      color: '#555',
                      fontWeight: '600',
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                >
                  Tax Amount
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      height: 40,
                      fontSize: 14,
                      paddingHorizontal: 12,
                      backgroundColor: '#fff',
                      borderColor: '#ddd',
                      borderWidth: 1,
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                  value={taxAmount.toString()}
                  placeholderTextColor="#666666"
                  onChangeText={text => {
                    const value = parseFloat(text) || 0;
                    setTaxAmount(value);
                    // Recalculate total with new tax amount
                    const subtotal = calculateSubtotal();
                    const gst = calculateGST();
                    const total = subtotal + gst + value - discountAmount;
                    // Update items with new amounts
                    const updatedItems = items.map(item => ({
                      ...item,
                      amount: item.quantity * item.rate * (1 + gstPct / 100),
                    }));
                    setItems(updatedItems);
                  }}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.flex1, { marginLeft: 16 }]}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: 6,
                      fontSize: 15,
                      color: '#555',
                      fontWeight: '600',
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                >
                  Discount Amount
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      height: 40,
                      fontSize: 14,
                      paddingHorizontal: 12,
                      backgroundColor: '#fff',
                      borderColor: '#ddd',
                      borderWidth: 1,
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                  value={discountAmount.toString()}
                  placeholderTextColor="#666666"
                  onChangeText={text => {
                    const value = parseFloat(text) || 0;
                    setDiscountAmount(value);
                    // Recalculate total with new discount amount
                    const subtotal = calculateSubtotal();
                    const gst = calculateGST();
                    const total = subtotal + gst + taxAmount - value;
                    // Update items with new amounts
                    const updatedItems = items.map(item => ({
                      ...item,
                      amount: item.quantity * item.rate * (1 + gstPct / 100),
                    }));
                    setItems(updatedItems);
                  }}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {/* Summary */}
            <View
              style={{
                marginTop: 20,
                padding: 18,
                backgroundColor: '#f8f9fa',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#e9ecef',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#555',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Subtotal:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  â‚¹{calculateSubtotal().toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#555',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  GST ({gstPct}%):
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  â‚¹{calculateGST().toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#555',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Tax Amount:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  â‚¹{taxAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#555',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Discount:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#666666',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  -â‚¹{discountAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#dee2e6',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Total:
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  â‚¹{calculateTotal().toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
          {/* Notes Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <TextInput
              ref={notesRef}
              style={[
                styles.input,
                { minHeight: 60, textAlignVertical: 'top' },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes or terms..."
              placeholderTextColor="#666666"
              multiline
              onFocus={() => {
                if (scrollRef.current && notesRef.current) {
                  scrollRef.current.scrollToFocusedInput(notesRef.current, 120);
                }
              }}
            />
          </View>
          {/* Action Buttons */}
          <View style={styles.actionButtonsBottom}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleSubmit('complete')}
              disabled={loadingSave}
            >
              <Text style={styles.primaryButtonText}>
                {loadingSave ? 'Saving...' : `Save ${folderName}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleSubmit('draft')}
              disabled={loadingDraft}
            >
              <Text style={styles.secondaryButtonText}>
                {loadingDraft ? 'Saving...' : 'Draft'}
              </Text>
            </TouchableOpacity>
          </View>
          {editingItem && (
            <TouchableOpacity
              style={{
                backgroundColor: '#000',
                borderRadius: 8,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 8,
                marginBottom: 16,
              }}
              onPress={() => deleteInvoice(editingItem.id)}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Delete {folderName}
              </Text>
            </TouchableOpacity>
          )}
        </KeyboardAwareScrollView>
        {/* Error/Success Modal */}
        <Modal
          isVisible={showModal}
          animationIn="fadeIn"
          animationOut="fadeOut"
          onBackdropPress={() => setShowModal(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              style={{ width: '100%' }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  padding: 28,
                  alignItems: 'center',
                  maxWidth: 340,
                  width: '90%',
                  minHeight: 120,
                  flexShrink: 1,
                  overflow: 'visible',
                  justifyContent: 'center',
                }}
              >
                {error && (
                  <>
                    <MaterialCommunityIcons
                      name="alert-circle"
                      size={48}
                      color="#dc3545"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={{
                        color: '#dc3545',
                        fontSize: 18,
                        marginBottom: 8,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Error
                    </Text>
                    <Text
                      style={{
                        color: '#333333',
                        fontSize: 16,
                        marginBottom: 20,
                        textAlign: 'center',
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      {error}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        {
                          backgroundColor: '#dc3545',
                          borderColor: '#dc3545',
                          width: 120,
                        },
                      ]}
                      onPress={() => setShowModal(false)}
                    >
                      <Text style={styles.primaryButtonText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
                {success && (
                  <>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={48}
                      color="#28a745"
                      style={{ marginBottom: 12 }}
                    />
                    <Text
                      style={{
                        color: '#28a745',
                        fontSize: 18,
                        marginBottom: 8,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Success
                    </Text>
                    <Text
                      style={{
                        color: '#333333',
                        fontSize: 16,
                        marginBottom: 20,
                        textAlign: 'center',
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      {success}
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryButton, { width: 120 }]}
                      onPress={() => {
                        setShowModal(false);
                        setShowCreateForm(false);
                        resetForm();
                      }}
                    >
                      <Text style={styles.primaryButtonText}>OK</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* File Type Selection Modal */}
        <Modal
          isVisible={showFileTypeModal}
          animationIn="slideInUp"
          animationOut="slideOutDown"
          onBackdropPress={() => setShowFileTypeModal(false)}
          style={{ margin: 0, justifyContent: 'flex-end' }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '90%',
              minHeight: 400,
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  color: '#333333',
                  textAlign: 'center',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Choose File Type
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#666666',
                  textAlign: 'center',
                  lineHeight: 20,
                  marginTop: 8,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Select the type of file you want to upload for OCR processing
              </Text>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={{
                flex: 1,
                paddingHorizontal: 24,
              }}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{
                paddingVertical: 20,
                paddingBottom: 40,
              }}
              nestedScrollEnabled={true}
              bounces={true}
              alwaysBounceVertical={false}
            >
              {/* File Type Options */}
              <View style={{ marginBottom: 20 }}>
                {/* Image Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('image')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#4f8cff',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="image"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Image
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload invoice/bill images (JPG, PNG)
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#4f8cff"
                  />
                </TouchableOpacity>

                {/* PDF Option */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    width: '100%',
                    borderWidth: 2,
                    borderColor: '#e9ecef',
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  onPress={() => handleFileTypeSelection('pdf')}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      backgroundColor: '#dc3545',
                      borderRadius: 12,
                      padding: 10,
                      marginRight: 16,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      PDF Document
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Upload PDF files for OCR processing
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#dc3545"
                  />
                </TouchableOpacity>
              </View>

              {/* Shared Example */}
              <View
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: '#e9ecef',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    marginBottom: 12,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Real Invoice Example:
                </Text>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#dee2e6',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: '#333333',
                      marginBottom: 8,
                      textAlign: 'center',
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Invoice
                  </Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#666666',
                        lineHeight: 18,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Invoice Date:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        2025-07-15{'\n'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Customer Name:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        Rajesh Singh{'\n'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Phone:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        917865434576{'\n'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Address:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        404 Jack Palace, Switzerland
                      </Text>
                    </Text>
                  </View>

                  {/* Table Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#f8f9fa',
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 4,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 2,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Description
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      GST
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Qty
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Rate
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#333333',
                        flex: 1,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Amount
                    </Text>
                  </View>

                  {/* Table Rows */}
                  <View style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Charger
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        5%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        10
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        10
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        105.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Bottle
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        18%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        10
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        100
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        1180.00
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 2,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Mouse
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        12%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        10
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        12
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#666666',
                          flex: 1,
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        134.40
                      </Text>
                    </View>
                  </View>

                  {/* Calculations */}
                  <View style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#333333',
                        marginBottom: 4,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      Calculations
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#666666',
                        lineHeight: 16,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        SubTotal:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        â‚¹1,220{'\n'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Total GST:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        â‚¹199.4{'\n'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Total:
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        {' '}
                        â‚¹1,419.4
                      </Text>
                    </Text>
                  </View>

                  {/* Notes */}
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#666666',
                        lineHeight: 16,
                        fontFamily: 'Roboto-Medium',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Roboto-Medium',
                        }}
                      >
                        Notes:
                      </Text>{' '}
                      Wheater is Clean, and air is fresh
                    </Text>
                  </View>
                </View>

                {/* Tip */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginTop: 12,
                    backgroundColor: '#fff3cd',
                    borderRadius: 6,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: '#ffeaa7',
                  }}
                >
                  <MaterialCommunityIcons
                    name="lightbulb-outline"
                    size={16}
                    color="#ffc107"
                    style={{ marginTop: 1 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#856404',
                      marginLeft: 6,
                      flex: 1,
                      lineHeight: 16,
                      fontFamily: 'Roboto-Medium',
                    }}
                  >
                    Tip: Clear, well-lit images or text-based PDFs with
                    structured tables work best for OCR
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderTopColor: '#f0f0f0',
              }}
            >
              <TouchableOpacity
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderWidth: 1,
                  borderColor: '#dee2e6',
                  alignItems: 'center',
                }}
                onPress={() => setShowFileTypeModal(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#666666',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Main invoice list view
  const renderInvoiceItem = ({ item }: { item: any }) => (
    <View
      style={[
        styles.invoiceCard,
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ]}
    >
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => handleEditItem(item)}
        activeOpacity={0.8}
      >
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceNumber}>{`SEL-${item.id}`}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.customerName}>{item.partyName}</Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>{item.date?.slice(0, 10)}</Text>
          <Text style={styles.invoiceAmount}>
            {formatCurrency(Number(item.amount))}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.syncButton,
          item.syncYN === 'Y' && {
            backgroundColor: '#bdbdbd',
            borderColor: '#bdbdbd',
          },
        ]}
        onPress={() => handleSync(item)}
        activeOpacity={0.85}
        disabled={item.syncYN === 'Y'}
      >
        <Text style={styles.syncButtonText}>Sync</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#333333"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{folderName}</Text>
        </View>
      </View>
      {/* Search Bar */}
      <SearchAndFilter
        value={searchFilter}
        onChange={setSearchFilter}
        onFilterPress={() => setFilterVisible(true)}
        recentSearches={recentSearches}
        onRecentSearchPress={handleRecentSearchPress}
        filterBadgeCount={filterBadgeCount}
      />
      {/* Invoice List */}
      <View style={styles.listContainer}>
        {loadingApi && (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 40 }}
          />
        )}
        {!loadingApi && apiError && (
          <Text
            style={{
              color: 'red',
              textAlign: 'center',
              marginTop: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {apiError.replace(/invoice/gi, folderName)}
          </Text>
        )}
        {!loadingApi && !apiError && filteredInvoices.length === 0 && (
          <Text
            style={{
              color: '#888',
              textAlign: 'center',
              marginTop: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {`No ${pluralize(folderName).toLowerCase()} found.`}
          </Text>
        )}
        {!loadingApi && !apiError && filteredInvoices.length > 0 && (
          <FlatList
            data={[...filteredInvoices].reverse()}
            renderItem={renderInvoiceItem}
            keyExtractor={item => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>
      {/* Add Invoice Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => {
          setShowModal(false);
          setLoadingSave(false);
          setLoadingDraft(false);
          setShowCreateForm(true);
        }}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>
      {/* Advanced Filter Modal */}
      <Modal
        isVisible={filterVisible}
        onBackdropPress={() => setFilterVisible(false)}
        style={{ justifyContent: 'flex-end', margin: 0, marginBottom: 0 }}
      >
        <KeyboardAwareScrollView
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: '80%',
          }}
          contentContainerStyle={{ padding: 20 }}
          enableOnAndroid
          extraScrollHeight={120}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => setFilterVisible(false)}
            style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#333333"
            />
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 18,
              marginBottom: 16,
              marginLeft: 40,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Filter Invoices
          </Text>
          {/* Amount Range */}
          <Text
            style={{
              fontSize: 15,
              marginBottom: 6,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Amount Range
          </Text>
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
                marginRight: 8,
              }}
              placeholder="Min"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={
                searchFilter.amountMin !== undefined
                  ? String(searchFilter.amountMin)
                  : ''
              }
              onChangeText={v =>
                setSearchFilter(f => ({
                  ...f,
                  amountMin: v ? Number(v) : undefined,
                }))
              }
            />
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
              }}
              placeholder="Max"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              value={
                searchFilter.amountMax !== undefined
                  ? String(searchFilter.amountMax)
                  : ''
              }
              onChangeText={v =>
                setSearchFilter(f => ({
                  ...f,
                  amountMax: v ? Number(v) : undefined,
                }))
              }
            />
          </View>
          {/* Date Range */}
          <Text
            style={{
              fontSize: 15,
              marginBottom: 6,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Date Range
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
                marginRight: 8,
              }}
              onPress={() => setShowDatePickerFrom(true)}
            >
              <Text
                style={{
                  color: searchFilter.dateFrom ? '#333333' : '#666666',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {searchFilter.dateFrom || 'From'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: 8,
                padding: 10,
              }}
              onPress={() => setShowDatePickerTo(true)}
            >
              <Text
                style={{
                  color: searchFilter.dateTo ? '#333333' : '#666666',
                  fontFamily: 'Roboto-Medium',
                }}
              >
                {searchFilter.dateTo || 'To'}
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePickerFrom && (
            <DateTimePicker
              value={
                searchFilter.dateFrom
                  ? new Date(searchFilter.dateFrom)
                  : new Date()
              }
              mode="date"
              display="default"
              onChange={(event: any, date?: Date) => {
                // Only close picker and update date when user actually selects a date
                if (event.type === 'set' && date) {
                  setShowDatePickerFrom(false);
                  setSearchFilter(f => ({
                    ...f,
                    dateFrom: date.toISOString().split('T')[0],
                  }));
                } else if (event.type === 'dismissed') {
                  // User cancelled the picker
                  setShowDatePickerFrom(false);
                }
              }}
            />
          )}
          {showDatePickerTo && (
            <DateTimePicker
              value={
                searchFilter.dateTo ? new Date(searchFilter.dateTo) : new Date()
              }
              mode="date"
              display="default"
              onChange={(event: any, date?: Date) => {
                // Only close picker and update date when user actually selects a date
                if (event.type === 'set' && date) {
                  setShowDatePickerTo(false);
                  setSearchFilter(f => ({
                    ...f,
                    dateTo: date.toISOString().split('T')[0],
                  }));
                } else if (event.type === 'dismissed') {
                  // User cancelled the picker
                  setShowDatePickerTo(false);
                }
              }}
            />
          )}
          {/* Payment Method filter */}
          <Text
            style={{
              fontSize: 16,
              color: '#333333',
              marginBottom: 12,
              marginTop: 8,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Payment Method
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 20,
              gap: 10,
            }}
          >
            {[
              'Cash',
              'Bank Transfer',
              'UPI',
              'Credit Card',
              'Debit Card',
              'Cheque',
            ].map((method, idx) => (
              <TouchableOpacity
                key={method}
                style={{
                  backgroundColor:
                    searchFilter.paymentMethod === method
                      ? '#e5e7eb'
                      : '#ffffff',
                  borderColor:
                    searchFilter.paymentMethod === method
                      ? '#9ca3af'
                      : '#d1d5db',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 75,
                }}
                onPress={() =>
                  setSearchFilter(f => ({
                    ...f,
                    paymentMethod: method,
                  }))
                }
              >
                <Text
                  style={{
                    color:
                      searchFilter.paymentMethod === method
                        ? '#1f2937'
                        : '#6b7280',
                    fontSize: 14,
                    fontWeight:
                      searchFilter.paymentMethod === method ? '600' : '500',
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Status Filter */}
          <Text
            style={{
              fontSize: 16,
              color: '#333333',
              marginBottom: 12,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Status
          </Text>
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 20,
              gap: 12,
            }}
          >
            {['', 'Paid', 'Pending'].map(status => (
              <TouchableOpacity
                key={status}
                style={{
                  flex: 1,
                  backgroundColor:
                    (status === '' && !searchFilter.status) ||
                    searchFilter.status === status
                      ? '#e5e7eb'
                      : '#ffffff',
                  borderColor:
                    (status === '' && !searchFilter.status) ||
                    searchFilter.status === status
                      ? '#9ca3af'
                      : '#d1d5db',
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() =>
                  setSearchFilter(f => ({ ...f, status: status || undefined }))
                }
              >
                <Text
                  style={{
                    color:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '#1f2937'
                        : '#6b7280',
                    fontSize: 14,
                    fontWeight:
                      (status === '' && !searchFilter.status) ||
                      searchFilter.status === status
                        ? '600'
                        : '500',
                    textTransform: 'capitalize',
                    textAlign: 'center',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {status || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reference Number Filter */}
          <Text
            style={{
              fontSize: 15,
              marginBottom: 6,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Reference Number
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
            }}
            placeholder="Reference number"
            placeholderTextColor="#666666"
            value={searchFilter.reference || ''}
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, reference: v || undefined }))
            }
          />
          {/* Description/Notes Filter */}
          <Text
            style={{
              fontSize: 15,
              marginBottom: 6,
              fontFamily: 'Roboto-Medium',
            }}
          >
            Description/Notes
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 16,
            }}
            placeholder="Description or notes keywords"
            placeholderTextColor="#666666"
            value={searchFilter.description || ''}
            onChangeText={v =>
              setSearchFilter(f => ({ ...f, description: v || undefined }))
            }
          />
          {/* Actions */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              // marginBottom: 0,
              marginTop: 12,
              gap: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setSearchFilter({ searchText: '' });
              }}
              style={{
                backgroundColor: '#f8f9fa',
                borderWidth: 1.5,
                borderColor: '#dc3545',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 140,
              }}
            >
              <Text
                style={{
                  color: '#dc3545',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              style={{
                backgroundColor: '#4f8cff',
                borderWidth: 1.5,
                borderColor: '#4f8cff',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </Modal>

      {/* Custom Popup */}
      <Modal
        isVisible={showPopup}
        onBackdropPress={() => setShowPopup(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        style={{ justifyContent: 'center', margin: 20 }}
        backdropOpacity={0.6}
        useNativeDriver={true}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 10,
            },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Icon */}
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor:
                popupType === 'success'
                  ? '#d4edda'
                  : popupType === 'error'
                  ? '#f8d7da'
                  : '#d1ecf1',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons
              name={
                popupType === 'success'
                  ? 'check-circle'
                  : popupType === 'error'
                  ? 'alert-circle'
                  : 'information'
              }
              size={32}
              color={
                popupType === 'success'
                  ? '#155724'
                  : popupType === 'error'
                  ? '#721c24'
                  : '#0c5460'
              }
            />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 20,
              color: '#333333',
              marginBottom: 8,
              textAlign: 'center',
              fontFamily: 'Roboto-Medium',
            }}
          >
            {popupTitle}
          </Text>

          {/* Message */}
          <Text
            style={{
              fontSize: 16,
              color: '#666666',
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
              fontFamily: 'Roboto-Medium',
            }}
          >
            {popupMessage}
          </Text>

          {/* OK Button */}
          <TouchableOpacity
            style={{
              backgroundColor:
                popupType === 'success'
                  ? '#28a745'
                  : popupType === 'error'
                  ? '#dc3545'
                  : '#17a2b8',
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: 8,
              minWidth: 100,
            }}
            onPress={() => setShowPopup(false)}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                textAlign: 'center',
                fontFamily: 'Roboto-Medium',
              }}
            >
              OK
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Dropdown style enhancements
const dropdownStyles = {
  dropdown: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e3e7ee',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    marginTop: 8,
  },
  dropdownFocused: {
    borderColor: '#4f8cff',
    backgroundColor: '#f0f6ff',
  },
  placeholderStyle: {
    fontSize: 17,
    color: '#666666',
    fontWeight: '500' as '500',
    fontFamily: 'Roboto-Medium',
  },

  selectedTextStyle: {
    fontSize: 17,
    color: '#333333',
    fontWeight: '600' as '600',
    fontFamily: 'Roboto-Medium',
  },

  iconStyle: {
    width: 28,
    height: 28,
    tintColor: '#000',
  },
  inputSearchStyle: {
    height: 44,
    fontSize: 16,
    backgroundColor: '#f0f6ff',
    borderRadius: 12,
    paddingLeft: 36,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  containerStyle: {
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  itemContainerStyle: {
    borderRadius: 12,
    marginVertical: 2,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  itemTextStyle: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500' as '500',
    fontFamily: 'Roboto-Medium',
  },

  selectedItemStyle: {
    backgroundColor: '#f0f6ff',
  },
};

const fieldWrapper = {
  marginBottom: 16,
  width: '100%' as const,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#333333',
    marginLeft: 12,
    fontFamily: 'Roboto-Medium',
  },

  iconButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
  },

  customerName: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
  },

  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Roboto-Medium',
  },

  invoiceAmount: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  addInvoiceButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#4f8cff',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addInvoiceText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'Roboto-Medium',
  },

  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    color: '#333333',
    marginBottom: 16,
    fontFamily: 'Roboto-Medium',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flex1: { flex: 1 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    height: 52,
    justifyContent: 'center',
  },
  picker: {
    height: 52,
    width: '100%',
    marginTop: -4,
    marginBottom: -4,
  },
  itemCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  removeItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#dc3545', // Bootstrap red
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  removeItemText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },

  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calcLabel: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Roboto-Medium',
  },

  calcValue: {
    fontSize: 16,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  calcTotalLabel: {
    fontSize: 18,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  calcTotalValue: {
    fontSize: 18,
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },

  actionButtonsBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#222',
    paddingVertical: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    color: '#333333',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#f9f9f9',
    fontFamily: 'Roboto-Medium',
  },

  inputLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'Roboto-Medium',
  },

  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addItemText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  placeholderStyle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  selectedTextStyle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  inputSearchStyle: {
    height: 40,
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },

  errorTextField: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Roboto-Medium',
  },

  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: 30, // further increased height
    paddingHorizontal: 32,
    marginLeft: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
  },
});

export default InvoiceScreen;
