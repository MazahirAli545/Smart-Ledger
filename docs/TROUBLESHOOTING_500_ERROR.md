# Troubleshooting 500 Internal Server Error

## Overview

The 500 Internal Server Error is a server-side error that indicates something went wrong on the server when processing your request. This guide will help you diagnose and resolve this issue.

## Error Details

**Error Type**: `AxiosError: Request failed with status code 500`
**Location**: `AddPartyScreen.tsx` - Party deletion operation
**Impact**: Users cannot delete parties, potentially causing data inconsistency

## Immediate Actions

### 1. Check Console Logs

Look for detailed error information in the console:

```typescript
console.log('🔗 Delete URL:', deleteUrl);
console.log('🔑 Headers:', {
  Authorization: `Bearer ${accessToken.substring(0, 20)}...`,
});
console.log('🆔 Party ID:', customerData.id);
console.log('📝 Party Name:', partyName);
```

### 2. Verify API Endpoint

Ensure the delete endpoint is correct:

```
DELETE /customer/{partyId}
```

### 3. Check Authentication

Verify the access token is valid and not expired.

## Root Cause Analysis

### Common Causes of 500 Errors

#### 1. **Database Constraints**

- Foreign key violations
- Unique constraint conflicts
- Referential integrity issues

#### 2. **Server Configuration**

- Database connection issues
- Memory/CPU exhaustion
- Service dependencies down

#### 3. **Data Validation**

- Invalid party ID format
- Malformed request payload
- Missing required fields

#### 4. **Business Logic Errors**

- Circular dependencies
- Invalid state transitions
- Business rule violations

## Debugging Steps

### Step 1: Enable Verbose Logging

Update the debug configuration in `AddPartyScreen.tsx`:

```typescript
// At the top of the file
import { apiDebugger } from '../../utils/apiDebugger';

// Enable verbose logging
apiDebugger.updateConfig({
  logLevel: 'verbose',
  enableRequestLogging: true,
  enableResponseLogging: true,
  enableErrorLogging: true,
});
```

### Step 2: Check Request Details

The enhanced error handling now logs:

- Exact URL being called
- Request headers (token preview)
- Party ID and name
- Request payload
- Response status and data

### Step 3: Verify Party Data

Check if the party data is valid:

```typescript
console.log('🔍 Party Data Validation:', {
  id: customerData.id,
  name: customerData.name,
  partyType: customerData.partyType,
  hasValidId: customerData.id && customerData.id.toString().length > 0,
  hasValidName: customerData.name && customerData.name.trim().length > 0,
});
```

### Step 4: Test API Endpoint Manually

Use a tool like Postman or curl to test the endpoint:

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://your-api.com/customer/PARTY_ID"
```

## Server-Side Investigation

### 1. **Check Server Logs**

Look for error messages in:

- Application logs
- Database logs
- System logs
- Error monitoring tools (Sentry, LogRocket, etc.)

### 2. **Database Health Check**

Verify:

- Database connectivity
- Table structure
- Indexes and constraints
- Query performance

### 3. **API Dependencies**

Check if the delete operation depends on:

- External services
- File systems
- Message queues
- Cache systems

## Client-Side Solutions

### 1. **Enhanced Error Handling**

The updated code now includes:

- Retry mechanism with exponential backoff
- Detailed error categorization
- User-friendly error messages
- Retry options for temporary failures

### 2. **Request Validation**

Before making the delete request:

```typescript
// Validate party ID
if (!customerData.id || typeof customerData.id !== 'string') {
  throw new Error('Invalid party ID');
}

