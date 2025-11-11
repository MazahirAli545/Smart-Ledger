/**
 * StatusBar Manager - Centralized StatusBar configuration for consistent behavior
 *
 * This utility provides a centralized way to manage StatusBar colors and styles
 * across all screens, ensuring they match the header colors dynamically.
 */

import { StatusBar, Platform } from 'react-native';

export type StatusBarStyle = 'light-content' | 'dark-content';

export interface StatusBarConfig {
  backgroundColor: string;
  barStyle: StatusBarStyle;
  translucent?: boolean;
}

// Default configurations
const DEFAULT_LIGHT_CONFIG: StatusBarConfig = {
  backgroundColor: '#f6fafc',
  barStyle: 'dark-content',
  translucent: false,
};

const DEFAULT_DARK_CONFIG: StatusBarConfig = {
  backgroundColor: '#4f8cff',
  barStyle: 'light-content',
  translucent: false,
};

// Screen-specific configurations
const SCREEN_CONFIGS: Record<string, StatusBarConfig> = {
  // Blue header screens (like ProfileScreen)
  Customer: {
    backgroundColor: 'transparent',
    barStyle: 'light-content',
    translucent: true,
  },
  CustomerDetail: {
    backgroundColor: 'transparent',
    barStyle: 'light-content',
    translucent: true,
  },
  AddParty: {
    backgroundColor: 'transparent',
    barStyle: 'light-content',
    translucent: true,
  },
  AddNewEntry: {
    backgroundColor: 'transparent',
    barStyle: 'light-content',
    translucent: true,
  },
  AddCustomerFromContacts: {
    backgroundColor: 'transparent',
    barStyle: 'light-content',
    translucent: true,
  },
  ProfileScreen: {
    backgroundColor: 'transparent', // Uses gradient, so transparent
    barStyle: 'light-content',
    translucent: true,
  },

  // Blue header screens (Dashboard and Drawer)
  Dashboard: DEFAULT_DARK_CONFIG,
  CustomDrawerContent: DEFAULT_DARK_CONFIG,

  // Light header screens
  Invoice: DEFAULT_LIGHT_CONFIG,
  Receipt: DEFAULT_LIGHT_CONFIG,
  Payment: DEFAULT_LIGHT_CONFIG,
  Purchase: DEFAULT_LIGHT_CONFIG,
  AddFolder: DEFAULT_LIGHT_CONFIG,
  FolderScreen: DEFAULT_LIGHT_CONFIG,
  AllQuickActionsScreen: DEFAULT_LIGHT_CONFIG,
  GSTSummary: DEFAULT_LIGHT_CONFIG,
  CashFlow: DEFAULT_LIGHT_CONFIG,
  DailyLedger: DEFAULT_LIGHT_CONFIG,
  SubscriptionPlan: DEFAULT_LIGHT_CONFIG,
  Notifications: DEFAULT_LIGHT_CONFIG,
  Report: DEFAULT_LIGHT_CONFIG,
  LinkToCA: DEFAULT_LIGHT_CONFIG,

  // Auth screens
  SignIn: DEFAULT_LIGHT_CONFIG,
  SignInOtp: DEFAULT_LIGHT_CONFIG,
};

/**
 * Get StatusBar configuration for a specific screen
 */
export function getStatusBarConfig(screenName?: string): StatusBarConfig {
  if (!screenName) {
    return DEFAULT_LIGHT_CONFIG;
  }

  return SCREEN_CONFIGS[screenName] || DEFAULT_LIGHT_CONFIG;
}

/**
 * Apply StatusBar configuration
 */
export function applyStatusBarConfig(config: StatusBarConfig): void {
  try {
    console.log('🎨 Applying StatusBar config:', config);

    // Set bar style (text color) for both platforms
    StatusBar.setBarStyle(config.barStyle, false);

    // Set background color for Android
    if (Platform.OS === 'android') {
      // Force non-translucent first
      StatusBar.setTranslucent(false);
      // Set background color with animation disabled for immediate effect
      StatusBar.setBackgroundColor(config.backgroundColor, false);
      // Ensure status bar is visible
      StatusBar.setHidden(false, 'none');
    }

    // Set translucent property
    if (config.translucent !== undefined) {
      StatusBar.setTranslucent(config.translucent);
    }

    // Force update on both platforms
    if (Platform.OS === 'ios') {
      // On iOS, we need to ensure the status bar style is applied
      StatusBar.setBarStyle(config.barStyle, false);
    }

    console.log('✅ StatusBar config applied successfully');
  } catch (error) {
    console.warn('❌ Failed to apply StatusBar config:', error);
  }
}

/**
 * Apply StatusBar configuration for a specific screen
 */
export function applyStatusBarForScreen(screenName: string): void {
  const config = getStatusBarConfig(screenName);
  applyStatusBarConfig(config);
}

/**
 * Get header color for a screen (useful for gradient backgrounds)
 */
export function getHeaderColor(screenName: string): string {
  const config = getStatusBarConfig(screenName);
  return config.backgroundColor;
}

/**
 * Check if a screen uses translucent status bar
 */
export function isTranslucentScreen(screenName: string): boolean {
  const config = getStatusBarConfig(screenName);
  return config.translucent === true;
}

/**
 * Get status bar spacer height for translucent screens
 */
export function getStatusBarSpacerHeight(): number {
  return Platform.OS === 'ios' ? 44 : 24; // Standard status bar heights
}

/**
 * Create a status bar spacer component for translucent screens
 */
export function createStatusBarSpacer() {
  return {
    height: getStatusBarSpacerHeight(),
  };
}

// Export commonly used configurations
export const STATUS_BAR_CONFIGS = {
  LIGHT: DEFAULT_LIGHT_CONFIG,
  DARK: DEFAULT_DARK_CONFIG,
  TRANSLUCENT_LIGHT: {
    backgroundColor: 'transparent',
    barStyle: 'light-content' as StatusBarStyle,
    translucent: true,
  },
  TRANSLUCENT_DARK: {
    backgroundColor: 'transparent',
    barStyle: 'dark-content' as StatusBarStyle,
    translucent: true,
  },
} as const;
