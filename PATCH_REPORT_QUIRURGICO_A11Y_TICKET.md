# Patch quirúrgico: A11y + Ticket (Redes/WiFi)

Cambios aplicados (archivos tocados):

- pizzamaster-main/src/lib/ticket.ts
- pizzamaster-main/src/pages/CashierOrderEditor.tsx
- pizzamaster-main/src/pages/admin.tsx
- src/lib/ticket.ts
- src/pages/admin.tsx

Notas:
- Se agregaron atributos id/name y asociaciones label->input donde fue seguro.
- Se agregó bloque condicional en generador de ticket para imprimir Redes Sociales y WiFi si hay valores.


## Corrección 2026-03-09
- Se eliminó el bloque inyectado que referenciaba `ticketCfg/cfg/x` inexistentes en `src/lib/ticket.ts` (causaba error de compilación).
- El ticket ya imprimía WiFi/Redes a partir de `settings` (facebook/instagram/tiktok/website/wifi_pass/extra_socials).
