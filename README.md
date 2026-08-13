# KG Studio — hub

Página principal de <https://kgstudio.top>: quién soy y todo lo que tengo en producción.

Sitio estático puro (HTML + CSS + JS, sin build) desplegado en Vercel.

## Agregar un sitio al registro

Los sitios en vivo son una lista en `index.html` dentro de `<ul id="registry">`. Copia
una fila y ajusta los tres datos:

```html
<li class="rec">
  <a class="rec__link" href="https://nuevo.kgstudio.top" target="_blank" rel="noopener">
    <span class="rec__host">
      <span class="dot" data-probe="https://nuevo.kgstudio.top" aria-hidden="true"></span>
      <span class="rec__sub">nuevo</span><span class="rec__root">.kgstudio.top</span>
    </span>
    ...
```

`data-probe` es la URL que se comprueba al cargar la página; si responde, el punto
se pone verde. Si no responde se queda gris en vez de rojo, para que un problema de
red del visitante no haga parecer caído un sitio que está bien.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Contenido: hero, registro de subdominios, proyectos, contacto |
| `styles.css` | Tokens y estilos, con modo oscuro por `prefers-color-scheme` |
| `main.js` | Comprobación de estado de cada subdominio y año del pie |

## Ver en local

```bash
python -m http.server 8000
```

## Sitios de la zona

| Subdominio | Qué es | Hosting |
| --- | --- | --- |
| `kgstudio.top` | Este hub | Vercel |
| `portafolio.` | Portafolio personal | Vercel |
| `parla.` | Intérprete en vivo ES⇄EN | Vercel |
| `arriendos.` | Gestión de arriendos (privado) | Vercel |
| `pc.` | Soporte de computadores | GitHub Pages |
