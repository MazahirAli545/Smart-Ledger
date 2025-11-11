// Centralized UI sizing and color tokens derived from CustomerScreen_UI_Sizing_Documentation.md
// Only include tokens we actively use across multiple screens to avoid churn.

export const uiColors = {
  primaryBlue: '#4f8cff',
  successGreen: '#28a745',
  errorRed: '#dc3545',
  warningOrange: '#ff9800',
  infoBlue: '#2196f3',

  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#8a94a6',
  textHeader: '#fff',

  bgMain: '#f8fafc',
  bgCard: '#ffffff',
  bgModal: '#fff',

  borderLight: '#e2e8f0',
  borderMedium: '#d1d5db',
  borderDark: '#cfe0ff',
  borderActive: '#4f8cff',
} as const;

export const uiFonts = {
  family: 'Roboto-Medium',
  // Sizes (rounded to nearest integer where reasonable)
  fontWeight: 700,
  sizeHeader: 14,
  sizeTab: 12,
  sizeNewBadge: 7.5,
  sizeSummaryLabel: 11,
  sizeSummaryAmount: 22,
  sizeDataAmount: 20,
  sizeBottomReport: 10.5,
  sizeSearchInput: 14,
  sizeCustomerName: 16,
  sizeCustomerMeta: 13,
  sizeAvatarText: 15,
  sizeAmountMain: 16,
  sizeAmountLabel: 9,
  sizeSmall: 9,
  sizeXs: 8,
} as const;

export const uiButtons = {
  paddingMd: 12,
  paddingSm: 8,
  paddingLg: 16,
  radiusSm: 6,
  radiusMd: 12,
  radiusLg: 24,
  minHit: 40,
} as const;

export const uiLayout = {
  containerPaddingH: 12,
  containerPaddingV: 12,
  cardPadding: 16,
  gapSm: 6,
  gapMd: 8,
  gapLg: 12,
  elevationLow: 2,
  elevationMed: 4,
  elevationHigh: 6,
} as const;

export const uiIcons = {
  sizeHeaderBack: 24,
  sizeHeaderPhone: 20,
  sizeAction: 24,
  sizeAlert: 40,
} as const;

export type UIColors = typeof uiColors;
export type UIFonts = typeof uiFonts;
export type UIButtons = typeof uiButtons;
export type UILayout = typeof uiLayout;
export type UIIcons = typeof uiIcons;
