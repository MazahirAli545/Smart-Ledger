# POST API Improvements Guide

This document explains the enhanced POST API calling features added to `unifiedApiService` while maintaining **100% backward compatibility** with existing code.

## 🎯 Key Improvements

1. **Automatic Idempotency Keys** - Prevents duplicate operations from network retries or double-clicks
2. **Payload Validation** - Catch errors before sending to backend
3. **Safe Mutation Hook** - React hook for safer POST/PUT/PATCH/DELETE operations
4. **Enhanced Logging** - Better debugging and monitoring
5. **Optional Retry for Idempotent Requests** - Safe retries for idempotent POSTs

## 📚 Usage Examples

### Basic POST (Idempotency Auto-Enabled)

```typescript
// Existing code continues to work exactly as before
const result = await unifiedApi.post('/transactions', {
  amount: 100,
  type: 'debit',
  partyName: 'Supplier ABC',
});
```

### POST with Custom Idempotency Key

```typescript
const result = await unifiedApi.post(
  '/transactions',
  {
    amount: 100,
    type: 'debit',
  },
  {
    idempotencyKey: 'my-custom-key-123',
  },
);
```

### POST with Retry on Timeout (Idempotent Requests Only)

```typescript
// Safe to retry because idempotency key prevents duplicates
const result = await unifiedApi.post(
  '/transactions',
  {
    amount: 100,
    type: 'debit',
  },
  {
    retryOnTimeout: true,
    maxRetries: 2, // Retry up to 2 times on timeout/5xx errors
  },
);
```

### POST without Idempotency (Non-Idempotent Endpoints)

```typescript
// OTP endpoints shouldn't be idempotent
const result = await unifiedApi.post(
  '/auth/send-otp',
  {
    phone: '1234567890',
  },
  {
    useIdempotency: false,
  },
);
```

### POST with Request Logging

```typescript
const result = await unifiedApi.post(
  '/transactions',
  {
    amount: 100,
  },
  {
    logRequest: true, // Logs request details for debugging
  },
);
```

## 🔧 Using the useMutation Hook

The `useMutation` hook provides safer mutation handling with built-in loading states and duplicate prevention.

### Basic Usage

```typescript
import { usePostMutation } from '../hooks/useMutation';

function PaymentScreen() {
  const { mutate, isLoading, error } = usePostMutation('/transactions', {
    onSuccess: data => {
      console.log('Payment created:', data);
      // Refresh list, show success message, etc.
    },
    onError: error => {
      console.error('Payment failed:', error);
      // Show error message to user
    },
  });

  const handleSubmit = async () => {
    // Automatically prevents duplicate calls
    await mutate({
      amount: 100,
      type: 'debit',
      partyName: 'Supplier ABC',
    });
  };

  return (
    <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
      <Text>{isLoading ? 'Creating...' : 'Create Payment'}</Text>
    </TouchableOpacity>
  );
}
```

### With Payload Validation

```typescript
import { usePostMutation } from '../hooks/useMutation';
import { validatePayload } from '../utils/payloadValidator';

function PaymentScreen() {
  const { mutate, isLoading, error } = usePostMutation('/transactions', {
    validatePayload: payload =>
      validatePayload(payload, {
        required: ['amount', 'type', 'partyName'],
        numbers: ['amount'],
      }),
    onSuccess: data => {
      console.log('Success:', data);
    },
  });

  // Validation runs before API call
  // If validation fails, onError is called with validation error
}
```

## 🛡️ Preventing Duplicate Submissions

### Option 1: Using useMutation Hook (Recommended)

```typescript
const { mutate, isLoading } = usePostMutation('/transactions');

// Automatically prevents duplicate calls
<TouchableOpacity onPress={() => mutate(data)} disabled={isLoading}>
  <Text>Submit</Text>
</TouchableOpacity>;
```

### Option 2: Manual Guard in Component

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  if (loading) return; // Prevent duplicate calls

  setLoading(true);
  try {
    await unifiedApi.post('/transactions', data);
  } finally {
    setLoading(false);
  }
};
```

## 📊 Request Logging

Access recent request logs for debugging:

```typescript
// Get last 20 requests
const logs = unifiedApi.getRequestLogs(20);
console.log('Recent requests:', logs);

// Clear logs
unifiedApi.clearRequestLogs();
```

## 🔍 Idempotency Key Generation

Idempotency keys are automatically generated for POST/PUT/PATCH requests (except for non-idempotent endpoints like OTP).

- **Deterministic keys**: Same payload + endpoint + userId = same key
- **Unique keys**: Each request attempt gets a unique key if needed

The system automatically:

- Generates keys for POST/PUT/PATCH
- Skips idempotency for OTP/auth endpoints
- Includes keys in `Idempotency-Key` header

## ⚠️ Important Notes

1. **Backward Compatibility**: All existing code continues to work without changes
2. **Idempotency is Opt-In**: Enabled by default, but can be disabled per request
3. **Retry Safety**: Only idempotent requests can safely retry (when `retryOnTimeout: true`)
4. **Non-Idempotent Endpoints**: OTP/auth endpoints automatically skip idempotency

## 🚀 Migration Guide

### No Migration Required!

All existing code works as-is. The improvements are additive:

- ✅ Existing `unifiedApi.post()` calls work unchanged
- ✅ Idempotency keys are added automatically (safe)
- ✅ No breaking changes to existing functionality

### Optional: Enhance Existing Code

You can optionally enhance existing code for better safety:

```typescript
// Before (still works)
await unifiedApi.post('/transactions', data);

// After (enhanced with retry)
await unifiedApi.post('/transactions', data, {
  retryOnTimeout: true,
  maxRetries: 2,
});
```

## 📝 Best Practices

1. **Use useMutation hook** for new code - provides built-in safety
2. **Enable retry for idempotent endpoints** - safer network handling
3. **Disable idempotency for OTP/auth** - already handled automatically
4. **Add payload validation** - catch errors early
5. **Use request logging** - helpful for debugging production issues

## 🔗 Related Files

- `src/api/unifiedApiService.ts` - Enhanced API service
- `src/hooks/useMutation.ts` - Safe mutation hook
- `src/utils/idempotency.ts` - Idempotency utilities
- `src/utils/payloadValidator.ts` - Payload validation utilities
