const fs = require('fs');

const filePath = 'src/screens/HomeScreen/Dashboard.tsx';

console.log('🔧 Comprehensive fix for Dashboard.tsx...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix all trailing comma issues before fontFamily
content = content.replace(
  /,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  ",\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix specific broken patterns
content = content.replace(
  /marginBottom: 2,\s*\n\s*,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 2,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix patterns with multiple properties on one line
content = content.replace(
  /fontSize: 13, color: '#fff', opacity: 0.9, marginBottom: 2,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 13, color: '#fff', opacity: 0.9, marginBottom: 2,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix all other similar patterns
content = content.replace(
  /fontSize: 16, color: '#222', paddingVertical: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 16, color: '#222', paddingVertical: 4,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /marginTop: 2,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginTop: 2,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /color: '#fff', fontSize: 12, fontWeight: '600',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 12, fontWeight: '600',\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#666', marginBottom: 8,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginBottom: 8,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /fontSize: 24, color: '#0F9D58',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 24, color: '#0F9D58',\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /marginBottom: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 4,\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#666', marginBottom: 16,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginBottom: 16,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#666', marginRight: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginRight: 4,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#222',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222',\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#222', marginTop: 8, fontWeight: '500',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222', marginTop: 8, fontWeight: '500',\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /color: '#fff', fontSize: 12, fontWeight: '500',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 12, fontWeight: '500',\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /marginBottom: 2,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 2,\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /fontSize: 12, color: '#666',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 12, color: '#666',\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /marginBottom: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 4,\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /fontSize: 12, fontWeight: '500', color: '#fff',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 12, fontWeight: '500', color: '#fff',\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /fontSize: 14, color: '#222', fontWeight: '500', marginLeft: 8,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222', fontWeight: '500', marginLeft: 8,\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /textAlign: 'center',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "textAlign: 'center',\n    fontFamily: 'Roboto-Medium',\n  }",
);

content = content.replace(
  /textAlign: 'center',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "textAlign: 'center',\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /lineHeight: 20,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "lineHeight: 20,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /marginBottom: 10,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 10,\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /lineHeight: 22,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "lineHeight: 22,\n    fontFamily: 'Roboto-Regular',\n  }",
);

content = content.replace(
  /color: '#fff', fontSize: 16,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 16,\n    fontFamily: 'Roboto-Bold',\n  }",
);

content = content.replace(
  /color: '#fff', fontSize: 14, fontWeight: '600',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 14, fontWeight: '600',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix any remaining broken patterns
content = content.replace(
  /,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  ",\n    fontFamily: 'Roboto-Regular',\n  }",
);

fs.writeFileSync(filePath, content);
console.log('✅ Dashboard.tsx comprehensive fix applied!');
