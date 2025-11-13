/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { initGlobalTypography } from './src/config/typography';
import App from './App';
import { name as appName } from './app.json';

// Initialize global typography before any UI renders
initGlobalTypography();

// Firebase messaging setup is handled in the notification services
// React Native Firebase auto-initializes from google-services.json
// Background message handler is registered in properSystemNotificationService

AppRegistry.registerComponent(appName, () => App);
