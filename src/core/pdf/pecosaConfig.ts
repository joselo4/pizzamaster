export type PecosaFontFamily = 'courier' | 'helvetica' | 'times';

export type PecosaStyle = {
  fontFamily: PecosaFontFamily;
  fontSize: number;
  headerBold: boolean;
  titleBold: boolean;
  lineWidth: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type PecosaLayout = {
  page: { format: 'a4'; unit: 'mm'; margin: { top: number; left: number } };
  boxes: {
    header: Rect;
    beneficiary: Rect;
    tableStartY: number;
    signYGap: number;
  };
};

export const DEFAULT_PECOSA_STYLE: PecosaStyle = {
  fontFamily: 'courier',
  fontSize: 10,
  headerBold: true,
  titleBold: true,
  lineWidth: 0.35,
};

export const DEFAULT_PECOSA_LAYOUT: PecosaLayout = {
  page: { format: 'a4', unit: 'mm', margin: { top: 12, left: 14 } },
  boxes: {
    header: { x: 14, y: 28, w: 182, h: 25 },
    beneficiary: { x: 14, y: 55, w: 182, h: 30 },
    tableStartY: 90,
    signYGap: 40,
  },
};

export function safeJsonParse<T>(v: any): T | null {
  if (!v) return null;
  try {
    if (typeof v === 'string') return JSON.parse(v) as T;
    return v as T;
  } catch {
    return null;
  }
}

export function mergeShallow<T extends Record<string, any>>(base: T, incoming: any): T {
  if (!incoming || typeof incoming !== 'object') return base;
  return { ...base, ...incoming } as T;
}

export function mergeLayout(base: PecosaLayout, incoming: any): PecosaLayout {
  if (!incoming || typeof incoming !== 'object') return base;
  return {
    page: {
      ...base.page,
      ...(incoming.page ?? {}),
      margin: { ...base.page.margin, ...(incoming.page?.margin ?? {}) },
    },
    boxes: {
      ...base.boxes,
      ...(incoming.boxes ?? {}),
    },
  };
}
