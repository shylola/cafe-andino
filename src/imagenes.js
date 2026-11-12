// Imágenes de producto.
// Si existe una foto real en public/img/productos/<slug>.(jpg|jpeg|png|webp) se usa esa;
// si no, se genera una ilustración SVG estilo "empaque" según la categoría del producto.
const fs = require('node:fs');
const path = require('node:path');

const DIR_FOTOS = path.join(__dirname, '..', 'public', 'img', 'productos');
const fotos = new Map();
try {
  for (const f of fs.readdirSync(DIR_FOTOS)) {
    const m = f.match(/^(.+)\.(jpe?g|png|webp)$/i);
    if (m) fotos.set(m[1], `/img/productos/${f}`);
  }
} catch { /* sin carpeta de fotos: se usan ilustraciones */ }

function urlImagen(p) {
  return fotos.get(p.slug) || `/img/p/${p.slug}.svg`;
}

// Paletas por producto (se elige una de forma estable según el id).
const PALETAS = [
  { fondo: '#f3e9dc', principal: '#2f4b3a', acento: '#d98e48' },
  { fondo: '#efe4e1', principal: '#7a2e2a', acento: '#e7b75f' },
  { fondo: '#e6ece9', principal: '#1f3d4d', acento: '#e08a5c' },
  { fondo: '#f1ece2', principal: '#4a3426', acento: '#c9a227' },
  { fondo: '#ebe6ef', principal: '#4b3a63', acento: '#e5a57a' },
  { fondo: '#f4ebe1', principal: '#9c4f2e', acento: '#2f4b3a' },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Corta un texto en líneas de hasta `max` caracteres sin partir palabras.
function lineas(texto, max, limite = 3) {
  const out = [];
  let actual = '';
  for (const w of texto.split(/\s+/)) {
    if ((actual + ' ' + w).trim().length > max && actual) { out.push(actual); actual = w; }
    else actual = (actual + ' ' + w).trim();
  }
  if (actual) out.push(actual);
  return out.slice(0, limite);
}

function textoCentrado(arr, x, y, tam, color, peso = 600, alto = 1.2, familia = 'Georgia, serif') {
  return arr.map((t, i) =>
    `<text x="${x}" y="${y + i * tam * alto}" font-family="${familia}" font-size="${tam}" font-weight="${peso}" fill="${color}" text-anchor="middle">${esc(t)}</text>`).join('');
}

// Separa "Café de grano Huila 250 g" en nombre corto y formato ("250 g").
function partes(nombre) {
  const m = nombre.match(/^(.*?)(\s+(\d[\d,.]*\s?(g|kg|ml|L)|x\d+))$/i);
  return m ? { corto: m[1], formato: m[3] } : { corto: nombre, formato: '' };
}

function bolsaCafe(p, c) {
  const { corto, formato } = partes(p.nombre);
  const titulo = corto.replace(/^Café (de grano|molido|descafeinado)\s*/i, '') || corto;
  const tipo = (corto.match(/grano|molido|descafeinado/i) || ['grano'])[0].toUpperCase();
  return `
    <ellipse cx="200" cy="356" rx="110" ry="12" fill="#000" opacity=".12"/>
    <path d="M110 92 L290 92 L300 350 L100 350 Z" fill="${c.principal}"/>
    <path d="M110 92 L290 92 L286 70 L114 70 Z" fill="${c.principal}" opacity=".85"/>
    <rect x="114" y="66" width="172" height="8" rx="2" fill="#000" opacity=".2"/>
    <path d="M110 92 L100 350 L118 350 L124 92 Z" fill="#fff" opacity=".07"/>
    <path d="M290 92 L300 350 L282 350 L278 92 Z" fill="#000" opacity=".12"/>
    <circle cx="200" cy="118" r="8" fill="#000" opacity=".25"/><circle cx="200" cy="118" r="4" fill="#fff" opacity=".25"/>
    <rect x="128" y="150" width="144" height="160" rx="6" fill="${c.fondo}"/>
    <text x="200" y="172" font-family="Georgia, serif" font-size="11" letter-spacing="3" fill="${c.principal}" text-anchor="middle">CAFÉ ANDINO</text>
    <line x1="150" y1="182" x2="250" y2="182" stroke="${c.acento}" stroke-width="2"/>
    ${textoCentrado(lineas(titulo, 12, 2), 200, 210, 20, c.principal, 700)}
    <text x="200" y="262" font-family="Helvetica, Arial, sans-serif" font-size="10" letter-spacing="2" fill="${c.principal}" text-anchor="middle" opacity=".8">${esc((p.origen || '').toUpperCase())} · ${tipo}</text>
    <rect x="170" y="276" width="60" height="20" rx="10" fill="${c.acento}"/>
    <text x="200" y="290" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${esc(formato || '250 g')}</text>`;
}

function lataTe(p, c) {
  const { corto, formato } = partes(p.nombre);
  return `
    <ellipse cx="200" cy="350" rx="96" ry="12" fill="#000" opacity=".12"/>
    <rect x="115" y="110" width="170" height="236" rx="10" fill="${c.principal}"/>
    <rect x="110" y="92" width="180" height="34" rx="8" fill="${c.acento}"/>
    <rect x="110" y="118" width="180" height="6" fill="#000" opacity=".15"/>
    <rect x="115" y="126" width="22" height="220" fill="#fff" opacity=".08"/>
    <rect x="115" y="175" width="170" height="120" fill="${c.fondo}"/>
    <path d="M200 190 c-14 10 -14 28 0 36 c14 -8 14 -26 0 -36z" fill="${c.principal}" opacity=".85"/>
    ${textoCentrado(lineas(corto, 15, 2), 200, 248, 16, c.principal, 700)}
    <text x="200" y="286" font-family="Helvetica, Arial, sans-serif" font-size="10" letter-spacing="2" fill="${c.principal}" text-anchor="middle" opacity=".8">${esc(((p.origen || '') + (formato ? ' · ' + formato : '')).toUpperCase())}</text>
    <text x="200" y="328" font-family="Georgia, serif" font-size="11" letter-spacing="3" fill="${c.fondo}" text-anchor="middle">CAFÉ ANDINO</text>`;
}

function cajaReposteria(p, c) {
  const { corto, formato } = partes(p.nombre);
  return `
    <ellipse cx="200" cy="340" rx="130" ry="14" fill="#000" opacity=".12"/>
    <path d="M80 170 L200 130 L320 170 L200 210 Z" fill="#e2c9a6"/>
    <path d="M80 170 L200 210 L200 335 L80 295 Z" fill="#cfae84"/>
    <path d="M320 170 L200 210 L200 335 L320 295 Z" fill="#b8956a"/>
    <path d="M140 150 L260 190" stroke="${c.acento}" stroke-width="10"/>
    <path d="M200 210 L200 335" stroke="${c.acento}" stroke-width="10"/>
    <circle cx="200" cy="172" r="12" fill="${c.acento}"/>
    <rect x="96" y="222" width="90" height="56" rx="4" fill="${c.fondo}" transform="skewY(18) translate(0 -62)"/>
    ${textoCentrado(lineas(corto, 14, 2), 200, 72, 20, c.principal, 700)}
    <text x="200" y="${lineas(corto, 14, 2).length > 1 ? 116 : 94}" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="2" fill="${c.principal}" text-anchor="middle" opacity=".75">${esc(('Hecho en Chile' + (formato ? ' · ' + formato : '')).toUpperCase())}</text>`;
}

function taza(p, c) {
  return `
    <ellipse cx="190" cy="318" rx="120" ry="16" fill="#000" opacity=".12"/>
    <ellipse cx="190" cy="312" rx="110" ry="16" fill="#fff"/>
    <path d="M110 170 L270 170 L258 290 Q190 312 122 290 Z" fill="${c.principal}"/>
    <path d="M270 190 q50 0 46 44 q-4 40 -56 44" fill="none" stroke="${c.principal}" stroke-width="16"/>
    <ellipse cx="190" cy="170" rx="80" ry="14" fill="#3b2418"/>
    <path d="M110 170 L122 290 Q132 294 140 296 L130 172 Z" fill="#fff" opacity=".1"/>
    <path d="M160 140 q-14 -22 0 -42 q14 -20 0 -40" fill="none" stroke="${c.acento}" stroke-width="5" stroke-linecap="round" opacity=".7"/>
    <path d="M205 140 q-14 -22 0 -42 q14 -20 0 -40" fill="none" stroke="${c.acento}" stroke-width="5" stroke-linecap="round" opacity=".5"/>
    <rect x="150" y="215" width="80" height="2" fill="${c.acento}" opacity=".8"/>`;
}

// Accesorios: dibujos simples según el tipo de objeto.
function accesorio(p, c) {
  const n = p.nombre.toLowerCase();
  const sombra = '<ellipse cx="200" cy="336" rx="110" ry="12" fill="#000" opacity=".12"/>';
  if (n.includes('prensa')) return sombra + `
    <rect x="140" y="120" width="120" height="210" rx="8" fill="#cfe3ea" opacity=".85"/>
    <rect x="140" y="200" width="120" height="130" fill="#5a3522" opacity=".9"/>
    <rect x="134" y="110" width="132" height="16" rx="4" fill="${c.principal}"/>
    <rect x="196" y="60" width="8" height="52" fill="${c.principal}"/><circle cx="200" cy="58" r="12" fill="${c.principal}"/>
    <path d="M260 150 q46 0 46 50 q0 50 -46 50" fill="none" stroke="${c.principal}" stroke-width="14"/>
    <rect x="134" y="322" width="132" height="12" rx="4" fill="${c.principal}"/>`;
  if (n.includes('molinillo')) return sombra + `
    <rect x="150" y="150" width="100" height="180" rx="14" fill="${c.principal}"/>
    <rect x="150" y="200" width="100" height="10" fill="#fff" opacity=".15"/>
    <rect x="160" y="128" width="80" height="26" rx="6" fill="#9aa3a8"/>
    <rect x="196" y="80" width="8" height="50" fill="#9aa3a8"/>
    <rect x="196" y="76" width="90" height="8" rx="4" fill="#9aa3a8"/>
    <circle cx="286" cy="80" r="14" fill="${c.acento}"/>`;
  if (n.includes('hervidor')) return sombra + `
    <path d="M120 180 Q120 330 200 330 Q280 330 280 180 Z" fill="${c.principal}"/>
    <ellipse cx="200" cy="180" rx="80" ry="16" fill="${c.principal}"/><ellipse cx="200" cy="176" rx="30" ry="8" fill="#000" opacity=".25"/>
    <path d="M128 230 Q60 220 70 130" fill="none" stroke="${c.principal}" stroke-width="10" stroke-linecap="round"/>
    <path d="M272 200 q50 10 40 80" fill="none" stroke="#2b1d14" stroke-width="16" stroke-linecap="round"/>
    <circle cx="200" cy="160" r="10" fill="#2b1d14"/>`;
  if (n.includes('balanza')) return sombra + `
    <rect x="90" y="250" width="220" height="70" rx="12" fill="${c.principal}"/>
    <rect x="90" y="236" width="220" height="20" rx="8" fill="#2b2b2b"/>
    <rect x="160" y="268" width="80" height="30" rx="4" fill="#9fd3a8"/>
    <text x="200" y="290" font-family="monospace" font-size="18" text-anchor="middle" fill="#1d3b22">18.0g</text>`;
  if (n.includes('filtros')) return sombra + `
    <path d="M110 140 L290 140 L230 320 L170 320 Z" fill="#fff" stroke="#e6ddd0" stroke-width="4"/>
    <path d="M125 160 L275 160 L222 312 L178 312 Z" fill="#fff" stroke="#efe7da" stroke-width="3"/>
    <text x="200" y="230" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle" fill="${c.principal}">x100</text>`;
  // Gotero V60 y otros.
  return sombra + `
    <path d="M110 140 L290 140 L238 290 L162 290 Z" fill="${c.principal}"/>
    <path d="M110 140 L290 140 L284 158 L116 158 Z" fill="#fff" opacity=".15"/>
    <path d="M290 160 q40 4 30 50 q-6 26 -44 24" fill="none" stroke="${c.principal}" stroke-width="12"/>
    <rect x="130" y="288" width="140" height="14" rx="6" fill="${c.principal}"/>
    <path d="M160 310 L240 310 L230 336 L170 336 Z" fill="#cfe3ea" opacity=".9"/>`;
}

function svgProducto(p) {
  const c = PALETAS[p.id % PALETAS.length];
  const dibujo = {
    'Café': bolsaCafe, 'Té e infusiones': lataTe, 'Repostería': cajaReposteria, 'Tazas': taza,
  }[p.categoria] || accesorio;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${esc(p.nombre)}">
  <rect width="400" height="400" fill="${c.fondo}"/>
  <circle cx="330" cy="70" r="110" fill="#fff" opacity=".35"/>
  ${dibujo(p, c)}
</svg>`;
}

module.exports = { urlImagen, svgProducto };
