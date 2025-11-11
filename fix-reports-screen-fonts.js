const fs = require('fs');

const filePath = 'src/screens/ReportsScreen.tsx';

console.log('🔧 Fixing ReportsScreen.tsx fontFamily properties...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix inline Text styles
const inlineTextPattern = /<Text\s+style=\{\{\s*([^}]+)\s*\}\}/g;
content = content.replace(inlineTextPattern, (match, styleContent) => {
  // Check if fontFamily is already present
  if (styleContent.includes('fontFamily')) {
    return match;
  }

  // Add fontFamily based on fontWeight
  if (styleContent.includes('fontWeight') && styleContent.includes('bold')) {
    return match.replace(
      styleContent,
      styleContent + ", fontFamily: 'Roboto-Bold'",
    );
  } else if (
    styleContent.includes('fontWeight') &&
    (styleContent.includes('600') || styleContent.includes('500'))
  ) {
    return match.replace(
      styleContent,
      styleContent + ", fontFamily: 'Roboto-Medium'",
    );
  } else {
    return match.replace(
      styleContent,
      styleContent + ", fontFamily: 'Roboto-Regular'",
    );
  }
});

// Fix style object definitions
const styleObjectPattern = /(\w+):\s*\{\s*([^}]+)\s*\}/g;
content = content.replace(
  styleObjectPattern,
  (match, styleName, styleContent) => {
    // Skip if it's not a text-related style or already has fontFamily
    if (
      !styleContent.includes('fontSize') ||
      styleContent.includes('fontFamily')
    ) {
      return match;
    }

    // Add fontFamily based on fontWeight
    if (styleContent.includes('fontWeight') && styleContent.includes('bold')) {
      return match.replace(
        styleContent,
        styleContent + ",\n    fontFamily: 'Roboto-Bold',",
      );
    } else if (
      styleContent.includes('fontWeight') &&
      (styleContent.includes('600') || styleContent.includes('500'))
    ) {
      return match.replace(
        styleContent,
        styleContent + ",\n    fontFamily: 'Roboto-Medium',",
      );
    } else {
      return match.replace(
        styleContent,
        styleContent + ",\n    fontFamily: 'Roboto-Regular',",
      );
    }
  },
);

fs.writeFileSync(filePath, content);
console.log('✅ ReportsScreen.tsx fontFamily properties fixed!');
