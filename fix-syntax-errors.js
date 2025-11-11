const fs = require('fs');

const files = [
  'src/screens/HomeScreen/Dashboard.tsx',
  'src/screens/HomeScreen/CustomerScreen.tsx',
  'src/screens/HomeScreen/CustomerDetailScreen.tsx',
  'src/screens/HomeScreen/InvoiceScreen_clean.tsx',
];

console.log('🔧 Fixing syntax errors in style objects...');

files.forEach(filePath => {
  console.log(`Fixing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the broken fontFamily syntax
  // Pattern: },\n    fontFamily: 'Roboto-XXX',}
  content = content.replace(
    /,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
    ",\n    fontFamily: 'Roboto-Regular',\n  }",
  );

  // Fix any remaining broken patterns
  content = content.replace(
    /,\s*fontFamily:\s*'[^']+',\s*\}/g,
    ",\n    fontFamily: 'Roboto-Regular',\n  }",
  );

  // Fix patterns where fontFamily is added incorrectly
  content = content.replace(
    /(\w+):\s*\{\s*([^}]+)\s*,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
    (match, styleName, styleContent) => {
      return `${styleName}: {\n    ${styleContent},\n    fontFamily: 'Roboto-Regular',\n  }`;
    },
  );

  fs.writeFileSync(filePath, content);
  console.log(`✅ ${filePath} syntax fixed!`);
});

console.log('✅ All syntax errors fixed!');
