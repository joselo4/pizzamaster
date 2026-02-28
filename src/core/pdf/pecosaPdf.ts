import jsPDF from 'jspdf';
import {
  DEFAULT_PECOSA_STYLE,
  DEFAULT_PECOSA_LAYOUT,
  PecosaStyle,
  PecosaLayout,
  safeJsonParse,
  mergeShallow,
  mergeLayout,
} from './pecosaConfig';

export type PecosaConfigResolved = {
  style: PecosaStyle;
  layout: PecosaLayout;
  source: { styleKey: string; layoutKey: string };
};

// Keys en app_settings
// Global: pecosa_style_global, pecosa_layout_global
// Override por programa fino: pecosa_style_<PROGRAM>, pecosa_layout_<PROGRAM>

export function resolvePecosaConfig(map: Record<string, any> | null | undefined, programId: string): PecosaConfigResolved {
  const m = map ?? {};
  const styleKey = `pecosa_style_${programId}`;
  const layoutKey = `pecosa_layout_${programId}`;

  const globalStyle = safeJsonParse<any>(m['pecosa_style_global']);
  const globalLayout = safeJsonParse<any>(m['pecosa_layout_global']);

  const overrideStyle = safeJsonParse<any>(m[styleKey]);
  const overrideLayout = safeJsonParse<any>(m[layoutKey]);

  const style = mergeShallow(DEFAULT_PECOSA_STYLE, globalStyle);
  const style2 = mergeShallow(style, overrideStyle);

  const layout = mergeLayout(DEFAULT_PECOSA_LAYOUT, globalLayout);
  const layout2 = mergeLayout(layout, overrideLayout);

  const fontFamily = (style2.fontFamily || 'courier');
  const normalized: PecosaStyle = {
    fontFamily: (['courier','helvetica','times'].includes(fontFamily) ? fontFamily : 'courier') as any,
    fontSize: Number(style2.fontSize) || DEFAULT_PECOSA_STYLE.fontSize,
    headerBold: Boolean(style2.headerBold),
    titleBold: Boolean(style2.titleBold),
    lineWidth: Number(style2.lineWidth) || DEFAULT_PECOSA_STYLE.lineWidth,
  };

  return { style: normalized, layout: layout2, source: { styleKey, layoutKey } };
}

export function applyPecosaStyle(doc: jsPDF, style: PecosaStyle) {
  doc.setFont(style.fontFamily, 'normal');
  doc.setFontSize(style.fontSize);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(style.lineWidth);
}

export function setBold(doc: jsPDF, bold: boolean) {
  doc.setFont(undefined as any, bold ? 'bold' : 'normal');
}
