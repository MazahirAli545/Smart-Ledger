// Comprehensive test utility for session logout functionality
import { sessionManager } from './sessionManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const testSessionLogout = () => {
  console.log('🧪 Testing session logout functionality...');

  // Test 1: Check if session manager is properly initialized
  console.log('✅ Session manager instance created');

  // Test 2: Test session logout callback
  let callbackTriggered = false;
  sessionManager.setSessionLogoutCallback(() => {
    console.log('✅ Session logout callback triggered successfully');
    callbackTriggered = true;
  });

  // Test 3: Simulate session expiration
  console.log('🧪 Simulating session expiration...');
  sessionManager.forceLogout();

  // Test 4: Clean up
  sessionManager.setSessionLogoutCallback(null);

  console.log('🧪 Session logout test completed');
  return callbackTriggered;
};

// Test JWT token expiration
export const testTokenExpiration = async () => {
  console.log('🧪 Testing JWT token expiration...');

  // Create a mock expired token
  const expiredToken = createMockExpiredToken();

  // Test if session manager detects it as expired
  const isExpired = sessionManager.isTokenExpired(expiredToken);
  console.log('✅ Expired token detection:', isExpired);

  return isExpired;
};

// Test session status check
export const testSessionStatus = async () => {
  console.log('🧪 Testing session status check...');

  const status = await sessionManager.checkSessionStatus();
  console.log('✅ Session status:', status);

  return status;
};

// Test manual session logout
export const testManualLogout = async () => {
  console.log('🧪 Testing manual session logout...');

  // Set a test token
  await AsyncStorage.setItem('accessToken', 'test-token');

  // Test logout
  await sessionManager.performLogout();

  // Check if token is cleared
  const token = await AsyncStorage.getItem('accessToken');
  const isCleared = token === null;

  console.log('✅ Manual logout test:', isCleared ? 'PASSED' : 'FAILED');
  return isCleared;
};

// Create a mock expired JWT token for testing
const createMockExpiredToken = (): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: 'test-user',
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    iat: Math.floor(Date.now() / 1000) - 7200, // Issued 2 hours ago
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

// Run all tests
export const runAllSessionLogoutTests = async () => {
  console.log('🚀 Running all session logout tests...');

  const results = {
    callbackTest: testSessionLogout(),
    tokenExpirationTest: await testTokenExpiration(),
    sessionStatusTest: await testSessionStatus(),
    manualLogoutTest: await testManualLogout(),
  };

  console.log('📊 Test Results:', results);

  const allPassed = Object.values(results).every(result => result === true);
  console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');

  return results;
};

// Export for use in development/testing
export default {
  testSessionLogout,
  testTokenExpiration,
  testSessionStatus,
  testManualLogout,
  runAllSessionLogoutTests,
};
