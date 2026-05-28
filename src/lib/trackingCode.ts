// trackingCode.ts
// Utilidades para identificar pedidos/solicitudes.
// - Código corto: base36 (mayúsculas) del ID numérico.
// - Solicitud (ID): el ID numérico original (string).

export function toTrackCode(id: number | string | null | undefined): string {
  const n = Number(id);
  if (!Number.isFinite(n)) return '';
  return Math.max(0, n).toString(36).toUpperCase();
}

export function toSolicitudId(id: number | string | null | undefined): string {
  const n = Number(id);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(0, n));
}

export function fromTrackCode(code: string | null | undefined): number | null {
  const c = String(code || '').trim();
  if (!c) return null;
  if (/^\d+$/.test(c)) return Number(c);
  if (/^[0-9a-zA-Z]+$/.test(c)) {
    const n = parseInt(c.toLowerCase(), 36);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isUuid(v: string | null | undefined): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(v || '').trim());
}

export function canonicalOrderIdFromRequest(req: any): number | null {
  const mapped = req?.mapped_order_id;
  if (mapped !== null && mapped !== undefined && mapped !== '') {
    const n = Number(mapped);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(req?.id);
  return Number.isFinite(n) ? n : null;
}

export function officialSolicitudIdFromRequest(req: any): string {
  const can = canonicalOrderIdFromRequest(req);
  return toSolicitudId(can);
}

export function officialShortCodeFromId(id: number | string | null | undefined): string {
  return toTrackCode(id);
}
