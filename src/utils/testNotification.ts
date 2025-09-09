import {
  showTestNotification,
  showAccountCreatedNotification,
  showFolderCreatedNotification,
} from './notificationHelper';

/**
 * Test all notification functions
 */
export const testAllNotifications = async (): Promise<void> => {
  console.log('🧪 Testing all notification functions...');

  try {
    // Test 1: Basic notification
    console.log('Test 1: Basic notification');
    await showTestNotification();

    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Account creation notification
    console.log('Test 2: Account creation notification');
    await showAccountCreatedNotification();

    // Wait 2 seconds between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Folder creation notification
    console.log('Test 3: Folder creation notification');
    await showFolderCreatedNotification('Test Folder');

    console.log('✅ All notification tests completed');
  } catch (error) {
    console.error('❌ Error during notification testing:', error);
  }
};

/**
 * Test notifications one by one for debugging
 */
export const testNotificationStepByStep = {
  async testBasic() {
    console.log('🧪 Testing basic notification...');
    await showTestNotification();
  },

  async testAccount() {
    console.log('🧪 Testing account creation notification...');
    await showAccountCreatedNotification();
  },

  async testFolder() {
    console.log('🧪 Testing folder creation notification...');
    await showFolderCreatedNotification('Debug Test Folder');
  },
};

/**
 * Quick test function for account notification - call this directly
 */
export const quickTestAccountNotification = async (): Promise<void> => {
  console.log('🚀 Quick test: Account notification');
  try {
    await showAccountCreatedNotification();
    console.log('✅ Quick test completed');
  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
};
