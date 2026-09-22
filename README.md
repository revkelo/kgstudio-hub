# KG Studio - hub

Página principal de <https://kgstudio.top>.

## Qué es y qué NO es

Es la **puerta de entrada** al dominio: quién soy en dos frases, qué está corriendo en
cada subdominio, y a dónde ir por lo demás.

**No es un portafolio.** El portafolio ya existe en `portafolio.kgstudio.top` y ahí
viven la trayectoria, la experiencia, el stack y el catálogo de proyectos. Si una
sección de esta página empieza a repetir eso, sobra: se borra y se deja el enlace.

Sitio estático puro (HTML + CSS + JS, sin build) desplegado en Vercel. Cada push a
`main` publica en producción. Three.js entra por `importmap` desde jsDelivr, así
que sigue sin haber `npm install` ni paso de compilación.

## Identidad

Los tokens salen del portafolio para que los dos sitios se lean como uno solo:

| Token | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#f3decd` | `#0d0d0d` |
| Superficie | `#e7d2c1` | `#161616` |
| Texto | `#25211c` | `#ffffff` |
| Acento | `#f56f0d` | `#f56f0d` |

Tipografías: **Space Grotesk** para display, **Inter** para texto, mono del sistema
para etiquetas.

La escala está declarada de una vez en `:root`: siete pasos, cada uno con un trabajo
asignado. Si necesitas un tamaño nuevo, ajusta la escala; no escribas un `clamp()`
suelto en una regla:

```css
--t-label  etiquetas mono        --t-sub    rutas y tesis
--t-small  pies y metadatos      --t-name   índice en vivo y correo
--t-body   texto corrido         --t-claim  la frase de apertura
--t-lede   entradilla
```

Lo mismo con el ritmo vertical: todas las secciones llevan `.band`, que aplica
`--s-section`. Ninguna sección decide su propio aire.

## La idea de la página

**La zona como sistema orbital.** Un núcleo, que es el dominio raíz, y un cuerpo en
órbita por cada subdominio. Se recorre arrastrando, con la rueda, con WASD, con Tab
o tocando un cuerpo; al señalar uno, el panel de la izquierda cuenta qué es y con
qué está hecho. Quien prefiera leer tiene el botón "Prefiero una lista", que cambia
a la tabla de `<ul class="rows">`.

**El encendido es la comprobación de estado.** `main.js` recorre todo lo que declare
`data-probe`, lo pide con `fetch` en modo `no-cors` y, si el servidor responde, le
pone `data-state="live"`: el punto del cuerpo y el de su fila se prenden naranja a la
vez. No hay animación decorativa de por medio; lo que se ve encendido es lo que
contestó.

Si un sitio no responde se queda apagado, nunca en rojo - un problema de red del
visitante no debería desmentir un sitio que está bien.

Las etiquetas de los cuerpos son enlaces de verdad, con teclado y legibles por un
rastreador que no ejecuta WebGL. Por eso cada sitio está escrito dos veces en el
HTML: como cuerpo en `<div class="labels">` y como fila en `<ul class="rows">`.

Para agregar un sitio hacen falta las dos, con el mismo `data-node` y `data-row`
para que compartan el estado:

```html
<!-- el cuerpo, en .labels -->
<a class="node" href="https://nuevo.kgstudio.top" target="_blank" rel="noopener"
   data-node="nuevo" data-probe="https://nuevo.kgstudio.top"
   data-title="Nuevo" data-stack="Stack · Hosting"
   data-desc="Una línea de qué es, la que lee el panel.">
  <span class="node__dot" aria-hidden="true"></span>
  <span class="node__name">Nuevo</span>
</a>

<!-- la fila, en .rows -->
<li><a href="https://nuevo.kgstudio.top" target="_blank" rel="noopener" data-row="nuevo">
  <span class="rows__dot" aria-hidden="true"></span>
  <span class="rows__name">nuevo</span>
  <span class="rows__desc">Una línea de qué es</span>
  <span class="rows__meta">Stack · Hosting</span>
</a></li>
```

Y tres cosas más que se olvidan: el `ItemList` del `@graph`, la entrada en
`llms.txt` y el número escrito a mano en "Corriendo ahora", que ya se quedó corto
una vez.

