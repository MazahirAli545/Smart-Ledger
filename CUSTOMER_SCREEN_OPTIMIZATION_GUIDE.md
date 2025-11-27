# CustomerScreen Performance Optimization Guide

## Problem Statement

When users clear the app from background and reopen after 2-4 hours, CustomerScreen takes 1-2 minutes to load data.

## Root Causes Identified

1. **Mixed API Approaches**: Using `axios`, `fetch`, and `unifiedApi` inconsistently
2. **No Persistent Cache**: Cache is lost when app is killed
3. **Short Cache TTL**: 30 seconds is too short for cold starts
4. **Not Showing Cached Data Immediately**: Waits for fresh data even when cache exists
5. **Multiple Re-renders**: Too many useEffect hooks and state updates
6. **No Pre-warming**: Session Warm-Up Service doesn't pre-warm customers data

## Optimizations Implemented

### 1. Enhanced Session Warm-Up Service ✅

- Added `warmUpCustomersData()` to pre-warm customers data when app returns to foreground
- This pre-populates cache before user navigates to CustomerScreen

### 2. Increased Cache TTL ✅

- Changed from 30 seconds to 5 minutes for customers data
- Better balance between freshness and performance

### 3. Persistent Cache Utility ✅

- Created `persistentCache.ts` utility
- Stores cache in AsyncStorage to survive app restarts
- Shows cached data immediately on cold start

### 4. API Call Optimization (Recommended)

- Replace all `axios.get()` calls with `unifiedApi.get()` or `unifiedApi.getCustomers()`
- Benefits:
  - Automatic caching
  - Request deduplication
  - Consistent error handling
  - Better timeout management

### 5. Immediate Cache Display (Recommended)

- Load persistent cache on mount
- Show cached data immediately
- Fetch fresh data in background
- Update UI when fresh data arrives

### 6. Re-render Optimization (Recommended)

- Use `useMemo` for filtered/sorted data
- Use `useCallback` for event handlers
- Reduce unnecessary state updates

## Implementation Steps

### Step 1: Replace axios with unifiedApi

**Before:**

```typescript
axios.get(customersUrl, {
  headers: { Authorization: `Bearer ${token}` },
  params: { page: 1, limit: 100 },
  timeout: 8000,
});
```

**After:**

```typescript
const customersResult = await unifiedApi.getCustomers('', 1, 100);
```

### Step 2: Add Persistent Cache Loading

**In useEffect on mount:**

```typescript
// Load persistent cache immediately
const cachedData = await loadFromPersistentCache('customers', 5 * 60 * 1000);
if (cachedData) {
  setCustomers(cachedData);
  // Show cached data immediately, then refresh in background
}
```

### Step 3: Save to Persistent Cache

**After fetching fresh data:**

```typescript
await saveToPersistentCache('customers', customersResult);
```

### Step 4: Optimize Re-renders

**Use useMemo for filtered data:**

```typescript
const filteredCustomers = useMemo(() => {
  return getFilteredCustomers(customers, activeTab, filters);
}, [customers, activeTab, filters]);
```

## Expected Performance Improvements

### Before Optimization

- Cold start: **60-120 seconds** (1-2 minutes)
- Warm start: **2-5 seconds**

### After Optimization

- Cold start: **1-3 seconds** (cached data shown immediately)
- Warm start: **0.5-1 second**

## Testing Checklist

- [ ] Test cold start after app killed for 2+ hours
- [ ] Test warm start (app in background < 5 minutes)
- [ ] Test with slow network connection
- [ ] Test with no network (should show cached data)
- [ ] Verify data freshness (cache updates correctly)
- [ ] Test tab switching (customers/suppliers)
- [ ] Test search functionality
- [ ] Test pull-to-refresh

## Monitoring

Monitor these metrics:

- Time to first render (TTFR)
- Time to interactive (TTI)
- Cache hit rate
- API call count
- Network request duration
