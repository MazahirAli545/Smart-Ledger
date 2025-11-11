/**
 * API Error Handler Utility
 *
 * Provides helper functions to handle API errors gracefully,
 * especially 403 Forbidden errors related to permissions.
 */

import { ApiError } from '../api/unifiedApiService';

/**
 * Check if an error is a 403 Forbidden error
 */
export function isForbiddenError(error: any): boolean {
  if (error instanceof ApiError) {
    return error.status === 403;
  }
  // Check if error message contains forbidden-related text
  const errorMessage = error?.message || String(error || '');
  return (
    errorMessage.includes('forbidden') ||
    errorMessage.includes('Access forbidden') ||
    errorMessage.includes('permissions') ||
    errorMessage.includes('403')
  );
}

/**
 * Get a user-friendly error message for API errors
 */
export function getApiErrorMessage(error: any): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "You don't have permission to perform this action. Please contact your administrator to update your permissions.";
    } else if (error.status === 401) {
      return 'Your session has expired. Please login again.';
    } else if (error.status >= 500) {
      return 'Server error occurred. Please try again later.';
    }
    return error.message || 'An error occurred. Please try again.';
  }

  // Fallback for non-ApiError errors
  const errorMessage = error?.message || String(error || '');
  if (isForbiddenError(error)) {
    return "You don't have permission to perform this action. Please contact your administrator to update your permissions.";
  }
  return errorMessage || 'An error occurred. Please try again.';
}

/**
 * Handle API error and return whether it was a 403 error
 * This can be used to determine if the error should be shown to the user
 */
export function handleApiError(error: any): {
  isForbidden: boolean;
  message: string;
  status?: number;
} {
  const isForbidden = isForbiddenError(error);
  const message = getApiErrorMessage(error);
  const status = error instanceof ApiError ? error.status : undefined;

  return {
    isForbidden,
    message,
    status,
  };
}
