# Prácticas de la zona kgstudio.top

Convenciones que aplican a **todos** los repos de la zona: el hub, portafolio,
parla, reinicia, arriendos, monetiq, pagobot, examia, itep y los sitios de
cliente.

Este archivo tiene dos partes. Arriba, cómo se hacen las cosas. Abajo, el
registro de lo que ya salió mal, con la corrección. Lo segundo es lo que evita
repetir: cada vez que algo falle, se anota ahí y deja de ser una sorpresa.

---

## Escritura

### Nada de rayas largas

No se usa `—` (em dash, U+2014) ni `–` (en dash, U+2013). Se usa el guion normal
`-`.

Aplica a todo el contenido: HTML, JSX/TSX, strings de JavaScript, meta tags,
JSON-LD, `llms.txt` y textos de la interfaz.

La raya larga es un tic de texto generado por modelos de lenguaje. Un sitio
lleno de rayas se lee como escrito por una máquina, que es exactamente lo
contrario de lo que busca una marca personal.

```
mal:  Cinco secciones — Grammar, Listening, Reading — con tiempos reales.
bien: Cinco secciones (Grammar, Listening, Reading) con tiempos reales.
bien: Cinco secciones - Grammar, Listening, Reading - con tiempos reales.
```

### Acentos desde el principio

El contenido en español va con acentos correctos: `ferretería`, `Bogotá`,
`también`, `módulo`. Todos los archivos son UTF-8.

No se escribe sin acentos "para arreglarlo después". Se escribe bien de una vez.

---

## SEO

Lo mínimo que lleva **cada** sitio de la zona antes de considerarse publicado:

| Qué | Dónde |
| --- | --- |
| `<title>` y `<meta name="description">` | `index.html` |
| `<link rel="canonical">` | `index.html` |
| Open Graph completo con medidas de imagen | `index.html` |
| `@graph` JSON-LD citando `https://kgstudio.top/#kevin` | `index.html` |
| `robots.txt` con los rastreadores de IA nombrados | raíz del build |
| `sitemap.xml` con `lastmod` real | raíz del build |
| `llms.txt` en prosa | raíz del build |
| Favicon propio | raíz del build |

### El grafo de entidades

El hub es la fuente de verdad de la identidad. Declara cuatro `@id` estables y
ningún otro sitio los vuelve a describir: solo los citan.

| `@id` | Qué es |
| --- | --- |
| `https://kgstudio.top/#kevin` | Kevin Gonzalez, la persona |
| `https://kgstudio.top/#kagonzalezdev` | La marca personal |
| `https://kgstudio.top/#kgstudio` | El negocio, el de la ficha de Maps |
| `https://kgstudio.top/#website` | El sitio |

Cuando publiques un sitio nuevo en la zona, su JSON-LD cita
`{ "@id": "https://kgstudio.top/#kevin" }` en `author`, y el hub gana una
entrada en su `ItemList`. Esa referencia cruzada es lo que hace que un asistente
que resuma cualquier página de la zona sepa de quién es. Sin ella, cada
subdominio es un desconocido más.

### Un dato, dos lugares

Si cambias un dato de identidad (nombre, teléfono, dirección, descripción),
cámbialo en el HTML **y** en `llms.txt`. Se contradicen en silencio.

Para el negocio, el nombre y la dirección tienen que decir exactamente lo mismo
aquí, en el sitio y en la ficha de Google Business. Google compara los tres
textos; si uno difiere, no une la ficha del mapa con el sitio.

---

## Registro de fallos

Cada entrada: qué pasó, por qué estaba mal, qué se hace en su lugar.

### 2026-08-31 - Rayas largas en todo el contenido generado

**Qué pasó.** 776 em-dashes y 15 en-dashes repartidos en 251 archivos de los
once repos.

**Por qué está mal.** Es la huella más reconocible de texto generado por IA.

**Qué se hace.** Guion normal `-`, desde el primer borrador. Ver arriba.

