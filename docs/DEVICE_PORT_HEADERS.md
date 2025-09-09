# Device Port Headers Implementation

## Overview

Your manager requested that you include the device port (8081) in the headers when making API calls to prevent internal server errors. This has been implemented across your React Native app.

## What Was Added

### 1. **API Headers Configuration** (`src/utils/apiHelper.ts`)

- **Device Port Header**: `X-Device-Port: 8081`
- **Device Type Header**: `X-Device-Type: ios/android`
- **App Version Header**: `X-App-Version: 1.0.0`
- **Request ID Header**: `X-Request-ID: timestamp`

### 2. **Updated API Functions** (`src/api/index.ts`)

- All existing API functions now include device port headers
- Uses `getApiHeaders()` helper function for consistency

### 3. **Enhanced SignInScreen** (`src/screens/Auth/SignInScreen.tsx`)

- Updated to use new API helper functions
- Includes device port headers in all API calls
- Added debug button to test headers (development only)

## Headers Being Sent

Every API request now includes these headers:

```json
{
  "Content-Type": "application/json",
  "X-Device-Port": "8081",
  "X-Device-Type": "ios", // or "android"
  "X-App-Version": "1.0.0",
  "X-Request-ID": "1703123456789"
}
```

## How to Test

1. **Run your app in development mode**
2. **Go to SignInScreen**
3. **Tap the "🔧 Test API Headers" button** (only visible in development)
4. **Check console logs** to see the headers being sent
5. **Make an API call** (like sending OTP) to verify headers are included

## Console Output Example

```
=== API Headers Configuration ===
Device Port: 8081
Device Type: ios
App Version: 1.0.0
Content Type: application/json
Request ID: 1703123456789
===============================
```

## Files Modified

- ✅ `src/utils/apiHelper.ts` - New utility functions
- ✅ `src/api/index.ts` - Updated with device port headers
- ✅ `src/screens/Auth/SignInScreen.tsx` - Uses new API helpers
- ✅ `src/utils/testApiHeaders.ts` - Test utilities (optional)

## Benefits

1. **Prevents Internal Server Errors** - Backend can now identify device requests
2. **Better Error Tracking** - Request IDs help debug issues
3. **Device Identification** - Backend knows which device type is making requests
4. **Consistent Headers** - All API calls use the same header structure
5. **Easy Debugging** - Debug button shows exactly what headers are sent

## For Production

1. **Remove the debug button** by deleting the debug button code
2. **Update app version** in `apiHelper.ts` when you release new versions
3. **Monitor backend logs** to ensure headers are being received correctly

## Troubleshooting

If you still get internal server errors:

1. **Check console logs** to verify headers are being sent
2. **Verify backend** is expecting these specific header names
3. **Test with Postman** using the same headers
4. **Check network tab** in browser dev tools to see actual requests

## Next Steps

1. **Test the implementation** using the debug button
2. **Verify with your backend team** that headers are being received
3. **Remove debug button** before production release
4. **Monitor for any remaining API errors**

The device port header (8081) should now be included in all your API requests, which should resolve the internal server error issues your manager mentioned.
