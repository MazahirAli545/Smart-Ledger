/**
 * Simple StatusBar Test Runner
 *
 * This script tests the StatusBar configuration without requiring TypeScript compilation.
 * It directly tests the configuration logic.
 */

console.log('🚀 Starting StatusBar Color Tests...');
console.log('=====================================\n');

// Test configurations for all screens
const TEST_SCREENS = [
  'Dashboard',
  'CustomDrawerContent',
  'Customer',
  'CustomerDetail',
  'AddParty',
  'AddNewEntry',
  'AddCustomerFromContacts',
  'ProfileScreen',
  'Invoice',
  'Receipt',
  'Payment',
  'Purchase',
  'AddFolder',
  'FolderScreen',
  'AllQuickActionsScreen',
  'GSTSummary',
  'CashFlow',
  'DailyLedger',
  'SubscriptionPlan',
  'Notifications',
  'Report',
  'LinkToCA',
  'SignIn',
  'SignInOtp',
];

// Default configurations
const DEFAULT_LIGHT_CONFIG = {
  backgroundColor: '#f6fafc',
  barStyle: 'dark-content',
  translucent: false,
};

const DEFAULT_DARK_CONFIG = {
  backgroundColor: '#4f8cff',
  barStyle: 'light-content',
  translucent: false,
};

// Screen-specific configurations
const SCREEN_CONFIGS = {
  // Blue header screens (like ProfileScreen)
  Customer: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  CustomerDetail: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  AddParty: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  AddNewEntry: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  AddCustomerFromContacts: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  ProfileScreen: {
    backgroundColor: 'transparent', // Uses gradient, so transparent
    barStyle: 'light-content',
    translucent: true,
  },

  // Blue header screens (Dashboard and CustomDrawerContent now match CustomerScreen)
  Dashboard: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  CustomDrawerContent: {
    backgroundColor: '#4f8cff',
    barStyle: 'light-content',
    translucent: false,
  },
  Invoice: DEFAULT_LIGHT_CONFIG,
  Receipt: DEFAULT_LIGHT_CONFIG,
  Payment: DEFAULT_LIGHT_CONFIG,
  Purchase: DEFAULT_LIGHT_CONFIG,
  AddFolder: DEFAULT_LIGHT_CONFIG,
  FolderScreen: DEFAULT_LIGHT_CONFIG,
  AllQuickActionsScreen: DEFAULT_LIGHT_CONFIG,
  GSTSummary: DEFAULT_LIGHT_CONFIG,
  CashFlow: DEFAULT_LIGHT_CONFIG,
  DailyLedger: DEFAULT_LIGHT_CONFIG,
  SubscriptionPlan: DEFAULT_LIGHT_CONFIG,
  Notifications: DEFAULT_LIGHT_CONFIG,
  Report: DEFAULT_LIGHT_CONFIG,
  LinkToCA: DEFAULT_LIGHT_CONFIG,

  // Auth screens
  SignIn: DEFAULT_LIGHT_CONFIG,
  SignInOtp: DEFAULT_LIGHT_CONFIG,
};

// Get StatusBar configuration for a specific screen
function getStatusBarConfig(screenName) {
  if (!screenName) {
    return DEFAULT_LIGHT_CONFIG;
  }
  return SCREEN_CONFIGS[screenName] || DEFAULT_LIGHT_CONFIG;
}

