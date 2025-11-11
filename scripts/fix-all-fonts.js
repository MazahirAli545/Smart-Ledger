/*
  Fix fonts across all screens/components by:
  1) Adding fontFamily to inline <Text style={{ ... }}> when missing
  2) Adding fontFamily to <Text ...> with no style prop at all
  3) Adding fontFamily to StyleSheet style objects that look like text styles
     (fontSize, fontWeight, color, lineHeight, letterSpacing, textAlign) when missing
  4) Prefer Roboto-Bold if style hints bold; Roboto-Medium for 500/600; else Roboto-Regular

  Produces a FONT_FIX_REPORT.md with the list of changed files and counts.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const REPORT_PATH = path.join(ROOT, 'FONT_FIX_REPORT.md');

const FILE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

function listFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name === 'android' ||
          e.name === '.git'
        )
          continue;
        stack.push(full);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        if (FILE_EXTENSIONS.has(ext)) out.push(full);
      }
    }
  }
  return out;
}

function pickFont(style) {
  const s = style.toLowerCase();
  if (s.includes('fontweight') && s.includes('bold')) return 'Roboto-Bold';
  if (s.includes('fontweight') && (s.includes('600') || s.includes('500')))
    return 'Roboto-Medium';
  return 'Roboto-Regular';
}

function processFile(filePath) {
  let original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  let inlineChanges = 0;
  let styleChanges = 0;
  let bareTextChanges = 0;

  // Inline <Text style={{ ... }}> additions
  content = content.replace(
    /<Text(\s+[^>]*?)style=\{\{([\s\S]*?)\}\}([\s\S]*?)>/g,
    (match, before, styleBody, after) => {
      let body = styleBody;
      let changedLocal = false;
      if (!/fontFamily\s*:\s*['"][A-Za-z\-]+['"]/.test(body)) {
        const font = pickFont(body);
        changedLocal = true;
        body = body.trim().length
          ? body + `, fontFamily: '${font}'`
          : `fontFamily: '${font}'`;
      }
      // If Roboto is set, remove fontWeight/fontStyle to avoid Android conflicts
      if (/fontFamily\s*:\s*['"]Roboto-[A-Za-z]+['"]/.test(body)) {
        const beforeLen = body.length;
        body = body
          .replace(/,?\s*fontWeight\s*:\s*['"]?[\w\-]+['"]?/g, '')
          .replace(/,?\s*fontStyle\s*:\s*['"]?[\w\-]+['"]?/g, '');
        if (body.length !== beforeLen) changedLocal = true;
      }
      if (changedLocal) inlineChanges++;
      return `<Text${before}style={{${body}}}${after}>`;
    },
  );

  // <Text ...> with no style attr at all -> add style with Roboto-Regular
  content = content.replace(
    /<Text((?:\s+(?!style=)[^>])+?)>(?!\s*\{?\s*\})/g,
    (match, attrs) => {
      // Skip if font already hinted via className or similar (RN doesn't use it but just in case)
      if (/fontFamily/.test(match)) return match;
      bareTextChanges++;
      return `<Text${attrs} style={{ fontFamily: 'Roboto-Regular' }}>`;
    },
  );

  // Style object entries inside StyleSheet.create({ ... })
  content = content.replace(
    /StyleSheet\.create\\?\(\s*\{([\s\S]*?)\}\s*\)/g,
    (mWhole, inner) => {
      const replaced = inner.replace(
        /(\w+)\s*:\s*\{([\s\S]*?)\}/g,
        (m, name, body) => {
          const looksLikeText =
            /fontSize\s*:\s*\d+/.test(body) ||
            /fontWeight\s*:\s*['"]?\w+['"]?/.test(body) ||
            /color\s*:\s*['"][^'"]+['"]/.test(body) ||
            /lineHeight\s*:\s*\d+/.test(body) ||
            /letterSpacing\s*:\s*\d+/.test(body) ||
            /textAlign\s*:\s*['"]?\w+['"]?/.test(body);
          if (!looksLikeText) return m;
          let newBody = body;
          let changedLocal = false;
          if (!/fontFamily\s*:\s*['"][A-Za-z\-]+['"]/.test(newBody)) {
            const font = pickFont(newBody);
            const tail = newBody.trim().endsWith(',') ? '' : ',';
            newBody = `${newBody}${tail}\n    fontFamily: '${font}',\n  `;
            changedLocal = true;
          }
          // If Roboto family is present, strip fontWeight/fontStyle
          if (/fontFamily\s*:\s*['"]Roboto-[A-Za-z]+['"]/.test(newBody)) {
            const beforeLen = newBody.length;
            newBody = newBody
              .replace(/,?\s*fontWeight\s*:\s*['"]?[\w\-]+['"]?/g, '')
              .replace(/,?\s*fontStyle\s*:\s*['"]?[\w\-]+['"]?/g, '');
            if (newBody.length !== beforeLen) changedLocal = true;
          }
          if (changedLocal) styleChanges++;
          return `${name}: {${newBody}}`;
        },
      );
      return `StyleSheet.create({${replaced}})`;
    },
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
  }

  return {
    inlineChanges,
    styleChanges,
    bareTextChanges,
    changed: content !== original,
  };
}

function main() {
  const files = listFiles(SRC_DIR);
  const report = [];
  let totalFiles = 0;
  let changedFiles = 0;
  let totalInline = 0;
  let totalStyle = 0;
  let totalBare = 0;

  for (const f of files) {
    totalFiles++;
    try {
      const res = processFile(f);
      if (res.changed) {
        changedFiles++;
        totalInline += res.inlineChanges;
        totalStyle += res.styleChanges;
        totalBare += res.bareTextChanges;
        report.push(
          `- ${path.relative(ROOT, f)} (inline: ${res.inlineChanges}, styles: ${
            res.styleChanges
          }, bare: ${res.bareTextChanges})`,
        );
      }
    } catch (e) {
      report.push(`- ${path.relative(ROOT, f)} (ERROR: ${String(e)})`);
    }
  }

  const md = [
    '# Font Fix Report',
    '',
    `Scanned files: ${totalFiles}`,
    `Changed files: ${changedFiles}`,
    `Inline fixes: ${totalInline}`,
    `Style fixes: ${totalStyle}`,
    `Bare <Text> fixes: ${totalBare}`,
    '',
    '## Files changed',
    ...report,
    '',
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, md);
  console.log('✅ Font fix complete');
  console.log(
    `Scanned: ${totalFiles}, Changed: ${changedFiles}, Inline: ${totalInline}, Styles: ${totalStyle}`,
  );
  console.log(`Report written to: ${REPORT_PATH}`);
}

main();
