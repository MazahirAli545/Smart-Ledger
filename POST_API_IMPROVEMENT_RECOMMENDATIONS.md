# POST API Call Improvement Recommendations

## Executive Summary

After reviewing all screen code in your app, I've identified several opportunities to improve POST API call implementations. Your `unifiedApiService` already has excellent features (idempotency, retry logic, caching), but most screens aren't leveraging them optimally.

## Current State Analysis

### ✅ What's Working Well

1. **Unified API Service** - Excellent foundation with:
   - Automatic idempotency keys
   - Request deduplication
   - Caching for GET requests
   - Retry logic for idempotent requests
   - Error handling with `ApiError` class

2. **Existing Hooks** - `useMutation` hook exists with:
   - Built-in loading states
   - Duplicate call prevention
   - Error handling
   - Payload validation support

3. **Utilities Available**:
   - `payloadValidator.ts` - Validation helpers
   - `apiErrorHandler.ts` - Consistent error handling

### ❌ Current Issues

1. **Low Adoption of `useMutation` Hook**
   - Most screens use direct `unifiedApi.post()` calls
   - Manual loading state management (`setLoading(true/false)`)
   - Inconsistent duplicate submission prevention

2. **Inconsistent Error Handling**
   - Some screens use `handleApiError()`, others have custom error handling
   - Different error messages for similar errors
   - Inconsistent user feedback

3. **Missing Optimizations**
   - Retry logic not enabled for idempotent POSTs (`retryOnTimeout: true`)
   - Payload validation not consistently used
   - Request logging not enabled for debugging

4. **Code Duplication**
   - Similar try-catch patterns repeated across screens
   - Loading state management duplicated
   - Error handling logic repeated

## Recommended Improvements

### 1. Adopt `useMutation` Hook (High Priority)

**Current Pattern (AddNewEntryScreen.tsx):**
```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    const resultBody = await unifiedApi.createTransaction(body);
    // ... handle success
  } catch (error) {
    // ... handle error
  } finally {
    setLoading(false);
  }
};
```

**Recommended Pattern:**
```typescript
import { usePostMutation } from '../../hooks/useMutation';
import { validatePayload } from '../../utils/payloadValidator';

const { mutate, isLoading, error } = usePostMutation('/transactions', {
  validatePayload: (body) => validatePayload(body, {
    required: ['amount', 'type', 'partyName'],
    numbers: ['amount'],
    dates: ['date', 'documentDate'],
  }),
  onSuccess: (data) => {
    // Handle success - refresh lists, show success message, etc.
    showCustomAlert('Success', 'Transaction created successfully', 'success');
    navigation.goBack();
  },
  onError: (error) => {
    // Handle error - already has user-friendly messages
    const { handleApiError } = require('../../utils/apiErrorHandler');
    const errorInfo = handleApiError(error);
    showCustomAlert('Error', errorInfo.message, 'error');
  },
});

const handleSubmit = async () => {
  await mutate(body);
};
```

**Benefits:**
- ✅ Automatic duplicate prevention
- ✅ Built-in loading state
- ✅ Consistent error handling
- ✅ Payload validation before API call
- ✅ Cleaner, more maintainable code

### 2. Enable Retry Logic for Idempotent POSTs

**Current:**
```typescript
await unifiedApi.createTransaction(body);
```

**Recommended:**
```typescript
await unifiedApi.post('/transactions', body, {
  retryOnTimeout: true,
  maxRetries: 2, // Retry up to 2 times on timeout/5xx errors
});
```

**Why:** Safe because idempotency keys prevent duplicate transactions. Improves reliability on poor network conditions.

### 3. Add Payload Validation

**Recommended Pattern:**
```typescript
import { validatePayload } from '../../utils/payloadValidator';

const validation = validatePayload(body, {
  required: ['amount', 'type', 'partyName', 'date'],
  numbers: ['amount'],
  dates: ['date', 'documentDate'],
});

if (!validation.valid) {
  showCustomAlert('Validation Error', validation.errors.join(', '), 'error');
  return;
}
```

**Or with useMutation:**
```typescript
const { mutate } = usePostMutation('/transactions', {
  validatePayload: (body) => validatePayload(body, {
    required: ['amount', 'type', 'partyName'],
    numbers: ['amount'],
  }),
});
```

### 4. Consistent Error Handling

**Recommended Pattern:**
```typescript
import { handleApiError } from '../../utils/apiErrorHandler';

try {
  await mutate(body);
} catch (error) {
  const errorInfo = handleApiError(error);
  
  // Handle transaction limit errors
  if (errorInfo.message.includes('transaction limit')) {
    await forceShowPopup();
    showCustomAlert('Limit Reached', errorInfo.message, 'error');
    return;
  }
  
  // Handle 403 Forbidden
  if (errorInfo.isForbidden) {
    showCustomAlert('Access Denied', errorInfo.message, 'error');
    return;
  }
  
  // Generic error
  showCustomAlert('Error', errorInfo.message, 'error');
}
```

