/**
 * Session Warm-Up Service
 *
 * This service handles warming up the app's network connections and cache
 * when the app returns to foreground after being in background for extended periods.
 *
 * It performs lightweight API calls to:
 * - Re-establish network connections (TLS, DNS, keep-alive)
 * - Refresh authentication tokens
 * - Pre-populate cache with frequently accessed data
 * - Reduce perceived latency when user navigates to screens
 *
 * All warm-up operations are non-blocking and won't interfere with user interactions.
 */

import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedApi } from '../api/unifiedApiService';

interface WarmUpConfig {
  /** Minimum time in background (ms) before warm-up triggers. Default: 5 minutes */
  minBackgroundTime: number;
  /** Whether warm-up is enabled. Default: true */
  enabled: boolean;
  /** Timeout for warm-up operations (ms). Default: 10 seconds */
  timeout: number;
}

interface WarmUpState {
  lastBackgroundTime: number | null;
  isWarmingUp: boolean;
  lastWarmUpTime: number | null;
}

class SessionWarmUpService {
  private static instance: SessionWarmUpService;
  private appStateSubscription: any = null;
  private currentAppState: AppStateStatus = AppState.currentState;
  private config: WarmUpConfig = {
    minBackgroundTime: 5 * 60 * 1000, // 5 minutes
    enabled: true,
    timeout: 10000, // 10 seconds
  };
  private state: WarmUpState = {
    lastBackgroundTime: null,
    isWarmingUp: false,
    lastWarmUpTime: null,
  };
  private warmUpAbortController: AbortController | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): SessionWarmUpService {
    if (!SessionWarmUpService.instance) {
      SessionWarmUpService.instance = new SessionWarmUpService();
    }
    return SessionWarmUpService.instance;
  }

  /**
   * Initialize the warm-up service
   * Call this once when app starts
   */
  public initialize(): void {
    if (!this.config.enabled) {
      console.log('🔥 SessionWarmUpService: Disabled, skipping initialization');
      return;
    }

    console.log('🔥 SessionWarmUpService: Initializing...');
    this.setupAppStateListener();
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.cancelWarmUp();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<WarmUpConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('🔥 SessionWarmUpService: Config updated', this.config);
  }

  /**
   * Setup AppState listener to detect foreground/background transitions
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this),
    );
    console.log('🔥 SessionWarmUpService: AppState listener setup complete');
  }

  /**
   * Handle app state changes
   */
  private async handleAppStateChange(
    nextAppState: AppStateStatus,
  ): Promise<void> {
    const wasInBackground =
      this.currentAppState === 'background' ||
      this.currentAppState === 'inactive';
    const isNowActive = nextAppState === 'active';

    // Track when app goes to background
    if (isNowActive && wasInBackground) {
      const backgroundDuration = this.state.lastBackgroundTime
        ? Date.now() - this.state.lastBackgroundTime
        : 0;

      console.log('🔥 SessionWarmUpService: App resumed from background', {
        backgroundDuration: `${Math.round(backgroundDuration / 1000)}s`,
        minRequired: `${Math.round(this.config.minBackgroundTime / 1000)}s`,
      });

      // Only warm up if app was in background long enough
      if (
        backgroundDuration >= this.config.minBackgroundTime ||
        !this.state.lastBackgroundTime
      ) {
        // Delay warm-up slightly to let app fully initialize
        setTimeout(() => {
          this.performWarmUp();
        }, 500);
      }
    } else if (wasInBackground && !isNowActive) {
      // App is going to background - record the time
      this.state.lastBackgroundTime = Date.now();
      console.log('🔥 SessionWarmUpService: App going to background');
    }

    this.currentAppState = nextAppState;
  }

  /**
   * Perform warm-up operations
   * This runs lightweight API calls to warm up connections and cache
   */
  private async performWarmUp(): Promise<void> {
    // Prevent concurrent warm-ups
    if (this.state.isWarmingUp) {
      console.log(
        '🔥 SessionWarmUpService: Warm-up already in progress, skipping',
      );
      return;
    }

    // Check if user is authenticated
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        console.log('🔥 SessionWarmUpService: No auth token, skipping warm-up');
        return;
      }
    } catch (error) {
      console.log(
        '🔥 SessionWarmUpService: Error checking token, skipping warm-up',
        error,
      );
      return;
    }

    // Don't warm up too frequently (max once per 2 minutes)
    const timeSinceLastWarmUp = this.state.lastWarmUpTime
      ? Date.now() - this.state.lastWarmUpTime
      : Infinity;
    if (timeSinceLastWarmUp < 2 * 60 * 1000) {
      console.log(
        '🔥 SessionWarmUpService: Warm-up performed recently, skipping',
        `${Math.round(timeSinceLastWarmUp / 1000)}s ago`,
      );
      return;
    }

    this.state.isWarmingUp = true;
    this.state.lastWarmUpTime = Date.now();

    // Create abort controller for timeout
    this.warmUpAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      if (this.warmUpAbortController) {
        this.warmUpAbortController.abort();
      }
    }, this.config.timeout);

    console.log('🔥 SessionWarmUpService: Starting warm-up...');

    try {
      // Perform warm-up operations in parallel
      // These are lightweight calls that re-establish connections
      const warmUpPromises = [
        this.warmUpUserProfile(),
        this.warmUpSmsStatus(), // Lightweight health check
        this.warmUpCustomersData(), // Pre-warm customers/suppliers data for CustomerScreen
      ];

      // Wait for all warm-up operations with timeout
      await Promise.allSettled(warmUpPromises);

      console.log('🔥 SessionWarmUpService: Warm-up completed successfully');
    } catch (error: any) {
      // Don't throw - warm-up failures shouldn't break the app
      if (error.name === 'AbortError') {
        console.log('🔥 SessionWarmUpService: Warm-up timed out');
      } else {
        console.log(
          '🔥 SessionWarmUpService: Warm-up error (non-critical)',
          error.message,
        );
      }
    } finally {
      clearTimeout(timeoutId);
      this.state.isWarmingUp = false;
      this.warmUpAbortController = null;
    }
  }

  /**
   * Warm up user profile endpoint
   * This refreshes auth token and pre-populates user data cache
   */
  private async warmUpUserProfile(): Promise<void> {
    try {
      await unifiedApi.getUserProfile();
      console.log('🔥 SessionWarmUpService: User profile warmed up');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log(
          '🔥 SessionWarmUpService: User profile warm-up failed',
          error.message,
        );
      }
      throw error;
    }
  }

  /**
   * Warm up SMS status endpoint
   * This is a lightweight health check that re-establishes network connections
   */
  private async warmUpSmsStatus(): Promise<void> {
    try {
      await unifiedApi.getSmsStatus();
      console.log('🔥 SessionWarmUpService: SMS status warmed up');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log(
          '🔥 SessionWarmUpService: SMS status warm-up failed',
          error.message,
        );
      }
      // SMS status failures are non-critical, don't throw
    }
  }

  /**
   * Warm up customers data endpoint
   * This pre-populates cache for CustomerScreen to reduce load time
   */
  private async warmUpCustomersData(): Promise<void> {
    try {
      // Pre-warm customers data (first page, 50 items)
      // This will populate cache and warm up network connections
      await unifiedApi.getCustomers('', 1, 50);
      console.log('🔥 SessionWarmUpService: Customers data warmed up');
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log(
          '🔥 SessionWarmUpService: Customers data warm-up failed',
          error.message,
        );
      }
      // Customers warm-up failures are non-critical, don't throw
    }
  }

  /**
   * Cancel ongoing warm-up operations
   */
  private cancelWarmUp(): void {
    if (this.warmUpAbortController) {
      this.warmUpAbortController.abort();
      this.warmUpAbortController = null;
    }
    this.state.isWarmingUp = false;
  }

  /**
   * Manually trigger warm-up (for testing or special cases)
   */
  public async triggerWarmUp(): Promise<void> {
    console.log('🔥 SessionWarmUpService: Manual warm-up triggered');
    await this.performWarmUp();
  }

  /**
   * Get current warm-up state (for debugging)
   */
  public getState(): WarmUpState {
    return { ...this.state };
  }
}

// Export singleton instance
export const sessionWarmUpService = SessionWarmUpService.getInstance();
export default sessionWarmUpService;
