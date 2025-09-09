# Session Management System

## Overview

This system automatically handles user session validation and redirects users to the SignInScreen when their session expires or becomes invalid.

## How It Works

### 1. Automatic Session Monitoring

- **Background Check**: Session validity is checked every 5 minutes
- **Token Validation**: Automatically detects expired or invalid tokens
- **Force Logout**: When session is invalid, user is automatically logged out and redirected to SignInScreen

### 2. API Call Protection

- **Pre-flight Check**: Session is validated before every API call
- **Auto-handling**: 401/403 responses automatically trigger logout
- **Seamless UX**: Users are redirected without manual intervention

## Usage

### In Your Components

#### Option 1: Use the API Wrapper (Recommended)

```typescript
import { authenticatedApiCall } from '../utils/apiWrapper';

// This automatically handles session validation and auth headers
const response = await authenticatedApiCall(`${BASE_URL}/vouchers`);
const data = await response.json();
```

#### Option 2: Manual Session Check

```typescript
import { sessionManager } from '../utils/sessionManager';

// Check session before making API calls
const isSessionValid = await sessionManager.validateSession();
if (!isSessionValid) {
  // User will be automatically redirected to SignInScreen
  return;
}

// Proceed with API call
const response = await fetch(url, options);
```

### Session Manager Methods

```typescript
import { sessionManager } from '../utils/sessionManager';

// Start monitoring (called automatically on login)
sessionManager.startSessionMonitoring();

// Stop monitoring (called automatically on logout)
sessionManager.stopSessionMonitoring();

// Manual session validation
const isValid = await sessionManager.validateSession();

// Force logout (redirects to SignInScreen)
await sessionManager.forceLogout();

// Check if token is expired
const isExpired = sessionManager.isTokenExpired(token);

// Get current token
const token = await sessionManager.getToken();
```

## Automatic Behaviors

### ✅ What Happens Automatically

1. **Session Monitoring**: Every 5 minutes in background
2. **Token Expiration**: JWT expiration is checked
3. **API Error Handling**: 401/403 responses trigger logout
4. **Navigation**: Automatic redirect to SignInScreen
5. **Data Cleanup**: All stored data is cleared on logout

### 🔄 User Experience Flow

1. User is using the app normally
2. Session expires or becomes invalid
3. System automatically detects the issue
4. User is logged out and redirected to SignInScreen
5. User can log in again with fresh credentials

## Configuration

### Session Check Interval

Default: 5 minutes (300,000 ms)

```typescript
// In sessionManager.ts, change this value:
setInterval(async () => {
  await this.validateSession();
}, 5 * 60 * 1000); // 5 minutes
```

### Token Validation

You can enhance token validation by:

- Adding backend API calls to validate tokens
- Implementing refresh token logic
- Adding additional security checks

## Security Features

1. **Automatic Cleanup**: All data is cleared on session expiration
2. **Navigation Reset**: Prevents back navigation to authenticated screens
3. **Background Monitoring**: Continuous session validation
4. **Error Handling**: Graceful handling of network errors

## Troubleshooting

### Common Issues

1. **Session not expiring**: Check if session monitoring is started
2. **Navigation not working**: Ensure navigationRef is properly set up
3. **API calls failing**: Verify token format and expiration

### Debug Logs

The system provides detailed console logs:

- `🔍 Session validation: Token still valid`
- `🚨 Session validation: No token found, forcing logout`
- `🚨 Force logout triggered - Session expired or invalid`

## Integration Points

### Existing Code

- **AuthContext**: Automatically starts session monitoring on login
- **Navigation**: Handles redirects when session expires
- **API Calls**: Can be wrapped with authenticatedApiCall for automatic protection

### New Features

- **Background Monitoring**: Continuous session validation
- **Automatic Logout**: No manual intervention required
- **Seamless UX**: Users are redirected automatically
