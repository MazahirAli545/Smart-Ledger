import { Platform } from 'react-native';
import {
  getBaseUrl,
  checkNetworkStatus,
  isRealDevice,
} from '../config/network';

export interface NetworkDebugInfo {
  platform: string;
  isRealDevice: boolean;
  isDevelopment: boolean;
  baseUrl: string;
  networkStatus: any;
  timestamp: string;
}

export const getNetworkDebugInfo = async (): Promise<NetworkDebugInfo> => {
  try {
    const baseUrl = await getBaseUrl();
    const networkStatus = await checkNetworkStatus();

    return {
      platform: Platform.OS,
      isRealDevice: isRealDevice(),
      isDevelopment: __DEV__,
      baseUrl,
      networkStatus,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get network debug info:', error);
    return {
      platform: Platform.OS,
      isRealDevice: isRealDevice(),
      isDevelopment: __DEV__,
      baseUrl: 'unknown',
      networkStatus: { error: error.message },
      timestamp: new Date().toISOString(),
    };
  }
};

export const logNetworkDebugInfo = async () => {
  const debugInfo = await getNetworkDebugInfo();
  console.log('🌐 Network Debug Info:', JSON.stringify(debugInfo, null, 2));
  return debugInfo;
};

export const testApiConnectivity = async () => {
  try {
    const baseUrl = await getBaseUrl();
    console.log('🧪 Testing API connectivity to:', baseUrl);

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('✅ API connectivity test successful');
      return { success: true, status: response.status };
    } else {
      console.log('❌ API connectivity test failed:', response.status);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.error('❌ API connectivity test error:', error);
    return { success: false, error: error.message };
  }
};
