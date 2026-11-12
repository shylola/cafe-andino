// Acceso a datos con SQLite nativo de Node (node:sqlite, Node >= 22.13).
// Crea el esquema y carga el catálogo inicial la primera vez que se ejecuta.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const { productos } = require('./catalogo');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tienda.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS productos (
    id          INTEGER PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    nombre      TEXT NOT NULL,
    categoria   TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    precio      INTEGER NOT NULL,          -- CLP, sin decimales
    stock       INTEGER NOT NULL,
    origen      TEXT,
    destacado   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    creado_en     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ordenes (
    id          INTEGER PRIMARY KEY,
    buy_order   TEXT UNIQUE NOT NULL,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    total       INTEGER NOT NULL,
    estado      TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagada | rechazada | anulada
    medio_pago  TEXT NOT NULL,                     -- webpay | simulado
    token       TEXT,
    detalle     TEXT NOT NULL,                     -- JSON con los ítems
    creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
  CREATE INDEX IF NOT EXISTS idx_ordenes_usuario ON ordenes(usuario_id);
`);

// Carga inicial del catálogo si la tabla está vacía.
const { n } = db.prepare('SELECT COUNT(*) AS n FROM productos').get();
if (n === 0) {
  const ins = db.prepare(`INSERT INTO productos (slug, nombre, categoria, descripcion, precio, stock, origen, destacado)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  for (const p of productos) {
    ins.run(p.slug, p.nombre, p.categoria, p.descripcion, p.precio, p.stock, p.origen, p.destacado ? 1 : 0);
  }
  db.exec('COMMIT');
}

module.exports = db;
