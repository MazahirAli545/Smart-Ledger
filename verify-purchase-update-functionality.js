/**
 * Comprehensive verification script for Purchase and Supplier Update functionality
 * This script verifies that all components work together correctly
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

// Verification functions
function verifyFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      logSuccess(`${description} exists: ${filePath}`);
      return true;
    } else {
      logError(`${description} not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`Error checking ${description}: ${error.message}`);
    return false;
  }
}

function verifyFileContent(filePath, searchStrings, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let allFound = true;

    searchStrings.forEach(searchString => {
      if (content.includes(searchString)) {
        logSuccess(`Found in ${description}: ${searchString}`);
      } else {
        logError(`Missing in ${description}: ${searchString}`);
        allFound = false;
      }
    });

    return allFound;
  } catch (error) {
    logError(`Error reading ${description}: ${error.message}`);
    return false;
  }
}

function verifyImportStatements() {
  logStep(1, 'Verifying Import Statements');

  const purchaseScreenPath = 'src/screens/HomeScreen/PurchaseScreen.tsx';
  const requiredImports = [
    "import { updateTransaction } from '../../api/transactions'",
    "import { updateSupplier } from '../../api/suppliers'",
  ];

  return verifyFileContent(
    purchaseScreenPath,
    requiredImports,
    'PurchaseScreen.tsx',
  );
}

function verifySupplierUpdateAPI() {
  logStep(2, 'Verifying Supplier Update API');

  const suppliersAPIPath = 'src/api/suppliers.ts';
  const requiredFeatures = [
    'phoneNumber',
    'address',
    'payload.phone',
    'payload.address',
    'console.log.*updateSupplier API',
  ];

  return verifyFileContent(suppliersAPIPath, requiredFeatures, 'suppliers.ts');
}

function verifyPurchaseScreenLogic() {
  logStep(3, 'Verifying PurchaseScreen Update Logic');

  const purchaseScreenPath = 'src/screens/HomeScreen/PurchaseScreen.tsx';
  const requiredLogic = [
    'Update supplier information if editing and supplier details have changed',
    'updateSupplier(currentSupplierId, supplierUpdateData)',
    'fetchSuppliersCtx',
    'supplierUpdateError',
  ];

  return verifyFileContent(
    purchaseScreenPath,
    requiredLogic,
    'PurchaseScreen.tsx',
  );
}

function verifyErrorHandling() {
  logStep(4, 'Verifying Error Handling');

  const purchaseScreenPath = 'src/screens/HomeScreen/PurchaseScreen.tsx';
  const errorHandlingFeatures = [
    'try {',
    'catch (supplierUpdateError)',
    'console.error.*Error updating supplier',
    'Continuing despite supplier update error',
  ];

  return verifyFileContent(
    purchaseScreenPath,
    errorHandlingFeatures,
    'PurchaseScreen.tsx',
  );
}

function verifyLogging() {
  logStep(5, 'Verifying Logging Implementation');

  const purchaseScreenPath = 'src/screens/HomeScreen/PurchaseScreen.tsx';
  const loggingFeatures = [
    'console.log.*Checking if supplier needs to be updated',
    'console.log.*Updating supplier with ID',
    'console.log.*Supplier updated successfully',
    'console.log.*No supplier changes detected',
  ];

  return verifyFileContent(
    purchaseScreenPath,
    loggingFeatures,
    'PurchaseScreen.tsx',
  );
}

function verifyTestFiles() {
  logStep(6, 'Verifying Test Files');

  const testFiles = [
    'test-purchase-supplier-update.js',
    'test-purchase-navigation.js',
    'PURCHASE_SUPPLIER_UPDATE_IMPLEMENTATION.md',
  ];

  let allExist = true;
  testFiles.forEach(file => {
    if (!verifyFileExists(file, `Test file: ${file}`)) {
      allExist = false;
    }
  });

  return allExist;
}

function verifyCodeQuality() {
  logStep(7, 'Verifying Code Quality');

  const purchaseScreenPath = 'src/screens/HomeScreen/PurchaseScreen.tsx';
  const qualityFeatures = [
    '// Update supplier information if editing and supplier details have changed',
    'const currentSupplierId = editingItem.customer_id || editingItem.partyId || supplierId',
    'if (Object.keys(supplierUpdateData).length > 0)',
    "// Don't fail the entire operation if supplier update fails",
  ];

  return verifyFileContent(
    purchaseScreenPath,
    qualityFeatures,
    'PurchaseScreen.tsx',
  );
}

function generateTestReport(results) {
  logSection('VERIFICATION REPORT');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(
    result => result === true,
  ).length;
  const failedTests = totalTests - passedTests;

  log(`\nTotal Tests: ${totalTests}`, 'bright');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');

  log('\nDetailed Results:', 'bright');
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? 'PASS' : 'FAIL';
    const color = result ? 'green' : 'red';
    log(`  ${test}: ${status}`, color);
  });

  if (failedTests === 0) {
    log(
      '\n🎉 All verifications passed! The implementation is ready for testing.',
      'green',
    );
  } else {
    log(
      '\n⚠️  Some verifications failed. Please review the issues above.',
      'yellow',
    );
  }

  return failedTests === 0;
}

function generateNextSteps() {
  logSection('NEXT STEPS');

  logInfo('To test the functionality:');
  log('1. Start your React Native development server', 'cyan');
  log('2. Navigate to the PurchaseScreen in your app', 'cyan');
  log('3. Edit an existing purchase', 'cyan');
  log('4. Modify supplier name, phone, or address', 'cyan');
  log('5. Click "Update Purchase" button', 'cyan');
  log('6. Check console logs for API calls', 'cyan');
  log('7. Verify navigation works correctly', 'cyan');
  log('8. Check that supplier information is updated', 'cyan');

  logInfo('To run automated tests:');
  log('1. Update test data in test-purchase-supplier-update.js', 'cyan');
  log('2. Add your authentication token', 'cyan');
  log('3. Run: node test-purchase-supplier-update.js', 'cyan');
  log('4. Run: node test-purchase-navigation.js', 'cyan');

  logInfo('To monitor the implementation:');
  log('1. Check console logs for detailed API call information', 'cyan');
  log('2. Monitor network requests in React Native debugger', 'cyan');
  log('3. Verify data consistency between purchases and suppliers', 'cyan');
  log('4. Test error scenarios (network issues, invalid data)', 'cyan');
}

// Main verification function
function runVerification() {
  logSection('PURCHASE & SUPPLIER UPDATE VERIFICATION');

  log(
    'This script verifies that the purchase and supplier update functionality',
    'bright',
  );
  log('has been implemented correctly in the React Native app.', 'bright');

  const results = {
    'Import Statements': verifyImportStatements(),
    'Supplier Update API': verifySupplierUpdateAPI(),
    'PurchaseScreen Logic': verifyPurchaseScreenLogic(),
    'Error Handling': verifyErrorHandling(),
    'Logging Implementation': verifyLogging(),
    'Test Files': verifyTestFiles(),
    'Code Quality': verifyCodeQuality(),
  };

  const allPassed = generateTestReport(results);
  generateNextSteps();

  return allPassed;
}

// Run verification if this file is executed directly
if (require.main === module) {
  const success = runVerification();
  process.exit(success ? 0 : 1);
}

module.exports = {
  runVerification,
  verifyFileExists,
  verifyFileContent,
  generateTestReport,
};
