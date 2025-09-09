#!/usr/bin/env node

/**
 * API Endpoints Test Script
 * This script tests all the API endpoints used in CustomerScreen and AddPartyScreen
 * Run this to verify your backend is working correctly
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://192.168.57.107:5000'; // Your development server
const TEST_TOKEN = 'your_test_token_here'; // Replace with actual token

// Test endpoints
const endpoints = [
  {
    name: 'GET /customers',
    method: 'GET',
    url: `${BASE_URL}/customers`,
    description: 'Fetch all customers (CustomerScreen)',
  },
  {
    name: 'POST /customers/add-info',
    method: 'POST',
    url: `${BASE_URL}/customers/add-info`,
    description: 'Create new customer (AddPartyScreen)',
    data: {
      userId: 1,
      partyName: 'Test Customer',
      phoneNumber: '+91-9876543210',
      openingBalance: 1000,
      partyType: 'customer',
      gstNumber: null,
      address: 'Test Address, Test City, Test State',
      voucherType: 'payment',
    },
  },
  {
    name: 'GET /customers/1',
    method: 'GET',
    url: `${BASE_URL}/customers/1`,
    description: 'Fetch specific customer by ID',
  },
  {
    name: 'PATCH /customers/1',
    method: 'PATCH',
    url: `${BASE_URL}/customers/1`,
    description: 'Update customer (AddPartyScreen edit mode)',
    data: {
      userId: 1,
      partyName: 'Updated Test Customer',
      phoneNumber: '+91-9876543210',
      openingBalance: 1500,
      partyType: 'customer',
      gstNumber: null,
      address: 'Updated Test Address, Test City, Test State',
      voucherType: 'payment',
    },
  },
  {
    name: 'DELETE /customers/1',
    method: 'DELETE',
    url: `${BASE_URL}/customers/1`,
    description: 'Delete customer (AddPartyScreen delete)',
  },
];

// Helper function to log results
function logResult(testName, success, status, data, error) {
  const emoji = success ? '✅' : '❌';
  const statusText = success ? 'PASSED' : 'FAILED';

  console.log(`\n${emoji} ${testName} - ${statusText}`);
  console.log(`   Status: ${status}`);

  if (success && data) {
    console.log(
      `   Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`,
    );
  }

  if (!success && error) {
    console.log(`   Error: ${error.message || error}`);
  }
}

// Test function
async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    console.log(`   Method: ${endpoint.method}`);
    console.log(`   Description: ${endpoint.description}`);

    const config = {
      method: endpoint.method.toLowerCase(),
      url: endpoint.url,
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    if (endpoint.data) {
      config.data = endpoint.data;
      console.log(`   Data: ${JSON.stringify(endpoint.data, null, 2)}`);
    }

    const response = await axios(config);

    logResult(endpoint.name, true, response.status, response.data);
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    const status = error.response?.status || 'NO_RESPONSE';
    const errorMessage =
      error.response?.data?.message || error.message || 'Unknown error';

    logResult(endpoint.name, false, status, null, errorMessage);
    return { success: false, status, error: errorMessage };
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Endpoints Test');
  console.log('================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Token: ${TEST_TOKEN ? 'SET' : 'NOT SET'}`);

  if (!TEST_TOKEN || TEST_TOKEN === 'your_test_token_here') {
    console.log(
      '\n⚠️  WARNING: Please set a valid test token before running tests',
    );
    console.log('   Update TEST_TOKEN variable with a valid JWT token');
    return;
  }

  const results = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);

    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.forEach((result, index) => {
      if (!result.success) {
        console.log(
          `   ${index + 1}. ${endpoints[index].name} - ${result.status}`,
        );
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
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test runner error:', error.message);
  process.exit(1);
});
