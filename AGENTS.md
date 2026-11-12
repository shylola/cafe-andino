# AGENTS.md — Contexto para agentes de codificación

## Proyecto
Trabajo semestral de **INFB8091 Desempeño de Sistemas (UTEM, 2º semestre 2026)**.
Opción elegida: **Opción 1, comercio electrónico**. Tienda: **Café Andino** (café de especialidad, té, accesorios, tazas y repostería).

Fases:
- **Fase 1.1** (Lab 1, entrega 16-nov-2026): sitio funcional mínimo con catálogo + filtros/búsqueda, carrito, checkout con sandbox de pago chileno, registro/login, GA4 con eventos personalizados. Deploy en nube gratuita.
- **Fase 1.2** (Lab 1): generadores de carga con perfiles de usuario y 3 escenarios (baja, normal, estrés).
- **Fase 2** (Lab 2, semana del 30-nov): análisis de desempeño (p50/p90/p95/p99, throughput, errores, CPU/memoria, punto de saturación, Core Web Vitals, embudo de conversión).

## Stack
- Node.js ≥ 22.13, Express 5, EJS (render en servidor), SQLite nativo (`node:sqlite`), `express-session`, `bcryptjs`.
- Pago: Webpay Plus de Transbank en **ambiente de integración** (`transbank-sdk`), más un **pago simulado** para pruebas de carga.
- Analítica: GA4 con `gtag.js` (variable `GA_MEASUREMENT_ID`) + librería `web-vitals`.
- Carga: k6 (`load/tienda.js`).
- Deploy: Render, plan gratuito (`render.yaml`).

## Estructura
- `src/server.js` rutas de catálogo, middleware de métricas, `/api/health`, `/api/metricas`
- `src/auth.js` registro/login/logout, mis compras
- `src/carrito.js` carrito en sesión
- `src/pagos.js` checkout, Webpay y pago simulado
- `src/db.js`, `src/catalogo.js` esquema y datos iniciales
- `views/` plantillas EJS; `views/partials/footer.ejs` envía eventos GA4 y Web Vitals
- `test/` pruebas con `node --test`
- `load/` generador de carga k6

## Reglas para el agente
1. Al iniciar una sesión, leer `LogFile.txt` completo para recuperar el contexto.
2. Registrar en `LogFile.txt` cada prompt completo con fecha y hora, un resumen de lo generado (qué se instaló, qué se diseñó, qué archivos cambiaron) y el **modelo** usado.
3. Antes de implementar, explicar qué se hará y en qué archivos, y aplicar solo con confirmación.
4. Al terminar una modificación, preguntar si se hace commit y si se hace deploy.
5. Usar Git; si algo deja de funcionar, revisar el historial (`git log`, `git diff`) para encontrar el cambio.
6. Documentar el código y usar español neutro latinoamericano.
7. Proponer pruebas automáticas para cada pieza y ejecutar `npm test` antes de terminar.
8. Nunca generar carga contra Transbank: las pruebas de carga usan `medio=simulado`.

## Experticia esperada del agente
Desarrollo web Node.js/Express, comercio electrónico, GA4 y Google Tag Manager, ingeniería de desempeño (k6, percentiles, teoría de colas, análisis operacional) y deploy en nubes gratuitas.
