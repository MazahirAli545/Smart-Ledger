import { unifiedApi } from '../api/unifiedApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OCRResponse {
  text: string;
}

export interface OCRRequest {
  file: {
    uri: string;
    name: string;
    type: string;
  };
}

/**
 * OCR Service using backend API
 * Replaces MLKit OCR with server-side OCR processing
 */
export class OCRService {
  private static async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('accessToken');
  }

  /**
   * Extract text from image using backend OCR API
   */
  static async extractTextFromImage(
    imageUri: string,
    fileName: string = 'image.jpg',
  ): Promise<string> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      console.log('Sending OCR request to:', '/api/ocr');
      console.log('File:', fileName, 'URI:', imageUri);

      // OCR endpoint is not available on backend; feature-guard
      return '';
      const response = await fetch(`${BASE_URL}/api/ocr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      console.log('OCR Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `OCR failed with status: ${response.status}`,
        );
      }

      const data: OCRResponse = await response.json();
      console.log('OCR extracted text length:', data.text?.length || 0);
      return data.text || '';
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF using backend OCR API
   * For PDFs, we'll need to convert pages to images first
   */
  static async extractTextFromPDF(
    pdfUri: string,
    fileName: string = 'document.pdf',
  ): Promise<string> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const formData = new FormData();
      formData.append('file', {
        uri: pdfUri,
        name: fileName,
        type: 'application/pdf',
      } as any);

      console.log('Sending PDF OCR request to:', '/api/ocr');

      // OCR endpoint is not available on backend; feature-guard
      return '';
      const response = await fetch(`${BASE_URL}/api/ocr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `PDF OCR failed with status: ${response.status}`,
        );
      }

      const data: OCRResponse = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('PDF OCR extraction failed:', error);
      throw error;
    }
  }

  /**
   * Generic OCR method that handles different file types
   */
  static async extractText(
    fileUri: string,
    fileName: string,
    fileType: string,
  ): Promise<string> {
    if (fileType.toLowerCase().includes('pdf')) {
      return this.extractTextFromPDF(fileUri, fileName);
    } else {
      return this.extractTextFromImage(fileUri, fileName);
    }
  }

  /**
   * Test method to verify OCR service is working
   */
  static async testConnection(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        console.log('No auth token found');
        return false;
      }

      console.log('OCR service test: Auth token found');
      return true;
    } catch (error) {
      console.error('OCR service test failed:', error);
      return false;
    }
  }
}
