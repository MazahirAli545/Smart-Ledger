# Bottom Buttons UI Documentation - AddNewEntryScreen

This document provides complete details about the bottom buttons UI implementation in `AddNewEntryScreen.tsx`, including all styling properties, dimensions, spacing, and behavior.

## Overview

The bottom buttons section displays different buttons based on the context:
- **Add Entry Button** (Save/Submit): Shown when creating a new entry
- **Update Entry Button**: Shown when editing an existing entry
- **Delete Entry Button**: Shown when editing an existing entry

---

## Button Container (`buttonContainer`)

The container that wraps all bottom buttons.

### Style Properties
- **paddingHorizontal**: `12px`
- **paddingVertical**: `16px`
- **backgroundColor**: `#fff` (white)
- **borderTopWidth**: `1px`
- **borderTopColor**: `#e2e8f0` (light gray)
- **alignItems**: `stretch`

### Layout Details
- Located at the bottom of the screen
- Fixed position above the safe area
- Full width of the screen
- White background with subtle top border separator

---

## Add Entry Button (Save/Submit)

Shown when creating a new entry (not in edit mode).

### Button Style (`submitButton` + `submitButtonFullWidth`)

#### Dimensions & Padding
- **paddingVertical**: `14px`
- **paddingHorizontal**: `20px`
- **borderRadius**: `8px`
- **width**: `100%` (full width)
- **flex**: `0` (when using `submitButtonFullWidth`)
- **alignSelf**: `center`

#### Colors & Appearance
- **backgroundColor**: `uiColors.primaryBlue` (blue - from theme config)
- **shadowColor**: `uiColors.primaryBlue`
- **shadowOffset**: `{ width: 0, height: 2 }`
- **shadowOpacity**: `0.2`
- **shadowRadius**: `4px`
- **elevation**: `3` (Android shadow)

#### Layout Properties
- **alignItems**: `center`
- **justifyContent**: `center`
- **marginLeft**: `0`
- **marginRight**: `0`

#### Text Style (`submitButtonText`)
- **color**: `uiColors.textHeader` (white - from theme config)
- **fontSize**: `14px`
- **letterSpacing**: `0.5px`
- **fontFamily**: `uiFonts.family` (from theme config)

#### Button Text
- **Label**: `"ADD ENTRY"`

#### Disabled State (`buttonDisabled`)
- **backgroundColor**: `#ccc` (gray)
- Applied when `loading` is `true`

---

## Update Entry Button

Shown when editing an existing entry (left side in edit mode).

### Button Style (`updateButtonEdit`)

#### Dimensions & Padding
- **paddingVertical**: `12px`
- **paddingHorizontal**: Not explicitly set (inherits from container)
- **borderRadius**: `6px`
- **flex**: `2` (takes 2/3 of available width in button row)
- **flexBasis**: `0`
- **minWidth**: `0`
- **flexShrink**: `1`

#### Colors & Appearance
- **backgroundColor**: `uiColors.primaryBlue` (blue - from theme config)
- **shadowColor**: `uiColors.primaryBlue`
- **shadowOffset**: `{ width: 0, height: 2 }`
- **shadowOpacity**: `0.2`
- **shadowRadius**: `4px`
- **elevation**: `3` (Android shadow)

#### Layout Properties
- **alignItems**: `center`
- **justifyContent**: `center`

#### Text Style (`submitButtonText`)
- **color**: `uiColors.textHeader` (white - from theme config)
- **fontSize**: `14px`
- **letterSpacing**: `0.5px`
- **fontFamily**: `uiFonts.family` (from theme config)

#### Button Text
- **Label**: `"UPDATE ENTRY"`

#### Disabled State (`buttonDisabled`)
- **backgroundColor**: `#ccc` (gray)
- Applied when `loading` is `true`

#### Loading State
- Shows `ActivityIndicator` with `size="small"` and `color="#fff"`

---

## Delete Entry Button

Shown when editing an existing entry (right side in edit mode).

### Button Style (`deleteButtonEdit`)

#### Dimensions & Padding
- **paddingVertical**: `12px`
- **paddingHorizontal**: Not explicitly set (inherits from container)
- **borderRadius**: `6px`
- **flex**: `1` (takes 1/3 of available width in button row)
- **flexBasis**: `0`
- **minWidth**: `0`
- **flexShrink**: `1`

#### Colors & Appearance
- **backgroundColor**: `#dc3545` (red)
- **shadowColor**: `#dc3545`
- **shadowOffset**: `{ width: 0, height: 2 }`
- **shadowOpacity**: `0.2`
- **shadowRadius**: `4px`
- **elevation**: `3` (Android shadow)

#### Layout Properties
- **flexDirection**: `row` (icon and text side by side)
- **gap**: `6px` (spacing between icon and text)
- **alignItems**: `center`
- **justifyContent**: `center`

#### Icon Properties
- **Icon**: `MaterialCommunityIcons` with name `"delete"`
- **size**: `20px`
- **color**: `#fff` (white)

#### Text Style (`deleteButtonText`)
- **color**: `#fff` (white)
- **fontSize**: `14px`
- **letterSpacing**: `0.5px`
- **fontFamily**: `uiFonts.family` (from theme config)

#### Button Text
- **Label**: `"DELETE"`

#### Disabled State (`buttonDisabled`)
- **backgroundColor**: `#ccc` (gray)
- Applied when `loading` is `true`

#### Loading State
- Shows `ActivityIndicator` with `size="small"` and `color="#fff"`

---

## Button Row Layout (Edit Mode)

When in edit mode, Update and Delete buttons are arranged in a row.

### Row Style (`buttonRow`)

