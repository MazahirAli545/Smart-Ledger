import axios from 'axios';
import { Platform } from 'react-native';
import {
  getBaseUrl,
  checkNetworkStatus,
  isRealDevice,
} from '../config/network';
import { getBaseUrl as getEnvBaseUrl } from '../config/env';
import { getUserIdFromToken } from '../utils/storage';

// Development vs Production URLs - Updated to use environment variables
export const BASE_URL = getEnvBaseUrl();

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
    const response = await axios.post(`${BASE_URL}/user/register`, payload);
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

// Deprecated - Use sendOtp from auth endpoints instead
export async function sendOtpApi() {
  throw new Error('Use /auth/send-otp');
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

// Deprecated - Use verifyOtp from auth endpoints instead
export async function verifyOtpApi() {
  throw new Error('Use /auth/verify-otp');
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

// Deprecated - Onboarding endpoint is not available
export async function onboardingUser() {
  throw new Error('Onboarding endpoint is not available');
}

// Login API functions
export interface LoginPayload {
  mobileNumber: string;
}

export async function loginRequestOtp(payload: { phone: string }) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/send-otp`, payload, {
      headers: getApiHeaders(),
    });
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data || error.message || 'Failed to request login OTP'
    );
  }
}

export async function loginVerifyOtp(payload: { phone: string; otp: string }) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/verify-otp`, payload, {
      headers: getApiHeaders(),
    });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to verify login OTP';
  }
}

// Enhanced registration functions
export async function registerInit() {
  throw new Error('Use /auth/send-otp');
}

export async function registerVerifyOtp() {
  throw new Error('Use /auth/verify-otp');
}

// User existence check function
export async function checkUserExists() {
  throw new Error('User existence check endpoint is not available');
}

// Health check function
export async function checkBackendHealth() {
  return null;
}

// ========================================
// USER PROFILE
// ========================================
export interface UserProfileResponse {
  id: number;
  name?: string;
  mobileNumber?: string;
  email?: string | null;
  [key: string]: any;
}

// Update profile payload (all fields optional)
export interface UpdateUserProfilePayload {
  businessName?: string;
  ownerName?: string;
  businessType?: string;
  gstNumber?: string;
  businessSize?: string;
  industry?: string;
  monthlyTransactionVolume?: string;
  currentAccountingSoftware?: string;
  teamSize?: string;
  preferredLanguage?: string;
  features?: string[];
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  CAAccountID?: string;
  primaryGoal?: string;
  currentChallenges?: string;
}

export async function getCurrentUser(accessToken: string) {
  try {
    const response = await axios.get<UserProfileResponse>(
      `${BASE_URL}/users/profile`,
      {
        headers: {
          ...getApiHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to fetch profile';
  }
}

export async function updateCurrentUser(
  accessToken: string,
  payload: UpdateUserProfilePayload,
) {
  try {
    // Get user ID from token
    const userId = await getUserIdFromToken();
    if (!userId) {
      throw new Error('User ID not found in token');
    }

    const response = await axios.patch(`${BASE_URL}/users/${userId}`, payload, {
      headers: {
        ...getApiHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to update profile';
  }
}

// ========================================
// AUTHENTICATION ENDPOINTS (Postman Collection Match)
// ========================================

// 1. Send OTP - POST /auth/send-otp
export interface SendOtpPayload {
  phone: string;
}

export async function sendOtp(payload: SendOtpPayload) {
  try {
    console.log('📱 Sending OTP to:', payload.phone);
    const response = await axios.post(`${BASE_URL}/auth/send-otp`, payload, {
      headers: getApiHeaders(),
    });
    console.log('✅ OTP sent successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Send OTP error:', error);
    throw error.response?.data || error.message || 'Failed to send OTP';
  }
}

// 2. Verify OTP - POST /auth/verify-otp
export interface VerifyOtpPayload {
  phone: string;
  otp: string;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  try {
    console.log('🔐 Verifying OTP for:', payload.phone);
    console.log('🔐 OTP being sent:', payload.otp);
    console.log('🔐 Full payload:', payload);
    console.log('🔐 Endpoint URL:', `${BASE_URL}/auth/verify-otp`);

    const response = await axios.post(`${BASE_URL}/auth/verify-otp`, payload, {
      headers: getApiHeaders(),
    });

    console.log('✅ OTP verification response status:', response.status);
    console.log('✅ OTP verification response data:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Verify OTP error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      payload: payload,
    });
    throw error.response?.data || error.message || 'Failed to verify OTP';
  }
}

// 3. SMS Status - GET /auth/sms-status
export async function getSmsStatus() {
  try {
    console.log('📊 Checking SMS status');
    const response = await axios.get(`${BASE_URL}/auth/sms-status`, {
      headers: getApiHeaders(),
    });
    console.log('✅ SMS status retrieved:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Get SMS status error:', error);
    throw error.response?.data || error.message || 'Failed to get SMS status';
  }
}

// ========================================
// EXPORT ALL API MODULES
// ========================================

// Re-export customer APIs
export * from './customers';

// Re-export transaction APIs
export * from './transactions';

// Re-export report APIs
export * from './reports';

// Re-export RBAC APIs
export * from './rbac';

// Re-export payment APIs
export * from './payments';

// Re-export supplier APIs
export * from './suppliers';

// Re-export contact APIs
export * from './contact';

// ========================================
// UNIFIED API SERVICE (RECOMMENDED)
// ========================================

// Export unified API service - Use this for all new API calls
export { unifiedApi, default as unifiedApiService } from './unifiedApiService';
export type { RequestOptions, ApiResponse } from './unifiedApiService';

// ========================================
// ADDITIONAL EXPORTS FOR MISSING APIs
// ========================================

// Export new transaction functions
export {
  deleteTransactionById,
  fetchTransactionsByCustomerId,
} from './transactions';

// Export new report functions
export {
  createNewReport,
  fetchAllReports,
  fetchReportById,
  generateReport,
  exportReportCSV,
  exportReportPDF,
  deleteReport,
  fetchCustomerLedger,
  fetchSupplierLedger,
} from './reports';

// Export updated customer function
export { fetchCustomersOnly } from './customers';
