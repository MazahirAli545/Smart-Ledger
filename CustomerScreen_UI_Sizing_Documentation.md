# CustomerScreen.tsx - UI Sizing Documentation

This document catalogs all sizing specifications for buttons, fonts, images, touchable opacity, and other UI elements found in the CustomerScreen.tsx file.

## Table of Contents

1. [Font Sizes](#font-sizes)
2. [Button Sizes](#button-sizes)
3. [TouchableOpacity Specifications](#touchableopacity-specifications)
4. [Icon Sizes](#icon-sizes)
5. [Container Dimensions](#container-dimensions)
6. [Padding & Margins](#padding--margins)
7. [Border Radius Values](#border-radius-values)
8. [Shadow & Elevation](#shadow--elevation)
9. [Color Specifications](#color-specifications)
10. [Modal Dimensions](#modal-dimensions)

---

## Font Sizes

### Header Text

- **headerText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``

### Tab Text

- **tabText**: `fontSize: 12`, `fontFamily: 'Roboto-Medium'`, ``
- **activeTabText**: `fontFamily: 'Roboto-Medium'`, ``

### New Badge Text

- **newBadgeText**: `fontSize: 7.5`, `fontFamily: 'Roboto-Medium'`, ``

### Summary Section

- **summaryLabel**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``
- **summaryAmount**: `fontSize: 22`, `fontFamily: 'Roboto-Medium'`, ``
- **dataDisplayLabel**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``
- **dataDisplayAmount**: `fontSize: 20`, `fontFamily: 'Roboto-Medium'`, ``
- **bottomViewReportText**: `fontSize: 10.5`, `fontFamily: 'Roboto-Medium'`, ``

### Search & Filter

- **searchInput**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``

### Customer Items

- **customerName**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **customerDate**: `fontSize: 13`, `fontFamily: 'Roboto-Medium'`, ``
- **customerPhone**: `fontSize: 13`, `fontFamily: 'Roboto-Medium'`, ``
- **avatarText**: `fontSize: 15`, `fontFamily: 'Roboto-Medium'`, ``
- **amountText**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **amountLabel**: `fontSize: 9`, `fontFamily: 'Roboto-Medium'`, ``

### FAB (Floating Action Button)

- **fabText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``

### Loading & Error States

- **loadingText**: `fontSize: 10`, `fontFamily: 'Roboto-Medium'`, ``
- **errorText**: `fontSize: 10`, `fontFamily: 'Roboto-Medium'`, ``
- **retryButtonText**: `fontSize: 9.5`, `fontFamily: 'Roboto-Medium'`, ``
- **emptyText**: `fontSize: 12`, `fontFamily: 'Roboto-Medium'`, ``
- **emptySubtext**: `fontSize: 9.5`, `fontFamily: 'Roboto-Medium'`, ``

### Modal Text

- **modalTitle**: `fontSize: 18`, `fontFamily: 'Roboto-Medium'`, ``
- **modalSubtitle**: `fontSize: 12`, `fontFamily: 'Roboto-Medium'`, ``
- **sectionTitle**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **quickFilterLabel**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **quickFilterSubtext**: `fontSize: 12`, `fontFamily: 'Roboto-Medium'`, ``
- **amountRangeText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **contactFilterTitle**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **contactFilterButtonText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``

### Filter Options

- **filterOptionText**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``
- **resetButtonText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **applyButtonText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **filterBadgeText**: `fontSize: 8`, `fontFamily: 'Roboto-Medium'`, ``

### Business Info Modal

- **businessInfoModalTitle**: `fontSize: 20`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoModalSubtitle**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoFormLabel**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoTextInput**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoDropdownPlaceholder**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoDropdownSelectedText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoSectionTitle**: `fontSize: 16`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoModalSkipText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``
- **businessInfoModalSaveText**: `fontSize: 14`, `fontFamily: 'Roboto-Medium'`, ``

### Alert Modal

- **alertTitle**: `fontSize: 15`, `fontFamily: 'Roboto-Medium'`, ``
- **alertMessage**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``
- **alertButtonCancelText**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``
- **alertButtonConfirmText**: `fontSize: 11`, `fontFamily: 'Roboto-Medium'`, ``

---

## Button Sizes

### Header Buttons

- **headerMenuButton**: `padding: 10`
- **editIconButton**: `padding: 8`, `borderRadius: 8`

### Tab Buttons

- **tab**: `paddingVertical: 12`, `flex: 1`

### Filter Button

- **filterButton**: `padding: 8`, `borderRadius: 14`, `minWidth: 40`, `height: 40`

### Customer Item (TouchableOpacity)

- **customerItem**: `paddingHorizontal: 14`, `paddingVertical: 11`, `borderRadius: 12`

### FAB (Floating Action Button)

- **fab**: `paddingHorizontal: 16`, `paddingVertical: 12`, `borderRadius: 24`

### Retry Button

- **retryButton**: `paddingHorizontal: 18`, `paddingVertical: 9`, `borderRadius: 6`

### Modal Buttons

- **closeButton**: `padding: 12`, `minWidth: 48`, `minHeight: 48`
- **resetButton**: `paddingVertical: 14`, `paddingHorizontal: 16`, `borderRadius: 12`
- **applyButton**: `paddingVertical: 14`, `paddingHorizontal: 16`, `borderRadius: 12`

### Filter Options

- **filterOption**: `paddingHorizontal: 12`, `paddingVertical: 7.5`, `borderRadius: 15`, `minWidth: 63.75`
- **amountRangeOption**: `paddingHorizontal: 16`, `paddingVertical: 12`, `borderRadius: 16`, `minWidth: 80`
- **contactFilterButton**: `paddingHorizontal: 12`, `paddingVertical: 10`, `borderRadius: 16`, `minWidth: 70`

### Business Info Modal Buttons

- **businessInfoModalCloseButton**: `width: 40`, `height: 40`, `borderRadius: 20`
- **businessInfoModalSkipButton**: `paddingVertical: 10`, `paddingHorizontal: 16`, `borderRadius: 8`
- **businessInfoModalSaveButton**: `paddingVertical: 10`, `paddingHorizontal: 16`, `borderRadius: 8`

### Alert Buttons

- **alertButtonCancel**: `paddingVertical: 12`, `paddingHorizontal: 18`, `borderRadius: 9`
- **alertButtonConfirm**: `paddingVertical: 12`, `paddingHorizontal: 18`, `borderRadius: 9`

---

## TouchableOpacity Specifications

### Active Opacity Values

- **headerMenuButton**: `activeOpacity: 0.8`
- **editIconButton**: `activeOpacity: 0.7`
- **filterButton**: `activeOpacity: 0.7`
- **customerItem**: Default (0.2)
- **fab**: Default (0.2)
- **retryButton**: Default (0.2)
- **closeButton**: Default (0.2)
- **resetButton**: Default (0.2)
- **applyButton**: Default (0.2)
- **filterOption**: Default (0.2)
- **amountRangeOption**: Default (0.2)
- **contactFilterButton**: Default (0.2)
- **businessInfoModalCloseButton**: Default (0.2)
- **businessInfoModalSkipButton**: Default (0.2)
- **businessInfoModalSaveButton**: Default (0.2)
- **alertButtonCancel**: `activeOpacity: 0.7`
- **alertButtonConfirm**: `activeOpacity: 0.8`

### Hit Slop Areas

- **headerMenuButton**: `hitSlop: { top: 10, bottom: 10, left: 10, right: 10 }`

---

## Icon Sizes

### Header Icons

- **Menu Icon**: `size: 24`
- **Book Icon**: `size: 20`
- **Edit Icon**: `size: 16`

### Summary Icons

- **Arrow Up Icon**: `size: 18`
- **Arrow Down Icon**: `size: 18`
- **Trending Up Icon**: `size: 18`
- **Cart Icon**: `size: 18`
- **Chart Line Icon**: `size: 16`

### Search & Filter Icons

- **Magnify Icon**: `size: 20`
- **Close Circle Icon**: `size: 20`
- **Filter Variant Icon**: `size: 20`

### Customer Item Icons

- **Avatar Text**: `fontSize: 15` (not an icon, but text size)

### FAB Icons

- **Account Plus Icon**: `size: 24`
- **Truck Plus Icon**: `size: 24`

### Loading & Error Icons

- **Alert Circle Icon**: `size: 48`
- **Account Group Icon**: `size: 48`
- **Truck Delivery Icon**: `size: 48`

### Modal Icons

- **Arrow Left Icon**: `size: 28`
- **Close Icon**: `size: 24`
- **Check Icon**: `size: 16`
- **Refresh Icon**: `size: 16`

### Filter Modal Icons

- **Arrow Down Icon**: `size: 20`
- **Arrow Up Icon**: `size: 20`
- **Currency INR Icon**: `size: 16`
- **Map Marker Icon**: `size: 18`
- **Phone Icon**: `size: 20`
- **Card Account Details Icon**: `size: 20`
- **Phone Check Icon**: `size: 14`
- **Phone Off Icon**: `size: 14`
- **Check Circle Icon**: `size: 14`
- **Close Circle Icon**: `size: 14`

### Business Info Modal Icons

- **Briefcase Icon**: `size: 24`
- **Account Icon**: `size: 18`
- **Close Icon**: `size: 24`

### Alert Modal Icons

- **Check Circle Icon**: `size: 40`
- **Close Circle Icon**: `size: 40`
- **Alert Circle Icon**: `size: 40`
- **Help Circle Icon**: `size: 40`
- **Information Icon**: `size: 40`

---

## Container Dimensions

### Main Containers

- **container**: `flex: 1`
- **content**: `flex: 1`, `paddingHorizontal: 12`
- **customerList**: `marginBottom: 60` (space for FAB)

### Header Container

- **header**: `paddingHorizontal: 12`, `paddingVertical: 12`
- **headerTitle**: `gap: 8`

### Tab Container

- **tabContainer**: `paddingHorizontal: 12`, `paddingVertical: 8`

### Summary Container

- **summaryContainer**: `paddingHorizontal: 16`, `paddingVertical: 8`, `marginTop: 6`
- **summaryRow**: `marginBottom: 10`, `paddingHorizontal: 4`
- **summaryItem**: `paddingVertical: 8`, `marginHorizontal: 6`
- **dataDisplayRow**: `gap: 10`, `marginTop: 6`, `paddingHorizontal: 4`
- **dataDisplayItem**: `paddingVertical: 8`, `marginHorizontal: 2`

### Search Container

- **searchContainer**: `marginTop: 8`, `marginBottom: 8`, `gap: 12`
- **searchBar**: `paddingHorizontal: 14`

### Customer Item Container

- **customerItem**: `paddingHorizontal: 14`, `paddingVertical: 11`, `marginBottom: 10`
- **customerAvatar**: `width: 38`, `height: 38`, `borderRadius: 19`, `marginRight: 12`

### Modal Containers

- **modalOverlay**: `paddingTop: 37.5`
- **modalContent**: `height: '100%'`
- **modalHeader**: `padding: 10.5`, `paddingBottom: 7.5`
- **modalBodyContent**: `padding: 16`, `paddingBottom: 16`
- **modalFooter**: `padding: 10.5`, `paddingTop: 7.5`, `paddingBottom: 6`, `gap: 10.5`

### Business Info Modal Containers

- **businessInfoModalContent**: `margin: 20`, `maxHeight: '90%'`
- **businessInfoModalHeader**: `padding: 24`, `paddingBottom: 16`
- **businessInfoModalScrollContent**: `padding: 24`, `paddingBottom: 20`
- **businessInfoModalFooter**: `padding: 20`, `paddingTop: 12`, `gap: 12`

### Alert Modal Containers

- **alertOverlay**: `paddingHorizontal: 15`
- **alertContainer**: `padding: 24`, `marginHorizontal: 15`, `maxWidth: 255`
- **alertIconContainer**: `width: 60`, `height: 60`, `borderRadius: 30`, `marginBottom: 15`

---

## Padding & Margins

### Header Padding

- **header**: `paddingHorizontal: 12`, `paddingVertical: 12`
- **headerMenuButton**: `padding: 10`, `marginRight: 6`
- **editIconButton**: `padding: 8`, `marginLeft: 12`

### Tab Padding

- **tabContainer**: `paddingHorizontal: 12`, `paddingVertical: 8`
- **tab**: `paddingVertical: 12`

### Summary Padding

- **summaryContainer**: `paddingHorizontal: 16`, `paddingVertical: 8`, `marginTop: 6`
- **summaryItem**: `paddingVertical: 8`, `marginHorizontal: 6`
- **dataDisplayItem**: `paddingVertical: 8`, `marginHorizontal: 2`

### Search Padding

- **searchContainer**: `marginTop: 8`, `marginBottom: 8`
- **searchBar**: `paddingHorizontal: 14`

### Customer Item Padding

- **customerItem**: `paddingHorizontal: 14`, `paddingVertical: 11`, `marginBottom: 10`
- **customerAvatar**: `marginRight: 12`

### FAB Padding

- **fab**: `paddingHorizontal: 16`, `paddingVertical: 12`

### Modal Padding

- **modalHeader**: `padding: 10.5`, `paddingBottom: 7.5`
- **modalBodyContent**: `padding: 16`, `paddingBottom: 16`
- **modalFooter**: `padding: 10.5`, `paddingTop: 7.5`, `paddingBottom: 6`

### Filter Section Padding

- **filterSection**: `marginBottom: 12`
- **quickFiltersSection**: `marginBottom: 15`
- **businessInfoSection**: `marginBottom: 24`
- **businessInfoFormField**: `marginBottom: 20`

---

## Border Radius Values

### Small Radius (6-8px)

- **editIconButton**: `borderRadius: 8`
- **retryButton**: `borderRadius: 6`
- **businessInfoModalSkipButton**: `borderRadius: 8`
- **businessInfoModalSaveButton**: `borderRadius: 8`

### Medium Radius (10-15px)

- **filterButton**: `borderRadius: 14`
- **customerItem**: `borderRadius: 12`
- **modalContent**: `borderTopLeftRadius: 15`, `borderTopRightRadius: 15`
- **filterOption**: `borderRadius: 15`
- **amountRangeOption**: `borderRadius: 16`
- **contactFilterButton**: `borderRadius: 16`

### Large Radius (20-30px)

- **fab**: `borderRadius: 24`
- **businessInfoModalContent**: `borderRadius: 20`
- **businessInfoModalCloseButton**: `borderRadius: 20`
- **alertContainer**: `borderRadius: 15`
- **alertIconContainer**: `borderRadius: 30`

### Icon Container Radius

- **customerAvatar**: `borderRadius: 19`
- **summaryIconWrap**: `borderRadius: 14`
- **dataDisplayIconWrap**: `borderRadius: 14`
- **quickFilterIcon**: `borderRadius: 16`
- **businessInfoModalIconContainer**: `borderRadius: 24`
- **businessInfoSectionIconContainer**: `borderRadius: 16`

---

## Shadow & Elevation

### Low Elevation (1-2)

- **summaryItem**: `elevation: 2`, `shadowOpacity: 0.05`, `shadowRadius: 6`
- **dataDisplayItem**: `elevation: 2`, `shadowOpacity: 0.05`, `shadowRadius: 6`
- **searchBar**: `elevation: 2`
- **filterButton**: `elevation: 2`, `shadowOpacity: 0.06`, `shadowRadius: 6`
- **customerItem**: `elevation: 2`, `shadowOpacity: 0.06`, `shadowRadius: 8`
- **filterOption**: `elevation: 1`, `shadowOpacity: 0.05`, `shadowRadius: 2`
- **amountRangeOption**: `elevation: 1`, `shadowOpacity: 0.05`, `shadowRadius: 2`
- **contactFilterButton**: `elevation: 1`, `shadowOpacity: 0.05`, `shadowRadius: 2`

### Medium Elevation (3-5)

- **modalContent**: `elevation: 8`, `shadowOpacity: 0.2`, `shadowRadius: 12`
- **contactFilterCard**: `elevation: 3`, `shadowOpacity: 0.06`, `shadowRadius: 8`
- **businessInfoDropdownContainer**: `elevation: 5`, `shadowOpacity: 0.1`, `shadowRadius: 8`

### High Elevation (6+)

- **fab**: `elevation: 6`, `shadowOpacity: 0.2`, `shadowRadius: 8`
- **businessInfoModalSaveButton**: `elevation: 6`, `shadowOpacity: 0.3`, `shadowRadius: 8`
- **alertContainer**: `elevation: 12`, `shadowOpacity: 0.3`, `shadowRadius: 16`
- **alertButtonConfirm**: `elevation: 4`, `shadowOpacity: 0.2`, `shadowRadius: 4`

---

## Color Specifications

### Primary Colors

- **Primary Blue**: `#4f8cff`
- **Success Green**: `#28a745`
- **Error Red**: `#dc3545`
- **Warning Orange**: `#ff9800`
- **Info Blue**: `#2196f3`

### Background Colors

- **Main Background**: `#f8fafc`
- **Card Background**: `#ffffff`
- **Modal Background**: `#fff`
- **Alert Background**: `#fff`
- **Header Background**: `#4f8cff`

### Text Colors

- **Primary Text**: `#111827`
- **Secondary Text**: `#6b7280`
- **Tertiary Text**: `#8a94a6`
- **Header Text**: `#fff`
- **Error Text**: `#dc3545`

### Border Colors

- **Light Border**: `#e2e8f0`
- **Medium Border**: `#d1d5db`
- **Dark Border**: `#cfe0ff`
- **Active Border**: `#4f8cff`

---

## Modal Dimensions

### Filter Modal

- **modalOverlay**: `paddingTop: 37.5`
- **modalContent**: `height: '100%'`
- **modalHeader**: `padding: 10.5`, `paddingBottom: 7.5`
- **modalBodyContent**: `padding: 16`, `paddingBottom: 16`
- **modalFooter**: `padding: 10.5`, `paddingTop: 7.5`, `paddingBottom: 6`

### Business Info Modal

- **businessInfoModalContent**: `margin: 20`, `maxHeight: '90%'`
- **businessInfoModalHeader**: `padding: 24`, `paddingBottom: 16`
- **businessInfoModalScrollContent**: `padding: 24`, `paddingBottom: 20`
- **businessInfoModalFooter**: `padding: 20`, `paddingTop: 12`

### Alert Modal

- **alertOverlay**: `paddingHorizontal: 15`
- **alertContainer**: `padding: 24`, `marginHorizontal: 15`, `maxWidth: 255`
- **alertIconContainer**: `width: 60`, `height: 60`, `borderRadius: 30`

---

## Special Notes

### Font Family Consistency

All text elements use `fontFamily: 'Roboto-Medium'` with `` for consistency.

### TouchableOpacity Defaults

Most TouchableOpacity components use the default `activeOpacity: 0.2` unless specified otherwise.

### Shadow Consistency

Shadows follow a consistent pattern with `shadowColor: '#000'` and varying opacity and radius values.

### Border Radius Hierarchy

- Small elements: 6-8px
- Medium elements: 10-15px
- Large elements: 20-30px
- Circular elements: 50% of width/height

### Color System

The app uses a consistent color system with primary blue (#4f8cff) as the main accent color, supported by semantic colors for success, error, and warning states.

---

_This documentation was generated from CustomerScreen.tsx and contains all sizing specifications found in the StyleSheet.create() section of the file._
