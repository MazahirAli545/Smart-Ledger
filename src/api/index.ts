import axios from 'axios';
import { useState } from 'react';
import { Platform } from 'react-native';
import {
  getBaseUrl,
  checkNetworkStatus,
  isRealDevice,
} from '../config/network';
import { getBaseUrl as getEnvBaseUrl } from '../config/env';

// Development vs Production URLs - Updated to use environment variables
export const BASE_URL = getEnvBaseUrl();

// Log the BASE_URL being used for debugging
console.log('🌐 API Configuration:', {
  isDev: __DEV__,
  isRealDevice: isRealDevice(),
  BASE_URL,
  platform: Platform.OS,
});

// Test the BASE_URL connectivity
if (__DEV__) {
  fetch(`${BASE_URL}/health`)
    .then(response => {
      console.log('✅ API Health Check:', {
        url: `${BASE_URL}/health`,
        status: response.status,
        ok: response.ok,
      });
    })
    .catch(error => {
      console.error('❌ API Health Check Failed:', {
        url: `${BASE_URL}/health`,
        error: error.message,
      });
    });
}

// Enhanced network configuration with fallback
export const getDynamicBaseUrl = async (): Promise<string> => {
  return await getBaseUrl();
};

// Dynamic BASE_URL that can be updated at runtime
export let DYNAMIC_BASE_URL = BASE_URL;

export const updateBaseUrl = (newUrl: string) => {
  DYNAMIC_BASE_URL = newUrl;
  console.log('Updated BASE_URL to:', newUrl);
};

// Network status checker
export const checkApiConnectivity = async () => {
  return await checkNetworkStatus();
};

// Helper function to get consistent headers
export const getApiHeaders = () => ({
  'Content-Type': 'application/json',
});

export interface RegisterPayload {
  businessName: string;
  ownerName: string;
  mobileNumber: string;
  businessType: string;
  gstNumber?: string;
}

export async function registerUser(payload: RegisterPayload) {
  try {
    const response = await axios.post(`${BASE_URL}/user/register`, payload, {
      headers: getApiHeaders(),
    });
    console.log('Register API response:', response);
    if (response?.data?.otp) {
      console.log('Register API OTP:', response.data.otp);
    }
    return response.data;
  } catch (error: any) {
    // You can expand error handling as needed
    throw error.response?.data || error.message || 'Registration failed';
  }
}

export async function sendOtpApi(payload: RegisterPayload) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/register-init`,
      payload,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to send OTP';
  }
}

// export async function verifyOtpApi({ mobileNumber, otp }: { mobileNumber: string; otp: string }) {
//   try {
//     const response = await axios.post(`${BASE_URL}/user/verify-otp`, { mobileNumber, otp });
//     // Adjust this return value based on your backend's response structure
//     return response.data.success || response.data.verified || false;
//   } catch (error: any) {
//     throw error.response?.data || error.message || 'Failed to verify OTP';
//   }
// }
export async function verifyOtpApi({
  mobileNumber,
  otp,
}: {
  mobileNumber: string;
  otp: string;
}) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/verify-otp`,
      { mobileNumber, otp },
      {
        headers: getApiHeaders(),
      },
    );
    // Return the entire response data and let the component handle it
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to verify OTP';
  }
}

// const handleResendOtp = () => {
//   setTimer(30);
//   setOtp('');
//   setBackendOtp(null);
// };

// OTP from backend: <the_otp_value>

// const [backendOtp, setBackendOtp] = useState<string | null>(null);

// const response = await sendOtpApi(payload);
// setBackendOtp(response?.data?.otp || null);

export async function onboardingUser(payload: any) {
  try {
    const response = await axios.post(`${BASE_URL}/user/onboarding`, payload, {
      headers: getApiHeaders(),
    });
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data || error.message || 'Failed to complete onboarding'
    );
  }
}

// Login API functions
export interface LoginPayload {
  mobileNumber: string;
}

export async function loginRequestOtp(payload: LoginPayload) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/login/request-otp`,
      payload,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data || error.message || 'Failed to request login OTP'
    );
  }
}

export async function loginVerifyOtp(payload: {
  mobileNumber: string;
  otp: string;
}) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/login/verify-otp`,
      payload,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to verify login OTP';
  }
}

// Enhanced registration functions
export async function registerInit(payload: RegisterPayload) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/register-init`,
      payload,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data ||
      error.message ||
      'Failed to initialize registration'
    );
  }
}

export async function registerVerifyOtp(payload: {
  mobileNumber: string;
  otp: string;
}) {
  try {
    const response = await axios.post(
      `${BASE_URL}/user/register/verify-otp`,
      payload,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data ||
      error.message ||
      'Failed to verify registration OTP'
    );
  }
}

// User existence check function
export async function checkUserExists(mobileNumber: string) {
  try {
    const response = await axios.get(
      `${BASE_URL}/user/check-exists/${mobileNumber}`,
      {
        headers: getApiHeaders(),
      },
    );
    return response.data;
  } catch (error: any) {
    // If user doesn't exist, this will typically return 404
    throw (
      error.response?.data || error.message || 'Failed to check user existence'
    );
  }
}

// Health check function
export async function checkBackendHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, {
      headers: getApiHeaders(),
      timeout: 5000,
    });
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data || error.message || 'Backend health check failed'
    );
  }
}
