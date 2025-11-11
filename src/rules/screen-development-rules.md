# Screen Development Rules for InvoiceScreen, PurchaseScreen, ReceiptScreen, and PaymentScreen

## 1. Component Structure and Imports

### Required Imports Pattern

```typescript
// Core React and React Native imports
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  Keyboard,
  StatusBar,
} from 'react-native';

// Navigation
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// UI Components
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

// API and Storage
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';

// Context and Hooks
import { useTransactionLimit } from '../../context/TransactionLimitContext';
import { useCustomerContext } from '../../context/CustomerContext';
```

### Interface Definitions

- Always define interfaces for screen parameters, data structures, and form states
- Use consistent naming: `{ScreenName}Item`, `{ScreenName}`, `Parsed{ScreenName}Data`
- Include proper TypeScript types for all state variables

## 2. State Management Rules

### Required State Variables

```typescript
// Form states
const [showCreateForm, setShowCreateForm] = useState(false);
const [loading, setLoading] = useState(false);
const [loadingSave, setLoadingSave] = useState(false);
const [loadingDraft, setLoadingDraft] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);

// Document number state
const [{documentType}Number, set{documentType}Number] = useState('');

// Customer/Party information
const [customerName, setCustomerName] = useState('');
const [customerPhone, setCustomerPhone] = useState('');
const [customerAddress, setCustomerAddress] = useState('');

// Date states
const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

// Items array
const [items, setItems] = useState<{ScreenName}Item[]>([{
  id: '1',
  description: '',
  quantity: 1,
  rate: 0,
  amount: 0,
}]);

// GST and calculations
const [gstPct, setGstPct] = useState(18);
const [taxAmount, setTaxAmount] = useState(0);
const [discountAmount, setDiscountAmount] = useState(0);

// Voice and OCR states
const [voiceLoading, setVoiceLoading] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [ocrLoading, setOcrLoading] = useState(false);
const [ocrError, setOcrError] = useState<string | null>(null);

// UI states
const [showDatePicker, setShowDatePicker] = useState(false);
const [showDropdown, setShowDropdown] = useState(false);
const [showModal, setShowModal] = useState(false);
const [showFileTypeModal, setShowFileTypeModal] = useState(false);
```

### State Naming Conventions

- Use camelCase for all state variables
- Prefix boolean states with `show`, `is`, `has`
- Use descriptive names that clearly indicate the state's purpose
- Group related states together in the component

## 3. Form Validation Rules

### Validation Function Pattern

```typescript
const isFieldInvalid = (field: string, fieldType?: string) => {
  if (!triedSubmit) return false;

  switch (field) {
    case 'customerName':
      return !customerName.trim();
    case 'customerPhone':
      return !customerPhone.trim() || customerPhone.trim().length < 10;
    case 'invoiceDate':
      return !invoiceDate;
    case 'items':
      return (
        !items.length ||
        items.some(
          item =>
            !item.description.trim() || item.quantity <= 0 || item.rate <= 0,
        )
      );
    default:
      return false;
  }
};

const getFieldError = (field: string) => {
  if (!triedSubmit) return '';

  switch (field) {
    case 'customerName':
      return !customerName.trim() ? 'Customer name is required' : '';
    case 'customerPhone':
      if (!customerPhone.trim()) return 'Phone number is required';
      if (customerPhone.trim().length < 10)
        return 'Phone number must be at least 10 digits';
      return '';
    case 'items':
      if (!items.length) return 'At least one item is required';
      const invalidItem = items.find(
        item =>
          !item.description.trim() || item.quantity <= 0 || item.rate <= 0,
      );
      if (invalidItem)
        return 'All items must have description, quantity, and rate';
      return '';
    default:
      return '';
  }
};
```

### Validation Rules

- Always validate required fields: customer name, phone, date, items
- Phone numbers must be at least 10 digits
- Items must have description, quantity > 0, and rate > 0
- Use `triedSubmit` state to only show validation errors after user attempts submission
- Provide clear, user-friendly error messages

## 4. API Integration Rules

### Fetch Data Pattern

```typescript
const fetch{ScreenName}s = async () => {
  setLoadingApi(true);
  setApiError(null);
  try {
    const token = await AsyncStorage.getItem('accessToken');
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
        err.message || `Failed to fetch ${folderName.toLowerCase()}s: ${res.status}`
      );
    }

    const data = await res.json();
    const filtered = (data.data || []).filter(
      (v: any) => v.type === folderName.toLowerCase()
    );
    setApi{ScreenName}s(filtered);
  } catch (e: any) {
    setApiError(e.message || `Error fetching ${folderName.toLowerCase()}s`);
  } finally {
    setLoadingApi(false);
  }
};
```

### Submit Data Pattern

