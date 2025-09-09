/**
 * API Test Helper for React Native App
 * Use this to test API endpoints directly from your app
 */

import axios from 'axios';
import { BASE_URL } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface APITestResult {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  endpoint: string;
  method: string;
}

export class APITestHelper {
  private static async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('accessToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Test GET /customers endpoint (CustomerScreen)
   */
  static async testGetCustomers(): Promise<APITestResult> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No auth token found',
          endpoint: 'GET /customers',
          method: 'GET',
        };
      }

      console.log('🧪 Testing GET /customers...');
      const response = await axios.get(`${BASE_URL}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      console.log('✅ GET /customers successful:', response.status);
      return {
        success: true,
        status: response.status,
        data: response.data,
        endpoint: 'GET /customers',
        method: 'GET',
      };
    } catch (error: any) {
      const status = error.response?.status || 'NO_RESPONSE';
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error';

      console.error('❌ GET /customers failed:', status, errorMessage);
      return {
        success: false,
        status: status === 'NO_RESPONSE' ? undefined : status,
        error: errorMessage,
        endpoint: 'GET /customers',
        method: 'GET',
      };
    }
  }

  /**
   * Test POST /customers/add-info endpoint (AddPartyScreen create)
   */
  static async testCreateCustomer(): Promise<APITestResult> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No auth token found',
          endpoint: 'POST /customers/add-info',
          method: 'POST',
        };
      }

      const testData = {
        userId: 1, // This should be the actual user ID from token
        partyName: 'API Test Customer',
        phoneNumber: '+91-9876543210',
        openingBalance: 1000,
        partyType: 'customer',
        gstNumber: null,
        address: 'Test Address for API Testing',
        voucherType: 'payment',
      };

      console.log('🧪 Testing POST /customers/add-info...');
      const response = await axios.post(
        `${BASE_URL}/customers/add-info`,
        testData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      console.log('✅ POST /customers/add-info successful:', response.status);
      return {
        success: true,
        status: response.status,
        data: response.data,
        endpoint: 'POST /customers/add-info',
        method: 'POST',
      };
    } catch (error: any) {
      const status = error.response?.status || 'NO_RESPONSE';
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error';

      console.error(
        '❌ POST /customers/add-info failed:',
        status,
        errorMessage,
      );
      return {
        success: false,
        status: status === 'NO_RESPONSE' ? undefined : status,
        error: errorMessage,
        endpoint: 'POST /customers/add-info',
        method: 'POST',
      };
    }
  }

  /**
   * Test all endpoints and return summary
   */
  static async testAllEndpoints(): Promise<{
    results: APITestResult[];
    summary: {
      total: number;
      passed: number;
      failed: number;
      successRate: number;
    };
  }> {
    console.log('🚀 Starting API Endpoints Test from React Native App');
    console.log('==================================================');
    console.log(`Base URL: ${BASE_URL}`);

    const results: APITestResult[] = [];

    // Test GET /customers
    const getResult = await this.testGetCustomers();
    results.push(getResult);

    // Test POST /customers/add-info
    const postResult = await this.testCreateCustomer();
    results.push(postResult);

    // Calculate summary
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = total - passed;
    const successRate = (passed / total) * 100;

    const summary = { total, passed, failed, successRate };

    // Log summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results.forEach((result, index) => {
        if (!result.success) {
          console.log(
            `   ${index + 1}. ${result.endpoint} - ${
              result.status || 'NO_RESPONSE'
            }`,
          );
          console.log(`      Error: ${result.error}`);
        }
      });
    }

    if (passed === total) {
      console.log(
        '\n🎉 All tests passed! Your API endpoints are working correctly.',
      );
    } else {
      console.log('\n🔧 Some tests failed. Check the error messages above.');
    }

    return { results, summary };
  }

  /**
   * Quick health check - just test if server is reachable
   */
  static async healthCheck(): Promise<boolean> {
    try {
      console.log('🏥 Performing API health check...');
      const response = await axios.get(`${BASE_URL}/health`, {
        timeout: 5000,
      });

      console.log('✅ Health check passed:', response.status);
      return true;
    } catch (error: any) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  }
}

export default APITestHelper;
