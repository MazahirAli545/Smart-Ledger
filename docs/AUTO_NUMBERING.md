# Auto-Numbering System Documentation

## Overview

The auto-numbering system automatically generates sequential document numbers for all folder types in the application. Each folder type gets its own numbering sequence that persists across app sessions.

## How It Works

### 1. Document Number Format

All document numbers follow the pattern: `PREFIX-NUMBER`

- **Payment**: `PAY-001`, `PAY-002`, `PAY-003`...
- **Receipt**: `REC-001`, `REC-002`, `REC-003`...
- **Purchase**: `PUR-001`, `PUR-002`, `PUR-003`...
- **Invoice/Sell**: `SEL-001`, `SEL-002`, `SEL-003`...
- **New Folders**: `FOL-001`, `FOL-002`, `FOL-003`... (or custom prefix)

### 2. Automatic Initialization

When you open any screen (Payment, Receipt, Purchase, Invoice), the system automatically:

- Generates the next available number for that folder type
- Displays it in the form
- Stores it for future use

### 3. Number Persistence

- Numbers are stored in AsyncStorage
- Each folder type has its own counter
- Numbers persist across app restarts
- No limit on numbering (continues beyond 999)

## Implementation Details

### Core Functions

```typescript
// Generate next number for any folder type
generateNextDocumentNumber(folderName: string): Promise<string>

// Get current number without incrementing
getCurrentDocumentNumber(folderName: string): Promise<string>

// Reset counter for a folder type
resetDocumentNumber(folderName: string): Promise<void>

// Get prefix for any folder type
getFolderPrefix(folderName: string): string
```

### Usage in Screens

Each screen automatically initializes its document number:

```typescript
useEffect(() => {
  // Initialize document number when component mounts
  const initializeNumber = async () => {
    try {
      const nextNumber = await generateNextDocumentNumber(
        folderName.toLowerCase(),
      );
      setDocumentNumber(nextNumber);
    } catch (error) {
      console.error('Error initializing number:', error);
      setDocumentNumber('FALLBACK-001');
    }
  };
  initializeNumber();
}, []);
```

### Adding New Folder Types

The system automatically handles new folder types:

1. **Known types** (payment, receipt, purchase, invoice, sell) use predefined prefixes
2. **New types** automatically get prefixes based on the first 3 letters
3. **Short names** get padded with 'X' (e.g., "ab" → "ABX")

## API Integration

When submitting forms, the generated document number is automatically included in the API request body:

```typescript
const body = {
  type: folderName.toLowerCase(),
  billNumber: documentNumber, // Auto-generated number
  // ... other fields
};
```

## Testing

Run the test suite to verify functionality:

```bash
npm test -- autoNumberGenerator.test.ts
```

## Troubleshooting

### Common Issues

1. **Numbers not incrementing**: Check if AsyncStorage is working properly
2. **Wrong prefixes**: Verify folder names are correctly passed to the functions
3. **Numbers resetting**: Check if resetDocumentNumber is being called unexpectedly

### Debug Functions

```typescript
// Get all current document numbers
getAllDocumentNumbers(): Promise<Record<string, string>>

// Set a specific number (for testing)
setDocumentNumber(folderType: string, number: string): Promise<void>
```

## Examples

### Payment Screen

- Opens with `PAY-001` (or next available number)
- After saving, next form shows `PAY-002`
- Numbers continue: `PAY-003`, `PAY-004`...

### Receipt Screen

- Opens with `REC-001` (or next available number)
- After saving, next form shows `REC-002`
- Numbers continue: `REC-003`, `REC-004`...

### New Custom Folder

- If you create a folder called "Expense"
- It will use prefix "EXP"
- Numbers: `EXP-001`, `EXP-002`, `EXP-003`...

## Benefits

1. **No Manual Entry**: Users never need to type document numbers
2. **No Duplicates**: Each document gets a unique number
3. **Professional Look**: Consistent numbering format across all folders
4. **Scalable**: No limit on number of documents
5. **Flexible**: Automatically handles new folder types
6. **Persistent**: Numbers survive app restarts and device changes
