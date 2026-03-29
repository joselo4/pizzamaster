import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const suspicious = [];
const patterns = [
  { label: 'Supabase placeholder URL', regex: /your-project\.supabase\.co/gi },
  { label: 'Supabase placeholder key', regex: /ey\.\.\.REPLACE_ME/g },
  { label: 'Sentry DSN expuesto', regex: /VITE_SENTRY_DSN\s*=\s*https:\/\//g },
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(env|txt|md|json|ts|tsx|js|jsx|yml|yaml)$/i.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const pattern of patterns) {
        if (pattern.regex.test(content)) suspicious.push({ file: path.relative(root, full), label: pattern.label });
      }
    }
  }
}

walk(root);

if (suspicious.length === 0) {
  console.log('✅ Preflight limpio: no se detectaron placeholders ni secretos evidentes.');
  process.exit(0);
}

console.error('⚠️ Hallazgos de preflight:');
for (const item of suspicious) {
  console.error(`- ${item.file}: ${item.label}`);
}
process.exit(1);
