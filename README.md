# KG Studio — hub

Página principal de <https://kgstudio.top>.

## Qué es y qué NO es

Es la **puerta de entrada** al dominio: quién soy en dos frases, qué está corriendo en
cada subdominio, y a dónde ir por lo demás.

**No es un portafolio.** El portafolio ya existe en `portafolio.kgstudio.top` y ahí
viven la trayectoria, la experiencia, el stack y el catálogo de proyectos. Si una
sección de esta página empieza a repetir eso, sobra: se borra y se deja el enlace.

Sitio estático puro (HTML + CSS + JS, sin build) desplegado en Vercel. Cada push a
`main` publica en producción.

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

La escala está declarada de una vez en `:root` — siete pasos, cada uno con un trabajo
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

**El índice en vivo.** Cada nombre de subdominio está escrito dos veces: el texto base
en gris y una copia naranja recortada a ancho cero por CSS. Cuando la comprobación
confirma que el servidor responde, la copia se despliega de izquierda a derecha. El
pintado *es* el health check, no una animación decorativa.

Para agregar un sitio basta con una entrada más en `<ul class="index">`:

```html
<li class="entry">
  <a class="entry__link" href="https://nuevo.kgstudio.top" target="_blank" rel="noopener"
     data-probe="https://nuevo.kgstudio.top">
    <span class="entry__name" data-text="nuevo">nuevo</span>
    <span class="entry__aside">
      <span class="entry__desc">Una línea de qué es</span>
      <span class="entry__meta">Stack · Hosting</span>
    </span>
  </a>
</li>
```

`data-text` debe repetir exactamente el texto visible: es lo que se pinta encima.

Si un sitio no responde el nombre se queda gris, nunca en rojo — un problema de red del
visitante no debería desmentir un sitio que está bien.

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

- Verificar `kgstudio.top` en Google Search Console y enviar el sitemap.
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
| `main.js` | Comprobación de estado y año del pie |
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
| `parla.` | Intérprete en vivo ES⇄EN | `parla` |
| `reinicia.` + `pc.` | Mantenimiento de computadores | `kgstudio-soporte` |
| `arriendos.` | Gestión de arriendos (privado) | `arriendos` |

El DNS también vive en Vercel y hay un registro comodín `*`, así que un subdominio
nuevo solo necesita asignarse a su proyecto. Ojo: asignar el dominio **no** lo apunta al
deployment — hay que desplegar después, o queda en 404.
