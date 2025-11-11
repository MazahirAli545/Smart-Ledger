/**
 * StatusBar Test Utility
 *
 * This utility helps test the StatusBar implementation across different screens
 * to ensure consistent behavior and proper color matching.
 */

import { getStatusBarConfig, applyStatusBarConfig } from './statusBarManager';

// Test configurations for all screens
const TEST_SCREENS = [
  'Dashboard',
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

/**
 * Test StatusBar configuration for all screens
 */
export function testAllScreenConfigurations() {
  console.log('🧪 Testing StatusBar configurations for all screens...');

  const results = TEST_SCREENS.map(screenName => {
    const config = getStatusBarConfig(screenName);
    console.log(`📱 ${screenName}:`, config);
    return { screenName, config };
  });

  return results;
}

/**
 * Test StatusBar configuration for a specific screen
 */
export function testScreenConfiguration(screenName: string) {
  console.log(`🧪 Testing StatusBar configuration for ${screenName}...`);

  const config = getStatusBarConfig(screenName);
  console.log(`📱 ${screenName} config:`, config);

  // Apply the configuration
  applyStatusBarConfig(config);
  console.log(`✅ Applied StatusBar configuration for ${screenName}`);

  return config;
}

/**
 * Validate that all screens have proper StatusBar configurations
 */
export function validateStatusBarConfigurations() {
  console.log('🔍 Validating StatusBar configurations...');

  const issues: string[] = [];

  TEST_SCREENS.forEach(screenName => {
    const config = getStatusBarConfig(screenName);

    // Check if configuration is valid
    if (!config.backgroundColor) {
      issues.push(`${screenName}: Missing backgroundColor`);
    }

    if (!config.barStyle) {
      issues.push(`${screenName}: Missing barStyle`);
    }

    // Check for hardcoded colors that should be dynamic
    if (
      config.backgroundColor === '#4f8cff' &&
      ![
        'Customer',
        'CustomerDetail',
        'AddParty',
        'AddNewEntry',
        'AddCustomerFromContacts',
      ].includes(screenName)
    ) {
      issues.push(
        `${screenName}: Unexpected blue background for non-customer screen`,
      );
    }

    if (
      config.backgroundColor === '#f6fafc' &&
      [
        'Customer',
        'CustomerDetail',
        'AddParty',
        'AddNewEntry',
        'AddCustomerFromContacts',
      ].includes(screenName)
    ) {
      issues.push(
        `${screenName}: Expected blue background for customer screen`,
      );
    }
  });

  if (issues.length === 0) {
    console.log('✅ All StatusBar configurations are valid');
  } else {
    console.log('❌ StatusBar configuration issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  }

  return issues;
}

/**
 * Test StatusBar transitions between screens
 */
export function testStatusBarTransitions() {
  console.log('🔄 Testing StatusBar transitions...');

  const transitions = [
    ['Dashboard', 'Customer'],
    ['Customer', 'ProfileScreen'],
    ['ProfileScreen', 'Dashboard'],
    ['Dashboard', 'SubscriptionPlan'],
    ['SubscriptionPlan', 'Report'],
  ];

  transitions.forEach(([from, to]) => {
    console.log(`🔄 Transition: ${from} → ${to}`);

    const fromConfig = getStatusBarConfig(from);
    const toConfig = getStatusBarConfig(to);

    console.log(
      `  From: ${fromConfig.backgroundColor} (${fromConfig.barStyle})`,
    );
    console.log(`  To: ${toConfig.backgroundColor} (${toConfig.barStyle})`);

    // Apply the transition
    applyStatusBarConfig(toConfig);
    console.log(`  ✅ Applied transition to ${to}`);
  });
}

/**
 * Comprehensive test to verify every screen's StatusBar color is working
 */
export function testEveryScreenStatusBarColor() {
  console.log("🎨 Testing every screen's StatusBar color...");
  console.log('='.repeat(60));

  const results = {
    totalScreens: TEST_SCREENS.length,
    passed: 0,
    failed: 0,
    details: [] as Array<{
      screenName: string;
      status: 'PASS' | 'FAIL';
      config: any;
      issues: string[];
    }>,
  };

  TEST_SCREENS.forEach((screenName, index) => {
    console.log(`\n${index + 1}. Testing ${screenName}...`);

    const config = getStatusBarConfig(screenName);
    const issues: string[] = [];

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

    // Apply the configuration to test it
    try {
      applyStatusBarConfig(config);
      console.log(
        `  ✅ Applied: ${config.backgroundColor} (${config.barStyle})`,
      );
    } catch (error) {
      issues.push(`Failed to apply configuration: ${error}`);
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'PASS') {
      results.passed++;
    } else {
      results.failed++;
    }

    results.details.push({
      screenName,
      status,
      config,
      issues,
    });

    if (issues.length > 0) {
      console.log(`  ❌ Issues: ${issues.join(', ')}`);
    }
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

/**
 * Test StatusBar color consistency across screen categories
 */
export function testStatusBarColorConsistency() {
  console.log('🎨 Testing StatusBar color consistency...');

  const categories = {
    customerScreens: [
      'Customer',
      'CustomerDetail',
      'AddParty',
      'AddNewEntry',
      'AddCustomerFromContacts',
    ],
    standardScreens: [
      'Dashboard',
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
    customerScreens: { expected: '#4f8cff', actual: [] as string[] },
    standardScreens: { expected: '#f6fafc', actual: [] as string[] },
    gradientScreens: { expected: 'transparent', actual: [] as string[] },
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

/**
 * Run all StatusBar tests
 */
export function runAllStatusBarTests() {
  console.log('🚀 Running all StatusBar tests...');

  console.log('\n1. Testing all screen configurations:');
  testAllScreenConfigurations();

  console.log('\n2. Validating configurations:');
  const issues = validateStatusBarConfigurations();

  console.log('\n3. Testing transitions:');
  testStatusBarTransitions();

  console.log("\n4. Testing every screen's StatusBar color:");
  const colorTestResults = testEveryScreenStatusBarColor();

  console.log('\n5. Testing color consistency:');
  const consistencyResults = testStatusBarColorConsistency();

  console.log('\n🏁 StatusBar tests completed');

  return {
    totalScreens: TEST_SCREENS.length,
    issuesFound: issues.length,
    issues,
    colorTestResults,
    consistencyResults,
  };
}

export default {
  testAllScreenConfigurations,
  testScreenConfiguration,
  validateStatusBarConfigurations,
  testStatusBarTransitions,
  testEveryScreenStatusBarColor,
  testStatusBarColorConsistency,
  runAllStatusBarTests,
};
