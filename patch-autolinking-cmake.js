const fs = require('fs');
const path = require('path');

const cmakePath = path.join(
  __dirname,
  'android',
  'app',
  'build',
  'generated',
  'autolinking',
  'src',
  'main',
  'jni',
  'Android-autolinking.cmake',
);

if (!fs.existsSync(cmakePath)) {
  console.error('CMake file not found:', cmakePath);
  process.exit(1);
}

let content = fs.readFileSync(cmakePath, 'utf8');

// Patch all add_subdirectory lines to be conditional on CMakeLists.txt
content = content.replace(
  /add_subdirectory\(("[^"]+\/jni\/?")([^)]+)?\)/g,
  (match, dir, rest) => {
    const cmakeListsPath = dir.replace(/"$/, 'CMakeLists.txt"');
    return `if(EXISTS ${cmakeListsPath})\n  ${match}\nendif()`;
  },
);

fs.writeFileSync(cmakePath, content, 'utf8');
console.log('Patched', cmakePath);
