// Checkout y pago. Dos medios:
//  - webpay: Webpay Plus de Transbank en ambiente de INTEGRACIÓN (sandbox público, sin dinero real).
//  - simulado: pago local inmediato, para pruebas de carga (no se debe cargar a Transbank con k6).
const express = require('express');
const crypto = require('node:crypto');
const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');
const db = require('./db');
const { requiereLogin } = require('./auth');
const carrito = require('./carrito');

const router = express.Router();
const webpay = new WebpayPlus.Transaction(new Options(
  IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration));
const PAGO_SIMULADO_HABILITADO = process.env.PAGO_SIMULADO !== 'false';

const baseUrl = (req) => process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

router.get('/checkout', requiereLogin, (req, res) => {
  const r = carrito.resumen(req.session);
  if (!r.items.length) return res.redirect('/carrito');
  res.locals.ga = { evento: 'begin_checkout', params: { currency: 'CLP', value: r.total, items: r.items.map(i => carrito.itemGA(i.p, i.cantidad)) } };
  res.render('checkout', { titulo: 'Checkout', ...r, simulado: PAGO_SIMULADO_HABILITADO });
});

router.post('/checkout', requiereLogin, async (req, res, next) => {
  try {
    const r = carrito.resumen(req.session);
    if (!r.items.length) return res.redirect('/carrito');
    const medio = req.body.medio === 'simulado' && PAGO_SIMULADO_HABILITADO ? 'simulado' : 'webpay';
    // buy_order de Transbank: máximo 26 caracteres.
    const buyOrder = 'O' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const detalle = JSON.stringify(r.items.map(i => ({ id: i.p.id, nombre: i.p.nombre, precio: i.p.precio, cantidad: i.cantidad, categoria: i.p.categoria })));
    db.prepare('INSERT INTO ordenes (buy_order, usuario_id, total, medio_pago, detalle) VALUES (?, ?, ?, ?, ?)')
      .run(buyOrder, req.session.usuario.id, r.total, medio, detalle);
    req.session.gaPendiente = { evento: 'add_payment_info', params: { currency: 'CLP', value: r.total, payment_type: medio } };

    if (medio === 'simulado') {
      return res.redirect(`/pago/simulado?orden=${buyOrder}`);
    }
    const t = await webpay.create(buyOrder, req.sessionID.slice(0, 61), r.total, `${baseUrl(req)}/pago/retorno`);
    db.prepare('UPDATE ordenes SET token = ? WHERE buy_order = ?').run(t.token, buyOrder);
    res.render('redirigir-webpay', { titulo: 'Redirigiendo a Webpay', url: t.url, token: t.token });
  } catch (e) { next(e); }
});

// Pago simulado: aprueba la orden sin salir del sitio.
router.get('/pago/simulado', requiereLogin, (req, res) => {
  const o = db.prepare('SELECT * FROM ordenes WHERE buy_order = ? AND usuario_id = ?').get(req.query.orden, req.session.usuario.id);
  if (!o || o.estado !== 'pendiente') return res.redirect('/mis-compras');
  db.prepare("UPDATE ordenes SET estado = 'pagada' WHERE id = ?").run(o.id);
  finalizar(req, res, o, true);
});

// Retorno desde Webpay (GET o POST). token_ws = flujo normal; TBK_TOKEN = compra anulada por el usuario.
async function retorno(req, res, next) {
  try {
    const datos = { ...req.query, ...req.body };
    if (datos.TBK_TOKEN && !datos.token_ws) {
      db.prepare("UPDATE ordenes SET estado = 'anulada' WHERE buy_order = ?").run(datos.TBK_ORDEN_COMPRA || '');
      req.session.flash = 'Anulaste el pago. Tu carrito sigue disponible.';
      return res.redirect('/carrito');
    }
    const o = db.prepare('SELECT * FROM ordenes WHERE token = ?').get(datos.token_ws || '');
    if (!o) return res.redirect('/');
    const c = await webpay.commit(datos.token_ws);
    const aprobada = c.response_code === 0 && c.status === 'AUTHORIZED';
    db.prepare('UPDATE ordenes SET estado = ? WHERE id = ?').run(aprobada ? 'pagada' : 'rechazada', o.id);
    finalizar(req, res, o, aprobada, c);
  } catch (e) { next(e); }
}
router.get('/pago/retorno', retorno);
router.post('/pago/retorno', retorno);

function finalizar(req, res, orden, aprobada, comprobante = null) {
  const items = JSON.parse(orden.detalle);
  if (aprobada) {
    req.session.carrito = {};
    res.locals.cantCarrito = 0;
    res.locals.ga = { evento: 'purchase', params: {
      transaction_id: orden.buy_order, currency: 'CLP', value: orden.total, payment_type: orden.medio_pago,
      items: items.map(i => ({ item_id: String(i.id), item_name: i.nombre, item_category: i.categoria, price: i.precio, quantity: i.cantidad })),
    } };
  }
  res.render('resultado', { titulo: aprobada ? 'Compra exitosa' : 'Pago rechazado', aprobada, orden, items, comprobante });
}

module.exports = { router };
