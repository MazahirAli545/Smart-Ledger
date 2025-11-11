import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize a global axios request interceptor that injects the access token
// from AsyncStorage into the Authorization header for every request, unless an
// Authorization header is already provided by the caller.
export const initializeAxiosAuth = () => {
  // Avoid registering multiple times in dev reloads
  const already = (axios.defaults as any)._authInterceptorRegistered;
  if (already) return;

  axios.interceptors.request.use(async config => {
    try {
      if (__DEV__) {
        // Lightweight log only in development
        console.log('🔧 Axios Interceptor: Processing request to:', config.url);
      }
      const existingAuth = config.headers?.Authorization as string | undefined;
      if (!existingAuth) {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          if (!config.headers) config.headers = {} as any;
          (config.headers as any).Authorization = `Bearer ${token}`;
          if (__DEV__) {
            console.log('🔧 Axios Interceptor: Added token to request');
          }
        } else {
          if (__DEV__) {
            console.log('⚠️ Axios Interceptor: No token found in AsyncStorage');
          }
        }
      } else {
        if (__DEV__) {
          console.log(
            '🔧 Axios Interceptor: Request already has Authorization header',
          );
        }
      }

      if (config.headers && !(config.headers as any)['Content-Type']) {
        (config.headers as any)['Content-Type'] = 'application/json';
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Axios Interceptor: Error:', error);
      }
      // no-op: requests can proceed without token
    }
    return config;
  });

  (axios.defaults as any)._authInterceptorRegistered = true;
};

// Auto-initialize when this module is imported
initializeAxiosAuth();
