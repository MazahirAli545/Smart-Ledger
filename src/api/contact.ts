import axios from 'axios';
import { BASE_URL, getApiHeaders } from './index';

export interface ContactSalesRequest {
  userName: string;
  userPhone: string;
  businessName: string;
  selectedProblem: string;
  problemDescription: string;
}

export interface ContactSalesResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    userName: string;
    userPhone: string;
    businessName: string;
    selectedProblem: string;
    status: string;
    createdAt: string;
  };
}

export async function submitContactSalesRequest(
  accessToken: string,
  request: ContactSalesRequest,
): Promise<ContactSalesResponse> {
  try {
    const response = await axios.post<ContactSalesResponse>(
      `${BASE_URL}/contact/sales`,
      request,
      {
        headers: {
          ...getApiHeaders(),
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    throw (
      error.response?.data ||
      error.message ||
      'Failed to submit contact request'
    );
  }
}