```typescript
const handleSubmit = async (
  status: 'complete' | 'draft',
  syncYNOverride?: 'Y' | 'N'
) => {
  setTriedSubmit(true);

  // Validation
  if (isFieldInvalid('customerName') ||
      isFieldInvalid('customerPhone') ||
      isFieldInvalid('items')) {
    showCustomPopup('Validation Error', 'Please fill in all required fields', 'error');
    return;
  }

  setLoadingSave(status === 'complete');
  setLoadingDraft(status === 'draft');

  try {
    const token = await AsyncStorage.getItem('accessToken');
    const userId = await getUserIdFromToken();

    const payload = {
      // Form data mapping
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      // ... other fields
      items: items.map(item => ({
        description: item.description.trim(),
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
      })),
      status: status,
      syncYN: syncYNOverride || syncYN,
    };

    const response = await axios.post(`${BASE_URL}/transactions`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      showCustomPopup('Success', `${status === 'complete' ? 'Saved' : 'Draft saved'} successfully`, 'success');
      await fetch{ScreenName}s();
      resetForm();
    }
  } catch (error: any) {
    showCustomPopup('Error', error.response?.data?.message || 'Failed to save', 'error');
  } finally {
    setLoadingSave(false);
    setLoadingDraft(false);
  }
};
```

## 5. UI Component Rules

### Custom Popup Pattern

```typescript
const [showPopup, setShowPopup] = useState(false);
const [popupTitle, setPopupTitle] = useState('');
const [popupMessage, setPopupMessage] = useState('');
const [popupType, setPopupType] = useState<'success' | 'error' | 'info'>(
  'info',
);

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
```

### Status Badge Pattern

```typescript
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return '#4CAF50';
    case 'pending':
      return '#FF9800';
    case 'overdue':
      return '#F44336';
    default:
      return '#9E9E9E';
  }
};

const getStatusLabel = (status: string) => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'overdue':
      return 'Overdue';
    default:
      return status;
  }
};
```

### Currency Formatting

```typescript
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};
```

## 6. Calculation Rules

### Required Calculation Functions

```typescript
const calculateSubtotal = () => {
  return items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
};

const calculateGST = () => {
  const subtotal = calculateSubtotal();
  return (subtotal * gstPct) / 100;
};

const calculateTotal = () => {
  const subtotal = calculateSubtotal();
  const gst = calculateGST();
  return subtotal + gst + taxAmount - discountAmount;
};
```

### Item Management Functions

```typescript
const addItem = () => {
  const newItem: {ScreenName}Item = {
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
  field: keyof {ScreenName}Item,
  value: string | number
) => {
  setItems(items.map(item => {
    if (item.id === id) {
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'rate') {
        updated.amount = updated.quantity * updated.rate;
      }
      return updated;
    }
    return item;
  }));
};

const removeItem = (id: string) => {
  setItems(items.filter(item => item.id !== id));
};
```

## 7. Voice and OCR Integration Rules

### Voice Recording Pattern

```typescript
const startVoiceRecording = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        showCustomPopup(
          'Permission Required',
          'Microphone permission is required for voice input',
          'error',
        );
        return;
      }
    }

    setVoiceLoading(true);
    setVoiceError('');
    await audioRecorderPlayer.startRecorder();
    setIsRecording(true);
  } catch (error: any) {
    setVoiceError('Failed to start recording');
    showCustomPopup('Error', 'Failed to start voice recording', 'error');
  }
};

const stopVoiceRecording = async () => {
  try {
    const result = await audioRecorderPlayer.stopRecorder();
    setIsRecording(false);
    setVoiceLoading(true);
    await sendAudioForTranscription(result);
  } catch (error: any) {
    setVoiceError('Failed to stop recording');
    showCustomPopup('Error', 'Failed to stop voice recording', 'error');
  }
};
```

### OCR Processing Pattern

```typescript
const processDocumentWithOCR = async (file: any) => {
  setOcrLoading(true);
  setOcrError(null);

  try {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    });

    const token = await AsyncStorage.getItem('accessToken');
    const response = await axios.post(`${BASE_URL}/ocr/extract`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      const extractedText = response.data.text;
      processOcrText(extractedText);
    } else {
      throw new Error(response.data.message || 'OCR processing failed');
    }
  } catch (error: any) {
    setOcrError(error.message || 'Failed to process document');
    showCustomPopup(
      'OCR Error',
      error.message || 'Failed to process document',
      'error',
    );
  } finally {
    setOcrLoading(false);
  }
};
```

## 8. Error Handling Rules

### Error State Management

- Always use try-catch blocks for async operations
- Set loading states before operations and clear them in finally blocks
- Use custom popup for user-facing error messages
- Log errors to console for debugging
- Provide fallback values for critical data

### Network Error Handling

