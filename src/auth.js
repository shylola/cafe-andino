// Registro, inicio y cierre de sesión de usuarios.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');

const router = express.Router();
// Costo de hash configurable: bajo en pruebas de carga para no medir solo bcrypt.
const COSTO = Number(process.env.BCRYPT_COSTO || 10);

function requiereLogin(req, res, next) {
  if (req.session.usuario) return next();
  req.session.volverA = req.originalUrl;
  req.session.flash = 'Inicia sesión para continuar con la compra.';
  res.redirect('/login');
}

router.get('/registro', (req, res) => res.render('registro', { titulo: 'Crear cuenta', error: null, datos: {} }));

router.post('/registro', (req, res) => {
  const { nombre = '', email = '', password = '' } = req.body;
  const datos = { nombre, email };
  if (!nombre.trim() || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return res.status(400).render('registro', { titulo: 'Crear cuenta', error: 'Completa nombre, un email válido y una clave de al menos 6 caracteres.', datos });
  }
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email.toLowerCase())) {
    return res.status(409).render('registro', { titulo: 'Crear cuenta', error: 'Ese email ya está registrado.', datos });
  }
  const hash = bcrypt.hashSync(password, COSTO);
  const r = db.prepare('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)').run(nombre.trim(), email.toLowerCase(), hash);
  req.session.usuario = { id: Number(r.lastInsertRowid), nombre: nombre.trim(), email: email.toLowerCase() };
  req.session.gaPendiente = { evento: 'sign_up', params: { method: 'email' } };
  res.redirect(req.session.volverA || '/');
});

router.get('/login', (req, res) => res.render('login', { titulo: 'Iniciar sesión', error: null, email: '' }));

router.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (!u || !bcrypt.compareSync(password, u.password_hash)) {
    return res.status(401).render('login', { titulo: 'Iniciar sesión', error: 'Email o clave incorrectos.', email });
  }
  req.session.usuario = { id: u.id, nombre: u.nombre, email: u.email };
  req.session.gaPendiente = { evento: 'login', params: { method: 'email' } };
  const destino = req.session.volverA || '/';
  delete req.session.volverA;
  res.redirect(destino);
});

router.post('/logout', (req, res) => {
  delete req.session.usuario;
  res.redirect('/');
});

router.get('/mis-compras', requiereLogin, (req, res) => {
  const ordenes = db.prepare('SELECT * FROM ordenes WHERE usuario_id = ? ORDER BY id DESC').all(req.session.usuario.id)
    .map(o => ({ ...o, detalle: JSON.parse(o.detalle) }));
  res.render('mis-compras', { titulo: 'Mis compras', ordenes });
});

module.exports = { router, requiereLogin };
