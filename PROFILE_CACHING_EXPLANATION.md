# How Profile Data Shows When Network is Off

## Overview

Your app uses a **multi-layer caching system** to store profile data locally on your device. This allows your profile details to display even when you're offline.

---

## How It Works

### 1. **AsyncStorage (Local Device Storage)**

When your profile is successfully loaded from the API, it's saved to your device's local storage:

```typescript
// ProfileScreen.tsx - Line 232
await AsyncStorage.setItem('cachedUserData', JSON.stringify(normalized));
```

**Storage Key:** `'cachedUserData'`

**What Gets Stored:**

- Owner Name
- Business Name
- Mobile Number
- Plan Type
- All other profile fields

**Location:** This data is stored permanently on your device (until you clear app data or logout)

---

### 2. **Global In-Memory Cache**

The app also keeps profile data in memory for faster access:

```typescript
// ProfileScreen.tsx - Line 85-86
let globalUserCache: any = null;
let globalCacheChecked = false;
```

**Purpose:** Provides instant display without waiting for AsyncStorage read

---

### 3. **Loading Priority (Offline-First)**

When you open the app, here's the order it checks for profile data:

#### Step 1: Check Global Cache (Fastest)

```typescript
// ProfileScreen.tsx - Line 104
const [user, setUser] = useState<any>(globalUserCache);
```

- If available, shows immediately (no loading screen)

#### Step 2: Check AsyncStorage (If global cache is empty)

```typescript
// ProfileScreen.tsx - Line 152
const cachedUser = await AsyncStorage.getItem('cachedUserData');
if (cachedUser) {
  const userData = JSON.parse(cachedUser);
  setUser(userData); // Show cached data
  setLoading(false);
}
```

- Loads from device storage
- Shows profile immediately

#### Step 3: Try API (Only if no cache exists)

```typescript
// ProfileScreen.tsx - Line 194
const res = await unifiedApi.getUserProfile();
```

- Only attempts if no cached data found
- If network fails, cached data is still shown

---

## Where Profile Data is Cached

### 1. **ProfileScreen.tsx**

**Cache Storage:**

```typescript
// Line 232: Save to AsyncStorage
await AsyncStorage.setItem('cachedUserData', JSON.stringify(normalized));

// Line 229: Save to global cache
globalUserCache = normalized;
```

**Cache Loading:**

```typescript
// Line 152-160: Load from AsyncStorage
const cachedUser = await AsyncStorage.getItem('cachedUserData');
if (cachedUser) {
  const userData = JSON.parse(cachedUser);
  globalUserCache = userData;
  setUser(userData);
  setForm(userData);
  setLoading(false);
}
```

### 2. **CustomDrawerContent.tsx (Drawer Menu)**

The drawer also caches profile data for the header:

**Cache Loading:**

```typescript
// Line 386-422: loadCachedUserData()
AsyncStorage.multiGet([
  'cachedUserData',
  'userName',
  'userMobile',
  'userMobileNumber',
]).then(results => {
  // Parse and display cached data
  const cached = JSON.parse(cachedUserResult[1]);
  setUserName(cached?.ownerName);
  setUserMobile(cached?.mobileNumber);
});
```

**Additional Storage Keys:**

- `'userName'` - Stores name separately
- `'userMobile'` - Stores mobile separately
- `'userMobileNumber'` - Alternative mobile key

### 3. **CustomerScreen.tsx**

Also caches user data for the header:

```typescript
// Line 1954: Save to AsyncStorage
await AsyncStorage.setItem('cachedUserData', JSON.stringify(user));
```

---

## Offline Behavior

### When Network is OFF:

1. ✅ **ProfileScreen** loads cached data from AsyncStorage
2. ✅ **Drawer Menu** shows cached name and mobile
3. ✅ **CustomerScreen** shows cached business name
4. ✅ No loading spinner (data shows instantly)
5. ⚠️ API call fails silently (doesn't show error if cache exists)

### When Network is ON:

1. ✅ Shows cached data immediately
2. ✅ Fetches fresh data in background
3. ✅ Updates cache with latest data
4. ✅ Updates UI if data changed

---

## Cache Update Strategy

### Automatic Updates:

1. **On Profile Edit:**

   ```typescript
   // ProfileScreen.tsx - Line 508
   await AsyncStorage.setItem('cachedUserData', JSON.stringify(updatedUser));
   ```

2. **On Profile Fetch:**

   ```typescript
   // ProfileScreen.tsx - Line 232
   await AsyncStorage.setItem('cachedUserData', JSON.stringify(normalized));
   ```

3. **Via Event Emitter:**
   ```typescript
   // CustomDrawerContent.tsx - Line 323-375
   DeviceEventEmitter.addListener('profile-updated', payload => {
     // Updates cache when profile is edited
     AsyncStorage.setItem('cachedUserData', JSON.stringify(cached));
   });
   ```

### Cache Clearing:

**On Logout:**

```typescript
// ProfileScreen.tsx - Line 89-92
export const clearProfileCache = () => {
  globalUserCache = null;
  globalCacheChecked = false;
};

// AuthContext.tsx - Line 264
clearProfileCache(); // Called on logout
```

---

## Code Flow Diagram

```
App Opens
    │
    ├─→ Check globalUserCache
    │   │
    │   ├─→ Found? → Show immediately ✅
    │   │
    │   └─→ Not Found? → Check AsyncStorage
    │       │
    │       ├─→ Found? → Show + Update global cache ✅
    │       │
    │       └─→ Not Found? → Try API
    │           │
    │           ├─→ Success? → Save to cache + Show ✅
    │           │
    │           └─→ Failed? → Show error (if no cache) ❌
    │                        → Show cache (if exists) ✅
```

---

## Benefits of This Approach

✅ **Fast Loading:** Cached data shows instantly  
✅ **Offline Support:** Works without internet  
✅ **Better UX:** No loading spinners when data exists  
✅ **Reduced API Calls:** Saves bandwidth  
✅ **Persistent:** Data survives app restarts

---

## Potential Issues

⚠️ **Stale Data:** If you update profile on another device, this device won't know  
⚠️ **Cache Size:** Large profiles might use storage space  
⚠️ **No Expiry:** Cache doesn't expire automatically (only cleared on logout)

---

## How to Clear Cache (For Testing)

### Method 1: Logout

```typescript
// Automatically clears profile cache
logout();
```

### Method 2: Manual Clear

```typescript
import { clearProfileCache } from './src/screens/HomeScreen/ProfileScreen';

clearProfileCache();
await AsyncStorage.removeItem('cachedUserData');
```

### Method 3: Clear All App Data

- Android: Settings → Apps → Your App → Storage → Clear Data
- iOS: Delete and reinstall app

---

## Summary

Your profile shows offline because:

1. **AsyncStorage** stores profile data permanently on device
2. **Global cache** provides instant access
3. **Offline-first** loading strategy checks cache before API
4. **Multiple screens** cache data independently for redundancy

This is a **good practice** for mobile apps - it provides better user experience and works offline!

---

**Last Updated:** January 2025
