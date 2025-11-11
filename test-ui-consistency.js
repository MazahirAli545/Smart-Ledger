/**
 * UI Consistency Test Script
 *
 * This script verifies that all three screens (PaymentScreen, InvoiceScreen_clean, PurchaseScreen)
 * have consistent UI specifications as defined in PaymentScreen.tsx
 */

const fs = require('fs');
const path = require('path');

// UI Specifications from PaymentScreen.tsx
const PAYMENT_SCREEN_SPECS = {
  SCALE: 0.75,
  FONT_SIZES: {
    headerTitle: 18,
    cardTitle: 23.5, // 18 + 2 scaled
    inputLabel: 16,
    input: 18,
    primaryButtonText: 22,
    secondaryButtonText: 18,
    invoiceNumber: 18,
    customerName: 16,
    invoiceDate: 16,
    invoiceAmount: 18,
    addInvoiceText: 18,
    errorTextField: 14,
    modalTitle: 18,
    modalMessage: 14,
    modalButtonText: 14,
    statusText: 14,
    dropdownItemText: 14,
    syncButtonText: 14,
  },
  COLORS: {
    safeArea: '#f6fafc',
    header: '#4f8cff',
    headerTitle: '#fff',
    cardTitle: '#333333',
    inputLabel: '#333333',
    input: '#333333',
    inputBackground: '#f9f9f9',
    primaryButton: '#000',
    primaryButtonText: '#fff',
    secondaryButton: '#fff',
    secondaryButtonText: '#333333',
    errorTextField: '#d32f2f',
    modalTitle: '#28a745',
    modalMessage: '#333333',
    modalButton: '#28a745',
    modalButtonText: '#fff',
  },
  SPACING: {
    containerPadding: 16,
    cardPadding: 16,
    inputPaddingHorizontal: 12,
    inputPaddingVertical: 22,
    buttonPaddingVertical: 14,
    fieldWrapperMarginBottom: 8,
    cardMarginBottom: 16,
  },
  BORDER_RADIUS: {
    card: 12,
    input: 8,
    button: 8,
    modal: 16,
  },
};

function checkFileConsistency(filePath, fileName) {
  console.log(`\n=== Checking ${fileName} ===`);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let isConsistent = true;

  // Check for SCALE constant
  const scaleMatch = content.match(/const SCALE = ([\d.]+);/);
  if (scaleMatch) {
    const scaleValue = parseFloat(scaleMatch[1]);
    if (scaleValue === PAYMENT_SCREEN_SPECS.SCALE) {
      console.log(`✅ SCALE constant: ${scaleValue}`);
    } else {
      console.log(
        `❌ SCALE constant mismatch: ${scaleValue} (expected: ${PAYMENT_SCREEN_SPECS.SCALE})`,
      );
      isConsistent = false;
    }
  } else {
    console.log(`❌ SCALE constant not found`);
    isConsistent = false;
  }

  // Check for scale function
  if (
    content.includes(
      'const scale = (value: number) => Math.round(value * SCALE);',
    )
  ) {
    console.log(`✅ scale function found`);
  } else {
    console.log(`❌ scale function not found`);
    isConsistent = false;
  }

  // Check for invoiceLikeStyles
  if (
    content.includes(
      'const invoiceLikeStyles: Record<string, ViewStyle | TextStyle> = {',
    )
  ) {
    console.log(`✅ invoiceLikeStyles structure found`);
  } else {
    console.log(`❌ invoiceLikeStyles structure not found`);
    isConsistent = false;
  }

  // Check for key style properties
  const keyStyles = [
    'safeArea',
    'header',
    'headerTitle',
    'container',
    'card',
    'input',
    'inputLabel',
    'primaryButton',
    'secondaryButton',
    'errorTextField',
    'fieldWrapper',
  ];

  keyStyles.forEach(style => {
    if (content.includes(`${style}:`)) {
      console.log(`✅ ${style} style found`);
    } else {
      console.log(`❌ ${style} style missing`);
      isConsistent = false;
    }
  });

  // Check for specific font sizes
  Object.entries(PAYMENT_SCREEN_SPECS.FONT_SIZES).forEach(
    ([key, expectedSize]) => {
      const scaledSize = Math.round(expectedSize * PAYMENT_SCREEN_SPECS.SCALE);
      const pattern = new RegExp(`fontSize: scale\\(${expectedSize}\\)`);
      if (content.match(pattern)) {
        console.log(
          `✅ ${key} font size: ${expectedSize} (scaled: ${scaledSize})`,
        );
      } else {
        console.log(`❌ ${key} font size not found or incorrect`);
        isConsistent = false;
      }
    },
  );

  // Check for specific colors
  Object.entries(PAYMENT_SCREEN_SPECS.COLORS).forEach(
    ([key, expectedColor]) => {
      if (content.includes(expectedColor)) {
        console.log(`✅ ${key} color: ${expectedColor}`);
      } else {
        console.log(`❌ ${key} color not found: ${expectedColor}`);
        isConsistent = false;
      }
    },
  );

  return isConsistent;
}

function main() {
  console.log(
    '🎨 UI Consistency Test - PaymentScreen, InvoiceScreen_clean, PurchaseScreen',
  );
  console.log('='.repeat(80));

  const files = [
    {
      path: 'src/screens/HomeScreen/PaymentScreen.tsx',
      name: 'PaymentScreen.tsx',
    },
    {
      path: 'src/screens/HomeScreen/InvoiceScreen_clean.tsx',
      name: 'InvoiceScreen_clean.tsx',
    },
    {
      path: 'src/screens/HomeScreen/PurchaseScreen.tsx',
      name: 'PurchaseScreen.tsx',
    },
  ];

  let allConsistent = true;

  files.forEach(file => {
    const isConsistent = checkFileConsistency(file.path, file.name);
    if (!isConsistent) {
      allConsistent = false;
    }
  });

  console.log('\n' + '='.repeat(80));
  if (allConsistent) {
    console.log(
      '🎉 All screens are consistent with PaymentScreen UI specifications!',
    );
  } else {
    console.log(
      '⚠️  Some inconsistencies found. Please review the output above.',
    );
  }
  console.log('='.repeat(80));
}

main();
