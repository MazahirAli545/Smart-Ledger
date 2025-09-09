#!/usr/bin/env node

/**
 * Complete Customer API Test Script
 * Tests all customer endpoints with correct data structures
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://192.168.57.107:5000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with actual token

// Test data
const testCustomerData = {
  // For POST /customers (CreateCustomerDto)
  createCustomer: {
    partyName: 'Test Customer API',
    partyType: 'customer',
    phoneNumber: '+91-9876543210',
    address: 'Test Address, Test City, Test State',
    gstNumber: 'GST123456789',
    voucherType: 'payment',
  },

  // For POST /customers/add-info (AddCustomerInfoDto)
  addCustomerInfo: {
    customerId: 1, // This will be set after creating a customer
    partyName: 'Updated Test Customer',
    partyType: 'customer',
    phoneNumber: '+91-9876543210',
    address: 'Updated Test Address',
    gstNumber: 'GST987654321',
    voucherType: 'receipt',
  },

  // For PATCH /customers/:id (UpdateCustomerDto)
  updateCustomer: {
    partyName: 'Final Updated Customer',
    phoneNumber: '+91-9876543210',
    address: 'Final Updated Address',
    gstNumber: 'GST111222333',
  },
};

// Helper function to log results
function logResult(testName, success, status, data, error) {
  const emoji = success ? '✅' : '❌';
  const statusText = success ? 'PASSED' : 'FAILED';

  console.log(`\n${emoji} ${testName} - ${statusText}`);
  console.log(`   Status: ${status}`);

  if (success && data) {
    console.log(
      `   Response: ${JSON.stringify(data, null, 2).substring(0, 300)}...`,
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
      timeout: 15000,
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
  console.log('🚀 Starting Complete Customer API Test');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Token: ${TEST_TOKEN ? 'SET' : 'NOT SET'}`);

  if (!TEST_TOKEN || TEST_TOKEN === 'your_jwt_token_here') {
    console.log(
      '\n⚠️  WARNING: Please set a valid test token before running tests',
    );
    console.log('   Update TEST_TOKEN variable with a valid JWT token');
    return;
  }

  const results = [];
  let createdCustomerId = null;

  // Test 1: Health Check (no auth required)
  console.log('\n🏥 Testing Backend Health...');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000,
    });
    console.log('✅ Backend is healthy:', healthResponse.status);
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
    console.log('   Make sure your backend is running on:', BASE_URL);
    return;
  }

  // Test 2: Create Customer
  const createResult = await testEndpoint({
    name: 'POST /customers - Create Customer',
    method: 'POST',
    url: `${BASE_URL}/customers`,
    description: 'Create new customer with CreateCustomerDto',
    data: testCustomerData.createCustomer,
  });

  results.push(createResult);

  if (createResult.success && createResult.data) {
    createdCustomerId = createResult.data.id;
    console.log(`   📝 Created customer with ID: ${createdCustomerId}`);

    // Update test data for subsequent tests
    testCustomerData.addCustomerInfo.customerId = createdCustomerId;
  }

  // Test 3: Get All Customers
  const getAllResult = await testEndpoint({
    name: 'GET /customers - Get All Customers',
    method: 'GET',
    url: `${BASE_URL}/customers`,
    description: 'Fetch all customers for authenticated user',
  });

  results.push(getAllResult);

  // Test 4: Get Customers with Search
  const searchResult = await testEndpoint({
    name: 'GET /customers?search=Test - Search Customers',
    method: 'GET',
    url: `${BASE_URL}/customers?search=Test`,
    description: 'Search customers by name',
  });

  results.push(searchResult);

  if (createdCustomerId) {
    // Test 5: Get Specific Customer
    const getByIdResult = await testEndpoint({
      name: `GET /customers/${createdCustomerId} - Get Customer by ID`,
      method: 'GET',
      url: `${BASE_URL}/customers/${createdCustomerId}`,
      description: 'Fetch specific customer by ID',
    });

    results.push(getByIdResult);

    // Test 6: Add Customer Info (Update)
    const addInfoResult = await testEndpoint({
      name: 'POST /customers/add-info - Add Customer Info',
      method: 'POST',
      url: `${BASE_URL}/customers/add-info`,
      description: 'Update customer information using AddCustomerInfoDto',
      data: testCustomerData.addCustomerInfo,
    });

    results.push(addInfoResult);

    // Test 7: Update Customer
    const updateResult = await testEndpoint({
      name: `PATCH /customers/${createdCustomerId} - Update Customer`,
      method: 'PATCH',
      url: `${BASE_URL}/customers/${createdCustomerId}`,
      description: 'Update customer using UpdateCustomerDto',
      data: testCustomerData.updateCustomer,
    });

    results.push(updateResult);

    // Test 8: Get Customer with Vouchers
    const getVouchersResult = await testEndpoint({
      name: `GET /customers/${createdCustomerId}/vouchers - Get Customer Vouchers`,
      method: 'GET',
      url: `${BASE_URL}/customers/${createdCustomerId}/vouchers`,
      description: 'Fetch customer with related vouchers',
    });

    results.push(getVouchersResult);

    // Test 9: Debug Customer
    const debugResult = await testEndpoint({
      name: `GET /customers/debug/customer/${createdCustomerId} - Debug Customer`,
      method: 'GET',
      url: `${BASE_URL}/customers/debug/customer/${createdCustomerId}`,
      description: 'Debug endpoint for customer information',
    });

    results.push(debugResult);

    // Test 10: Delete Customer (Cleanup)
    const deleteResult = await testEndpoint({
      name: `DELETE /customers/${createdCustomerId} - Delete Customer`,
      method: 'DELETE',
      url: `${BASE_URL}/customers/${createdCustomerId}`,
      description: 'Delete customer (cleanup)',
    });

    results.push(deleteResult);
  }

  // Test 11: Debug All Customers
  const debugAllResult = await testEndpoint({
    name: 'GET /customers/debug/all-customers - Debug All Customers',
    method: 'GET',
    url: `${BASE_URL}/customers/debug/all-customers`,
    description: 'Debug endpoint for all customers',
  });

  results.push(debugAllResult);

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
        console.log(`   ${index + 1}. ${result.status || 'NO_RESPONSE'}`);
      }
    });
  }

  if (passed === total) {
    console.log(
      '\n🎉 All tests passed! Your Customer API is working correctly.',
    );
  } else {
    console.log('\n🔧 Some tests failed. Check the error messages above.');
  }

  // Data Structure Summary
  console.log('\n📋 API Data Structure Summary');
  console.log('==============================');
  console.log('✅ POST /customers (CreateCustomerDto):');
  console.log('   - partyName: required');
  console.log(
    '   - partyType, phoneNumber, address, gstNumber, voucherType: optional',
  );
  console.log('   - NO customerId, NO openingBalance, NO attachedDocument');

  console.log('\n✅ POST /customers/add-info (AddCustomerInfoDto):');
  console.log('   - customerId: required');
  console.log('   - partyName: required');
  console.log(
    '   - partyType, phoneNumber, address, gstNumber, voucherType: optional',
  );
  console.log('   - NO openingBalance, NO attachedDocument');

  console.log('\n✅ PATCH /customers/:id (UpdateCustomerDto):');
  console.log('   - All fields optional');
  console.log('   - NO customerId, NO openingBalance, NO attachedDocument');
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test runner error:', error.message);
  process.exit(1);
});
