/**
 * StatusBar Component - Consistent StatusBar implementation
 *
 * This component provides a consistent way to implement StatusBar
 * across all screens with automatic configuration based on screen name.
 */

import React from 'react';
import { StatusBar as RNStatusBar, View } from 'react-native';
import {
  useStatusBar,
  useStatusBarWithGradient,
  useCustomStatusBar,
} from '../hooks/useStatusBar';
import { StatusBarConfig } from '../utils/statusBarManager';

interface StatusBarProps {
  screenName: string;
  customConfig?: Partial<StatusBarConfig>;
  gradientColors?: string[];
  showSpacer?: boolean;
}

/**
 * Standard StatusBar component
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  screenName,
  customConfig,
  showSpacer = false,
}) => {
  const { config, statusBarSpacer } = useStatusBar(screenName, customConfig);

  return (
    <>
      <RNStatusBar
        barStyle={config.barStyle}
        backgroundColor={config.backgroundColor}
        translucent={config.translucent}
      />
      {showSpacer && config.translucent && (
        <View style={{ height: statusBarSpacer.height }} />
      )}
    </>
  );
};

/**
 * StatusBar component for gradient headers
 */
export const GradientStatusBar: React.FC<
  Omit<StatusBarProps, 'customConfig'> & {
    gradientColors: string[];
  }
> = ({ screenName, gradientColors, showSpacer = true }) => {
  const { config, statusBarSpacer } = useStatusBarWithGradient(
    screenName,
    gradientColors,
  );

  return (
    <>
      <RNStatusBar
        barStyle={config.barStyle}
        backgroundColor={config.backgroundColor}
        translucent={config.translucent}
      />
      {showSpacer && <div style={{ height: statusBarSpacer.height }} />}
    </>
  );
};

/**
 * Custom StatusBar component
 */
export const CustomStatusBar: React.FC<{
  config: StatusBarConfig;
  showSpacer?: boolean;
}> = ({ config, showSpacer = false }) => {
  const { statusBarSpacer } = useCustomStatusBar(config);

  return (
    <>
      <RNStatusBar
        barStyle={config.barStyle}
        backgroundColor={config.backgroundColor}
        translucent={config.translucent}
      />
      {showSpacer && config.translucent && (
        <View style={{ height: statusBarSpacer.height }} />
      )}
    </>
  );
};

export default StatusBar;
