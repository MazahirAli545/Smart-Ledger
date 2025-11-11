import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api';
import { showTransactionLimitNotification } from '../utils/notificationHelper';

export interface TransactionLimitData {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  planName: string;
  percentageUsed: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  nextResetDate: string;
  shouldShow: boolean;
}

class TransactionLimitNotificationService {
  private static instance: TransactionLimitNotificationService;
  private notificationCallback: ((data: TransactionLimitData) => void) | null =
    null;
  private isServiceActive = false;
  private checkInterval: NodeJS.Timeout | null = null;

  static getInstance(): TransactionLimitNotificationService {
    if (!TransactionLimitNotificationService.instance) {
      TransactionLimitNotificationService.instance =
        new TransactionLimitNotificationService();
    }
    return TransactionLimitNotificationService.instance;
  }

  /**
   * Set callback for when transaction limit notification should be shown
   */
  setNotificationCallback(callback: (data: TransactionLimitData) => void) {
    this.notificationCallback = callback;
  }

  /**
   * Start the transaction limit monitoring service
   */
  async startLimitMonitoring(): Promise<void> {
    if (this.isServiceActive) {
      console.log('📊 [DEBUG] Transaction limit service already active');
      return;
    }

    try {
      console.log(
        '🚀 [DEBUG] Starting transaction limit monitoring service...',
      );
      this.isServiceActive = true;

      // Check immediately on start
      console.log('🔍 [DEBUG] Running initial transaction limit check...');
      await this.checkTransactionLimit();

      // Set up interval to check every 5 minutes for better responsiveness
      const checkInterval = 5 * 60 * 1000; // 5 minutes
      console.log(
        '⏰ [DEBUG] Setting up interval check every',
        checkInterval / 1000,
        'seconds...',
      );
      this.checkInterval = setInterval(async () => {
        console.log('⏰ [DEBUG] Interval check triggered...');
        await this.checkTransactionLimit();
      }, checkInterval);

      console.log(
        '✅ [DEBUG] Transaction limit monitoring service started successfully',
      );
    } catch (error) {
      console.error(
        '❌ [DEBUG] Error starting transaction limit service:',
        error,
      );
      this.isServiceActive = false;
    }
  }

