# StatusBar Implementation Guide

## Overview

This document explains the comprehensive StatusBar implementation that ensures consistent StatusBar colors across all screens in the UtilsApp. The implementation provides dynamic StatusBar configuration that automatically matches each screen's header color.

## Architecture

### 1. StatusBar Manager (`src/utils/statusBarManager.ts`)

The central configuration file that defines StatusBar settings for all screens:

```typescript
export interface StatusBarConfig {
  backgroundColor: string;
  barStyle: 'light-content' | 'dark-content';
  translucent?: boolean;
}
```

**Key Features:**

- Centralized configuration for all screens
- Automatic color matching with headers
- Support for translucent status bars (gradient screens)
- Platform-specific handling (Android/iOS)

### 2. StatusBar Hooks (`src/hooks/useStatusBar.ts`)

React hooks for easy StatusBar management in screen components:

#### `useStatusBar(screenName, customConfig?)`

- Standard hook for most screens
- Automatically applies configuration on screen focus
- Handles cleanup when leaving screen

#### `useStatusBarWithGradient(screenName, gradientColors)`

- Specialized hook for gradient headers (like ProfileScreen)
- Uses transparent background with light content
- Provides status bar spacer for proper layout

#### `useCustomStatusBar(customConfig)`

- For screens with unique StatusBar requirements
- Full control over StatusBar configuration

### 3. StatusBar Components (`src/components/StatusBar.tsx`)

Reusable components for StatusBar implementation:

- `<StatusBar screenName="Dashboard" />` - Standard StatusBar
- `<GradientStatusBar screenName="ProfileScreen" gradientColors={['#4f8cff', '#1ecb81']} />` - For gradient headers
- `<CustomStatusBar config={customConfig} />` - Custom configuration

## Screen Configurations

### Blue Header Screens

These screens use the brand blue color (`#4f8cff`) with light content:

- `Customer` - Customer management screen
- `CustomerDetail` - Customer details screen
- `AddParty` - Add new party screen
- `AddNewEntry` - Add new entry screen
- `AddCustomerFromContacts` - Add customer from contacts

### Light Header Screens

These screens use light background (`#f6fafc`) with dark content:

- `Dashboard` - Main dashboard
- `Invoice` - Invoice management
- `Receipt` - Receipt management
- `Payment` - Payment management
- `Purchase` - Purchase management
- `AddFolder` - Add folder screen
- `FolderScreen` - Folder view screen
- `AllQuickActionsScreen` - Quick actions
- `GSTSummary` - GST summary
- `CashFlow` - Cash flow screen
- `DailyLedger` - Daily ledger
- `SubscriptionPlan` - Subscription plans
- `Notifications` - Notifications
- `Report` - Reports screen
- `LinkToCA` - Link to CA screen

### Gradient Header Screens

These screens use transparent background with gradient headers:

- `ProfileScreen` - User profile with gradient header

## Implementation Examples

### Standard Screen Implementation

```typescript
import { useStatusBar } from '../hooks/useStatusBar';

const DashboardScreen = () => {
  // Configure StatusBar for light header
  useStatusBar('Dashboard');

  return (
    <SafeAreaView style={styles.container}>{/* Screen content */}</SafeAreaView>
  );
};
```

### Gradient Screen Implementation

```typescript
import { useStatusBarWithGradient } from '../hooks/useStatusBar';

const ProfileScreen = () => {
  const GRADIENT = ['#4f8cff', '#1ecb81'];

  // Configure StatusBar for gradient header
  const { statusBarSpacer } = useStatusBarWithGradient(
    'ProfileScreen',
    GRADIENT,
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header}>
        {/* Status Bar Spacer */}
        <View
          style={[styles.statusBarSpacer, { height: statusBarSpacer.height }]}
        />
        {/* Header content */}
      </LinearGradient>
      {/* Screen content */}
    </View>
  );
};
```

### Custom Configuration

