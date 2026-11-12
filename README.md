# Café Andino — Proyecto Desempeño de Sistemas (UTEM 2026)

Tienda e-commerce (Opción 1) para el trabajo semestral de INFB8091. Incluye catálogo con búsqueda y filtros, carrito, registro/login, checkout con **Webpay Plus de prueba**, **GA4** con eventos de e-commerce y Core Web Vitals, y un **generador de carga k6**.

## 1. Correr en local

Requiere Node.js 22.13 o superior.

```bash
npm install
npm test          # 6 pruebas del flujo de compra
npm run dev       # http://localhost:3000
```

Variables de entorno: ver `.env.example`. Sin `GA_MEASUREMENT_ID` el sitio funciona igual, pero no envía datos a GA4.

**Pago de prueba Webpay:** tarjeta VISA `4051 8856 0044 6623`, CVV `123`, cualquier fecha futura; RUT `11.111.111-1`, clave `123`. También hay un "pago simulado" que aprueba la compra sin salir del sitio (es el que usan las pruebas de carga).

### Imágenes de productos

Cada producto tiene una ilustración generada automáticamente (`src/imagenes.js`). Para usar **fotos reales**, guarda la imagen en `public/img/productos/` con el *slug* del producto como nombre, por ejemplo `public/img/productos/cafe-de-grano-huila-250-g.jpg` (formatos jpg, png o webp, idealmente cuadradas de 800×800). El slug aparece en la URL del producto. Al reiniciar el servidor se usa la foto en vez de la ilustración.

## 2. Subir a GitHub

```bash
git init && git add . && git commit -m "Tienda base Café Andino"
git branch -M main
git remote add origin https://github.com/<usuario>/cafe-andino.git
git push -u origin main
```

Agregar al profesor y a los integrantes como colaboradores del repositorio.

## 3. Deploy en Render (gratis)

1. Entrar a https://render.com con la cuenta de GitHub.
2. **New → Blueprint**, elegir el repositorio. Render lee `render.yaml`.
3. Ingresar `GA_MEASUREMENT_ID` cuando lo pida (paso 4) y crear.
4. La URL queda como `https://cafe-andino.onrender.com`.

Ojo con el plan gratuito: el servicio se duerme tras 15 minutos sin tráfico (el primer request tarda ~1 min) y el disco se borra en cada deploy (la base se vuelve a crear con el catálogo). Antes de cada prueba de carga, abrir el sitio para "despertarlo". Recursos: 512 MB de RAM y 0,1 CPU, así que el punto de saturación aparecerá con pocos usuarios, lo que sirve para el análisis.

## 4. Configurar GA4

1. En https://analytics.google.com: **Administrar → Crear propiedad** ("Café Andino"), zona horaria Chile, moneda CLP.
2. **Flujos de datos → Web**, URL de Render. Copiar el **ID de medición** `G-XXXXXXXXXX` y ponerlo en `GA_MEASUREMENT_ID` en Render.
3. **Administrar → Administración de acceso a la propiedad → +** y agregar `j.aranda@utem.cl` con rol **Lector**.
4. Verificar en **Informes → Tiempo real** navegando el sitio.
5. **Administrar → Eventos**: marcar `purchase` como evento clave (conversión). Opcional: marcar `add_to_cart` y `begin_checkout`.
6. **Explorar → Exploración de embudo** con pasos `view_item` → `add_to_cart` → `begin_checkout` → `purchase`.
7. Para ver las Web Vitals por métrica: **Administrar → Definiciones personalizadas → Crear métrica personalizada** `metric_value` (evento) y dimensión `metric_rating`.

Eventos que envía el sitio: `view_item_list`, `search`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `sign_up`, `login`, y `LCP`, `CLS`, `INP`, `FCP`, `TTFB`. Las métricas de engagement (tiempo de interacción, rebote, páginas por sesión) GA4 las calcula solo.

Para las capturas del informe: Tiempo real, Eventos, Exploración de embudo, y **Administrar → Eventos** mostrando los eventos personalizados.

## 5. Pruebas de carga con k6

Instalar k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
# Carga baja (5 usuarios, 2 min)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=resultados/reporte-baja.html \
  k6 run -e BASE_URL=https://cafe-andino.onrender.com -e ESCENARIO=baja load/tienda.js

# Carga normal (30 usuarios, 5 min)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=resultados/reporte-normal.html \
  k6 run -e BASE_URL=https://cafe-andino.onrender.com -e ESCENARIO=normal load/tienda.js

# Estrés (50 → 100 → 200 usuarios)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=resultados/reporte-estres.html \
  k6 run -e BASE_URL=https://cafe-andino.onrender.com -e ESCENARIO=estres load/tienda.js
```

En PowerShell (Windows) las variables se ponen antes así: `$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="resultados/reporte-baja.html"; k6 run ...`

Parámetros: `VUS` (usuarios virtuales), `RAMPUP` (ej. `1m`), `DURACION` (ej. `5m`), `PAUSA` (segundos de "pensar" entre páginas), `MEZCLA` (pesos navegante,buscador,comprador,abandono; por defecto `40,25,15,20`), `RUN_ID` (cambia los usuarios de prueba).

Cada corrida deja un reporte HTML (`resultados/reporte-*.html`) y un JSON (`resultados/resumen-*.json`) con promedio, mediana, p90, p95, p99, throughput y tasa de error. Mientras corre, `GET /api/metricas` muestra CPU y memoria del servidor.

**Importante para GA4:** k6 hace peticiones HTTP sin ejecutar JavaScript, así que su tráfico **no aparece en GA4**. Para comparar la experiencia "normal vs bajo carga" (Fase 2), mientras k6 corre deben navegar el sitio en un navegador real (o con el módulo `k6/browser`) y ver en GA4 cómo cambian las Web Vitals.
