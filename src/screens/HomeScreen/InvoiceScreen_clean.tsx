import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
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
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { Dropdown } from 'react-native-element-dropdown';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../../types/navigation';
// Removed SafeAreaView to allow full control over StatusBar area
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../../api/unifiedApiService';
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
import { upsertItemNames } from '../../api/items';
import ItemNameSuggestions from '../../components/ItemNameSuggestions';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { wordsToNumbers } from 'words-to-numbers';
import { parseInvoiceVoiceText } from '../../utils/voiceParser';
import Modal from 'react-native-modal'; // Only for error/success dialogs, not for dropdowns
import {
  extractInvoiceDataWithNLP,
  isNLPAvailable,
} from '../../utils/openaiNlp';
import {
  pick,
  types as DocumentPickerTypes,
} from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import { OCRService } from '../../services/ocrService';
import { generateNextDocumentNumber } from '../../utils/autoNumberGenerator';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import {
  HEADER_CONTENT_HEIGHT,
  getSolidHeaderStyle,
} from '../../utils/headerLayout';
import StableStatusBar from '../../components/StableStatusBar';
import { getStatusBarSpacerHeight } from '../../utils/statusBarManager';
import { SafeAreaView } from 'react-native-safe-area-context';
import { uiColors, uiFonts } from '../../config/uiSizing';

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
  gstPct?: number;
}

const INVOICE_LIST_PAGE_SIZE = 25;

