import { useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { saveCurrentScreen } from '../utils/navigationStateManager';

// Custom hook to automatically track and save current screen
export const useScreenTracking = () => {
  const navigation = useNavigation();
  const route = useRoute();

  useEffect(() => {
    // Save current screen when component mounts
    const saveScreen = async () => {
      try {
        await saveCurrentScreen(route.name, route.params);
      } catch (error) {
        console.error('❌ Error saving screen state:', error);
      }
    };

    saveScreen();
  }, [route.name, route.params]);

  return { navigation, route };
};

// Alternative hook for screens that don't need navigation
export const useScreenTrackingOnly = () => {
  const route = useRoute();

  useEffect(() => {
    // Save current screen when component mounts
    const saveScreen = async () => {
      try {
        await saveCurrentScreen(route.name, route.params);
      } catch (error) {
        console.error('❌ Error saving screen state:', error);
      }
    };

    saveScreen();
  }, [route.name, route.params]);

  return { route };
};
