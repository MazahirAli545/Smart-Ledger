// Test the FIXED data transformation logic
const testVouchersData = [
  {
    id: 116,
    type: 'Purchase',
    amount: '336.6',
    partyName: 'Mazahir Ali',
    partyPhone: '+91-9351087215',
    partyAddress: '404 jafri house thakur pachewwar ka rasta ramnganj bazar',
    gstNumber: null,
    created_at: '2025-09-02T06:36:07.230Z',
    updated_at: '2025-09-02T06:36:07.230Z',
  },
  {
    id: 110,
    type: 'payment',
    amount: '500',
    partyName: 'Mazahir Ali',
    partyPhone: '9351087215',
    partyAddress: '404 jafri house thakur pachewwar ka rasta ramnganj bazar',
    gstNumber: 'Deddrre333333',
    created_at: '2025-09-02T05:18:59.738Z',
    updated_at: '2025-09-02T05:18:59.738Z',
  },
  {
    id: 112,
    type: 'receipt',
    amount: '200',
    partyName: 'Mazahir Ali',
    partyPhone: '+91-9351087215',
    partyAddress: '404 jafri house thakur pachewwar ka rasta ramnganj bazar',
    gstNumber: 'Deddrre333333',
    created_at: '2025-09-02T05:51:53.531Z',
    updated_at: '2025-09-02T05:51:53.531Z',
  },
  {
    id: 118,
    type: 'Sell',
    amount: '338.8',
    partyName: 'Mazahir Ali',
    partyPhone: '+91-9351087215',
    partyAddress: '404 jafri house thakur pachewwar ka rasta ramnganj bazar',
    gstNumber: null,
    created_at: '2025-09-02T08:13:41.405Z',
    updated_at: '2025-09-02T08:34:14.157Z',
  },
  {
    id: 926,
    type: 'payment',
    amount: '677',
    partyName: 'iyefywyeif',
    partyPhone: '7667878789',
    partyAddress: 'uheufhai yefWELIYFY',
    gstNumber: '',
    created_at: '2025-09-08T11:22:58.273Z',
    updated_at: '2025-09-08T11:22:58.273Z',
  },
];

// Test the FIXED fallback customer creation logic
function testFixedFallbackCustomerCreation() {
  console.log('🧪 Testing FIXED Fallback Customer Creation Logic...\n');

  // Group vouchers by partyName AND partyType to create separate entries
  // This allows the same party to appear as both customer and supplier
  const customerMap = new Map();

  testVouchersData.forEach(voucher => {
    const partyName = voucher.partyName;

    // Determine party type based on voucher type
    let partyType = 'customer'; // Default
    if (voucher.type === 'Purchase') {
      // Purchase means you're buying from someone = supplier
      partyType = 'supplier';
    } else if (
      voucher.type === 'Sell' ||
      voucher.type === 'receipt' ||
      voucher.type === 'payment'
    ) {
      // Sell/Receipt/Payment means you're dealing with customers
      partyType = 'customer';
    }

    // Create unique key combining partyName and partyType
    const uniqueKey = `${partyName}_${partyType}`;

    if (!customerMap.has(uniqueKey)) {
      customerMap.set(uniqueKey, {
        id: voucher.customerId || `voucher_${voucher.id}_${partyType}`,
        partyName: partyName,
        partyType: partyType,
        phoneNumber: voucher.partyPhone,
        address: voucher.partyAddress,
        gstNumber: voucher.gstNumber,
        createdAt: voucher.created_at,
        updatedAt: voucher.updated_at,
      });
    }
  });

  // Convert map to array
  const fallbackCustomers = Array.from(customerMap.values());

  console.log('📊 Fallback Customers Created:');
  fallbackCustomers.forEach((customer, index) => {
    console.log(`${index + 1}. ${customer.partyName}:`);
    console.log(`   - Party Type: ${customer.partyType}`);
    console.log(`   - ID: ${customer.id}`);
    console.log(`   - Phone: ${customer.phoneNumber}`);
    console.log(`   - Address: ${customer.address}`);
    console.log(`   - GST: ${customer.gstNumber || 'None'}`);
    console.log('');
  });

  // Test filtering logic
  console.log('🔍 Testing Filtering Logic:');

  const customersTab = fallbackCustomers.filter(customer => {
    const partyType = customer.partyType || 'customer';
    return (
      partyType === 'customer' ||
      partyType === 'Customer' ||
      !customer.partyType
    );
  });

  const suppliersTab = fallbackCustomers.filter(customer => {
    const partyType = customer.partyType || 'customer';
    return partyType === 'supplier' || partyType === 'Supplier';
  });

  console.log(`✅ Customers Tab: ${customersTab.length} items`);
  customersTab.forEach(c =>
    console.log(`   - ${c.partyName} (${c.partyType})`),
  );

  console.log(`✅ Suppliers Tab: ${suppliersTab.length} items`);
  suppliersTab.forEach(c =>
    console.log(`   - ${c.partyName} (${c.partyType})`),
  );

  return { fallbackCustomers, customersTab, suppliersTab };
}

// Run the test
const result = testFixedFallbackCustomerCreation();

console.log('\n🎯 Expected Results (FIXED):');
console.log('- Mazahir Ali should appear in BOTH tabs (separate entries)');
console.log('- iyefywyeif should appear in Customers tab only');
console.log(
  '- Total entries should be 3: Mazahir Ali (customer), Mazahir Ali (supplier), iyefywyeif (customer)',
);
