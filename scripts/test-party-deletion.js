#!/usr/bin/env node

/**
 * Test Script for Party Deletion with Related Vouchers
 *
 * This script demonstrates the party deletion functionality by simulating
 * the API calls and showing the expected behavior.
 */

const axios = require('axios');

// Mock configuration
const BASE_URL = 'https://api.example.com';
const MOCK_TOKEN = 'mock-access-token';

// Mock data
const mockVouchers = [
  {
    id: 'v1',
    type: 'invoice',
    amount: '5000',
    partyName: 'Test Customer',
    date: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'v2',
    type: 'receipt',
    amount: '3000',
    partyName: 'Test Customer',
    date: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 'v3',
    type: 'payment',
    amount: '15000', // Critical amount
    partyName: 'Test Customer',
    date: '2024-01-03T00:00:00.000Z',
  },
  {
    id: 'v4',
    type: 'invoice', // Critical type
    amount: '8000',
    partyName: 'Test Customer',
    date: '2024-01-04T00:00:00.000Z',
  },
];

const mockParty = {
  id: '123',
  name: 'Test Customer',
  partyType: 'customer',
};

// Simulate the deletion process
async function simulatePartyDeletion() {
  console.log('🚀 Starting Party Deletion Simulation\n');

  try {
    // Step 1: Check for related vouchers
    console.log('📊 Step 1: Checking for related vouchers...');
    const relatedVouchers = mockVouchers.filter(
      voucher => voucher.partyName === mockParty.name,
    );

    console.log(`✅ Found ${relatedVouchers.length} related vouchers`);
    relatedVouchers.forEach((voucher, index) => {
      console.log(
        `   ${index + 1}. ${voucher.type.toUpperCase()} - ₹${
          voucher.amount
        } - ${voucher.date.split('T')[0]}`,
      );
    });

    // Step 2: Check for critical transactions
    console.log('\n⚠️  Step 2: Checking for critical transactions...');
    const criticalVouchers = relatedVouchers.filter(voucher => {
      const amount = parseFloat(voucher.amount);
      const isHighAmount = amount > 10000;
      const isCriticalType = ['invoice', 'receipt'].includes(voucher.type);
      return isHighAmount || isCriticalType;
    });

    if (criticalVouchers.length > 0) {
      console.log(
        `⚠️  Found ${criticalVouchers.length} critical transactions:`,
      );
      criticalVouchers.forEach(voucher => {
        const reasons = [];
        if (parseFloat(voucher.amount) > 10000) reasons.push('High Amount');
        if (['invoice', 'receipt'].includes(voucher.type))
          reasons.push('Critical Type');
        console.log(
          `   • ${voucher.type.toUpperCase()} - ₹${
            voucher.amount
          } (${reasons.join(', ')})`,
        );
      });
    } else {
      console.log('✅ No critical transactions found');
    }

    // Step 3: Delete related vouchers
    console.log('\n🗑️  Step 3: Deleting related vouchers...');
    const deletionPromises = relatedVouchers.map(async (voucher, index) => {
      try {
        console.log(
          `   Deleting voucher ${index + 1}/${
            relatedVouchers.length
          }: ${voucher.type.toUpperCase()} - ₹${voucher.amount}`,
        );

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log(`   ✅ Voucher ${voucher.id} deleted successfully`);
        return { success: true, id: voucher.id };
      } catch (error) {
        console.log(
          `   ❌ Failed to delete voucher ${voucher.id}: ${error.message}`,
        );
        return { success: false, id: voucher.id, error };
      }
    });

    const results = await Promise.allSettled(deletionPromises);
    const successful = results.filter(
      result => result.status === 'fulfilled' && result.value?.success,
    ).length;
    const failed = results.filter(
      result => result.status === 'fulfilled' && !result.value?.success,
    ).length;

    console.log(
      `\n📊 Voucher deletion results: ${successful} successful, ${failed} failed`,
    );

    // Step 4: Delete the party
    console.log('\n👤 Step 4: Deleting the party...');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('✅ Party deleted successfully');
    } catch (error) {
      console.log(`❌ Failed to delete party: ${error.message}`);
      return;
    }

    // Final summary
    console.log('\n🎉 Party Deletion Completed Successfully!');
    console.log(`📋 Summary:`);
    console.log(`   • Party: ${mockParty.name} (${mockParty.partyType})`);
    console.log(`   • Related vouchers: ${relatedVouchers.length}`);
    console.log(`   • Critical transactions: ${criticalVouchers.length}`);
    console.log(`   • Vouchers deleted: ${successful}`);
    console.log(`   • Vouchers failed: ${failed}`);
    console.log(`   • Party status: Deleted`);
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
  }
}

// Run the simulation
if (require.main === module) {
  simulatePartyDeletion();
}

module.exports = { simulatePartyDeletion };