// Validate party name
if (!customerData.name || customerData.name.trim().length === 0) {
  throw new Error('Invalid party name');
}
```

### 3. **Fallback Strategies**

Implement graceful degradation:

```typescript
try {
  await deletePartyWithRetry(accessToken);
} catch (error) {
  if (error.response?.status === 500) {
    // Show user-friendly message
    Alert.alert(
      'Temporary Issue',
      "We're experiencing technical difficulties. Please try again in a few minutes.",
      [{ text: 'OK' }, { text: 'Retry', onPress: () => handleDeleteParty() }],
    );
  }
}
```

## Prevention Strategies

### 1. **Input Validation**

Validate all inputs before sending to the server:

```typescript
const validatePartyForDeletion = (party: any) => {
  const errors = [];

  if (!party.id) errors.push('Party ID is required');
  if (!party.name) errors.push('Party name is required');
  if (!party.partyType) errors.push('Party type is required');

  return errors;
};
```

### 2. **Pre-flight Checks**

Check if deletion is possible before attempting:

```typescript
const canDeleteParty = async (partyId: string) => {
  try {
    // Check for active transactions
    const response = await axios.get(`${BASE_URL}/customer/${partyId}/status`);
    return response.data.canDelete;
  } catch (error) {
    console.error('Pre-flight check failed:', error);
    return false;
  }
};
```

### 3. **Rate Limiting**

Implement client-side rate limiting:

```typescript
class RateLimiter {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest),
      );
    }

    this.lastRequest = Date.now();
  }
}
```

## Monitoring and Alerting

### 1. **Error Tracking**

Track 500 errors for analysis:

```typescript
const trackError = (error: any, context: string) => {
  // Send to error tracking service
  console.error(`🚨 ${context} Error:`, {
    timestamp: new Date().toISOString(),
    error: error.message,
    status: error.response?.status,
    url: error.config?.url,
    partyId: customerData.id,
    userId: await getUserIdFromToken(),
  });
};
```

### 2. **Performance Monitoring**

Monitor API response times:

```typescript
const measureApiCall = async (apiCall: () => Promise<any>) => {
  const start = Date.now();
  try {
    const result = await apiCall();
    const duration = Date.now() - start;
    console.log(`⏱️ API call completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`⏱️ API call failed after ${duration}ms:`, error);
    throw error;
  }
};
```

## Testing and Validation

### 1. **Unit Tests**

Test error handling scenarios:

```typescript
describe('Party Deletion Error Handling', () => {
  it('should handle 500 server errors gracefully', async () => {
    // Mock 500 response
    axios.delete.mockRejectedValue({
      response: { status: 500, data: { message: 'Internal Server Error' } },
    });

    // Test error handling
    const result = await handleDeleteParty();
    expect(result).toBeDefined();
  });
});
```

### 2. **Integration Tests**

Test with real API endpoints:

```typescript
describe('Party Deletion Integration', () => {
  it('should delete party successfully', async () => {
    // Create test party
    const testParty = await createTestParty();

    // Delete test party
    const result = await deleteParty(testParty.id);

    // Verify deletion
    expect(result.status).toBe(200);
  });
});
```

## Contact Information

If the issue persists after following these steps:

1. **Check Server Status**: Verify if the server is experiencing issues
2. **Review Recent Changes**: Check if recent deployments introduced the issue
3. **Contact DevOps**: Reach out to the infrastructure team
4. **Escalate to Backend Team**: The 500 error indicates a server-side issue

## Quick Fix Commands

### Enable Debug Mode

```typescript
// In your component
useEffect(() => {
  apiDebugger.updateConfig({ logLevel: 'verbose' });
  apiDebugger.setEnabled(true);
}, []);
```

### Show Debug Summary

```typescript
// In console or debug panel
showApiDebugSummary();
```

### Export Debug Log

```typescript
// Copy to clipboard or save to file
const debugLog = exportApiDebugLog();
console.log(debugLog);
```

## Summary

The 500 Internal Server Error during party deletion is a server-side issue that requires:

1. **Immediate**: Enable verbose logging and check console output
2. **Short-term**: Implement retry mechanisms and better error handling
3. **Long-term**: Monitor server health and implement preventive measures

The enhanced error handling in the updated code will provide better debugging information and user experience while the underlying server issue is resolved.