### 5. Enable Request Logging for Debugging

**For Production Debugging:**
```typescript
await unifiedApi.post('/transactions', body, {
  logRequest: true, // Logs request details for debugging
  retryOnTimeout: true,
  maxRetries: 2,
});
```

**Access Logs:**
```typescript
const logs = unifiedApi.getRequestLogs(20);
console.log('Recent requests:', logs);
```

## Screen-by-Screen Recommendations

### High Priority Screens (Most POST Calls)

#### 1. AddNewEntryScreen.tsx
**Current Issues:**
- Manual loading state
- No duplicate prevention
- No retry logic
- Complex error handling

**Recommended Changes:**
```typescript
// Replace handleSubmit with useMutation
const { mutate: createTransaction, isLoading: isCreating } = usePostMutation(
  '/transactions',
  {
    validatePayload: (body) => {
      // Validate based on entry type
      if (isSimpleEntry) {
        return validatePayload(body, {
          required: ['amount', 'type', 'partyName', 'date'],
          numbers: ['amount'],
        });
      } else {
        return validatePayload(body, {
          required: ['amount', 'type', 'partyName', 'date', 'items'],
          numbers: ['amount', 'subTotal', 'totalAmount'],
        });
      }
    },
    onSuccess: async (data) => {
      // Handle success
      if (data?.id) {
        await saveCachedItems(data.id, safeItems);
        // ... rest of success logic
      }
    },
    onError: (error) => {
      // Use consistent error handling
      const errorInfo = handleApiError(error);
      showCustomAlert('Error', errorInfo.message, 'error');
    },
  }
);

const handleSubmit = async () => {
  // ... build body as before
  await createTransaction(body, {
    retryOnTimeout: true,
    maxRetries: 2,
  });
};
```

#### 2. PurchaseScreen.tsx
**Recommended:**
```typescript
const { mutate: createPurchase, isLoading } = usePostMutation('/transactions', {
  retryOnTimeout: true,
  maxRetries: 2,
  onSuccess: (data) => {
    // Handle success
    if (data?.id) {
      // Cache items, refresh lists, etc.
    }
  },
});
```

#### 3. PaymentScreen.tsx
**Recommended:**
```typescript
const { mutate: createPayment, isLoading } = usePostMutation('/transactions', {
  retryOnTimeout: true,
  maxRetries: 2,
  validatePayload: (body) => validatePayload(body, {
    required: ['amount', 'type', 'partyName', 'date'],
    numbers: ['amount'],
  }),
});
```

#### 4. InvoiceScreen.tsx / ReceiptScreen.tsx
**Same pattern as PurchaseScreen**

#### 5. AddPartyScreen.tsx
**Recommended:**
```typescript
const { mutate: createCustomer, isLoading } = usePostMutation('/customers', {
  retryOnTimeout: true,
  maxRetries: 2,
  validatePayload: (body) => validatePayload(body, {
    required: ['name'],
    phones: ['phoneNumber'],
  }),
});
```

### Medium Priority Screens

#### 6. ContactSalesModal.tsx
**Current:** Already uses `unifiedApi.post()` but could benefit from:
- `useMutation` hook
- Retry logic (if idempotent)
- Better error handling

#### 7. AddFolderScreen.tsx
**Recommended:**
```typescript
const { mutate: createFolder, isLoading } = usePostMutation('/menus', {
  retryOnTimeout: true,
  onSuccess: () => {
    // Refresh folders list
    fetchFolders();
  },
});
```

## Implementation Priority

### Phase 1: High-Impact Screens (Week 1)
1. ✅ AddNewEntryScreen.tsx
2. ✅ PurchaseScreen.tsx
3. ✅ PaymentScreen.tsx
4. ✅ InvoiceScreen.tsx
5. ✅ ReceiptScreen.tsx

### Phase 2: Medium-Impact Screens (Week 2)
6. ✅ AddPartyScreen.tsx
7. ✅ AddFolderScreen.tsx
8. ✅ ContactSalesModal.tsx

### Phase 3: Remaining Screens (Week 3)
9. ✅ SubscriptionPlanScreen.tsx (payment POSTs)
10. ✅ Other screens with POST calls

## Best Practices Checklist

For each screen with POST calls, ensure:

- [ ] Use `useMutation` hook instead of manual state management
- [ ] Enable `retryOnTimeout: true` for idempotent POSTs
- [ ] Add payload validation before API call
- [ ] Use `handleApiError()` for consistent error handling
- [ ] Handle transaction limit errors specifically
- [ ] Handle 403 Forbidden errors with user-friendly messages
- [ ] Disable submit button during `isLoading`
- [ ] Show success/error feedback to user
- [ ] Refresh relevant lists after successful POST
- [ ] Enable `logRequest: true` in development for debugging

## Code Template

Here's a complete template you can use for new screens or refactoring:

