import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerScreen from '../src/screens/HomeScreen/CustomerScreen';

// Mock the navigation
const Stack = createStackNavigator();

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock the storage utility
jest.mock('../src/utils/storage', () => ({
  getUserIdFromToken: jest.fn(),
}));

// Mock the auth context
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
  }),
}));

// Mock MaterialCommunityIcons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

const MockNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Customer" component={CustomerScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

describe('CustomerScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<MockNavigator />);
    expect(getByText('Customers')).toBeTruthy();
  });

  it('handles empty customer data gracefully', async () => {
    const { getByText } = render(<MockNavigator />);

    // Wait for the component to load
    await waitFor(() => {
      expect(getByText('No customers found')).toBeTruthy();
    });
  });

  it('handles invalid customer data without crashing', async () => {
    // Mock API response with invalid data
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        { id: 1, partyName: 'Test Customer', openingBalance: 0 },
        { id: 2, partyName: null, openingBalance: 'invalid' },
        { id: 3, partyName: 'Valid Customer', openingBalance: 1000 },
      ],
    });

    const { getByText } = render(<MockNavigator />);

    // Should not crash and should show valid customers
    await waitFor(() => {
      expect(getByText('Test Customer')).toBeTruthy();
      expect(getByText('Valid Customer')).toBeTruthy();
    });
  });

  it('handles zero balance customers correctly', async () => {
    // Mock API response with zero balance
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'Zero Balance Customer',
          openingBalance: 0,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Zero Balance Customer')).toBeTruthy();
      expect(getByText('₹0')).toBeTruthy();
      expect(getByText('You Give')).toBeTruthy();
    });
  });

  it('handles negative balance customers correctly', async () => {
    // Mock API response with negative balance
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'Negative Balance Customer',
          openingBalance: -500,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Negative Balance Customer')).toBeTruthy();
      expect(getByText('₹500')).toBeTruthy();
      expect(getByText('You Give')).toBeTruthy();
    });
  });

  it('handles positive balance customers correctly', async () => {
    // Mock API response with positive balance
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'Positive Balance Customer',
          openingBalance: 1000,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Positive Balance Customer')).toBeTruthy();
      expect(getByText('₹1,000')).toBeTruthy();
      expect(getByText('You Get')).toBeTruthy();
    });
  });

  it('handles tab switching correctly', async () => {
    const { getByText } = render(<MockNavigator />);

    // Initially should show customers tab
    expect(getByText('Customers')).toBeTruthy();

    // Switch to suppliers tab
    const suppliersTab = getByText('Suppliers');
    fireEvent.press(suppliersTab);

    // Should now show suppliers content
    await waitFor(() => {
      expect(getByText('No suppliers found')).toBeTruthy();
    });
  });

  it('handles search functionality correctly', async () => {
    // Mock API response
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'John Doe',
          openingBalance: 1000,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          partyName: 'Jane Smith',
          openingBalance: 2000,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByPlaceholderText, getByText, queryByText } = render(
      <MockNavigator />,
    );

    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Jane Smith')).toBeTruthy();
    });

    // Search for John
    const searchInput = getByPlaceholderText('Search Customer');
    fireEvent.changeText(searchInput, 'John');

    // Should only show John Doe
    expect(getByText('John Doe')).toBeTruthy();
    expect(queryByText('Jane Smith')).toBeFalsy();
  });

  it('handles filter functionality correctly', async () => {
    // Mock API response
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'Customer A',
          openingBalance: 500,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          partyName: 'Customer B',
          openingBalance: 2000,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText, getByTestId } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Customer A')).toBeTruthy();
      expect(getByText('Customer B')).toBeTruthy();
    });

    // Open filter modal
    const filterButton = getByText('Filter Options');
    fireEvent.press(filterButton);

    // Should show filter options
    expect(getByText('Sort By')).toBeTruthy();
    expect(getByText('Amount Range')).toBeTruthy();
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    const mockAxios = require('axios');
    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Failed to fetch data')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('handles navigation errors gracefully', async () => {
    // Mock successful API response
    const mockAxios = require('axios');
    mockAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          partyName: 'Test Customer',
          openingBalance: 1000,
          partyType: 'customer',
          address: 'Test Address',
          createdAt: '2025-01-01T00:00:00Z',
        },
      ],
    });

    const { getByText } = render(<MockNavigator />);

    await waitFor(() => {
      expect(getByText('Test Customer')).toBeTruthy();
    });

    // Try to navigate to customer detail (this should not crash)
    const customerItem = getByText('Test Customer');
    fireEvent.press(customerItem);

    // Component should still be functional
    expect(getByText('Test Customer')).toBeTruthy();
  });
});
