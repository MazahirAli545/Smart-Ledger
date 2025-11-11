/**
 * StatusBar Test Runner
 *
 * This script runs comprehensive tests to verify that every screen's StatusBar color
 * is working correctly. Run this script to test the StatusBar implementation.
 *
 * Usage: node test-statusbar.js
 */

// Import the test functions
const {
  testEveryScreenStatusBarColor,
  testStatusBarColorConsistency,
  runAllStatusBarTests,
} = require('./src/utils/statusBarTest');

console.log('🚀 Starting StatusBar Color Tests...');
console.log('=====================================\n');

// Run the comprehensive test for every screen
console.log("📱 Testing Every Screen's StatusBar Color:");
console.log('==========================================');
const colorTestResults = testEveryScreenStatusBarColor();

console.log('\n🎨 Testing Color Consistency:');
console.log('=============================');
const consistencyResults = testStatusBarColorConsistency();

console.log('\n📊 Final Test Summary:');
console.log('=====================');
console.log(`Total Screens Tested: ${colorTestResults.totalScreens}`);
console.log(`✅ Passed: ${colorTestResults.passed}`);
console.log(`❌ Failed: ${colorTestResults.failed}`);
console.log(
  `Success Rate: ${(
    (colorTestResults.passed / colorTestResults.totalScreens) *
    100
  ).toFixed(1)}%`,
);

console.log('\n🎯 Color Consistency Results:');
console.log(
  `Customer Screens: ${
    consistencyResults.customerConsistent ? '✅ Consistent' : '❌ Inconsistent'
  }`,
);
console.log(
  `Standard Screens: ${
    consistencyResults.standardConsistent ? '✅ Consistent' : '❌ Inconsistent'
  }`,
);
console.log(
  `Gradient Screens: ${
    consistencyResults.gradientConsistent ? '✅ Consistent' : '❌ Inconsistent'
  }`,
);

if (colorTestResults.failed > 0) {
  console.log('\n❌ Failed Screens Details:');
  colorTestResults.details
    .filter(detail => detail.status === 'FAIL')
    .forEach(detail => {
      console.log(`  - ${detail.screenName}: ${detail.issues.join(', ')}`);
    });
}

console.log('\n🏁 StatusBar Color Tests Completed!');
console.log('=====================================');

// Return results for programmatic use
module.exports = {
  colorTestResults,
  consistencyResults,
  allTestsPassed:
    colorTestResults.failed === 0 &&
    consistencyResults.customerConsistent &&
    consistencyResults.standardConsistent &&
    consistencyResults.gradientConsistent,
};
