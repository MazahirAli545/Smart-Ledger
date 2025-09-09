import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateNextDocumentNumber,
  getCurrentDocumentNumber,
  getFolderPrefix,
  resetDocumentNumber,
} from '../autoNumberGenerator';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('AutoNumberGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear AsyncStorage before each test
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  describe('getFolderPrefix', () => {
    it('should return correct prefix for known document types', () => {
      expect(getFolderPrefix('payment')).toBe('PAY');
      expect(getFolderPrefix('receipt')).toBe('REC');
      expect(getFolderPrefix('purchase')).toBe('PUR');
      expect(getFolderPrefix('invoice')).toBe('INV');
      expect(getFolderPrefix('sell')).toBe('SEL');
    });

    it('should generate prefix for new folder types', () => {
      expect(getFolderPrefix('expense')).toBe('EXP');
      expect(getFolderPrefix('income')).toBe('INC');
      expect(getFolderPrefix('transfer')).toBe('TRA');
    });

    it('should handle short folder names', () => {
      expect(getFolderPrefix('ab')).toBe('ABX');
      expect(getFolderPrefix('a')).toBe('AXX');
    });
  });

  describe('generateNextDocumentNumber', () => {
    it('should generate first number for new document type', async () => {
      const result = await generateNextDocumentNumber('payment');
      expect(result).toBe('PAY-001');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_payment_number',
        'PAY-001',
      );
    });

    it('should generate next number for existing document type', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PAY-001');

      const result = await generateNextDocumentNumber('payment');
      expect(result).toBe('PAY-002');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_payment_number',
        'PAY-002',
      );
    });

    it('should handle numbers with commas', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PAY-1,000');

      const result = await generateNextDocumentNumber('payment');
      expect(result).toBe('PAY-1,001');
    });

    it('should generate numbers for new folder types', async () => {
      const result = await generateNextDocumentNumber('expense');
      expect(result).toBe('EXP-001');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_expense_number',
        'EXP-001',
      );
    });

    it('should handle errors gracefully with fallback', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const result = await generateNextDocumentNumber('payment');
      expect(result).toMatch(/^PAY-\d+$/);
    });
  });

  describe('getCurrentDocumentNumber', () => {
    it('should return current number without incrementing', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('PAY-001');

      const result = await getCurrentDocumentNumber('payment');
      expect(result).toBe('PAY-001');
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should return first number for new document type', async () => {
      const result = await getCurrentDocumentNumber('payment');
      expect(result).toBe('PAY-001');
    });
  });

  describe('resetDocumentNumber', () => {
    it('should clear document number counter', async () => {
      await resetDocumentNumber('payment');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        'last_payment_number',
      );
    });
  });

  describe('Integration tests', () => {
    it('should generate sequential numbers for multiple calls', async () => {
      // First call
      const first = await generateNextDocumentNumber('test');
      expect(first).toBe('TES-001');

      // Second call
      const second = await generateNextDocumentNumber('test');
      expect(second).toBe('TES-002');

      // Third call
      const third = await generateNextDocumentNumber('test');
      expect(third).toBe('TES-003');
    });

    it('should handle different folder types independently', async () => {
      const payment1 = await generateNextDocumentNumber('payment');
      const receipt1 = await generateNextDocumentNumber('receipt');
      const payment2 = await generateNextDocumentNumber('payment');
      const receipt2 = await generateNextDocumentNumber('receipt');

      expect(payment1).toBe('PAY-001');
      expect(receipt1).toBe('REC-001');
      expect(payment2).toBe('PAY-002');
      expect(receipt2).toBe('REC-002');
    });
  });
});