### 2026-08-31 - Escribir sin acentos y corregir después

**Qué pasó.** Meta tags y comentarios de CSS escritos como `ferreteria`,
`Bogota`, `modulo`, y arreglados en un segundo paso.

**Por qué está mal.** Un paso de arreglo es un paso que se puede olvidar, y si
se olvida queda un `description` sin acentos que es justo lo que ve Google.

**Qué se hace.** Acentos correctos en el primer intento.

### 2026-08-31 - `summary_large_image` con una imagen cuadrada

**Qué pasó.** El hub declaraba `twitter:card` como `summary_large_image`
apuntando a `photo.jpg`, que es 640x640.

**Por qué está mal.** Esa tarjeta recorta a 2:1. Un retrato cuadrado pierde la
frente y el mentón: la cara sale partida.

**Qué se hace.** `summary_large_image` solo con una imagen 1200x630. Con una
cuadrada, `summary`. Y siempre declarar `og:image:width` y `og:image:height`,
para que WhatsApp y LinkedIn no recorten a su criterio.

### 2026-08-31 - SPA publicada sin nada que rastrear

**Qué pasó.** `itep` es una app de Vite: el HTML servía un `<div id="app">`
vacío y todo lo pintaba JavaScript. No tenía `description`, ni canonical, ni
JSON-LD.

**Por qué está mal.** Un rastreador que no ejecuta JavaScript (y son casi todos
menos Google) no encontraba ni una palabra. El sitio existía y era invisible.

**Qué se hace.** En cualquier SPA de la zona, `index.html` lleva contenido
estático dentro del contenedor raíz, diciendo lo mismo que la portada real. La
app lo reemplaza al montar, así que no es contenido oculto ni engaña a nadie:
sirve de `noscript` y de primer pintado. Más el `@graph` y el `llms.txt`, que no
dependen del bundle.

### 2026-08-31 - README apuntando a una infraestructura que ya no existe

**Qué pasó.** El README de `itep` mandaba a desplegar en Netlify, clonaba un
repo `ITEP-EXAM` que ya no existe y daba el puerto 5173 cuando `vite.config.js`
fija el 3000.

**Por qué está mal.** Es la primera página que ve alguien que llega al repo, y
cada dato falso cuesta una prueba fallida.

**Qué se hace.** Cuando se migre el despliegue o se renombre un repo, el README
va en el mismo commit. Los comandos del README se ejecutan antes de darlos por
buenos.

### 2026-08-31 - `sitemap.xml` con `lastmod` congelado

**Qué pasó.** El sitemap de AGD decía `2026-08-14` meses después del último
cambio real, y el del hub no tenía `lastmod`.

**Por qué está mal.** `lastmod` le dice a Google cuándo vale la pena volver. Una
fecha vieja pide que no vuelva; ninguna fecha no dice nada.

**Qué se hace.** Actualizar `lastmod` en el mismo commit que cambia el
contenido. Si el sitio cambia seguido, generarlo en el build.

### 2026-08-31 - Bloque de contacto sin enlaces internos

**Qué pasó.** El pie de AGD tenía teléfonos y NIT, pero ni un enlace a las
secciones de la página.

**Por qué está mal.** El pie es donde cae un rastreador después de leer todo. Si
no hay a dónde seguir, la visita termina ahí.

**Qué se hace.** El pie lleva el índice de secciones en texto enlazado.

### 2026-08-31 - Un teléfono en el pie que el schema no conocía

**Qué pasó.** AGD mostraba dos números en el pie, pero el JSON-LD solo declaraba
uno.

**Por qué está mal.** Google arma la ficha con lo que declara el schema. El
segundo número, para efectos de búsqueda, no existía.

**Qué se hace.** Todo dato de contacto visible en la página va también en el
JSON-LD, con `contactPoint` si hay más de uno.

### 2026-08-31 - Borrar CSS sin mirar quién más lo usaba

