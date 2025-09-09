import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../api';
import { Platform } from 'react-native';

export interface SubscriptionData {
  id: number;
  userId: number;
  planId: number;
  status: string;
  startDate: string;
  endDate: string;
  nextBillingDate: string;
  amount: number;
  autoRenewal: boolean;
  plan: {
    id: number;
    name: string;
    displayName: string;
    price: number;
    currency: string;
    billingCycle: string;
  };
}

export interface RenewalNotificationData {
  daysUntilExpiry: number;
  subscription: SubscriptionData;
  shouldShow: boolean;
  lastShown?: string;
}

class SubscriptionNotificationService {
  private static instance: SubscriptionNotificationService;
  private notificationInterval: NodeJS.Timeout | null = null;
  private isActive = false;

  private constructor() {}

  public static getInstance(): SubscriptionNotificationService {
    if (!SubscriptionNotificationService.instance) {
      SubscriptionNotificationService.instance =
        new SubscriptionNotificationService();
    }
    return SubscriptionNotificationService.instance;
  }

  /**
   * Start the subscription renewal notification system
   */
  public async startNotificationSystem(): Promise<void> {
    if (this.isActive) {
      console.log('🔄 Subscription notification system already active');
      return;
    }

    try {
      console.log('🚀 Starting subscription renewal notification system...');

      // Check immediately
      await this.checkAndShowRenewalNotification();

      // Set up 24-hour interval (24 * 60 * 60 * 1000 ms)
      this.notificationInterval = setInterval(async () => {
        await this.checkAndShowRenewalNotification();
      }, 24 * 60 * 60 * 1000);

      this.isActive = true;
      console.log('✅ Subscription renewal notification system started');
    } catch (error) {
      console.error(
        '❌ Error starting subscription notification system:',
        error,
      );
    }
  }