  /**
   * Stop the transaction limit monitoring service
   */
  stopLimitMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isServiceActive = false;
    console.log('🛑 Transaction limit monitoring service stopped');
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return this.isServiceActive;
  }

  /**
   * Check transaction limit and show notification if needed
   */
  async checkTransactionLimit(): Promise<void> {
    try {
      console.log('🔍 [DEBUG] Starting transaction limit check...');
      console.log('🔍 [DEBUG] Service active:', this.isServiceActive);
      console.log(
        '🔍 [DEBUG] Notification callback set:',
        !!this.notificationCallback,
      );

      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log(
          '📊 [DEBUG] No auth token, skipping transaction limit check',
        );
        return;
      }

      console.log('📊 [DEBUG] Auth token found, making API request...');

      // Get user's transaction limit info - Use unified API
      const result = await unifiedApi.get('/transaction-limits/info');
      console.log('📊 [DEBUG] API Response:', JSON.stringify(result, null, 2));

      if (result.code !== 200 || !result.data) {
        console.log(
          '📊 [DEBUG] No transaction limit data found or API error:',
          result,
        );
        return;
      }

      const limitData = result.data;
      console.log('📊 [DEBUG] Transaction limit details:', {
        currentCount: limitData.currentCount,
        maxAllowed: limitData.maxAllowed,
        percentageUsed: limitData.percentageUsed,
        planName: limitData.planName,
        isNearLimit: limitData.isNearLimit,
        isAtLimit: limitData.isAtLimit,
        isUnlimited: limitData.isUnlimited,
      });

      // Skip notification for unlimited plans
      if (limitData.isUnlimited || limitData.maxAllowed === 0) {
        console.log(
          '📊 [DEBUG] User has unlimited plan, skipping notification',
        );
        return;
      }

      // Check if user is at 95% or more of their limit
      console.log(
        '📊 [DEBUG] Checking if percentageUsed >= 95:',
        limitData.percentageUsed >= 95,
      );
      if (limitData.percentageUsed >= 95) {
        console.log('⚠️ [DEBUG] Transaction limit reached 95%:', {
          percentageUsed: limitData.percentageUsed,
          currentCount: limitData.currentCount,
          maxAllowed: limitData.maxAllowed,
        });

        // Check if we should show notification (not shown in last 24 hours)
        const shouldShow = await this.shouldShowLimitNotification();
        console.log('📊 [DEBUG] Should show notification:', shouldShow);
        if (shouldShow) {
          const notificationData: TransactionLimitData = {
            currentCount: limitData.currentCount,
            maxAllowed: limitData.maxAllowed,
            remaining: limitData.remaining,
            planName: limitData.planName,
            percentageUsed: limitData.percentageUsed,
            isNearLimit: limitData.isNearLimit,
            isAtLimit: limitData.isAtLimit,
            nextResetDate: limitData.nextResetDate,
            shouldShow: true,
          };

          // Store that we've shown this notification
          await this.markLimitNotificationShown();

          // Show local notification
          try {
            await showTransactionLimitNotification(
              limitData.currentCount,
              limitData.maxAllowed,
              limitData.planName,
              limitData.percentageUsed,
            );
          } catch (notificationError) {
            console.error(
              '❌ Failed to show transaction limit notification:',
              notificationError,
            );
          }

          // Trigger the notification callback
          console.log('📊 [DEBUG] Triggering notification callback...');
          if (this.notificationCallback) {
            this.notificationCallback(notificationData);
            console.log(
              '📊 [DEBUG] Notification callback triggered successfully',
            );
          } else {
            console.log('📊 [DEBUG] No notification callback set');
          }
        } else {
          console.log('📊 [DEBUG] Notification not shown due to cooldown');
        }
      } else {
        console.log('✅ [DEBUG] Transaction limit is within normal range');
      }
    } catch (error) {
      console.error('❌ Error checking transaction limit:', error);
    }
  }

  /**
   * Check if we should show limit notification (not shown in last 24 hours)
   */
  private async shouldShowLimitNotification(): Promise<boolean> {
    try {
      const lastShown = await AsyncStorage.getItem(
        'transactionLimitNotificationLastShown',
      );
      if (!lastShown) {
        return true;
      }

      const lastShownDate = new Date(lastShown);
      const now = new Date();
      const hoursSinceLastShown =
        (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60);

      // Show notification if not shown in last 24 hours
      return hoursSinceLastShown >= 24;
    } catch (error) {
      console.error('❌ Error checking limit notification timing:', error);
      return true; // Default to showing if error
    }
  }

  /**
   * Mark that we've shown the limit notification
   */
  private async markLimitNotificationShown(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'transactionLimitNotificationLastShown',
        new Date().toISOString(),
      );
    } catch (error) {
      console.error('❌ Error marking limit notification as shown:', error);
    }
  }

  /**
   * Force check transaction limit (for testing)
   */
  async forceCheckTransactionLimit(): Promise<void> {
    console.log('🔍 [DEBUG] Force checking transaction limit...');
    await this.checkTransactionLimit();
  }

  /**
   * Force trigger notification for testing (bypasses cooldown)
   */
  async forceTriggerNotification(): Promise<void> {
    console.log('🔍 [DEBUG] Force triggering notification for testing...');

    // Clear cooldown first
    await this.clearLimitNotificationData();

    // Create test data
    const testData: TransactionLimitData = {
      currentCount: 4999,
      maxAllowed: 5000,
      remaining: 1,
      planName: 'Enterprise',
      percentageUsed: 99.98,
      isNearLimit: true,
      isAtLimit: false,
      nextResetDate: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      shouldShow: true,
    };

    // Trigger the notification callback
    if (this.notificationCallback) {
      this.notificationCallback(testData);
      console.log('🔍 [DEBUG] Test notification triggered');
    } else {
      console.log('🔍 [DEBUG] No notification callback set');
    }
  }

  /**
   * Clear limit notification data (for testing)
   */
  async clearLimitNotificationData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('transactionLimitNotificationLastShown');
      console.log('✅ Transaction limit notification data cleared');
    } catch (error) {
      console.error('❌ Error clearing limit notification data:', error);
    }
  }

  /**
   * Get current limit notification status
   */
  async getLimitNotificationStatus(): Promise<{
    serviceActive: boolean;
    lastShown: string | null;
    hoursSinceLastShown: number | null;
  }> {
    try {
      const lastShown = await AsyncStorage.getItem(
        'transactionLimitNotificationLastShown',
      );
      let hoursSinceLastShown: number | null = null;

      if (lastShown) {
        const lastShownDate = new Date(lastShown);
        const now = new Date();
        hoursSinceLastShown =
          (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60);
      }

      return {
        serviceActive: this.isServiceActive,
        lastShown,
        hoursSinceLastShown,
      };
    } catch (error) {
      console.error('❌ Error getting limit notification status:', error);
      return {
        serviceActive: this.isServiceActive,
        lastShown: null,
        hoursSinceLastShown: null,
      };
    }
  }
}

export default TransactionLimitNotificationService;
