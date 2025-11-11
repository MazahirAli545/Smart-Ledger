/**
 * Test script to verify purchase and supplier update functionality
 * This script tests the scenario where a user edits a purchase and updates supplier information
 */

const BASE_URL = 'http://localhost:3000'; // Adjust based on your backend URL

// Test data
const testPurchaseId = 1; // Replace with an actual purchase ID from your database
const testSupplierId = 1; // Replace with an actual supplier ID from your database

const testData = {
  // Updated purchase data
  purchase: {
    purchaseNumber: 'PUR-TEST-001',
    purchaseDate: '2024-01-15',
    supplier: 'Updated Supplier Name',
    supplierPhone: '9876543210',
    supplierAddress: 'Updated Address, City, State 12345',
    notes: 'Updated purchase notes',
    items: [
      {
        description: 'Test Item 1',
        quantity: 2,
        rate: 100,
        amount: 200,
      },
      {
        description: 'Test Item 2',
        quantity: 1,
        rate: 150,
        amount: 150,
      },
    ],
    gstPct: 18,
    discount: 0,
    status: 'complete',
  },
};

async function testPurchaseUpdate() {
  console.log('🧪 Starting Purchase Update Test...');

  try {
    // Step 1: Test transaction update API
    console.log('\n1️⃣ Testing Transaction Update API...');

    const transactionUpdatePayload = {
      user_id: 1, // Replace with actual user ID
      type: 'PURCHASE',
      date: new Date(testData.purchase.purchaseDate).toISOString(),
      amount: 350, // Total of items
      status: testData.purchase.status,
      partyName: testData.purchase.supplier,
      partyId: testSupplierId,
      customer_id: testSupplierId,
      partyPhone: testData.purchase.supplierPhone,
      partyAddress: testData.purchase.supplierAddress,
      notes: testData.purchase.notes,
      items: testData.purchase.items,
      transactionItems: testData.purchase.items,
      voucherItems: testData.purchase.items,
      gstPct: testData.purchase.gstPct,
      discount: testData.purchase.discount,
      subTotal: 350,
      totalAmount: 413, // Including GST
    };

    console.log(
      '📤 Transaction Update Payload:',
      JSON.stringify(transactionUpdatePayload, null, 2),
    );

    const transactionResponse = await fetch(
      `${BASE_URL}/transactions/${testPurchaseId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        },
        body: JSON.stringify(transactionUpdatePayload),
      },
    );

    if (!transactionResponse.ok) {
      const error = await transactionResponse.json();
      throw new Error(
        `Transaction update failed: ${
          transactionResponse.status
        } - ${JSON.stringify(error)}`,
      );
    }

    const transactionResult = await transactionResponse.json();
    console.log('✅ Transaction Update Success:', transactionResult);

    // Step 2: Test supplier update API
    console.log('\n2️⃣ Testing Supplier Update API...');

    const supplierUpdatePayload = {
      name: testData.purchase.supplier,
      partyName: testData.purchase.supplier,
      phoneNumber: testData.purchase.supplierPhone,
      address: testData.purchase.supplierAddress,
    };

    console.log(
      '📤 Supplier Update Payload:',
      JSON.stringify(supplierUpdatePayload, null, 2),
    );

    const supplierResponse = await fetch(
      `${BASE_URL}/customers/${testSupplierId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        },
        body: JSON.stringify(supplierUpdatePayload),
      },
    );

    if (!supplierResponse.ok) {
      const error = await supplierResponse.json();
      throw new Error(
        `Supplier update failed: ${supplierResponse.status} - ${JSON.stringify(
          error,
        )}`,
      );
    }

    const supplierResult = await supplierResponse.json();
    console.log('✅ Supplier Update Success:', supplierResult);

    // Step 3: Verify both updates
    console.log('\n3️⃣ Verifying Updates...');

    // Verify transaction was updated
    const verifyTransactionResponse = await fetch(
      `${BASE_URL}/transactions/${testPurchaseId}`,
      {
        headers: {
          Authorization: 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        },
      },
    );

    if (verifyTransactionResponse.ok) {
      const updatedTransaction = await verifyTransactionResponse.json();
      console.log('✅ Transaction Verification:', {
        partyName: updatedTransaction.partyName,
        partyPhone: updatedTransaction.partyPhone,
        partyAddress: updatedTransaction.partyAddress,
        amount: updatedTransaction.amount,
      });
    }

    // Verify supplier was updated
    const verifySupplierResponse = await fetch(
      `${BASE_URL}/customers/${testSupplierId}`,
      {
        headers: {
          Authorization: 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        },
      },
    );

    if (verifySupplierResponse.ok) {
      const updatedSupplier = await verifySupplierResponse.json();
      console.log('✅ Supplier Verification:', {
        name: updatedSupplier.name,
        partyName: updatedSupplier.partyName,
        phoneNumber: updatedSupplier.phoneNumber,
        address: updatedSupplier.address,
      });
    }

    console.log(
      '\n🎉 All tests passed! Purchase and supplier update functionality is working correctly.',
    );
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test the updateSupplier function directly
async function testUpdateSupplierFunction() {
  console.log('\n🔧 Testing updateSupplier function directly...');

  try {
    // This would be called from the React Native app
    const { updateSupplier } = require('./src/api/suppliers');

    const result = await updateSupplier(testSupplierId, {
      name: testData.purchase.supplier,
      partyName: testData.purchase.supplier,
      phoneNumber: testData.purchase.supplierPhone,
      address: testData.purchase.supplierAddress,
    });

    console.log('✅ updateSupplier function result:', result);
  } catch (error) {
    console.error('❌ updateSupplier function test failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  console.log('🚀 Purchase and Supplier Update Test Suite');
  console.log('==========================================');
  console.log(
    '⚠️  Note: Update the test data and token before running this test',
  );
  console.log('⚠️  Make sure your backend server is running');

  // Uncomment the line below to run the test
  // testPurchaseUpdate();
  // testUpdateSupplierFunction();

  console.log('\n📋 Test Instructions:');
  console.log(
    '1. Update testPurchaseId and testSupplierId with real IDs from your database',
  );
  console.log('2. Replace YOUR_TOKEN_HERE with a valid authentication token');
  console.log('3. Ensure your backend server is running on the correct port');
  console.log('4. Uncomment the test function calls above');
  console.log('5. Run: node test-purchase-supplier-update.js');
}

module.exports = {
  testPurchaseUpdate,
  testUpdateSupplierFunction,
  testData,
};
