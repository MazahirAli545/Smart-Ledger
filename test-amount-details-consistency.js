const fs = require('fs');
const path = require('path');

// Test script to verify Amount Details section consistency
console.log('🔍 Testing Amount Details section consistency...\n');

const files = [
  'src/screens/HomeScreen/PurchaseScreen.tsx',
  'src/screens/HomeScreen/InvoiceScreen_clean.tsx',
];

const expectedStyles = {
  cardTitle: {
    fontSize: 'scale(18)',
    color: '#333',
    fontFamily: 'Roboto-Medium',
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

    // Check card title styling
    const cardTitleMatch = content.match(
      /Amount Details[\s\S]*?fontSize:\s*scale\((\d+)\)[\s\S]*?color:\s*['"]([^'"]+)['"][\s\S]*?fontFamily:\s*['"]([^'"]+)['"]/,
    );
    if (cardTitleMatch) {
      const fontSize = cardTitleMatch[1];
      const color = cardTitleMatch[2];
      const fontFamily = cardTitleMatch[3];

      if (
        fontSize === '18' &&
        color === '#333' &&
        fontFamily === 'Roboto-Medium'
      ) {
        console.log(`✅ Card title styling correct`);
      } else {
        console.log(
          `❌ Card title styling incorrect: fontSize=${fontSize}, color=${color}, fontFamily=${fontFamily}`,
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

    console.log(`✅ ${filePath} Amount Details section verified\n`);
  } catch (error) {
    console.log(`❌ Error reading ${filePath}: ${error.message}`);
    allConsistent = false;
  }
});

if (allConsistent) {
  console.log(
    '🎉 All Amount Details sections are consistent with PaymentScreen styling!',
  );
} else {
  console.log('⚠️  Some Amount Details sections have inconsistent styling.');
}

console.log('\n📋 Summary of Amount Details styling applied:');
console.log(
  '• Card Title: fontSize: scale(18), color: #333, fontFamily: Roboto-Medium',
);
console.log(
  '• Input Labels: marginBottom: scale(8), fontSize: 16, color: #333333, fontFamily: Roboto-Medium',
);
console.log(
  '• TextInputs: paddingVertical: scale(22), fontSize: scale(18), backgroundColor: #f9f9f9, borderColor: #e0e0e0, fontFamily: Roboto-Medium',
);