```typescript
try {
  const response = await axios.post(url, data, config);
  // Handle success
} catch (error: any) {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || 'Server error';
    showCustomPopup('Error', message, 'error');
  } else if (error.request) {
    // Network error
    showCustomPopup(
      'Network Error',
      'Please check your internet connection',
      'error',
    );
  } else {
    // Other error
    showCustomPopup('Error', 'An unexpected error occurred', 'error');
  }
}
```

## 9. Performance Rules

### Optimization Guidelines

- Use `useCallback` for event handlers that are passed to child components
- Use `useMemo` for expensive calculations
- Implement proper cleanup in `useEffect` hooks
- Use `FlatList` for large lists with proper `keyExtractor` and `getItemLayout`
- Debounce search inputs to avoid excessive API calls

### Memory Management

```typescript
useEffect(() => {
  return () => {
    // Cleanup audio recorder
    if (audioRecorderPlayer) {
      audioRecorderPlayer.stopRecorder();
    }
  };
}, []);
```

## 10. Accessibility Rules

### Required Accessibility Props

```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Add new item"
  accessibilityHint="Tap to add a new item to the list"
  accessibilityRole="button"
>
  <Text>Add Item</Text>
</TouchableOpacity>

<TextInput
  accessible={true}
  accessibilityLabel="Customer name input"
  accessibilityHint="Enter the customer name"
  placeholder="Customer Name"
/>
```

## 11. Testing Rules

### Required Test Coverage

- Form validation functions
- API integration functions
- Calculation functions
- Error handling scenarios
- User interaction flows

### Test Data Patterns

```typescript
const mockData = {
  invoice: {
    id: '1',
    invoiceNumber: 'INV-001',
    customerName: 'Test Customer',
    customerPhone: '9876543210',
    date: '2024-01-15',
    amount: 1000,
    status: 'Pending',
  },
  items: [
    {
      id: '1',
      description: 'Test Item',
      quantity: 1,
      rate: 1000,
      amount: 1000,
    },
  ],
};
```

## 12. Code Organization Rules

### File Structure

- Keep interfaces at the top of the file
- Group related functions together
- Use consistent naming conventions
- Add JSDoc comments for complex functions
- Keep component size manageable (max 500 lines per component)

### Function Organization

1. State declarations
2. Effect hooks
3. Event handlers
4. Utility functions
5. Render functions
6. Return statement

## 13. Security Rules

### Data Validation

- Always validate user input on both client and server
- Sanitize data before sending to API
- Use proper TypeScript types to prevent type errors
- Implement proper error boundaries

### API Security

- Always include authorization headers
- Use HTTPS for all API calls
- Implement proper token refresh logic
- Never log sensitive data to console in production

## 14. Maintenance Rules

### Code Documentation

- Add comments for complex business logic
- Document API endpoints and their expected responses
- Keep README files updated with setup instructions
- Document any environment-specific configurations

### Version Control

- Use meaningful commit messages
- Create feature branches for new functionality
- Keep commits atomic and focused
- Review code before merging to main branch

---

These rules ensure consistency, maintainability, and reliability across all four main screens in the application. Follow these patterns when implementing new features or modifying existing functionality.

## 15. Design and Sizing Rules (apply 75% scale)

- Target screens: `InvoiceScreen.tsx`, `PurchaseScreen.tsx`, `ReceiptScreen.tsx`, `PaymentScreen.tsx`.
- Reduce visual sizes by 25% (i.e., use 0.75x of the original for headers, images, buttons, icons).

### Global scale helper

```typescript
const SCALE = 0.75;
const scale = (value: number) => Math.round(value * SCALE);
```

### Sizing guidelines

- Headers: multiply `fontSize`, `lineHeight`, paddings/margins by `scale(...)`.
- Images: multiply `width`, `height`, `maxWidth`, `maxHeight` by `scale(...)`.
- Buttons: multiply `height`, `paddingVertical`, `paddingHorizontal`, `borderRadius`, and label `fontSize` by `scale(...)`.
- Icons: pass `size={scale(originalSize)}` to icon components.
- Spacing related to these elements: multiply `margin*` and `padding*` by `scale(...)`.

### Examples

```typescript
// Icons
<MaterialCommunityIcons name="plus" size={scale(24)} color="#333" />;

// Header text
const styles = StyleSheet.create({
  headerTitle: {
    fontSize: scale(24),
    lineHeight: scale(32),
    paddingVertical: scale(8),
  },
});

// Image
const stylesImage = StyleSheet.create({
  preview: {
    width: scale(200),
    height: scale(120),
    borderRadius: scale(8),
  },
});

// Button
const stylesButton = StyleSheet.create({
  primaryButton: {
    height: scale(48),
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    borderRadius: scale(10),
  },
  primaryButtonText: {
    fontSize: scale(16),
  },
});
```
