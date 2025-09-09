# Real Device Network Fix Guide

## Problem Description

Your React Native app was showing "Network request failed" on real devices while working fine on emulators. This happened because:

1. **Real devices can't access your computer's local IP address** (`192.168.57.107:5000`)
2. **Emulators can access localhost/computer IP** - they share the same network
3. **Missing network security configuration** for HTTP connections on real devices

## Fixes Applied

### 1. Updated Network Configuration (`src/config/network.ts`)

- Added real device detection
- Automatically switches to production backend on real devices
- Maintains local backend access for emulators

### 2. Updated API Configuration (`src/api/index.ts`)

- Dynamic BASE_URL selection based on device type
- Real devices use production backend
- Emulators use local backend

### 3. Added Network Security Configuration (`android/app/src/main/res/xml/network_security_config.xml`)

- Allows HTTP connections for development IPs
- Maintains security for production

### 4. Updated Android Manifest (`android/app/src/main/AndroidManifest.xml`)

- Added network security configuration reference
- Enabled cleartext traffic for development

### 5. Added Network Debug Utilities (`src/utils/networkDebug.ts`)

- Network status checking
- API connectivity testing
- Debug information logging

### 6. Enhanced App.tsx

- Automatic network debugging on app start
- Console logs for troubleshooting

## Testing Steps

### 1. Clean and Rebuild

```bash
cd UtilsApp
npx react-native clean
npx react-native run-android --device
```

### 2. Check Console Logs

Look for these logs when the app starts:

```
🚀 App starting - debugging network configuration...
🌐 Network Debug Info: {...}
🧪 Testing API connectivity to: https://utility-apis-49wa.onrender.com
✅ API connectivity test successful
```

### 3. Verify Network Configuration

The app should automatically:

- Detect real device vs emulator
- Use production backend on real devices
- Use local backend on emulators

## Expected Behavior

### On Real Device:

- ✅ Uses production backend (`https://utility-apis-49wa.onrender.com`)
- ✅ API calls work without "Network request failed"
- ✅ Console shows "📱 Real device detected, using production backend"

### On Emulator:

- ✅ Uses local backend (`http://192.168.57.107:5000`)
- ✅ Falls back to production if local is unavailable
- ✅ Console shows "✅ Local backend accessible"

## Troubleshooting

### If Still Getting Network Errors:

1. **Check Internet Connection**

   - Ensure device has internet access
   - Try opening browser and visiting `https://utility-apis-49wa.onrender.com`

2. **Check Console Logs**

   - Look for network debug information
   - Verify which backend URL is being used

3. **Test API Endpoint**

   - Use the debug utility: `testApiConnectivity()`
   - Check if production backend is responding

4. **Network Security Issues**
   - Ensure `network_security_config.xml` is in the right location
   - Check AndroidManifest.xml has the correct configuration

### Common Issues:

1. **Firewall/Corporate Network**

   - Some networks block certain ports or domains
   - Try on different WiFi network

2. **HTTPS Certificate Issues**

   - Production backend should have valid SSL certificate
   - Check if backend is accessible via browser

3. **DNS Resolution**
   - Device might not resolve the domain
   - Try using IP address instead of domain

## Additional Notes

- The app now automatically handles device detection
- No manual configuration needed for different devices
- Production backend is used as fallback for all scenarios
- Network debugging provides detailed information for troubleshooting

## Future Improvements

1. **Add Network Status Indicator** in UI
2. **Implement Retry Logic** for failed requests
3. **Add Offline Mode** support
4. **Implement Request Caching** for better performance