const GST_OPTIONS = [0, 5, 12, 18, 28];

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  partyName: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
}

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
  console.log('📄 Raw OCR Text:', text);

  // Enhanced text cleaning for image OCR artifacts - preserve dashes for invoice numbers
  let cleaned = text
    .replace(/\s{2,}/g, ' ') // Normalize multiple spaces
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/[^\w\s,.\-:%₹]/g, ' ') // Remove special characters except essential ones (preserve dashes)
    .replace(/\s{2,}/g, ' ') // Normalize spaces again
    .trim();

  console.log('🧹 Cleaned Text:', cleaned);

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
        console.log('🔍 Found Invoice Number (SEL pattern):', invoiceNumber);
        break;
      }

      // Clean and validate the extracted number
      if (extractedNumber && extractedNumber.length >= 3) {
        invoiceNumber = extractedNumber.trim();
        console.log('🔍 Found Invoice Number (structured):', invoiceNumber);
        break;
      }
    }
  }

  // If no structured pattern found, try to find fragmented INV pattern
  if (!invoiceNumber) {
    console.log(
      '🔍 No structured pattern found, checking for fragmented INV...',
    );

    // Look for "SEL" followed by numbers anywhere in the text
    const selMatches = cleaned.match(/SEL\s*[-]?\s*(\d{3,6})/gi);
    if (selMatches && selMatches.length > 0) {
      const bestMatch = selMatches[0];
      const numberMatch = bestMatch.match(/(\d{3,6})/);
      if (numberMatch) {
        invoiceNumber = `SEL-${numberMatch[1]}`;
        console.log('🔍 Found Invoice Number (fragmented SEL):', invoiceNumber);
      }
    }
  }

  // If still no invoice number found, try flexible alphanumeric search
  if (!invoiceNumber) {
    console.log(
      '🔍 No structured invoice number found, trying flexible search...',
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
      console.log('🔍 Found Invoice Number (flexible):', invoiceNumber);
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
      console.log('🔍 Found Invoice Date:', invoiceDate);
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
      console.log('🔍 Found Customer Name:', customerName);
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
      console.log('🔍 Found Phone Number:', customerPhone);
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
      console.log('🔍 Found Address:', customerAddress);
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
        console.log('📦 Parsed Item:', {
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
    console.log('📋 No table items found, trying specific item extraction...');

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
            console.log('📦 Parsed Specific Item:', {
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
    console.log('📋 No specific items found, trying generic extraction...');

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
            console.log('📦 Parsed Generic Item:', {
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
    /SubTotal\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i,
    /SubTotal\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of subtotalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      subtotal = parseFloat(match[1].replace(/,/g, ''));
      console.log('🔍 Found SubTotal:', subtotal);
      break;
    }
  }

  const gstTotalPatterns = [
    /Total\s*GST\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i,
    /Total\s*GST\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of gstTotalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      totalGST = parseFloat(match[1].replace(/,/g, ''));
      console.log('🔍 Found Total GST:', totalGST);
      break;
    }
  }

  const totalPatterns = [
    /Total\s*[:\-]?\s*₹?\s*([\d,]+\.?\d*)/i,
    /Total\s*[:\-]?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      total = parseFloat(match[1].replace(/,/g, ''));
      console.log('🔍 Found Total:', total);
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
      console.log('🔍 Found Notes:', notes);
      break;
    }
  }

  // If no items found with table patterns, try generic extraction
  if (items.length === 0) {
    console.log('📋 No table items found, trying generic extraction...');

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
            console.log('📦 Parsed Generic Item:', {
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
        '⚠️ Invoice number too short, might be incomplete:',
        invoiceNumber,
      );
    }

    console.log('🔧 Final cleaned invoice number:', invoiceNumber);
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
  console.log('🎯 Final Invoice Number:', invoiceNumber);
  console.log('🎯 Final Parsed Result:', result);
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
  // Match PurchaseScreen behavior: when editing, fetch full detail first
  const [isFetchingEdit, setIsFetchingEdit] = useState(false);

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
  const [visibleInvoiceCount, setVisibleInvoiceCount] = useState(
    INVOICE_LIST_PAGE_SIZE,
  );
  const [isInvoicePaginating, setIsInvoicePaginating] = useState(false);

  // Get context values before defining functions that use them
  const { customers, add, fetchAll } = useCustomerContext();
  const { appendVoucher } = useVouchers();
  const { forceCheckTransactionLimit, forceShowPopup } = useTransactionLimit();

  // Move fetchInvoices to top-level so it can be called from handleSubmit
  const fetchInvoices = async (page = 1) => {
    setLoadingApi(true);
    setApiError(null);
    try {
      // Use unified API with pagination - optimized!
      // unifiedApi.getInvoices() returns data directly, not wrapped in {data, status, headers}
      const response = await unifiedApi.getInvoices(page, 20);
      // Handle both direct data and paginated response structures
      const data = (response as any)?.data || response || {};
      try {
        console.log(
          '📦 InvoiceScreen.fetchInvoices → data keys:',
          Object.keys(data || {}),
        );
        console.log('📊 InvoiceScreen.fetchInvoices → counts:', {
          dataArrayLength: Array.isArray(data?.data) ? data.data.length : null,
          total: typeof data?.total === 'number' ? data.total : null,
          page: typeof data?.page === 'number' ? data.page : null,
          limit: typeof data?.limit === 'number' ? data.limit : null,
        });
        if (Array.isArray(data?.data)) {
          const sample = data.data.slice(0, 3).map((v: any) => ({
            id: v.id,
            type: v.type,
            category: v.category,
            invoiceNumber: v.invoiceNumber || v.billNumber || v.receiptNumber,
            itemsType: Array.isArray(v.items) ? 'array' : typeof v.items,
            itemsLen: Array.isArray(v.items) ? v.items.length : null,
            hasTransactionItems: Array.isArray(v.transactionItems),
            hasVoucherItems: Array.isArray(v.voucherItems),
          }));
          console.log('🧪 InvoiceScreen.fetchInvoices → sample[0..2]:', sample);
        }
      } catch {}
      // Filter strictly to Sell/Invoice entries only (exclude Receipt/Payment)
      const coerceItemsLen = (v: any) => {
        try {
          if (Array.isArray(v?.items)) return v.items.length;
          if (typeof v?.items === 'string') {
            const parsed = JSON.parse(v.items);
            if (Array.isArray(parsed)) return parsed.length;
          }
        } catch {}
        if (Array.isArray(v?.transactionItems))
          return v.transactionItems.length;
        if (Array.isArray(v?.voucherItems)) return v.voucherItems.length;
        return 0;
      };

      // Get the actual array of transactions from the response
      // Backend already filters by type='credit' and hasItems=true via getInvoices(),
      // so we just need to extract the array
      const transactionsArray = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      // Since backend already filters by type='credit' and hasItems=true via getInvoices(),
      // we can be more lenient with filtering - just ensure it's a credit transaction
      // and exclude receipts (which have receiptNumber but no invoiceNumber/billNumber)
      let filtered = transactionsArray.filter((v: any) => {
        const typeStr = String(v?.type ?? '').toLowerCase();
        // Accept all credit transactions (backend already filtered by hasItems=true)
        // Exclude receipts which have receiptNumber but no invoiceNumber/billNumber
        const isReceipt =
          Boolean((v as any)?.receiptNumber) &&
          !(v as any)?.invoiceNumber &&
          !(v as any)?.billNumber;
        // 🎯 FIXED: Exclude subscription transactions (plan upgrades)
        const isSubscription =
          String((v as any)?.category || '').toLowerCase() === 'subscription' ||
          String((v as any)?.method || '').toLowerCase() === 'subscription';
        return typeStr === 'credit' && !isReceipt && !isSubscription;
      });
      try {
        console.log(
          '🧮 InvoiceScreen.fetchInvoices → filtered length:',
          filtered.length,
        );
        if (Array.isArray(data?.data) && filtered.length === 0) {
          const counts = (data.data || []).reduce((acc: any, v: any) => {
            const t = String(v?.type || '').toLowerCase();
            acc[t] = (acc[t] || 0) + 1;
            return acc;
          }, {});
          console.log(
            '📈 InvoiceScreen.fetchInvoices → type distribution:',
            counts,
          );
        }
      } catch {}
      // Fallback: if nothing returned for type=credit, retry without server filter
      if (Array.isArray(data?.data) && filtered.length === 0) {
        try {
          console.log(
            '🔁 InvoiceScreen.fetchInvoices → Empty result, retrying without type filter',
          );
        } catch {}
        try {
          console.time('⏱️ InvoiceScreen.fetchInvoices fallback duration');
        } catch {}
        // Use unified API fallback - getTransactions returns data directly
        const fallbackData = await unifiedApi.getTransactions({
          type: 'credit',
          limit: 100,
          page: 1,
        });
        try {
          console.log(
            '📦 InvoiceScreen.fetchInvoices (fallback) → data keys:',
            Object.keys(fallbackData || {}),
          );
          const fallbackDataObj =
            (fallbackData as any)?.data || fallbackData || {};
          console.log('📊 InvoiceScreen.fetchInvoices (fallback) → counts:', {
            dataArrayLength: Array.isArray((fallbackData as any)?.data)
              ? (fallbackData as any).data.length
              : null,
            total:
              typeof fallbackDataObj?.total === 'number'
                ? fallbackDataObj.total
                : null,
            page:
              typeof fallbackDataObj?.page === 'number'
                ? fallbackDataObj.page
                : null,
            limit:
              typeof fallbackDataObj?.limit === 'number'
                ? fallbackDataObj.limit
                : null,
          });
        } catch {}
        const all = Array.isArray((fallbackData as any)?.data)
          ? (fallbackData as any).data
          : Array.isArray(fallbackData)
          ? fallbackData
          : [];
        filtered = all.filter((v: any) => {
          const typeStr = String(v?.type ?? '').toLowerCase();
          const categoryStr = String(v?.category ?? '').toLowerCase();
          const statusStr = String(v?.status ?? '').toLowerCase();
          const methodStr = String((v as any)?.method ?? '').toLowerCase();
          const hasInvoiceDoc =
            Boolean((v as any)?.invoiceNumber || (v as any)?.billNumber) &&
            !(v as any)?.receiptNumber;
          const isSellLike =
            methodStr === 'sell' ||
            hasInvoiceDoc ||
            categoryStr.includes('sell') ||
            statusStr.includes('invoice');
          // 🎯 FIXED: Exclude subscription transactions (plan upgrades)
          const isSubscription =
            categoryStr === 'subscription' || methodStr === 'subscription';
          const typeMatches =
            typeStr === 'credit' && isSellLike && !isSubscription;
          const itemsLen = coerceItemsLen(v);
          const hasLineItems = itemsLen > 0;
          const amountNum = Number(v?.amount ?? 0);
          const hasMeaningfulAmount = !Number.isNaN(amountNum) && amountNum > 0;
          return typeMatches && (hasLineItems || hasMeaningfulAmount);
        });
        try {
          console.log(
            '🧮 InvoiceScreen.fetchInvoices (fallback) → filtered length:',
            filtered.length,
          );
          if (Array.isArray(all)) {
            const typeCounts = all.reduce((acc: any, v: any) => {
              const t = String(v?.type || '').toLowerCase();
              acc[t] = (acc[t] || 0) + 1;
              return acc;
            }, {});
            console.log(
              '📈 InvoiceScreen.fetchInvoices (fallback) → type distribution:',
              typeCounts,
            );
          }
        } catch {}
        try {
          console.timeEnd('⏱️ InvoiceScreen.fetchInvoices fallback duration');
        } catch {}
      }

      // Ensure customers list is available for id->name resolution
      try {
        if (!Array.isArray(customers) || customers.length === 0) {
          await fetchAll?.('');
        }
      } catch {}

      // Ensure partyName is populated for list display (more robust + customerId lookup)
      const enriched = (filtered || []).map((v: any) => {
        let nameCandidate =
          v.partyName ||
          v.customerName ||
          v.supplierName ||
          v.party_name ||
          v.customer_name ||
          (v.party &&
            (v.party.name || v.party.partyName || v.party.party_name)) ||
          (v._raw &&
            (v._raw.partyName || v._raw.customerName || v._raw.party_name)) ||
          v.name ||
          '';

        if (!(typeof nameCandidate === 'string' && nameCandidate.trim())) {
          try {
            const id = Number(
              v.customerId || v.customer_id || v.partyId || v.party_id,
            );
            if (!Number.isNaN(id) && Array.isArray(customers)) {
              const found = customers.find(c => Number((c as any).id) === id);
              if (found)
                nameCandidate =
                  (found as any).partyName || (found as any).name || '';
            }
          } catch {}
        }

        return {
          ...v,
          partyName:
            typeof nameCandidate === 'string' && nameCandidate.trim()
              ? nameCandidate
              : 'Unknown Customer',
        };
      });

      setApiInvoices(enriched as any);
      // Warm item cache for entries that already include items
      try {
        for (const v of enriched as any[]) {
          const hasItems = Array.isArray(v?.items) && v.items.length > 0;
          const hasTxItems =
            Array.isArray((v as any)?.transactionItems) &&
            (v as any).transactionItems.length > 0;
          const hasVItems =
            Array.isArray((v as any)?.voucherItems) &&
            (v as any).voucherItems.length > 0;
          const itemsToCache = hasItems
            ? v.items
            : hasTxItems
            ? (v as any).transactionItems
            : hasVItems
            ? (v as any).voucherItems
            : null;
          if (itemsToCache && v?.id) {
            const cacheKey = `voucherItemsCache:${v.id}`;
            const cacheValue = JSON.stringify({
              items: itemsToCache,
              gstPct: (v as any).gstPct,
              date: v.date,
            });
            await AsyncStorage.setItem(cacheKey, cacheValue);
            // Also cache by invoice number if present
            const inv =
              (v as any).invoiceNumber ||
              (v as any).billNumber ||
              (v as any).receiptNumber;
            if (inv) {
              const invKey = `voucherItemsByInvoice:${String(inv)}`;
              await AsyncStorage.setItem(invKey, cacheValue);
            }
            // Cache by signature as well
            try {
              const name = (v.partyName || v.customerName || '')
                .toString()
                .trim()
                .toLowerCase();
              const dt = (v.date || '').toString().slice(0, 10);
              const total =
                Number((v as any).totalAmount ?? v.amount ?? 0) || 0;
              if (name && dt) {
                const sigKey = `voucherItemsBySig:${dt}|${name}|${total}`;
                await AsyncStorage.setItem(sigKey, cacheValue);
              }
            } catch {}
          }
        }
      } catch {}
    } catch (e: any) {
      try {
        console.log('🚨 InvoiceScreen.fetchInvoices → caught error:', e);
      } catch {}
      setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
    } finally {
      try {
        console.timeEnd('⏱️ InvoiceScreen.fetchInvoices duration');
      } catch {}
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
    console.log('📅 invoiceDate changed to:', invoiceDate);
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
  const [showGstModal, setShowGstModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [customer, setCustomer] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [isCustomerFocused, setIsCustomerFocused] = useState(false);
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
  // Add state for description
  const [description, setDescription] = useState('');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
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

  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [documentName, setDocumentName] = useState('');
  const [fileType, setFileType] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Custom popup states
  const [showPopup, setShowPopup] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>(
    'info',
  );
  const [showFileTypeModal, setShowFileTypeModal] = useState(false);

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
  const [ocrData, setOcrData] = useState<any>(null); // Add this to force re-renders

  useEffect(() => {
    console.log('🔄 Form field changed - Selected Customer:', selectedCustomer);
  }, [selectedCustomer]);

  useEffect(() => {
    console.log('🔄 Form field changed - Items count:', items.length);
  }, [items]);

  // Update taxAmount when items or GST percentage changes
  // Use refs to track previous values to calculate difference
  const prevGstAmountRef = useRef(0);
  const prevSubtotalRef = useRef(0);
  useEffect(() => {
    if (items.length > 0 && showCreateForm) {
      const subtotal = calculateSubtotal();
      const newGstAmount = subtotal * (gstPct / 100);
      // Calculate old GST amount based on previous subtotal
      const oldGstAmount = prevSubtotalRef.current * (gstPct / 100);
      const gstDifference = newGstAmount - oldGstAmount;

      setTaxAmount(prev => {
        // If taxAmount is 0 or very close to old GST, set it to new GST
        if (prev === 0 || Math.abs(prev - oldGstAmount) < 0.01) {
          prevGstAmountRef.current = newGstAmount;
          prevSubtotalRef.current = subtotal;
          return newGstAmount;
        }
        // Otherwise, adjust by the difference in GST
        prevGstAmountRef.current = newGstAmount;
        prevSubtotalRef.current = subtotal;
        return prev + gstDifference;
      });
    }
  }, [items, gstPct, showCreateForm]);

  // Monitor OCR data changes and force form updates
  useEffect(() => {
    if (ocrData) {
      console.log('🔄 OCR Data changed, forcing form update:', ocrData);
      // Force re-render by updating form fields again

      setSelectedCustomer(ocrData.customerName || '');
      setCustomerName(ocrData.customerName || '');
      setCustomerPhone(ocrData.customerPhone || '');
      setCustomerAddress(ocrData.customerAddress || '');
      // Only set invoice date from OCR if it exists, don't override with current date
      if (ocrData.invoiceDate) {
        setInvoiceDate(ocrData.invoiceDate);
      }
      setNotes(ocrData.notes || '');

      if (ocrData.items && ocrData.items.length > 0) {
        const newItems = ocrData.items.map((item: any, index: number) => ({
          ...item,
          id: (index + 1).toString(),
          amount: Number(item.quantity) * Number(item.rate),
        }));
        setItems(newItems);
      }
    }
  }, [ocrData]);

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
          // Calculate amount without GST - GST will be added in final total only
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
          console.log('Updated item amount:', {
            quantity: updatedItem.quantity,
            rate: updatedItem.rate,
            gstPct: gstPct,
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
    // GST is included in taxAmount, so no need to add it separately
    return subtotal + taxAmount - discountAmount;
  };

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '₹0';
    }
    return `₹${amount.toLocaleString('en-IN')}`;
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
  const handleEditItem = async (item: any) => {
    if (!item) return;
    setShowModal(false);
    setLoadingSave(false);
    setLoadingDraft(false);
    // Open the form first in loading state, then load details
    setIsFetchingEdit(true);
    setShowCreateForm(true);
    setEditingItem(null);

    // Pre-seed form from cache immediately (so user doesn't see zeros)
    let provisionalFromCache: any | null = null;
    try {
      const cacheKey = `voucherItemsCache:${item.id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      let cachedItems: any[] | null = null;
      let cachedGst: number | undefined = undefined;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.items)) cachedItems = parsed.items;
        if (typeof parsed?.gstPct === 'number') cachedGst = parsed.gstPct;
      }
      if (!cachedItems) {
        const inv = (item as any)?.invoiceNumber || (item as any)?.billNumber;
        if (inv) {
          const invKey = `voucherItemsByInvoice:${String(inv)}`;
          const invCached = await AsyncStorage.getItem(invKey);
          if (invCached) {
            const parsed2 = JSON.parse(invCached);
            if (Array.isArray(parsed2?.items)) cachedItems = parsed2.items;
            if (typeof parsed2?.gstPct === 'number') cachedGst = parsed2.gstPct;
          }
        }
      }
      if (cachedItems && cachedItems.length > 0) {
        const provisional = {
          ...item,
          items: cachedItems,
          gstPct: cachedGst ?? item.gstPct,
        };
        provisionalFromCache = provisional;
        setEditingItem(provisional);
      }
    } catch {}

    try {
      // Use unified API with caching
      const raw = (await unifiedApi.getTransactionById(item.id)) as {
        data: any;
        status: number;
        headers: Headers;
      };
      let detail = raw?.data || raw || {};
      try {
        console.log('🧾 SELL_DETAIL_API_RESPONSE', {
          id: item.id,
          keys: Object.keys(detail || {}),
          itemsType: Array.isArray(detail?.items)
            ? 'array'
            : typeof detail?.items,
          itemsLen: Array.isArray(detail?.items) ? detail.items.length : 0,
          txItemsLen: Array.isArray((detail as any)?.transactionItems)
            ? (detail as any).transactionItems.length
            : 0,
          vItemsLen: Array.isArray((detail as any)?.voucherItems)
            ? (detail as any).voucherItems.length
            : 0,
          sampleItems:
            Array.isArray(detail?.items) && detail.items.length > 0
              ? detail.items.slice(0, 2)
              : undefined,
        });
      } catch {}

      // Fallback: fetch voucher detail which may include voucherItems
      if (
        !detail ||
        ((!detail.items || detail.items.length === 0) &&
          !(detail as any).voucherItems)
      ) {
        try {
          // Use unified API - try vouchers endpoint if needed
          const voucherData = (await unifiedApi.get(
            `/vouchers/${item.id}?type=sell`,
          )) as { data: any; status: number; headers: Headers };
          if (voucherData) {
            const dv = voucherData?.data || voucherData || {};
            detail = { ...(detail || {}), ...dv };
            console.log('🧾 SELL_VOUCHER_FALLBACK_RESPONSE', {
              hasVoucherItems: Array.isArray((detail as any).voucherItems),
              voucherItemsLen: Array.isArray((detail as any).voucherItems)
                ? (detail as any).voucherItems.length
                : 0,
            });
          }
        } catch {}
      }

      // Helper: compute cache signature
      const buildSignature = (src: any): string | null => {
        try {
          const dt = (src?.date || src?.documentDate || '')
            .toString()
            .slice(0, 10);
          const name = (src?.partyName || src?.customerName || '')
            .toString()
            .trim()
            .toLowerCase();
          const total = Number(src?.totalAmount ?? src?.amount ?? 0) || 0;
          if (!dt || !name) return null;
          return `${dt}|${name}|${total}`;
        } catch {
          return null;
        }
      };

      // Helper: flatten [[...]] or parse string JSON and drop nested empty arrays
      const flatten = (val: any): any[] => {
        if (!val) return [];
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return flatten(parsed);
          } catch {
            return [];
          }
        }
        if (!Array.isArray(val)) return [];
        // Unwrap single nested array [[...]]
        if (val.length === 1 && Array.isArray(val[0])) {
          return flatten(val[0]);
        }
        const out: any[] = [];
        for (const it of val) {
          if (Array.isArray(it)) {
            // If nested array contains a single object, take it; otherwise skip
            if (
              it.length === 1 &&
              typeof it[0] === 'object' &&
              it[0] !== null
            ) {
              out.push(it[0]);
            }
            continue;
          }
          if (it && typeof it === 'object') {
            if (Object.keys(it).length > 0) out.push(it);
          }
        }
        return out;
      };

      let mergedItems: any[] = [];
      let gstFromDetail: number | undefined = undefined;

      if (detail) {
        // Handle items coming as string JSON, array of tuples, or nested [[...], [...]]
        const rawItems = (detail as any).items;
        if (typeof rawItems === 'string') {
          try {
            const parsed = JSON.parse(rawItems);
            if (Array.isArray(parsed)) {
              if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
                mergedItems = parsed[0];
              } else {
                mergedItems = parsed;
              }
            }
          } catch {}
        }
        if (!mergedItems || mergedItems.length === 0) {
          if (Array.isArray(rawItems) && Array.isArray(rawItems[0])) {
            // If it's [[...],[...]] or [[ [...], [...]]]
            if (Array.isArray(rawItems[0][0])) {
              mergedItems = rawItems[0];
            } else {
              mergedItems = rawItems as any[];
            }
          } else {
            mergedItems = flatten(rawItems);
          }
        }
        if (!mergedItems || mergedItems.length === 0)
          mergedItems = flatten((detail as any).transactionItems);
        if (!mergedItems || mergedItems.length === 0)
          mergedItems = flatten((detail as any).voucherItems);
        // If still empty, try JSON string mirrors often used by TEXT columns
        if (!mergedItems || mergedItems.length === 0) {
          const tryJson = (val: any): any[] => {
            try {
              if (typeof val === 'string' && val.trim()) {
                const parsed = JSON.parse(val);
                return flatten(parsed);
              }
            } catch {}
            return [];
          };
          const fromItemsJson = tryJson((detail as any).itemsJson);
          const fromTxJson = tryJson((detail as any).transactionItemsJson);
          const fromVJson = tryJson((detail as any).voucherItemsJson);
          mergedItems =
            (fromItemsJson && fromItemsJson.length > 0 && fromItemsJson) ||
            (fromTxJson && fromTxJson.length > 0 && fromTxJson) ||
            (fromVJson && fromVJson.length > 0 && fromVJson) ||
            mergedItems;
        }
        // If API still gave nothing, but the list item we clicked has items, take those
        if (
          (!mergedItems || mergedItems.length === 0) &&
          Array.isArray((item as any)?.items) &&
          (item as any).items.length > 0
        ) {
          mergedItems = flatten((item as any).items);
        }

        const gstRaw =
          (detail as any).gstPct ??
          (detail as any).gst_pct ??
          (detail as any).gst;
        gstFromDetail =
          typeof gstRaw === 'string'
            ? Number(gstRaw)
            : typeof gstRaw === 'number'
            ? gstRaw
            : undefined;
      }

      // Fallback to cache if needed
      if (
        !mergedItems ||
        mergedItems.length === 0 ||
        gstFromDetail === undefined
      ) {
        try {
          const cacheKey = `voucherItemsCache:${item.id}`;
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (
              (!mergedItems || mergedItems.length === 0) &&
              Array.isArray(parsed?.items)
            ) {
              mergedItems = parsed.items;
            }
            if (
              gstFromDetail === undefined &&
              typeof parsed?.gstPct === 'number'
            ) {
              gstFromDetail = parsed.gstPct;
            }
          }
          // Try invoice-based cache as a secondary key
          if (
            !mergedItems ||
            mergedItems.length === 0 ||
            gstFromDetail === undefined
          ) {
            const inv =
              (detail as any)?.invoiceNumber ||
              (detail as any)?.billNumber ||
              (item as any)?.invoiceNumber ||
              (item as any)?.billNumber;
            if (inv) {
              const invKey = `voucherItemsByInvoice:${String(inv)}`;
              const invCached = await AsyncStorage.getItem(invKey);
              if (invCached) {
                const parsed2 = JSON.parse(invCached);
                if (
                  (!mergedItems || mergedItems.length === 0) &&
                  Array.isArray(parsed2?.items)
                ) {
                  mergedItems = parsed2.items;
                }
                if (
                  gstFromDetail === undefined &&
                  typeof parsed2?.gstPct === 'number'
                ) {
                  gstFromDetail = parsed2.gstPct;
                }
              }
            }
          }
          // Try signature-based cache if still empty
          if (!mergedItems || mergedItems.length === 0) {
            const sig = buildSignature(detail) || buildSignature(item);
            if (sig) {
              const sigKey = `voucherItemsBySig:${sig}`;
              const sigCached = await AsyncStorage.getItem(sigKey);
              if (sigCached) {
                const parsed3 = JSON.parse(sigCached);
                if (Array.isArray(parsed3?.items)) mergedItems = parsed3.items;
                if (
                  gstFromDetail === undefined &&
                  typeof parsed3?.gstPct === 'number'
                ) {
                  gstFromDetail = parsed3.gstPct;
                }
              }
            }
          }
          // Final fallback to recent rolling cache
          if (!mergedItems || mergedItems.length === 0) {
            try {
              const recent =
                (await AsyncStorage.getItem('recentSellItemCache')) || '[]';
              const arr = JSON.parse(recent);
              if (Array.isArray(arr) && arr.length > 0) {
                const matched =
                  arr.find((x: any) => String(x?.id) === String(item.id)) ||
                  arr[0];
                if (matched && Array.isArray(matched.items)) {
                  mergedItems = matched.items;
                  if (
                    gstFromDetail === undefined &&
                    typeof matched.gstPct === 'number'
                  ) {
                    gstFromDetail = matched.gstPct;
                  }
                  console.log(
                    '♻️ Using recentSellItemCache fallback for items',
                  );
                }
              }
            } catch {}
          }
        } catch {}
      }

      // Treat arrays like [[]] or [{}] with empty values as no-items
      const isEmptyItem = (it: any) => {
        if (!it) return true;
        if (Array.isArray(it)) return it.length === 0;
        if (typeof it === 'object') {
          const desc = (it.description ?? it.name ?? '').toString().trim();
          const q = Number(it.quantity ?? it.qty);
          const r = Number(it.rate ?? it.price);
          const a = Number(it.amount ?? it.total);
          return !desc && !(q > 0) && !(r > 0) && !(a > 0);
        }
        return false;
      };
      if (Array.isArray(mergedItems)) {
        const nonEmpty = mergedItems.filter(it => !isEmptyItem(it));
        mergedItems = nonEmpty;
      }

      // Detect placeholder/synthesized item and try to replace from caches
      const hasMultipleItemsNow =
        Array.isArray(mergedItems) && mergedItems.length > 1;
      const looksLikePlaceholder = (arr: any[]): boolean => {
        if (!Array.isArray(arr) || arr.length !== 1) return false;
        const it: any = arr[0] || {};
        const desc = (it.description ?? it.name ?? '').toString().trim();
        const q = Number(it.quantity ?? it.qty) || 0;
        const r = Number(it.rate ?? it.price) || 0;
        const subtotal = Number(detail?.subTotal) || 0;
        const close = subtotal > 0 && Math.abs(q * r - subtotal) < 1e-6;
        return (
          (!desc || desc === 'Item 1') &&
          (q === 1 || q === 0) &&
          (close || r > 0)
        );
      };
      if (
        !hasMultipleItemsNow &&
        (!mergedItems ||
          mergedItems.length === 0 ||
          looksLikePlaceholder(mergedItems))
      ) {
        try {
          let replacement: any[] | null = null;
          const byId = await AsyncStorage.getItem(
            `voucherItemsCache:${item.id}`,
          );
          if (byId) {
            const p = JSON.parse(byId);
            if (Array.isArray(p?.items) && p.items.length > 0)
              replacement = p.items;
          }
          if (!replacement) {
            const inv =
              (detail as any)?.invoiceNumber ||
              (item as any)?.invoiceNumber ||
              (item as any)?.billNumber;
            if (inv) {
              const byInv = await AsyncStorage.getItem(
                `voucherItemsByInvoice:${String(inv)}`,
              );
              if (byInv) {
                const p2 = JSON.parse(byInv);
                if (Array.isArray(p2?.items) && p2.items.length > 0)
                  replacement = p2.items;
              }
            }
          }
          if (!replacement) {
            const sig = buildSignature(detail) || buildSignature(item);
            if (sig) {
              const bySig = await AsyncStorage.getItem(
                `voucherItemsBySig:${sig}`,
              );
              if (bySig) {
                const p3 = JSON.parse(bySig);
                if (Array.isArray(p3?.items) && p3.items.length > 0)
                  replacement = p3.items;
              }
            }
          }
          if (!replacement) {
            const recent =
              (await AsyncStorage.getItem('recentSellItemCache')) || '[]';
            const arr = JSON.parse(recent);
            const m = Array.isArray(arr)
              ? arr.find((x: any) => String(x?.id) === String(item.id))
              : null;
            if (m && Array.isArray(m.items) && m.items.length > 0)
              replacement = m.items;
          }
          if (replacement) {
            mergedItems = replacement;
            console.log('✅ Replaced placeholder items with cached items');
          }
        } catch {}
      }

      // If still no items but we have amounts, synthesize one
      if (
        !hasMultipleItemsNow &&
        (!mergedItems || mergedItems.length === 0) &&
        (detail?.subTotal != null ||
          detail?.totalAmount != null ||
          item?.amount != null)
      ) {
        const st = Number(detail?.subTotal) || 0;
        const ta = Number(detail?.totalAmount) || 0;
        const g = typeof gstFromDetail === 'number' ? gstFromDetail : 0;
        const base =
          st > 0 ? st : ta > 0 ? ta / (1 + g / 100) : Number(item?.amount) || 0;
        mergedItems = [
          {
            id: '1',
            // Choose a neutral placeholder; never use overall notes/party
            name: 'Item 1',
            description: 'Item 1',
            quantity: 1,
            rate: base > 0 ? base : 0,
            amount: base * (1 + g / 100),
          },
        ];
      }

      const enriched = {
        ...item,
        ...(detail || {}),
        partyName:
          detail?.partyName ||
          detail?.customerName ||
          item?.partyName ||
          item?.customerName ||
          '',
        partyPhone:
          detail?.partyPhone ||
          detail?.phone ||
          detail?.phoneNumber ||
          item?.partyPhone ||
          '',
        partyAddress:
          detail?.partyAddress ||
          detail?.address ||
          detail?.addressLine1 ||
          item?.partyAddress ||
          '',
        items: mergedItems,
        gstPct:
          typeof gstFromDetail === 'number' ? gstFromDetail : item?.gstPct,
      };

      if (Array.isArray(mergedItems) && mergedItems.length > 0) {
        setEditingItem(enriched);
      } else if (provisionalFromCache) {
        // Keep cached items if API returned none
        setEditingItem(provisionalFromCache);
      } else {
        setEditingItem(enriched);
      }
    } catch (e) {
      // On error, fall back to the list item
      setEditingItem(item);
    } finally {
      setIsFetchingEdit(false);
    }
  };

  // 3. In the form, pre-fill fields from editingItem if set
  useEffect(() => {
    if (editingItem) {
      // Normalize party details similar to PurchaseScreen
      const partyDisplayName =
        editingItem.partyName ||
        editingItem.customerName ||
        (editingItem as any).party_name ||
        (editingItem as any).customer_name ||
        '';
      setCustomerName(partyDisplayName || '');

      let phoneCandidate =
        editingItem.partyPhone ||
        (editingItem as any).phone ||
        (editingItem as any).phoneNumber ||
        (editingItem as any).phone_number ||
        '';
      try {
        phoneCandidate = String(phoneCandidate)
          .replace(/^\+?91-?/, '')
          .replace(/\D/g, '')
          .slice(-10);
      } catch {}
      setCustomerPhone(phoneCandidate);

      const addressCandidate =
        editingItem.partyAddress ||
        (editingItem as any).address ||
        (editingItem as any).addressLine1 ||
        (editingItem as any).address_line1 ||
        '';
      setCustomerAddress(addressCandidate || '');

      // Ensure the visible customer field shows the selected customer's name
      try {
        if (partyDisplayName) setCustomer(partyDisplayName);
      } catch {}
      // Ensure GST percentage is populated from detail
      try {
        let newGstPct: number | undefined =
          typeof editingItem.gstPct === 'number' && !isNaN(editingItem.gstPct)
            ? Number(editingItem.gstPct)
            : undefined;
        if (
          newGstPct === undefined &&
          typeof (editingItem as any).cGST === 'number' &&
          typeof (editingItem as any).subTotal === 'number' &&
          (editingItem as any).subTotal > 0
        ) {
          const pct = Math.round(
            (((editingItem as any).cGST / (editingItem as any).subTotal) *
              100) as number,
          );
          if (isFinite(pct)) newGstPct = pct;
        }
        if (newGstPct !== undefined) setGstPct(newGstPct);
      } catch {}
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
      // Prefer whichever items array exists on the entity
      const sourceItems =
        (editingItem.items && editingItem.items.length > 0
          ? editingItem.items
          : null) ||
        (editingItem.transactionItems && editingItem.transactionItems.length > 0
          ? editingItem.transactionItems
          : null) ||
        (editingItem.voucherItems && editingItem.voucherItems.length > 0
          ? editingItem.voucherItems
          : null) ||
        (editingItem._raw &&
        editingItem._raw.items &&
        editingItem._raw.items.length > 0
          ? editingItem._raw.items
          : null) ||
        (editingItem._raw &&
        editingItem._raw.transactionItems &&
        editingItem._raw.transactionItems.length > 0
          ? editingItem._raw.transactionItems
          : null) ||
        (editingItem._raw &&
        editingItem._raw.voucherItems &&
        editingItem._raw.voucherItems.length > 0
          ? editingItem._raw.voucherItems
          : null);

      if (Array.isArray(sourceItems) && sourceItems.length > 0) {
        const toNumber = (val: any): number => {
          if (val == null) return NaN;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const cleaned = val.replace(/₹/g, '').replace(/,/g, '').trim();
            const n = Number(cleaned);
            return isNaN(n) ? NaN : n;
          }
          return NaN;
        };
        const mapped = sourceItems.map((it: any, idx: number) => {
          let desc = '';
          let qty = 0;
          let rateVal = 0;
          let gstValue = 0;
          let amtVal: number | undefined = undefined;

          if (Array.isArray(it)) {
            // Tuple-style row: [name, qty, rate, amount, gstPct]
            const nameCandidate = it[0];
            desc = typeof nameCandidate === 'string' ? nameCandidate : '';
            qty = toNumber(it[1]);
            rateVal = toNumber(it[2]);
            amtVal = toNumber(it[3]);
            gstValue = toNumber(it[4]) || 0;
          } else if (typeof it === 'object' && it) {
            // Support both lowercase and TitleCase keys (from TEXT JSON mirrors)
            desc = (
              it.description ??
              it.name ??
              it.itemName ??
              (it as any).Description ??
              ''
            ).toString();
            qty = toNumber(
              it.qty ?? it.quantity ?? (it as any).Quantity ?? it.qtyNum,
            );
            rateVal = toNumber(
              it.rate ??
                it.price ??
                it.unitPrice ??
                it.unit_price ??
                (it as any).Rate,
            );
            gstValue =
              toNumber(it.gstPct ?? it.gst ?? it.taxPct ?? it.tax_pct) || 0;
            amtVal = toNumber(
              it.amount ??
                it.total ??
                it.lineTotal ??
                it.line_total ??
                (it as any).Amount,
            );
          }

          if (!isFinite(qty)) qty = 0;
          if (!isFinite(rateVal)) rateVal = 0;
          if (!isFinite(gstValue)) gstValue = 0;

          const subtotal = (qty || 0) * (rateVal || 0);
          const gstAmount = subtotal * (gstValue / 100);
          const amount =
            isFinite(amtVal as number) && (amtVal as number) > 0
              ? (amtVal as number)
              : subtotal + gstAmount;

          console.log('Loading item from editing (normalized):', {
            id: String(idx + 1),
            desc,
            qty,
            rateVal,
            gstPct: gstValue,
            subtotal,
            gstAmount,
            amount,
            raw: it,
          });

          return {
            id: String(idx + 1),
            description: desc || `Item ${idx + 1}`,
            quantity: qty,
            rate: rateVal,
            gstPct: gstValue,
            amount,
          };
        });
        setItems(mapped);
      } else {
        setItems([
          {
            id: '1',
            description: '',
            quantity: 1,
            rate: 0,
            gstPct: 18,
            amount: 0,
          },
        ]);
      }
      setInvoiceNumber(
        editingItem.invoiceNumber || editingItem.billNumber || '',
      );

      setNotes(editingItem.notes || '');
      setSelectedCustomer(editingItem.partyName || '');
      // Populate tax and discount amounts if present on the entity (support multiple keys)
      try {
        const taxRaw =
          (editingItem as any).cGST ??
          (editingItem as any).taxAmount ??
          (editingItem as any).tax ??
          (editingItem as any).cgst;
        const discountRaw =
          (editingItem as any).discount ??
          (editingItem as any).discountAmount ??
          (editingItem as any).discount_amt;
        // Tax Amount should show ONLY GST amount, not other taxes
        const subtotal = calculateSubtotal();
        const currentGstPct =
          typeof editingItem.gstPct === 'number' && !isNaN(editingItem.gstPct)
            ? Number(editingItem.gstPct)
            : gstPct;
        const gstAmount = subtotal * (currentGstPct / 100);
        setTaxAmount(gstAmount);
        if (discountRaw !== undefined)
          setDiscountAmount(Number(discountRaw) || 0);
      } catch {}
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

    // Auto-generate next invoice number (preview only - don't store until transaction is saved)
    try {
      // Preview only - don't store until transaction is saved
      const nextInvoiceNumber = await generateNextDocumentNumber(
        folderType || folderName.toLowerCase(),
        false, // Don't store - this is just a preview
      );
      setInvoiceNumber(nextInvoiceNumber);
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Generator fallback will return 'SEL-001' for new users (sell type)
      setInvoiceNumber('SEL-001');
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
      // Address validation: should not be empty
      return !field;
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
      case 'selectedCustomer': {
        const hasCustomer = (() => {
          const textName = (customer || '').toString().trim();
          if (textName.length > 0) return true;
          if (typeof selectedCustomer === 'string') {
            return selectedCustomer.trim().length > 0;
          }
          const derivedName =
            (selectedCustomer as any)?.name ||
            (selectedCustomer as any)?.partyName ||
            '';
          return (derivedName || '').toString().trim().length > 0;
        })();
        return !hasCustomer ? 'Customer is required' : '';
      }
      case 'customerPhone': {
        if (!customerPhone) return 'Phone is required';
        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (!/^([6-9])\d{9}$/.test(phoneDigits)) {
          return 'Indian mobile number must start with 6, 7, 8, or 9';
        }
        return '';
      }
      case 'customerAddress':
        if (!customerAddress) return 'Address is required';
        return '';
      default:
        return '';
    }
  };

  // Helper functions for validation
  const isValidPhoneValue = (val?: string) => {
    if (!val) return false;
    const digits = String(val).replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  };

  const isValidAddressValue = (val?: string) => {
    if (!val) return false;
    return String(val).trim().length >= 5;
  };

  // Helper: directly PATCH customer fields if user edited name/address during edit
  const persistCustomerDirectPatch = useCallback(
    async (customerId?: number, name?: string, address?: string) => {
      try {
        if (!customerId) return;
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) return;
        const payload: any = {};
        if (name && String(name).trim()) {
          const trimmed = String(name).trim();
          payload.partyName = trimmed;
          payload.name = trimmed; // some backends use `name` instead of `partyName`
        }
        if (isValidAddressValue(address)) {
          payload.address = address;
          payload.addressLine1 = address;
          payload.addresses = [
            { type: 'billing', flatBuildingNumber: address },
          ];
        }
        if (Object.keys(payload).length === 0) return;
        // Use unified API for update
        await unifiedApi.updateCustomer(customerId, payload);
      } catch {}
    },
    [],
  );

  // API submit handler
  const handleSubmit = async (
    status: 'complete' | 'draft',
    syncYNOverride?: 'Y' | 'N',
  ) => {
    console.log('handleSubmit called with status:', status);
    setTriedSubmit(true);
    setError(null);
    setSuccess(null);

    // Validate required fields BEFORE showing loader or calling API
    const hasCustomerSelected = (() => {
      const textName = (customer || '').toString().trim();
      if (textName.length > 0) return true;
      if (typeof selectedCustomer === 'string') {
        return selectedCustomer.trim().length > 0;
      }
      const derivedName =
        (selectedCustomer as any)?.name ||
        (selectedCustomer as any)?.partyName ||
        '';
      return (derivedName || '').toString().trim().length > 0;
    })();
    console.log('Validating fields:', {
      invoiceDate,
      selectedCustomer,
      customerText: customer,
      hasCustomerSelected,
      customerPhone,
      customerAddress,
    });

    if (!invoiceDate || !hasCustomerSelected) {
      console.log('Required fields validation failed');
      setError('Please fill all required fields correctly.');
      setShowModal(true);
      setTimeout(
        () =>
          scrollToErrorField(
            'validation',
            !invoiceDate ? 'invoiceDate' : 'customerInput',
          ),
        200,
      );
      return;
    }

    // Prepare async prerequisites early so they can run concurrently with other work
    const userIdPromise = getUserIdFromToken();
    const nextInvoiceNumberPromise = !editingItem
      ? generateNextDocumentNumber(
          folderType || folderName.toLowerCase(),
          true,
        ).catch(error => {
          console.error('Error generating invoice number:', error);
          return null;
        })
      : Promise.resolve<string | null>(null);

    // Validate optional fields if they have values
    if (customerPhone && isFieldInvalid(customerPhone, 'phone')) {
      setError(
        'Phone number must be at least 10 digits and cannot exceed 16 digits.',
      );
      setShowModal(true);
      setTimeout(() => scrollToErrorField('validation', 'customerPhone'), 200);
      return;
    }

    if (customerAddress && isFieldInvalid(customerAddress, 'address')) {
      setError('Address is required.');
      setShowModal(true);
      setTimeout(
        () => scrollToErrorField('validation', 'customerAddress'),
        200,
      );
      return;
    }
    // Block API when transaction limit reached
    try {
      await forceCheckTransactionLimit();
    } catch (e) {
      // Treat any limit error as block
      await forceShowPopup();
      setError(
        'Transaction limit reached. Please upgrade your plan to continue.',
      );
      setShowModal(true);
      return;
    }

    if (status === 'complete') setLoadingSave(true);
    if (status === 'draft') setLoadingDraft(true);
    try {
      // Check if customer exists, if not, create
      const selectedCustomerName = (() => {
        const textName = (customer || '').toString().trim();
        if (textName.length > 0) return textName;
        if (typeof selectedCustomer === 'string') return selectedCustomer;
        return (
          selectedCustomer?.name ||
          (selectedCustomer as any)?.partyName ||
          ''
        ).toString();
      })();
      let customerNameToUse = selectedCustomerName.trim();
      let existingCustomer = customers.find(
        c =>
          (c.partyName || '').toString().trim().toLowerCase() ===
          customerNameToUse.toLowerCase(),
      );
      if (!existingCustomer) {
        const isValidPhone = (val?: string) => {
          if (!val) return false;
          const digits = String(val).replace(/\D/g, '');
          return digits.length >= 10 && digits.length <= 13;
        };
        const isValidAddress = (val?: string) => {
          if (!val) return false;
          return String(val).trim().length >= 5;
        };
        const newCustomer = await add({
          partyName: customerNameToUse,
          phoneNumber: isValidPhone(customerPhone) ? customerPhone : undefined,
          address: isValidAddress(customerAddress)
            ? customerAddress
            : undefined,
        } as any);
        if (newCustomer) {
          customerNameToUse = newCustomer.partyName || '';
        }
        fetchAll('').catch(() => {});
        // Try to refresh existingCustomer after creation
        existingCustomer = (customers || []).find(
          c =>
            (c.partyName || '').toString().trim().toLowerCase() ===
            customerNameToUse.toLowerCase(),
        ) as any;
        if (!existingCustomer && (newCustomer as any)?.id) {
          existingCustomer = newCustomer as any;
        }
      }
      // Resolve customerId reliably after potential creation
      let resolvedCustomerId: number | null = null;
      try {
        const refreshed = customers && customers.length > 0 ? customers : [];
        // When editing, prefer customer ID from editingItem first
        if (editingItem) {
          const editingCustomerId =
            editingItem.partyId ||
            editingItem.customer_id ||
            (editingItem as any).customerId;
          if (editingCustomerId) {
            resolvedCustomerId = Number(editingCustomerId);
            // Find existingCustomer by ID when editing
            if (!existingCustomer && resolvedCustomerId) {
              existingCustomer = refreshed.find(
                c => Number(c.id) === resolvedCustomerId,
              ) as any;
            }
          }
        }
        // Prefer selectedCustomer.id if available
        if (
          !resolvedCustomerId &&
          selectedCustomer &&
          (selectedCustomer as any).id
        ) {
          resolvedCustomerId = Number((selectedCustomer as any).id);
        }
        // If we just created/found an existingCustomer above, use it directly
        if (!resolvedCustomerId && (existingCustomer as any)?.id) {
          resolvedCustomerId = Number((existingCustomer as any).id);
        }
        const foundAfter = !resolvedCustomerId
          ? refreshed.find(
              c =>
                (c.partyName || '').toString().trim().toLowerCase() ===
                customerNameToUse.toLowerCase(),
            )
          : null;
        if (!resolvedCustomerId && foundAfter?.id)
          resolvedCustomerId = Number(foundAfter.id);
        // If still not found, try by current state
        if (!resolvedCustomerId && customerId) resolvedCustomerId = customerId;
        if (resolvedCustomerId) {
          console.log('✅ Resolved customerId for Sell:', resolvedCustomerId);
        } else {
          console.log('❌ Could not resolve customerId; blocking save');
        }
      } catch {}

      const userId = await userIdPromise;
      if (!userId) {
        setError('User not authenticated. Please login again.');
        setTimeout(() => scrollToErrorField('api'), 100);
        return;
      }

      // Always regenerate document number on submit for new transactions (not editing)
      // This ensures accuracy even if other transactions were created since initialization
      let finalInvoiceNumber = invoiceNumber || '';
      if (!editingItem) {
        const generatedInvoiceNumber = await nextInvoiceNumberPromise;
        if (generatedInvoiceNumber) {
          finalInvoiceNumber = generatedInvoiceNumber;
          setInvoiceNumber(generatedInvoiceNumber);
          console.log(
            '🔍 Generated invoiceNumber on submit:',
            generatedInvoiceNumber,
          );
        } else {
          // Fallback: use preview number if available, otherwise default to SEL-001
          finalInvoiceNumber = invoiceNumber || 'SEL-001';
        }
      } else {
        // Editing - use existing number or preview number
        finalInvoiceNumber =
          invoiceNumber ||
          editingItem.invoiceNumber ||
          editingItem.billNumber ||
          '';
      }

      // Validate and prepare items (include description-only rows)
      const validItems = items.filter(it => Boolean(it.description?.trim()));
      if (validItems.length === 0) {
        setError('Please add at least one item description.');
        setShowModal(true);
        setTimeout(() => scrollToErrorField('validation'), 200);
        return;
      }
      const itemPayload = validItems.map(it => {
        const desc = it.description?.trim() || '';
        const hasQtyRate = Number(it.quantity) > 0 && Number(it.rate) > 0;
        const qtyNum = hasQtyRate
          ? Number(it.quantity)
          : Number(it.quantity) || 0; // preserve 0 when not provided
        const inferredRateFromAmount = (() => {
          const amt = Number(it.amount);
          if (!isNaN(amt) && amt > 0) {
            // assume amount includes GST; derive base rate before GST for qty 1
            const base = amt / (1 + (Number(gstPct) || 0) / 100);
            return base;
          }
          return 0;
        })();
        const rateNum = hasQtyRate
          ? Number(it.rate)
          : Number(it.rate) || inferredRateFromAmount;
        const lineGstPct =
          typeof (it as any).gstPct === 'number' && !isNaN((it as any).gstPct)
            ? Number((it as any).gstPct)
            : Number(gstPct) || 0;
        const amountNum = (() => {
          const provided = Number(it.amount);
          if (!isNaN(provided) && provided > 0) return provided;
          const subtotal = (Number(qtyNum) || 0) * (Number(rateNum) || 0);
          return subtotal * (1 + lineGstPct / 100);
        })();

        return {
          // Common keys used by different backends
          name: desc,
          itemName: desc,
          quantity: qtyNum,
          qty: qtyNum,
          rate: rateNum,
          price: rateNum,
          unitPrice: rateNum,
          unit_price: rateNum,
          amount: amountNum,
          total: amountNum,
          lineTotal: amountNum,
          line_total: amountNum,
          // Per-line tax
          gstPct: lineGstPct,
          gst: lineGstPct,
          taxPct: lineGstPct,
          tax_pct: lineGstPct,
          // Explicit keys requested
          Description: desc,
          Quantity: qtyNum,
          Rate: rateNum,
          Amount: amountNum,
        };
      });

      // Calculate GST, subtotal, total using itemPayload (line-wise GST aware)
      const subTotal = itemPayload.reduce((sum, it) => {
        const q = Number((it as any).quantity) || 0;
        const r = Number((it as any).rate) || 0;
        return sum + q * r;
      }, 0);
      const gstAmount = itemPayload.reduce((sum, it) => {
        const q = Number((it as any).quantity) || 0;
        const r = Number((it as any).rate) || 0;
        const pct =
          Number((it as any).gstPct ?? (it as any).gst ?? gstPct) || 0;
        return sum + q * r * (pct / 100);
      }, 0);
      const totalAmount = subTotal + gstAmount - discountAmount;
      // Text-friendly representation for servers storing TEXT columns
      // Create minimized item payload strictly matching backend DTO
      const simpleItemPayload = itemPayload.map(it => ({
        name: (it as any).name || (it as any).description || '',
        quantity: Number((it as any).quantity) || 0,
        rate: Number((it as any).rate) || 0,
        amount: Number((it as any).amount) || 0,
        gstPct: Number((it as any).gstPct ?? (it as any).gst) || 0,
      }));

      const itemsForText = simpleItemPayload.map(it => ({
        Description: (it as any).name || '',
        Quantity: Number(it.quantity) || 0,
        Rate: Number(it.rate) || 0,
        GST: Number((it as any).gstPct ?? (it as any).gst) || 0,
        Amount: Number(it.amount) || 0,
      }));

      // Build API body for transactions.create (strict fields, omit nulls/undefined)
      const baseBody: any = {
        type: 'credit',
        amount: Number(totalAmount.toFixed(2)),
        date: invoiceDate, // keep as YYYY-MM-DD to preserve exact selected date
        documentDate: invoiceDate, // keep as YYYY-MM-DD
        // send additional mirrors many backends accept
        transactionDate: invoiceDate,
        invoiceDate: invoiceDate,
        // snake_case aliases
        transaction_date: invoiceDate,
        document_date: invoiceDate,
        invoice_date: invoiceDate,
        status,
        notes: notes || '',
        // Keep description independent from line items to avoid DB "description" being a line item
        description: '',
        method: 'Sell',
        // Force partyName from visible input even if dropdown object not selected
        partyName: (customer || '').toString().trim() || customerNameToUse,
        party_name: (customer || '').toString().trim() || customerNameToUse,
        partyPhone: customerPhone || undefined,
        partyAddress: customerAddress || undefined,
        gstNumber: undefined,
        // user metadata like PurchaseScreen
        user_id: userId,
        createdBy: userId,
        updatedBy: userId,
        // roleId will be added below
        // Items fields must be arrays (align with PurchaseScreen)
        items: simpleItemPayload,
        transactionItems: simpleItemPayload,
        voucherItems: simpleItemPayload,
        // Provide TEXT column mirrors as JSON strings (for backends persisting TEXT)
        itemsJson: JSON.stringify(itemsForText),
        transactionItemsJson: JSON.stringify(itemsForText),
        voucherItemsJson: JSON.stringify(itemsForText),
        invoiceNumber: (finalInvoiceNumber || '').trim() || undefined,
        gstPct: gstPct,
        gst_pct: gstPct,
        discount: discountAmount || undefined,
        discountAmount: discountAmount || undefined,
        cGST: taxAmount || undefined,
        c_gst: taxAmount || undefined,
        subTotal: subTotal,
        sub_total: subTotal,
        totalAmount: totalAmount,
        total_amount: totalAmount,
        syncYN: syncYNOverride || syncYN,
      };
      if (resolvedCustomerId) {
        baseBody.customerId = resolvedCustomerId;
        baseBody.customer_id = resolvedCustomerId; // for backward compatibility
        // Provide party id for compatibility with older schemas
        (baseBody as any).partyId = resolvedCustomerId;
        (baseBody as any).party_id = resolvedCustomerId;
      }

      // Include user's primary role id for backend auditing/mapping
      try {
        const { addRoleIdToBody } = await import('../../utils/roleHelper');
        await addRoleIdToBody(baseBody);
      } catch (e) {
        console.warn('⚠️ InvoiceScreen: Failed to add role ID:', e);
      }

      // If backend requires a customer relation, block when missing
      if (!resolvedCustomerId) {
        setError('Please select a valid customer before saving.');
        setShowModal(true);
        setTimeout(
          () => scrollToErrorField('validation', 'customerInput'),
          200,
        );
        if (status === 'complete') setLoadingSave(false);
        if (status === 'draft') setLoadingDraft(false);
        return;
      }

      // If user changed name/address from the selected customer, push an update
      try {
        // Ensure we have existingCustomer - try to find by resolvedCustomerId if not found by name
        if (!existingCustomer && resolvedCustomerId) {
          const refreshed = customers && customers.length > 0 ? customers : [];
          existingCustomer = refreshed.find(
            c => Number(c.id) === resolvedCustomerId,
          ) as any;
        }

        if (existingCustomer && resolvedCustomerId) {
          const customerInputName = (customer || customerName || '')
            .toString()
            .trim();
          // When editing, compare against original values from editingItem
          // When creating, compare against existing customer values
          const originalName = editingItem
            ? editingItem.partyName || editingItem.customerName || ''
            : (existingCustomer as any).partyName ||
              (existingCustomer as any).name ||
              '';

          const originalAddress = editingItem
            ? editingItem.partyAddress || editingItem.customerAddress || ''
            : (existingCustomer as any).address || '';

          const needsNameUpdate =
            customerInputName.trim() !== originalName.trim();
          const needsAddressUpdate =
            isValidAddressValue(customerAddress) &&
            customerAddress.trim() !== (originalAddress || '').trim();

          console.log('🔍 InvoiceScreen: Checking customer update:', {
            existingCustomer: !!existingCustomer,
            customerId: (existingCustomer as any)?.id,
            resolvedCustomerId,
            customerInputName,
            originalName,
            customerAddress,
            originalAddress,
            needsNameUpdate,
            needsAddressUpdate,
            editingItem: !!editingItem,
            customerState: customer,
            customerNameState: customerName,
          });

          if (needsNameUpdate || needsAddressUpdate) {
            console.log('🔍 InvoiceScreen: Updating customer details:', {
              customerId: (existingCustomer as any).id,
              originalName,
              originalAddress,
              currentName: customerInputName,
              currentAddress: customerAddress,
              needsNameUpdate,
              needsAddressUpdate,
              editingItem: !!editingItem,
            });
            await persistCustomerDirectPatch(
              (existingCustomer as any).id,
              customerInputName,
              needsAddressUpdate ? customerAddress : undefined,
            );
            // Refresh customers list to get updated data
            fetchAll('').catch(() => {});
            // Update existingCustomer reference after refresh
            const refreshedAfter =
              customers && customers.length > 0 ? customers : [];
            existingCustomer = refreshedAfter.find(
              c => Number(c.id) === resolvedCustomerId,
            ) as any;
            console.log('✅ InvoiceScreen: Customer updated successfully');
          } else {
            console.log('ℹ️ InvoiceScreen: No customer update needed');
          }
        } else {
          console.log(
            '⚠️ InvoiceScreen: No existingCustomer found, skipping customer update',
            {
              existingCustomer: !!existingCustomer,
              resolvedCustomerId,
            },
          );
        }
      } catch (error) {
        console.error('❌ InvoiceScreen: Error updating customer:', error);
        // Don't block the transaction save if customer update fails
      }

      // Prune null/undefined fields
      const cleanBody: any = Object.fromEntries(
        Object.entries(baseBody).filter(
          ([, v]) => v !== null && v !== undefined,
        ),
      );
      // Prepare API-specific body (transactions only, keep arrays)
      const transBody: any = {
        ...cleanBody,
        // Extra mirrors for maximum backend compatibility
        // Prefer array for primary items; also include string mirrors below
        items: simpleItemPayload.map(it => [
          (it as any).name,
          Number((it as any).quantity) || 0,
          Number((it as any).rate) || 0,
          Number((it as any).amount) || 0,
          Number((it as any).gstPct) || 0,
        ]),
        lineItems: simpleItemPayload,
        line_items: simpleItemPayload,
        items_text: JSON.stringify(itemsForText),
        transaction_items_json: JSON.stringify(itemsForText),
        voucher_items_json: JSON.stringify(itemsForText),
        itemsString: JSON.stringify(simpleItemPayload),
        transactionItemsString: JSON.stringify(simpleItemPayload),
        voucherItemsString: JSON.stringify(simpleItemPayload),
        itemsRawJson: JSON.stringify(simpleItemPayload),
      };
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        setError('Authentication token not found. Please login again.');
        setTimeout(() => scrollToErrorField('api'), 100);
        return;
      }
      let res;
      try {
        console.log('📤 SELL_CREATE_REQUEST', {
          url: `${BASE_URL}/transactions`,
          partyName: baseBody.partyName,
          customerId: baseBody.customerId,
          date: baseBody.date,
          gstPct: baseBody.gstPct,
          subTotal: baseBody.subTotal,
          totalAmount: baseBody.totalAmount,
          itemsCount: (baseBody.items || []).length,
          sampleItem: (baseBody.items || [])[0],
        });
      } catch {}
      if (editingItem) {
        // PUT update to transactions endpoint (align with PurchaseScreen)
        const putBody: any = {
          type: 'credit',
          date: invoiceDate, // ensure exact selected date is persisted
          documentDate: invoiceDate, // keep as YYYY-MM-DD
          transactionDate: invoiceDate,
          invoiceDate: invoiceDate,
          // snake_case aliases
          transaction_date: invoiceDate,
          document_date: invoiceDate,
          invoice_date: invoiceDate,
          amount: Number(cleanBody.amount),
          status: cleanBody.status,
          notes: cleanBody.notes,
          // Avoid overwriting DB description with first item description
          description: '',
          method: (cleanBody as any).method,
          partyName:
            (customer || '').toString().trim() || (cleanBody as any).partyName,
          partyPhone: cleanBody.partyPhone,
          partyAddress: cleanBody.partyAddress,
          gstNumber: (cleanBody as any).gstNumber,
          user_id: userId,
          createdBy: userId,
          updatedBy: userId,
          customerId: resolvedCustomerId,
          customer_id: resolvedCustomerId,
          // pass party id for compatibility
          partyId: resolvedCustomerId,
          party_id: resolvedCustomerId,
          // Items and financial fields
          invoiceNumber:
            finalInvoiceNumber ||
            editingItem.invoiceNumber ||
            editingItem.billNumber ||
            '', // Include invoiceNumber for updates
          items:
            simpleItemPayload.length > 0
              ? simpleItemPayload.map(it => [
                  (it as any).name,
                  Number((it as any).quantity) || 0,
                  Number((it as any).rate) || 0,
                  Number((it as any).amount) || 0,
                  Number((it as any).gstPct) || 0,
                ])
              : Array.isArray((cleanBody as any).items)
              ? (cleanBody as any).items
              : [],
          transactionItems:
            simpleItemPayload.length > 0 ? simpleItemPayload : [],
          voucherItems: simpleItemPayload.length > 0 ? simpleItemPayload : [],
          // TEXT mirrors for resiliency
          itemsJson: JSON.stringify(itemsForText),
          transactionItemsJson: JSON.stringify(itemsForText),
          voucherItemsJson: JSON.stringify(itemsForText),
          // Additional mirrors to satisfy older DTOs / snake_case schemas
          lineItems: simpleItemPayload.length > 0 ? simpleItemPayload : [],
          line_items: simpleItemPayload.length > 0 ? simpleItemPayload : [],
          items_text: JSON.stringify(itemsForText),
          transaction_items_json: JSON.stringify(itemsForText),
          voucher_items_json: JSON.stringify(itemsForText),
          itemsString: JSON.stringify(simpleItemPayload),
          transactionItemsString: JSON.stringify(simpleItemPayload),
          voucherItemsString: JSON.stringify(simpleItemPayload),
          itemsRawJson: JSON.stringify(simpleItemPayload),
          gstPct: cleanBody.gstPct,
          discount: cleanBody.discount,
          cGST: cleanBody.cGST,
          subTotal: (cleanBody as any).subTotal,
          totalAmount: (cleanBody as any).totalAmount,
          syncYN: (cleanBody as any).syncYN,
        };
        console.log('🧾 SELL_UPDATE_REQUEST (transactions PUT)', {
          id: editingItem.id,
          url: `${BASE_URL}/transactions/${editingItem.id}`,
          body: putBody,
        });
        // Use unified API for update
        await unifiedApi.updateTransaction(editingItem.id, putBody);
        try {
          const upsertNames = (simpleItemPayload || [])
            .map(it => String((it as any).name || ''))
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (upsertNames.length > 0) {
            upsertItemNames(Array.from(new Set(upsertNames)).slice(0, 50))
              .then(result => {
                console.log('✅ Items upserted successfully:', result);
              })
              .catch(error => {
                console.error('❌ Items upsert failed:', error);
              });
          } else {
            console.log('⚠️ No item names to upsert (all empty)');
          }
        } catch (error) {
          console.error('❌ Items upsert error:', error);
        }
      } else {
        console.log('🧾 SELL_CREATE_REQUEST (transactions POST)', {
          itemsCount: (transBody.items || []).length,
        });
        // Use unified API for create
        const newVoucher = (await unifiedApi.createTransaction(transBody)) as {
          data: any;
          status: number;
          headers: Headers;
        };
        const created = newVoucher?.data || newVoucher;
        try {
          console.log('🧾 SELL_CREATE_RESPONSE', created);
          console.log('🧾 SELL_CREATE_ITEMS_SENT', itemPayload);
        } catch {}
        // Silent upsert of item names for newly created invoice
        try {
          const upsertNames = (simpleItemPayload || [])
            .map(it => String((it as any).name || ''))
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (upsertNames.length > 0) {
            upsertItemNames(Array.from(new Set(upsertNames)).slice(0, 50))
              .then(result => {
                console.log('✅ Items upserted successfully:', result);
              })
              .catch(error => {
                console.error('❌ Items upsert failed:', error);
              });
          } else {
            console.log('⚠️ No item names to upsert (all empty)');
          }
        } catch (error) {
          console.error('❌ Items upsert error:', error);
        }
        // Enrich locally so list shows correct name/details without refresh
        const createdDisplay = {
          ...created,
          partyName: customerNameToUse || created.partyName || '',
          customerName: customerNameToUse || created.customerName || '',
          customer_id: resolvedCustomerId || created.customer_id,
          customerId: resolvedCustomerId || created.customerId,
          partyPhone: customerPhone || created.partyPhone,
          partyAddress: customerAddress || created.partyAddress,
          gstPct: typeof created.gstPct === 'number' ? created.gstPct : gstPct,
          subTotal:
            typeof created.subTotal === 'number' ? created.subTotal : subTotal,
          totalAmount:
            typeof created.totalAmount === 'number'
              ? created.totalAmount
              : totalAmount,
          items:
            Array.isArray(created.items) && created.items.length > 0
              ? created.items
              : itemPayload,
        } as any;
        appendVoucher(createdDisplay);
        // Cache items and GST so edit can restore if backend omits them
        try {
          if (created?.id) {
            const cacheKey = `voucherItemsCache:${created.id}`;
            const cacheValue = JSON.stringify({
              items: itemPayload,
              gstPct: gstPct,
              date: baseBody.date,
            });
            await AsyncStorage.setItem(cacheKey, cacheValue);
            // Maintain a rolling recent cache for sell items
            try {
              const recentKey = 'recentSellItemCache';
              const existing = (await AsyncStorage.getItem(recentKey)) || '[]';
              const arr = JSON.parse(existing);
              const newEntry = { id: created.id, items: itemPayload, gstPct };
              const next = [newEntry, ...(Array.isArray(arr) ? arr : [])].slice(
                0,
                10,
              );
              await AsyncStorage.setItem(recentKey, JSON.stringify(next));
            } catch {}
            const inv =
              created?.invoiceNumber ||
              created?.billNumber ||
              created?.receiptNumber ||
              baseBody?.invoiceNumber;
            if (inv) {
              const invKey = `voucherItemsByInvoice:${String(inv)}`;
              await AsyncStorage.setItem(invKey, cacheValue);
            }
            // signature cache
            try {
              const name = (created?.partyName || baseBody?.partyName || '')
                .toString()
                .trim()
                .toLowerCase();
              const dt = (created?.date || baseBody?.date || '')
                .toString()
                .slice(0, 10);
              const total =
                Number(
                  created?.totalAmount ??
                    baseBody?.totalAmount ??
                    created?.amount ??
                    0,
                ) || 0;
              if (name && dt) {
                const sigKey = `voucherItemsBySig:${dt}|${name}|${total}`;
                await AsyncStorage.setItem(sigKey, cacheValue);
              }
            } catch {}
          }
        } catch {}
      }
      // Success - no popup needed
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
        setError(errorInfo.message || 'An error occurred.');
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

  // Ensure fresh form state when opening create form (avoid showing last customer)
  useEffect(() => {
    if (showCreateForm && !editingItem) {
      // Clear customer-related fields when starting a new Sell entry
      setSelectedCustomer('');
      setCustomer('');
      setCustomerPhone('');
      setCustomerAddress('');
      setInvoiceNumber('');
      setNotes('');
      setTriedSubmit(false);
    }
  }, [showCreateForm, editingItem]);

  // 1. Add deleteInvoice function
  const deleteInvoice = async (id: string) => {
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      // Use unified API for delete
      const idNumber = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(idNumber)) {
        throw new Error('Invalid invoice ID');
      }
      await unifiedApi.deleteTransaction(idNumber);
      await fetchInvoices();
      setShowCreateForm(false);
      setEditingItem(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete invoice.');
      setShowModal(true);
    }
  };

  // Add handleSync function (defined later with transactions fallback)

  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const invoiceDateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
  const customerInputRef = useRef<TextInput>(null);
  const customerPhoneRef = useRef<TextInput>(null);
  const customerAddressRef = useRef<TextInput>(null);

  // Field refs mapping for error scrolling (match PaymentScreen behavior)
  const fieldRefs = {
    invoiceDate: invoiceDateRef,
    customerInput: customerInputRef,
    customerPhone: customerPhoneRef,
    customerAddress: customerAddressRef,
    notes: notesRef,
  } as const;

  const scrollToErrorField = (
    errorType?: string,
    fieldName?: keyof typeof fieldRefs,
  ) => {
    if (!scrollRef.current) return;
    const fieldScrollPositions: Record<string, number> = {
      invoiceDate: 120,
      customerInput: 200,
      customerPhone: 280,
      customerAddress: 360,
      notes: 800,
    };
    const targetKey = fieldName || 'customerInput';
    const targetRef = fieldRefs[targetKey];
    if (targetRef && targetRef.current) {
      try {
        (targetRef.current as any).measure?.(
          (
            _x: number,
            _y: number,
            _w: number,
            _h: number,
            _pageX: number,
            pageY: number,
          ) => {
            const scrollY = Math.max(0, pageY - 150);
            scrollRef.current?.scrollToPosition(0, scrollY, true);
          },
        );
        return;
      } catch {}
    }
    const fallbackY = fieldScrollPositions[targetKey] || 200;
    try {
      scrollRef.current.scrollToPosition(0, fallbackY, true);
    } catch {
      try {
        scrollRef.current.scrollToEnd(true);
      } catch {}
    }
  };
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

  // Render invoice item for the list
  const getDisplayAmount = (t: any): number => {
    const total = Number(t.totalAmount);
    if (!Number.isNaN(total) && total > 0) return total;
    const sub = Number(t.subTotal);
    const gstPctVal = Number(t.gstPct);
    const cGst = Number(t.cGST);
    const discount = Number(t.discount);
    if (!Number.isNaN(sub)) {
      const gstCalc = !Number.isNaN(gstPctVal) ? sub * (gstPctVal / 100) : 0;
      const extraTax = !Number.isNaN(cGst) ? cGst : 0;
      const disc = !Number.isNaN(discount) ? discount : 0;
      const computed = sub + gstCalc + extraTax - disc;
      if (Number.isFinite(computed)) return computed;
    }
    const amt = Number(t.amount);
    return !Number.isNaN(amt) ? amt : 0;
  };

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
      >
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceNumber}>
            {item.invoiceNumber ||
              item.billNumber ||
              (item.id ? `SEL-${item.id}` : 'Invoice')}
          </Text>
          <StatusBadge status={getStatusLabel(item.status)} />
        </View>
        <Text style={styles.customerName}>
          {item.partyName || item.customerName || 'N/A'}
        </Text>
        <View style={styles.invoiceDetails}>
          <Text style={styles.invoiceDate}>
            {String(item?.date || '').slice(0, 10)}
          </Text>
          <Text style={styles.invoiceAmount}>
            {formatCurrency(getDisplayAmount(item))}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Sync button hidden as requested */}
      {false && (
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
      )}
    </View>
  );

  const handleLoadMoreInvoices = () => {
    if (!hasMoreInvoices || isInvoicePaginating) {
      return;
    }
    setIsInvoicePaginating(true);
    setTimeout(() => {
      setVisibleInvoiceCount(prev =>
        Math.min(prev + INVOICE_LIST_PAGE_SIZE, orderedInvoices.length),
      );
      setIsInvoicePaginating(false);
    }, 200);
  };

  const renderInvoiceFooter = () => {
    if (!isInvoicePaginating) {
      return null;
    }
    return (
      <View style={styles.listFooterLoader}>
        <ActivityIndicator size="small" color="#4f8cff" />
      </View>
    );
  };

  const handleSync = async (item: any) => {
    if (!item || !item.id) return;
    try {
      // Block API when transaction limit reached
      try {
        await forceCheckTransactionLimit();
      } catch {
        await forceShowPopup();
        return;
      }
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Use PUT instead of PATCH - backend requires full transaction object
      // Get userId for the update
      const userId = await getUserIdFromToken();
      if (!userId) {
        throw new Error('User not authenticated. Please login again.');
      }

      // Use raw data if available (original transaction data), otherwise use enriched data
      const rawData = item._raw || item;

      // Build PUT body with all required fields plus syncYN
      const putBody: any = {
        user_id: rawData.user_id || userId,
        createdBy: rawData.createdBy || rawData.user_id || userId,
        updatedBy: userId,
        type: rawData.type || 'credit',
        amount: Number(rawData.amount || item.amount || 0),
        date:
          rawData.date ||
          rawData.invoiceDate ||
          rawData.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transactionDate:
          rawData.transactionDate ||
          rawData.date ||
          rawData.invoiceDate ||
          item.transactionDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        invoiceDate:
          rawData.invoiceDate ||
          rawData.date ||
          rawData.transactionDate ||
          item.invoiceDate ||
          item.date ||
          new Date().toISOString().split('T')[0],
        transaction_date:
          rawData.transaction_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        invoice_date:
          rawData.invoice_date ||
          rawData.date ||
          new Date().toISOString().split('T')[0],
        status: rawData.status || item.status || 'Complete',
        description: rawData.description || item.description || '',
        notes: rawData.notes || item.notes || '',
        partyName: rawData.partyName || item.partyName || '',
        partyId:
          rawData.partyId ||
          rawData.customer_id ||
          item.partyId ||
          item.customer_id ||
          null,
        customer_id:
          rawData.customer_id ||
          rawData.partyId ||
          item.customer_id ||
          item.partyId ||
          null,
        partyPhone:
          rawData.partyPhone ||
          rawData.phone ||
          rawData.phoneNumber ||
          item.partyPhone ||
          '',
        partyAddress:
          rawData.partyAddress ||
          rawData.address ||
          rawData.addressLine1 ||
          item.partyAddress ||
          '',
        method: rawData.method || item.method || '',
        category: rawData.category || item.category || '',
        items: rawData.items || item.items || [],
        gstPct: rawData.gstPct || item.gstPct || 0,
        discount: rawData.discount || item.discount || 0,
        cGST: rawData.cGST || item.cGST || 0,
        subTotal: rawData.subTotal || item.subTotal || 0,
        totalAmount:
          rawData.totalAmount ||
          item.totalAmount ||
          Number(rawData.amount || item.amount || 0),
        invoiceNumber:
          rawData.invoiceNumber || item.invoiceNumber || item.billNumber || '', // Include invoiceNumber for sync
        syncYN: 'Y', // Set sync flag
      };

      // Use unified API for sync
      await unifiedApi.updateTransaction(item.id, putBody);

      await fetchInvoices();
    } catch (e: any) {
      try {
        console.error('handleSync error (Sell):', e);
      } catch {}
    }
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

  const orderedInvoices = useMemo(
    () => [...filteredInvoices].reverse(),
    [filteredInvoices],
  );

  const paginatedInvoices = useMemo(
    () => orderedInvoices.slice(0, visibleInvoiceCount),
    [orderedInvoices, visibleInvoiceCount],
  );

  const hasMoreInvoices = visibleInvoiceCount < orderedInvoices.length;

  useEffect(() => {
    setVisibleInvoiceCount(INVOICE_LIST_PAGE_SIZE);
  }, [filteredInvoices]);

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
      const res = (await unifiedApi.post(
        '/api/whisper/transcribe',
        formData,
      )) as {
        data: any;
        status: number;
        headers: Headers;
      };
      // unifiedApi returns { data, status, headers } structure
      const data = res.data || res;
      if (res.status < 200 || res.status >= 300) {
        throw new Error(data?.message || 'Speech recognition failed');
      }
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
            // Amount without GST - GST will be added in final total only
            amount: Number(item.quantity) * Number(item.rate),
          }));
          setItems(recalculated);
        };
        // Add missing GST update helper (avoid shadowing state setter)
        const setGstPctFromVoice = (value: number) => {
          const oldGstPct = gstPct;
          setGstPct(value);
          // Recalculate all item amounts without GST - GST will be added in final total only
          const updatedItems = items.map(item => ({
            ...item,
            amount: item.quantity * item.rate,
          }));
          setItems(updatedItems);
          // Update taxAmount to include new GST amount
          const subtotal = calculateSubtotal();
          const oldGstAmount = subtotal * (oldGstPct / 100);
          const newGstAmount = subtotal * (value / 100);
          // Adjust taxAmount: remove old GST, add new GST
          setTaxAmount(prev => prev - oldGstAmount + newGstAmount);
        };

        const updatedFields = parseInvoiceVoiceText(
          data.englishText || data.text,
          {
            setInvoiceNumber, // FIX: Pass the new state setter
            setSelectedCustomer,
            setGstPct: setGstPctFromVoice, // Use the defined helper
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

  const handleFileTypeSelection = async (type: string) => {
    console.log('📁 Selected file type:', type);
    setShowFileTypeModal(false);

    if (!type) return;

    console.log('📁 Starting file selection process for type:', type);

    try {
      let file: any = null;

      // Pick file based on type
      if (type === 'image') {
        console.log('📸 Opening image picker...');
        const result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
          includeBase64: false,
        });
        if (result.assets && result.assets.length > 0) {
          file = result.assets[0];
          console.log('📸 Image selected:', file.fileName || file.name);
        }
      } else if (type === 'pdf' || type === 'excel') {
        console.log('📄 Opening document picker...');
        console.log('📄 DocumentPickerTypes available:', DocumentPickerTypes);
        console.log('📄 Pick function available:', typeof pick);
        try {
          const result = await pick({
            type:
              type === 'pdf'
                ? [DocumentPickerTypes.pdf]
                : [DocumentPickerTypes.xlsx, DocumentPickerTypes.xls],
          });
          if (result && result.length > 0) {
            file = result[0];
            console.log('📄 Document selected:', file.fileName || file.name);
          }
        } catch (pickerError) {
          console.error('📄 Document picker error:', pickerError);
          if (
            pickerError &&
            (pickerError as any).code === 'DOCUMENT_PICKER_CANCELED'
          ) {
            console.log('❌ User cancelled document selection');
            return;
          }
          throw pickerError;
        }
      }

      if (!file) {
        console.log('❌ No file selected');
        return;
      }

      setSelectedFile(file);
      setDocumentName(file.fileName || file.name || '');
      setFileType(type.toUpperCase());

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
        console.log('❌ User cancelled file selection');
        return;
      }
      console.error('❌ File processing error:', err);
      showCustomPopup('Error', 'Failed to pick or process the file.', 'error');
    }
  };

  // Helper function to process image with OCR
  const processImageWithOCR = async (file: any) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      console.log('🔄 Starting OCR processing for image...');
      console.log('📁 File details:', {
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
      console.log('🔍 OCR Parsed Data:', parsed);

      // Debug: Log the raw text to see what we're working with
      console.log('🔍 Raw OCR Text for debugging:', text);
      console.log('🔍 Parsed Invoice Number:', parsed.invoiceNumber);
      console.log('🔍 Parsed Customer Name:', parsed.customerName);
      console.log('🔍 Parsed Customer Phone:', parsed.customerPhone);
      console.log('🔍 Parsed Customer Address:', parsed.customerAddress);
      console.log('🔍 Parsed Invoice Date:', parsed.invoiceDate);
      console.log('🔍 Parsed Items Count:', parsed.items?.length || 0);
      console.log('🔍 Parsed Notes:', parsed.notes);

      // Clear existing form data first to avoid mixing with old data
      console.log('🧹 Clearing existing form data...');
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
      console.log('🔄 Using simple direct approach to set form data...');

      // Force immediate state updates with a simple approach
      const newInvoiceNumber = parsed.invoiceNumber?.trim() || '';
      const newCustomerName = parsed.customerName?.trim() || '';
      const newCustomerPhone = parsed.customerPhone?.trim() || '';
      const newCustomerAddress = parsed.customerAddress?.trim() || '';
      const newInvoiceDate =
        parsed.invoiceDate?.trim() || new Date().toISOString().split('T')[0];
      const newNotes = parsed.notes?.trim() || '';

      console.log('🔄 Direct values to set:', {
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
          // Amount without GST - GST will be added in final total only
          amount: item.amount || item.quantity * item.rate || 0,
        }));
        setItems(newItems);
        console.log('✅ Set Items without GST:', newItems);
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

      console.log('✅ All form fields set successfully');

      // Double-check the values were set
      setTimeout(() => {
        console.log('🔄 Verification - Current form state:', {
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
      console.error('❌ OCR processing failed:', ocrErr);
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
      console.log('🔄 Starting OCR processing for PDF...');
      console.log('📁 PDF File details:', {
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

      console.log('📄 PDF OCR Text extracted:', text);

      // Use the same robust parsing logic as images
      const parsed = parseInvoiceOcrText(text);
      console.log('🔍 PDF OCR Parsed Data:', parsed);

      // Debug: Log the raw text to see what we're working with
      console.log('🔍 Raw PDF OCR Text for debugging:', text);
      console.log('🔍 Parsed Invoice Number:', parsed.invoiceNumber);
      console.log('🔍 Parsed Customer Name:', parsed.customerName);
      console.log('🔍 Parsed Customer Phone:', parsed.customerPhone);
      console.log('🔍 Parsed Customer Address:', parsed.customerAddress);
      console.log('🔍 Parsed Invoice Date:', parsed.invoiceDate);
      console.log('🔍 Parsed Items Count:', parsed.items?.length || 0);
      console.log('🔍 Parsed Notes:', parsed.notes);

      // Clear existing form data first to avoid mixing with old data
      console.log('🧹 Clearing existing form data...');
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
        '🔄 Using simple direct approach to set form data from PDF...',
      );

      // Force immediate state updates with a simple approach
      const newInvoiceNumber = parsed.invoiceNumber?.trim() || '';
      const newCustomerName = parsed.customerName?.trim() || '';
      const newCustomerPhone = parsed.customerPhone?.trim() || '';
      const newCustomerAddress = parsed.customerAddress?.trim() || '';
      const newInvoiceDate =
        parsed.invoiceDate?.trim() || new Date().toISOString().split('T')[0];
      const newNotes = parsed.notes?.trim() || '';

      console.log('🔄 Direct values to set from PDF:', {
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
          // Amount without GST - GST will be added in final total only
          amount: item.amount || item.quantity * item.rate || 0,
        }));
        setItems(newItems);
        console.log('✅ Set Items from PDF without GST:', newItems);
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

      console.log('✅ All form fields set successfully from PDF');

      // Double-check the values were set
      setTimeout(() => {
        console.log('🔄 Verification - Current form state from PDF:', {
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
      console.error('❌ PDF OCR processing failed:', ocrErr);
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
      console.error('❌ Excel processing failed:', excelErr);
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

  const preciseStatusBarHeight = getStatusBarHeight(true);
  const effectiveStatusBarHeight = Math.max(
    preciseStatusBarHeight || 0,
    getStatusBarSpacerHeight(),
  );

  if (showCreateForm) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <StableStatusBar
          backgroundColor="#4f8cff"
          barStyle="light-content"
          translucent={false}
          animated={true}
        />
        {/* Header */}
        <View
          style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
        >
          <View style={{ height: HEADER_CONTENT_HEIGHT }} />
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={25}
                color="#fff"
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
          contentContainerStyle={{ paddingBottom: 100 }}
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

          {/* OCR Loading and Error States */}
          {ocrLoading && (
            <View
              style={{
                backgroundColor: '#fff3cd',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#ffeaa7',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator
                size="small"
                color="#856404"
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: '#856404',
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                Processing document with OCR...
              </Text>
            </View>
          )}
          {ocrError && (
            <View
              style={{
                backgroundColor: '#f8d7da',
                borderRadius: 8,
                padding: 12,
                marginTop: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#f5c6cb',
              }}
            >
              <Text
                style={{
                  color: '#721c24',
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                }}
              >
                <Text style={{ fontFamily: 'Roboto-Medium' }}>OCR Error: </Text>
                {ocrError}
              </Text>
            </View>
          )}
          {/* Invoice Details Card */}
          <View style={[styles.card, { marginTop: 0 }]}>
            <View style={{ flexDirection: 'row', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  {folderName} Date <Text style={{ color: '#d32f2f' }}>*</Text>
                </Text>
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
                      console.log('📅 DateTimePicker onChange:', {
                        event,
                        date,
                      });

                      // Handle different event types
                      if (Platform.OS === 'android') {
                        if (event.type === 'set' && date) {
                          console.log(
                            '📅 Android: Date selected:',
                            date.toISOString().split('T')[0],
                          );
                          setShowDatePicker(false);
                          setInvoiceDate(date.toISOString().split('T')[0]);
                        } else if (event.type === 'dismissed') {
                          console.log('📅 Android: Date picker dismissed');
                          setShowDatePicker(false);
                        }
                      } else {
                        // iOS handling
                        if (date) {
                          console.log(
                            '📅 iOS: Date selected:',
                            date.toISOString().split('T')[0],
                          );
                          setInvoiceDate(date.toISOString().split('T')[0]);
                        }
                        if (event.type === 'dismissed') {
                          console.log('📅 iOS: Date picker dismissed');
                          setShowDatePicker(false);
                        }
                      }
                    }}
                  />
                )}
              </View>
            </View>
            {/* Customer Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>
                {folderName} Customer{' '}
                <Text style={{ color: '#d32f2f' }}>*</Text>
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor:
                    triedSubmit && getFieldError('selectedCustomer')
                      ? '#d32f2f'
                      : '#e0e0e0',
                  borderRadius: 8,
                  backgroundColor: '#f9f9f9',
                  zIndex: 1000,
                }}
                ref={customerInputRef as any}
              >
                <CustomerSelector
                  value={customer}
                  onChange={(name, customerObj) => {
                    // Always update text value
                    setCustomer(name);

                    // If a customer object is provided from dropdown selection, populate fields
                    if (customerObj) {
                      const phoneValue =
                        (customerObj as any).phoneNumber ||
                        (customerObj as any).phone ||
                        (customerObj as any).phone_number ||
                        '';
                      const addressValue =
                        (customerObj as any).address ||
                        (customerObj as any).addressLine1 ||
                        (customerObj as any).address_line1 ||
                        (customerObj as any).address1 ||
                        '';
                      setCustomerPhone(String(phoneValue));
                      setCustomerAddress(String(addressValue));
                      setSelectedCustomer(customerObj as any);
                      setCustomerId(Number((customerObj as any)?.id) || null);
                    } else {
                      // If user types a different name than selected customer, clear dependent fields
                      if (
                        selectedCustomer &&
                        name.trim().toLowerCase() !==
                          (
                            selectedCustomer.name ||
                            selectedCustomer.partyName ||
                            ''
                          )
                            .trim()
                            .toLowerCase()
                      ) {
                        setSelectedCustomer(null);
                        if (!editingItem) {
                          setCustomerPhone('');
                          setCustomerAddress('');
                          setCustomerId(null);
                        }
                      }
                    }
                  }}
                  placeholder="Type or search customer"
                  onCustomerSelect={customerObj => {
                    console.log(
                      '🔍 InvoiceScreen: onCustomerSelect called with:',
                      customerObj,
                    );
                    console.log(
                      '🔍 InvoiceScreen: Setting customer to:',
                      customerObj.name || (customerObj as any).partyName,
                    );
                    console.log(
                      '🔍 InvoiceScreen: Setting customerPhone to:',
                      customerObj.phoneNumber,
                    );
                    console.log(
                      '🔍 InvoiceScreen: Setting customerAddress to:',
                      customerObj.address,
                    );
                    const selectedName =
                      customerObj.name || (customerObj as any).partyName || '';
                    setCustomer(selectedName);
                    setCustomerId(Number((customerObj as any)?.id) || null);
                    const phoneValue =
                      (customerObj as any).phoneNumber ||
                      (customerObj as any).phone ||
                      (customerObj as any).phone_number ||
                      '';
                    const addressValue =
                      (customerObj as any).address ||
                      (customerObj as any).addressLine1 ||
                      (customerObj as any).address_line1 ||
                      (customerObj as any).address1 ||
                      '';
                    setCustomerPhone(String(phoneValue));
                    setCustomerAddress(String(addressValue));
                    setSelectedCustomer(customerObj as any);
                  }}
                />
              </View>
              {triedSubmit && getFieldError('selectedCustomer') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('selectedCustomer')}
                </Text>
              ) : null}
            </View>
            {/* Phone Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>
                Phone <Text style={{ color: '#d32f2f' }}>*</Text>
              </Text>
              <TextInput
                ref={customerPhoneRef}
                style={[
                  styles.input,
                  { color: '#333333' },
                  triedSubmit &&
                    getFieldError('customerPhone') && {
                      borderColor: 'red',
                    },
                  editingItem && { backgroundColor: '#f5f5f5', color: '#666' },
                ]}
                value={(customerPhone || '').replace(/\D/g, '').slice(-10)}
                onChangeText={text => {
                  if (editingItem) return;
                  const digitsOnly = text.replace(/\D/g, '').slice(-10);
                  setCustomerPhone(digitsOnly);
                }}
                placeholder="9876543210"
                placeholderTextColor="#666666"
                keyboardType="phone-pad"
                maxLength={10}
                editable={!editingItem}
                pointerEvents={editingItem ? 'none' : 'auto'}
              />
              {getFieldError('customerPhone') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('customerPhone')}
                </Text>
              ) : null}
            </View>
            {/* Address Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>
                Address <Text style={{ color: '#d32f2f' }}>*</Text>
              </Text>
              <TextInput
                ref={customerAddressRef}
                style={[
                  styles.input,
                  { minHeight: 60, textAlignVertical: 'top', color: '#333333' },
                  triedSubmit &&
                    getFieldError('customerAddress') && {
                      borderColor: '#d32f2f',
                    },
                ]}
                value={customerAddress}
                onChangeText={setCustomerAddress}
                placeholder="Customer address"
                placeholderTextColor="#666666"
                multiline
              />
              {getFieldError('customerAddress') ? (
                <Text style={styles.errorTextField}>
                  {getFieldError('customerAddress')}
                </Text>
              ) : null}
            </View>
            {/* GST Field */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.inputLabel}>GST (%)</Text>
              <TouchableOpacity
                style={styles.pickerInput}
                onPress={() => setShowGstModal(true)}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <MaterialCommunityIcons
                    name="percent"
                    size={20}
                    color="#666666"
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.pickerText,
                      gstPct === undefined ? styles.placeholderText : {},
                    ]}
                  >
                    {gstPct !== undefined
                      ? `${gstPct}% GST`
                      : 'Select GST percentage'}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Items Section */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={styles.itemsTitle}>Items</Text>
              <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>
            {items.map((item, index) => (
              <View key={item.id} style={styles.itemRow}>
                {index > 0 && <View style={styles.itemDivider} />}
                <View style={styles.itemRowHeader}>
                  <View style={styles.itemIndexContainer}>
                    <Text style={styles.itemIndex}>{index + 1}</Text>
                  </View>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                      <MaterialCommunityIcons
                        name="delete"
                        size={20}
                        color="#dc3545"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.itemContent}>
                  <View style={styles.itemDescriptionContainer}>
                    <Text style={styles.itemFieldLabel}>Description</Text>
                    <TextInput
                      style={[
                        styles.itemDescriptionInput,
                        triedSubmit &&
                          !item.description?.trim() && {
                            borderColor: '#d32f2f',
                          },
                      ]}
                      placeholder="Item description"
                      value={item.description}
                      onChangeText={text =>
                        updateItem(item.id, 'description', text)
                      }
                      placeholderTextColor="#666666"
                      onFocus={() => {
                        setShowGstModal(false);
                        setFocusedItemId(item.id);
                      }}
                      onBlur={() => {
                        setFocusedItemId(prev =>
                          prev === item.id ? null : prev,
                        );
                      }}
                    />
                    <ItemNameSuggestions
                      query={item.description || ''}
                      visible={focusedItemId === item.id}
                      localCandidates={
                        (items || [])
                          .map(it => it.description)
                          .filter(Boolean) as string[]
                      }
                      onSelect={(name: string) => {
                        updateItem(item.id, 'description', name);
                        setFocusedItemId(null);
                      }}
                    />
                  </View>
                  <View style={styles.itemDetailsRow}>
                    <View style={styles.itemDetailColumn}>
                      <Text style={styles.itemFieldLabel}>Quantity</Text>
                      <TextInput
                        style={[
                          styles.itemQuantityInput,
                          triedSubmit &&
                            !(Number(item.quantity) > 0) && {
                              borderColor: '#d32f2f',
                            },
                        ]}
                        placeholder="Qty"
                        value={item.quantity.toString()}
                        onChangeText={text => {
                          const qty = parseFloat(text) || 0;
                          updateItem(item.id, 'quantity', qty);
                        }}
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                        onFocus={() => {
                          setShowGstModal(false);
                          setFocusedItemId(null);
                        }}
                      />
                    </View>
                    <View style={styles.itemDetailColumn}>
                      <Text style={styles.itemFieldLabel}>Rate</Text>
                      <TextInput
                        style={[
                          styles.itemQuantityInput,
                          triedSubmit &&
                            !(Number(item.rate) > 0) && {
                              borderColor: '#d32f2f',
                            },
                        ]}
                        placeholder="Rate"
                        value={item.rate.toString()}
                        onChangeText={text => {
                          const rate = parseFloat(text) || 0;
                          updateItem(item.id, 'rate', rate);
                        }}
                        placeholderTextColor="#666666"
                        keyboardType="numeric"
                        onFocus={() => {
                          setShowGstModal(false);
                          setFocusedItemId(null);
                        }}
                      />
                    </View>
                  </View>
                  <View style={styles.itemAmountDisplay}>
                    <Text style={styles.itemAmountText}>
                      ₹{item.amount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {triedSubmit &&
              !(items || []).some(
                it =>
                  (it?.description || '').toString().trim() &&
                  Number(it?.quantity) > 0 &&
                  Number(it?.rate) > 0,
              ) && (
                <Text style={[styles.errorTextField, { marginTop: 6 }]}>
                  Please add at least one item with description, quantity, and
                  rate.
                </Text>
              )}
          </View>

          {/* Amount Details Card */}
          <View style={styles.card}>
            <View style={[styles.rowBetween, { marginBottom: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={22}
                  color="#333"
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      fontSize: scale(22),
                      color: '#333',
                      fontFamily: 'Roboto-Medium',
                      fontWeight: '600',
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
                marginVertical: scale(16),
              }}
            />
            <View style={[styles.rowBetween, { gap: scale(16) }]}>
              <View style={[styles.flex1, { maxWidth: '48%' }]}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: scale(8),
                      fontSize: 16,
                      color: '#333333',
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
                      paddingVertical: scale(22),
                      fontSize: scale(18),
                      paddingHorizontal: scale(12),
                      backgroundColor: '#e9ecef',
                      borderColor: '#d0d0d0',
                      borderWidth: 1,
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                  value={taxAmount.toFixed(2)}
                  editable={false}
                  placeholderTextColor="#666666"
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.flex1, { maxWidth: '48%' }]}>
                <Text
                  style={[
                    styles.inputLabel,
                    {
                      marginBottom: scale(8),
                      fontSize: 16,
                      color: '#333333',
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
                      paddingVertical: scale(22),
                      fontSize: scale(18),
                      paddingHorizontal: scale(12),
                      backgroundColor: '#f9f9f9',
                      borderColor: '#e0e0e0',
                      borderWidth: 1,
                      fontFamily: 'Roboto-Medium',
                    },
                  ]}
                  value={discountAmount.toString()}
                  onChangeText={text => {
                    const value = parseFloat(text) || 0;
                    setDiscountAmount(value);
                  }}
                  placeholderTextColor="#666666"
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {/* Summary */}
            <View
              style={{
                marginTop: scale(24),
                padding: scale(20),
                backgroundColor: '#f8f9fa',
                borderRadius: scale(12),
                borderWidth: 1,
                borderColor: '#e0e0e0',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: scale(12),
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
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
                  {formatCurrency(calculateSubtotal())}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: scale(12),
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  GST:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {gstPct}%
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: scale(12),
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
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
                  ₹{taxAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: scale(12),
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Discount:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  -₹{discountAmount.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: scale(16),
                  paddingTop: scale(16),
                  borderTopWidth: 1,
                  borderTopColor: '#dee2e6',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  Total:
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: '#333333',
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {formatCurrency(calculateTotal())}
                </Text>
              </View>
            </View>
          </View>

          {/* Notes Card */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Notes</Text>
            <TextInput
              ref={notesRef}
              style={[
                styles.input,
                { minHeight: 80, textAlignVertical: 'top' },
                triedSubmit &&
                  getFieldError('notes') && {
                    borderColor: 'red',
                  },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes (optional)"
              multiline
              placeholderTextColor="#666666"
            />
            {getFieldError('notes') ? (
              <Text style={styles.errorTextField}>
                {getFieldError('notes')}
              </Text>
            ) : null}
          </View>
        </KeyboardAwareScrollView>

        {/* GST Modal */}
        {showGstModal && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowGstModal(false)}
            />
            <View style={styles.gstModalContainer}>
              {/* Modal Handle */}
              <View style={styles.gstModalHandle} />

              {/* Header */}
              <View style={styles.gstModalHeader}>
                <TouchableOpacity
                  onPress={() => setShowGstModal(false)}
                  style={styles.gstModalCloseButton}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="close" size={22} color="#666" />
                </TouchableOpacity>
                <View style={styles.gstModalTitleContainer}>
                  <Text style={styles.gstModalTitle}>
                    Select GST Percentage
                  </Text>
                  <Text style={styles.gstModalSubtitle}>
                    Choose the applicable GST rate
                  </Text>
                </View>
                <View style={{ width: 22 }} />
              </View>

              {/* GST Percentage Options */}
              <ScrollView
                style={styles.gstModalContent}
                contentContainerStyle={{
                  paddingHorizontal: 24,
                  paddingVertical: 20,
                  paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
                scrollEnabled={true}
              >
                {GST_OPTIONS.map((percentage, index) => (
                  <TouchableOpacity
                    key={percentage}
                    style={[
                      styles.gstOption,
                      gstPct === percentage && styles.gstOptionSelected,
                      index === GST_OPTIONS.length - 1 && styles.gstOptionLast,
                    ]}
                    onPress={() => {
                      const oldGstPct = gstPct;
                      setGstPct(percentage);
                      // Recalculate all item amounts without GST - GST will be added in final total only
                      const updatedItems = items.map(item => ({
                        ...item,
                        amount: item.quantity * item.rate,
                      }));
                      setItems(updatedItems);
                      // Update taxAmount to include new GST amount
                      const subtotal = calculateSubtotal();
                      const oldGstAmount = subtotal * (oldGstPct / 100);
                      const newGstAmount = subtotal * (percentage / 100);
                      // Adjust taxAmount: remove old GST, add new GST
                      setTaxAmount(prev => prev - oldGstAmount + newGstAmount);
                      setShowGstModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.gstOptionContent}>
                      <View style={styles.gstOptionLeft}>
                        <View
                          style={[
                            styles.gstIcon,
                            gstPct === percentage && styles.gstIconSelected,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="percent"
                            size={22}
                            color={gstPct === percentage ? '#fff' : '#4f8cff'}
                          />
                        </View>
                        <View style={styles.gstTextContainer}>
                          <Text
                            style={[
                              styles.gstOptionText,
                              gstPct === percentage &&
                                styles.gstOptionTextSelected,
                            ]}
                          >
                            {percentage}% GST
                          </Text>
                          <Text style={styles.gstDescription}>
                            {percentage === 0
                              ? 'No GST applicable'
                              : percentage === 5
                              ? 'Reduced GST rate'
                              : percentage === 12
                              ? 'Standard GST rate'
                              : percentage === 18
                              ? 'Standard GST rate'
                              : 'Higher GST rate'}
                          </Text>
                        </View>
                      </View>
                      {gstPct === percentage && (
                        <View style={styles.gstCheckContainer}>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={24}
                            color="#4f8cff"
                          />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Bottom Buttons (Unified UI) */}
        <View style={styles.buttonContainer}>
          {editingItem ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.updateButtonEdit}
                onPress={() => handleSubmit('complete')}
                disabled={loadingSave}
              >
                <Text style={styles.submitButtonText}>
                  {loadingSave
                    ? `SAVING ${folderName.toUpperCase()}...`
                    : `UPDATE ${folderName.toUpperCase()}`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButtonEdit}
                onPress={() => deleteInvoice(editingItem.id)}
              >
                <MaterialCommunityIcons name="delete" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.submitButtonFullWidth}
              onPress={() => handleSubmit('complete')}
              disabled={loadingSave}
            >
              <Text style={styles.submitButtonText}>
                {loadingSave
                  ? `SAVING ${folderName.toUpperCase()}...`
                  : `SAVE ${folderName.toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Main invoice list view
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StableStatusBar
        backgroundColor="#4f8cff"
        barStyle="light-content"
        translucent={false}
        animated={true}
      />
      {/* Header */}
      <View
        style={[styles.header, getSolidHeaderStyle(effectiveStatusBarHeight)]}
      >
        <View style={{ height: HEADER_CONTENT_HEIGHT }} />
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={25} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{folderName}</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <SearchAndFilter
        value={searchFilter}
        onChange={value => setSearchFilter(value)}
        onFilterPress={() => setFilterVisible(true)}
        filterBadgeCount={filterBadgeCount}
        recentSearches={recentSearches}
        onRecentSearchPress={handleRecentSearchPress}
        inputTextColor="#333333"
        placeholderTextColor="#666666"
      />

      {/* Invoice List */}
      <View style={styles.listContainer}>
        {loadingApi ? (
          <ActivityIndicator
            size="large"
            color="#4f8cff"
            style={{ marginTop: 50 }}
          />
        ) : apiError ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: 'red', textAlign: 'center' }}>
              {apiError}
            </Text>
            <TouchableOpacity
              style={[styles.fullWidthButton, { marginTop: 20 }]}
              onPress={() => fetchInvoices()}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredInvoices.length === 0 ? (
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
        ) : (
          <FlatList
            data={paginatedInvoices}
            keyExtractor={item => item.id}
            renderItem={renderInvoiceItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            onEndReached={handleLoadMoreInvoices}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderInvoiceFooter}
          />
        )}
      </View>

      {/* Add Invoice Button */}
      <TouchableOpacity
        style={styles.addInvoiceButton}
        onPress={() => setShowCreateForm(true)}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.addInvoiceText}>Add {folderName}</Text>
      </TouchableOpacity>

      {/* Filter Bottom Sheet */}
      {filterVisible && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFilterVisible(false)}
          />
          <KeyboardAwareScrollView
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: scale(18),
              borderTopRightRadius: scale(18),
              height: '90%',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }}
            contentContainerStyle={{ padding: scale(20), flexGrow: 1 }}
            enableOnAndroid
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <TouchableOpacity
              onPress={() => setFilterVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                position: 'absolute',
                left: scale(16),
                top: scale(16),
                zIndex: 10,
                padding: scale(8),
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: scale(20),
              }}
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
                marginBottom: scale(16),
                marginLeft: 0,
                textAlign: 'center',
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Filter {pluralize(folderName)}
            </Text>
            {/* Amount Range */}
            <Text
              style={{
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Amount Range
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: scale(16) }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                  color: '#333333',
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
                  borderRadius: scale(8),
                  padding: scale(10),
                  fontSize: 14,
                  fontFamily: 'Roboto-Medium',
                  color: '#333333',
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Date Range
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: scale(16),
              }}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#e0e0e0',
                  borderRadius: scale(8),
                  padding: scale(10),
                  marginRight: scale(8),
                }}
                onPress={() => setShowDatePickerFrom(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateFrom ? '#333333' : '#666666',
                    fontSize: 14,
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
                  borderRadius: scale(8),
                  padding: scale(10),
                }}
                onPress={() => setShowDatePickerTo(true)}
              >
                <Text
                  style={{
                    color: searchFilter.dateTo ? '#333333' : '#666666',
                    fontSize: 14,
                    fontFamily: 'Roboto-Medium',
                  }}
                >
                  {searchFilter.dateTo || 'To'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Date Pickers */}
            {showDatePickerFrom && (
              <DateTimePicker
                value={
                  searchFilter.dateFrom
                    ? new Date(searchFilter.dateFrom)
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePickerFrom(false);
                  if (date)
                    setSearchFilter(f => ({
                      ...f,
                      dateFrom: date.toISOString().split('T')[0],
                    }));
                }}
              />
            )}
            {showDatePickerTo && (
              <DateTimePicker
                value={
                  searchFilter.dateTo
                    ? new Date(searchFilter.dateTo)
                    : new Date()
                }
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePickerTo(false);
                  if (date)
                    setSearchFilter(f => ({
                      ...f,
                      dateTo: date.toISOString().split('T')[0],
                    }));
                }}
              />
            )}
            {/* Payment Method filter */}
            <Text
              style={{
                fontSize: 14,
                color: '#333333',
                marginBottom: scale(12),
                marginTop: scale(8),
                fontFamily: 'Roboto-Medium',
              }}
            >
              Payment Method
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                marginBottom: scale(20),
                gap: scale(10),
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
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: scale(68),
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
                      fontSize: 13,
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
            {/* Status filter */}
            <Text
              style={{
                fontSize: 14,
                color: '#333333',
                marginBottom: scale(12),
                fontFamily: 'Roboto-Medium',
              }}
            >
              Status
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: scale(20),
                gap: scale(12),
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
                    borderRadius: scale(16),
                    paddingVertical: scale(6),
                    paddingHorizontal: scale(12),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() =>
                    setSearchFilter(f => ({
                      ...f,
                      status: status || undefined,
                    }))
                  }
                >
                  <Text
                    style={{
                      color:
                        (status === '' && !searchFilter.status) ||
                        searchFilter.status === status
                          ? '#1f2937'
                          : '#6b7280',
                      fontSize: 13,
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Reference Number
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
                color: '#333333',
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
                fontSize: 14,
                marginBottom: scale(6),
                color: '#333333',
                fontFamily: 'Roboto-Medium',
              }}
            >
              Description/Notes
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#e0e0e0',
                borderRadius: scale(8),
                padding: scale(10),
                marginBottom: scale(16),
                fontSize: 14,
                fontFamily: 'Roboto-Medium',
                color: '#333333',
              }}
              placeholder="Description or notes keywords"
              placeholderTextColor="#666666"
              value={searchFilter.description || ''}
              onChangeText={v =>
                setSearchFilter(f => ({ ...f, description: v || undefined }))
              }
            />
            {/* Reset/Apply buttons */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: scale(20),
                marginTop: scale(12),
                gap: scale(16),
              }}
            >
              <TouchableOpacity
                onPress={() => setSearchFilter({ searchText: '' })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#f8f9fa',
                  borderWidth: 1.5,
                  borderColor: '#dc3545',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  backgroundColor: '#4f8cff',
                  borderWidth: 1.5,
                  borderColor: '#4f8cff',
                  borderRadius: scale(12),
                  paddingVertical: scale(16),
                  paddingHorizontal: scale(36),
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: scale(160),
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
        </View>
      )}
    </SafeAreaView>
  );
};

