/**
 * useMutation Hook
 *
 * Provides safe mutation handling for POST/PUT/PATCH/DELETE operations
 * with built-in loading states, error handling, and duplicate prevention
 */

import { useState, useCallback, useRef } from 'react';
import { unifiedApi, ApiError } from '../api/unifiedApiService';

export interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error | ApiError, variables: TVariables) => void;
  onSettled?: (
    data: TData | null,
    error: Error | ApiError | null,
    variables: TVariables,
  ) => void;
  useIdempotency?: boolean;
  validatePayload?: (payload: TVariables) => {
    valid: boolean;
    errors: string[];
  };
}

export interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | null>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  error: Error | ApiError | null;
  data: TData | null;
  reset: () => void;
}

/**
 * Hook for safe mutation operations (POST/PUT/PATCH/DELETE)
 *
 * @example
 * const { mutate, isLoading, error } = useMutation({
 *   onSuccess: (data) => console.log('Success:', data),
 *   onError: (error) => console.error('Error:', error),
 * });
 *
 * // Usage
 * await mutate({ name: 'John', email: 'john@example.com' });
 */
export function useMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {},
): UseMutationResult<TData, TVariables> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | ApiError | null>(null);
  const [data, setData] = useState<TData | null>(null);
  const inFlightRef = useRef<Promise<TData> | null>(null);

  const {
    onSuccess,
    onError,
    onSettled,
    useIdempotency = true,
    validatePayload,
  } = options;

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      // Prevent duplicate calls
      if (inFlightRef.current) {
        console.warn(
          '⚠️ Mutation already in progress, ignoring duplicate call',
        );
        return inFlightRef.current.then(() => data).catch(() => null);
      }

      // Validate payload if validator provided
      if (validatePayload) {
        const validation = validatePayload(variables);
        if (!validation.valid) {
          const validationError = new Error(
            `Validation failed: ${validation.errors.join(', ')}`,
          );
          setError(validationError);
          onError?.(validationError, variables);
          onSettled?.(null, validationError, variables);
          throw validationError;
        }
      }

      setIsLoading(true);
      setError(null);

      const mutationPromise = mutationFn(variables)
        .then(result => {
          setData(result);
          onSuccess?.(result, variables);
          return result;
        })
        .catch(err => {
          setError(err);
          onError?.(err, variables);
          throw err;
        })
        .finally(() => {
          setIsLoading(false);
          inFlightRef.current = null;
          onSettled?.(data, error, variables);
        });

      inFlightRef.current = mutationPromise;
      return mutationPromise.catch(() => null);
    },
    [mutationFn, onSuccess, onError, onSettled, validatePayload, data, error],
  );

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      // Prevent duplicate calls
      if (inFlightRef.current) {
        throw new Error('Mutation already in progress');
      }

      // Validate payload if validator provided
      if (validatePayload) {
        const validation = validatePayload(variables);
        if (!validation.valid) {
          const validationError = new Error(
            `Validation failed: ${validation.errors.join(', ')}`,
          );
          setError(validationError);
          onError?.(validationError, variables);
          throw validationError;
        }
      }

      setIsLoading(true);
      setError(null);

      const mutationPromise = mutationFn(variables)
        .then(result => {
          setData(result);
          onSuccess?.(result, variables);
          return result;
        })
        .catch(err => {
          setError(err);
          onError?.(err, variables);
          throw err;
        })
        .finally(() => {
          setIsLoading(false);
          inFlightRef.current = null;
          onSettled?.(data, error, variables);
        });

      inFlightRef.current = mutationPromise;
      return mutationPromise;
    },
    [mutationFn, onSuccess, onError, onSettled, validatePayload, data, error],
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
    inFlightRef.current = null;
  }, []);

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
    data,
    reset,
  };
}

/**
 * Convenience hook for POST requests
 */
export function usePostMutation<TData = any, TVariables = any>(
  endpoint: string,
  options: UseMutationOptions<TData, TVariables> = {},
): UseMutationResult<TData, TVariables> {
  const mutationFn = useCallback(
    (variables: TVariables) => unifiedApi.post<TData>(endpoint, variables),
    [endpoint],
  );

  return useMutation(mutationFn, options);
}

/**
 * Convenience hook for PUT requests
 */
export function usePutMutation<TData = any, TVariables = any>(
  endpoint: string,
  options: UseMutationOptions<TData, TVariables> = {},
): UseMutationResult<TData, TVariables> {
  const mutationFn = useCallback(
    (variables: TVariables) => unifiedApi.put<TData>(endpoint, variables),
    [endpoint],
  );

  return useMutation(mutationFn, options);
}

/**
 * Convenience hook for PATCH requests
 */
export function usePatchMutation<TData = any, TVariables = any>(
  endpoint: string,
  options: UseMutationOptions<TData, TVariables> = {},
): UseMutationResult<TData, TVariables> {
  const mutationFn = useCallback(
    (variables: TVariables) => unifiedApi.patch<TData>(endpoint, variables),
    [endpoint],
  );

  return useMutation(mutationFn, options);
}

/**
 * Convenience hook for DELETE requests
 */
export function useDeleteMutation<TData = any>(
  endpoint: string,
  options: UseMutationOptions<TData, void> = {},
): UseMutationResult<TData, void> {
  const mutationFn = useCallback(
    () => unifiedApi.delete<TData>(endpoint),
    [endpoint],
  );

  return useMutation(mutationFn, options);
}
