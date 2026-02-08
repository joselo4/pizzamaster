# Cambios (quirúrgicos)

## 1) /promo
- Ruta pública: /promo
- Para campaña QR: /promo?ref=carlos

## 2) Admin -> pestaña "promo"
- Permite editar textos, precio, detalle, CTA, teléfono/WhatsApp.

## 3) Título/Favicon sin login
- Ahora se carga al entrar a /pedido, /promo, /track, etc.

### Supabase (obligatorio)
Ejecuta en SQL Editor:
- supabase_sql/10_promo_public_read_policy.sql
- supabase_sql/11_identity_public_read_policy.sql

> Si ya tienes policies equivalentes, estos scripts solo agregan policies específicas (no rompen las existentes).
