export type ValidationError = string;

export function isBlank(v: any) {
  return v === undefined || v === null || String(v).trim().length === 0;
}

export function reqText(value: any, label: string, minLen = 1): ValidationError | null {
  const s = String(value ?? '').trim();
  if (s.length < minLen) return `Falta: ${label}`;
  return null;
}

export function reqNumberMin(value: any, label: string, min = 1): ValidationError | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return `Falta/Inválido: ${label} (mínimo ${min})`;
  return null;
}

export function reqEitherText(a: any, b: any, label: string): ValidationError | null {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa && !sb) return `Falta: ${label}`;
  return null;
}

export function reqDni(value: any, label = 'DNI'): ValidationError | null {
  const s = String(value ?? '').trim();
  if (!/^\d{8}$/.test(s)) return `Falta/Inválido: ${label} (8 dígitos)`;
  return null;
}

export function formatErrors(errors: string[]) {
  // Toast es mejor con un mensaje corto; devolvemos la primera y el total.
  if (!errors.length) return '';
  if (errors.length === 1) return errors[0];
  return `${errors[0]} (+${errors.length - 1} más)`;
}
