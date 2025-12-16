# How Customer & Supplier Data Shows When Network is Off

## Overview

Your app uses a **sophisticated multi-layer caching system** to store customer and supplier data locally on your device. This allows the customer/supplier list to display even when you're offline.

---

## How It Works

### 1. **Persistent Cache (AsyncStorage)**

Customer and supplier data is saved to your device's local storage using a persistent cache utility:

```typescript
// CustomerScreen.tsx - Line 1281-1283
saveToPersistentCache('customers', customersResult);
saveToPersistentCache('vouchers', vouchersResponse);
saveToPersistentCache('userData', userDataResult);
```

**Storage Keys:**

- `@customer_cache_customers` - All customers and suppliers
- `@customer_cache_vouchers` - Transaction/voucher data
- `@customer_cache_userData` - User profile data

**What Gets Stored:**

- Customer names, IDs, phone numbers
- Supplier names, IDs, phone numbers
- Transaction amounts and balances
- Location, GST numbers, addresses
- Last interaction dates
- All customer/supplier metadata

**Location:** This data is stored permanently on your device (until cache expires or is cleared)

**Cache Expiry:** 24 hours (default) - can be configured

---

### 2. **Global In-Memory Cache**

The app also keeps customer/supplier data in memory for faster access:

```typescript
// CustomerScreen.tsx - Line 70-80
let globalCustomerCache: any = {
  customers: [],
  vouchers: [],
  userData: null,
  lastUpdated: 0,
  activeTab: null,
  isRefreshing: false,
  isInitializing: false,
  isComponentInitialized: false,
  lastNavigationTime: 0,
};
```

**Purpose:** Provides instant display without waiting for AsyncStorage read

**Cache TTL:** 5 minutes (300,000 ms) - data is considered fresh for 5 minutes

---

### 3. **Loading Priority (Offline-First)**

When you open the Customer/Supplier screen, here's the order it checks for data:

#### Step 1: Check Global Cache (Fastest)

```typescript
// CustomerScreen.tsx - Line 1175-1181
if (isCacheValid(activeTab)) {
  setCustomers(globalCustomerCache.customers);
  setAllVouchers(globalCustomerCache.vouchers);
  setUserData(globalCustomerCache.userData);
  // Show immediately
}
```

- If available and valid (within 5 minutes), shows immediately
- No loading spinner

#### Step 2: Check Persistent Cache (If global cache is empty or expired)

```typescript
// CustomerScreen.tsx - Line 1057-1085
const cachedCustomers = await loadFromPersistentCache<Customer[]>('customers');
const cachedVouchers = await loadFromPersistentCache<any[]>('vouchers');
const cachedUserData = await loadFromPersistentCache<any>('userData');

if (cachedCustomers && cachedVouchers) {
  globalCustomerCache.customers = cachedCustomers;
  globalCustomerCache.vouchers = cachedVouchers;
  globalCustomerCache.userData = cachedUserData;
  setCustomers(cachedCustomers);
  // Show cached data immediately
}
```

- Loads from device storage
- Shows customer/supplier list immediately
- Updates global cache for faster future access

#### Step 3: Try API (Only if no cache exists or cache is expired)

```typescript
// CustomerScreen.tsx - Line 1968-2492
const fetchCustomersData = async (accessToken?: string) => {
  // Fetch from API
  const customersResult = await unifiedApi.getCustomers(...);
  // Save to cache
  saveToPersistentCache('customers', customersResult);
}
```

- Only attempts if no cached data found or cache expired
- If network fails, cached data is still shown

---

## Where Customer/Supplier Data is Cached

### 1. **CustomerScreen.tsx**

**Cache Storage:**

```typescript
// Line 1281-1283: Save to persistent cache
saveToPersistentCache('customers', customersResult);
saveToPersistentCache('vouchers', vouchersResponse);
saveToPersistentCache('userData', userDataResult);

// Line 1243-1252: Save to global cache
globalCustomerCache = {
  customers: customersResult,
  vouchers: vouchersResponse,
  userData: userDataResult,
  lastUpdated: Date.now(),
  activeTab: activeTab,
};
```

**Cache Loading:**

```typescript
// Line 1057-1085: Load from persistent cache
const cachedCustomers = await loadFromPersistentCache<Customer[]>('customers');
if (cachedCustomers) {
  globalCustomerCache.customers = cachedCustomers;
  setCustomers(cachedCustomers);
}

// Line 1175-1181: Load from global cache
if (isCacheValid(activeTab)) {
  setCustomers(globalCustomerCache.customers);
  setAllVouchers(globalCustomerCache.vouchers);
}
```

### 2. **Persistent Cache Utility (`persistentCache.ts`)**

A dedicated utility manages long-term storage:

**Storage Format:**

```typescript
{
  data: Customer[], // or Voucher[] or UserData
  timestamp: 1234567890,
  version: "1.0"
}
```

**Storage Keys:**

- `@customer_cache_customers` - Customer/supplier list
- `@customer_cache_vouchers` - Transaction data
- `@customer_cache_userData` - User profile

