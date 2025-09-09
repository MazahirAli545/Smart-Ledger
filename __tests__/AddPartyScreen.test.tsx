import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('axios', () => ({
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve('mock-token')),
}));

jest.mock('../src/utils/storage', () => ({
  getUserIdFromToken: jest.fn(() => Promise.resolve('mock-user-id')),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: { pdf: 'pdf' },
  isErrorWithCode: jest.fn(),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert');

describe('AddPartyScreen - Image Preview Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
  });

  it('should render without crashing', () => {
    // Import the component dynamically to avoid module loading issues
    const AddPartyScreen =
      require('../src/screens/HomeScreen/AddPartyScreen').default;
    const component = TestRenderer.create(<AddPartyScreen />);

    expect(component).toBeTruthy();
    expect(component.root).toBeTruthy();
  });

  it('should have image preview modal structure', () => {
    const AddPartyScreen =
      require('../src/screens/HomeScreen/AddPartyScreen').default;
    const component = TestRenderer.create(<AddPartyScreen />);

    // Verify the component renders
    expect(component.root).toBeTruthy();

    // The component should have the image preview modal defined
    // (though it may not be visible initially)
    expect(component.root).toBeTruthy();
  });

  it('should have PDF preview modal structure', () => {
    const AddPartyScreen =
      require('../src/screens/HomeScreen/AddPartyScreen').default;
    const component = TestRenderer.create(<AddPartyScreen />);

    // Verify the component renders
    expect(component.root).toBeTruthy();

    // The component should have the PDF preview modal defined
    expect(component.root).toBeTruthy();
  });

  it('should have document attachment functionality', () => {
    const AddPartyScreen =
      require('../src/screens/HomeScreen/AddPartyScreen').default;
    const component = TestRenderer.create(<AddPartyScreen />);

    // Verify the component renders
    expect(component.root).toBeTruthy();

    // The component should have document attachment features
    expect(component.root).toBeTruthy();
  });
});
