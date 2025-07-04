import axios from 'axios';
import { useState } from 'react';

export const BASE_URL = 'https://utility-apis.vercel.app';

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

export async function sendOtpApi(payload: RegisterPayload) {
  try {
    const response = await axios.post(`${BASE_URL}/user/register-init`, payload);
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
export async function verifyOtpApi({ mobileNumber, otp }: { mobileNumber: string; otp: string }) {
  try {
    const response = await axios.post(`${BASE_URL}/user/verify-otp`, { mobileNumber, otp });
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
    const response = await axios.post(`${BASE_URL}/user/onboarding`, payload);
    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message || 'Failed to complete onboarding';
  }
} 