import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(walk(full));
    } else if (item.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
}

const allClasses = new Map();
for (const file of walk('src')) {
  const content = fs.readFileSync(file, 'utf8');
  // Match className attribute
  const regex = /className=(?:\"([^\"]+)\"|'([^']+)'|{`([^`]+)`})/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1] || match[2] || match[3] || '';
    const clean = raw.replace(/\$\{[^}]*\}/g, ' ');
    for (const part of clean.split(/\s+/)) {
      const cls = part.trim();
      // Skip template fragments / dynamic prefixes (e.g. `toast-${x}` -> `toast-`,
      // `bi-caret-${...}-fill` -> `-fill`): not real class names.
      if (!cls || cls.startsWith('bi-') || cls === 'bi') continue;
      if (cls.endsWith('-') || cls.startsWith('-')) continue;
      if (!allClasses.has(cls)) allClasses.set(cls, []);
      allClasses.get(cls).push(path.basename(file));
    }
  }
}

const css = fs.readFileSync('src/styles/global.css', 'utf8') + '\n' + fs.readFileSync('src/styles/compat.css', 'utf8');
const missing = [];
const found = [];

for (const [cls, files] of allClasses.entries()) {
  const pattern = new RegExp('\\.' + cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![\\w-])');
  if (pattern.test(css)) {
    found.push(cls);
  } else {
    missing.push({ cls, files: Array.from(new Set(files)) });
  }
}

console.log(`TOTAL CLASSES: ${allClasses.size} | FOUND: ${found.length} | MISSING: ${missing.length}`);
console.log('--- MISSING LIST ---');
missing.sort((a,b) => a.cls.localeCompare(b.cls)).forEach(item => {
  console.log(`.${item.cls} => [${item.files.join(', ')}]`);
});
