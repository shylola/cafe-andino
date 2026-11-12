// Servidor principal de la tienda: Express + EJS + sesiones en memoria.
const express = require('express');
const session = require('express-session');
const path = require('node:path');
const os = require('node:os');
const db = require('./db');
const auth = require('./auth');
const carrito = require('./carrito');
const pagos = require('./pagos');

const app = express();
const PORT = process.env.PORT || 3000;
const TIENDA = process.env.TIENDA_NOMBRE || 'Café Andino';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2, sameSite: 'lax' },
}));

// Registro simple de métricas del servidor para la Fase 2 (tiempo de respuesta y códigos).
const metricas = { inicio: Date.now(), peticiones: 0, errores4xx: 0, errores5xx: 0, msTotal: 0 };
app.use((req, res, next) => {
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    metricas.peticiones++;
    metricas.msTotal += Number(process.hrtime.bigint() - t0) / 1e6;
    if (res.statusCode >= 500) metricas.errores5xx++;
    else if (res.statusCode >= 400) metricas.errores4xx++;
  });
  next();
});

// Variables disponibles en todas las vistas.
app.use((req, res, next) => {
  res.locals.tienda = TIENDA;
  res.locals.gaId = process.env.GA_MEASUREMENT_ID || '';
  res.locals.usuario = req.session.usuario || null;
  res.locals.cantCarrito = carrito.cantidad(req.session);
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  // Evento GA4 generado en un POST anterior (ej. add_to_cart) que se envía en la página siguiente.
  res.locals.gaPendiente = req.session.gaPendiente || null;
  delete req.session.gaPendiente;
  res.locals.clp = (n) => '$' + Number(n).toLocaleString('es-CL');
  res.locals.ga = null; // evento GA4 opcional que cada página puede enviar
  next();
});

const categorias = () => db.prepare('SELECT DISTINCT categoria FROM productos ORDER BY categoria').all().map(r => r.categoria);

// Home: destacados y categorías.
app.get('/', (req, res) => {
  const destacados = db.prepare('SELECT * FROM productos WHERE destacado = 1 ORDER BY id').all();
  res.render('home', { titulo: 'Inicio', destacados, categorias: categorias() });
});

// Listado con búsqueda, filtros, orden y paginación.
const ORDENES = { relevancia: 'destacado DESC, id', precio_asc: 'precio ASC', precio_desc: 'precio DESC', nombre: 'nombre ASC' };
app.get('/productos', (req, res) => {
  const { q = '', categoria = '', min = '', max = '', orden = 'relevancia' } = req.query;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const porPagina = 12;
  const where = [], params = [];
  if (q) { where.push('(nombre LIKE ? OR descripcion LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (categoria) { where.push('categoria = ?'); params.push(categoria); }
  if (min) { where.push('precio >= ?'); params.push(Number(min)); }
  if (max) { where.push('precio <= ?'); params.push(Number(max)); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM productos ${w}`).get(...params).n;
  const items = db.prepare(`SELECT * FROM productos ${w} ORDER BY ${ORDENES[orden] || ORDENES.relevancia} LIMIT ? OFFSET ?`)
    .all(...params, porPagina, (pagina - 1) * porPagina);
  res.locals.ga = q ? { evento: 'search', params: { search_term: q } }
    : { evento: 'view_item_list', params: { item_list_name: categoria || 'Todos', items: items.map(carrito.itemGA) } };
  res.render('listado', {
    titulo: 'Productos', items, total, pagina, paginas: Math.ceil(total / porPagina),
    filtros: { q, categoria, min, max, orden }, categorias: categorias(),
  });
});

// Detalle de producto con relacionados.
app.get('/producto/:slug', (req, res, next) => {
  const p = db.prepare('SELECT * FROM productos WHERE slug = ?').get(req.params.slug);
  if (!p) return next();
  const relacionados = db.prepare('SELECT * FROM productos WHERE categoria = ? AND id != ? LIMIT 4').all(p.categoria, p.id);
  res.locals.ga = { evento: 'view_item', params: { currency: 'CLP', value: p.precio, items: [carrito.itemGA(p)] } };
  res.render('detalle', { titulo: p.nombre, p, relacionados });
});

app.use(auth.router);
app.use(carrito.router);
app.use(pagos.router);

// Endpoints técnicos: salud y métricas para las pruebas de carga.
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/metricas', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    uptime_s: Math.round((Date.now() - metricas.inicio) / 1000),
    peticiones: metricas.peticiones,
    errores4xx: metricas.errores4xx,
    errores5xx: metricas.errores5xx,
    ms_promedio: metricas.peticiones ? +(metricas.msTotal / metricas.peticiones).toFixed(2) : 0,
    cpu_us: process.cpuUsage(),
    memoria_mb: { rss: +(mem.rss / 1e6).toFixed(1), heap: +(mem.heapUsed / 1e6).toFixed(1) },
    carga_promedio: os.loadavg(),
  });
});

app.use((req, res) => res.status(404).render('error', { titulo: 'No encontrado', mensaje: 'La página que buscas no existe.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { titulo: 'Error', mensaje: 'Ocurrió un error inesperado.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`${TIENDA} escuchando en http://localhost:${PORT}`));
}
module.exports = app;