**Cache Expiry:** 24 hours (configurable)

---

## Tab-Specific Caching

The app caches data separately for **Customers** and **Suppliers** tabs:

### How It Works:

1. **Single Data Source:** All customers and suppliers are fetched together
2. **Client-Side Filtering:** The app filters the cached data based on `partyType`
3. **Tab Switching:** No API call needed - just filters existing cache

```typescript
// CustomerScreen.tsx - Line 3742-4046
const getFilteredCustomers = () => {
  // Filter cached customers by activeTab
  if (activeTab === 'customers') {
    return customers.filter(c => c.partyType === 'customer');
  } else {
    return customers.filter(c => c.partyType === 'supplier');
  }
};
```

**Benefits:**

- ✅ Instant tab switching (no loading)
- ✅ Works offline
- ✅ Reduces API calls

---

## Offline Behavior

### When Network is OFF:

1. ✅ **CustomerScreen** loads cached data from persistent cache
2. ✅ **Customer List** shows all cached customers
3. ✅ **Supplier List** shows all cached suppliers
4. ✅ **Summary Cards** (Total, Gave, Got) calculated from cached data
5. ✅ **Search & Filter** works on cached data
6. ✅ No loading spinner (data shows instantly)
7. ⚠️ API call fails silently (doesn't show error if cache exists)

### When Network is ON:

1. ✅ Shows cached data immediately
2. ✅ Fetches fresh data in background
3. ✅ Updates cache with latest data
4. ✅ Updates UI if data changed
5. ✅ Background refresh every 2 seconds if data is stale

---

## Cache Update Strategy

### Automatic Updates:

1. **On Screen Focus:**

   ```typescript
   // CustomerScreen.tsx - Line 1328-1420
   useEffect(() => {
     const unsubscribe = navigation.addListener('focus', () => {
       // Refresh if data is stale (>2 seconds)
       if (isDataStale) {
         fetchDataInBackground();
       }
     });
   });
   ```

2. **On Data Fetch:**

   ```typescript
   // CustomerScreen.tsx - Line 1281-1283
   saveToPersistentCache('customers', customersResult);
   saveToPersistentCache('vouchers', vouchersResponse);
   ```

3. **Background Refresh:**

   ```typescript
   // CustomerScreen.tsx - Line 1295-1324
   const fetchDataInBackground = async () => {
     // Refresh customers in background
     const customersResult = await fetchCustomersData(accessToken);
     globalCustomerCache.customers = customersResult;
     saveToPersistentCache('customers', customersResult);
   };
   ```

4. **After Adding Customer/Supplier:**
   ```typescript
   // CustomerScreen.tsx - Line 129
   export const refreshCustomerDataOnReturn = () => {
     clearCustomerCache(); // Force refresh
   };
   ```

### Cache Clearing:

**On Logout:**

```typescript
// CustomerScreen.tsx - Line 92-105
export const clearCustomerCache = () => {
  globalCustomerCache = {
    customers: [],
    vouchers: [],
    userData: null,
    lastUpdated: 0,
    // ... reset all fields
  };
};
```

**Manual Clear:**

```typescript
import { clearCustomerCache } from './CustomerScreen';
import { clearAllPersistentCache } from './utils/persistentCache';

clearCustomerCache();
await clearAllPersistentCache();
```

---

## Cache Validation

### Cache Validity Check:

```typescript
// CustomerScreen.tsx - Line 192-199
const isCacheValid = (activeTab: string) => {
  const now = Date.now();
  return (
    globalCustomerCache.lastUpdated > 0 &&
    now - globalCustomerCache.lastUpdated < CACHE_TTL && // 5 minutes
    globalCustomerCache.activeTab === activeTab
  );
};
```

**Cache is Valid If:**

- ✅ Last updated timestamp exists
- ✅ Less than 5 minutes old
- ✅ Matches current active tab

**Cache is Invalid If:**

- ❌ Older than 5 minutes
- ❌ Different tab selected
- ❌ Never been updated

---

## Rate Limiting Protection

The app includes rate limiting to prevent API overload:

```typescript
// CustomerScreen.tsx - Line 84-86
let isFetchingCustomers = false;
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 1000; // 1 second minimum between calls
```

**Protection Features:**

- ✅ Prevents multiple simultaneous API calls
- ✅ Enforces minimum 1 second between requests
- ✅ Returns cached data if fetch is in progress
- ✅ Handles 429 (rate limit) errors with exponential backoff

---

## Code Flow Diagram

```
CustomerScreen Opens
    │
    ├─→ Check isCacheValid(activeTab)
    │   │
    │   ├─→ Valid? → Show global cache immediately ✅
    │   │            → Refresh in background (if stale)
    │   │
    │   └─→ Invalid? → Check persistent cache
    │       │
    │       ├─→ Found? → Load to global cache + Show ✅
    │       │            → Refresh in background
    │       │
    │       └─→ Not Found? → Try API
    │           │
    │           ├─→ Success? → Save to both caches + Show ✅
    │           │
    │           └─→ Failed? → Show error (if no cache) ❌
    │                        → Show cache (if exists) ✅
```

---

## Background Refresh Mechanism

The app automatically refreshes data in the background:

### When Background Refresh Triggers:

1. **On Screen Focus** (if data is stale >2 seconds)
2. **After Tab Switch** (if cache is expired)
3. **After Adding Customer/Supplier** (force refresh)
4. **Periodic Refresh** (every 5 minutes if screen is active)

### Background Refresh Process:

```typescript
// CustomerScreen.tsx - Line 1295-1324
const fetchDataInBackground = async () => {
  globalCustomerCache.isRefreshing = true;

  // Only refresh customers (most frequently changing)
  const customersResult = await fetchCustomersData(accessToken);

  // Update cache silently
  globalCustomerCache.customers = customersResult;
  globalCustomerCache.lastUpdated = Date.now();
  saveToPersistentCache('customers', customersResult);

  // Update UI
  setCustomers(customersResult);

  globalCustomerCache.isRefreshing = false;
};
```

**Benefits:**

- ✅ Data stays fresh
- ✅ No loading spinner (silent update)
- ✅ Works while user is viewing screen

---

## Search & Filter on Cached Data

Search and filtering work entirely on cached data:

```typescript
// CustomerScreen.tsx - Line 3742-4046
const getFilteredCustomers = () => {
  let filtered = customers; // Start with cached customers

  // Apply search query
  if (searchQuery) {
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }

  // Apply filters (amount, location, etc.)
  if (filters.amountRange !== 'all') {
    // Filter by amount range
  }

  // Filter by tab (customers vs suppliers)
  if (activeTab === 'customers') {
    filtered = filtered.filter(c => c.partyType === 'customer');
  } else {
    filtered = filtered.filter(c => c.partyType === 'supplier');
  }

  return filtered;
};
```

**Benefits:**

- ✅ Works offline
- ✅ Instant results (no API delay)
- ✅ No network usage

---

## Benefits of This Approach

✅ **Fast Loading:** Cached data shows instantly  
✅ **Offline Support:** Works without internet  
✅ **Better UX:** No loading spinners when data exists  
✅ **Reduced API Calls:** Saves bandwidth and server load  
✅ **Persistent:** Data survives app restarts  
✅ **Tab Switching:** Instant switching between customers/suppliers  
✅ **Search/Filter:** Works offline on cached data  
✅ **Background Refresh:** Keeps data fresh without user noticing

---

## Potential Issues

⚠️ **Stale Data:** If you add customers on another device, this device won't know until refresh  
⚠️ **Cache Size:** Large customer lists might use storage space  
⚠️ **Cache Expiry:** 24-hour expiry might be too long for some use cases  
⚠️ **Tab Mismatch:** If cache was created for different tab, it will be invalidated

---

## Cache Configuration

### Cache TTL (Time To Live):

```typescript
// CustomerScreen.tsx - Line 88-89
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

**Global Cache:** 5 minutes  
**Persistent Cache:** 24 hours (default, configurable)

### Rate Limiting:

```typescript
// CustomerScreen.tsx - Line 86
const MIN_FETCH_INTERVAL = 1000; // 1 second minimum
```

**Minimum Interval:** 1 second between API calls

---

## How to Clear Cache (For Testing)

### Method 1: Logout

```typescript
// Automatically clears customer cache
logout();
```

### Method 2: Manual Clear

```typescript
import { clearCustomerCache } from './src/screens/HomeScreen/CustomerScreen';
import { clearAllPersistentCache } from './src/utils/persistentCache';

clearCustomerCache();
await clearAllPersistentCache();
```

### Method 3: Clear Specific Cache

```typescript
import { clearPersistentCache } from './src/utils/persistentCache';

await clearPersistentCache('customers');
await clearPersistentCache('vouchers');
await clearPersistentCache('userData');
```

### Method 4: Clear All App Data

- Android: Settings → Apps → Your App → Storage → Clear Data
- iOS: Delete and reinstall app

---

## Summary

Your customer/supplier list shows offline because:

1. **Persistent Cache** stores data permanently on device (24 hours)
2. **Global Cache** provides instant access (5 minutes TTL)
3. **Offline-first** loading strategy checks cache before API
4. **Tab-specific** caching allows instant switching
5. **Background refresh** keeps data fresh without blocking UI
6. **Search/Filter** works entirely on cached data

This is a **best practice** for mobile apps - it provides excellent user experience, works offline, and reduces server load!

---

## Key Differences from Profile Caching

| Feature                | Profile Cache            | Customer/Supplier Cache          |
| ---------------------- | ------------------------ | -------------------------------- |
| **Storage**            | AsyncStorage directly    | Persistent cache utility         |
| **TTL**                | No expiry (until logout) | 5 min (global), 24h (persistent) |
| **Tab Support**        | No                       | Yes (customers vs suppliers)     |
| **Background Refresh** | On focus only            | Continuous (every 2s if stale)   |
| **Rate Limiting**      | No                       | Yes (1s minimum interval)        |
| **Cache Validation**   | Simple existence check   | Time-based + tab-based           |

---

**Last Updated:** January 2025
