# CustomerScreen Header Rules & Specifications

## Overview

This document defines the complete rules, specifications, and constraints for the CustomerScreen header component. All changes to the header must comply with these specifications.

---

## Header Structure

### Layout

- **Background**: Solid blue (`#4f8cff`)
- **Layout**: Horizontal flex row with space-between alignment
- **Padding**: 12px horizontal, 30px vertical
- **Status Bar**: Uses `getSolidHeaderStyle()` for proper spacing

### Elements (Left to Right)

1. **Status Bar Spacer** - `HEADER_CONTENT_HEIGHT` constant
2. **Menu Button** - Hamburger icon (opens drawer)
3. **Title Section** - Icon + Text (business name)
4. **Edit Button** - Pencil icon (navigates to ProfileScreen)
5. **Spacer** - 24px width for alignment

---

## Typography Rules

### Header Text

- **Font Family**: `'Roboto-Medium'` ⚠️ **MUST NOT CHANGE**
- **Font Size**: `15px` (increased from base 14px)
- **Font Weight**: `800` (Extra Bold)
- **Color**: White (`#fff`)
- **Content**: Business name via `getHeaderDisplayName()`
  - Fallback: `"My Business"` if name not available

### Constraints

- ❌ **DO NOT** change font family
- ✅ Font weight must be `800`
- ✅ Font size must be `15px`
- ✅ Text color must be white (`#fff`)

---

## Icon Specifications

### Menu Icon (Hamburger)

- **Name**: `"menu"`
- **Size**: `25px` (increased from base 24px)
- **Color**: White (`#fff`)
- **Location**: Left side of header
- **Action**: Opens drawer navigation

### Book Icon (Title Icon)

- **Name**: `"book-open-variant"`
- **Size**: `21px` (increased from base 20px)
- **Color**: White (`#fff`)
- **Gap from text**: `8px`
- **Location**: Before title text

### Edit Icon (Pencil)

- **Name**: `"pencil"`
- **Size**: `17px` (increased from base 16px)
- **Color**: White (`#fff`)
- **Background**: `rgba(255,255,255,0.2)`
- **Padding**: `8px`
- **Border Radius**: `8px`
- **Location**: Right side of header
- **Action**: Navigates to `ProfileScreen`

### Icon Size Constraints

- ✅ Menu icon must be `25px`
- ✅ Book icon must be `21px`
- ✅ Pencil icon must be `17px`
- ✅ All icons must be white (`#fff`)

---

## Layout Rules

### Menu Button

- **Padding**: `10px`
- **Margin Right**: `6px`
- **Hit Slop**: `10px` all sides (top, bottom, left, right)
- **Active Opacity**: `0.8`
- **Style**: `styles.headerMenuButton`

### Title Container

- **Flex Direction**: Row
- **Align Items**: Center
- **Gap**: `8px` between icon and text
- **Style**: `styles.headerTitle`

### Edit Button

- **Margin Left**: `12px`
- **Active Opacity**: `0.7`
- **Style**: `styles.editIconButton`

---

## Styling Constraints

### Colors

- **Background**: `#4f8cff` (blue) - **MUST NOT CHANGE**
- **Text**: `#fff` (white) - **MUST NOT CHANGE**
- **Icons**: `#fff` (white) - **MUST NOT CHANGE**

### Typography

- **Font Family**: `'Roboto-Medium'` - **MUST NOT CHANGE**
- **Font Weight**: `800` - **MUST NOT CHANGE**
- **Font Size**: `15px` - **MUST NOT CHANGE**

### Icon Sizes

- **Menu**: `25px` - **MUST NOT CHANGE**
- **Book**: `21px` - **MUST NOT CHANGE**
- **Pencil**: `17px` - **MUST NOT CHANGE**

---

## Functionality

### Menu Button

- **Action**: `navigation.dispatch(DrawerActions.openDrawer())`
- **Purpose**: Opens the drawer navigation menu

### Edit Button

- **Action**: `navigation.navigate('ProfileScreen', { user: {} })`
- **Purpose**: Navigates to the profile screen for editing

### Title Text

- **Source**: `getHeaderDisplayName()` function
- **Fallback**: `"My Business"` if business name is not available
- **Updates**: Dynamically updates when business name changes

---

## Error Handling

### Implementation

- Header rendering is wrapped in a `try-catch` block
- On error, displays fallback header with `"Error"` text
- Error is logged to console: `console.error('Error rendering header:', error)`

### Fallback UI

```typescript
<View style={styles.header}>
  <Text style={styles.headerText}>Error</Text>
</View>
```

---

## Technical Details

### Key Prop

- Uses dynamic key: `` `hdr-${headerKey}` ``
- Forces re-render when `headerKey` state changes
- Ensures header updates when business name changes

### Integration

- Uses `getSolidHeaderStyle()` for status bar height calculation
- Integrates with `useStatusBarWithGradient` hook
- Uses `preciseStatusBarHeight` or `statusBarSpacer.height`

### Status Bar

- Uses `HEADER_CONTENT_HEIGHT` constant for proper spacing
- Handles different device status bar heights

---

## StyleSheet Reference

### Relevant Styles

```typescript
header: {
  backgroundColor: '#4f8cff',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingHorizontal: 12,
  paddingTop: 30,
  paddingBottom: 30,
}

headerTitle: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
}

headerText: {
  color: '#fff',
  fontSize: 15,
  fontWeight: '800',
  fontFamily: 'Roboto-Medium',
}

headerMenuButton: {
  padding: 10,
  marginRight: 6,
}

editIconButton: {
  padding: 8,
  borderRadius: 8,
  backgroundColor: 'rgba(255,255,255,0.2)',
  marginLeft: 12,
}
```

---

## Change Log

### Version 1.0 (Current)

- Font size increased from `14px` to `15px`
- Font weight set to `800`
- Icon sizes increased:
  - Menu: `24px` → `25px`
  - Book: `20px` → `21px`
  - Pencil: `16px` → `17px`

---

## Notes

- All measurements are in pixels
- Font family is locked and cannot be changed
- Icon sizes are locked and cannot be changed
- Background color is locked and cannot be changed
- Any changes to header must be documented in this file
- Breaking these rules may cause UI inconsistencies

---

## Maintenance

### When to Update This File

- When header layout changes
- When typography specifications change
- When icon sizes or types change
- When functionality changes
- When new constraints are added

### Review Process

- Review this file before making header changes
- Update this file when header changes are made
- Ensure all team members are aware of these rules

---

**Last Updated**: Current version
**File Location**: `UtilsApp/src/screens/HomeScreen/CustomerScreen.header.rules.md`
**Related File**: `UtilsApp/src/screens/HomeScreen/CustomerScreen.tsx`
