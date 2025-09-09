/**
 * OCR API Configuration
 *
 * This file contains configuration for the OCR backend API
 * Update these values according to your backend setup
 */

export const OCR_CONFIG = {
  // OCR endpoint (uses BASE_URL from src/api/index.ts)
  OCR_ENDPOINT: '/api/ocr',

  // Supported file types
  SUPPORTED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'bmp', 'tiff'],
  SUPPORTED_PDF_TYPES: ['pdf'],

  // Maximum file size (in bytes) - 10MB
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  // Request timeout (in milliseconds) - 30 seconds
  REQUEST_TIMEOUT: 30000,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

import { BASE_URL } from '../api/index';

/**
 * Get the full OCR API URL
 */
export const getOCRApiUrl = (): string => {
  return `${BASE_URL}${OCR_CONFIG.OCR_ENDPOINT}`;
};

/**
 * Validate file type for OCR
 */
export const isValidFileType = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  return [
    ...OCR_CONFIG.SUPPORTED_IMAGE_TYPES,
    ...OCR_CONFIG.SUPPORTED_PDF_TYPES,
  ].includes(extension);
};

/**
 * Validate file size
 */
export const isValidFileSize = (fileSize: number): boolean => {
  return fileSize <= OCR_CONFIG.MAX_FILE_SIZE;
};

/**
 * Get MIME type for file
 */
export const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
};
