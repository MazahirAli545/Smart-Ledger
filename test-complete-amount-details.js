const fs = require('fs');
const path = require('path');

// Test script to verify complete Amount Details section consistency
console.log('🔍 Testing complete Amount Details section consistency...\n');

const files = [
  'src/screens/HomeScreen/PurchaseScreen.tsx',
  'src/screens/HomeScreen/InvoiceScreen_clean.tsx',
];

const expectedStyles = {
  cardTitle: {
    fontSize: 'scale(22)',
    color: '#333',
    fontFamily: 'Roboto-Medium',
    fontWeight: '600',
  },
  inputLabel: {
    marginBottom: 'scale(8)',
    fontSize: '16',
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },
  textInput: {
    paddingVertical: 'scale(22)',
    fontSize: 'scale(18)',
    paddingHorizontal: 'scale(12)',
    backgroundColor: '#f9f9f9',
    borderColor: '#e0e0e0',
    borderWidth: '1',
    fontFamily: 'Roboto-Medium',
  },
  summaryItem: {
    fontSize: '16',
    color: '#333333',
    fontFamily: 'Roboto-Medium',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 'scale(12)',
    borderColor: '#e0e0e0',
    borderWidth: '1',
  },
};

let allConsistent = true;

files.forEach(filePath => {
  console.log(`📁 Checking ${filePath}...`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if Amount Details section exists
    if (!content.includes('Amount Details')) {
      console.log(`❌ Amount Details section not found in ${filePath}`);
      allConsistent = false;
      return;
    }

    // Check if summary section exists
    if (
      !content.includes('Subtotal:') ||
      !content.includes('GST') ||
      !content.includes('Total:')
    ) {
      console.log(`❌ Summary section not found in ${filePath}`);
      allConsistent = false;
      return;
    }

    // Check card title styling
    const cardTitleMatch = content.match(
      /Amount Details[\s\S]*?fontSize:\s*scale\((\d+)\)[\s\S]*?color:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"][\s\S]*?fontWeight:\s*['"]([^'"]+)['"]/,
    );
    if (cardTitleMatch) {
      const fontSize = cardTitleMatch[1];
      const color = cardTitleMatch[2];
      const fontFamily = cardTitleMatch[3];
      const fontWeight = cardTitleMatch[4];

      if (
        fontSize === '22' &&
        color === '#333' &&
        fontFamily === 'Roboto-Medium' &&
        fontWeight === '600'
      ) {
        console.log(`✅ Card title styling correct`);
      } else {
        console.log(
          `❌ Card title styling incorrect: fontSize=${fontSize}, color=${color}, fontFamily=${fontFamily}, fontWeight=${fontWeight}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Card title styling not found or malformed`);
      allConsistent = false;
    }

    // Check Tax Amount label styling
    const taxLabelMatch = content.match(
      /Tax Amount[\s\S]*?marginBottom:\s*scale\((\d+)\)[\s\S]*?fontSize:\s*(\d+)[\s\S]*?color:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (taxLabelMatch) {
      const marginBottom = taxLabelMatch[1];
      const fontSize = taxLabelMatch[2];
      const color = taxLabelMatch[3];
      const fontFamily = taxLabelMatch[4];

      if (
        marginBottom === '8' &&
        fontSize === '16' &&
        color === '#333333' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Tax Amount label styling correct`);
      } else {
        console.log(
          `❌ Tax Amount label styling incorrect: marginBottom=${marginBottom}, fontSize=${fontSize}, color=${color}, fontFamily=${fontFamily}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Tax Amount label styling not found or malformed`);
      allConsistent = false;
    }

    // Check Tax Amount TextInput styling
    const taxInputMatch = content.match(
      /Tax Amount[\s\S]*?paddingVertical:\s*scale\((\d+)\)[\s\S]*?fontSize:\s*scale\((\d+)\)[\s\S]*?backgroundColor:\s*['"]([^'"]+)['"][\s\S]*?borderColor:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (taxInputMatch) {
      const paddingVertical = taxInputMatch[1];
      const fontSize = taxInputMatch[2];
      const backgroundColor = taxInputMatch[3];
      const borderColor = taxInputMatch[4];
      const fontFamily = taxInputMatch[5];

      if (
        paddingVertical === '22' &&
        fontSize === '18' &&
        backgroundColor === '#f9f9f9' &&
        borderColor === '#e0e0e0' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Tax Amount TextInput styling correct`);
      } else {
        console.log(
          `❌ Tax Amount TextInput styling incorrect: paddingVertical=${paddingVertical}, fontSize=${fontSize}, backgroundColor=${backgroundColor}, borderColor=${borderColor}, fontFamily=${fontFamily}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Tax Amount TextInput styling not found or malformed`);
      allConsistent = false;
    }

    // Check Discount Amount label styling
    const discountLabelMatch = content.match(
      /Discount Amount[\s\S]*?marginBottom:\s*scale\((\d+)\)[\s\S]*?fontSize:\s*(\d+)[\s\S]*?color:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (discountLabelMatch) {
      const marginBottom = discountLabelMatch[1];
      const fontSize = discountLabelMatch[2];
      const color = discountLabelMatch[3];
      const fontFamily = discountLabelMatch[4];

      if (
        marginBottom === '8' &&
        fontSize === '16' &&
        color === '#333333' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Discount Amount label styling correct`);
      } else {
        console.log(
          `❌ Discount Amount label styling incorrect: marginBottom=${marginBottom}, fontSize=${fontSize}, color=${color}, fontFamily=${fontFamily}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Discount Amount label styling not found or malformed`);
      allConsistent = false;
    }

    // Check Discount Amount TextInput styling
    const discountInputMatch = content.match(
      /Discount Amount[\s\S]*?paddingVertical:\s*scale\((\d+)\)[\s\S]*?fontSize:\s*scale\((\d+)\)[\s\S]*?backgroundColor:\s*['"]([^'"]+)['"][\s\S]*?borderColor:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (discountInputMatch) {
      const paddingVertical = discountInputMatch[1];
      const fontSize = discountInputMatch[2];
      const backgroundColor = discountInputMatch[3];
      const borderColor = discountInputMatch[4];
      const fontFamily = discountInputMatch[5];

      if (
        paddingVertical === '22' &&
        fontSize === '18' &&
        backgroundColor === '#f9f9f9' &&
        borderColor === '#e0e0e0' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Discount Amount TextInput styling correct`);
      } else {
        console.log(
          `❌ Discount Amount TextInput styling incorrect: paddingVertical=${paddingVertical}, fontSize=${fontSize}, backgroundColor=${backgroundColor}, borderColor=${borderColor}, fontFamily=${fontFamily}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(
        `❌ Discount Amount TextInput styling not found or malformed`,
      );
      allConsistent = false;
    }

    // Check summary section styling
    const summaryMatch = content.match(
      /Subtotal:[\s\S]*?fontSize:\s*(\d+)[\s\S]*?color:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (summaryMatch) {
      const fontSize = summaryMatch[1];
      const color = summaryMatch[2];
      const fontFamily = summaryMatch[3];

      if (
        fontSize === '16' &&
        color === '#333333' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Summary section styling correct`);
      } else {
        console.log(
          `❌ Summary section styling incorrect: fontSize=${fontSize}, color=${color}, fontFamily=${fontFamily}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Summary section styling not found or malformed`);
      allConsistent = false;
    }

    // Check summary container styling
    const summaryContainerMatch = content.match(
      /backgroundColor:\s*['"]([^'"]+)['"][\s\S]*?borderRadius:\s*scale\((\d+)\)[\s\S]*?borderColor:\s*['"]([^'"]+)['"][\s\S]*?borderWidth:\s*(\d+)/,
    );
    if (summaryContainerMatch) {
      const backgroundColor = summaryContainerMatch[1];
      const borderRadius = summaryContainerMatch[2];
      const borderColor = summaryContainerMatch[3];
      const borderWidth = summaryContainerMatch[4];

      if (
        backgroundColor === '#f8f9fa' &&
        borderRadius === '12' &&
        borderColor === '#e0e0e0' &&
        borderWidth === '1'
      ) {
        console.log(`✅ Summary container styling correct`);
      } else {
        console.log(
          `❌ Summary container styling incorrect: backgroundColor=${backgroundColor}, borderRadius=${borderRadius}, borderColor=${borderColor}, borderWidth=${borderWidth}`,
        );
        allConsistent = false;
      }
    } else {
      console.log(`❌ Summary container styling not found or malformed`);
      allConsistent = false;
    }

    console.log(`✅ ${filePath} complete Amount Details section verified\n`);
  } catch (error) {
    console.log(`❌ Error reading ${filePath}: ${error.message}`);
    allConsistent = false;
  }
});

if (allConsistent) {
  console.log(
    '🎉 All Amount Details sections are complete and consistent with the image!',
  );
} else {
  console.log('⚠️  Some Amount Details sections have inconsistent styling.');
}

console.log('\n📋 Complete Amount Details section includes:');
console.log(
  '• Card Title with currency icon: fontSize: scale(22), color: #333, fontFamily: Roboto-Medium, fontWeight: 600',
);
console.log('• Tax Amount & Discount Amount input fields with proper styling');
console.log('• Summary section with:');
console.log('  - Subtotal: with calculated value');
console.log('  - GST (18%): with calculated value');
console.log('  - Tax Amount: with input value');
console.log('  - Discount: with input value (negative)');
console.log('  - Total: with calculated total value');
console.log(
  '• All summary items: fontSize: 16, color: #333333, fontFamily: Roboto-Medium',
);
console.log(
  '• Summary container: backgroundColor: #f8f9fa, borderRadius: scale(12), borderColor: #e0e0e0',
);
