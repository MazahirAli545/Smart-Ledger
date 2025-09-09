import { Platform } from 'react-native';

// Network Configuration
export const NETWORK_CONFIG = {
  // Development URLs
  development: {
    local: 'http://192.168.57.107:5000',
    fallback: 'https://utility-apis-49wa.onrender.com',
    // Add real device fallback
    realDevice: 'https://utility-apis-49wa.onrender.com',
  },
  // Production URLs
  production: {
    primary: 'https://utility-apis-49wa.onrender.com',
    backup: 'https://utility-apis-49wa.onrender.com', // Same for now
  },
};

// Check if running on real device vs emulator
export const isRealDevice = (): boolean => {
  // Simple check - emulators typically have specific hostnames
  return !__DEV__ || Platform.OS === 'ios' || Platform.OS === 'android';
};

// Get the appropriate base URL based on environment and device type
export const getBaseUrl = async (): Promise<string> => {
  if (__DEV__) {
    // Check if we're on a real device
    if (isRealDevice()) {
      console.log('📱 Real device detected, using production backend');
      return NETWORK_CONFIG.development.realDevice;
    }

    try {
      // Test local backend connectivity (only for emulator/development)
      const testResponse = await fetch(
        `${NETWORK_CONFIG.development.local}/health`,
        {
          method: 'GET',
        },
      );

      if (testResponse.ok) {
        console.log('✅ Local backend accessible');
        return NETWORK_CONFIG.development.local;
      }
    } catch (error) {
      console.warn(
        '⚠️ Local backend not accessible, falling back to production',
      );
    }

    // Fallback to production in development
    return NETWORK_CONFIG.development.fallback;
  }

  // Production environment
  return NETWORK_CONFIG.production.primary;
};

// Network status checker
export const checkNetworkStatus = async (): Promise<{
  isOnline: boolean;
  localBackend: boolean;
  productionBackend: boolean;
  recommendedUrl: string;
}> => {
  const results = {
    isOnline: false,
    localBackend: false,
    productionBackend: false,
    recommendedUrl: '',
  };

  try {
    // Check local backend
    try {
      const localResponse = await fetch(
        `${NETWORK_CONFIG.development.local}/health`,
        {
          method: 'GET',
        },
      );
      results.localBackend = localResponse.ok;
    } catch (error) {
      results.localBackend = false;
    }

    // Check production backend
    try {
      const productionResponse = await fetch(
        `${NETWORK_CONFIG.production.primary}/health`,
        {
          method: 'GET',
        },
      );
      results.productionBackend = productionResponse.ok;
    } catch (error) {
      results.productionBackend = false;
    }

    // Determine recommended URL
    if (__DEV__ && results.localBackend) {
      results.recommendedUrl = NETWORK_CONFIG.development.local;
    } else if (results.productionBackend) {
      results.recommendedUrl = NETWORK_CONFIG.production.primary;
    } else {
      results.recommendedUrl = NETWORK_CONFIG.development.fallback;
    }

    results.isOnline = results.localBackend || results.productionBackend;
  } catch (error) {
    console.error('Network status check failed:', error);
  }

  return results;
};

// Platform-specific network settings
export const getPlatformNetworkConfig = () => {
  if (Platform.OS === 'android') {
    return {
      timeout: 10000, // Android needs longer timeout
      retryAttempts: 3,
    };
  } else if (Platform.OS === 'ios') {
    return {
      timeout: 8000, // iOS can be faster
      retryAttempts: 2,
    };
  }

  return {
    timeout: 8000,
    retryAttempts: 2,
  };
};
