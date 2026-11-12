// Pruebas automáticas del flujo principal: catálogo, registro, carrito y compra con pago simulado.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');

process.env.DB_PATH = path.join(os.tmpdir(), `tienda-test-${process.pid}.db`);
process.env.BCRYPT_COSTO = '4';
const app = require('../src/server');

let servidor, base, cookie = '';
before(() => new Promise(r => { servidor = app.listen(0, () => { base = `http://localhost:${servidor.address().port}`; r(); }); }));
after(() => servidor.close());

// fetch que mantiene la cookie de sesión y no sigue redirecciones.
async function pedir(ruta, cuerpo) {
  const opciones = { redirect: 'manual', headers: { cookie } };
  if (cuerpo) {
    opciones.method = 'POST';
    opciones.headers['content-type'] = 'application/x-www-form-urlencoded';
    opciones.body = new URLSearchParams(cuerpo).toString();
  }
  const r = await fetch(base + ruta, opciones);
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: r.status, location: r.headers.get('location'), html: await r.text() };
}

test('home y catálogo responden', async () => {
  assert.equal((await pedir('/')).status, 200);
  const l = await pedir('/productos?categoria=Café&orden=precio_asc');
  assert.equal(l.status, 200);
  assert.match(l.html, /view_item_list/);
});

test('búsqueda filtra resultados', async () => {
  const r = await pedir('/productos?q=murta');
  assert.match(r.html, /Kuchen de murta/);
  assert.doesNotMatch(r.html, /Prensa francesa/);
});

test('detalle de producto envía view_item', async () => {
  const r = await pedir('/producto/kuchen-de-murta');
  assert.equal(r.status, 200);
  assert.match(r.html, /"view_item"/);
});

test('checkout exige login', async () => {
  const r = await pedir('/checkout');
  assert.equal(r.status, 302);
  assert.equal(r.location, '/login');
});

test('compra completa con pago simulado', async () => {
  const reg = await pedir('/registro', { nombre: 'Test', email: `t${Date.now()}@x.cl`, password: 'secreto' });
  assert.equal(reg.status, 302);
  await pedir('/carrito/agregar', { id: '1', cantidad: '2' });
  const carrito = await pedir('/carrito');
  assert.match(carrito.html, /"add_to_cart"/);
  assert.match((await pedir('/checkout')).html, /"begin_checkout"/);
  const pago = await pedir('/checkout', { medio: 'simulado' });
  assert.match(pago.location, /^\/pago\/simulado\?orden=/);
  const fin = await pedir(pago.location);
  assert.match(fin.html, /Gracias por tu compra/);
  assert.match(fin.html, /"purchase"/);
  assert.match((await pedir('/mis-compras')).html, /pagada/);
});

test('login con clave incorrecta devuelve 401', async () => {
  const r = await pedir('/login', { email: 'nadie@x.cl', password: 'malamala' });
  assert.equal(r.status, 401);
});
