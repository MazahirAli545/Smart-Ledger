import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_MOBILE_KEY = 'userMobileNumber';

export const setToken = async (token: string) => {
  await AsyncStorage.setItem(TOKEN_KEY, token);
};

export const getToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(TOKEN_KEY);
};

export const removeToken = async () => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export const setRefreshToken = async (token: string) => {
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
};

export const getRefreshToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
};

export const removeRefreshToken = async () => {
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const setUserMobile = async (mobile: string) => {
  await AsyncStorage.setItem(USER_MOBILE_KEY, mobile);
};

export const getUserMobile = async (): Promise<string | null> => {
  return AsyncStorage.getItem(USER_MOBILE_KEY);
};

export const removeUserMobile = async () => {
  await AsyncStorage.removeItem(USER_MOBILE_KEY);
};

export const clearAll = async () => {
  await AsyncStorage.multiRemove([
    TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_MOBILE_KEY,
  ]);
};

export const getUserIdFromToken = async (): Promise<number | null> => {
  const token = await AsyncStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const decoded: any = jwtDecode(token);
    // Adjust the property name if your JWT uses a different claim for user ID
    return decoded.user_id || decoded.id || decoded.sub || null;
  } catch (e) {
    return null;
  }
};