#### Layout Properties
- **flexDirection**: `row`
- **gap**: `9px` (horizontal spacing between Update and Delete buttons)
- **alignItems**: `center`
- **width**: `100%`
- **paddingHorizontal**: `0`

#### Button Width Distribution
- **Update Button**: `flex: 2` (approximately 66.67% of available width)
- **Delete Button**: `flex: 1` (approximately 33.33% of available width)

---

## Spacing & Margins Summary

### Container Spacing
- **Horizontal Padding**: `12px` (left and right)
- **Vertical Padding**: `16px` (top and bottom)
- **Bottom Margin**: Automatically handled by SafeAreaView

### Button Internal Spacing
- **Add Entry Button**:
  - Vertical padding: `14px`
  - Horizontal padding: `20px`
  
- **Update Entry Button**:
  - Vertical padding: `12px`
  
- **Delete Entry Button**:
  - Vertical padding: `12px`
  - Gap between icon and text: `6px`

### Button Row Spacing (Edit Mode)
- **Gap between Update and Delete**: `9px`

---

## Button Dimensions Summary

| Button Type | Height Calculation | Width | Border Radius |
|-------------|-------------------|-------|---------------|
| Add Entry | Padding (14px × 2) + Text Height | 100% | 8px |
| Update Entry | Padding (12px × 2) + Text Height | ~66.67% (flex: 2) | 6px |
| Delete Entry | Padding (12px × 2) + Text Height | ~33.33% (flex: 1) | 6px |

---

## Typography Summary

All buttons use the same text styling:
- **Font Size**: `14px`
- **Letter Spacing**: `0.5px`
- **Font Family**: `uiFonts.family` (from theme config)
- **Font Weight**: Inherited from font family

### Text Colors
- **Add Entry & Update Entry**: `uiColors.textHeader` (white)
- **Delete Entry**: `#fff` (white)

---

## Shadow & Elevation

All buttons have consistent shadow properties:

### iOS Shadow
- **shadowColor**: Button's background color
- **shadowOffset**: `{ width: 0, height: 2 }`
- **shadowOpacity**: `0.2`
- **shadowRadius**: `4px`

### Android Elevation
- **elevation**: `3`

---

## States & Interactions

### Normal State
- Full opacity
- Full color intensity
- Shadow visible

### Disabled State
- **backgroundColor**: `#ccc` (gray)
- Applied when `loading` is `true`
- Prevents interaction

### Loading State
- Shows `ActivityIndicator` instead of text
- **ActivityIndicator size**: `small`
- **ActivityIndicator color**: `#fff` (white)
- Button remains disabled during loading

### Pressed State
- Uses React Native's default `TouchableOpacity` behavior
- Default `activeOpacity`: `0.2` (inherited from TouchableOpacity)

---

## Component Structure

```
<SafeAreaView edges={['bottom']}>
  <View style={styles.buttonContainer}>
    {editingItem ? (
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.updateButtonEdit}>
          <Text style={styles.submitButtonText}>UPDATE ENTRY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButtonEdit}>
          <MaterialCommunityIcons name="delete" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>DELETE</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity style={[styles.submitButton, styles.submitButtonFullWidth]}>
        <Text style={styles.submitButtonText}>ADD ENTRY</Text>
      </TouchableOpacity>
    )}
  </View>
</SafeAreaView>
```

---

## Code References

### Button Container
```3336:3343:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  buttonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'stretch',
  },
```

### Button Row
```3344:3350:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  buttonRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 0,
  },
```

### Submit Button (Add Entry)
```3351:3364:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  submitButton: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
```

### Submit Button Full Width
```3365:3372:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  submitButtonFullWidth: {
    width: '100%',
    alignSelf: 'center',
    flex: 0,
    borderRadius: 8,
    marginLeft: 0,
    marginRight: 0,
  },
```

### Update Button
```3373:3388:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  updateButtonEdit: {
    backgroundColor: uiColors.primaryBlue,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: uiColors.primaryBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
```

### Delete Button
```3398:3415:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  deleteButtonEdit: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    flexShrink: 1,
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
```

### Button Text Styles
```3392:3397:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  submitButtonText: {
    color: uiColors.textHeader,
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
  },
```

```3416:3421:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: uiFonts.family,
  },
```

### Button Disabled State
```3389:3391:UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
```

---

## Implementation Location

- **File**: `UtilsApp/src/screens/HomeScreen/AddNewEntryScreen.tsx`
- **Button Container**: Lines `2368-2421`
- **Style Definitions**: Lines `3336-3421`

---

## Notes

1. **Theme Colors**: The buttons use theme colors from `uiColors` and `uiFonts` imported from `../../config/uiSizing`
2. **Responsive Width**: In edit mode, buttons use flex ratios (2:1) for responsive sizing
3. **Safe Area**: The container respects the bottom safe area using `SafeAreaView` with `edges={['bottom']}`
4. **Loading State**: All buttons show an activity indicator when `loading` is `true`
5. **Icon Integration**: Delete button includes a MaterialCommunityIcons delete icon with 20px size

---

## Quick Reference

### Add Entry Button
- Full width button
- Blue background (`uiColors.primaryBlue`)
- 14px vertical padding, 20px horizontal padding
- 8px border radius
- White text, 14px font size

### Update Entry Button
- 2/3 width (flex: 2)
- Blue background (`uiColors.primaryBlue`)
- 12px vertical padding
- 6px border radius
- White text, 14px font size

### Delete Entry Button
- 1/3 width (flex: 1)
- Red background (`#dc3545`)
- 12px vertical padding
- 6px border radius
- White text, 14px font size
- Includes delete icon (20px) with 6px gap from text

### Button Container
- 12px horizontal padding
- 16px vertical padding
- White background with top border
- 9px gap between Update and Delete buttons in edit mode