```typescript
import { usePostMutation } from '../../hooks/useMutation';
import { validatePayload } from '../../utils/payloadValidator';
import { handleApiError } from '../../utils/apiErrorHandler';
import { unifiedApi } from '../../api/unifiedApiService';

const YourScreen: React.FC = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();

  // Use mutation hook for POST
  const { mutate, isLoading, error } = usePostMutation('/your-endpoint', {
    // Validate payload before sending
    validatePayload: (body) => validatePayload(body, {
      required: ['field1', 'field2'],
      numbers: ['amount'],
      dates: ['date'],
    }),
    
    // Handle success
    onSuccess: (data) => {
      showAlert({
        title: 'Success',
        message: 'Operation completed successfully',
        type: 'success',
      });
      // Refresh lists, navigate, etc.
      navigation.goBack();
    },
    
    // Handle errors
    onError: (error) => {
      const errorInfo = handleApiError(error);
      
      // Handle specific error types
      if (errorInfo.message.includes('transaction limit')) {
        // Show limit popup
        return;
      }
      
      if (errorInfo.isForbidden) {
        showAlert({
          title: 'Access Denied',
          message: errorInfo.message,
          type: 'error',
        });
        return;
      }
      
      // Generic error
      showAlert({
        title: 'Error',
        message: errorInfo.message,
        type: 'error',
      });
    },
  });

  const handleSubmit = async () => {
    // Build your payload
    const body = {
      // ... your data
    };

    // Call mutation with retry enabled
    await mutate(body, {
      retryOnTimeout: true,
      maxRetries: 2,
      logRequest: __DEV__, // Log in development only
    });
  };

  return (
    <TouchableOpacity 
      onPress={handleSubmit} 
      disabled={isLoading}
    >
      <Text>{isLoading ? 'Submitting...' : 'Submit'}</Text>
    </TouchableOpacity>
  );
};
```

## Migration Strategy

### Step 1: Create Migration Checklist
For each screen, document:
- Current POST call locations
- Loading state management
- Error handling approach
- Success handling

### Step 2: Refactor One Screen at a Time
1. Start with AddNewEntryScreen (most complex)
2. Test thoroughly
3. Move to next screen

### Step 3: Update Tests
Ensure existing tests still pass after refactoring

### Step 4: Monitor
- Check request logs for errors
- Monitor retry success rates
- Track user-reported issues

## Expected Benefits

1. **Reduced Code Duplication**
   - ~30-40% less code per screen
   - Consistent patterns across app

2. **Better Reliability**
   - Automatic retry on network issues
   - Duplicate prevention
   - Better error handling

3. **Improved Developer Experience**
   - Easier to add new POST calls
   - Less boilerplate
   - Better debugging with request logs

4. **Better User Experience**
   - More reliable submissions
   - Better error messages
   - Consistent loading states

## Additional Recommendations

### 1. Create Screen-Specific Mutation Hooks

For commonly used mutations, create custom hooks:

```typescript
// hooks/useTransactionMutations.ts
export function useCreateTransaction() {
  return usePostMutation('/transactions', {
    retryOnTimeout: true,
    maxRetries: 2,
    validatePayload: (body) => validatePayload(body, {
      required: ['amount', 'type', 'partyName', 'date'],
      numbers: ['amount'],
    }),
  });
}
```

### 2. Add Optimistic Updates

For better UX, update UI immediately before API confirms:

```typescript
const { mutate } = usePostMutation('/transactions', {
  onMutate: async (newTransaction) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries('transactions');
    
    // Snapshot previous value
    const previous = queryClient.getQueryData('transactions');
    
    // Optimistically update
    queryClient.setQueryData('transactions', (old: any) => [
      { ...newTransaction, id: 'temp-' + Date.now() },
      ...old,
    ]);
    
    return { previous };
  },
  onError: (err, newTransaction, context) => {
    // Rollback on error
    queryClient.setQueryData('transactions', context.previous);
  },
});
```

### 3. Batch Related POSTs

For screens that make multiple POSTs (like AddPartyScreen), consider:

```typescript
const createPartyWithVoucher = async (partyData, voucherData) => {
  // Use Promise.allSettled for parallel requests
  const [partyResult, voucherResult] = await Promise.allSettled([
    unifiedApi.post('/customers', partyData, { retryOnTimeout: true }),
    unifiedApi.post('/transactions', voucherData, { retryOnTimeout: true }),
  ]);
  
  // Handle results
  if (partyResult.status === 'rejected') {
    throw new Error('Failed to create party');
  }
  // ...
};
```

## Conclusion

Your app already has excellent infrastructure for POST API calls. The main improvement is **adopting the existing `useMutation` hook** across all screens and **enabling retry logic** for idempotent requests. This will:

- Reduce code by ~30-40%
- Improve reliability
- Provide better user experience
- Make codebase more maintainable

Start with the high-priority screens and gradually migrate others. The migration is **backward compatible** - existing code continues to work while you refactor.

