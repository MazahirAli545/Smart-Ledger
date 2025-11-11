/**
 * @format
 */

import { AppRegistry } from 'react-native';
<<<<<<< Updated upstream
import App from './App';
import { name as appName } from './app.json';

=======
import { initGlobalTypography } from './src/config/typography';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Initialize global typography before any UI renders
initGlobalTypography();

// Register background handler at app level for better reliability
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📱 Background message received at app level:', remoteMessage);
  // The service will handle the actual processing
});

>>>>>>> Stashed changes
AppRegistry.registerComponent(appName, () => App);
