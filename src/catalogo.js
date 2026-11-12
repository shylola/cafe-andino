// Catálogo inicial de la tienda. Editar aquí para cambiar el rubro o los productos.
const base = [
  ['Café', 'Café de grano Huila 250 g', 'Colombia', 8990, 'Notas a panela y frutos rojos, tueste medio.'],
  ['Café', 'Café de grano Yirgacheffe 250 g', 'Etiopía', 11990, 'Floral y cítrico, tueste claro.'],
  ['Café', 'Café molido Cerrado 500 g', 'Brasil', 12490, 'Chocolate y nuez, ideal para prensa francesa.'],
  ['Café', 'Café de grano Tarrazú 250 g', 'Costa Rica', 10490, 'Dulce y balanceado, acidez brillante.'],
  ['Café', 'Café descafeinado Chiapas 250 g', 'México', 9490, 'Proceso de agua suiza, cuerpo medio.'],
  ['Café', 'Café de grano Cajamarca 1 kg', 'Perú', 32990, 'Formato cafetería, caramelo y cacao.'],
  ['Té e infusiones', 'Té verde sencha 100 g', 'Japón', 6990, 'Hoja entera, vegetal y fresco.'],
  ['Té e infusiones', 'Té negro Assam 100 g', 'India', 5990, 'Malteado y robusto.'],
  ['Té e infusiones', 'Infusión de rica-rica 50 g', 'Chile', 4490, 'Hierba altiplánica, aromática.'],
  ['Té e infusiones', 'Yerba mate orgánica 500 g', 'Argentina', 5490, 'Con palo, sabor suave.'],
  ['Accesorios', 'Prensa francesa 600 ml', null, 18990, 'Vidrio borosilicato y filtro de acero.'],
  ['Accesorios', 'Molinillo manual de muelas cerámicas', null, 29990, 'Molienda ajustable de espresso a prensa.'],
  ['Accesorios', 'Hervidor cuello de cisne 1 L', null, 39990, 'Control de flujo para métodos de filtrado.'],
  ['Accesorios', 'Filtros de papel V60 x100', null, 5990, 'Papel blanco sin sabor.'],
  ['Accesorios', 'Balanza digital con temporizador', null, 24990, 'Precisión 0,1 g.'],
  ['Accesorios', 'Gotero V60 cerámica', null, 21990, 'Cono 02 de cerámica esmaltada.'],
  ['Tazas', 'Taza de gres 300 ml', null, 7990, 'Hecha a mano en Pomaire.'],
  ['Tazas', 'Set 2 tazas espresso', null, 9990, 'Porcelana con platillo.'],
  ['Tazas', 'Vaso térmico 450 ml', null, 14990, 'Doble pared de acero, tapa hermética.'],
  ['Tazas', 'Jarro de cobre para café frío 500 ml', null, 12990, 'Ideal para cold brew.'],
  ['Repostería', 'Alfajores artesanales x6', 'Chile', 6490, 'Manjar y chocolate semiamargo.'],
  ['Repostería', 'Galletas de avena y chocolate x12', 'Chile', 4990, 'Horneadas cada semana.'],
  ['Repostería', 'Brownie de cacao 70% x4', 'Chile', 7490, 'Húmedo, con nueces.'],
  ['Repostería', 'Kuchen de murta', 'Chile', 12990, 'Receta del sur, 8 porciones.'],
];

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const productos = base.map(([categoria, nombre, origen, precio, descripcion], i) => ({
  slug: slugify(nombre),
  nombre,
  categoria, origen, precio, descripcion,
  stock: 20 + ((i * 7) % 40),
  destacado: i % 5 === 0,
}));

module.exports = { productos, slugify };
