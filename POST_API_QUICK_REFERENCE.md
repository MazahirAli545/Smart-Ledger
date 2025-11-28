# POST API Quick Reference Guide

## 🚀 Quick Migration Guide

### Before (Current Pattern)

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    const result = await unifiedApi.post('/transactions', body);
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};
```

### After (Recommended Pattern)

```typescript
import { usePostMutation } from '../../hooks/useMutation';

const { mutate, isLoading } = usePostMutation('/transactions', {
  retryOnTimeout: true,
  maxRetries: 2,
  onSuccess: data => {
    // Handle success
  },
  onError: error => {
    // Handle error
  },
});

const handleSubmit = async () => {
  await mutate(body);
};
```

## 📋 Common Patterns

### 1. Basic POST with Validation

```typescript
const { mutate, isLoading } = usePostMutation('/transactions', {
  validatePayload: body =>
    validatePayload(body, {
      required: ['amount', 'type', 'partyName'],
      numbers: ['amount'],
      dates: ['date'],
    }),
  retryOnTimeout: true,
  maxRetries: 2,
});
```

### 2. POST with Error Handling

```typescript
import { handleApiError } from '../../utils/apiErrorHandler';

const { mutate } = usePostMutation('/transactions', {
  onError: error => {
    const errorInfo = handleApiError(error);

    if (errorInfo.isForbidden) {
      showAlert('Access Denied', errorInfo.message, 'error');
      return;
    }

    if (errorInfo.message.includes('transaction limit')) {
      showLimitPopup();
      return;
    }

    showAlert('Error', errorInfo.message, 'error');
  },
});
```

### 3. Direct API Call (When Hook Not Suitable)

```typescript
await unifiedApi.post('/transactions', body, {
  retryOnTimeout: true,
  maxRetries: 2,
  logRequest: __DEV__,
});
```

### 4. Create Transaction (Most Common)

```typescript
const { mutate: createTransaction, isLoading } = usePostMutation(
  '/transactions',
  {
    retryOnTimeout: true,
    maxRetries: 2,
    validatePayload: body =>
      validatePayload(body, {
        required: ['amount', 'type', 'partyName', 'date'],
        numbers: ['amount'],
      }),
    onSuccess: data => {
      // Refresh lists, cache items, etc.
      refreshTransactions();
      if (data?.id) {
        cacheItems(data.id, items);
      }
    },
  },
);
```

### 5. Create Customer/Supplier

```typescript
const { mutate: createCustomer, isLoading } = usePostMutation('/customers', {
  retryOnTimeout: true,
  maxRetries: 2,
  validatePayload: body =>
    validatePayload(body, {
      required: ['name'],
      phones: ['phoneNumber'],
    }),
  onSuccess: () => {
    refreshCustomers();
    navigation.goBack();
  },
});
```

## ✅ Checklist for Each Screen

- [ ] Replace manual `setLoading` with `useMutation` hook
- [ ] Add `retryOnTimeout: true` for idempotent POSTs
- [ ] Add payload validation
- [ ] Use `handleApiError()` for error handling
- [ ] Handle transaction limit errors
- [ ] Handle 403 Forbidden errors
- [ ] Disable submit button when `isLoading`
- [ ] Show success/error feedback
- [ ] Refresh relevant lists after success

## 🎯 Priority Screens

1. **AddNewEntryScreen.tsx** - Most complex, highest impact
2. **PurchaseScreen.tsx** - High usage
3. **PaymentScreen.tsx** - High usage
4. **InvoiceScreen.tsx** - High usage
5. **ReceiptScreen.tsx** - High usage
6. **AddPartyScreen.tsx** - Medium usage
7. **AddFolderScreen.tsx** - Low usage

## 🔧 Key Utilities

### Payload Validation

```typescript
import { validatePayload } from '../../utils/payloadValidator';

validatePayload(body, {
  required: ['field1', 'field2'],
  numbers: ['amount'],
  dates: ['date'],
  emails: ['email'],
  phones: ['phone'],
});
```

### Error Handling

```typescript
import { handleApiError } from '../../utils/apiErrorHandler';

const errorInfo = handleApiError(error);
// errorInfo.isForbidden
// errorInfo.message
// errorInfo.status
```

### Request Logging

```typescript
// Enable logging
await unifiedApi.post('/endpoint', body, { logRequest: true });

// View logs
const logs = unifiedApi.getRequestLogs(20);
console.log(logs);
```

## 📝 Notes

- **Idempotency**: Automatically enabled for POST/PUT/PATCH (except OTP endpoints)
- **Retry**: Only safe for idempotent requests (transactions, customers, etc.)
- **Validation**: Catch errors before API call
- **Error Handling**: Consistent user-friendly messages
- **Loading States**: Automatic with `useMutation` hook
