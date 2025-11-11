import { getStatusBarHeight } from 'react-native-status-bar-height';

export const HEADER_CONTENT_HEIGHT = 72; // Taller header content area for all screens
export const HEADER_PADDING_TOP = 12; // Increased padding between status bar and header content
export const STATUS_BAR_HEIGHT = getStatusBarHeight(true); // Precise status bar height

export const getHeaderContainerStyle = (statusBarHeight: number) => ({
  paddingTop: statusBarHeight + HEADER_PADDING_TOP,
  minHeight: statusBarHeight + HEADER_PADDING_TOP + HEADER_CONTENT_HEIGHT,
});

export const getHeaderContentStyle = () => ({
  height: HEADER_CONTENT_HEIGHT,
  alignItems: 'center' as const,
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  paddingHorizontal: 20,
});

// For gradient headers (like ProfileScreen)
export const getGradientHeaderStyle = (statusBarHeight: number) => ({
  paddingTop: statusBarHeight + HEADER_PADDING_TOP,
  paddingBottom: 12,
  paddingHorizontal: 20,
});

// For solid color headers (like CustomerScreen, etc.)
export const getSolidHeaderStyle = (statusBarHeight: number) => ({
  paddingTop: statusBarHeight + HEADER_PADDING_TOP,
  paddingBottom: 0,
  paddingHorizontal: 20,
});
