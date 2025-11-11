import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  tip?: string;
  backgroundColor?: string;
  gradientColors?: string[];
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  title = 'Loading...',
  subtitle = 'Please wait while we prepare your data...',
  icon = 'loading',
  tip = 'Tip: Keep your data updated for better insights',
  backgroundColor = '#f6fafc',
  gradientColors = ['#4f8cff', '#1ecb81'],
}) => {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim1 = useRef(new Animated.Value(1)).current;
  const dotAnim2 = useRef(new Animated.Value(1)).current;
  const dotAnim3 = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );

    // Dot animations with staggered timing
    const dotAnimation1 = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim1, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim1, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    const dotAnimation2 = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(dotAnim2, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim2, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    const dotAnimation3 = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(dotAnim3, {
          toValue: 1.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim3, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();
    dotAnimation1.start();
    dotAnimation2.start();
    dotAnimation3.start();

    return () => {
      pulseAnimation.stop();
      dotAnimation1.stop();
      dotAnimation2.stop();
      dotAnimation3.stop();
    };
  }, [pulseAnim, dotAnim1, dotAnim2, dotAnim3, fadeAnim]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor }]}
      edges={['top']}
    >
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Animated Icon Container */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={icon as any}
            size={80}
            color={gradientColors[0]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.2],
                  outputRange: [0.3, 0.1],
                }),
                borderColor: gradientColors[0],
                backgroundColor: `${gradientColors[0]}20`,
              },
            ]}
          />
        </View>

        {/* Loading Text */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Animated Progress Dots */}
        <View style={styles.progressDots}>
          <Animated.View
            style={[
              styles.dot,
              styles.dotActive,
              {
                transform: [{ scale: dotAnim1 }],
                backgroundColor: gradientColors[0],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              styles.dotInactive,
              {
                transform: [{ scale: dotAnim2 }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              styles.dotInactive,
              {
                transform: [{ scale: dotAnim3 }],
              },
            ]}
          />
        </View>

        {/* Loading Tip */}
        {tip && (
          <View style={styles.tipContainer}>
            <MaterialCommunityIcons
              name="lightbulb-outline"
              size={16}
              color="#666"
            />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  pulseRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    borderWidth: 2,
  },
  title: {
    fontSize: 24,
    color: '#222',
    marginBottom: 8,
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,

    fontFamily: 'Roboto-Medium',
  },

  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  dotActive: {
    transform: [{ scale: 1.2 }],
  },
  dotInactive: {
    backgroundColor: '#e0e0e0',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,

    fontFamily: 'Roboto-Medium',
  },
});

export default LoadingScreen;
