// Envío de SMS desde una app web (Android/iOS): abre el compositor de SMS del dispositivo.
// Nota: un navegador NO puede enviar SMS automáticamente; esto solo pre-rellena y el usuario toca "Enviar".

export function openSmsComposer(to: string, body: string) {
  if (!to) return;
  const clean = to.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');
  const encodedBody = encodeURIComponent(body ?? '');
  const url = `smsto:${clean}?body=${encodedBody}`;

  try {
    window.location.href = url;
  } catch {
    try {
      window.open(url, '_blank');
    } catch {
      navigator.clipboard?.writeText(body ?? '');
      alert('No se pudo abrir el SMS. Copié el mensaje al portapapeles.');
    }
  }
}
