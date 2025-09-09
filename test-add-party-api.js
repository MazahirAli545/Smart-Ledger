#!/usr/bin/env node

/**
 * Test AddPartyScreen API Endpoints
 * This script tests the API endpoints used in AddPartyScreen
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://192.168.57.107:5000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with actual token

// Test data
const testPartyData = {
  partyName: 'Test Party API',
  partyType: 'customer',
  phoneNumber: '+91-9876543210',
  address: 'Test Address, Test City, Test State',
  gstNumber: 'GST123456789',
  voucherType: 'payment',
};

async function testAPIEndpoints() {
  console.log('🧪 Testing AddPartyScreen API Endpoints');
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

  try {
    // Test 1: Health Check
    console.log('\n🏥 Testing Backend Health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000,
    });
    console.log('✅ Backend is healthy:', healthResponse.status);

    // Test 2: Create Basic Customer
    console.log('\n➕ Testing POST /customers (Create Basic Customer)...');
    const createResponse = await axios.post(
      `${BASE_URL}/customers`,
      testPartyData,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    console.log(
      '✅ Basic customer created:',
      createResponse.status,
      createResponse.data,
    );

    // Test 3: Get Customer ID
    const customerId = createResponse.data.id;
    if (!customerId) {
      throw new Error('Failed to get customer ID from creation response');
    }
    console.log(`📝 Created customer with ID: ${customerId}`);

    // Test 4: Update Customer Info
    console.log(
      '\n📝 Testing POST /customers/add-info (Update Customer Info)...',
    );
    const updatePayload = {
      customerId: customerId,
      ...testPartyData,
    };

    const updateResponse = await axios.post(
      `${BASE_URL}/customers/add-info`,
      updatePayload,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    console.log(
      '✅ Customer info updated:',
      updateResponse.status,
      updateResponse.data,
    );

    // Test 5: Verify Customer
    console.log('\n🔍 Testing GET /customers (Verify Customer)...');
    const verifyResponse = await axios.get(`${BASE_URL}/customers`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    console.log(
      '✅ Customers retrieved:',
      verifyResponse.status,
      verifyResponse.data.length,
      'customers',
    );

    // Test 6: Cleanup - Delete Customer
    console.log('\n🗑️ Testing DELETE /customers (Cleanup)...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/customers/${customerId}`,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );
    console.log(
      '✅ Customer deleted:',
      deleteResponse.status,
      deleteResponse.data,
    );

    console.log(
      '\n🎉 All API tests passed! AddPartyScreen should work correctly.',
    );
  } catch (error) {
    console.error('\n❌ API test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run tests
testAPIEndpoints().catch(error => {
  console.error('\n💥 Test runner error:', error.message);
  process.exit(1);
});
