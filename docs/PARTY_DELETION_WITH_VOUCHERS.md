# Party Deletion with Related Vouchers

## Overview

The `AddPartyScreen` now includes comprehensive functionality to delete a party (customer/supplier) along with all their related transactions (vouchers). This ensures data consistency and prevents orphaned transaction records.

## Features

### 1. Smart Voucher Detection

- Automatically identifies all vouchers related to the party being deleted
- Searches across multiple voucher fields: `partyName`, `supplierName`, `customerName`
- Provides accurate count of related transactions before deletion

### 2. Critical Transaction Warning

- Identifies high-value transactions (>₹10,000) as critical
- Flags important voucher types (invoices, receipts) for special attention
- Shows detailed breakdown of critical transactions before deletion

### 3. Progressive Deletion Process

- **Step 1**: Delete all related vouchers first
- **Step 2**: Delete the party record
- **Step 3**: Provide comprehensive feedback on the deletion process

### 4. User Experience Enhancements

- Clear confirmation dialogs with transaction counts
- Progress tracking during deletion
- Detailed success/error reporting
- Loading states and disabled buttons during operations

## Implementation Details

### Core Functions

#### `handleDeleteParty()`

Main entry point for party deletion that:

- Checks for related vouchers
- Shows appropriate confirmation dialogs
- Orchestrates the deletion process

#### `deleteRelatedVouchers(accessToken)`

Handles the deletion of all related vouchers:

- Fetches all vouchers from the API
- Filters for related transactions
- Deletes vouchers in parallel using `Promise.allSettled`
- Provides progress tracking and error handling

#### `checkRelatedVouchers()`

Pre-deletion check that:

- Counts related vouchers
- Identifies critical transactions
- Prepares user-friendly confirmation messages

### API Endpoints Used

```typescript
// Fetch all vouchers to identify related ones
GET / vouchers;

// Delete individual vouchers
DELETE / vouchers / { voucherId };

// Delete the party
DELETE / customer / { partyId };
```

### Voucher Relationship Detection

Vouchers are considered related if they match the party name in any of these fields:

- `partyName` - General party identifier
- `supplierName` - Supplier-specific identifier
- `customerName` - Customer-specific identifier

## User Flow

### 1. Delete Button Press

User taps the DELETE button on the party edit screen.

### 2. Voucher Count Check

System fetches all vouchers and counts related transactions.

### 3. Confirmation Dialog

Shows detailed confirmation with:

- Party name
- Number of related transactions
- Types of transactions affected
- Warning about irreversible action

### 4. Critical Transaction Review (if applicable)

If critical transactions are found:

- Shows detailed breakdown
- Allows user to review before proceeding
- Provides option to cancel or continue

### 5. Deletion Process

- Shows progress dialog
- Deletes vouchers in parallel
- Deletes party record
- Provides completion feedback

### 6. Navigation

Redirects to CustomerScreen with appropriate tab selected.

## Error Handling

### Voucher Deletion Failures

- Individual voucher failures don't stop the process
- Failed deletions are logged and reported
- Party deletion continues even if some vouchers fail
- User receives detailed feedback on what succeeded/failed

### Network Errors

- Graceful fallback for API failures
- User warnings about incomplete deletions
- Option to continue with party deletion
- Manual cleanup recommendations

### Critical Transaction Handling

- High-value transactions trigger additional warnings
- User must explicitly acknowledge critical deletions
- Detailed transaction information provided for review

## Configuration

### Critical Transaction Thresholds

```typescript
const CRITICAL_AMOUNT_THRESHOLD = 10000; // ₹10,000
const CRITICAL_TYPES = ['invoice', 'receipt'];
```

### API Timeouts

```typescript
const VOUCHER_FETCH_TIMEOUT = 10000; // 10 seconds
const PARTY_DELETION_TIMEOUT = 15000; // 15 seconds
```

## Testing

### Test Coverage

Comprehensive test suite covering:

- Successful deletion scenarios
- Error handling and edge cases
- Critical transaction warnings
- Loading states and user feedback
- Network error scenarios

### Running Tests

```bash
npm test -- --testPathPattern=AddPartyScreen.test.tsx
```

## Security Considerations

### Authentication

- All operations require valid access token
- Token validation before any deletion
- User ID verification from token

### Data Validation

- Party existence verification
- Voucher relationship validation
- Amount and type validation for critical transactions

### Audit Trail

- Comprehensive logging of all operations
- Success/failure tracking for each voucher
- User action confirmation logging

## Performance Optimizations

### Parallel Processing

- Voucher deletions happen concurrently
- Uses `Promise.allSettled` for optimal performance
- Progress tracking without blocking UI

### Batch Operations

- Single API call to fetch all vouchers
- Efficient filtering on client side
- Minimal network requests during deletion

### Memory Management

- Proper cleanup of promises and timers
- Efficient array filtering and mapping
- Garbage collection friendly implementation

## Future Enhancements

### Planned Features

- Bulk party deletion
- Scheduled deletion with confirmation
- Voucher backup before deletion
- Deletion history and audit logs
- Undo functionality (time-limited)

### API Improvements

- Batch voucher deletion endpoint
- Soft delete with recovery options
- Transaction dependency analysis
- Automated orphan detection

## Troubleshooting

### Common Issues

#### Vouchers Not Found

- Check API endpoint configuration
- Verify authentication token
- Review voucher data structure

#### Deletion Failures

- Check network connectivity
- Verify API permissions
- Review error logs for specific failures

#### Critical Transaction Warnings

- Adjust threshold values if needed
- Review transaction categorization
- Update critical type definitions

### Debug Information

Enable detailed logging by setting:

```typescript
console.log('🗑️ Deleting related vouchers for party:', partyName);
console.log('📊 Total vouchers found:', vouchers.length);
console.log('🔗 Related vouchers found:', relatedVouchers.length);
```

## Support

For issues or questions regarding this functionality:

1. Check the console logs for detailed error information
2. Review the test suite for expected behavior
3. Verify API endpoint configurations
4. Check authentication and permissions

## Changelog

### Version 1.0.0

- Initial implementation of party deletion with voucher cleanup
- Critical transaction detection and warnings
- Comprehensive error handling and user feedback
- Full test coverage and documentation
