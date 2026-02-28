REV19 – Libro PECOSAS: Reimprimir PECOSA (PDF) desde BD + rótulo ANULADA + Áreas exclusivas en Configuración

1) Reportes → Libro PECOSAS (MVP)
   - Botón "Reimprimir" por registro: reconstruye la PECOSA usando movimientos OUT (mismos datos iniciales).
   - Si status = ANULADA: agrega rótulo "*** ANULADA ***" en PDF y en el nombre de archivo.
   - Incluye firmas configuradas en app_settings (Firmas y Responsables PECOSA).

2) Configuración
   - Firmas y Responsables (PECOSA) queda como área exclusiva (full width).
   - Configuración Nutricional (RationManager/KitManager) como área exclusiva.

Requisitos:
- Tablas: movements, products, centers/patients, app_settings.

Build:
  npm install
  npm run dev
  npm run dev:electron
