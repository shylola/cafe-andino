// Generador de carga k6 para la tienda.
// Simula 4 perfiles de usuario: navegante, buscador, comprador y abandono de carrito.
//
// Uso:
//   k6 run -e BASE_URL=https://mi-tienda.onrender.com -e ESCENARIO=normal load/tienda.js
// Parámetros (variables -e):
//   ESCENARIO  baja | normal | estres (por defecto: baja)
//   VUS        usuarios virtuales máximos (sobrescribe el escenario)
//   RAMPUP     duración del aumento progresivo, ej. 1m
//   DURACION   duración a carga plena, ej. 5m
//   PAUSA      tiempo de "pensar" promedio entre páginas en segundos (por defecto 2)
//   MEZCLA     pesos navegante,buscador,comprador,abandono (por defecto 40,25,15,20)
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const PAUSA = Number(__ENV.PAUSA || 2);
const MEZCLA = (__ENV.MEZCLA || '40,25,15,20').split(',').map(Number);

const ESCENARIOS = {
  // Carga baja: pocos usuarios, sirve de línea base.
  baja: [
    { duration: __ENV.RAMPUP || '30s', target: Number(__ENV.VUS || 5) },
    { duration: __ENV.DURACION || '2m', target: Number(__ENV.VUS || 5) },
    { duration: '15s', target: 0 },
  ],
  // Carga sostenida "normal".
  normal: [
    { duration: __ENV.RAMPUP || '1m', target: Number(__ENV.VUS || 30) },
    { duration: __ENV.DURACION || '5m', target: Number(__ENV.VUS || 30) },
    { duration: '30s', target: 0 },
  ],
  // Pico / estrés: escalones crecientes hasta encontrar el punto de saturación.
  estres: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: Number(__ENV.VUS || 200) },
    { duration: __ENV.DURACION || '2m', target: Number(__ENV.VUS || 200) },
    { duration: '30s', target: 0 },
  ],
};
const ESC = __ENV.ESCENARIO || 'baja';

