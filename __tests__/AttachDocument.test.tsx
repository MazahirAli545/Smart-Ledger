import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AttachDocument from '../src/components/AttachDocument';

// Mock the required dependencies
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {
    pdf: 'pdf',
  },
  isErrorWithCode: jest.fn(),
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
  },
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openSettings: jest.fn(),
}));

describe('AttachDocument Component', () => {
  const mockOnDocumentAttached = jest.fn();
  const mockOnDocumentRemoved = jest.fn();

  const defaultProps = {
    attachedDocument: null,
    onDocumentAttached: mockOnDocumentAttached,
    onDocumentRemoved: mockOnDocumentRemoved,
    label: 'Attach Document (Optional)',
    required: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    const { getByText, getByTestId } = render(
      <AttachDocument {...defaultProps} />,
    );

    expect(getByText('Attach Document (Optional)')).toBeTruthy();
    expect(getByText('Click to upload')).toBeTruthy();
    expect(
      getByText('Only PNG, JPG or PDF file format supported'),
    ).toBeTruthy();
  });

  it('renders with required prop', () => {
    const { getByText } = render(
      <AttachDocument {...defaultProps} required={true} />,
    );

    expect(getByText('Attach Document (Optional) *')).toBeTruthy();
  });

  it('renders with custom label', () => {
    const { getByText } = render(
      <AttachDocument {...defaultProps} label="Custom Label" />,
    );

    expect(getByText('Custom Label')).toBeTruthy();
  });

  it('shows attached document when one exists', () => {
    const mockDocument = {
      name: 'test.pdf',
      type: 'pdf' as const,
      uri: 'file://test.pdf',
      size: 1024,
    };

    const { getByText } = render(
      <AttachDocument {...defaultProps} attachedDocument={mockDocument} />,
    );

    expect(getByText('test.pdf')).toBeTruthy();
    expect(getByText('1 KB')).toBeTruthy();
  });

  it('calls onDocumentRemoved when remove button is pressed', () => {
    const mockDocument = {
      name: 'test.pdf',
      type: 'pdf' as const,
      uri: 'file://test.pdf',
      size: 1024,
    };

    const { getByTestId } = render(
      <AttachDocument {...defaultProps} attachedDocument={mockDocument} />,
    );

    const removeButton = getByTestId('remove-document-button');
    fireEvent.press(removeButton);

    expect(mockOnDocumentRemoved).toHaveBeenCalledTimes(1);
  });

  it('opens modal when attach button is pressed', async () => {
    const { getByText } = render(<AttachDocument {...defaultProps} />);

    const attachButton = getByText('Click to upload');
    fireEvent.press(attachButton);

    await waitFor(() => {
      expect(getByText('Attach Document')).toBeTruthy();
    });
  });

  it('shows camera, gallery, and PDF options in modal', async () => {
    const { getByText } = render(<AttachDocument {...defaultProps} />);

    const attachButton = getByText('Click to upload');
    fireEvent.press(attachButton);

    await waitFor(() => {
      expect(getByText('Camera')).toBeTruthy();
      expect(getByText('Gallery')).toBeTruthy();
      expect(getByText('PDF')).toBeTruthy();
    });
  });
});
