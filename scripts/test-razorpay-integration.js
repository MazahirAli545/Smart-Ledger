#!/usr/bin/env node

/**
 * Razorpay Integration Test Script
 *
 * This script tests the basic Razorpay integration components
 * without requiring the full React Native environment.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Razorpay Integration...\n');

// Test 1: Check if required packages are installed
console.log('📦 Testing Package Dependencies...');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredPackages = [
  'react-native-razorpay',
  '@types/react-native-razorpay',
];

let packagesOk = true;
requiredPackages.forEach(pkg => {
  if (packageJson.dependencies[pkg] || packageJson.devDependencies[pkg]) {
    console.log(
      `  ✅ ${pkg} - ${
        packageJson.dependencies[pkg] || packageJson.devDependencies[pkg]
      }`,
    );
  } else {
    console.log(`  ❌ ${pkg} - NOT FOUND`);
    packagesOk = false;
  }
});

// Test 2: Check if payment service exists
console.log('\n🔧 Testing Payment Service...');
const paymentServicePath = path.join(
  __dirname,
  '..',
  'src',
  'services',
  'paymentService.ts',
);
if (fs.existsSync(paymentServicePath)) {
  console.log('  ✅ Payment service file exists');

  const serviceContent = fs.readFileSync(paymentServicePath, 'utf8');

  // Check for key components
  const checks = [
    { name: 'RazorpayCheckout import', pattern: /import RazorpayCheckout/ },
    { name: 'RAZORPAY_CONFIG', pattern: /RAZORPAY_CONFIG/ },
    { name: 'PaymentService class', pattern: /class PaymentService/ },
    { name: 'processPlanPayment method', pattern: /processPlanPayment/ },
    { name: 'RazorpayCheckout.open', pattern: /RazorpayCheckout\.open/ },
  ];

  checks.forEach(check => {
    if (check.pattern.test(serviceContent)) {
      console.log(`    ✅ ${check.name}`);
    } else {
      console.log(`    ❌ ${check.name}`);
    }
  });
} else {
  console.log('  ❌ Payment service file not found');
}

// Test 3: Check Android configuration
console.log('\n🤖 Testing Android Configuration...');
const buildGradlePath = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'build.gradle',
);
if (fs.existsSync(buildGradlePath)) {
  console.log('  ✅ Android build.gradle exists');

  const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
  if (buildGradleContent.includes('autolinkLibrariesWithApp()')) {
    console.log('    ✅ Autolinking enabled');
  } else {
    console.log('    ❌ Autolinking not found');
  }
} else {
  console.log('  ❌ Android build.gradle not found');
}

// Test 4: Check Android manifest
console.log('\n📱 Testing Android Manifest...');
const manifestPath = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);
if (fs.existsSync(manifestPath)) {
  console.log('  ✅ Android manifest exists');

  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  if (manifestContent.includes('android.permission.INTERNET')) {
    console.log('    ✅ Internet permission found');
  } else {
    console.log('    ❌ Internet permission missing');
  }
} else {
  console.log('  ❌ Android manifest not found');
}

// Test 5: Check subscription screen
console.log('\n📺 Testing Subscription Screen...');
const subscriptionScreenPath = path.join(
  __dirname,
  '..',
  'src',
  'screens',
  'SubscriptionPlanScreen.tsx',
);
if (fs.existsSync(subscriptionScreenPath)) {
  console.log('  ✅ Subscription screen exists');

  const screenContent = fs.readFileSync(subscriptionScreenPath, 'utf8');
  if (screenContent.includes('RazorpayCheckout')) {
    console.log('    ✅ RazorpayCheckout integration found');
  } else {
    console.log('    ❌ RazorpayCheckout integration missing');
  }
} else {
  console.log('  ❌ Subscription screen not found');
}

// Test 6: Check test files
console.log('\n🧪 Testing Test Files...');
const testFiles = ['RazorpayIntegration.test.tsx', 'payment-flow.spec.ts'];

testFiles.forEach(testFile => {
  const testPath = path.join(__dirname, '..', '__tests__', testFile);
  if (fs.existsSync(testPath)) {
    console.log(`  ✅ ${testFile} exists`);
  } else {
    console.log(`  ❌ ${testFile} not found`);
  }
});

// Test 7: Check documentation
console.log('\n📚 Testing Documentation...');
const docs = ['RAZORPAY_INTEGRATION_README.md', 'PAYMENT_INTEGRATION.md'];

docs.forEach(doc => {
  const docPath = path.join(__dirname, '..', doc);
  if (fs.existsSync(docPath)) {
    console.log(`  ✅ ${doc} exists`);
  } else {
    console.log(`  ❌ ${doc} not found`);
  }
});

// Summary
console.log('\n📊 Integration Test Summary');
console.log('============================');

if (packagesOk) {
  console.log('✅ All required packages are installed');
} else {
  console.log('❌ Some required packages are missing');
}

console.log('\n🎯 Next Steps:');
console.log('1. Run the app on Android device/emulator');
console.log('2. Navigate to subscription plans');
console.log('3. Click upgrade button on a paid plan');
console.log('4. Verify Razorpay checkout opens');
console.log('5. Test with Razorpay test cards');

console.log('\n🔗 Useful Commands:');
console.log('npm test                    # Run unit tests');
console.log(
  'npx playwright test        # Run E2E tests (after installing Playwright)',
);
console.log('npm run android            # Run on Android');

console.log('\n✨ Razorpay Integration Test Complete!');
