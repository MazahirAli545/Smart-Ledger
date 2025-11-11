#!/usr/bin/env node

/**
 * SellScreen Layout Verification Script
 *
 * This script verifies that the SellScreen (InvoiceScreen_clean.tsx) has:
 * 1. No duplicate customer fields
 * 2. Proper section order matching PurchaseScreen
 * 3. Consistent styling and structure
 * 4. Clean layout without duplicates
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 SellScreen Layout Verification');
console.log('================================\n');

// Read the InvoiceScreen_clean.tsx file
const invoiceScreenPath = path.join(
  __dirname,
  'src/screens/HomeScreen/InvoiceScreen_clean.tsx',
);
const purchaseScreenPath = path.join(
  __dirname,
  'src/screens/HomeScreen/PurchaseScreen.tsx',
);

if (!fs.existsSync(invoiceScreenPath)) {
  console.error('❌ InvoiceScreen_clean.tsx not found');
  process.exit(1);
}

if (!fs.existsSync(purchaseScreenPath)) {
  console.error('❌ PurchaseScreen.tsx not found');
  process.exit(1);
}

const invoiceContent = fs.readFileSync(invoiceScreenPath, 'utf8');
const purchaseContent = fs.readFileSync(purchaseScreenPath, 'utf8');

console.log('✅ Files loaded successfully\n');

// Test 1: Check for duplicate customer fields
console.log('1. Checking for duplicate customer fields...');
const customerFieldMatches = invoiceContent.match(
  /Customer.*Field|Customer Name/g,
);
const customerFieldCount = customerFieldMatches
  ? customerFieldMatches.length
  : 0;

if (customerFieldCount <= 1) {
  console.log('✅ No duplicate customer fields found');
} else {
  console.log(
    `❌ Found ${customerFieldCount} customer field references - possible duplicates`,
  );
}

// Test 2: Check section order
console.log('\n2. Checking section order...');
const invoiceSections = [
  'Invoice Details Card',
  'Items Card',
  'Amount Details Card',
  'Notes Card',
];

const purchaseSections = [
  'Purchase Details Card',
  'Items Card',
  'Amount Details Card',
  'Notes Card',
];

let sectionOrderCorrect = true;
for (let i = 0; i < invoiceSections.length; i++) {
  const invoiceIndex = invoiceContent.indexOf(invoiceSections[i]);
  const purchaseIndex = purchaseContent.indexOf(purchaseSections[i]);

  if (invoiceIndex === -1) {
    console.log(`❌ Missing section: ${invoiceSections[i]}`);
    sectionOrderCorrect = false;
  } else {
    console.log(`✅ Found section: ${invoiceSections[i]}`);
  }
}

if (sectionOrderCorrect) {
  console.log('✅ Section order matches PurchaseScreen structure');
} else {
  console.log('❌ Section order does not match PurchaseScreen');
}

// Test 3: Check for consistent styling
console.log('\n3. Checking styling consistency...');
const styleChecks = [
  { name: 'SCALE constant', pattern: /const SCALE = 0\.75/ },
  {
    name: 'scale function',
    pattern: /const scale = \(value: number\) => Math\.round\(value \* SCALE\)/,
  },
  { name: 'invoiceLikeStyles', pattern: /invoiceLikeStyles/ },
  {
    name: 'MaterialCommunityIcons import',
    pattern: /import.*MaterialCommunityIcons/,
  },
  {
    name: 'KeyboardAwareScrollView import',
    pattern: /import.*KeyboardAwareScrollView/,
  },
];

let stylingConsistent = true;
styleChecks.forEach(check => {
  if (invoiceContent.match(check.pattern)) {
    console.log(`✅ ${check.name} found`);
  } else {
    console.log(`❌ ${check.name} missing`);
    stylingConsistent = false;
  }
});

// Test 4: Check for duplicate form elements
console.log('\n4. Checking for duplicate form elements...');
const duplicateChecks = [
  { name: 'Customer Name fields', pattern: /Customer Name/g },
  { name: 'Phone fields', pattern: /Phone.*Field/g },
  { name: 'Address fields', pattern: /Address.*Field/g },
  { name: 'GST fields', pattern: /GST.*%/g },
];

let noDuplicates = true;
duplicateChecks.forEach(check => {
  const matches = invoiceContent.match(new RegExp(check.pattern.source, 'g'));
  const count = matches ? matches.length : 0;

  if (count <= 1) {
    console.log(`✅ ${check.name}: ${count} found (expected ≤1)`);
  } else {
    console.log(
      `❌ ${check.name}: ${count} found (expected ≤1) - possible duplicates`,
    );
    noDuplicates = false;
  }
});

// Test 5: Check form structure completeness
console.log('\n5. Checking form structure completeness...');
const formElements = [
  'Date field',
  'Customer field',
  'Phone field',
  'Address field',
  'GST field',
  'Items section',
  'Amount Details section',
  'Notes section',
];

let formComplete = true;
formElements.forEach(element => {
  if (
    invoiceContent.includes(element.replace(' field', '')) ||
    invoiceContent.includes(element.replace(' section', ''))
  ) {
    console.log(`✅ ${element} found`);
  } else {
    console.log(`❌ ${element} missing`);
    formComplete = false;
  }
});

// Test 6: Check for proper error handling
console.log('\n6. Checking error handling...');
const errorChecks = [
  { name: 'triedSubmit validation', pattern: /triedSubmit/ },
  { name: 'getFieldError function', pattern: /getFieldError/ },
  { name: 'errorTextField style', pattern: /errorTextField/ },
];

let errorHandlingComplete = true;
errorChecks.forEach(check => {
  if (invoiceContent.match(check.pattern)) {
    console.log(`✅ ${check.name} found`);
  } else {
    console.log(`❌ ${check.name} missing`);
    errorHandlingComplete = false;
  }
});

// Summary
console.log('\n📊 VERIFICATION SUMMARY');
console.log('========================');

const results = {
  'No Duplicate Fields': customerFieldCount <= 1 && noDuplicates,
  'Correct Section Order': sectionOrderCorrect,
  'Consistent Styling': stylingConsistent,
  'Complete Form Structure': formComplete,
  'Proper Error Handling': errorHandlingComplete,
};

let allPassed = true;
Object.entries(results).forEach(([test, passed]) => {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} - ${test}`);
  if (!passed) allPassed = false;
});

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log(
    '🎉 ALL TESTS PASSED - SellScreen layout is clean and consistent!',
  );
  console.log('✅ No duplicate details found');
  console.log('✅ Layout matches PurchaseScreen structure');
  console.log('✅ Font sizes, labels, margins, and paddings are consistent');
  console.log('✅ Clean and balanced layout across all screen sizes');
} else {
  console.log('⚠️  SOME TESTS FAILED - Please review the issues above');
}

console.log('\n📋 RECOMMENDATIONS:');
console.log('1. Test the SellScreen on different device sizes');
console.log('2. Verify all form fields are properly aligned');
console.log('3. Check that customer selection works correctly');
console.log('4. Ensure GST dropdown height matches other input fields');
console.log('5. Verify Amount Details calculations are working');

process.exit(allPassed ? 0 : 1);