```typescript
import { useCustomStatusBar } from '../hooks/useStatusBar';

const CustomScreen = () => {
  const customConfig = {
    backgroundColor: '#ff6b6b',
    barStyle: 'light-content' as const,
    translucent: false,
  };

  useCustomStatusBar(customConfig);

  return (
    <SafeAreaView style={styles.container}>{/* Screen content */}</SafeAreaView>
  );
};
```

## Navigation Integration

The StatusBar configuration is automatically updated when navigating between screens through the Navigation.tsx file:

```typescript
const updateStatusBarForCurrentRoute = () => {
  const routeName = navigationRef.getCurrentRoute()?.name;
  const config = getStatusBarConfig(routeName);
  setStatusBarConfig(config);
  applyStatusBarConfig(config);
};
```

## Platform Support

### Android

- Uses `StatusBar.setBackgroundColor()` for background color
- Supports translucent status bars
- Handles status bar height properly

### iOS

- Uses `StatusBar.setBarStyle()` for content style
- Translucent status bars work seamlessly
- Automatic status bar height handling

## Testing

Use the provided test utility to validate StatusBar configurations:

```typescript
import { runAllStatusBarTests } from '../utils/statusBarTest';

// Run all tests
const results = runAllStatusBarTests();
console.log('Test results:', results);
```

## Best Practices

### 1. Always Use Hooks

- Use `useStatusBar()` for standard screens
- Use `useStatusBarWithGradient()` for gradient headers
- Avoid manual StatusBar configuration

### 2. Consistent Naming

- Use exact screen names as defined in navigation
- Follow the naming convention in `statusBarManager.ts`

### 3. Color Consistency

- Blue headers: `#4f8cff` with `light-content`
- Light headers: `#f6fafc` with `dark-content`
- Gradient headers: `transparent` with `light-content`

### 4. Spacer Handling

- Always include status bar spacer for translucent screens
- Use the provided `statusBarSpacer` from hooks

## Troubleshooting

### Common Issues

1. **StatusBar color doesn't match header**

   - Check if the screen name is correctly registered in `statusBarManager.ts`
   - Verify the hook is being called in the component

2. **Flickering during navigation**

   - Ensure the hook is called at the component level, not in nested components
   - Check if multiple StatusBar configurations are conflicting

3. **Translucent status bar issues**
   - Verify the spacer height is correctly applied
   - Check if the header background extends behind the status bar

### Debug Mode

Enable debug logging by checking console output for StatusBar configuration messages:

```
🎨 StatusBar: Applying config for Dashboard: { backgroundColor: '#f6fafc', barStyle: 'dark-content' }
```

## Migration Guide

### From Manual StatusBar Configuration

**Before:**

```typescript
<StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />
```

**After:**

```typescript
import { useStatusBar } from '../hooks/useStatusBar';

const MyScreen = () => {
  useStatusBar('MyScreen');
  // Remove manual StatusBar component
  return <SafeAreaView>{/* Content */}</SafeAreaView>;
};
```

### Adding New Screens

1. Add screen configuration to `statusBarManager.ts`:

```typescript
const SCREEN_CONFIGS: Record<string, StatusBarConfig> = {
  // ... existing screens
  NewScreen: {
    backgroundColor: '#f6fafc',
    barStyle: 'dark-content',
    translucent: false,
  },
};
```

2. Use the hook in the screen component:

```typescript
const NewScreen = () => {
  useStatusBar('NewScreen');
  // ... rest of component
};
```

## Performance Considerations

- StatusBar configuration is applied only when screens come into focus
- Automatic cleanup prevents memory leaks
- Minimal re-renders through proper hook usage
- Efficient configuration lookup through object mapping

## Future Enhancements

1. **Dynamic Theme Support**

   - Support for light/dark themes
   - Automatic color adaptation

2. **Animation Support**

   - Smooth transitions between StatusBar colors
   - Animated status bar changes

3. **Accessibility**
   - High contrast mode support
   - Accessibility-friendly color combinations

---

This implementation ensures a consistent and professional StatusBar experience across the entire UtilsApp, with automatic color matching and smooth transitions between screens.
