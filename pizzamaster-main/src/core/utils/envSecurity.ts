export function findRiskyConfigValues(config: Record<string, unknown>) {
  const warnings: string[] = [];
  const anonKey = config['VITE_SUPABASE_KEY'] || config['VITE_SUPABASE_ANON_KEY'];
  if (typeof anonKey === 'string' && anonKey.startsWith('eyJ')) {
    warnings.push('Verifica que la anon key sea la real de tu proyecto y no un placeholder.');
  }
  const dsn = config['VITE_SENTRY_DSN'];
  if (typeof dsn === 'string' && dsn.trim()) {
    warnings.push('Revisa rotación/control del DSN de observabilidad si el repositorio fue compartido.');
  }
  return warnings;
}
