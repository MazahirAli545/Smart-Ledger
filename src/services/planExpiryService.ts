import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../api/unifiedApiService';

export interface PlanExpiryData {
  planName: string;
  expiredDate: string;
  shouldShow: boolean;
}

class PlanExpiryService {
  private static instance: PlanExpiryService;
  private notificationCallback: ((data: PlanExpiryData) => void) | null = null;
  private isServiceActive = false;
  private checkInterval: NodeJS.Timeout | null = null;

  static getInstance(): PlanExpiryService {
    if (!PlanExpiryService.instance) {
      PlanExpiryService.instance = new PlanExpiryService();
    }
    return PlanExpiryService.instance;
  }

  /**
   * Set callback for when plan expiry notification should be shown
   */
  setNotificationCallback(callback: (data: PlanExpiryData) => void) {
    this.notificationCallback = callback;
  }

  /**
   * Start the plan expiry monitoring service
   */
  async startExpiryMonitoring(): Promise<void> {
    if (this.isServiceActive) {
      console.log('📅 Plan expiry service already active');
      return;
    }

    try {
      console.log('🚀 Starting plan expiry monitoring service...');
      this.isServiceActive = true;

      // Check immediately on start
      await this.checkForExpiredPlan();

      // Set up interval to check every hour
      this.checkInterval = setInterval(async () => {
        await this.checkForExpiredPlan();
      }, 60 * 60 * 1000); // Check every hour

      console.log('✅ Plan expiry monitoring service started');
    } catch (error) {
      console.error('❌ Error starting plan expiry service:', error);
      this.isServiceActive = false;
    }
  }

  /**
   * Stop the plan expiry monitoring service
   */
  stopExpiryMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isServiceActive = false;
    console.log('🛑 Plan expiry monitoring service stopped');
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return this.isServiceActive;
  }

  /**
   * Check for expired plans and show notification if needed
   */
  async checkForExpiredPlan(): Promise<void> {
    try {
      console.log('🔍 Checking for expired plans...');

      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('📅 No auth token, skipping plan expiry check');
        return;
      }

      // Get user's subscription data - Use unified API
      let result;
      try {
        result = (await unifiedApi.get('/subscriptions/current')) as {
          data: any;
          status: number;
          headers: Headers;
        };
      } catch (e) {
        console.error('❌ Failed to fetch subscription data:', e);
        // If it's a 500 error, it might be a temporary server issue
        // Don't spam the console, just return silently
        return;
      }

      // unifiedApi handles errors automatically, so if we get here, we have data
      const resultData = result?.data ?? result ?? {};
      if (!resultData.success || !resultData.data) {
        console.log('📅 No active subscription found');
        return;
      }

      const subscription = resultData.data;
      const endDate = new Date(subscription.endDate);
      const now = new Date();

      console.log('📅 Subscription details:', {
        planName:
          subscription.plan?.displayName ||
          subscription.plan?.name ||
          'Unknown',
        endDate: endDate.toISOString(),
        now: now.toISOString(),
        isExpired: endDate < now,
      });

      // Check if plan has expired
      if (endDate < now) {
        const planName =
          subscription.plan?.displayName ||
          subscription.plan?.name ||
          'Unknown';
        const expiredDate = subscription.endDate;

        console.log('⚠️ Plan has expired:', { planName, expiredDate });

        // Check if we should show notification (not shown in last 24 hours)
        const shouldShow = await this.shouldShowExpiryNotification();
        if (shouldShow) {
          const expiryData: PlanExpiryData = {
            planName,
            expiredDate,
            shouldShow: true,
          };

          // Store that we've shown this notification
          await this.markExpiryNotificationShown();

          // Trigger the notification callback
          if (this.notificationCallback) {
            this.notificationCallback(expiryData);
          }
        }
      } else {
        console.log('✅ Plan is still active');
      }
    } catch (error) {
      console.error('❌ Error checking for expired plan:', error);
    }
  }

  /**
   * Check if we should show expiry notification (not shown in last 24 hours)
   */
  private async shouldShowExpiryNotification(): Promise<boolean> {
    try {
      const lastShown = await AsyncStorage.getItem(
        'planExpiryNotificationLastShown',
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
      console.error('❌ Error checking expiry notification timing:', error);
      return true; // Default to showing if error
    }
  }

  /**
   * Mark that we've shown the expiry notification
   */
  private async markExpiryNotificationShown(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'planExpiryNotificationLastShown',
        new Date().toISOString(),
      );
    } catch (error) {
      console.error('❌ Error marking expiry notification as shown:', error);
    }
  }

  /**
   * Force check for expired plan (for testing)
   */
  async forceCheckExpiredPlan(): Promise<void> {
    console.log('🔍 Force checking for expired plan...');
    await this.checkForExpiredPlan();
  }

  /**
   * Clear expiry notification data (for testing)
   */
  async clearExpiryNotificationData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('planExpiryNotificationLastShown');
      console.log('✅ Expiry notification data cleared');
    } catch (error) {
      console.error('❌ Error clearing expiry notification data:', error);
    }
  }

  /**
   * Get current expiry notification status
   */
  async getExpiryNotificationStatus(): Promise<{
    serviceActive: boolean;
    lastShown: string | null;
    hoursSinceLastShown: number | null;
  }> {
    try {
      const lastShown = await AsyncStorage.getItem(
        'planExpiryNotificationLastShown',
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
      console.error('❌ Error getting expiry notification status:', error);
      return {
        serviceActive: this.isServiceActive,
        lastShown: null,
        hoursSinceLastShown: null,
      };
    }
  }
}

export default PlanExpiryService;
