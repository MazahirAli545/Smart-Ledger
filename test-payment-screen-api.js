#!/usr/bin/env node

/**
 * Test PaymentScreen API Integration
 * This script tests the updated PaymentScreen API endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://192.168.57.107:5000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with actual token

async function testPaymentScreenAPI() {
  console.log('🧪 Testing PaymentScreen API Integration');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Token: ${TEST_TOKEN ? 'SET' : 'NOT SET'}`);

  if (!TEST_TOKEN || TEST_TOKEN === 'your_jwt_token_here') {
    console.log('❌ Please set TEST_TOKEN with a valid JWT token');
    return;
  }

  try {
    // Test 1: Fetch customers (for party information)
    console.log('\n📋 Test 1: Fetching customers...');
    const customersRes = await axios.get(`${BASE_URL}/customers`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    });

    if (customersRes.status === 200) {
      const customers = customersRes.data.data || [];
      console.log(
        `✅ Customers fetched successfully: ${customers.length} found`,
      );
      if (customers.length > 0) {
        console.log('📝 Sample customer:', {
          id: customers[0].id,
          partyName: customers[0].partyName,
          partyType: customers[0].partyType,
          phoneNumber: customers[0].phoneNumber,
        });
      }
    } else {
      console.log(`❌ Failed to fetch customers: ${customersRes.status}`);
    }

    // Test 2: Fetch vouchers (payments)
    console.log('\n💰 Test 2: Fetching vouchers (payments)...');
    const vouchersRes = await axios.get(`${BASE_URL}/vouchers?type=payment`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
    });

    if (vouchersRes.status === 200) {
      const vouchers = vouchersRes.data.data || [];
      console.log(`✅ Vouchers fetched successfully: ${vouchers.length} found`);
      if (vouchers.length > 0) {
        console.log('📝 Sample voucher:', {
          id: vouchers[0].id,
          type: vouchers[0].type,
          partyName: vouchers[0].partyName,
          amount: vouchers[0].amount,
          status: vouchers[0].status,
        });
      }
    } else {
      console.log(`❌ Failed to fetch vouchers: ${vouchersRes.status}`);
    }

    // Test 3: Test the enriched data structure
    console.log('\n🔗 Test 3: Testing data enrichment...');
    if (customersRes.status === 200 && vouchersRes.status === 200) {
      const customers = customersRes.data.data || [];
      const vouchers = vouchersRes.data.data || [];

      const enrichedPayments = vouchers
        .filter(v => v.type === 'payment')
        .map(voucher => {
          const party = customers.find(
            c => c.id === voucher.partyId || c.partyName === voucher.partyName,
          );

          return {
            ...voucher,
            partyName: party?.partyName || voucher.partyName,
            partyPhone: party?.phoneNumber || voucher.partyPhone,
            partyAddress: party?.address || voucher.partyAddress,
            partyType: party?.partyType || 'customer',
          };
        });

      console.log(
        `✅ Data enrichment successful: ${enrichedPayments.length} enriched payments`,
      );
      if (enrichedPayments.length > 0) {
        console.log('📝 Sample enriched payment:', {
          id: enrichedPayments[0].id,
          partyName: enrichedPayments[0].partyName,
          partyPhone: enrichedPayments[0].partyPhone,
          partyAddress: enrichedPayments[0].partyAddress,
          partyType: enrichedPayments[0].partyType,
        });
      }
    }

    console.log('\n🎉 All PaymentScreen API tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testPaymentScreenAPI();
