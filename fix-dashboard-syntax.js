const fs = require('fs');

const filePath = 'src/screens/HomeScreen/Dashboard.tsx';

console.log('🔧 Fixing Dashboard.tsx syntax errors...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix the trailing comma issue
content = content.replace(
  /,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  ",\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix any other trailing comma issues
content = content.replace(
  /,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  ",\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix specific patterns that are broken
content = content.replace(
  /marginLeft: 12,\s*\n\s*,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginLeft: 12,\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix other broken patterns
content = content.replace(
  /fontSize: 16, color: '#222', paddingVertical: 4\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 16, color: '#222', paddingVertical: 4,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix more patterns
content = content.replace(
  /fontSize: 13, color: '#fff', opacity: 0.9, marginBottom: 2\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 13, color: '#fff', opacity: 0.9, marginBottom: 2,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix welcomeMessage pattern
content = content.replace(
  /marginTop: 2,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginTop: 2,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix profileButtonText pattern
content = content.replace(
  /color: '#fff', fontSize: 12, fontWeight: '600'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 12, fontWeight: '600',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix statLabel pattern
content = content.replace(
  /fontSize: 14, color: '#666', marginBottom: 8\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginBottom: 8,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix statValue pattern
content = content.replace(
  /fontSize: 24, color: '#0F9D58'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 24, color: '#0F9D58',\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix sectionTitle pattern
content = content.replace(
  /marginBottom: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 4,\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix sectionSubtitle pattern
content = content.replace(
  /fontSize: 14, color: '#666', marginBottom: 16\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginBottom: 16,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix legendLabel pattern
content = content.replace(
  /fontSize: 14, color: '#666', marginRight: 4\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#666', marginRight: 4,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix legendValue pattern
content = content.replace(
  /fontSize: 14, color: '#222'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222',\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix actionText pattern
content = content.replace(
  /fontSize: 14, color: '#222', marginTop: 8, fontWeight: '500'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222', marginTop: 8, fontWeight: '500',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix transactionTypeText pattern
content = content.replace(
  /color: '#fff', fontSize: 12, fontWeight: '500'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 12, fontWeight: '500',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix transactionParty pattern
content = content.replace(
  /marginBottom: 2,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 2,\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix transactionDate pattern
content = content.replace(
  /fontSize: 12, color: '#666'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 12, color: '#666',\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix transactionAmount pattern
content = content.replace(
  /marginBottom: 4,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 4,\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix statusText pattern
content = content.replace(
  /fontSize: 12, fontWeight: '500', color: '#fff'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 12, fontWeight: '500', color: '#fff',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix tabText pattern
content = content.replace(
  /fontSize: 14, color: '#222', fontWeight: '500', marginLeft: 8\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "fontSize: 14, color: '#222', fontWeight: '500', marginLeft: 8,\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix folderName pattern
content = content.replace(
  /textAlign: 'center',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "textAlign: 'center',\n    fontFamily: 'Roboto-Medium',\n  }",
);

// Fix emptyTransactionsTitle pattern
content = content.replace(
  /textAlign: 'center',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "textAlign: 'center',\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix emptyTransactionsSubtitle pattern
content = content.replace(
  /lineHeight: 20,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "lineHeight: 20,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix errorTitle pattern
content = content.replace(
  /marginBottom: 10,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "marginBottom: 10,\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix errorMessage pattern
content = content.replace(
  /lineHeight: 22,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "lineHeight: 22,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix retryButtonText pattern
content = content.replace(
  /color: '#fff', fontSize: 16, \s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 16,\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix noResultsTitle pattern
content = content.replace(
  /textAlign: 'center',\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "textAlign: 'center',\n    fontFamily: 'Roboto-Bold',\n  }",
);

// Fix noResultsMessage pattern
content = content.replace(
  /lineHeight: 22,\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "lineHeight: 22,\n    fontFamily: 'Roboto-Regular',\n  }",
);

// Fix debugButtonText pattern
content = content.replace(
  /color: '#fff', fontSize: 14, fontWeight: '600'\s*\n\s*fontFamily:\s*'[^']+',\s*\}/g,
  "color: '#fff', fontSize: 14, fontWeight: '600',\n    fontFamily: 'Roboto-Medium',\n  }",
);

fs.writeFileSync(filePath, content);
console.log('✅ Dashboard.tsx syntax errors fixed!');