## SEO y entidad

Esta página es la **fuente de verdad de quién soy** para Google y para los
buscadores con IA. El `@graph` de `index.html` declara cuatro cosas con `@id`
estables, y ningún otro sitio de la zona vuelve a describirlas: solo las citan.

| `@id` | Qué es |
| --- | --- |
| `https://kgstudio.top/#kevin` | Kevin Gonzalez, la persona |
| `https://kgstudio.top/#kgstudio` | El negocio, el mismo de la ficha de Google Maps |
| `https://kgstudio.top/#website` | El sitio |
| `https://kgstudio.top/#productos` | La lista de lo que está corriendo |

Cuando agregues un producto a la zona, agrégalo también al `ItemList` y pon en su
sitio `"author": { "@id": "https://kgstudio.top/#kevin" }`. Esa referencia cruzada
es lo que hace que un asistente que resume cualquiera de mis páginas sepa de quién
es. Sin ella, cada sitio es un desconocido más.

`llms.txt` dice lo mismo en prosa, para los rastreadores de IA que lo leen antes
que el HTML. Si cambias un dato de identidad, cámbialo en los dos.

**El nombre y la dirección tienen que ser idénticos** aquí, en `reinicia` y en la
ficha de Google Business (`kgstudio`, Calle 155 #14-80, Bogotá). Google compara
los tres textos; si uno difiere, no une la ficha del mapa con el sitio.

### Pendientes que no se resuelven desde el código

- Enviar el sitemap en Google Search Console. La propiedad de dominio ya está
  verificada: el 2026-09-22 se añadió el TXT `google-site-verification=...` a la
  raíz en el DNS de Vercel (`vercel dns ls kgstudio.top`), que cubre el hub y
  todos los subdominios de una vez.
- En la ficha de Google Business, poner `https://kgstudio.top/` como sitio web.
- Falta `hasMap`. El `sameAs` ya apunta a la entidad por su MID
  (`/g/11zds2s_mr`, el identificador que Google le dio a la ficha), pero un
  enlace directo al mapa necesita el `place_id` que sale de
  Maps → Compartir → Copiar vínculo.
- Cuando exista un número solo para el negocio, agregar `telephone` aquí y en
  `reinicia`, escrito igual que en la ficha.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Quién, índice en vivo, rutas, contacto |
| `styles.css` | Escala, tokens y estilos, con modo oscuro por `prefers-color-scheme` |
| `main.js` | El sistema orbital en Three.js, la comprobación de estado y el año del pie |
| `scripts/` | Utilidades de la zona: `configurar-correo.mjs` y `respaldo.mjs` |
| `photo.jpg` | Retrato, también usado como `og:image` |
| `robots.txt` | Rastreo abierto, incluidos los bots de IA, y ruta del sitemap |
| `sitemap.xml` | La única URL del host |
| `llms.txt` | Quién soy y qué opero, en prosa, para buscadores con IA |

## Ver en local

```bash
python -m http.server 8000
```

## Sitios de la zona

| Subdominio | Qué es | Proyecto Vercel |
| --- | --- | --- |
| `kgstudio.top` + `www.` | Este hub | `kgstudio-hub` |
| `portafolio.` | Portafolio personal | `portafolio` |
| `parla.` | Intérprete médico en vivo ES⇄EN | `parla` |
| `monetiq.` | Finanzas personales con IA | `monetiq-web` |
| `reinicia.` + `pc.` | Mantenimiento de computadores | `kgstudio-soporte` |
| `pagobot.` | Bot de pagos en Telegram (la web es solo la API) | `pagobot` |
| `arriendos.` | Gestión de arriendos (privado) | `arriendos` |
| `examia.` | Bancos de preguntas y simulacros con IA | `examia` |
| `autoreel.` | Estudio de video vertical automatizado | `autoreel` |
| `itep.` | Simulador del examen de inglés iTEP | `itep` |
| `distribucionesagd.` | Sitio de cliente: ferretería y pinturas | `distribuciones-agd` |

El DNS también vive en Vercel y hay un registro comodín `*`, así que un subdominio
nuevo solo necesita asignarse a su proyecto. Ojo: asignar el dominio **no** lo apunta al
deployment - hay que desplegar después, o queda en 404.
