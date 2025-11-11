import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface StableStatusBarProps {
  backgroundColor?: string;
  barStyle?: 'light-content' | 'dark-content';
  translucent?: boolean;
  animated?: boolean;
}

const StableStatusBar: React.FC<StableStatusBarProps> = ({
  backgroundColor = '#4f8cff',
  barStyle = 'light-content',
  translucent = false,
  animated = true,
}) => {
  // Force status bar settings on mount with delay to ensure it applies
  useEffect(() => {
    const applyStatusBarSettings = () => {
      if (Platform.OS === 'android') {
        // Force non-translucent first
        StatusBar.setTranslucent(false);
        // Set background color with animation disabled for immediate effect
        StatusBar.setBackgroundColor(backgroundColor, false);
        // Ensure status bar is visible
        StatusBar.setHidden(false, 'none');
      }
      // Set bar style (text color)
      StatusBar.setBarStyle(barStyle, false);
    };

    // Apply immediately
    applyStatusBarSettings();

    // Apply again after a short delay to ensure it sticks
    const timeoutId = setTimeout(applyStatusBarSettings, 100);

    return () => clearTimeout(timeoutId);
  }, [backgroundColor, barStyle]);

  // Apply status bar settings when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const applyStatusBarSettings = () => {
        if (Platform.OS === 'android') {
          StatusBar.setTranslucent(false);
          StatusBar.setBackgroundColor(backgroundColor, false);
          StatusBar.setHidden(false, 'none');
        }
        StatusBar.setBarStyle(barStyle, false);
      };

      // Apply immediately
      applyStatusBarSettings();

      // Apply again after a short delay
      const timeoutId = setTimeout(applyStatusBarSettings, 50);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [backgroundColor, barStyle]),
  );

  return (
    <StatusBar
      backgroundColor={Platform.OS === 'android' ? backgroundColor : undefined}
      barStyle={barStyle}
      translucent={false}
      animated={false}
    />
  );
};

export default StableStatusBar;
