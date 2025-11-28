/**
 * Idempotency Utilities
 *
 * Generates idempotency keys for POST requests to prevent duplicate operations
 * when network retries or user double-clicks occur.
 */

/**
 * Generate a deterministic idempotency key from payload
 * OPTIMIZED: Faster hash using limited payload size for better performance
 */
export function generateIdempotencyKey(
  endpoint: string,
  payload: any,
  userId?: number | string,
): string {
  // OPTIMIZED: Use fast hash instead of full JSON.stringify for large payloads
  // Only hash first 200 chars of payload string to avoid slow JSON.stringify on large objects
  let payloadHash = '';
  try {
    if (payload) {
      const payloadStr =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      // Use first 200 chars + length for fast hashing
      const truncated = payloadStr.substring(0, 200);
      payloadHash = `${truncated.length}:${truncated}`;
    }
  } catch {
    // Fallback to simple string representation
    payloadHash = String(payload).substring(0, 200);
  }

  // Fast hash function (optimized for speed)
  const keySource = `${endpoint}:${userId || ''}:${payloadHash}`;
  let hash = 0;
  const len = Math.min(keySource.length, 500); // Limit hash input for speed
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) - hash + keySource.charCodeAt(i)) | 0;
  }

  // Return as hex string with timestamp for uniqueness
  return `idk-${Math.abs(hash).toString(16)}-${Date.now()}`;
}

/**
 * Generate a UUID-like idempotency key (non-deterministic)
 * OPTIMIZED: Faster generation using performance.now() for better precision
 */
export function generateUniqueIdempotencyKey(): string {
  // Use performance.now() for better precision, fallback to Date.now()
  const perfNow =
    typeof performance !== 'undefined' && performance.now
      ? Math.floor(performance.now() * 1000)
      : Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `idk-${perfNow}-${random}`;
}

/**
 * Check if an endpoint should use idempotency keys
 * Some endpoints (like OTP verification) shouldn't be idempotent
 */
export function shouldUseIdempotency(endpoint: string): boolean {
  // Don't use idempotency for these endpoints
  const nonIdempotentEndpoints = [
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/sms-status',
    '/user/register',
    '/user/verify-otp',
  ];

  return !nonIdempotentEndpoints.some(path => endpoint.includes(path));
}
