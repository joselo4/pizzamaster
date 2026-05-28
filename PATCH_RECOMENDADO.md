# Patch recomendado (quirúrgico)

- Distribución: se habilita `/distribution` para todos los programas (PANTBC usa PantbcDistribution, PCA/OLLAS usan PcaBatchDistribution).
- Colores por programa: Sidebar con gradientes distintivos.
- PANTBC: impresión de PECOSA/Entrega incluye datos del paciente si existen (DNI, teléfono, ubicación, centro de salud, oficio, dirección, UBIGEO).
- Centros: toggle 'Todos los programas' + badge de programa.

**No modifica BD.** Para que los campos extra existan en BD, ejecuta migraciones de pacientes (ver sql/migrations) y recarga schema cache.

Generado: 2026-02-19T01:36:44
