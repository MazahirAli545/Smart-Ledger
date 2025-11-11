import { Platform } from 'react-native';

// Network Configuration
export const NETWORK_CONFIG = {
  // Development URLs
  development: {
    local: 'http://10.0.2.2:3001',
    fallback: 'https://u-api-wby7.onrender.com',
    // Add real device fallback
    realDevice: 'http://10.0.2.2:3001',
  },
  // Production URLs
  production: {
    primary: 'https://u-api-wby7.onrender.com',
    backup: 'https://u-api-wby7.onrender.com', // Same for now
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
    // For development, use 10.0.2.2:3001 (Android emulator)
    console.log(
      '🔧 Development mode: Using 10.0.2.2:3001 for Android emulator development',
    );
    return NETWORK_CONFIG.development.local;

    // Fallback to production if local server is not available
    // try {
    //   // Test local backend connectivity
    //   const testResponse = await fetch(
    //     `${NETWORK_CONFIG.development.local}/health`,
    //     {
    //       method: 'GET',
    //       timeout: 3000, // Add timeout
    //     },
    //   );

    //   if (testResponse.ok) {
    //     console.log('✅ Local backend accessible');
    //     return NETWORK_CONFIG.development.local;
    //   }
    // } catch (error) {
    //   console.warn(
    //     '⚠️ Local backend not accessible, falling back to production',
    //   );
    //   return NETWORK_CONFIG.development.fallback;
    // }
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
