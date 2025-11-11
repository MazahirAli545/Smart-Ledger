# UI Margin & Spacing Update Report

Date: 2025-10-29

## Summary

- Increased spacing for the floating action button on `CustomerScreen` and added bottom padding to the Filter modal footer so the buttons no longer appear attached to the bottom edge.

## Changes

1. CustomerScreen Floating Action Button (FAB)

   - File: `src/screens/HomeScreen/CustomerScreen.tsx`
   - Style key: `styles.fab`
   - Update: `bottom: 20` → `bottom: 32`
   - Impact: More comfortable space between the "Add Customer"/"Add Supplier" button and the bottom of the screen.

2. Filter Modal Footer Buttons

- File: `src/screens/HomeScreen/CustomerScreen.tsx`
- Style key: `styles.modalFooter`
- Update: `paddingBottom: 6` → `paddingBottom: 24` (and `paddingTop: 12`)
- Impact: Aligns footer spacing with `AddPartyScreen` bottom action bar feel; more comfortable breathing room beneath "Reset All" and "Apply Filters" so they no longer appear attached to the bottom edge, including on gesture-navigation devices.

3.  CustomerDetailScreen Bottom Navigation Buttons

    - File: `src/screens/HomeScreen/CustomerDetailScreen.tsx`
    - Style key: `styles.bottomButtons`
    - Update: `bottom: 16` → `bottom: 28`
    - Impact: Provides extra clearance from the gesture bar and feels consistent with other screens’ bottom actions.

4.  AddNewEntryScreen Bottom Button Bar
    - File: `src/screens/HomeScreen/AddNewEntryScreen.tsx`
    - Style keys:
      - `styles.buttonContainer`: Increased `paddingVertical` and `paddingBottom` (15 → 22), centered children via `alignItems: 'center'`.
      - `styles.submitButtonFullWidth`: Centered and rounded primary button — now `width: '92%'`, `alignSelf: 'center'`, `borderRadius: 8` (was full-bleed with square corners).
    - Impact: The "Add Entry" primary button appears centered with rounded corners, visually matching `AddPartyScreen` bottom button. Edit mode retains two-button layout with improved bottom spacing.

## Notes

- These are purely visual spacing changes; no behavioral logic was modified.
- If additional device-specific inset spacing is needed (e.g., on devices with gesture bars), we can further increase `bottom` for the FAB and `paddingBottom` for the modal footer or use SafeArea insets.
