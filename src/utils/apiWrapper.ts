import { sessionManager, handleApiResponse } from './sessionManager';

// Wrapper for fetch calls that automatically handles session validation
export const apiCall = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  console.log('🔍 apiCall: Starting session validation for:', url);

  // Check session before making API call
  const isSessionValid = await sessionManager.validateSession();
  console.log('🔍 apiCall: Session validation result:', isSessionValid);

  if (!isSessionValid) {
    console.log(
      '🚨 apiCall: Session validation failed, throwing Session expired',
    );
    throw new Error('Session expired');
  }

  try {
    console.log('🔍 apiCall: Making fetch request to:', url);
    const response = await fetch(url, options);
    console.log('🔍 apiCall: Response status:', response.status);

    // Handle auth errors automatically
    if (response.status === 401 || response.status === 403) {
      console.log('🚨 API returned auth error, forcing logout');
      await sessionManager.forceLogout();
      throw new Error('Authentication failed');
    }

    console.log('✅ apiCall: Request successful');
    return response;
  } catch (error) {
    console.error('❌ API call error:', error);
    throw error;
  }
};

// Wrapper for authenticated API calls
export const authenticatedApiCall = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  console.log('🔍 authenticatedApiCall: Starting API call to:', url);

  // Get token from storage
  const token = await sessionManager.getToken();
  console.log('🔍 authenticatedApiCall: Token check:', {
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
  });

  if (!token) {
    console.log('🚨 authenticatedApiCall: No token found, forcing logout');
    await sessionManager.forceLogout();
    throw new Error('No authentication token');
  }

  // Add authorization header
  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  console.log('🔍 authenticatedApiCall: Making API call with auth headers');
  return apiCall(url, authOptions);
};

// Example usage in your components:
// import { authenticatedApiCall } from '../utils/apiWrapper';
//
// const response = await authenticatedApiCall(`${BASE_URL}/vouchers`);
// const data = await response.json();
