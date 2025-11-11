import { Text, TextInput } from 'react-native';

// Apply global default font families for the entire app
// Call initGlobalTypography() once at startup (before any screens mount)
export function initGlobalTypography() {
  try {
    // Ensure defaultProps exist
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (Text.defaultProps == null) Text.defaultProps = {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (TextInput.defaultProps == null) TextInput.defaultProps = {};

    // Enforce Roboto across all text by default
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Text.defaultProps.style = [
      // Preserve any style set at usage site by keeping this as base
      { fontFamily: 'Roboto-Medium' },
      // Existing default style (if any) will still be merged later by RN
    ];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    TextInput.defaultProps.style = [{ fontFamily: 'Roboto-Medium' }];

    // Accessibility scaling consistency
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Text.defaultProps.allowFontScaling = false;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Text.defaultProps.maxFontSizeMultiplier = 1;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    TextInput.defaultProps.allowFontScaling = false;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    TextInput.defaultProps.maxFontSizeMultiplier = 1;
  } catch (e) {
    // Fail-safe: do not crash the app if something goes wrong here
    console.warn('Typography init failed:', e);
  }
}

// Helper styles for bold/medium text when needed
export const font = {
  regular: { fontFamily: 'Roboto-Medium' },
  medium: { fontFamily: 'Roboto-Medium' },
  bold: { fontFamily: 'Roboto-Medium' },
};