export const options = {
  scenarios: {
    [ESC]: { executor: 'ramping-vus', startVUs: 0, stages: ESCENARIOS[ESC], gracefulRampDown: '30s' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const compras = new Counter('compras_completadas');
const abandonos = new Counter('carritos_abandonados');
const tiempoCompra = new Trend('tiempo_flujo_compra', true);

const BUSQUEDAS = ['cafe', 'te', 'taza', 'molinillo', 'murta', 'prensa', 'yerba', 'alfajores', 'v60', 'kenia'];
const CATEGORIAS = ['Café', 'Té e infusiones', 'Accesorios', 'Tazas', 'Repostería'];
const azar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pensar = () => sleep(PAUSA * (0.5 + Math.random()));

function get(ruta, nombre) {
  const r = http.get(BASE + ruta, { tags: { name: nombre } });
  check(r, { [`${nombre} 200`]: (x) => x.status === 200 });
  return r;
}

// Extrae los enlaces /producto/<slug> de una página de listado.
function productosEn(r) {
  const slugs = [...String(r.body).matchAll(/href="\/producto\/([a-z0-9-]+)"/g)].map(m => m[1]);
  return slugs.length ? slugs : ['kuchen-de-murta'];
}
function idEn(r) {
  const m = String(r.body).match(/name="id" value="(\d+)"/);
  return m ? m[1] : '1';
}

function agregar(id, volver) {
  const r = http.post(`${BASE}/carrito/agregar`, { id, cantidad: String(1 + Math.floor(Math.random() * 2)), volver },
    { tags: { name: 'agregar_carrito' } });
  check(r, { 'agregar_carrito 200': (x) => x.status === 200 });
}

function navegante() {
  group('navegante', () => {
    get('/', 'home'); pensar();
    const l = get(`/productos?categoria=${encodeURIComponent(azar(CATEGORIAS))}`, 'listado'); pensar();
    get(`/producto/${azar(productosEn(l))}`, 'detalle'); pensar();
    if (Math.random() < 0.5) { get('/productos?pagina=2', 'listado'); pensar(); }
  });
}

function buscador() {
  group('buscador', () => {
    get('/', 'home'); pensar();
    const l = get(`/productos?q=${azar(BUSQUEDAS)}&orden=${azar(['precio_asc', 'precio_desc', 'relevancia'])}`, 'busqueda'); pensar();
    const d = get(`/producto/${azar(productosEn(l))}`, 'detalle'); pensar();
    if (Math.random() < 0.3) { agregar(idEn(d), '/carrito'); pensar(); }
  });
}

// Cada VU tiene un usuario fijo: intenta login y, si no existe, se registra.
function ingresar() {
  const email = `vu${__VU}-${(__ENV.RUN_ID || 'k6')}@carga.test`;
  let r = http.post(`${BASE}/login`, { email, password: 'clave-de-carga' }, {
    tags: { name: 'login' },
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }, 401), // 401 esperado la primera vez: el usuario aún no existe
  });
  if (r.status === 401) {
    r = http.post(`${BASE}/registro`, { nombre: `Usuario ${__VU}`, email, password: 'clave-de-carga' }, { tags: { name: 'registro' } });
  }
  check(r, { 'ingreso ok': (x) => x.status === 200 });
}

function comprador() {
  group('comprador', () => {
    const t0 = Date.now();
    get('/', 'home'); pensar();
    const l = get(`/productos?categoria=${encodeURIComponent(azar(CATEGORIAS))}`, 'listado'); pensar();
    const d = get(`/producto/${azar(productosEn(l))}`, 'detalle'); pensar();
    agregar(idEn(d), '/carrito'); pensar();
    ingresar(); pensar();
    get('/checkout', 'checkout'); pensar();
    const r = http.post(`${BASE}/checkout`, { medio: 'simulado' }, { tags: { name: 'pagar' } });
    const ok = check(r, { 'compra exitosa': (x) => x.status === 200 && String(x.body).includes('Gracias por tu compra') });
    if (ok) { compras.add(1); tiempoCompra.add(Date.now() - t0); }
  });
}

function abandono() {
  group('abandono', () => {
    get('/', 'home'); pensar();
    const l = get(`/productos?q=${azar(BUSQUEDAS)}`, 'busqueda'); pensar();
    const d = get(`/producto/${azar(productosEn(l))}`, 'detalle'); pensar();
    agregar(idEn(d), '/carrito'); pensar();
    get('/carrito', 'carrito');
    abandonos.add(1);
  });
}

const PERFILES = [navegante, buscador, comprador, abandono];
const TOTAL = MEZCLA.reduce((a, b) => a + b, 0);

export default function () {
  let x = Math.random() * TOTAL;
  for (let i = 0; i < PERFILES.length; i++) {
    x -= MEZCLA[i];
    if (x < 0) return PERFILES[i]();
  }
  PERFILES[0]();
}

// Guarda el resumen en JSON para el informe (además del reporte HTML del web dashboard).
export function handleSummary(data) {
  const archivo = `resultados/resumen-${ESC}.json`;
  return { [archivo]: JSON.stringify(data, null, 2), stdout: '\n' + resumenTexto(data) + '\n' };
}

function resumenTexto(d) {
  const m = d.metrics, dur = m.http_req_duration.values;
  return [
    `Escenario: ${ESC}  Base: ${BASE}`,
    `Peticiones: ${m.http_reqs.values.count}  Throughput: ${m.http_reqs.values.rate.toFixed(2)} req/s`,
    `Tiempo de respuesta (ms): prom ${dur.avg.toFixed(1)}  med ${dur.med.toFixed(1)}  p90 ${dur['p(90)'].toFixed(1)}  p95 ${dur['p(95)'].toFixed(1)}  p99 ${dur['p(99)'].toFixed(1)}`,
    `Tasa de error: ${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `Compras: ${m.compras_completadas ? m.compras_completadas.values.count : 0}  Abandonos: ${m.carritos_abandonados ? m.carritos_abandonados.values.count : 0}`,
  ].join('\n');
}
