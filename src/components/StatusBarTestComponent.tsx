/**
 * StatusBar Test Component
 *
 * This component can be temporarily added to any screen to test StatusBar behavior
 * and verify that the colors are working correctly.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useCustomStatusBar } from '../hooks/useStatusBar';

interface StatusBarTestComponentProps {
  screenName?: string;
  backgroundColor?: string;
  barStyle?: 'light-content' | 'dark-content';
  translucent?: boolean;
}

const StatusBarTestComponent: React.FC<StatusBarTestComponentProps> = ({
  screenName = 'TestScreen',
  backgroundColor = '#4f8cff',
  barStyle = 'light-content',
  translucent = false,
}) => {
  // Apply custom StatusBar configuration
  const { statusBarSpacer } = useCustomStatusBar({
    backgroundColor,
    barStyle,
    translucent,
  });

  useEffect(() => {
    console.log(`🧪 StatusBar Test Component mounted for ${screenName}`);
    console.log(`🎨 Applied config:`, {
      backgroundColor,
      barStyle,
      translucent,
    });
  }, [screenName, backgroundColor, barStyle, translucent]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={backgroundColor}
        barStyle={barStyle}
        translucent={translucent}
      />
      <View style={[styles.testCard, { backgroundColor }]}>
        <Text
          style={[
            styles.testTitle,
            { color: barStyle === 'light-content' ? '#fff' : '#000' },
          ]}
        >
          StatusBar Test
        </Text>
        <Text
          style={[
            styles.testSubtitle,
            {
              color:
                barStyle === 'light-content'
                  ? 'rgba(255,255,255,0.8)'
                  : 'rgba(0,0,0,0.6)',
            },
          ]}
        >
          Screen: {screenName}
        </Text>
        <Text
          style={[
            styles.testDetails,
            {
              color:
                barStyle === 'light-content'
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(0,0,0,0.5)',
            },
          ]}
        >
          Background: {backgroundColor}
        </Text>
        <Text
          style={[
            styles.testDetails,
            {
              color:
                barStyle === 'light-content'
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(0,0,0,0.5)',
            },
          ]}
        >
          Bar Style: {barStyle}
        </Text>
        <Text
          style={[
            styles.testDetails,
            {
              color:
                barStyle === 'light-content'
                  ? 'rgba(255,255,255,0.7)'
                  : 'rgba(0,0,0,0.5)',
            },
          ]}
        >
          Translucent: {translucent ? 'Yes' : 'No'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  testCard: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  testSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  testDetails: {
    fontSize: 12,
    marginBottom: 2,
  },
});

export default StatusBarTestComponent;
