import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outlined' | 'gradient';
  showIcon?: boolean;
  text?: string;
  onPress?: () => void;
  disabled?: boolean;
  navigation?: any; // Add navigation prop for drawer context
}

const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  size = 'medium',
  variant = 'default',
  showIcon = true,
  text = 'Premium',
  onPress,
  disabled = false,
  navigation: propNavigation,
}) => {
  const defaultNavigation =
    useNavigation<StackNavigationProp<RootStackParamList>>();
  const navigation = propNavigation || defaultNavigation;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Check if we're in drawer context (has closeDrawer method)
      if (navigation.closeDrawer) {
        // Drawer context - use drawer navigation
        navigation.closeDrawer();
        setTimeout(() => {
          navigation.navigate('AppStack', {
            screen: 'SubscriptionPlan',
          });
        }, 250);
      } else {
        // Regular context - use root navigation
        navigation.navigate('App', {
          screen: 'SubscriptionPlan',
        });
      }
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 8,
          fontSize: 10,
          iconSize: 12,
        };
      case 'large':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          fontSize: 14,
          iconSize: 16,
        };
      default: // medium
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          fontSize: 12,
          iconSize: 14,
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: '#FF7043',
          textColor: '#FF7043',
          iconColor: '#FF7043',
        };
      case 'gradient':
        return {
          backgroundColor: '#FF7043',
          borderWidth: 0,
          textColor: '#fff',
          iconColor: '#fff',
        };
      default:
        return {
          backgroundColor: '#FF7043',
          borderWidth: 0,
          textColor: '#fff',
          iconColor: '#fff',
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: sizeStyles.borderRadius,
          backgroundColor: variantStyles.backgroundColor,
          borderWidth: variantStyles.borderWidth,
          borderColor: variantStyles.borderColor,
        },
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
    >
      {showIcon && (
        <MaterialCommunityIcons
          name="crown"
          size={sizeStyles.iconSize}
          color={variantStyles.iconColor}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            fontSize: sizeStyles.fontSize,
            color: variantStyles.textColor,
          },
          disabled && styles.disabledText,
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default PremiumBadge;