**Qué pasó.** Al quitar la generación con IA de `itep` se borraron las clases
`.lnd-gen-msg`, `.lnd-gen-ok` y `.lnd-gen-error`. La pantalla de chequeo de
micrófono también las usaba, así que se quedó sin estilos y nadie se dio cuenta:
la página seguía cargando.

**Por qué está mal.** Un nombre apellidado por una función (`gen`) hace creer que
solo esa función lo usa. Y borrar CSS no rompe nada de forma visible, así que el
fallo viaja hasta producción.

**Qué se hace.** Antes de borrar una clase, buscarla en todo el proyecto. Si la
comparten dos pantallas, se renombra a algo que no mienta sobre su dueño: aquí
pasó a `.lnd-msg`, `.lnd-msg-ok`, `.lnd-msg-error`.

### 2026-08-31 - Estado de formulario viviendo solo en el DOM

**Qué pasó.** El textarea para pegar un examen leía su valor con
`getElementById(...).value`. Como cada acción reconstruye el `innerHTML`, un
error de importación borraba lo que la persona acababa de pegar.

**Por qué está mal.** En una app que repinta por `innerHTML`, todo lo que esté
solo en el DOM se pierde en el siguiente render. Y se pierde justo cuando más
duele: después de un error, que es cuando el usuario quiere corregir, no volver
a empezar.

**Qué se hace.** Lo que el usuario escribe va al estado con un listener de
`input`, y el render lo repone. Lo mismo aplica a un `<details>` abierto, un
scroll o una pestaña seleccionada.

### 2026-08-31 - Dar por bueno un cambio de interfaz sin ejecutarlo

**Qué pasó.** Se reescribió toda la portada de `itep` y se dio por buena con
`node --check` y `npm run build`. Ninguna de las dos ejecuta la interfaz: la
primera valida sintaxis, la segunda empaqueta. Los dos fallos de arriba
sobrevivieron a ambas.

**Por qué está mal.** Compilar no es funcionar. Una plantilla de cadena con un
`data-action` mal escrito compila, empaqueta y no hace nada al pulsarla.

**Qué se hace.** Las apps de la zona con lógica de interfaz llevan una prueba que
monta la página en jsdom y pulsa los botones. En `itep` es `npm test`. Se corre
antes de cada push.

### 2026-08-31 - Un importador "generoso" que rechazaba el formato de la casa

**Qué pasó.** El importador de `examia` acepta claves en español y en inglés,
opciones de tres formas y la respuesta por letra, índice o texto. Pero no
aceptaba el banco de `quiz-engine`, que es el formato en el que Kevin ya tenía
preguntas escritas: enunciado en `text`, opciones como pares `["A","texto"]` y
el archivo en `.js` con `let RAW = [`.

**Por qué está mal.** La tolerancia se había medido contra formatos imaginados
(lo que devuelve un modelo, lo que exporta otro simulador) y no contra los
archivos que existen de verdad en los repos de al lado.

**Qué se hace.** Antes de dar por bueno un importador, se prueba con un archivo
real del propio ecosistema, sin editarlo. En `examia` esa prueba lee
`quiz-engine/preguntas.js` directamente.

### 2026-08-31 - Cortar un archivo .js asumiendo que solo trae datos

**Qué pasó.** Al leer `preguntas.js` se quitó la envoltura `let RAW =` y se
mandó el resto al parser. El archivo real no termina en el array: sigue con las
funciones del motor, y el parser se atragantó con el primer `;`.

**Por qué está mal.** Un archivo de datos en `.js` casi nunca es solo datos.

**Qué se hace.** Se recorta el primer literal contando corchetes, saltando
cadenas -con sus escapes- y comentarios, y se tira lo que venga detrás. Un
escáner, nunca `eval` ni `new Function`: el archivo lo sube un usuario, y
ejecutarlo en el servidor sería darle la máquina.
