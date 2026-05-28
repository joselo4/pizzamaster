# PATCH: Limpieza de advertencias TypeScript TS6133 en CustomerOrder

Se limpiaron advertencias de variables/imports declarados pero no usados en `src/pages/CustomerOrder.tsx`, sin alterar el flujo funcional del pedido.

Cambios:

- Se retiró `UserCog` del import de `lucide-react` porque no se usa en la pantalla.
- Se retiró el import `toTrackCode` porque no se usa en el componente.
- Se eliminaron las variables locales `onFocus` y `onVis` que estaban declaradas dentro de efectos, pero no tenían uso.
- Se conservó `serviceType` con valor inicial `Delivery`, pero se retiró el setter `setServiceType` porque no se usa actualmente.

No se cambió la lógica de carrito, promociones, delivery, tracking, confirmación ni diseño.
