const axios = require('axios');

// Test the customers API endpoint
async function testCustomersAPI() {
  try {
    console.log('🧪 Testing Customers API...');

    // You'll need to replace this with a valid token
    const accessToken = 'YOUR_ACCESS_TOKEN_HERE';
    const baseUrl = 'https://utility-apis-49wa.onrender.com';

    console.log('📞 Calling customers endpoint:', `${baseUrl}/customers`);

    const response = await axios.get(`${baseUrl}/customers`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('✅ Customers API Response:');
    console.log('Status:', response.status);
    console.log('Data structure:', {
      hasData: !!response.data,
      isArray: Array.isArray(response.data),
      hasDataField: !!response.data?.data,
      responseKeys: Object.keys(response.data || {}),
    });

    if (response.data?.data) {
      console.log(
        '📊 Customers data (first 3 items):',
        response.data.data.slice(0, 3),
      );
    } else if (Array.isArray(response.data)) {
      console.log(
        '📊 Customers data (first 3 items):',
        response.data.slice(0, 3),
      );
    } else {
      console.log('📊 Full response:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing customers API:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
  }
}

// Test the vouchers API endpoint for comparison
async function testVouchersAPI() {
  try {
    console.log('\n🧪 Testing Vouchers API...');

    const accessToken = 'YOUR_ACCESS_TOKEN_HERE';
    const baseUrl = 'https://utility-apis-49wa.onrender.com';

    console.log('📞 Calling vouchers endpoint:', `${baseUrl}/vouchers`);

    const response = await axios.get(`${baseUrl}/vouchers`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    console.log('✅ Vouchers API Response:');
    console.log('Status:', response.status);
    console.log('Data structure:', {
      hasData: !!response.data,
      isArray: Array.isArray(response.data),
      hasDataField: !!response.data?.data,
      responseKeys: Object.keys(response.data || {}),
    });

    if (response.data?.data) {
      console.log(
        '📊 Vouchers data (first 3 items):',
        response.data.data.slice(0, 3),
      );
    } else if (Array.isArray(response.data)) {
      console.log(
        '📊 Vouchers data (first 3 items):',
        response.data.slice(0, 3),
      );
    } else {
      console.log('📊 Full response:', response.data);
    }
  } catch (error) {
    console.error('❌ Error testing vouchers API:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
  }
}

// Run both tests
async function runTests() {
  console.log('🚀 Starting API tests...\n');
  await testCustomersAPI();
  await testVouchersAPI();
  console.log('\n✅ Tests completed!');
}

runTests();
