import { supabase } from './supabase';

/**
 * Compresión a WebP en cliente para reducir egress.
 * - maxW: ancho máximo en px
 * - quality: 0..1
 */
export async function compressToWebP(file: File, maxW: number, quality = 0.78): Promise<Blob> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  img.src = url;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
  });

  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('No se pudo comprimir a WebP'));
      resolve(b);
    }, 'image/webp', quality);
  });

  URL.revokeObjectURL(url);
  return blob;
}

/**
 * Sube dos versiones a Supabase Storage para cuidar egress.
 * Bucket por defecto: "pizza-data" (PUBLIC).
 * - thumb: <=480px (lista)
 * - hero:  <=1280px (detalle)
 */
export async function uploadPromoImages(
  file: File,
  slug: string,
  opts?: { bucket?: string; baseDir?: string }
): Promise<{ thumb_url: string; image_url: string }> {
  const bucket = opts?.bucket ?? 'pizza-data';
  const baseDir = (opts?.baseDir ?? 'promos').replace(/\/+$/g, '');

  const thumb = await compressToWebP(file, 480, 0.70);
  const hero  = await compressToWebP(file, 1280, 0.78);

  const ts = Date.now();
  const safeSlug = (slug || 'promo')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const thumbPath = `${baseDir}/thumb/${safeSlug}-${ts}.webp`;
  const heroPath  = `${baseDir}/hero/${safeSlug}-${ts}.webp`;

  const up1 = await supabase.storage.from(bucket).upload(thumbPath, thumb, { upsert: true, contentType: 'image/webp' });
  if (up1.error) throw up1.error;

  const up2 = await supabase.storage.from(bucket).upload(heroPath, hero, { upsert: true, contentType: 'image/webp' });
  if (up2.error) throw up2.error;

  const { data: u1 } = supabase.storage.from(bucket).getPublicUrl(thumbPath);
  const { data: u2 } = supabase.storage.from(bucket).getPublicUrl(heroPath);

  return { thumb_url: u1.publicUrl, image_url: u2.publicUrl };
}