// Global scale helper for UI scaling rule - increase all dimensions by 2 units
const SCALE = 0.75; // Base scale to match reference screens
const scale = (value: number) => Math.round(value * SCALE);

const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {
  container: {
    flex: 1,
    padding: scale(20),
    paddingBottom: scale(140), // Adequate space for fixed buttons
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(20),
    marginBottom: scale(24),
    marginTop: scale(8),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: scale(5),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  cardTitle: {
    fontSize: scale(23.5), // 18 + 2
    color: '#333333', // Card titles - black for maximum contrast
    marginBottom: scale(20),
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center' as ViewStyle['alignItems'],
  },
  flex1: { flex: 1 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    height: scale(66),
    justifyContent: 'center',
  },
  picker: {
    height: scale(66),
    width: '100%',
    marginTop: scale(-4),
    marginBottom: scale(-4),
  },
  actionButtonsContainer: {
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  fixedActionButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    paddingTop: scale(16),
    paddingBottom: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  fullWidthButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    width: '100%',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  primaryButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: scale(22),
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: scale(14),
    borderRadius: scale(8),
    flex: 1,
    alignItems: 'center',
    marginLeft: scale(8),
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    color: '#333333',
    fontSize: scale(18), // 16 + 2
  },
  iconButton: {
    backgroundColor: '#fff',
    padding: scale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: scale(22),
    fontSize: scale(18),
    color: '#333333', // Input field text - black for better readability
    backgroundColor: '#f9f9f9',
    fontFamily: 'Roboto-Medium',
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: scale(12),
    fontFamily: 'Roboto-Medium',
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(12),
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  invoiceNumber: {
    fontSize: scale(18), // 16 + 2
    color: '#333333', // Important text - black for maximum contrast
    fontFamily: 'Roboto-Medium',
  },
  statusBadge: {
    paddingVertical: scale(4),
    paddingHorizontal: scale(8),
    borderRadius: scale(5),
  },
  statusText: {
    color: '#fff',
    fontSize: scale(14), // 12 + 2
  },
  customerName: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
    marginBottom: scale(8),
    fontWeight: 'normal',
    fontFamily: 'Roboto-Medium',
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: scale(16), // 14 + 2
    color: '#333', // Card content - darker for better readability
    fontFamily: 'Roboto-Medium',
  },
  invoiceAmount: {
    fontSize: scale(18), // 16 + 2
    color: '#333333', // Important text - black for maximum contrast
    fontFamily: 'Roboto-Medium',
  },
  listContainer: {
    flex: 1,
    padding: scale(16),
  },
  listFooterLoader: {
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  addInvoiceButton: {
    position: 'absolute',
    bottom: scale(30),
    right: scale(30),
    backgroundColor: '#4f8cff',
    borderRadius: scale(28),
    paddingVertical: scale(16),
    paddingHorizontal: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: scale(8),
    shadowOffset: { width: 0, height: scale(4) },
  },
  addInvoiceText: {
    color: '#fff',
    fontSize: scale(18), // 16 + 2
    marginLeft: scale(8),
    fontWeight: '700',
  },
  dropdownItem: {
    padding: scale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputFocused: {
    borderColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOpacity: 0.15,
    shadowRadius: scale(6),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  dropdownItemText: {
    fontSize: scale(14), // Match input field size
    color: '#333333', // Dropdown text - black for better readability
    fontFamily: 'Roboto-Medium',
  },
  syncButton: {
    backgroundColor: '#4f8cff',
    paddingVertical: scale(36),
    paddingHorizontal: scale(30),
    marginLeft: scale(10),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f8cff',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: scale(14),
  },
};

const styles: StyleSheet.NamedStyles<any> = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: '#4f8cff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: scale(12),
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    marginLeft: scale(12),
    fontFamily: 'Roboto-Medium',
  },
  ...invoiceLikeStyles,
  // Bottom buttons UI (unified)
  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
  },
  submitButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonFullWidth: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  updateButtonEdit: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonEdit: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(32),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: scale(4) },
  },
  modalTitle: {
    fontSize: scale(18),
    color: '#28a745', // Keep success color for modal titles
    marginBottom: scale(8),
    fontFamily: 'Roboto-Medium',
  },
  modalMessage: {
    fontSize: scale(14),
    color: '#333333', // Modal content - black for better readability
    marginBottom: scale(20),
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
  modalButton: {
    backgroundColor: '#28a745',
    borderRadius: scale(8),
    paddingVertical: scale(10),
    paddingHorizontal: scale(32),
  },
  modalButtonText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
  },
  errorTextField: {
    color: '#d32f2f', // Error text - darker red for better visibility
    fontSize: scale(14), // 12 + 2
    marginTop: scale(4),
    fontFamily: 'Roboto-Medium',
  },
  fieldWrapper: {
    marginBottom: scale(20),
    width: '100%',
  },
  // Item management styles
  itemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(8),
    padding: scale(16),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemTitle: {
    fontSize: scale(16),
    fontFamily: 'Roboto-Medium',
    color: '#333333',
    marginBottom: scale(12),
  },
  removeItemButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeItemText: {
    color: '#fff',
    fontSize: scale(14),
    fontFamily: 'Roboto-Medium',
    marginLeft: scale(4),
  },
  // GST Modal Styles
  gstModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 15,
  },
  gstModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  gstModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  gstModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gstModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  gstModalTitle: {
    fontSize: 20,
    color: '#333333',
    marginBottom: 4,
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },
  gstModalSubtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'Roboto-Medium',
  },
  gstModalContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  gstOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#fafbfc',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  gstOptionSelected: {
    backgroundColor: '#f0f6ff',
    borderColor: '#4f8cff',
    borderWidth: 2,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  gstOptionLast: {
    marginBottom: 0,
  },
  gstOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gstIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gstIconSelected: {
    backgroundColor: '#4f8cff',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  gstTextContainer: {
    flex: 1,
  },
  gstOptionText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
    fontFamily: 'Roboto-Medium',
  },
  gstOptionTextSelected: {
    color: '#4f8cff',
    fontFamily: 'Roboto-Medium',
  },
  gstDescription: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Roboto-Medium',
  },
  gstCheckContainer: {
    marginLeft: 12,
  },
  // Items Section Styles
  itemsSection: {
    backgroundColor: '#fff',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemsTitle: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f8cff',
    paddingVertical: 7.5,
    paddingHorizontal: 12,
    borderRadius: 18.75,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  addItemText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
    fontFamily: 'Roboto-Medium',
  },
  itemRow: {
    marginBottom: 20,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
    marginHorizontal: 0,
  },
  itemRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemIndexContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4f8cff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  itemIndex: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Roboto-Medium',
  },
  itemContent: {
    flex: 1,
  },
  itemDescriptionContainer: {
    marginBottom: 12,
  },
  itemFieldLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
    letterSpacing: 0.1,
    fontFamily: 'Roboto-Medium',
  },
  itemDescriptionInput: {
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'center',
    minHeight: 40,
    fontFamily: 'Roboto-Medium',
  },
  itemDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemDetailColumn: {
    flex: 1,
    marginBottom: 4,
  },
  itemQuantityInput: {
    fontSize: 14,
    color: '#333333',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    minHeight: 40,
    fontFamily: 'Roboto-Medium',
  },
  itemAmountDisplay: {
    backgroundColor: '#f0f6ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#4f8cff',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#4f8cff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemAmountText: {
    fontSize: 14,
    color: '#4f8cff',
    fontFamily: 'Roboto-Medium',
  },
  // Picker Input Styles
  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: scale(8),
    backgroundColor: '#fff',
    paddingHorizontal: scale(12),
    paddingVertical: scale(16),
    height: scale(70),
    marginTop: scale(4),
  },
  pickerText: {
    fontSize: scale(19),
    color: '#333333',
    fontFamily: 'Roboto-Medium',
    flex: 1,
  },
  placeholderText: {
    color: '#666666',
    fontSize: scale(16),
  },
  // Use `syncButton` and `syncButtonText` from `invoiceLikeStyles` to ensure
  // visual parity with `PurchaseScreen` (single source of truth). Removing
  // duplicate definitions here avoids accidental overrides.
  actionButtonsBottom: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingVertical: scale(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  // duplicate style keys removed; using definitions from invoiceLikeStyles
});

export default InvoiceScreen;
