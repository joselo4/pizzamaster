import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checklist = [
  ['package.json', fs.existsSync(path.join(root, 'package.json'))],
  ['src/App.tsx', fs.existsSync(path.join(root, 'src', 'App.tsx'))],
  ['supabase_sql', fs.existsSync(path.join(root, 'supabase_sql'))],
  ['.env.local.example', fs.existsSync(path.join(root, '.env.local.example'))],
];

console.log('Bootstrap quirúrgico — verificación rápida');
for (const [name, ok] of checklist) {
  console.log(`${ok ? '✅' : '⚠️ '} ${name}`);
}
console.log('\nSiguientes pasos sugeridos:');
console.log('1) Copia .env.local.example a .env.local');
console.log('2) Completa VITE_SUPABASE_URL y tu anon key real');
console.log('3) Ejecuta npm install');
console.log('4) Ejecuta npm run preflight:security');
console.log('5) Si usarás mantenimiento en Supabase, revisa supabase_sql/90_maintenance_tasks.sql');
