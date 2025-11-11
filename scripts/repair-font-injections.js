// Repairs malformed inline style objects after fontFamily injections
// Example broken: "flex: 2 fontFamily: 'Roboto-Regular'" → missing comma
// Also fixes trailing commas before closing braces if obviously wrong

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'android' ||
        entry.name === '.git'
      )
        continue;
      walk(full, out);
    } else if (/[.](tsx|ts|jsx|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function repairContent(text) {
  let fixed = text;

  // Insert missing comma before fontFamily if previous pair is not comma-terminated
  // e.g., "flex: 2 fontFamily: 'Roboto-Regular'" → "flex: 2, fontFamily: 'Roboto-Regular'"
  fixed = fixed.replace(
    /(\b[\w$]+\s*:\s*[^,{}]+)\s+(fontFamily\s*:)/g,
    '$1, $2',
  );

  // Ensure comma between consecutive properties inside inline style object braces
  // e.g., color: '#666' fontFamily: 'Roboto-Regular' → color: '#666', fontFamily: ...
  fixed = fixed.replace(
    /(\b[\w$]+\s*:\s*['"][^'"]+['"])\s+(fontFamily\s*:)/g,
    '$1, $2',
  );

  // Remove duplicate commas like ",, fontFamily"
  fixed = fixed.replace(/,,\s+(fontFamily\s*:)/g, ', $1');

  // Remove stray comma-only lines between properties, e.g.
  // fontWeight: '500',\n,\n fontFamily: 'Roboto-Regular' -> fontWeight: '500',\n fontFamily: 'Roboto-Regular'
  fixed = fixed.replace(/\n\s*,\s*\n(\s*[A-Za-z_$][\w$]*\s*:)/g, '\n$1');

  // Collapse ",\n" to a single comma
  fixed = fixed.replace(/,\s*\n\s*,/g, ',\n');

  return fixed;
}

const files = walk(SRC);
let changed = 0;
for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  const after = repairContent(before);
  if (after !== before) {
    fs.writeFileSync(f, after);
    changed++;
  }
}

console.log(`Repaired files: ${changed}`);
