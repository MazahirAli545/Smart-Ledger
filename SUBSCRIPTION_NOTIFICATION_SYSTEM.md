# 📢 Subscription Renewal Notification System

## Overview

The Subscription Renewal Notification System is a comprehensive solution that automatically shows foreground notifications to users when their subscription is about to expire. The system runs every 24 hours and displays notifications when the subscription is within the last 10 days of expiry.

## 🎯 Key Features

- **24-Hour Interval**: Checks subscription status every 24 hours
- **Smart Timing**: Only shows notifications when subscription expires within 10 days
- **Urgency Levels**: Different visual styles based on urgency (Critical, High, Medium)
- **Global Coverage**: Shows on all screens except SignIn and SignInOtp
- **Beautiful UI**: Modern, animated notification with gradient backgrounds
- **User Actions**: Direct upgrade/renewal and "remind later" options

## 🏗️ Architecture

### Core Components

1. **SubscriptionNotificationService** - Main service that manages the notification logic
2. **SubscriptionNotificationContext** - React context for state management
3. **SubscriptionRenewalNotification** - UI component for displaying notifications
4. **GlobalNotificationWrapper** - Wrapper component for all app screens

### File Structure

```
src/
├── services/
│   └── subscriptionNotificationService.ts
├── context/
│   └── SubscriptionNotificationContext.tsx
├── components/
│   ├── SubscriptionRenewalNotification.tsx
│   └── GlobalNotificationWrapper.tsx
```

## 🚀 Implementation

### 1. Service Integration

The service is automatically initialized when the app starts and integrated into the main App.tsx:

```typescript
// App.tsx
<SubscriptionNotificationProvider>
  <Navigation />
</SubscriptionNotificationProvider>
```

### 2. Screen Integration

All app screens (except SignIn and SignInOtp) are wrapped with the GlobalNotificationWrapper:

```typescript
// Navigation.tsx
<GlobalNotificationWrapper>
  <Stack.Navigator>{/* All app screens */}</Stack.Navigator>
</GlobalNotificationWrapper>
```

### 3. Backend Integration

The system fetches subscription data from the backend API:

```typescript
// GET /subscriptions/my
// Returns subscription data including endDate, status, plan details
```

## 📱 User Experience

### Notification Appearance

The notification appears as a modal that slides up from the bottom with:

- **Header**: Gradient background with urgency-based colors
- **Content**: Subscription plan details and expiry information
- **Features List**: Premium features reminder
- **Actions**: "Upgrade Plan" and "Remind me later" buttons

### Urgency Levels

