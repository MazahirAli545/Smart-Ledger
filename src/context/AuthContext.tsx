import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the shape of the authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    token: string | null | undefined,
    refreshToken: string | null | undefined,
    profileComplete?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      setIsAuthenticated(!!token);
      setLoading(false);
    };
    checkToken();
  }, []);

  const login = async (
    token: string | null | undefined,
    refreshToken: string | null | undefined,
    profileComplete?: boolean,
  ) => {
    if (token != null) {
      await AsyncStorage.setItem('accessToken', token);
    } else {
      await AsyncStorage.removeItem('accessToken');
    }
    if (refreshToken != null) {
      await AsyncStorage.setItem('refreshToken', refreshToken);
    } else {
      await AsyncStorage.removeItem('refreshToken');
    }
    if (profileComplete) {
      setIsAuthenticated(true);
    }
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
