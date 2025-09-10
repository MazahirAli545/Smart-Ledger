/**
 * Environment Configuration Utility
 *
 * This file handles loading environment variables from .env file
 * and provides type-safe access to configuration values.
 *
 * IMPORTANT: Never commit .env file to version control
 */

import { Platform } from 'react-native';

// Environment variables interface
interface EnvConfig {
  // API Configuration
  BASE_URL_DEV: string;
  BASE_URL_PROD: string;

  // Google Cloud Services
  GOOGLE_PROJECT_ID: string;
  GOOGLE_PRIVATE_KEY_ID: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_AUTH_URI: string;
  GOOGLE_TOKEN_URI: string;
  GOOGLE_AUTH_PROVIDER_X509_CERT_URL: string;
  GOOGLE_CLIENT_X509_CERT_URL: string;
  GOOGLE_UNIVERSE_DOMAIN: string;

  // Firebase Configuration
  FIREBASE_PROJECT_NUMBER: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_MOBILE_SDK_APP_ID: string;
  FIREBASE_PACKAGE_NAME: string;
  FIREBASE_API_KEY: string;

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;

  // OpenAI API
  OPENAI_API_KEY: string;

  // External API URLs
  OPENAI_API_URL: string;
  RAZORPAY_API_URL: string;

  // App Configuration
  APP_NAME: string;
  APP_VERSION: string;
  APP_ENVIRONMENT: string;

  // Security Configuration
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
}

// Default values (fallbacks)
const defaultConfig: EnvConfig = {
  // API Configuration
  BASE_URL_DEV: 'http://192.168.57.107:5000',
  BASE_URL_PROD: 'https://utility-apis-49wa.onrender.com',

  // Google Cloud Services
  GOOGLE_PROJECT_ID: '',
  GOOGLE_PRIVATE_KEY_ID: '',
  GOOGLE_PRIVATE_KEY: '',
  GOOGLE_CLIENT_EMAIL: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
  GOOGLE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
  GOOGLE_AUTH_PROVIDER_X509_CERT_URL:
    'https://www.googleapis.com/oauth2/v1/certs',
  GOOGLE_CLIENT_X509_CERT_URL: '',
  GOOGLE_UNIVERSE_DOMAIN: 'googleapis.com',

  // Firebase Configuration
  FIREBASE_PROJECT_NUMBER: '',
  FIREBASE_PROJECT_ID: '',
  FIREBASE_STORAGE_BUCKET: '',
  FIREBASE_MOBILE_SDK_APP_ID: '',
  FIREBASE_PACKAGE_NAME: 'com.utilsapp',
  FIREBASE_API_KEY: '',

  // Razorpay Payment Gateway
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',

  // OpenAI API
  OPENAI_API_KEY: '',

  // External API URLs
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  RAZORPAY_API_URL: 'https://api.razorpay.com/v1/orders',

  // App Configuration
  APP_NAME: 'Smart Ledger',
  APP_VERSION: '1.0.0',
  APP_ENVIRONMENT: 'development',

  // Security Configuration
  JWT_SECRET: '',
  ENCRYPTION_KEY: '',
};

// Load environment variables
const loadEnvConfig = (): EnvConfig => {
  const config: EnvConfig = { ...defaultConfig };

  // In React Native, we need to use a different approach for environment variables
  // For now, we'll use the default values and expect them to be set via build configuration
  // In a real implementation, you would use react-native-config or similar library

  return config;
};

// Export the configuration
export const envConfig = loadEnvConfig();

// Helper functions
export const getBaseUrl = (): string => {
  const isDev = __DEV__ && Platform.OS !== 'ios'; // Adjust based on your needs
  return isDev ? envConfig.BASE_URL_DEV : envConfig.BASE_URL_PROD;
};

export const getGoogleCloudConfig = () => ({
  type: 'service_account',
  project_id: envConfig.GOOGLE_PROJECT_ID,
  private_key_id: envConfig.GOOGLE_PRIVATE_KEY_ID,
  private_key: envConfig.GOOGLE_PRIVATE_KEY,
  client_email: envConfig.GOOGLE_CLIENT_EMAIL,
  client_id: envConfig.GOOGLE_CLIENT_ID,
  auth_uri: envConfig.GOOGLE_AUTH_URI,
  token_uri: envConfig.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: envConfig.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: envConfig.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: envConfig.GOOGLE_UNIVERSE_DOMAIN,
});

export const getFirebaseConfig = () => ({
  project_info: {
    project_number: envConfig.FIREBASE_PROJECT_NUMBER,
    project_id: envConfig.FIREBASE_PROJECT_ID,
    storage_bucket: envConfig.FIREBASE_STORAGE_BUCKET,
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: envConfig.FIREBASE_MOBILE_SDK_APP_ID,
        android_client_info: {
          package_name: envConfig.FIREBASE_PACKAGE_NAME,
        },
      },
      oauth_client: [],
      api_key: [
        {
          current_key: envConfig.FIREBASE_API_KEY,
        },
      ],
      services: {
        appinvite_service: {
          other_platform_oauth_client: [],
        },
      },
    },
  ],
  configuration_version: '1',
});

export const getRazorpayConfig = () => ({
  key: envConfig.RAZORPAY_KEY_ID,
  secret: envConfig.RAZORPAY_KEY_SECRET,
});

// Validation function
export const validateConfig = (): {
  isValid: boolean;
  missingKeys: string[];
} => {
  const missingKeys: string[] = [];

  // Check required keys
  const requiredKeys: (keyof EnvConfig)[] = [
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_API_KEY',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
  ];

  requiredKeys.forEach(key => {
    if (!envConfig[key] || envConfig[key] === '') {
      missingKeys.push(key);
    }
  });

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
};

// Log configuration status (only in development)
if (__DEV__) {
  const validation = validateConfig();
  if (!validation.isValid) {
    console.warn('⚠️ Missing environment variables:', validation.missingKeys);
    console.warn('Please check your .env file configuration');
  } else {
    console.log('✅ Environment configuration loaded successfully');
  }
}
