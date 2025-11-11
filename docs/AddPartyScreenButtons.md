## AddPartyScreen — Bottom Action Buttons UI

This document describes the UI and behavior for the bottom action buttons on `AddPartyScreen` (Save/Add, Update, Delete), derived from the current implementation in `src/screens/HomeScreen/AddPartyScreen.tsx`.

### Container

- **Component**: `View` named `buttonContainer`
- **Placement**: Fixed at the bottom of the screen within `SafeAreaView` (`edges=['bottom']`) to respect device safe areas
- **Background**: `#fff`
- **Border**: Top divider, `borderTopWidth: 1`, `borderTopColor: #e2e8f0`
- **Padding**: `paddingHorizontal: 12`, `paddingVertical: 16`

### Buttons (Create Mode)

- **Primary Button**: "ADD CUSTOMER" or "ADD SUPPLIER" depending on `partyType`
- **Style**: `styles.addButton`
  - Background: `uiColors.primaryBlue`
  - Vertical padding: `14`
  - Border radius: `8`
  - Alignment: centered
  - Shadow/Elevation: `shadowColor: #4f8cff`, `shadowOffset: {0,2}`, `shadowOpacity: 0.2`, `shadowRadius: 4`, `elevation: 3`
- **Disabled Style**: `styles.buttonDisabled` (background `#ccc`)
- **Label**: `styles.addButtonText`
  - Color: `uiColors.textHeader`
  - Font: `uiFonts.family`, size `14`
- **Loading State**: `ActivityIndicator` (small, white)

### Buttons (Edit Mode)

- **Layout**: `styles.editButtonContainer` — horizontal row with `gap: 9`
  - Update button has `flex: 2`
  - Delete button has `flex: 1`

#### Update Button

- **Style**: `styles.updateButton`
  - Background: `uiColors.primaryBlue`
  - Vertical padding: `12`
  - Border radius: `6`
  - Alignment: centered
- **Disabled Style**: `styles.buttonDisabled` (for shared disabled state)
- **Label**: `styles.updateButtonText`
  - Color: `uiColors.textHeader`
  - Font: `uiFonts.family`, size `14`
- **Loading State**: `ActivityIndicator` (small, white)

#### Delete Button

- **Style**: `styles.deleteButton`
  - Layout: Row, centered, with icon and label `gap: 6`
  - Background: `#dc3545`
  - Vertical padding: `12`
  - Border radius: `6`
- **Disabled Style**: `styles.buttonDisabled` (applied alongside when loading/deleting)
- **Label**: `styles.deleteButtonText`
  - Color: `#fff`, size `14`
- **Icon**: `MaterialCommunityIcons` name `delete`, size `20`, color `#fff`
- **Loading State**: `ActivityIndicator` (small, white)

### Heights and Spacing Summary

- Buttons do not set fixed height; height derives from vertical padding and font size.
  - Add button effective height ≈ 14 (top) + 14 (bottom) + text height.
  - Update/Delete effective height ≈ 12 (top) + 12 (bottom) + text height.
- Bottom spacing from screen edge:
  - `buttonContainer` sits inside `SafeAreaView` with `paddingVertical: 16`, ensuring consistent gap from the bottom including device safe area insets.

### States and Behavior

- Buttons are disabled when `loading` (and `deleting` for delete) to prevent duplicate actions.
- Labels switch based on `partyType`: `ADD CUSTOMER` or `ADD SUPPLIER`.
- Edit mode shows two actions: `UPDATE {partyType}` and `DELETE`.

### Accessibility and Touch Areas

- Touch targets are large due to padding; no explicit `hitSlop` defined on buttons, but visual size is adequate on modern devices.

### Visual Tokens and Colors

- Primary blue: `uiColors.primaryBlue`
- Primary text on buttons: `uiColors.textHeader`
- Error red (Delete): `#dc3545`
- Dividers: `#e2e8f0`
- Disabled background: `#ccc`

### Recommendations (Optional Enhancements)

- Unify vertical padding to ensure consistent perceived height across all actions (e.g., use `14` for update/delete as well).
- Consider adding `minHeight` (44–48) for explicit touch target sizing on all platforms.
- Provide `hitSlop` for the whole button row on compact screens.
- Add pressed/feedback states (e.g., slight opacity or scale) for better affordance.

### Source Styles

- Container: `styles.buttonContainer`
- Create mode button: `styles.addButton`, `styles.addButtonText`
- Edit mode layout: `styles.editButtonContainer`
- Update button: `styles.updateButton`, `styles.updateButtonText`
- Delete button: `styles.deleteButton`, `styles.deleteButtonText`
- Disabled: `styles.buttonDisabled`
