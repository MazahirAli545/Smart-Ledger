import AsyncStorage from '@react-native-async-storage/async-storage';

// Navigation state management utilities
export class NavigationStateManager {
  private static instance: NavigationStateManager;
  private static readonly LAST_SCREEN_KEY = 'lastScreen';
  private static readonly LAST_SCREEN_PARAMS_KEY = 'lastScreenParams';
  private static readonly DEFAULT_SCREEN = 'Customer';

  static getInstance(): NavigationStateManager {
    if (!NavigationStateManager.instance) {
      NavigationStateManager.instance = new NavigationStateManager();
    }
    return NavigationStateManager.instance;
  }

  // Save the current screen and its parameters
  async saveNavigationState(screenName: string, params?: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NavigationStateManager.LAST_SCREEN_KEY,
        screenName,
      );
      if (params) {
        await AsyncStorage.setItem(
          NavigationStateManager.LAST_SCREEN_PARAMS_KEY,
          JSON.stringify(params),
        );
      } else {
        await AsyncStorage.removeItem(
          NavigationStateManager.LAST_SCREEN_PARAMS_KEY,
        );
      }
      console.log('💾 Navigation state saved:', { screen: screenName, params });
    } catch (error) {
      console.error('❌ Error saving navigation state:', error);
    }
  }

  // Get the last screen the user was on
  async getLastScreen(): Promise<{ screen: string; params?: any }> {
    try {
      const screen = await AsyncStorage.getItem(
        NavigationStateManager.LAST_SCREEN_KEY,
      );
      const paramsString = await AsyncStorage.getItem(
        NavigationStateManager.LAST_SCREEN_PARAMS_KEY,
      );

      let params;
      if (paramsString) {
        try {
          params = JSON.parse(paramsString);
        } catch (parseError) {
          console.error('❌ Error parsing navigation params:', parseError);
        }
      }

      const lastScreen = screen || NavigationStateManager.DEFAULT_SCREEN;
      console.log('🔍 Last screen retrieved:', { screen: lastScreen, params });

      return { screen: lastScreen, params };
    } catch (error) {
      console.error('❌ Error getting last screen:', error);
      return { screen: NavigationStateManager.DEFAULT_SCREEN };
    }
  }

  // Set the default screen for new logins
  async setDefaultScreen(screenName: string): Promise<void> {
    try {
      await AsyncStorage.setItem(
        NavigationStateManager.LAST_SCREEN_KEY,
        screenName,
      );
      console.log('🎯 Default screen set to:', screenName);
    } catch (error) {
      console.error('❌ Error setting default screen:', error);
    }
  }

  // Clear navigation state (on logout)
  async clearNavigationState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NavigationStateManager.LAST_SCREEN_KEY);
      await AsyncStorage.removeItem(
        NavigationStateManager.LAST_SCREEN_PARAMS_KEY,
      );
      console.log('🗑️ Navigation state cleared');
    } catch (error) {
      console.error('❌ Error clearing navigation state:', error);
    }
  }

  // Get the initial route for the app stack
  async getInitialRoute(): Promise<string> {
    try {
      const lastScreen = await this.getLastScreen();
      return lastScreen.screen;
    } catch (error) {
      console.error('❌ Error getting initial route:', error);
      return NavigationStateManager.DEFAULT_SCREEN;
    }
  }
}

// Export singleton instance
export const navigationStateManager = NavigationStateManager.getInstance();

// Utility functions
export const saveCurrentScreen = async (screenName: string, params?: any) => {
  await navigationStateManager.saveNavigationState(screenName, params);
};

export const getLastScreen = async () => {
  return await navigationStateManager.getLastScreen();
};

export const setDefaultScreen = async (screenName: string) => {
  await navigationStateManager.setDefaultScreen(screenName);
};

export const clearNavigationState = async () => {
  await navigationStateManager.clearNavigationState();
};
