# Session Logout Testing Guide

## 🧪 How to Test Session Logout Functionality

### **Method 1: Using Development Test Buttons**

1. **Start the app in development mode**

   ```bash
   cd UtilsApp
   npm run android
   ```

2. **Navigate to SignInScreen**

   - The SignInScreen will show two test buttons (only visible in development mode)

3. **Test Session Logout Popup**

   - Click "Test Session Logout Popup" button
   - This will immediately show the session logout popup
   - Click "Login Again" to dismiss the popup

4. **Run Comprehensive Tests**
   - Click "Run All Tests" button
   - This will run all session logout tests and show results in an alert
   - Check console for detailed test results

### **Method 2: Manual Session Expiration Testing**

1. **Login to the app**

   - Use any valid credentials to login

2. **Wait for session expiration**

   - The app checks session validity every 5 minutes
   - Or manually expire the token by clearing AsyncStorage

3. **Trigger API call with expired token**
   - Navigate to any screen that makes API calls
   - The session manager will detect the expired token
   - Session logout popup will appear automatically

### **Method 3: Programmatic Testing**

1. **Import test utilities**

   ```typescript
   import { runAllSessionLogoutTests } from '../utils/sessionLogoutTest';
   ```

2. **Run tests programmatically**
   ```typescript
   const results = await runAllSessionLogoutTests();
   console.log('Test Results:', results);
   ```

## 🔍 What Each Test Validates

### **1. Session Logout Popup Test**

- ✅ Popup appears when triggered
- ✅ Popup has correct title and message
- ✅ Popup dismisses when "Login Again" is clicked
- ✅ Navigation to SignInScreen works

### **2. Token Expiration Test**

- ✅ JWT token expiration detection works
- ✅ Expired tokens are properly identified
- ✅ Token format validation works

### **3. Session Status Test**

- ✅ Session status check returns correct information
- ✅ Token presence detection works
- ✅ Expiration time parsing works

### **4. Manual Logout Test**

- ✅ AsyncStorage is properly cleared
- ✅ Session monitoring stops
- ✅ Navigation state is cleared

## 📊 Expected Test Results

When all tests pass, you should see:

```
🚀 Running all session logout tests...
✅ Session manager instance created
✅ Session logout callback triggered successfully
🧪 Simulating session expiration...
✅ Expired token detection: true
✅ Session status: { hasToken: false, isExpired: false, isValid: false }
✅ Manual logout test: PASSED
📊 Test Results: { callbackTest: true, tokenExpirationTest: true, sessionStatusTest: true, manualLogoutTest: true }
✅ All tests passed!
```

## 🐛 Troubleshooting

### **If tests fail:**

1. **Check console logs** for detailed error messages
2. **Verify imports** are correct in test files
3. **Check AsyncStorage** permissions
4. **Verify navigation** is properly set up

### **Common Issues:**

1. **"useAuth already declared"** - Remove duplicate imports
2. **"Session manager not found"** - Check import paths
3. **"Navigation not ready"** - Wait for navigation to initialize

## 🚀 Production Deployment

**Before deploying to production:**

1. **Remove test buttons** from SignInScreen
2. **Remove test utilities** from production build
3. **Verify session monitoring** is working
4. **Test with real expired tokens**

## 📱 User Experience Flow

1. **User is working in app**
2. **Session expires** (token becomes invalid)
3. **Popup appears** with "Session Expired" message
4. **User clicks "Login Again"**
5. **App navigates to SignInScreen**
6. **User can login again**

## 🔧 Configuration

### **Session Monitoring Interval**

- Default: 5 minutes
- Configurable in `sessionManager.ts`

### **Token Expiration Buffer**

- Default: 5 minutes
- Prevents edge cases with near-expired tokens

### **Popup Styling**

- Customizable in `SessionLogoutPopup.tsx`
- Supports custom titles and messages

## ✅ Success Criteria

The session logout functionality is working correctly when:

- [ ] Popup appears automatically when session expires
- [ ] Popup has correct styling and messaging
- [ ] User can dismiss popup and navigate to SignInScreen
- [ ] All data is properly cleared on logout
- [ ] Session monitoring works in background
- [ ] Tests pass consistently
- [ ] No memory leaks or performance issues

## 🎯 Next Steps

After successful testing:

1. **Deploy to staging** environment
2. **Test with real users** and expired sessions
3. **Monitor performance** and user feedback
4. **Deploy to production** when ready
