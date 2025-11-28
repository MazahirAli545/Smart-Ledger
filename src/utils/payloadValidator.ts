/**
 * Payload Validation Utilities
 *
 * Lightweight validation helpers for POST request payloads
 * to catch errors before sending to backend
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that required fields are present in payload
 */
export function validateRequiredFields(
  payload: any,
  requiredFields: string[],
): ValidationResult {
  const errors: string[] = [];

  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate number fields are valid numbers
 */
export function validateNumberFields(
  payload: any,
  numberFields: string[],
): ValidationResult {
  const errors: string[] = [];

  for (const field of numberFields) {
    const value = payload[field];
    if (value !== undefined && value !== null && value !== '') {
      const num = Number(value);
      if (isNaN(num) || !isFinite(num)) {
        errors.push(`Invalid number for field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate date fields are valid dates
 */
export function validateDateFields(
  payload: any,
  dateFields: string[],
): ValidationResult {
  const errors: string[] = [];

  for (const field of dateFields) {
    const value = payload[field];
    if (value !== undefined && value !== null && value !== '') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid date for field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (basic)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Comprehensive payload validation
 */
export function validatePayload(
  payload: any,
  rules: {
    required?: string[];
    numbers?: string[];
    dates?: string[];
    emails?: string[];
    phones?: string[];
  },
): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (rules.required) {
    const requiredResult = validateRequiredFields(payload, rules.required);
    errors.push(...requiredResult.errors);
  }

  // Number fields
  if (rules.numbers) {
    const numberResult = validateNumberFields(payload, rules.numbers);
    errors.push(...numberResult.errors);
  }

  // Date fields
  if (rules.dates) {
    const dateResult = validateDateFields(payload, rules.dates);
    errors.push(...dateResult.errors);
  }

  // Email fields
  if (rules.emails) {
    for (const field of rules.emails) {
      const value = payload[field];
      if (value && !validateEmail(value)) {
        errors.push(`Invalid email format for field: ${field}`);
      }
    }
  }

  // Phone fields
  if (rules.phones) {
    for (const field of rules.phones) {
      const value = payload[field];
      if (value && !validatePhone(value)) {
        errors.push(`Invalid phone format for field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
