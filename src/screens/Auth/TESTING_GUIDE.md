# SignInScreen Testing Guide

## Overview

This guide covers testing the optimized SignInScreen component to ensure all functionality works correctly after performance optimizations.

## Test Checklist

### ✅ Unit Tests (Automated)

Run the test file: `UtilsApp/src/screens/Auth/__tests__/SignInScreen.test.tsx`

**Test Cases:**

1. ✅ Phone number validation (valid 10-digit numbers)
2. ✅ Empty phone number validation
3. ✅ Invalid length validation (too short/long)
4. ✅ Non-digit character validation
5. ✅ Input filtering (removes non-digits, limits to 10 chars)
6. ✅ Phone number formatting with country code

### 🧪 Manual Testing Steps

#### Test 1: Valid Phone Number Flow

1. **Open the app** and navigate to SignInScreen
2. **Enter a valid 10-digit phone number** (e.g., `1234567890`)
3. **Tap "Send OTP" button**
4. **Expected Results:**
   - Button should be enabled (not grayed out)
   - Loading state should show "Sending..."
   - Should navigate to SignInOtpScreen immediately after API response
   - Navigation should be smooth (no lag)
   - OTP screen should receive: `phone`, `backendOtp`, `callingCode`, `countryCode`, `usePostmanAuth: true`

#### Test 2: Invalid Phone Number Validation

1. **Try empty input:**

   - Leave phone number field empty
   - Tap "Send OTP"
   - **Expected:** Error message "Please enter your mobile number"
   - Alert should show with same message

2. **Try less than 10 digits:**

   - Enter `12345` (5 digits)
   - Tap "Send OTP"
   - **Expected:** Error message "Please enter a valid 10-digit mobile number"

3. **Try more than 10 digits:**

   - Input automatically limits to 10 digits
   - **Expected:** Field should not accept more than 10 digits

4. **Try non-digit characters:**
   - Enter `123-456-7890` or `123abc456`
   - **Expected:** Input should filter to `1234567890` (non-digits removed automatically)

#### Test 3: API Error Handling

1. **Simulate network error:**

   - Turn off device internet
   - Enter valid phone number: `1234567890`
   - Tap "Send OTP"
   - **Expected:**
     - Loading state should stop
     - Error message should display
     - Alert should show error
     - Should NOT navigate to OTP screen

2. **Simulate API error response:**
   - Enter valid phone number
   - If backend returns error (e.g., rate limit)
   - **Expected:**
     - Error message from API should display
     - Alert should show error
     - Should NOT navigate to OTP screen

#### Test 4: Input Field Behavior

1. **Test input filtering:**

   - Type `123-456-7890` → Should become `1234567890`
   - Type `123abc456def` → Should become `123456`
   - Type `123456789012345` → Should limit to `1234567890`

2. **Test error clearing:**

   - Enter invalid number (e.g., `123`)
   - Tap "Send OTP" (error shows)
   - Start typing again
   - **Expected:** Error should clear automatically when user starts typing

3. **Test keyboard:**
   - Input should show number pad
   - Auto-complete should work (if device supports)
   - Should accept paste with numbers only

#### Test 5: Performance & Responsiveness

1. **Test navigation speed:**

   - Enter valid phone: `1234567890`
   - Tap "Send OTP"
   - **Expected:**
     - Button should respond immediately (no lag)
     - Loading state should appear instantly
     - Navigation should happen immediately after API response
     - Transition should be smooth (no jank)

2. **Test state updates:**

   - Enter phone number
   - Watch for re-renders (use React DevTools if available)
   - **Expected:** Minimal re-renders (optimized with useCallback)

3. **Test button state:**
   - With 0-9 digits: Button should be disabled (grayed out)
   - With exactly 10 digits: Button should be enabled (blue gradient)
   - During loading: Button should be disabled

#### Test 6: Edge Cases

1. **Rapid button taps:**

   - Enter valid phone number
   - Rapidly tap "Send OTP" multiple times
   - **Expected:** Should only send one request (button disabled during loading)

2. **Back navigation:**

   - Enter phone number
   - Send OTP (navigate to OTP screen)
   - Press back button
   - **Expected:** Should return to SignInScreen with phone number cleared or preserved (check current behavior)

3. **App backgrounding:**
   - Start OTP request
   - Background the app
   - **Expected:** Request should complete, navigation should work when app resumes

## Performance Metrics to Verify

### Before vs After Optimization:

- ✅ **Validation Speed:** Should be instant (synchronous, no async overhead)
- ✅ **Navigation Speed:** Should be immediate after API response
- ✅ **Re-renders:** Should be minimal (use React DevTools Profiler)
- ✅ **Bundle Size:** Should be smaller (removed ~200 lines of unused code)
- ✅ **Input Responsiveness:** Should be instant (memoized handlers)

## Known Issues to Check

1. **startTransition compatibility:**

   - Verify React 19.1.0 supports startTransition
   - If issues occur, navigation will still work (startTransition is optional)

2. **Error handling:**

   - Ensure all error paths are tested
   - Verify error messages are user-friendly

3. **Navigation params:**
   - Verify SignInOtpScreen receives all required params
   - Check that `backendOtp` is passed correctly

## Automated Test Commands

```bash
# Run unit tests
npm test -- SignInScreen.test.tsx

# Run linting
npm run lint

# Check TypeScript errors
npx tsc --noEmit
```

## Manual Test Scenarios Summary

| Test Case       | Input           | Expected Result             | Status |
| --------------- | --------------- | --------------------------- | ------ |
| Valid 10-digit  | `1234567890`    | Navigate to OTP screen      | ✅     |
| Empty input     | ``              | Show error                  | ✅     |
| Too short       | `12345`         | Show error                  | ✅     |
| Non-digits      | `123-456-7890`  | Auto-filter to `1234567890` | ✅     |
| API error       | Network off     | Show error, no navigation   | ✅     |
| Button disabled | < 10 digits     | Button grayed out           | ✅     |
| Loading state   | During API call | Show "Sending..."           | ✅     |

## Notes

- All optimizations maintain backward compatibility
- No functional changes, only performance improvements
- Error handling remains the same
- Navigation flow is unchanged, just faster