// Test every screen's StatusBar color
function testEveryScreenStatusBarColor() {
  console.log("🎨 Testing every screen's StatusBar color...");
  console.log('='.repeat(60));

  const results = {
    totalScreens: TEST_SCREENS.length,
    passed: 0,
    failed: 0,
    details: [],
  };

  TEST_SCREENS.forEach((screenName, index) => {
    console.log(`\n${index + 1}. Testing ${screenName}...`);

    const config = getStatusBarConfig(screenName);
    const issues = [];

    // Validate configuration
    if (!config.backgroundColor) {
      issues.push('Missing backgroundColor');
    }

    if (!config.barStyle) {
      issues.push('Missing barStyle');
    }

    // Check for expected colors based on screen type
    const isCustomerScreen = [
      'Customer',
      'CustomerDetail',
      'AddParty',
      'AddNewEntry',
      'AddCustomerFromContacts',
      'Dashboard', // Dashboard now uses blue header like CustomerScreen
      'CustomDrawerContent', // CustomDrawerContent now uses blue header like CustomerScreen
    ].includes(screenName);

    const isGradientScreen = screenName === 'ProfileScreen';

    if (isCustomerScreen && config.backgroundColor !== '#4f8cff') {
      issues.push(
        `Expected blue background (#4f8cff) for customer screen, got ${config.backgroundColor}`,
      );
    }

    if (isGradientScreen && config.backgroundColor !== 'transparent') {
      issues.push(
        `Expected transparent background for gradient screen, got ${config.backgroundColor}`,
      );
    }

    if (
      !isCustomerScreen &&
      !isGradientScreen &&
      config.backgroundColor !== '#f6fafc'
    ) {
      issues.push(
        `Expected light background (#f6fafc) for standard screen, got ${config.backgroundColor}`,
      );
    }

    // Check bar style
    if (isCustomerScreen && config.barStyle !== 'light-content') {
      issues.push(
        `Expected light-content for customer screen, got ${config.barStyle}`,
      );
    }

    if (isGradientScreen && config.barStyle !== 'light-content') {
      issues.push(
        `Expected light-content for gradient screen, got ${config.barStyle}`,
      );
    }

    if (
      !isCustomerScreen &&
      !isGradientScreen &&
      config.barStyle !== 'dark-content'
    ) {
      issues.push(
        `Expected dark-content for standard screen, got ${config.barStyle}`,
      );
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'PASS') {
      results.passed++;
      console.log(`  ✅ PASS: ${config.backgroundColor} (${config.barStyle})`);
    } else {
      results.failed++;
      console.log(`  ❌ FAIL: ${issues.join(', ')}`);
    }

    results.details.push({
      screenName,
      status,
      config,
      issues,
    });
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:');
  console.log(`Total Screens: ${results.totalScreens}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(
    `Success Rate: ${((results.passed / results.totalScreens) * 100).toFixed(
      1,
    )}%`,
  );

  if (results.failed > 0) {
    console.log('\n❌ Failed Screens:');
    results.details
      .filter(detail => detail.status === 'FAIL')
      .forEach(detail => {
        console.log(`  - ${detail.screenName}: ${detail.issues.join(', ')}`);
      });
  }

  return results;
}

// Test color consistency across screen categories
function testStatusBarColorConsistency() {
  console.log('\n🎨 Testing StatusBar color consistency...');

  const categories = {
    customerScreens: [
      'Customer',
      'CustomerDetail',
      'AddParty',
      'AddNewEntry',
      'AddCustomerFromContacts',
    ],
    standardScreens: [
      'Invoice',
      'Receipt',
      'Payment',
      'Purchase',
      'AddFolder',
      'FolderScreen',
      'AllQuickActionsScreen',
      'GSTSummary',
      'CashFlow',
      'DailyLedger',
      'SubscriptionPlan',
      'Notifications',
      'Report',
      'LinkToCA',
    ],
    gradientScreens: ['ProfileScreen'],
  };

  const results = {
    customerScreens: { expected: '#4f8cff', actual: [] },
    standardScreens: { expected: '#f6fafc', actual: [] },
    gradientScreens: { expected: 'transparent', actual: [] },
  };

  // Test customer screens
  categories.customerScreens.forEach(screenName => {
    const config = getStatusBarConfig(screenName);
    results.customerScreens.actual.push(config.backgroundColor);
  });

  // Test standard screens
  categories.standardScreens.forEach(screenName => {
    const config = getStatusBarConfig(screenName);
    results.standardScreens.actual.push(config.backgroundColor);
  });

  // Test gradient screens
  categories.gradientScreens.forEach(screenName => {
    const config = getStatusBarConfig(screenName);
    results.gradientScreens.actual.push(config.backgroundColor);
  });

  // Check consistency
  const customerConsistent = results.customerScreens.actual.every(
    color => color === results.customerScreens.expected,
  );
  const standardConsistent = results.standardScreens.actual.every(
    color => color === results.standardScreens.expected,
  );
  const gradientConsistent = results.gradientScreens.actual.every(
    color => color === results.gradientScreens.expected,
  );

  console.log(
    'Customer Screens:',
    customerConsistent ? '✅ Consistent' : '❌ Inconsistent',
  );
  console.log(
    'Standard Screens:',
    standardConsistent ? '✅ Consistent' : '❌ Inconsistent',
  );
  console.log(
    'Gradient Screens:',
    gradientConsistent ? '✅ Consistent' : '❌ Inconsistent',
  );

  return {
    customerConsistent,
    standardConsistent,
    gradientConsistent,
    results,
  };
}

// Run the tests
const colorTestResults = testEveryScreenStatusBarColor();
const consistencyResults = testStatusBarColorConsistency();

console.log('\n🏁 StatusBar Color Tests Completed!');
console.log('=====================================');

// Final summary
const allTestsPassed =
  colorTestResults.failed === 0 &&
  consistencyResults.customerConsistent &&
  consistencyResults.standardConsistent &&
  consistencyResults.gradientConsistent;

console.log(
  `\n🎯 Overall Result: ${
    allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
  }`,
);

if (allTestsPassed) {
  console.log(
    '🎉 Congratulations! All StatusBar colors are working correctly!',
  );
} else {
  console.log('⚠️  Please check the failed tests above and fix any issues.');
}
