# Screen Development Rules & Conventions

## Overview

This document defines the rules, patterns, and conventions for developing screens in the UtilsApp React Native application. These rules ensure consistency, maintainability, and best practices across all screen components.

## Table of Contents

1. [File Structure & Naming](#file-structure--naming)
2. [Component Architecture](#component-architecture)
3. [State Management](#state-management)
4. [API Integration](#api-integration)
5. [Error Handling](#error-handling)
6. [UI/UX Patterns](#uiux-patterns)
7. [Navigation Patterns](#navigation-patterns)
8. [Form Handling](#form-handling)
9. [Performance & Optimization](#performance--optimization)
10. [Testing & Debugging](#testing--debugging)

---

## File Structure & Naming

### File Naming Convention

- **Screen Components**: Use PascalCase with "Screen" suffix
  - ✅ `CustomerScreen.tsx`
  - ✅ `AddNewEntryScreen.tsx`
  - ❌ `customer-screen.tsx`
  - ❌ `Customer.tsx`

### Import Organization

```typescript
// 1. React & React Native imports
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

// 2. Third-party library imports
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// 3. Local imports (relative paths)
import { AppStackParamList } from '../../types/navigation';
import { BASE_URL } from '../../api';
import { getUserIdFromToken } from '../../utils/storage';
```

---

## Component Architecture

### Component Structure Template

```typescript
const ComponentName: React.FC = () => {
  // 1. Hooks & Navigation
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'RouteName'>>();

  // 2. State declarations
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 3. Refs
  const scrollRef = useRef<ScrollView>(null);

  // 4. Effects
  useEffect(() => {
    // Component mount logic
  }, []);

  // 5. Event handlers
  const handleAction = () => {
    // Handler logic
  };

  // 6. Render methods
  const renderContent = () => {
    // Render logic
  };

  // 7. Main return
  return (
    <SafeAreaView style={styles.container}>
      {/* Component content */}
    </SafeAreaView>
  );
};
```

### Required Imports for All Screens

```typescript
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
```

---

## State Management

### State Declaration Rules

1. **Use descriptive names** that clearly indicate purpose
2. **Group related state** in objects when appropriate
3. **Initialize with sensible defaults**
4. **Use proper TypeScript types**

```typescript
// ✅ Good - Descriptive names with proper types
const [customers, setCustomers] = useState<Customer[]>([]);
const [filterOptions, setFilterOptions] = useState<FilterOptions>({
  sortBy: 'name',
  sortOrder: 'asc',
  amountRange: 'all',
  type: 'all',
  location: '',
  hasPhone: 'all',
  hasGST: 'all',
});

// ❌ Bad - Vague names, no types
const [data, setData] = useState([]);
const [filters, setFilters] = useState({});
```

### State Update Patterns

```typescript
// ✅ Good - Functional updates for complex state
setFilterOptions(prev => ({
  ...prev,
  type: newType,
  location: newLocation,
}));

// ✅ Good - Direct updates for simple state
setSearchQuery(newQuery);

// ❌ Bad - Mutating existing state
const newFilters = filterOptions;
newFilters.type = newType;
setFilterOptions(newFilters);
```

---

## API Integration

### API Call Structure

```typescript
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${BASE_URL}/endpoint`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    setData(data);
  } catch (error: any) {
    console.error('API Error:', error);
    setError(error.message || 'Failed to fetch data');
  } finally {
    setLoading(false);
  }
};
```

### Error Handling for API Calls

```typescript
// Standard error handling pattern
if (error.response?.status === 401) {
  errorMessage = 'Authentication failed. Please login again.';
} else if (error.response?.status === 403) {
  errorMessage = 'Access forbidden. Please check your permissions.';
} else if (error.response?.status === 404) {
  errorMessage =
    'API endpoint not found. Please check the server configuration.';
} else if (error.response?.status >= 500) {
  errorMessage = 'Server error. Please try again later.';
} else if (error.code === 'NETWORK_ERROR') {
  errorMessage = 'Network error. Please check your connection.';
} else if (error.code === 'TIMEOUT_ERROR' || error.code === 'ECONNABORTED') {
  errorMessage = 'Request failed. Please try again.';
}
```

---

## Error Handling

### Error State Management

```typescript
// Always include error state
const [error, setError] = useState<string | null>(null);

// Clear errors when starting new operations
const handleAction = async () => {
  setError(null);
  try {
    // Action logic
  } catch (error: any) {
    setError(error.message || 'An error occurred');
  }
};
```

### Error Display Patterns

```typescript
// Standard error container
{
  error ? (
    <View style={styles.errorContainer}>
      <MaterialCommunityIcons name="alert-circle" size={48} color="#dc3545" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : null;
}
```

---

## UI/UX Patterns

### Color Scheme

```typescript
// Primary colors
const COLORS = {
  primary: '#4f8cff', // Blue - Primary actions
  success: '#28a745', // Green - Positive actions, receipts
  danger: '#dc3545', // Red - Negative actions, payments
  warning: '#ff9500', // Orange - Warnings, purchases
  info: '#9c27b0', // Purple - Information, sales
  secondary: '#64748b', // Gray - Secondary text
  light: '#f6fafc', // Light background
  white: '#ffffff', // White background
  border: '#e2e8f0', // Border color
};
```

### Button Styles

```typescript
// Primary button
const primaryButton = {
  backgroundColor: '#4f8cff',
  paddingVertical: 16,
  borderRadius: 8,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};

// Secondary button
const secondaryButton = {
  backgroundColor: '#fff',
  paddingVertical: 16,
  borderRadius: 8,
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#4f8cff',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};
```

### Card Design

```typescript
const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 20,
  marginTop: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};
```

---

## Navigation Patterns

### Navigation Setup

```typescript
// Always type navigation properly
const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();
const route = useRoute<RouteProp<AppStackParamList, 'RouteName'>>();

// Extract route params with defaults
const { customer, partyType, refresh } = route.params || {};
```

### Navigation Actions

```typescript
// Navigate to new screen
navigation.navigate('ScreenName', { param1: value1, param2: value2 });

// Navigate back
navigation.goBack();

// Navigate and replace current screen
navigation.replace('ScreenName', { param: value });

// Navigate to drawer
navigation.dispatch(DrawerActions.openDrawer());
```

### Route Parameter Handling

```typescript
// Always provide defaults for optional params
const {
  customer = null,
  partyType = 'customer',
  editMode = false,
} = route.params || {};

// Validate required params early
if (!customer || !partyType) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Required data not found</Text>
      </View>
    </SafeAreaView>
  );
}
```

---

## Form Handling

### Form State Management

```typescript
// Group form fields in a single state object
const [formData, setFormData] = useState({
  name: '',
  email: '',
  phone: '',
  address: '',
});

// Update individual fields
const updateField = (field: keyof typeof formData, value: string) => {
  setFormData(prev => ({
    ...prev,
    [field]: value,
  }));
};

// Clear all fields
const clearForm = () => {
  setFormData({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
};
```

### Form Validation

```typescript
const validateForm = (): boolean => {
  const errors: Record<string, string> = {};

  if (!formData.name.trim()) {
    errors.name = 'Name is required';
  } else if (formData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!formData.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (!/^\d{10}$/.test(formData.phone.trim())) {
    errors.phone = 'Phone number must be 10 digits';
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Input Field Patterns

```typescript
const renderInputField = (
  label: string,
  value: string,
  onChangeText: (text: string) => void,
  error?: string,
  placeholder?: string,
  keyboardType: 'default' | 'phone-pad' | 'numeric' = 'default',
  multiline: boolean = false,
) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={[
        styles.textInput,
        multiline && styles.textInputMultiline,
        error && styles.textInputError,
      ]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);
```

---

## Performance & Optimization

### useEffect Dependencies

```typescript
// ✅ Good - Minimal dependencies
useEffect(() => {
  fetchData();
}, []); // Empty dependency array for mount-only

// ✅ Good - Specific dependencies
useEffect(() => {
  if (customer.id) {
    fetchTransactions(customer.id);
  }
}, [customer.id]);

// ❌ Bad - Unnecessary dependencies
useEffect(() => {
  fetchData();
}, [customers, loading, error]); // This will cause infinite loops
```

### Memoization

```typescript
// Memoize expensive calculations
const filteredCustomers = useMemo(() => {
  return customers.filter(customer => {
    // Complex filtering logic
  });
}, [customers, searchQuery, filterOptions]);

// Memoize callback functions
const handleCustomerPress = useCallback(
  (customer: Customer) => {
    navigation.navigate('CustomerDetail', { customer });
  },
  [navigation],
);
```

### List Optimization

```typescript
// Use FlatList for large lists
<FlatList
  data={customers}
  renderItem={renderCustomerItem}
  keyExtractor={item => String(item.id)}
  showsVerticalScrollIndicator={false}
  scrollEnabled={false} // When nested in ScrollView
  nestedScrollEnabled={false}
/>;

// Use getItemLayout for fixed-height items
const getItemLayout = (data: any, index: number) => ({
  length: 80, // Fixed height
  offset: 80 * index,
  index,
});
```

---

## Testing & Debugging

### Console Logging Standards

```typescript
// Use emojis for visual distinction
console.log('🚀 Component mounted - fetching data');
console.log('✅ API call successful:', response.data);
console.log('❌ API call failed:', error);
console.log('🔄 Retrying operation...');
console.log('📊 Data summary:', { count: data.length, type: dataType });

// Log important state changes
console.log('🔄 State updated:', {
  customersCount: customers.length,
  error,
  timestamp: new Date().toISOString(),
});
```

### Error Boundaries

```typescript
// Always wrap main render in try-catch
const renderMainContent = () => {
  try {
    return <>{/* Component content */}</>;
  } catch (error) {
    console.error('Main render error:', error);
    setHasError(true);
    setErrorDetails(
      error instanceof Error ? error.message : 'Unknown render error',
    );
    return null;
  }
};
```

### Debug Information

```typescript
// Include debug info in development
if (__DEV__) {
  console.log('🔍 Debug info:', {
    component: 'CustomerScreen',
    props: route.params,
    state: { customers: customers.length, error, loading },
    timestamp: new Date().toISOString(),
  });
}
```

---

## Accessibility

### Required Accessibility Features

```typescript
// Always include accessibility labels
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Add new customer"
  accessibilityHint="Opens form to add a new customer"
  onPress={handleAddCustomer}
>
  <Text>Add Customer</Text>
</TouchableOpacity>;

// Use semantic colors and contrast
const accessibleColors = {
  primary: '#4f8cff', // Good contrast with white
  success: '#28a745', // Good contrast with white
  danger: '#dc3545', // Good contrast with white
  text: '#333', // Good contrast with white background
  secondary: '#666', // Good contrast with white background
};
```

---

## Security

### Data Validation

```typescript
// Always validate user input
const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, ''); // Remove potential HTML tags
};

// Validate API responses
const validateApiResponse = (response: any): boolean => {
  return (
    response && typeof response === 'object' && Array.isArray(response.data)
  );
};
```

### Token Handling

```typescript
// Always check token before API calls
const token = await AsyncStorage.getItem('accessToken');
if (!token) {
  throw new Error('Authentication required');
}

// Validate token format
if (token.length < 10) {
  throw new Error('Invalid authentication token');
}
```

---

## File Organization

### Component File Structure

```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
// ... other imports

// 2. Interfaces & Types
interface ComponentProps {
  // Props interface
}

// 3. Component Definition
const ComponentName: React.FC = () => {
  // 4. Hooks & State
  // 5. Effects
  // 6. Event Handlers
  // 7. Render Methods
  // 8. Main Return
};

// 9. Styles
const styles = StyleSheet.create({
  // Styles organized by component section
});

// 10. Export
export default ComponentName;
```

---

## Common Patterns

### Loading States

```typescript
// Always show loading state during async operations
{
  loading ? (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4f8cff" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  ) : null;
}
```

### Empty States

```typescript
// Show helpful empty state when no data
{
  data.length === 0 ? (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="inbox-outline" size={48} color="#ccc" />
      <Text style={styles.emptyText}>No items found</Text>
      <Text style={styles.emptySubtext}>
        Add your first item to get started
      </Text>
    </View>
  ) : null;
}
```

### Retry Mechanisms

```typescript
// Always provide retry options for failed operations
const handleRetry = async () => {
  try {
    setError(null);
    await fetchData();
  } catch (error) {
    console.error('Retry failed:', error);
  }
};
```

---

## Best Practices Summary

1. **Always use TypeScript** with proper typing
2. **Handle errors gracefully** with user-friendly messages
3. **Show loading states** for all async operations
4. **Validate user input** before processing
5. **Use consistent naming conventions** across components
6. **Implement proper error boundaries** and fallbacks
7. **Optimize performance** with useMemo and useCallback
8. **Follow accessibility guidelines** for inclusive design
9. **Use semantic colors** and maintain good contrast
10. **Implement retry mechanisms** for failed operations
11. **Log important events** for debugging
12. **Group related state** in objects when appropriate
13. **Use proper navigation typing** with AppStackParamList
14. **Implement proper form validation** with clear error messages
15. **Use consistent UI patterns** across all screens

---

## Code Review Checklist

Before submitting any screen component, ensure:

- [ ] All imports are properly organized
- [ ] Component follows the standard structure template
- [ ] State is properly typed and initialized
- [ ] Error handling is implemented for all async operations
- [ ] Loading states are shown during operations
- [ ] Empty states are handled gracefully
- [ ] Form validation is comprehensive
- [ ] Navigation is properly typed
- [ ] Console logging uses standard emoji format
- [ ] Accessibility features are implemented
- [ ] Performance optimizations are in place
- [ ] Error boundaries are implemented
- [ ] Retry mechanisms are available
- [ ] Code follows the established patterns
- [ ] Styles are consistent with the design system

---

_This document should be updated as new patterns emerge and best practices evolve._
