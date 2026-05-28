
// src/lib/seo.ts
export function setSEO({ title, description, image }: { title?: string; description?: string; image?: string }) {
  try {
    if (title) document.title = title;
    if (description) setMeta('description', description);
    if (image) setOG('og:image', image);
  } catch {
    // ignore
  }
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOG(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