  /**
   * Stop the subscription renewal notification system
   */
  public stopNotificationSystem(): void {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = null;
    }
    this.isActive = false;
    console.log('🛑 Subscription renewal notification system stopped');
  }

  /**
   * Check subscription status and show notification if needed
   */
  private async checkAndShowRenewalNotification(): Promise<void> {
    try {
      console.log('🔍 Checking subscription renewal status...');

      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        console.log('⚠️ No access token, skipping subscription check');
        return;
      }

      // Get user's subscription data
      const subscriptionData = await this.getUserSubscription(accessToken);
      if (!subscriptionData) {
        console.log('⚠️ No active subscription found');
        return;
      }

      // Check if notification should be shown
      const notificationData =
        this.shouldShowRenewalNotification(subscriptionData);
      if (notificationData.shouldShow) {
        console.log('📢 Showing renewal notification:', notificationData);
        await this.showRenewalNotification(notificationData);
        await this.updateLastShownTime();
      } else {
        console.log('ℹ️ No renewal notification needed');
      }
    } catch (error) {
      console.error('❌ Error checking subscription renewal:', error);
    }
  }

  /**
   * Get user's subscription data from backend
   */
  private async getUserSubscription(
    accessToken: string,
  ): Promise<SubscriptionData | null> {
    try {
      const response = await fetch(`${BASE_URL}/subscriptions/my`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.log('❌ Failed to fetch subscription data:', response.status);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching subscription data:', error);
      return null;
    }
  }

  /**
   * Determine if renewal notification should be shown
   */
  private shouldShowRenewalNotification(
    subscription: SubscriptionData,
  ): RenewalNotificationData {
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const daysUntilExpiry = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    console.log('📅 Subscription expiry check:', {
      endDate: subscription.endDate,
      daysUntilExpiry,
      status: subscription.status,
      autoRenewal: subscription.autoRenewal,
    });

    // Only show notification if:
    // 1. Subscription is active
    // 2. Within last 10 days of expiry
    // 3. Haven't shown notification in last 24 hours
    const shouldShow =
      subscription.status === 'active' &&
      daysUntilExpiry <= 10 &&
      daysUntilExpiry > 0 &&
      !this.hasShownNotificationRecently();

    return {
      daysUntilExpiry,
      subscription,
      shouldShow,
    };
  }

  /**
   * Check if notification was shown recently (within 24 hours)
   */
  private async hasShownNotificationRecently(): Promise<boolean> {
    try {
      const lastShown = await AsyncStorage.getItem(
        'subscriptionNotificationLastShown',
      );
      if (!lastShown) {
        return false;
      }

      const lastShownDate = new Date(lastShown);
      const now = new Date();
      const hoursSinceLastShown =
        (now.getTime() - lastShownDate.getTime()) / (1000 * 60 * 60);

      return hoursSinceLastShown < 24;
    } catch (error) {
      console.error('❌ Error checking last shown time:', error);
      return false;
    }
  }

  /**
   * Update the last shown time
   */
  private async updateLastShownTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'subscriptionNotificationLastShown',
        new Date().toISOString(),
      );
    } catch (error) {
      console.error('❌ Error updating last shown time:', error);
    }
  }

  /**
   * Show renewal notification (this will be handled by the UI component)
   */
  private async showRenewalNotification(
    notificationData: RenewalNotificationData,
  ): Promise<void> {
    try {
      // Store notification data for UI component to access
      await AsyncStorage.setItem(
        'pendingRenewalNotification',
        JSON.stringify(notificationData),
      );

      // Trigger notification display through event system
      this.triggerNotificationDisplay(notificationData);
    } catch (error) {
      console.error('❌ Error showing renewal notification:', error);
    }
  }

  /**
   * Trigger notification display through callback system
   */
  private onNotificationCallback:
    | ((notification: RenewalNotificationData) => void)
    | null = null;

  public setNotificationCallback(
    callback: (notification: RenewalNotificationData) => void,
  ): void {
    this.onNotificationCallback = callback;
  }

  public triggerNotificationDisplay(
    notificationData: RenewalNotificationData,
  ): void {
    if (this.onNotificationCallback) {
      this.onNotificationCallback(notificationData);
    }
  }

  /**
   * Get pending renewal notification
   */
  public async getPendingRenewalNotification(): Promise<RenewalNotificationData | null> {
    try {
      const notification = await AsyncStorage.getItem(
        'pendingRenewalNotification',
      );
      if (notification) {
        return JSON.parse(notification);
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting pending renewal notification:', error);
      return null;
    }
  }

  /**
   * Clear pending renewal notification
   */
  public async clearPendingRenewalNotification(): Promise<void> {
    try {
      await AsyncStorage.removeItem('pendingRenewalNotification');
    } catch (error) {
      console.error('❌ Error clearing pending renewal notification:', error);
    }
  }

  /**
   * Force check subscription status (for manual testing)
   */
  public async forceCheckSubscription(): Promise<void> {
    await this.checkAndShowRenewalNotification();
  }

  /**
   * Get subscription status for display
   */
  public async getSubscriptionStatus(): Promise<{
    hasActiveSubscription: boolean;
    daysUntilExpiry: number | null;
    subscription: SubscriptionData | null;
  }> {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        return {
          hasActiveSubscription: false,
          daysUntilExpiry: null,
          subscription: null,
        };
      }

      const subscription = await this.getUserSubscription(accessToken);
      if (!subscription) {
        return {
          hasActiveSubscription: false,
          daysUntilExpiry: null,
          subscription: null,
        };
      }

      const now = new Date();
      const endDate = new Date(subscription.endDate);
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        hasActiveSubscription: subscription.status === 'active',
        daysUntilExpiry,
        subscription,
      };
    } catch (error) {
      console.error('❌ Error getting subscription status:', error);
      return {
        hasActiveSubscription: false,
        daysUntilExpiry: null,
        subscription: null,
      };
    }
  }

  /**
   * Check if service is active
   */
  public isServiceActive(): boolean {
    return this.isActive;
  }
}

export default SubscriptionNotificationService;
