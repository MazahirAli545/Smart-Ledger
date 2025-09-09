# AttachDocument Component

A reusable React Native component for document attachment functionality that supports camera capture, gallery selection, and PDF picking.

## Features

- 📷 **Camera Capture**: Take photos directly from the camera
- 🖼️ **Gallery Selection**: Pick images from device gallery
- 📄 **PDF Support**: Select PDF documents from device storage
- 🔒 **Permission Handling**: Automatic permission requests for camera and storage
- 📱 **Cross-Platform**: Works on both iOS and Android
- 🎨 **Customizable**: Configurable labels and required field indicators
- 📊 **File Preview**: Shows attached document information with file size

## Installation

The component is already included in the project at `src/components/AttachDocument.tsx`.

## Usage

### Basic Usage

```tsx
import AttachDocument from '../../components/AttachDocument';

const MyScreen = () => {
  const [attachedDocument, setAttachedDocument] = useState(null);

  return (
    <AttachDocument
      attachedDocument={attachedDocument}
      onDocumentAttached={setAttachedDocument}
      onDocumentRemoved={() => setAttachedDocument(null)}
    />
  );
};
```

### With Custom Label

```tsx
<AttachDocument
  attachedDocument={attachedDocument}
  onDocumentAttached={setAttachedDocument}
  onDocumentRemoved={() => setAttachedDocument(null)}
  label="Upload Receipt"
/>
```

### Required Field

```tsx
<AttachDocument
  attachedDocument={attachedDocument}
  onDocumentAttached={setAttachedDocument}
  onDocumentRemoved={() => setAttachedDocument(null)}
  label="Upload Receipt"
  required={true}
/>
```

## Props

| Prop                 | Type                                   | Required | Default                        | Description                                       |
| -------------------- | -------------------------------------- | -------- | ------------------------------ | ------------------------------------------------- |
| `attachedDocument`   | `AttachedDocument \| null`             | ✅       | -                              | The currently attached document or null           |
| `onDocumentAttached` | `(document: AttachedDocument) => void` | ✅       | -                              | Callback when a document is attached              |
| `onDocumentRemoved`  | `() => void`                           | ✅       | -                              | Callback when document is removed                 |
| `label`              | `string`                               | ❌       | `"Attach Document (Optional)"` | Label text for the component                      |
| `required`           | `boolean`                              | ❌       | `false`                        | Whether the field is required (adds \* indicator) |

## AttachedDocument Interface

```tsx
interface AttachedDocument {
  name: string; // File name
  type: 'image' | 'pdf'; // File type
  uri: string; // File URI
  size?: number; // File size in bytes (optional)
}
```

## Supported File Types

- **Images**: PNG, JPG, JPEG
- **Documents**: PDF

## Permissions

The component automatically handles the following permissions:

### Android

- `CAMERA` - For taking photos
- `READ_MEDIA_IMAGES` (API 33+) or `READ_EXTERNAL_STORAGE` (API < 33) - For gallery access

### iOS

- Camera and Photo Library permissions are handled by the system

## Example Implementation

### AddPartyScreen.tsx

```tsx
<AttachDocument
  attachedDocument={attachedDocument}
  onDocumentAttached={setAttachedDocument}
  onDocumentRemoved={() => setAttachedDocument(null)}
  label="Attach Document (Optional)"
/>
```

### AddNewEntryScreen.tsx

```tsx
<AttachDocument
  attachedDocument={attachedDocument}
  onDocumentAttached={setAttachedDocument}
  onDocumentRemoved={() => setAttachedDocument(null)}
  label="Attach Document (Optional)"
/>
```

## Styling

The component uses consistent styling with the app's design system:

- **Colors**: Uses the app's primary color (#4f8cff) for interactive elements
- **Borders**: Dashed border for the upload area
- **Spacing**: Consistent with other form inputs
- **Typography**: Matches the app's font sizes and weights

## Error Handling

The component includes comprehensive error handling:

- **Permission Denied**: Shows appropriate alerts with settings navigation
- **File Pick Errors**: Graceful fallbacks for failed operations
- **Network Issues**: Handles timeouts and connection problems

## Testing

The component includes comprehensive tests in `__tests__/AttachDocument.test.tsx`:

```bash
npm test AttachDocument.test.tsx
```

## Dependencies

- `react-native-image-picker` - For camera and gallery access
- `@react-native-documents/picker` - For PDF document selection
- `react-native-vector-icons` - For UI icons

## Troubleshooting

### Common Issues

1. **Permission Denied**: User needs to grant permissions in device settings
2. **File Not Found**: Ensure the file exists and is accessible
3. **Size Limit**: Large files may cause performance issues

### Debug Mode

Enable console logging to see detailed permission and file handling information.

## Future Enhancements

- [ ] Multiple file selection
- [ ] File compression options
- [ ] Cloud storage integration
- [ ] File type validation
- [ ] Custom file picker options
