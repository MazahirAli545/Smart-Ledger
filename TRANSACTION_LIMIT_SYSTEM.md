# Transaction Limit Popup & Notification System

## Overview

This system implements a comprehensive transaction limit popup and notification system that meets all the specified requirements:

1. **Popup + Notification Trigger**: Shows popup and notification after successful login
2. **Avoid Duplicate Popups/Notifications**: Maintains session tracking to prevent duplicates
3. **24-Hour Notification Rule**: Shows local notifications every 24 hours
4. **Screen Exclusion**: Excludes SignIn and SignInOtp screens

## Architecture

### Core Components

1. **TransactionLimitService** (`src/services/TransactionLimitService.ts`)

   - Singleton service managing all transaction limit logic
   - Handles popup triggering, notification scheduling, and session management
   - Uses Notifee for local notifications

2. **TransactionLimitContext** (`src/context/TransactionLimitContext.tsx`)

   - React Context providing service access throughout the app
   - Manages popup state and authentication integration

3. **TransactionLimitPopup** (`src/components/TransactionLimitPopup.tsx`)

   - Reusable popup component with plan hierarchy logic
   - Shows different content based on current plan and next available plan

4. **GlobalTransactionLimitWrapper** (`src/components/GlobalTransactionLimitWrapper.tsx`)
   - Wrapper component that shows popup when needed
   - Excludes certain screens from showing popups

## Features

### 1. Popup & Notification Trigger

- **Trigger Conditions**: Shows popup when user is at or near transaction limit
- **Authentication Integration**: Automatically starts monitoring after successful login
- **App State Handling**: Shows popup when app resumes from background (if conditions are met)

### 2. Duplicate Prevention

- **Session Tracking**: Uses AsyncStorage to track if popup was shown in current session
- **App State Reset**: Resets popup flag when app resumes from background
- **Service State Management**: Maintains active/inactive state based on authentication

### 3. 24-Hour Notifications

- **Scheduled Notifications**: Uses Notifee to schedule daily notifications
- **Background Support**: Works even when app is killed or in background
- **Timer Management**: Tracks last notification time and schedules next one

### 4. Screen Exclusion

- **Automatic Exclusion**: SignIn and SignInOtp screens are automatically excluded
- **Navigation Structure**: Uses existing navigation structure to determine screen context

## Usage

### Basic Integration

The system is automatically integrated into the app through the provider hierarchy:

```tsx
// App.tsx
<TransactionLimitProvider>
  <Navigation />
</TransactionLimitProvider>
```

### Manual Testing

Use the test panel component for manual testing:

```tsx
import TransactionLimitTestPanel from './src/components/TransactionLimitTestPanel';

// Add to any screen for testing
<TransactionLimitTestPanel />;
```

### Service Methods

```tsx
import { useTransactionLimit } from './src/context/TransactionLimitContext';

const {
  forceTriggerNotification,
  getServiceStatus,
  startLimitMonitoring,
  stopLimitMonitoring,
} = useTransactionLimit();
```

## Configuration

### Notification Settings

- **Channel ID**: `transaction-limit`
- **Importance**: High
- **Visibility**: Public
- **Sound**: Default system sound
- **Vibration**: Custom pattern [300, 500]

### Storage Keys

- `transaction_limit_last_notification`: Last notification timestamp
- `transaction_limit_popup_shown_session`: Session popup flag
- `transaction_limit_service_active`: Service active state

## Plan Hierarchy

The system uses a predefined plan hierarchy:

```typescript
const PLAN_HIERARCHY = ['free', 'starter', 'professional', 'enterprise'];
```

### Popup Behavior

- **Free Plan**: Shows "Upgrade your plan for Starter"
- **Starter Plan**: Shows "Upgrade your plan for Professional"
- **Professional Plan**: Shows "Upgrade your plan for Enterprise"
- **Enterprise Plan**: Shows "You're on our highest plan! 🎉" (no button)

## API Integration

The service fetches transaction limit data from:

```
GET /transaction-limits/info
```

Expected response format:

```json
{
  "code": 200,
  "data": {
    "currentCount": 4500,
    "maxAllowed": 5000,
    "remaining": 500,
    "planName": "Professional",
    "canCreate": true,
    "percentageUsed": 90,
    "isNearLimit": true,
    "isAtLimit": false,
    "nextResetDate": "2025-01-01",
    "nextResetFormatted": "Jan 1, 2025"
  }
}
```

## Dependencies

- `@notifee/react-native`: Local notifications
- `@react-native-async-storage/async-storage`: Persistent storage
- `react-native-linear-gradient`: Popup styling
- `react-native-vector-icons`: Icons

## Testing

### Manual Testing Steps

1. **Login Test**: Login with a user who has transaction limits
2. **Popup Test**: Use test panel to trigger popup
3. **Background Test**: Put app in background and resume
4. **Notification Test**: Wait for 24-hour notification (or modify timer for testing)

### Test Panel Features

- **Test Popup**: Manually trigger popup
- **Check Status**: View service status and timing
- **Status Display**: Shows active state, popup history, and notification timing

## Troubleshooting

### Common Issues

1. **Popup Not Showing**: Check if user is authenticated and service is active
2. **Notifications Not Working**: Verify Notifee permissions and channel setup
3. **Duplicate Popups**: Check session tracking and app state handling

### Debug Logging

The service includes comprehensive logging:

- `🚀 Starting transaction limit monitoring...`
- `📱 App resumed from background, checking for popup...`
- `⚠️ User is at/near limit, showing popup...`
- `📅 24-hour notification scheduled for: [timestamp]`

## Future Enhancements

1. **Custom Notification Timing**: Allow users to set notification frequency
2. **Plan-Specific Limits**: Different limits for different plan types
3. **Analytics Integration**: Track popup interactions and conversion rates
4. **A/B Testing**: Test different popup designs and messaging

## Security Considerations

- **Token Validation**: All API calls require valid authentication tokens
- **Data Privacy**: No sensitive user data is stored in notifications
- **Permission Handling**: Graceful handling of notification permission denials

## Performance

- **Singleton Pattern**: Single service instance prevents memory leaks
- **Lazy Loading**: Service only activates when user is authenticated
- **Efficient Storage**: Minimal data stored in AsyncStorage
- **Background Optimization**: Notifications work without keeping app active
