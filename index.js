/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register background handler at app level for better reliability
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📱 Background message received at app level:', remoteMessage);
  // The service will handle the actual processing
});

AppRegistry.registerComponent(appName, () => App);