| Days Until Expiry | Urgency Level | Color            | Icon        | Message                                |
| ----------------- | ------------- | ---------------- | ----------- | -------------------------------------- |
| 1-3 days          | Critical      | Red (#ff6b6b)    | ⚠️ Warning  | "Your subscription expires in X days!" |
| 4-7 days          | High          | Orange (#ffa726) | ⏰ Time     | "Your subscription expires in X days"  |
| 8-10 days         | Medium        | Purple (#8f5cff) | 📅 Calendar | "Your subscription expires in X days"  |
| 11+ days          | None          | -                | -           | No notification shown                  |

### User Actions

1. **Upgrade Plan**: Navigates to SubscriptionPlan screen
2. **Remind Later**: Closes notification, will show again in 24 hours
3. **Close**: Dismisses notification temporarily

## 🧪 Testing

### Automatic Testing

The system automatically tests itself by:

1. **Real-time Monitoring**: Checks subscription status every 24 hours
2. **Automatic Display**: Shows notifications when conditions are met
3. **Console Logging**: Provides detailed logs for debugging

### Test Scenarios

The system automatically handles these scenarios:

1. **Critical (1-3 days)**: Red notification with urgent messaging
2. **High (4-7 days)**: Orange notification with time messaging
3. **Medium (8-10 days)**: Purple notification with calendar messaging
4. **No Alert (11+ days)**: No notification shown
5. **24-Hour Cooldown**: Notification won't show again for 24 hours

## ⚙️ Configuration

### Notification Settings

The system respects user notification preferences and can be configured:

```typescript
// Check if notifications are enabled
const isEnabled = notificationService.isNotificationsEnabled();

// Toggle notifications
await notificationService.toggleNotifications(true / false);
```

### Customization

#### Colors

```typescript
// Critical urgency
const criticalColors = ['#ff6b6b', '#ee5a52'];

// High urgency
const highColors = ['#ffa726', '#ff9800'];

// Medium urgency
const mediumColors = ['#8f5cff', '#6f4cff'];
```

#### Messages

```typescript
// Customize notification messages
const getNotificationMessage = (daysUntilExpiry: number): string => {
  if (daysUntilExpiry === 1) {
    return 'Your subscription expires tomorrow!';
  }
  if (daysUntilExpiry <= 3) {
    return `Your subscription expires in ${daysUntilExpiry} days!`;
  }
  // ... more customizations
};
```

## 🔧 API Integration

### Backend Endpoints

The system integrates with these backend endpoints:

```typescript
// Get user's subscription
GET /subscriptions/my
Headers: { Authorization: "Bearer <token>" }

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "planId": 1,
    "status": "active",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-02-01T00:00:00.000Z",
    "nextBillingDate": "2024-02-01T00:00:00.000Z",
    "amount": 299,
    "autoRenewal": false,
    "plan": {
      "id": 1,
      "name": "premium",
      "displayName": "Premium Plan",
      "price": 299,
      "currency": "INR",
      "billingCycle": "month"
    }
  }
}
```

## 📊 Monitoring & Analytics

### Logging

The system provides comprehensive logging:

```typescript
console.log('🚀 Starting subscription renewal notification system...');
console.log('🔍 Checking subscription renewal status...');
console.log('📢 Showing renewal notification:', notificationData);
console.log('✅ Subscription renewal notification system started');
```

### Status Monitoring

```typescript
// Get current system status
const service = SubscriptionNotificationService.getInstance();
const status = await service.getSubscriptionStatus();
console.log('System Status:', {
  serviceActive: service.isServiceActive(),
  hasSubscription: status.hasActiveSubscription,
  daysUntilExpiry: status.daysUntilExpiry,
  subscription: status.subscription,
});
```

## 🚨 Troubleshooting

### Common Issues

1. **Notifications not showing**

   - Check if service is active: `service.isServiceActive()`
   - Verify subscription status: `getSubscriptionStatus()`
   - Check if within 10-day window

2. **Notifications showing too frequently**

   - Verify 24-hour cooldown is working
   - Check `subscriptionNotificationLastShown` in AsyncStorage

3. **Wrong urgency level**
   - Verify `daysUntilExpiry` calculation
   - Check subscription `endDate` format

### Debug Commands

```typescript
// Get service instance
const service = SubscriptionNotificationService.getInstance();

// Force check subscription
await service.forceCheckSubscription();

// Get subscription status
const status = await service.getSubscriptionStatus();

// Check if service is active
const isActive = service.isServiceActive();
```

## 🔄 Lifecycle

### App Startup

1. SubscriptionNotificationProvider initializes
2. Service starts automatically
3. Checks subscription status immediately
4. Sets up 24-hour interval

### Daily Check

1. Service checks subscription status
2. Calculates days until expiry
3. Determines if notification should show
4. Shows notification if conditions met

### User Interaction

1. User sees notification
2. Can choose to upgrade or remind later
3. Notification dismissed
4. Next check in 24 hours

## 🎨 UI/UX Guidelines

### Design Principles

- **Non-intrusive**: Slides up from bottom, doesn't block app usage
- **Clear messaging**: Urgency-based colors and icons
- **Action-oriented**: Clear upgrade and remind later options
- **Consistent**: Matches app's design language

### Accessibility

- High contrast colors for urgency levels
- Clear, readable typography
- Touch-friendly button sizes
- Screen reader compatible

## 📈 Future Enhancements

### Planned Features

1. **Push Notifications**: Background notifications when app is closed
2. **Email Reminders**: Server-side email notifications
3. **SMS Alerts**: Text message reminders
4. **Custom Timing**: User-configurable reminder intervals
5. **Analytics**: Track notification effectiveness

### Integration Opportunities

1. **Payment Gateway**: Direct payment from notification
2. **Plan Comparison**: Show different plan options
3. **Usage Analytics**: Show subscription usage statistics
4. **Loyalty Rewards**: Special offers for renewals

## 📝 Development Notes

### Code Quality

- TypeScript for type safety
- Comprehensive error handling
- Extensive logging for debugging
- Modular architecture for maintainability

### Performance

- Efficient 24-hour intervals
- Minimal memory footprint
- Async operations for smooth UX
- Cached subscription data

### Security

- Secure token handling
- API authentication
- Data validation
- Error sanitization

---

## 🎯 Summary

The Subscription Renewal Notification System provides a seamless, user-friendly way to remind users about subscription renewals. With its beautiful UI, smart timing, and comprehensive testing tools, it ensures users never miss their subscription expiry while maintaining a great user experience.

The system is production-ready and can be easily customized for different business needs and user preferences.
