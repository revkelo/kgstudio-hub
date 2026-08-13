# KG Studio — hub

Página principal de <https://kgstudio.top>: quién soy y todo lo que tengo corriendo.

Sitio estático puro (HTML + CSS + JS, sin build) desplegado en Vercel. Cada push a
`main` publica en producción.

## Identidad

Los tokens salen del portafolio (`portafolio.kgstudio.top`) para que los dos sitios se
lean como uno solo:

| Token | Claro | Oscuro |
| --- | --- | --- |
| Fondo | `#f3decd` | `#0d0d0d` |
| Superficie | `#e7d2c1` | `#161616` |
| Texto | `#25211c` | `#ffffff` |
| Acento | `#f56f0d` | `#f56f0d` |

Tipografías: **Space Grotesk** para display, **Inter** para texto, mono del sistema
para metadatos.

## Las dos ideas de la página

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

**El muro de proyectos.** En vez de once tarjetas, los nombres fluyen como un párrafo y
la descripción del que estás recorriendo aparece arriba, en grande. Cada descripción
vive en el DOM dentro de su `<li>`, así que la página funciona sin JS; en móvil, donde
no hay hover, el CSS la muestra debajo de cada nombre y el escenario se oculta.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Apertura, índice en vivo, muro de proyectos, contacto |
| `styles.css` | Tokens y estilos, con modo oscuro por `prefers-color-scheme` |
| `main.js` | Comprobación de estado, muro interactivo y año del pie |

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
| `pc.` | Soporte de computadores | `kgstudio-soporte` |
| `arriendos.` | Gestión de arriendos (privado) | `arriendos` |

El DNS también vive en Vercel y hay un registro comodín `*`, así que un subdominio
nuevo solo necesita asignarse a su proyecto. Ojo: asignar el dominio **no** lo apunta al
deployment — hay que desplegar después, o queda en 404.
