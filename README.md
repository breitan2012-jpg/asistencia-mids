# Asistencia MIDS · actualización 6.4.0

Actualización de la estructura publicada 6.2.2. Registro público y cola offline conservados; administración con códigos verificados por servidor, alcance por ministerio, fechas de Costa Rica, ausencias autorizadas, auditoría y reportes PDF/Excel/PNG.

## Desarrollo aislado

Node.js 22 o superior. Instalar con `npm ci` y `npm ci --prefix functions`. Abrir dos terminales: `npm run dev:api` y `npm run dev`. Frontend: http://127.0.0.1:8080. La API usa datos sintéticos en memoria, sin conexión a Firebase; reiniciarla restablece esos datos. Pruebas: 2014 para superadministración, Lola para Evangelismo; las credenciales viven exclusivamente en el servidor de prueba.

## Comprobaciones

`npm test` y `npm run build`. Con API y `npm run preview` activos: `npx playwright install chromium webkit`, después `npm run test:ui`. Las pruebas de navegador usan el build en http://127.0.0.1:8081, bloquean servicios externos y no envían correos ni notificaciones reales.

## Producción

Versión 6.4.0 publicada en https://asistencia-656b3.web.app/ con API gratuita en https://mids-api.onrender.com. Migración de códigos y reglas privadas verificadas; los históricos e identidades se conservaron.

Consultar `docs/RESULTADO.md`, `docs/ACTIVACION.md` y `docs/production-preservation.json`.

Para una compilación destinada a Firebase, definir `VITE_MIDS_API_ORIGIN=https://mids-api.onrender.com` antes de `npm run build`. Sin esa variable, la compilación usa la API local del entorno de pruebas. Las futuras publicaciones requieren autorización vigente, respaldo nuevo y API comprobada; los hooks permanecen protegidos.

## Datos y permisos

- El servidor aplica alcance en consultas, lectura por ID, edición y exportaciones. Los líderes no alteran presencias ni consultan otro ministerio.
- Las correcciones requieren autorización, confirmación y motivo; guardan actor, fecha/hora y antes/después. La eliminación lógica conserva el documento.
- Códigos con scrypt y búsqueda HMAC; secreto y credenciales de servicio exclusivos del servidor. Sin códigos almacenados en el navegador.
- Sin lista histórica esperada confirmada se muestran registros reales y porcentaje no disponible; nunca se inventan ausencias.
- Se conservan `mids_device_id`, `mids_registrante` y la versión de IndexedDB `mids-offline`. No se reproducen reinicios de identidad antiguos.
- La deduplicación incluye persona, fecha y ministerio para conservar pertenencias múltiples.
- Permanecen notificaciones locales y configuración EmailJS. FCM requiere VAPID válido y credenciales de envío; las pruebas no envían mensajes reales.
