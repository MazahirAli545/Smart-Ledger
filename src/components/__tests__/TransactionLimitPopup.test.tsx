import React from 'react';
import { render } from '@testing-library/react-native';
import TransactionLimitPopup from '../TransactionLimitPopup';

// Mock the navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

// Mock the LinearGradient component
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Mock the Ionicons component
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

describe('TransactionLimitPopup', () => {
  const defaultProps = {
    visible: true,
    currentCount: 4990,
    maxAllowed: 5000,
    remaining: 10,
    planName: 'Enterprise',
    percentageUsed: 100,
    isAtLimit: true,
    nextResetDate: '2025-10-01',
    onClose: jest.fn(),
    onUpgrade: jest.fn(),
  };

  it('renders correctly with default props', () => {
    const { getByText } = render(<TransactionLimitPopup {...defaultProps} />);

    expect(getByText('Transaction Limit Reached')).toBeTruthy();
    expect(
      getByText('Enterprise Plan • 4990/5000 transactions used'),
    ).toBeTruthy();
  });

  it('shows last plan message for Enterprise plan', () => {
    const { getByText } = render(<TransactionLimitPopup {...defaultProps} />);

    expect(getByText("You're on our highest plan! 🎉")).toBeTruthy();
    expect(
      getByText('Contact support for custom enterprise solutions.'),
    ).toBeTruthy();
  });

  it('shows upgrade button for Professional plan', () => {
    const professionalProps = {
      ...defaultProps,
      planName: 'Professional',
    };

    const { getByText } = render(
      <TransactionLimitPopup {...professionalProps} />,
    );

    expect(getByText('Upgrade your plan for Enterprise')).toBeTruthy();
  });

  it('shows upgrade button for Starter plan', () => {
    const starterProps = {
      ...defaultProps,
      planName: 'Starter',
    };

    const { getByText } = render(<TransactionLimitPopup {...starterProps} />);

    expect(getByText('Upgrade your plan for Professional')).toBeTruthy();
  });

  it('shows upgrade button for Free plan', () => {
    const freeProps = {
      ...defaultProps,
      planName: 'Free',
    };

    const { getByText } = render(<TransactionLimitPopup {...freeProps} />);

    expect(getByText('Upgrade your plan for Starter')).toBeTruthy();
  });
});
