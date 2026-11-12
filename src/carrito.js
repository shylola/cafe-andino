// Carrito de compras guardado en la sesión: { [productoId]: cantidad }.
const express = require('express');
const db = require('./db');

const router = express.Router();

const itemGA = (p, cantidad = 1) => ({
  item_id: String(p.id), item_name: p.nombre, item_category: p.categoria, price: p.precio, quantity: cantidad,
});

function cantidad(sesion) {
  return Object.values(sesion.carrito || {}).reduce((a, b) => a + b, 0);
}

// Devuelve los ítems del carrito con datos del producto y el total.
function resumen(sesion) {
  const c = sesion.carrito || {};
  const ids = Object.keys(c);
  if (!ids.length) return { items: [], total: 0 };
  const filas = db.prepare(`SELECT * FROM productos WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids.map(Number));
  const items = filas.map(p => ({ p, cantidad: c[p.id], subtotal: p.precio * c[p.id] }));
  return { items, total: items.reduce((a, i) => a + i.subtotal, 0) };
}

router.get('/carrito', (req, res) => {
  const r = resumen(req.session);
  res.locals.ga = { evento: 'view_cart', params: { currency: 'CLP', value: r.total, items: r.items.map(i => itemGA(i.p, i.cantidad)) } };
  res.render('carrito', { titulo: 'Carrito', ...r });
});

router.post('/carrito/agregar', (req, res) => {
  const id = Number(req.body.id);
  const cant = Math.max(1, Math.min(10, Number(req.body.cantidad) || 1));
  const p = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!p) return res.status(404).send('Producto no existe');
  req.session.carrito = req.session.carrito || {};
  req.session.carrito[id] = Math.min(p.stock, (req.session.carrito[id] || 0) + cant);
  req.session.gaPendiente = { evento: 'add_to_cart', params: { currency: 'CLP', value: p.precio * cant, items: [itemGA(p, cant)] } };
  req.session.flash = `Agregaste ${p.nombre} al carrito.`;
  res.redirect(req.body.volver || '/carrito');
});

router.post('/carrito/actualizar', (req, res) => {
  const id = Number(req.body.id);
  const cant = Number(req.body.cantidad);
  if (!req.session.carrito || !(id in req.session.carrito)) return res.redirect('/carrito');
  const p = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!cant || cant < 1) {
    req.session.gaPendiente = { evento: 'remove_from_cart', params: { currency: 'CLP', value: p.precio * req.session.carrito[id], items: [itemGA(p, req.session.carrito[id])] } };
    delete req.session.carrito[id];
  } else {
    req.session.carrito[id] = Math.min(p.stock, cant);
  }
  res.redirect('/carrito');
});

module.exports = { router, cantidad, resumen, itemGA };
