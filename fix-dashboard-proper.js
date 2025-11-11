const fs = require('fs');

const filePath = 'src/screens/HomeScreen/Dashboard.tsx';

console.log('🔧 Properly fixing Dashboard.tsx fontFamily properties...');

let content = fs.readFileSync(filePath, 'utf8');

// Add fontFamily to style objects that don't have it
const styleObjectPattern = /(\w+):\s*\{\s*([^}]+)\s*\}/g;
content = content.replace(styleObjectPattern, (match, styleName, styleContent) => {
  // Skip if it's not a text-related style or already has fontFamily
  if (!styleContent.includes('fontSize') || styleContent.includes('fontFamily')) {
    return match;
  }

  // Determine the appropriate fontFamily based on fontWeight
  let fontFamily = 'Roboto-Regular';
  if (styleContent.includes('fontWeight') && styleContent.includes('bold')) {
    fontFamily = 'Roboto-Bold';
  } else if (styleContent.includes('fontWeight') && (styleContent.includes('600') || styleContent.includes('500'))) {
    fontFamily = 'Roboto-Medium';
  }

  // Add fontFamily as the last property
  return match.replace(styleContent, styleContent + `,\n    fontFamily: '${fontFamily}',`);
});

// Add fontFamily to inline Text styles
const inlineTextPattern = /<Text\s+style=\{\{\s*([^}]+)\s*\}\}/g;
content = content.replace(inlineTextPattern, (match, styleContent) => {
  // Check if fontFamily is already present
  if (styleContent.includes('fontFamily')) {
    return match;
  }

  // Determine the appropriate fontFamily based on fontWeight
  let fontFamily = 'Roboto-Regular';
  if (styleContent.includes('fontWeight') && styleContent.includes('bold')) {
    fontFamily = 'Roboto-Bold';
  } else if (styleContent.includes('fontWeight') && (styleContent.includes('600') || styleContent.includes('500'))) {
    fontFamily = 'Roboto-Medium';
  }

  // Add fontFamily
  return match.replace(styleContent, styleContent + `, fontFamily: '${fontFamily}'`);
});

fs.writeFileSync(filePath, content);
console.log('✅ Dashboard.tsx fontFamily properties added properly!');

