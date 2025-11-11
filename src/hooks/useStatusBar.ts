/**
 * useStatusBar Hook - React hook for managing StatusBar configuration
 *
 * This hook provides an easy way to manage StatusBar configuration
 * in screen components with automatic cleanup and updates.
 */

import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  getStatusBarConfig,
  applyStatusBarConfig,
  StatusBarConfig,
  getHeaderColor,
  isTranslucentScreen,
  createStatusBarSpacer,
} from '../utils/statusBarManager';

/**
 * Hook to manage StatusBar configuration for a screen
 *
 * @param screenName - Name of the current screen
 * @param customConfig - Optional custom StatusBar configuration
 */
export function useStatusBar(
  screenName: string,
  customConfig?: Partial<StatusBarConfig>,
) {
  const config = {
    ...getStatusBarConfig(screenName),
    ...customConfig,
  };

  // Apply StatusBar configuration when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log(`🎨 StatusBar: Applying config for ${screenName}:`, config);
      applyStatusBarConfig(config);

      // Cleanup function - restore default when leaving screen
      return () => {
        console.log(`🎨 StatusBar: Cleaning up for ${screenName}`);
        // Apply default light config as cleanup
        applyStatusBarConfig(getStatusBarConfig('Dashboard'));
      };
    }, [screenName, config]),
  );

  // Also apply on mount
  useEffect(() => {
    applyStatusBarConfig(config);
  }, [config]);

  return {
    config,
    headerColor: getHeaderColor(screenName),
    isTranslucent: isTranslucentScreen(screenName),
    statusBarSpacer: createStatusBarSpacer(),
  };
}

/**
 * Hook for screens with gradient headers (like ProfileScreen)
 *
 * @param screenName - Name of the current screen
 * @param gradientColors - Array of gradient colors
 */
export function useStatusBarWithGradient(
  screenName: string,
  gradientColors: string[],
) {
  // If gradient colors collapse to a single solid color (e.g., ['#4f8cff','#4f8cff'])
  // then behave like a solid header: apply solid background and non-translucent.
  // This mirrors CustomerScreen behavior and avoids Android real-device races.
  const isSolidGradient =
    Array.isArray(gradientColors) &&
    gradientColors.length > 0 &&
    gradientColors.every(
      c => (c || '').toLowerCase() === (gradientColors[0] || '').toLowerCase(),
    );

  const config = isSolidGradient
    ? {
        backgroundColor: (gradientColors[0] || '#4f8cff') as string,
        barStyle: 'light-content' as const,
        translucent: false,
      }
    : {
        backgroundColor: 'transparent',
        barStyle: 'light-content' as const,
        translucent: true,
      };

  useFocusEffect(
    useCallback(() => {
      console.log(
        `🎨 StatusBar: Applying gradient config for ${screenName}:`,
        config,
      );
      applyStatusBarConfig(config);

      return () => {
        console.log(`🎨 StatusBar: Cleaning up gradient for ${screenName}`);
        applyStatusBarConfig(getStatusBarConfig('Dashboard'));
      };
    }, [screenName]),
  );

  useEffect(() => {
    applyStatusBarConfig(config);
  }, []);

  return {
    config,
    headerColor: gradientColors[0], // Use first gradient color as header color
    isTranslucent: config.translucent,
    statusBarSpacer: createStatusBarSpacer(),
  };
}

/**
 * Hook for custom StatusBar configuration
 *
 * @param customConfig - Custom StatusBar configuration
 */
export function useCustomStatusBar(customConfig: StatusBarConfig) {
  useFocusEffect(
    useCallback(() => {
      console.log('🎨 StatusBar: Applying custom config:', customConfig);
      applyStatusBarConfig(customConfig);

      return () => {
        console.log('🎨 StatusBar: Cleaning up custom config');
        applyStatusBarConfig(getStatusBarConfig('Dashboard'));
      };
    }, [customConfig]),
  );

  useEffect(() => {
    applyStatusBarConfig(customConfig);
  }, [customConfig]);

  return {
    config: customConfig,
    headerColor: customConfig.backgroundColor,
    isTranslucent: customConfig.translucent || false,
    statusBarSpacer: createStatusBarSpacer(),
  };
}
