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

## Identidad y correo

La zona tiene **una sola identidad**. Los sitios que piden cuenta -parla,
examia y autoreel- comparten `auth.users` del proyecto de Supabase
`supabase-crimson-drum`, provisto por la integración del Marketplace de Vercel.
Quien se registra en uno entra en los otros con la misma clave y empieza sin
datos, porque cada fila cuelga de su `owner_id`.

`arriendos` es la excepción y conviene saberlo antes de tocar nada: no usa el
sistema de correo de Supabase. Entra por PIN y firma su propio JWT con el
secreto del proyecto. Cambiar la configuración de correo no le afecta.

`monetiq` va aparte: apunta a otro proyecto de Supabase, con su propia
configuración.

### Un esquema por proyecto

La base es compartida. Lo que mantiene separados a los proyectos es el esquema,
y cada uno tiene el suyo:

| Esquema | Proyecto | Cómo lo consulta |
| --- | --- | --- |
| `parla` | parla | PostgREST (`supabase.from(...)`) |
| `exams` | examia | Postgres directo (`pg`) |
| `arriendos` | arriendos | PostgREST |
| `autoreel` | autoreel | Postgres directo |
| `pagobot` | pagobot | Postgres directo |
| `auth` | la identidad, compartida por todos | Supabase Auth |
| `public` | **nadie**: solo la extensión btree_gist | - |

**Un proyecto nuevo crea su esquema y no toca `public`.** Sus migraciones viven
en `db/migrations/` del propio repo y se aplican con su `db:push`, que registra
lo aplicado en `<esquema>.schema_migrations`. Nunca con `supabase config push`:
ese empuja el config entero y pisa la configuración de los demás, cosa que ya
pasó una vez.

Para no calificar cada consulta a mano, el esquema se fija en el `search_path`
de la conexión (ver `autoreel/db/conexion.mjs`). `public` se deja detrás en la
lista, porque ahí viven las extensiones.

#### Cuando el proyecto habla por PostgREST

PostgREST solo expone `public` salvo que se le diga otra cosa, y por eso parla y
arriendos empezaron fuera de su sitio. Mover un proyecto así cuesta poco si el
esquema se declara **en el cliente**:

```ts
createClient(url, key, { db: { schema: 'parla' } })
```

Así los `.from(...)` repartidos por la app no se tocan: eran más de cuarenta en
parla. Lo que sí hay que hacer aparte, y sin ello no funciona nada:

1. Exponer el esquema en la API (`db_schema` de PostgREST).
2. `grant usage on schema` a `anon`, `authenticated` y `service_role`. Sin lo
   primero PostgREST contesta `Invalid schema`; sin lo segundo,
   `permission denied`, y `service_role` salta RLS pero no los permisos de
   Postgres.

### Quién manda los correos: el hook, no Supabase

El proyecto tiene activado un **Send Email Hook** que apunta a
`parla.kgstudio.top/api/auth/email-hook`. Supabase no envía nada: llama a ese
endpoint y este compone el correo y lo manda por el SMTP de Brevo.

No es un rodeo caprichoso. Las plantillas de correo de Supabase son UNA para
todo el proyecto, y el proyecto lo comparten tres productos. El hook es el
único sitio donde el correo puede llevar la marca del producto en el que la
persona se está registrando; la tabla de marcas vive en
`parla/app/api/auth/email-hook/sitios.ts` y el sitio se deduce del host de
`redirect_to`.

Consecuencia práctica: si el hook falla, `signUp` falla. Eso es deliberado
-más vale un registro que no pasa que una cuenta creada sin su correo-, y de
paso convierte cualquier registro real en una prueba de que el envío funciona.

### La configuración de correo también es una

SMTP, plantillas, caducidad de los enlaces y la lista de URLs de retorno son
del proyecto entero, no de cada sitio. Lo que se cambia para uno se cambia para
los tres. Se aplica con `scripts/configurar-correo.mjs`, que sin `--aplicar`
solo enseña lo que hay y lo que va a poner.

El correo sale por **Brevo** (`smtp-relay.brevo.com:587`), no por el servidor
compartido de Supabase: ese manda unos pocos correos por hora para todo el
proyecto, y con eso la confirmación no llega.

### Una cuenta sin correo confirmado no se puede recuperar

Todo sitio con cuentas lleva las dos piezas juntas: confirmar el correo al
registrarse y recuperar la contraseña por correo. No son dos funciones
independientes -la segunda depende de la primera-, porque sin una dirección
verificada no hay a dónde mandar el enlace con la certeza de que llega a su
dueño.

El registro se escribe siempre así, mirando lo que devuelve `signUp`:

```
if (data.user && data.session) -> adentro, la confirmación está apagada
else                           -> a "revisa tu correo"
```

Escrito de esa forma, encender o apagar la confirmación en Supabase no obliga a
tocar el código ni a volver a desplegar.

### El orden importa: primero el SMTP, después el despliegue

examia y autoreel creaban las cuentas con `admin.createUser` y
`email_confirm: true`, o sea dando el correo por bueno sin comprobarlo. No era
un descuido: era el apaño para que el registro funcionara cuando la
confirmación no llegaba.

Por eso cambiar ese código a `signUp` **antes** de tener el SMTP funcionando
rompe el registro de los dos sitios: se enciende la verificación y no hay quién
entregue el correo. Se configura el servidor de correo primero, se comprueba con
un registro de verdad, y solo entonces se despliega el código nuevo.

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

### 2026-08-31 - Una rama de la interfaz que solo existia en un modo

**Qué pasó.** En el runner de `examia`, marcar una opción en una pregunta de
varias respuestas solo guardaba la selección en el estado de React. Lo que la
mandaba al servidor era el botón "Comprobar", y ese botón solo se pintaba en
modo práctica. En simulacro no existía, así que la respuesta se quedaba en el
navegador y la pregunta se entregaba en blanco.

**Por qué está mal.** El código leía bien: "las de varias respuestas no se
corrigen hasta pulsar Comprobar" es correcto para práctica, y el `return`
parecía inofensivo. Nadie lo probó en el otro modo, que es justo donde el
botón no está.

**Qué se hace.** Cuando una acción dependa del modo, se recorre el flujo
completo en **cada** modo, no solo en el que se estaba escribiendo. Y si una
rama termina en `return` sin guardar, hay que preguntarse quién guarda
entonces, y si ese quién existe siempre.

### 2026-08-31 - Escribir sin acentos otra vez, con la regla ya escrita

**Qué pasó.** Al reescribir el lanzador de `examia` salieron "presion",
"estas listo", "Cuantas", "salio", "posicion" y ocho más, en texto que ve el
usuario. La regla llevaba escrita en este mismo archivo desde el mismo día.

**Por qué está mal.** Tener la regla escrita no sirve de nada si no se lee
antes de escribir, y menos cuando se genera un bloque grande de una vez.

**Qué se hace.** Al terminar un archivo con texto en español, se pasa un grep
por las palabras que suelen perder la tilde antes de dar nada por hecho.

### 2026-08-31 - Un dominio de marcador de posición que llegó a producción

**Qué pasó.** El portafolio construía todo su SEO a partir de
`process.env.NEXT_PUBLIC_SITE_URL ?? "https://revkelo.dev"`. Esa variable no
estaba puesta en Vercel, así que producción servía el `canonical`, el `og:url`,
el `og:image`, el sitemap entero y los tres `@id` del JSON-LD apuntando a
`revkelo.dev`. Ese dominio **no resuelve**.

**Por qué está mal.** Es el peor fallo de SEO posible y no se ve mirando la
página: un `canonical` a otro dominio le dice a Google que la página buena es
una copia, así que la buena deja de indexarse. El sitemap listaba URLs de otro
host, y un sitemap que declara URLs ajenas se descarta entero. Y la imagen de
las tarjetas de WhatsApp y LinkedIn apuntaba a un servidor que no contesta.

**Qué se hace.** Un valor por defecto es lo que se va a desplegar, así que
nunca es un marcador de posición: se pone el dominio real, y la variable de
entorno queda para sobreescribirlo, no para hacerlo funcionar. Y antes de dar
por bueno el SEO de un sitio, se pide el HTML **de producción** con `curl` y se
lee el `canonical` que sirve de verdad, en vez de leer el código y suponer.

### 2026-08-31 - El middleware mandaba a robots.txt y al og:image al login

**Qué pasó.** El matcher del proxy de examia excluía los estáticos por
extensión (`.svg`, `.png`…) pero no `robots.txt`, `sitemap.xml`, `llms.txt` ni
la ruta `/opengraph-image`. Como ninguna lleva sesión, el proxy las respondía
con un 307 a `/entrar`.

**Por qué está mal.** No se ve desde el sitio y anula el SEO entero: Google no
podía leer el robots ni el sitemap por muy bien escritos que estuvieran, y
cada enlace compartido en WhatsApp o LinkedIn salía sin imagen, porque la
tarjeta pedía la imagen y recibía una redirección al formulario de acceso.

**Qué se hace.** El matcher del middleware excluye explícitamente lo que piden
los robots y las redes sociales. Y se comprueba con `curl` que devuelven 200,
no leyendo la lista de rutas públicas: la lista decía lo correcto y el matcher
igual las interceptaba antes de llegar a ella.

### 2026-08-31 - `startsWith('/')` no basta para validar un destino

**Qué pasó.** El formulario de acceso de examia leía a dónde volver de la URL
y lo aceptaba si empezaba por `/`. `//otro-sitio.com` empieza por `/`, y el
navegador la lee como una URL de otro dominio.

**Por qué está mal.** Es un redirector abierto colgando del formulario de
acceso, que es exactamente la pieza que hace falta para un enlace de phishing
convincente: sale del dominio de verdad y aterriza en una copia con el mismo
formulario.

**Qué se hace.** Un destino de vuelta se rechaza si empieza por `//` o por
`/` seguido de barra invertida. En general: si un valor viene de la URL, viene
de fuera, y "empieza por" nunca es una validación completa.

### 2026-09-01 - Crear cuentas dando el correo por bueno

**Qué pasó.** examia y autoreel registraban con `admin.createUser` y
`email_confirm: true`: la cuenta nacía con el correo marcado como verificado sin
que nadie lo hubiera comprobado.

**Por qué está mal.** Dos cosas, y la segunda es peor que la primera.
Cualquiera podía registrarse con un correo ajeno y quedarse con esa dirección
para siempre, porque el dueño real ya no podía usarla. Y ninguna de esas cuentas
se podía recuperar: sin dirección verificada no hay a dónde mandar el enlace, así
que olvidar la contraseña significaba perder la cuenta.

**Qué se hace.** `signUp` y confirmación de verdad, con un SMTP propio que
entregue. Y las dos piezas se montan juntas: si un sitio pide cuenta, lleva
confirmación y recuperación, no una sola.

### 2026-09-01 - El certificado del relay de Brevo no dice "brevo"

**Qué pasó.** Al comprobar las credenciales SMTP contra
`smtp-relay.brevo.com`, la conexión TLS falló con `ERR_TLS_CERT_ALTNAME_INVALID`:
el servidor presenta un certificado de `smtp-relay.sendinblue.com`, el nombre
anterior de Brevo.

**Por qué importa.** Leído rápido parece que las credenciales están mal o que
hay alguien en medio. No es ninguna de las dos: es el nombre viejo, que sigue en
el certificado. Autenticando contra ese nombre, Brevo contestó
`235 Authentication succeeded`.

**Qué se hace.** Antes de cablear unas credenciales de correo en cuatro sitios,
se prueban solas contra el servidor. Y si el fallo es de nombre de certificado,
se mira cuál presenta de verdad antes de concluir que la clave es incorrecta.

### 2026-09-01 - Enlaces de correo apuntando a localhost

**Qué pasó.** La `site_url` del proyecto de Supabase era
`http://127.0.0.1:3000` y la lista de redirecciones permitidas tenía una sola
entrada, `https://127.0.0.1:3000`.

**Por qué está mal.** Supabase usa `site_url` como destino de los enlaces del
correo cuando el `redirectTo` que pide la app no está en la lista de
permitidas. Como no lo estaba ninguno, TODOS los enlaces de confirmación y
recuperación de la zona llevaban a una dirección que solo existe en la máquina
de quien la escribió. El correo salía, llegaba, y el enlace no iba a ninguna
parte.

**Qué se hace.** La lista de permitidas incluye una entrada por sitio con
comodín que cubra la query: `https://sitio/auth/callback**`, además de
`https://sitio/**`. Los comodines casan segmentos de ruta y el `?` no lo es, así
que sin esa entrada el destino con `?next=…` se descarta en silencio. Y se
comprueba siguiendo un enlace de verdad, no leyendo la configuración.

### 2026-09-01 - Un enlace de correo llega de tres formas, no de una

**Qué pasó.** Los tres callbacks de la zona solo entendían `?code=`. Un enlace
con el token en el fragmento (`#access_token=…`) los dejaba en la puerta con un
error. En confirmación era feo, porque la cuenta sí quedaba confirmada; en
recuperación era peor, porque nunca se llegaba al formulario de contraseña
nueva.

**Por qué está mal.** El fragmento de una URL no viaja al servidor: el
navegador se lo queda. Una ruta de servidor no puede leerlo por definición, así
que no hay forma de arreglarlo ahí.

**Qué se hace.** El callback entiende `?code=` (PKCE), `?token_hash=` (la
plantilla con `{{ .TokenHash }}`) y, si no hay ninguno, reenvía a una página
cliente que sí ve el fragmento y llama a `setSession`. El fragmento sobrevive a
la redirección porque el navegador lo conserva.

### 2026-09-01 - El certificado de Brevo depende de la región

**Qué pasó.** Probando el SMTP desde Bogotá, el relay sirvió un certificado de
`smtp-relay-offshore-southamerica-east-v2.sendinblue.com`, que no incluye
`smtp-relay.brevo.com` entre sus nombres. Se dedujo que había que verificar
contra el nombre viejo y se fijó `servername: smtp-relay.sendinblue.com`.

**Por qué está mal.** Desde us-east, que es donde corre la función, Brevo sirve
`smtp-relay-offshore-us-east1-v2.brevo.com`, y ese SÍ incluye
`smtp-relay.brevo.com`. El apaño que arreglaba la prueba local era exactamente
lo que rompía el envío en producción: el registro dejó de funcionar en los tres
sitios a la vez.

**Qué se hace.** No se fuerza el nombre del certificado. Y una conclusión sacada
de una prueba local contra un servicio con nodos por región es una hipótesis, no
un hecho: se confirma en el entorno donde va a correr el código.

### 2026-09-01 - El correo de un sitio con la marca de otro

**Qué pasó.** El Send Email Hook componía siempre el correo de parla. Quien
creaba una cuenta en examia recibía "Confirma tu cuenta de parla", con el
logotipo y el pie de parla.

**Por qué está mal.** Un correo con una marca que no es la del sitio donde
acabas de registrarte se lee como phishing, que es justo lo contrario de lo que
tiene que transmitir el correo que pide confirmar una dirección.

**Qué se hace.** El hook deduce el sitio del host de `redirect_to` y usa su
marca, sus colores y sus textos. Cuando se añada un sitio con cuentas a la zona,
se añade también su entrada en `sitios.ts`; si falta, cae en parla y el fallo
vuelve.

### 2026-09-01 - monetiq listado en un proyecto al que no pertenece

**Qué pasó.** La configuración de correo de `supabase-crimson-drum` declaraba
`monetiq.kgstudio.top` entre las URLs de retorno permitidas. monetiq no usa ese
proyecto: tiene el suyo, con su propio `auth.users`.

**Por qué está mal.** No rompía nada, y por eso es peligroso: hacía creer que
monetiq quedaba cubierto por esa configuración de correo cuando no lo estaba.
Una entrada que no conecta nada pero parece que sí es peor que no tenerla.

**Qué se hace.** La lista de sitios de `scripts/configurar-correo.mjs` incluye
solo a los que de verdad comparten esa identidad. Si un proyecto vive en otro
Supabase, se dice dónde, en vez de listarlo aquí por si acaso.

### 2026-09-01 - Cambiar la configuración antes de confirmar la migración

**Qué pasó.** Al mover parla a su esquema, la migración falló y revirtió sola
-bien-, pero la configuración de PostgREST ya se había cambiado para apuntar al
esquema nuevo, que por el rollback no existía. parla se quedó sirviendo contra
un esquema inexistente hasta que se revirtió a mano.

**Por qué está mal.** La transacción protege la base, no lo de fuera. Un
`PATCH` a la API de configuración no participa de ese rollback, así que un
fallo dentro de la transacción dejó el sistema en un estado que ninguna de las
dos mitades había previsto.

**Qué se hace.** Primero la migración, luego se comprueba que aplicó, y solo
entonces se toca lo de fuera: la configuración de la API y el despliegue. El
orden inverso solo parece más rápido.

### 2026-09-01 - `CREATE FUNCTION` resuelve los tipos con el search_path de quien lo ejecuta

**Qué pasó.** Al recrear las funciones de parla en el esquema nuevo, todas
fallaron con `type user_role does not exist`, aunque el tipo se acababa de
mover a ese mismo esquema y la función declaraba
`SET search_path TO 'parla', 'public'`.

**Por qué está mal.** Ese `SET search_path` de la función aplica cuando la
función **se ejecuta**, no cuando se crea. Los tipos de la firma se resuelven
al crearla, contra el `search_path` de la sesión que lanza el `CREATE`.

**Qué se hace.** `set local search_path = <esquema>, public` en la sesión de la
migración, antes de crear funciones que usen tipos propios.

### 2026-09-01 - Mover un esquema no arregla lo que está escrito como texto

**Qué pasó.** `ALTER ... SET SCHEMA` conserva datos, índices, claves foráneas,
políticas y triggers, porque Postgres guarda esas referencias por OID. Pero
las funciones que fijaban `search_path` y escribían `rentals.settings` o
`public.profiles` en el cuerpo siguieron apuntando a esquemas que ya no
existían.

**Por qué está mal.** Sobreviven al ALTER sin protestar y fallan después, al
ejecutarse. En arriendos era la que da el consecutivo de facturas, y su fallo
es silencioso por diseño: devuelve null y la factura sale sin número.

**Qué se hace.** Antes de mover un esquema, se revisan los cuerpos de sus
funciones buscando nombres de esquema escritos a mano, y se recrean. Y después
se ejecuta una de cada tipo, no solo se cuenta que las tablas llegaron.

### 2026-09-01 - Una prueba que borró datos de producción

**Qué pasó.** La prueba automática del modo salas de examia necesitaba un
examen del que la cuenta de prueba fuera dueña, porque solo el dueño puede
abrir una sala. En vez de crear uno, cogió uno real y le cambió el `owner_id` a
la cuenta desechable. Al terminar, la prueba borró esa cuenta, y el
`on delete cascade` de `exam_sets.owner_id` se llevó el examen con todas sus
preguntas.

Se corrió tres veces. Se perdieron **cuatro bancos de preguntas, 106 preguntas,
3 intentos y 64 respuestas**. No hay vuelta atrás: el plan gratuito de Supabase
no tiene copias (`pitr_enabled: false`, `backups: []`), y el respaldo que se
había hecho esa misma mañana cubría `public`, `core` y `rentals` -los esquemas
que se iban a migrar- pero no `exams`.

**Por qué está mal.** Dos decisiones, y la segunda es la que convirtió un
descuido en pérdida.

La primera: una prueba escribió sobre datos que no creó ella. Reasignar el
dueño de una fila real es una escritura destructiva disfrazada de preparación.

La segunda: el respaldo se limitó a lo que se iba a tocar. Eso suena prudente y
es justo lo contrario, porque lo que rompe casi nunca es lo que estabas
mirando. Respaldar tres esquemas de cinco costaba lo mismo que respaldar los
cinco: 978 KB.

**Qué se hace.**

1. Una prueba **crea sus propios datos** y no reutiliza ninguno existente, ni
   siquiera "prestado". Si necesita ser dueña de algo, lo insertó ella.
2. El respaldo cubre **todos** los esquemas de la base, no los del cambio en
   curso. Está en `scripts/` y tarda segundos.
3. Antes de cualquier sesión que escriba en producción, se corre el respaldo.
   Con Supabase en plan gratuito no hay red debajo: el volcado a JSON es la
   única copia que existe.

### 2026-09-02 - Un banco de pruebas que no reproducia el fallo

**Qué pasó.** La carretera del modo carrera de examia no se dibujaba: se veía
el cielo y la hierba, y nada más. Para aislarlo se montó el mismo renderizador
en una página suelta y ahí funcionaba perfecto, con la misma matemática y los
mismos colores. Se cambiaron la paleta, el primer trapecio, la escala de las
curvas y el límite lateral, y ninguno era la causa.

Lo que lo resolvió fue dejar de razonar y hacer que el propio juego dijera qué
calculaba: un diagnóstico temporal en producción que exponía la posición de los
primeros segmentos. El primero tenía `z = -110`, o sea que estaba **detrás de la
cámara**. Con z negativo la escala se invierte, la `y` sale negativa, y como una
`y` negativa también cumple "menor que el alto del lienzo", se tomaba como
primer segmento visible; desde esa referencia imposible todos los demás
quedaban descartados.

**Por qué el banco de pruebas no lo vio.** Se le pasó una posición que era
múltiplo exacto del largo de segmento, y ahí `z` empieza en 1. El fallo solo
aparece cuando la posición cae en mitad de un segmento, que es lo que ocurre
siempre en movimiento.

**Qué se hace.** Un banco de pruebas se alimenta con valores del caso real, no
con los redondos que uno elige sin pensar: un múltiplo exacto es justo el caso
que no se da nunca en producción. Y cuando el aislamiento contradice a la
realidad, la respuesta no es seguir cambiando cosas: es instrumentar el entorno
donde falla y leer los números.

### 2026-09-02 - Una comprobación que medía ceros sobre un lienzo WebGL

Al pasar la carrera de examia a Three.js, la comprobación automática dijo que el
lienzo pintaba 0% de asfalto. El juego se veía perfectamente en pantalla.

`readPixels` sobre un lienzo WebGL devuelve ceros: el buffer de dibujo se vacía
al componer el cuadro, salvo que se pida `preserveDrawingBuffer`, que cuesta
rendimiento y no se va a activar solo para poder medir. La comprobación no
estaba mirando el juego, estaba mirando un buffer ya vaciado.

**Qué se hace.** Se mide sobre una captura de pantalla, que es un PNG normal y
se lee con un canvas 2D. Es además lo que se quiere comprobar: lo que el usuario
acaba viendo, no lo que hay en un buffer intermedio.

### 2026-09-02 - Un umbral de color que hacía pasar la prueba sin mirar nada

En esa misma comprobación, "las líneas blancas se dibujan" pasaba con un 0,02%
de píxeles: unos cien en toda la pantalla. Pasaba porque el listón era `> 0`.

La causa: se buscaba el blanco por su valor de origen, `0xf4f7fa`, pero la luz
de la escena lo oscurece hasta un gris claro que ya no cae dentro de la
tolerancia. Se estaba contando el ruido del antialiasing, no las líneas.

**Qué se hace.** Un umbral de `> 0` no es una comprobación, es una casilla que
se marca sola. Cuando un porcentaje sale muchísimo más bajo de lo que se ve en
la captura, el sospechoso es la medida y no el dibujo. Aquí el blanco se busca
por "claro y sin color" -mínimo alto, poca diferencia entre canales- y el listón
se sube a un valor que fallaría de verdad si las líneas desaparecieran.

### 2026-09-02 - Un acento grave dentro de una plantilla de cadena

Al comentar un `shader` de GLSL, que vive dentro de una plantilla de cadena de
JavaScript, se escribió `` `h` `` para citar una variable. Ese acento grave
cierra la plantilla a media línea, y el archivo dejó de compilar con un
`Expected ',', got 'ident'` que apuntaba al comentario y no al motivo.

**Lo grave no fue el error, fue no leerlo.** La salida de la compilación se pasó
por un `grep -c` que devolvió `2`, y ese `2` se dio por ruido en vez de mirarlo.
Con el `build` roto se lanzó igualmente un despliegue.

**Qué se hace.** Dentro de una plantilla de cadena no se citan cosas con acentos
graves; se usan comillas o nada. Y la salida de una compilación se lee, no se
cuenta: un contador convierte un fallo en un número que parece inofensivo.

### 2026-09-02 - El cielo salía negro y la niebla del mismo color salía azul

El cielo de la carrera es una esfera con un `ShaderMaterial` escrito a mano. Se
veía casi negro, aunque su color y el de la niebla eran exactamente el mismo
número. La niebla sí salía azul.

Three.js entrega los colores de los `uniforms` en espacio lineal y solo añade la
conversión de salida a sRGB a los materiales de la librería. A un
`ShaderMaterial` propio no se la añade nadie: el valor lineal se pinta tal cual
y aparece mucho más oscuro que su código. La pista lo enseñaba servido en
bandeja, porque el mismo color pintado por los dos caminos daba dos colores.

**Qué se hace.** Todo `ShaderMaterial` que escriba un color termina con
`#include <colorspace_fragment>`. Y cuando el mismo valor se ve distinto en dos
sitios, el sospechoso es la conversión, no el valor.

### 2026-09-02 - Un suavizado convertido a ojo movió la cámara a otro sitio

El suavizado de la cámara pasaba de "multiplicar por 0.24 cada cuadro" a una
forma que no depende de los cuadros. La constante nueva se puso a ojo, `2e-5`, y
resultó ser tres veces más lenta: la cámara se quedaba tan atrás que en las
curvas se ponía al costado del coche y se veía el lateral en vez de la pista.

La cuenta era de una línea. Si por cuadro queda sin recorrer `1 - 0.24` y hay
sesenta cuadros, tras un segundo queda `0.76^60`, o sea `5e-8`.

**Qué se hace.** Cuando se cambia la forma de un parámetro que ya estaba
ajustado, el valor nuevo se saca de la conversión y se comprueba que reproduce
el viejo en el caso conocido. Cambiar la unidad y volver a ajustar a ojo tira el
ajuste anterior sin decirlo.

### 2026-09-02 - Medir el juego en headless era medir el render por software

La comprobación de tirones daba números malísimos y constantes. En `headless` el
navegador dibuja por software: siempre sale lento, vaya el juego como vaya.

**Qué se hace.** El rendimiento se mide con ventana de verdad, que es lo que usa
la GPU, y se mira el **percentil 99** de los tiempos entre cuadros, no la media:
un juego que va a 60 y se para 200 ms una vez por segundo tiene una media
estupenda y se siente fatal. Lo que se nota es el peor cuadro.

### 2026-09-02 - Una velocidad estimada contra la propia predicción

En la carrera con amigos, cada jugador avisa por dónde va cada dos segundos y
medio, y entre avisos se le sigue moviendo a la velocidad que se le estima. La
velocidad se calculaba restando el aviso nuevo menos `tObjetivo`.

`tObjetivo` es la posición predicha, o sea que ya llevaba sumada la predicción
anterior. Restar contra él no mide lo rápido que va el amigo: mide **cuánto se
equivocó la predicción**. Y ahí está lo perverso: cuanto mejor acertaba, más
cerca de cero salía el avance medido, más cerca de cero se ponía la velocidad
nueva, y el coche acababa **parándose en seco justo cuando todo iba bien**.

Costó verlo porque el síntoma era al revés de lo que uno busca: se probaron
primero los casos raros -reinicios, avisos desordenados- cuando el que fallaba
era el caso perfecto.

**Qué se hace.** Una medida se toma siempre contra el dato en crudo que llegó,
nunca contra un valor derivado de la propia estimación. Si el resultado de un
cálculo entra en su propia entrada, ya no se está midiendo el mundo. Y cuando
un fallo aparece "cuando todo va bien", el sospechoso es una realimentación.

### 2026-09-02 - Un sondeo que avisaba antes de que hubiera algo que avisar

**Qué pasó.** La pantalla de carrera en sala de `examia` le contaba al servidor
por dónde iba el coche desde el momento en que se abría, aunque nadie hubiera
pulsado Arrancar. Ese aviso escribe `race_updated_at`, que es justo la marca con
la que el servidor decide quién sigue vivo en la pista, y la carrera solo se
cierra cuando ya no queda nadie vivo. Alguien que abría la pestaña y se iba a
hacer otra cosa dejaba la partida abierta para siempre, y con ella el marcador
final de todos los demás.

**Por qué está mal.** El servidor tenía la regla bien escrita -"quien nunca
avisó no está jugando"- y el cliente la desactivaba avisando desde el minuto
cero. Cuando una regla del servidor depende de que el cliente calle, no es una
regla: es un acuerdo, y los acuerdos se rompen solos al tocar el cliente.

**Qué se hace.** Mientras no se ha arrancado se PREGUNTA (`GET`), no se avisa
(`POST`). Y en general: antes de mandar un latido, preguntarse qué decide el
servidor con él, porque abrir una pantalla no es lo mismo que estar jugando.

### 2026-09-02 - Texto que describía una regla del juego que ya estaba muerta

**Qué pasó.** La portada del modo carrera prometía que "cuanta más gasolina te
quede al responder, más vale el acierto". Esa regla se había cambiado hacía
tiempo: ahora la parada es siempre con el depósito a cero, así que el margen
valía cero SIEMPRE y lo que se premia es acertar a la primera. El código estaba
bien y hasta lo explicaba en un comentario; el texto que lee el jugador contaba
otro juego.

**Por qué está mal.** Es peor que no explicar nada: enseña una estrategia que no
existe, y quien la sigue juega peor y no entiende por qué.

**Qué se hace.** Cuando se cambia una regla de negocio -puntaje, límite, tarifa,
condición-, se busca la regla vieja por sus palabras en todo el repo antes de
cerrar el cambio. El comentario junto al código no basta: el usuario no lo lee.

### 2026-09-02 - Un arnés de pruebas roto que nadie notó porque fallaba pronto

**Qué pasó.** `probar-navegador.mjs` de `examia` -la prueba de humo que recorre
la app entera con un navegador- esperaba entrar directo al crear la cuenta. Al
encenderse la confirmación por correo en el proyecto de Supabase, el registro
pasó a llevar a "revisa tu correo" y el arnés se quedaba clavado en el paso dos.
Los otros doce pasos llevaban tiempo sin ejecutarse.

**Por qué está mal.** Un arnés que falla siempre deja de mirarse, y a partir de
ahí es peor que no tenerlo: da la sensación de que hay red debajo.

**Qué se hace.** Cuando un arnés falla, se arregla en el mismo momento aunque el
fallo no sea del cambio que se está haciendo. Y las pruebas que dependen de un
ajuste del proyecto compartido -confirmación de correo, plantillas, URLs de
retorno- contemplan los dos estados en vez de dar uno por hecho, igual que ya
hace el código de registro.

### 2026-09-02 - Un HUD de juego que no cabía en un teléfono

**Qué pasó.** La cabecera del modo carrera ponía tres bloques en una fila con
`justify-between`. Solo el de gasolina medía 160 px; los tres sumaban más de
390, así que en un móvil la velocidad quedaba fuera de la pantalla. Y el
marcador con los nombres estaba directamente escondido con `hidden sm:block`,
que en el modo con amigos es esconder lo único que se quiere mirar.

**Por qué está mal.** Una superposición sobre un lienzo no tiene el `body` que
la avise: no desborda la página, se sale del cuadro y ya. Ninguna prueba de
"desplazamiento horizontal" lo detecta.

**Qué se hace.** Las superposiciones de pantalla completa se miran a 390 px como
cualquier otra pantalla, y lo que se esconda en móvil tiene que ser algo que
sobre ahí, no algo que estorbe al programar. En `examia` la comprobación vive en
`scripts/verificar-juego.mjs`.

### 2026-09-03 - `lookAt` apunta el +Z, y el modelo miraba a -Z

**Qué pasó.** El coche del jugador en la carrera de `examia` corría marcha
atrás: alerón delantero de cara a la cámara y pilotos traseros apuntando al
horizonte. Se orientaba con `objeto.lookAt(posicion + tangente)`, y el
monoplaza está modelado con el morro en -Z.

**Por qué está mal.** `Object3D.lookAt` apunta el eje **+Z** al objetivo. Solo
las cámaras miran por -Z, que es de donde viene la confusión. Los coches
rivales del mismo archivo ya lo tenían bien -arman su base con la tangente
NEGADA- así que el proyecto se contradecía a sí mismo y nadie lo vio.

**Por qué costó verlo.** El coche es casi simétrico de lejos y la cámara va
siempre detrás: nunca se ve de perfil. Compilaba, corría a 120 cuadros y las
pruebas pasaban.

**Qué se hace.** Cuando dos sitios del mismo repo orientan la misma malla, se
comparan antes de dar por bueno el que se está escribiendo. Y de un cambio
visual se mira una captura, que es lo único que lo habría enseñado.

### 2026-09-03 - Medir una distancia contra el trozo equivocado

**Qué pasó.** Los edificios del escenario estaban a doce metros del arcén y
tapaban el horizonte. Se mandaron "lejos" -a ciento cinco metros- y seguían
saliendo encima de la pista.

**Por qué está mal.** Es un circuito **cerrado**. El trazado entero cabe en
trescientos por seiscientos metros, así que "ciento cincuenta metros al lado de
este tramo" aterriza justo sobre otro tramo. La distancia se estaba midiendo
contra la muestra de la que colgaba cada edificio, y eso no dice nada sobre si
estorba: hay que medirla contra **toda** la pista.

**Qué se hace.** Cuando algo se coloca "lejos de X" y X es una figura cerrada,
la distancia se mide contra la figura entera, no contra el punto del que cuelga.
En `examia` es un centro y un radio para lo alto, y una comprobación contra una
muestra de cada diez para lo bajo.

### 2026-09-03 - Un arnés que solo corría en la máquina de quien lo escribió

**Qué pasó.** `verificar-carrera.mjs` hablaba con la API de gestión de Supabase
usando `SB_TOKEN`, un token personal que no está en el entorno del proyecto ni
lo trae `vercel env pull`.

**Por qué está mal.** Un arnés que no arranca en otra máquina no es una prueba
del proyecto, es una nota personal. Y no falla diciendo "falta un token": falla
con un error de red raro en la primera consulta.

**Qué se hace.** Las pruebas usan lo que ya usa la app -aquí `POSTGRES_URL` por
Postgres directo, como `verificar-juego.mjs`- y nunca credenciales que solo
existen en un portátil. Si hace falta una llave especial, el arnés lo dice y
para, en vez de reventar por dentro.

### 2026-09-03 - Esperas de reloj para medir tiempo de juego

**Qué pasó.** Al correr el arnés de la carrera sin ventana, fallaban "la
pregunta aparece al agotarse la gasolina" y "pulsar espacio enciende el turbo".
No había ningún fallo: el bucle limita el delta a 0.05 s por cuadro -para que
una pestaña dormida no teletransporte el coche al despertar- y dibujando por
software se va a diez cuadros por segundo, así que el juego avanza **medio
segundo por cada segundo de reloj**.

**Por qué está mal.** Se arregló primero la espera del turbo, y entonces falló
la de la gasolina; arreglada esa, habría fallado la siguiente. Parchear espera
por espera es redescubrir el mismo fallo en cada paso.

**Qué se hace.** Cuando el reloj del arnés y el del juego corren a ritmos
distintos, se escala el reloj **entero** una vez y se documenta la razón. Y las
medidas de rendimiento no se juzgan sin GPU: se imprimen y se saltan, porque ahí
se estaría midiendo el render por software.

### 2026-09-03 - Una lista negra de rutas nace abierta

**Qué pasó.** Al añadir invitados a `examia` -entrar a una sala con un código,
sin cuenta- había que impedirles usar el resto de la app. El primer impulso fue
enumerar lo prohibido: `/crear`, `/carrera`, `/cuenta`.

**Por qué está mal.** Con una lista negra, **cada pantalla nueva nace abierta** y
solo se cierra si alguien se acuerda de añadirla. El olvido no falla, no avisa y
no se ve: simplemente un invitado puede entrar donde no debe, y nadie lo nota
hasta que pasa algo.

**Qué se hace.** Lista de lo permitido, nunca de lo prohibido. Así una pantalla
nueva nace cerrada y hay que abrirla a propósito. Y la comprobación va en dos
capas: el proxy corta rápido leyendo la marca del token (barata, firmada), y la
pantalla decide de verdad consultando la base, porque un metadato de token es
cómodo pero no es una autoridad.

### 2026-09-03 - Concatenar el nombre de una columna en el SQL

**Qué pasó.** `actualizarSet` de `examia` armaba el `update` recorriendo las
claves del objeto que le pasaran: `campos.push(\`${clave} = $${n}\`)`. El valor
iba parametrizado, pero el NOMBRE de la columna no puede ir como parámetro, así
que se concatenaba tal cual.

**Por qué está mal.** Hoy el único llamador construye un objeto literal con
claves fijas y no es explotable. Pero es una función pública del dominio, y el
día que alguien la llame con `Object.fromEntries(formData)` -que es lo natural de
escribir- pasa a ser inyección de SQL directa desde un formulario. La mina la
pone quien escribe la función, no quien la pisa.

**Y el tipo de TypeScript no protege:** desaparece al compilar y no ve llegar un
objeto armado en tiempo de ejecución.

**Qué se hace.** Cuando algo que no es un valor entra en una consulta -nombre de
columna, orden, dirección- se comprueba contra una lista blanca escrita a mano,
en la función y no en el llamador. Se revisó el resto del repo: los `limit`
concatenados están acotados numéricamente.

### 2026-09-03 - Un límite numérico que no era un número

**Qué pasó.** Dos consultas de `examia` construían `limit ${Math.min(500,
Math.round(cantidad))}` con un valor venido de un formulario. Con texto en el
campo, `Number(...)` da `NaN`, y `Math.min(500, NaN)` sigue siendo `NaN`: salía
`limit NaN` y Postgres devolvía un error delante del usuario.

**Por qué está mal.** No es una inyección -no hay forma de colar texto- pero se
dispara escribiendo cualquier cosa en un campo, que es lo primero que hace quien
prueba una app.

**Qué se hace.** Acotar no es sanear. Si un número va a concatenarse en una
consulta, primero `Number.isFinite` y luego los topes; en ese orden.

### 2026-09-03 - Comparar colores por igualdad cuando el problema es el parecido

**Qué pasó.** En la carrera de `examia`, un rival era de un verde azulado
(`0x4ec9b0`) y el jugador aguamarina (`0x16d9d4`). A cuarenta metros y con luz de
atardecer eran el mismo coche, así que en un adelantamiento se perdía de vista el
propio. Medido después: 80 de distancia en RGB. El azul claro de otro rival,
igual.

**Por qué está mal.** Los colores no estaban repetidos, así que cualquier
comprobación de "que no haya dos iguales" pasaba. Y a ojo, en una paleta escrita
en hexadecimal, `0x4ec9b0` y `0x16d9d4` no se parecen en nada.

**Qué se hace.** Las paletas donde el color ES la identidad de algo se comprueban
por **distancia**, no por igualdad, y con una prueba automática. En `examia` hay
dos, y el umbral está medido contra los casos que fallaban.

### 2026-09-03 - Colocar cosas "lejos" de una figura cerrada, otra vez

**Qué pasó.** Ya estaba anotado el 2026-09-02 y volvió a morder al llenar el
escenario: al repartir árboles y edificios por zonas, se midió otra vez la
distancia contra la muestra de la que colgaba cada objeto.

**Por qué está mal.** Lo mismo que la vez anterior: en un circuito cerrado, estar
lejos de ESTE tramo no impide caer encima del de al lado.

**Qué se hace.** La comprobación contra el trazado entero se escribió como una
función (`despejado(punto, guarda)`) y todo lo que se coloca pasa por ella. La
regla anotada no evitó repetir el fallo; la función sí, porque no hay forma de
colocar algo sin llamarla.

### 2026-09-03 - Suavizar dos cosas distintas con la misma constante

**Qué pasó.** La inclinación del coche en la carrera de `examia` era
`peralte + volante * k`, todo junto y suavizado de una vez. Se veía raro y no
había forma de arreglarlo tocando el número: subiéndolo, el peralte se pasaba;
bajándolo, la carrocería no se movía.

**Por qué está mal.** Eran dos cosas con ritmos opuestos metidas en una
variable. El peralte es **el mundo** y el coche tiene que seguirlo al instante,
porque va apoyado en él; el balanceo es **la suspensión** y tiene que llegar
tarde, porque una carrocería tarda en tumbarse. Un solo suavizado no puede ser
rápido y lento a la vez, así que las dos quedaban mal a la vez.

**Qué se hace.** Cuando dos aportes tienen constantes de tiempo distintas, van
en variables distintas aunque acaben sumándose en el mismo sitio. Y si un valor
"no se arregla tocando el número", el problema no es el número: es que hay dos
cosas ahí dentro.

### 2026-09-03 - Orientar con `lookAt` algo que va apoyado en una superficie

**Qué pasó.** El mismo coche se orientaba con `lookAt` y luego se le sumaba el
peralte con un `rotateZ`.

**Por qué está mal.** `lookAt` alinea contra la vertical del **mundo**. En una
curva peraltada que además sube, el coche quedaba torcido respecto al asfalto
que pisaba. El giro extra tapa el error en llano y lo deja a la vista en cuanto
hay pendiente y peralte a la vez, que es justo donde se mira.

**Qué se hace.** Lo que va apoyado en una superficie se orienta con la **base**
de esa superficie -su tangente, su normal y su lateral- y no con la vertical del
mundo. En `examia` los coches rivales ya lo hacían bien: el proyecto se
contradecía a sí mismo, que es la señal de que uno de los dos está mal.

### 2026-09-03 - `FAQPage` con respuestas que no están en la página

**Qué pasó.** Al añadir datos estructurados de preguntas frecuentes a `examia`,
el primer impulso fue declararlas solo en el JSON-LD, que es donde las lee
Google.

**Por qué está mal.** Google exige que el contenido de un `FAQPage` esté visible
en la página. Declarar respuestas que el visitante no puede leer es una de las
cosas que penaliza explícitamente, así que el dato estructurado pasa de ayudar a
restar.

**Qué se hace.** Todo dato estructurado se declara **y** se pinta. Cuando el
texto vive en dos sitios -el grafo y el HTML- los dos llevan un comentario que
avisa de que el otro existe, porque si no, el día que alguien retoque uno solo
la penalización llega sin que nadie sepa de dónde.

### 2026-09-03 - Un botón dentro de un flex sin `shrink-0`

**Qué pasó.** El botón "Generar simulacro" compartía un contenedor flex con una
línea de texto larga. El flex lo encogió hasta partir el texto en dos líneas
dentro de una pastilla estrecha.

**Por qué está mal.** Se lee como un fallo de maquetación, y lo es. Además pasa
solo en el ancho concreto donde el texto de al lado ocupa lo justo, así que no
sale en una revisión rápida.

**Qué se hace.** Un botón junto a texto flexible lleva `shrink-0` y
`whitespace-nowrap`. Y al revisar una pantalla se mira **el botón**, no solo si
la página cabe: una prueba de desbordamiento horizontal no detecta esto.

### 2026-09-03 - Un menú plano que no contaba de qué iba la app

**Qué pasó.** La barra de `examia` con sesión ponía cinco enlaces al mismo
nivel: Inicio, Salas, Carrera, Bancos y Perfil. Ninguno marcaba dónde estabas,
y dos pares de ellos eran la misma cosa vista de dos formas -Salas y Carrera
son jugar; Bancos y Crear son estudiar-. El tablero, encima, ofrecía tres
atajos distintos de los cinco del menú.

**Por qué está mal.** Un menú es la única explicación de la app que se lee
antes de usarla. Con cinco destinos sin jerarquía hay que usarla un rato para
descubrir lo que debería decir de entrada, y cada pantalla nueva se coloca a
ojo: la que no encaja en ninguna categoría acaba siendo un sexto enlace, y a la
siguiente son siete.

**Qué se hace.** Se decide en qué **pocas cosas** consiste el producto -en
examia son dos: estudiar y jugar con alguien- y esas son la navegación. Lo
demás cuelga de una de ellas o no existe. El tablero enseña las mismas puertas
que la barra, para que la estructura se aprenda una sola vez. Y el sitio donde
estás se marca (`aria-current`), que es lo que ningún `build` detecta: sale de
comparar la ruta en el cliente, así que un pilar mal declarado compila,
despliega y deja al usuario sin saber en qué mitad de la app está.

### 2026-09-03 - Una prueba atada al rótulo de una sección

**Qué pasó.** Al reorganizar el tablero de `examia`, el arnés `test:juego`
falló en `check(/Jugar ahora/i.test(tablero), 'las tres formas de jugar están
en el tablero')`. La comprobación miraba el rótulo de encima de las tarjetas,
no las tarjetas.

**Por qué está mal.** Un rótulo es la parte más volátil de una pantalla: se
reescribe en cualquier pasada de redacción, y la prueba entonces falla sin que
nada se haya roto o -peor- sigue pasando porque el rótulo sobrevivió a las
tarjetas que se quitaron.

**Qué se hace.** Se comprueba lo que la pantalla tiene que **ofrecer** -los
nombres de los destinos, el botón, el enlace- y no el texto decorativo que los
encabeza. Cuando la prueba falla por un cambio deliberado, se actualiza en el
mismo commit y se escribe al lado por qué cambió lo que se espera.

### 2026-09-03 - El gesto de la marca, repetido hasta volverse fondo

**Qué pasó.** La portada de `examia` tenía once secciones y las once estaban
separadas por el mismo recurso: la línea de corte con su rótulo en versalitas.
Esa línea es la marca del sitio -es el logo, es el mínimo de aprobación y es la
meta de la carrera, las tres cosas a la vez-.

**Por qué está mal.** Un gesto que aparece en todas partes deja de señalar
nada. Repetido once veces dejó de leerse como la firma de la marca y pasó a
leerse como papel pintado, así que la página perdió a la vez el recurso y el
significado. De paso, ninguna sección pesaba más que otra: "exportable en JSON"
tenía el mismo tratamiento que la premisa entera del producto.

**Qué se hace.** El gesto de marca se usa **una vez por página**, en el sitio
donde la página gira. En la portada nueva es la bisagra entre las dos mitades:
encima la partida, debajo el examen que se paga. El ritmo entre secciones lo da
el espacio y un cambio de suelo -un panel con el fondo un escalón más claro-,
no un separador repetido.

Junto con eso se fueron los otros tres tics que hacen que una página se lea como
plantilla, y que conviene revisar en cualquier sitio de la zona: el rótulo en
versalitas encima de cada titular, las flechas pegadas al texto de los enlaces
(`Ver el catálogo →`) y las cadenas de datos unidas por puntos medios
(`Sin registro · sin tarjeta · 8 pruebas gratis`). Lo que dicen ya lo dice el
titular o el párrafo de al lado.

### 2026-09-03 - `loading="lazy"` en el contenido principal

**Qué pasó.** La portada de `examia` abre con una pared de 49 insignias de
certificación: es lo primero que se ve y lo que contesta la única pregunta que
trae quien llega, que es si su examen está. La mitad de la pared salía en
blanco durante los primeros segundos.

**Por qué costó encontrarlo.** Las imágenes SÍ acababan cargando, así que todo
lo que se midió decía que estaba bien: las 49 URLs respondían 200, ninguna
petición fallaba, y `naturalWidth` era mayor que cero en todas al comprobarlo
unos segundos después. Se persiguió durante tres intentos como si fuera un
problema de contraste -se cambió el fondo de la celda dos veces- porque el
síntoma era idéntico: celdas vacías.

**Por qué está mal.** `lazy` está para lo que hay debajo del pliegue. Puesto en
el contenido principal retrasa exactamente lo que decide si alguien se queda, y
no lo detecta ninguna comprobación de red porque no es un fallo de red: es una
carrera contra el momento en que la persona mira.

**Qué se hace.** Lo que está arriba se pide `eager` y con `fetchPriority`
alto; `lazy` solo por debajo del pliegue. Y la prueba no comprueba que la
imagen exista, comprueba que **esté pintada al abrir**: cuántas de las que hay
tienen `complete && naturalWidth > 1` sin darle tiempo extra.

### 2026-09-03 - Arte de terceros sobre un fondo que no es el suyo

**Qué pasó.** Las insignias de Credly -que son de AWS, Microsoft, la CNCF, no
nuestras- vienen de dos mundos: las de GitHub o CompTIA son casi negras sobre
transparente y las de Google Cloud o Cisco son casi blancas. Sobre la pizarra
oscura de examia desaparecían las primeras; al probar con blanco puro
desaparecieron las segundas, veintiuna de cuarenta y nueve.

**Por qué está mal.** No hay un fondo que salve a las dos familias, y cuando la
solución es ponerle una placa detrás a cada imagen, lo que está mal es el
fondo. Un sitio cuyo contenido principal es material ajeno tiene que elegir el
suelo que ese material espera, no al revés.

**Qué se hace.** El suelo del sitio pasó a ser papel claro, y la celda de la
pared es un **gris medio**: es el único valor donde se ven tanto el arte oscuro
como el blanco. La elegida sube a blanco, que de paso es lo que la distingue.

### 2026-09-04 - Un grupo por agente en `robots.txt` no hereda del comodín

**Qué pasó.** El `robots.txt` de examia tenía un grupo `User-Agent: *` con diez
`Disallow` -`/api/`, `/salas`, `/crear`, `/cuenta`…- y debajo, un grupo por cada
rastreador de IA con un `Allow: /` a secas, con el comentario "los buscadores
con IA leen llms.txt antes que el HTML" al lado.

**Por qué está mal.** Un rastreador elige **el grupo más específico que le
aplica y descarta todos los demás**. GPTBot, ClaudeBot y PerplexityBot leían
solo su grupo, así que el `Allow: /` les abría entera la parte con sesión: justo
lo contrario de lo que decía la lista de arriba. Y no se ve leyendo el archivo,
porque las dos mitades por separado dicen lo correcto.

**Qué se hace.** La lista de rutas privadas se declara **una vez** y se reparte
a todos los grupos, el comodín incluido. Nombrar a un agente aparte solo sirve
para darle un trato distinto; si el trato es el mismo más un matiz, el matiz no
se escribe borrando el resto. Y se comprueba pidiendo el `robots.txt` servido,
no leyendo el código que lo genera.

### 2026-09-04 - `lastmod` puesto con la hora de la consulta

**Qué pasó.** El sitemap de examia generaba `lastModified: new Date()` para las
87 URLs: cada vez que se pedía, las 83 fichas del catálogo juraban haber
cambiado en ese instante.

**Por qué está mal.** Es el mismo fallo que el `lastmod` congelado de AGD, por
el otro extremo. Una fecha vieja pide que el buscador no vuelva; una fecha que
siempre es "ahora mismo" le enseña a no mirar el campo, y entonces se pierde
también para las páginas que sí cambiaron. Un dato que siempre dice lo mismo no
es un dato.

**Qué se hace.** Una constante de fecha por cada cosa que puede cambiar, y
declarada **donde viven los datos que fecha**: `CATALOGO_ACTUALIZADO` está en
`certificaciones.ts`, al lado de las 83 fichas, para que se toque en el mismo
commit que las cambia. En el archivo del sitemap se olvidaría.

### 2026-09-04 - Una placa cuadrada estirada por su contenedor

**Qué pasó.** El icono de las dos puertas del tablero de examia iba dentro de un
`<span className="inline-flex rounded-xl bg-acento-suave p-2.5">`. En una
tarjeta en columna salía como una **banda azul de punta a punta** con el icono
perdido a la izquierda, y era lo primero que se veía al entrar con cuenta.

**Por qué está mal.** `inline-flex` dice cómo se colocan los hijos del elemento,
no cómo lo colocan a él: dentro de un `flex-col`, el hijo se estira a lo ancho
porque `align-items` vale `stretch`. Leído en el código parece una placa
cuadrada, y compila y despliega sin quejarse.

**Qué se hace.** Todo hijo de un contenedor flex que tenga que conservar su
tamaño lleva `self-start` (o `self-center`). Es el mismo par que el `shrink-0`
del botón junto a texto flexible: dentro de un flex, un elemento no mide lo que
mide su contenido salvo que se diga.

### 2026-09-04 - La reforma de la portada no llegó a la aplicación

**Qué pasó.** El 3 de septiembre se quitaron de la portada de examia los tres
tics que hacen que una página se lea como plantilla: el rótulo en versalitas
encima de cada titular, las flechas pegadas al texto de los enlaces y las
cadenas de datos unidas por puntos medios. La aplicación -tablero, Estudiar,
Jugar, la ficha de un banco, el perfil- se quedó con los tres. Entrar con cuenta
llevaba a una pantalla escrita con las maneras que la portada acababa de
abandonar.

**Por qué está mal.** Una decisión de estilo que se aplica en una pantalla es un
retoque; aplicada en todas es el sistema visual. Mientras convivan las dos, cada
pantalla nueva se escribe copiando la que el autor tenga más cerca, y la
diferencia se ensancha en vez de cerrarse. Además, la parte que quedó vieja es
la que ve quien ya pagó con su registro.

**Qué se hace.** Un cambio de criterio visual se termina en la misma pasada en
todas las pantallas, o no se hace. La forma práctica de que se termine es que el
criterio viva en **una pieza** -aquí, un componente de sección y un marco de
acceso compartidos- en vez de en quince pantallas que lo repiten. Y el criterio
se escribe en el `AGENTS.md` del repo: si solo está en la cabeza de quien lo
decidió, la pantalla dieciséis vuelve a empezar.

### 2026-09-05 - El comentario decía que los contrastes estaban medidos

**Qué pasó.** La cabecera de `globals.css` de examia afirmaba que "todos los
tokens de texto pasan de 4.5x" sobre el papel y sobre la superficie blanca.
Midiéndolos: `apagado` daba 4.21x sobre el papel, `logro` 4.13x sobre la
superficie alta y `aviso` 4.22x. Y la nota se olvidaba del tercer suelo, el
gris de `superficie-alta`, que es justo donde peor van los tres.

**Por qué está mal.** Un comentario que afirma una medida vale como la medida:
nadie vuelve a comprobar lo que ya está escrito con un número al lado. `apagado`
es el gris de los pies de figura, el del pie de la portada y el de los datos de
las tarjetas -o sea, la mitad del texto pequeño del sitio-, y `logro` acaba en
la pastilla de nivel y en el puesto del marcador sobre fondos claros.

**Qué se hace.** El comentario que afirma un contraste lleva el número y los
suelos contra los que se midió, y son **todos** los suelos que la paleta pinta,
no los dos más obvios. Aquí bajaron `apagado` a 0.52, `logro` a 0.53 y `aviso`
a 0.52 en la L de oklch: el tono no se mueve, el mínimo pasa a 4.55x.

### 2026-09-05 - La etiqueta de la línea recortada sobre el suelo equivocado

**Qué pasó.** `.corte[data-corte]::after` tapa el trazo detrás de su número con
un rectángulo, y ese rectángulo iba pintado con `var(--color-fondo)`, el papel.
La única línea con número del sitio vive dentro de una tarjeta **blanca** -el
panel del examen elegido en la portada-, así que el "72% para aprobar" salía
con una placa gris a su espalda sobre el blanco.

**Por qué está mal.** Un pseudoelemento no sabe sobre qué lo van a poner. Fijar
ahí el color del suelo funciona hasta la primera vez que la pieza se usa dentro
de otra cosa, y entonces falla en silencio: compila, y solo se ve mirando la
pantalla.

**Qué se hace.** El suelo se declara desde fuera y el pseudoelemento lo lee, con
el papel como valor por defecto: `var(--corte-suelo, var(--color-fondo))`.
`.tarjeta` y `.tarjeta-accion` lo declaran solas; una superficie blanca hecha
con utilidades sueltas añade `sobre-superficie`.

### 2026-09-05 - Un catálogo de 83 que decía 82 en dos sitios

**Qué pasó.** La portada de examia decía "el catálogo tiene las 82 con su
temario" y la descripción de `/certificaciones` decía "Simulacros para 82
certificaciones", mientras el resto de la página contaba 83 leyendo
`CERTIFICACIONES.length`. Dos frases escritas a mano el día que eran 82.

**Por qué está mal.** Es "un dato, dos lugares" otra vez, y del lado peor: una
de las dos frases es la descripción que sale en el resultado de búsqueda, donde
la cifra que no cuadra con la página es lo primero que resta confianza.

**Qué se hace.** Una cifra que se puede contar no se escribe: se cuenta. Si el
texto tiene que decir cuántas cosas hay, sale de la lista de cosas, y la
descripción de la página se interpola como cualquier otra cadena.

### 2026-09-05 - Un bloque rediseñado por fuera y por dentro no

**Qué pasó.** La portada de `itep` se rehízo entera con su propio lenguaje
-papel gris verdoso, rojo de hoja de respuestas, tres tipografías- y el
desplegable de los doce tiempos verbales se quedó con las clases del examen que
había antes: tarjetas azul claro, títulos azules y explicaciones en verde
azulado, servidas por `styles.css`. El `summary` sí se había restilado, así que
plegado se veía perfecto.

**Por qué está mal.** Era el único bloque de la página que parecía de otro
sitio, y solo se ve abriéndolo. Ninguna prueba lo miraba, y sus reglas
`.verb-tense-*` y `.vt-*` seguían cargando aunque ya no las usara nadie más.

**Qué se hace.** Cuando se rediseña una pantalla, se abre **todo** lo que está
plegado antes de darla por buena: un `details`, una pestaña, un panel que solo
aparece tras pulsar. Y al cambiar el lenguaje visual de una pantalla se busca
qué clases del diseño viejo siguen usándose dentro, en vez de fiarse de que el
contenedor ya tiene las nuevas.

### 2026-09-05 - Una tarjeta de compartir dibujada a mano, con cifras que el examen desmiente

**Qué pasó.** El `og.png` de `itep` -la imagen que sale al pegar el enlace en
WhatsApp, LinkedIn o X- listaba las cinco secciones con sus minutos y decía
"Listening 20 min" y "Speaking 5 min". El examen dice 6 y 4. Estaba dibujada a
mano una vez y nadie la volvió a mirar.

**Por qué está mal.** El enlace circula entre estudiantes por grupos de clase,
así que esa imagen es lo primero que ve alguien del sitio, antes que el título
y antes que la página. Y es el peor sitio para un dato falso, porque nadie lo
compara con nada: no hay una segunda cifra al lado que lo contradiga.

**Qué se hace.** La tarjeta se genera, no se dibuja: `scripts/generar-og.mjs`
saca los minutos de `public/data/exam-data.json` y `npm run og` la rehace.
En general, una imagen que muestra datos del producto se construye desde la
misma fuente que el producto, igual que ya se hace con el texto. Si eso no es
posible, no lleva datos.

### 2026-09-08 - Una portada y su aplicacion vestidas como dos productos

**Qué pasó.** La portada de `itep` era un cuadernillo de papel: fondo gris
azulado, tinta navy, botones de esquina recta y un lápiz rojo para señalar. Al
pulsar "Start exam mode" aparecía otra cosa: campo azul de pared a pared,
tarjetas celestes de esquina muy redonda, pastillas y amarillo. Ni un color, ni
un radio, ni una tipografía en común.

**Por qué está mal.** Nadie decidió esa frontera: la portada se escribió
después y con otro criterio. Quien llega se cree que el simulador es la página
que está viendo, y al entrar aterriza en un sitio que no reconoce. Y no falla
nada: las dos mitades compilan, pasan las pruebas y se ven bien por separado.
Por separado es exactamente como se habían mirado siempre.

**Qué se hace.** Manda la pantalla donde se pasa el tiempo, no la que se
escribió al final: aquí el examen, que es donde se está una hora. La portada se
llevó a su campo azul, sus tarjetas y sus pastillas, y el examen adoptó la
tipografía de la portada, que era la mitad del salto. Cuando dos pantallas del
mismo producto se diseñan en momentos distintos, se abren las dos a la vez y se
comparan; leer una sola no enseña nunca que son dos.

### 2026-09-08 - Una lista de precios que las preguntas frecuentes desmentían

**Qué pasó.** `reinicia` tenía tres precios en las tarjetas de servicio, dos
más tachados en la jornada, un `priceRange` y tres `priceSpecification` en el
JSON-LD, y los mismos importes impresos en el reverso de la tarjeta de
contacto. Cuatro secciones más abajo, la pregunta "¿Cuánto cuesta?" respondía
"no pongo una lista que después no se cumpla".

**Por qué está mal.** Las dos cosas eran ciertas cuando se escribieron y nadie
las leyó juntas. Un precio en el JSON-LD además no es decorativo: Google lo
publica en el resultado de búsqueda, así que la cifra vieja sigue viva mucho
después de bajarla de la página.

**Qué se hace.** El importe vive en tres sitios -la página, el `llms.txt` y el
schema- más el reverso de la tarjeta, que se imprime. Se quitan los cuatro o no
se quita ninguno. Y al cambiar una condición comercial, se busca por sus
palabras en todo el repo antes de cerrar: la contradicción estaba escrita en el
mismo archivo.

### 2026-09-08 - Dos `twitter:card` en la misma cabecera

**Qué pasó.** `reinicia` declaraba `twitter:card` como `summary_large_image` y
cuatro líneas más abajo lo volvía a declarar como `summary`. Gana el segundo,
así que el enlace se compartía con la tarjeta pequeña teniendo un `og.png` de
1200x630 hecho para la grande.

**Por qué está mal.** No se ve desde el sitio, no rompe nada y las dos líneas
leídas por separado son correctas. Solo se nota pegando el enlace en WhatsApp,
que es justo lo que no se hace al terminar de escribir el `<head>`.

**Qué se hace.** Una etiqueta `meta` con el mismo nombre no se repite nunca. Al
tocar la cabecera, se cuenta: `grep -c 'twitter:card'` tiene que dar 1.

### 2026-09-08 - Etiquetas dentro de un SVG que encogen con el dibujo

**Qué pasó.** El corte del portátil de `reinicia` lleva los nombres de las
piezas escritos dentro del SVG. A 1280 px se leen; a 390 px el dibujo se
escala a un tercio y las letras bajaban a unos ocho píxeles.

**Por qué está mal.** El primer impulso es subirles el tamaño, y no sirve: el
hueco donde caben se escala igual, así que unas letras más grandes se pisan
entre ellas en vez de leerse.

**Qué se hace.** En estrecho las llamadas se ocultan y quien nombra las piezas
es el pie de la figura y la lista de al lado, que son texto de verdad y se
adaptan. El `<title>` y el `<desc>` del SVG se quedan, así que quien lo oye con
un lector de pantalla no pierde nada.

### 2026-09-08 - Una llave de API a un paso de publicarse, en una variable `VITE_`

**Qué pasó.** `itep` llamaba a la API de Groq desde el propio navegador, con la
llave leída de `import.meta.env.VITE_GROQ_API_KEY`, en tres sitios: transcribir
la grabación de Speaking y evaluar Speaking y Writing.

**Por qué está mal.** Vite sustituye en el paquete que descarga el visitante
**toda** variable que empiece por `VITE_`, con su valor literal. La llave nunca
se filtró por un motivo incómodo: la variable no estaba puesta en ninguna parte,
así que las tres funciones salían por un `if (!key) return` y no evaluaban nada.
O sea que la trampa seguía armada y el único gesto natural para "arreglar
Speaking" -ponerla en Vercel- era justo el que publicaba la llave.

**Qué se hace.** Una llave de terceros no se lee nunca desde código de cliente,
y en Vite eso quiere decir que **no lleva el prefijo `VITE_`**: sin prefijo no
llega al paquete. En un sitio estático se pone delante una función de servidor
-en Vercel basta una carpeta `api/`- y el navegador habla con ella, como ya
hacen parla, examia y monetiq con sus rutas. `test/calificacion.test.mjs` lo
comprueba con un grep sobre `src/` y sobre el paquete construido.

### 2026-09-08 - Una nota de respaldo que puntuaba el gesto, no la respuesta

**Qué pasó.** Cuando no había nota del modelo, `itep` calculaba Writing y
Speaking con una "nota de avance": 72 sobre 100 por haber grabado las dos
consignas, y 72 por llegar al mínimo de palabras. Esos puntos entraban enteros
en la banda CEFR del informe. Como la llave nunca estuvo puesta, ese respaldo no
era un respaldo: era el único camino, siempre. Sesenta segundos de silencio
valían igual que una respuesta perfecta, y dos de las cinco secciones se
regalaban.

**Por qué está mal.** El sitio promete una banda "based on how you actually
answered", y estaba dando el 40 por ciento de ella por apretar un botón. Además
el informe decía "No Speaking feedback available" en la misma página donde ya
había contado esos puntos: la contradicción estaba impresa y nadie la leyó junta.

**Qué se hace.** Si no se puede medir, no se puntúa: la sección sale como *Not
scored*, la banda se reparte entre las que sí se midieron, y el informe dice
cuántas cubre y por qué faltan las otras. Un valor de respaldo que se activa
cuando algo falla tiene que verse distinto de una medición de verdad; si se
mezcla con las buenas, el fallo deja de existir para quien lee el resultado.

### 2026-09-08 - Calificar la pronunciación leyendo una transcripción

**Qué pasó.** La rúbrica que se le mandaba al modelo pedía, entre otras notas,
una de `pronunciation`. Lo único que recibía el modelo era el texto de la
transcripción. El informe la imprimía junto a las que sí se miden, con el mismo
aspecto.

**Por qué está mal.** No es una nota mala, es una nota de algo que nadie
escuchó. Y puesta al lado de gramática y vocabulario no hay forma de distinguir
la que sale de un dato de la que sale de la nada.

**Qué se hace.** Se le pide al modelo solo lo que puede juzgar con lo que se le
dio, y se le dice explícitamente que no valore pronunciación ni acento. En
general: antes de añadir una casilla a un informe, mirar qué entra de verdad en
la función que la calcula.

### 2026-09-08 - Un `.env.local` con los valores puestos a `[SENSITIVE]`

**Qué pasó.** Al buscar una llave de Groq para probar, `examia/.env.local` tenía
`GROQ_API_KEY=[SENSITIVE]`, la cadena literal. `autoreel/.env.local` estaba
igual, pero entero: la URL de Supabase, la de Postgres y las llaves, los once
caracteres de `[SENSITIVE]` en todas. Por eso autoreel no arrancaba, con un
`Invalid supabaseUrl` que no decía nada de esto.

**Por qué está mal.** Es lo que queda al pegar en un archivo la salida de una
herramienta que censura los secretos al imprimirlos. Y no falla como falta un
valor: falla como un valor incorrecto, que es mucho más difícil de leer -una
llave de once caracteres pasa cualquier comprobación de "¿hay llave?" y muere
después con un 401.

**Qué se hace.** Un `.env.local` se rehace con `vercel env pull`, no copiando de
una consola. Y una comprobación de credencial mira algo más que si está vacía:
que empiece por su prefijo (`gsk_`, `https://`) y que tenga la longitud que
tiene.

### 2026-09-08 - El servidor de desarrollo no servía lo que sí sirve producción

**Qué pasó.** Las funciones de `api/` las publica Vercel sola, pero el servidor
de Vite no sabe nada de esa carpeta: en local `/api/...` devolvía el
`index.html`. Speaking se habría comportado distinto en la máquina de quien lo
escribe y en producción.

**Por qué está mal.** Es la peor asimetría posible, porque el sitio donde se
prueba es el que miente. Y no avisa: `fetch('/api/estado')` recibe un 200 con
HTML dentro y `res.json()` revienta con un error de parseo que apunta a
cualquier lado menos a la causa.

**Qué se hace.** Un complemento en `vite.config.js` monta los mismos archivos de
`api/` como middleware, importándolos, sin una segunda copia de la lógica. Si la
plataforma añade algo que el servidor de desarrollo no tiene, se le añade, en
vez de comprobarlo solo después de desplegar.

### 2026-09-08 - Una foto de un banco de imagenes se descarga, no se enlaza

Al ilustrar `reinicia` con fotos de Unsplash, lo cómodo era pegar la URL de
`images.unsplash.com` en el `src`. Tres razones para no hacerlo, y valen para
cualquier sitio de la zona:

1. Es una petición a un dominio de un tercero que se entera de quién visita el
   sitio, sin que el visitante lo haya elegido.
2. Es un enlace que se rompe el día que ese banco cambie de reglas, de formato
   de URL o retire la foto, y se rompe en silencio: queda un hueco.
3. Se pierde el control del tamaño y del formato que se sirve.

**Qué se hace.** Se descargan a `img/` del propio repo, al ancho que de verdad
se va a mostrar, y se comprueba la licencia antes (la de Unsplash permite uso
comercial y no exige atribución; otras sí la exigen, y entonces va en el pie o
en el README). Cada `<img>` lleva `width` y `height` para que el navegador
reserve el hueco y la página no dé el salto al cargar, `loading="lazy"` si no
está en la primera pantalla, y un `alt` que describa lo que se ve en vez de
repetir el titular que tiene al lado.

Y una foto solo entra si hace un trabajo que el texto no hacía. En reinicia
fueron tres: cómo se ve un equipo por dentro, que hay unas manos detrás del
servicio, y qué pasa en la hora en que el equipo no está con su dueño. Un
sitio que explica algo técnico gana más con una foto de eso que con una
ilustración, pero al revés también: el dibujo del corte nombra las piezas, que
es lo que la foto no puede hacer. Van juntos, no uno en lugar del otro.

### 2026-09-08 - Borrar el final de un comentario CSS y tumbar la hoja entera

**Qué pasó.** Al quitar la seccion de la tarjeta de `reinicia` sobraron unos
comentarios que describian reglas ya borradas, y se limpiaron con expresiones
regulares. Una de ellas casaba el final de un comentario de varias lineas y
dejaba viva la primera:

```
  /* Suelta, la tarjeta se estiraría a todo el ancho y perdería la escala de
}
```

Ese `/*` sin su `*/` se come todo lo que viene detras. La hoja seguia siendo
CSS valido para el navegador, que simplemente ignoro las 150 lineas
siguientes: la seccion nueva salia con la altura de su contenido en vez de
seis pantallas, y las capas del dibujo aparecian todas a la vez.

**Por qué costó verlo.** No hay error en la consola ni recurso roto, porque no
falta ningun archivo: la hoja carga entera y con 200. El sintoma fue que unos
estilos recien escritos "no se aplicaban", que es justo lo que hace pensar en
un selector mal puesto y no en algo que paso trescientas lineas antes. Se
perdio un rato buscando en el sitio equivocado.

**Qué se hace.** Un comentario no se borra por trozos: o se quita entero o se
deja. Y despues de tocar una hoja de estilos a mano se cuentan los pares, que
cuesta una linea:

```
abre /*  = N   cierra */ = N
llaves { = M   llaves } = M
```

Si los dos numeros de una fila no coinciden, hay CSS muerto aunque la pagina
cargue. Vale lo mismo para las llaves: una de menos se traga el resto del
archivo igual de callada.

### 2026-09-13 - Mudar un esquema y dejar atrás todo lo que lo nombra

**Qué pasó.** El 2026-09-01 los dos esquemas de `arriendos` -`core` y
`rentals`- se fundieron en uno solo, `arriendos`. La aplicación se actualizó
entera y quedó funcionando. Lo que rodea a la aplicación no:

- El respaldo nocturno hacía `pg_dump --schema=core --schema=rentals`. Llevaba
  doce noches saliendo con `pg_dump: error: no matching schemas were found`.
  Doce días sin un solo respaldo, en un proyecto de Supabase en plan libre que
  no tiene recuperación a un punto en el tiempo.
- `supabase/config.toml` seguía exponiendo `core` y `rentals` en la API. El
  proyecto en la nube sí expone `arriendos`, así que nada se notaba; pero el
  primer `supabase config push` habría dejado a PostgREST sin el esquema y
  tumbado la aplicación completa.
- Los 18 scripts de `scripts/` construían el cliente con el esquema viejo: el
  arnés de pruebas y el respaldo manual reventaban en la primera línea.
- `npm run db:types` generaba los tipos de dos esquemas inexistentes.

**Por qué costó verlo.** Porque la aplicación andaba. Un cambio de esquema se
siente terminado cuando la pantalla responde, y la pantalla es justo la parte
que sí se había migrado. Lo demás -el cron de respaldo, un archivo de
configuración que solo actúa cuando alguien lo empuja, los scripts que uno
corre cada tantas semanas- no tiene quien lo mire a diario.

Peor: la comprobación que existía para gritar esto se quedó callada. El script
que compara el respaldo restaurado contra producción lista las tablas a mano y,
si una no existe en producción, la ignora y sigue. Con los nombres viejos no
encontró ninguna, ignoró las dieciocho, y terminó en verde sobre nada.

**Qué se hace.** Renombrar un esquema no es un `ALTER`: es un barrido por todo
lo que escribe su nombre.

```
grep -rn "nombre_viejo" . --exclude-dir=node_modules --exclude-dir=.next
```

Se revisa lo que sale, línea por línea, y se separa lo que es un nombre de
esquema de lo que solo se parece: en este repo la columna `project` vale
`'rentals'` y los buckets se llaman `rentals-photos`; ninguno de los dos se
toca. Y lo que hay que mirar aunque el `grep` no lo cante: `.github/workflows`,
`supabase/config.toml`, los scripts de `package.json` y los documentos.

Una comprobación que puede ignorar todo lo que mira necesita un suelo: si no
comprobó nada, falla. Ahora `comparar-respaldo.mjs` lo dice.

### 2026-09-13 - Pruebas que caducan solas: el reloj y los techos fijos

**Qué pasó.** Con el arnés de `arriendos` corriendo otra vez, tres pruebas
fallaban sin que el producto tuviera nada roto:

- `probar-mora-visible` armaba la fecha de vencimiento con `setUTCDate`, y la
  aplicación cuenta los días de atraso en hora de Bogotá. Entre las 7 p.m. y la
  medianoche -cuando en UTC ya es el día siguiente- la prueba daba la factura
  por vencida un día antes que la aplicación y esperaba unos $657 más de mora.
  `probar-facturacion` tenía lo mismo con el día de hoy: el último día del mes
  se le adelantaba el periodo entero.
- `probar-formularios` exigía que, tras pagar el canon completo, el saldo
  quedara «por debajo de $20.000» de mora, contra una factura de fecha fija.
  Esa mora crece unos $592 por día: el techo se pasó solo el 2026-09-13.

**Por qué costó verlo.** Porque no falla cuando se escribe. Una prueba con
`< 20000` pasa el día que se escribe y durante semanas; y una que depende de la
hora pasa toda la mañana. Cuando por fin falla, falla sin que nadie haya tocado
nada cerca, que es cuando menos ganas hay de creerle. Así se aprende a ignorar
un rojo.

**Qué se hace.** Si el código de producción decide algo con el reloj o con una
zona horaria, la prueba usa la misma fuente, no una parecida:

```js
// La app: todayIn('America/Bogota')
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
```

Y un valor que cambia con el calendario no se compara contra un número
escogido a ojo: se vuelve a calcular con la misma fórmula que usa la
aplicación, y se compara por igualdad. Si la fórmula está mal, la prueba lo
dice el mismo día; si está bien, no vuelve a fallar sola.

### 2026-09-14 - La misma marca en dos colores, según dónde la mires

examia cambió de piel el 3 de septiembre: de pizarra oscura con aguamarina y
oro a papel claro con azul y naranja. Se repintó la aplicación entera y se
quedaron fuera las dos piezas que no se ven navegando:

- `src/app/icon.svg`, el favicon, seguía en ámbar `#f2b54a`. La app dibujaba
  el mismo símbolo en azul. Una marca en dos colores a la vez.
- `src/app/opengraph-image.tsx`, la imagen de compartir, seguía siendo el
  skin anterior **entero**: fondo azul noche, logo aguamarina, primer puesto
  en ámbar, y encima un titular distinto al de la portada.

Lo segundo es lo caro. La imagen de compartir es lo primero que ve alguien
que todavía no ha entrado: en un chat se veía un producto oscuro y al pulsar
se abría uno claro, con otra frase. Dos promesas para un clic.

**Por qué se escapó.** Las dos viven fuera del CSS. El repintado se hizo
cambiando tokens en `globals.css`, y todo lo que lee tokens cambió solo. El
favicon y la imagen de compartir llevan los colores **escritos a mano**,
porque el navegador pinta el uno fuera de la página y satori la otra fuera
del CSS. Nada las arrastró, y navegando no se ven: el favicon es una pestaña
y la otra no tiene URL en el menú.

**Qué se hace.** Un cambio de piel no está hecho hasta que se abren a mano
las tres piezas que no leen tokens, y en todo repo de la zona son las mismas:

```
/icon.svg  ·  /opengraph-image  ·  /apple-icon (si lo hay)
```

Se abren en el navegador, no se dan por buenas. Y donde haya un color escrito
a mano se anota de qué token sale, para que la próxima vez se sepa qué mirar:

```
#283fdb = acento · #f1f4f8 = fondo · #f68622 = logro-vivo
```

### 2026-09-14 - Satori no dibuja los arcos de un SVG

La imagen de compartir de examia se genera con `next/og`, que por debajo es
satori. El logo nuevo es un sello: dos medias circunferencias trazadas con
arcos (`A 9.3 9.3 0 0 1 …`). Satori dibuja `path`, así que el código compila,
la ruta devuelve 200 y la imagen sale. Con el logo convertido en un disco
relleno con un aro encima.

Meterlo en un `<img>` con el SVG en un data URI **tampoco** funciona: el mismo
disco.

**Qué se hace.** Dentro de `ImageResponse` no se dibuja con arcos. Lo que
satori rasteriza igual que un navegador son cajas: `border`, `border-radius`,
`background`. Un círculo es un `div` con radio, y media circunferencia es un
`div` con el borde de un lado en `none`. Cuando el símbolo existe en los dos
sitios se escribe la equivalencia al lado, porque son dos dibujos del mismo
logo y se cambian juntos.

Y sobre todo: **esta imagen se mira renderizada, siempre**. Es el caso puro de
"compilar no es funcionar", con el agravante de que no aparece en ninguna
pantalla de la app. Se abre `http://localhost:3100/opengraph-image`.

### 2026-09-14 - El middleware le cierra la puerta a los archivos que piden las máquinas

Tercera vez en examia, con una pieza distinta cada vez. El `matcher` del proxy
excluye lo que no necesita sesión, y lo que no está en esa lista se manda a
`/entrar` con un 307:

1. `robots.txt` y `sitemap.xml`: Google no podía leerlos, y cada enlace
   compartido salía sin imagen porque la tarjeta pedía una redirección.
2. `carrera.webm`: el vídeo de la portada se quedaba en negro para todo el que
   llegaba sin cuenta, o sea para todo el que llega.
3. `apple-icon`: iOS pedía el icono de la pantalla de inicio y recibía el HTML
   del formulario de acceso.

**La regla que las tres veces faltó.** Todo archivo que pide una máquina y no
una persona va en la lista de exclusiones. Y hay una familia entera que se
escapa del filtro por extensión porque **no tiene extensión en la URL**: la que
genera el framework desde las rutas, `opengraph-image`, `apple-icon`,
`twitter-image`, `manifest`. Se parecen a la ruta de una página y el matcher las
trata como tal. Un `icon.svg` se salva de casualidad, por el `.svg`.

**Cómo se comprueba**, porque ninguna de las tres se vio navegando por el sitio:

```bash
for r in /robots.txt /sitemap.xml /llms.txt /opengraph-image /apple-icon; do
  curl -s -o /dev/null -w "$r %{http_code} %{content_type}\n" "http://localhost:3100$r"
done
```

Tienen que contestar **200 y su tipo**, no 307. Va al final de cualquier cambio
en el middleware y al añadir cualquier ruta generada.

### 2026-09-14 - Las mismas preguntas frecuentes escritas tres veces

En examia estaban en la portada (lo que se lee), en el `FAQPage` del JSON-LD
(lo que Google puede sacar en el resultado) y en `llms.txt` (lo que leen los
rastreadores de IA). Con una nota en el código que pedía cambiar las tres a la
vez, que es lo que se escribe cuando ya se sabe que va a fallar.

Para cuando se unificaron, habían divergido: una daba la cifra real del
catálogo y otra decía "más de 80"; una nombraba ISC2 y PMI entre los
proveedores y la otra no. Y lo mismo con el número de certificaciones, escrito
a mano en cinco sitios de la cabecera mientras el cuerpo de la página lo
calculaba: el `<meta>` contradecía al HTML que describe.

**Por qué es peor que un descuido de estilo.** Un `FAQPage` que declara
respuestas que no aparecen en el HTML es justo lo que Google penaliza, así que
la copia desalineada no es fea: es un riesgo. Y `llms.txt` lo leen los
asistentes **antes** que el HTML, así que su versión es la que se repite cuando
alguien pregunta por el sitio.

**Qué se hace.** Un texto que aparece en dos superficies vive en un módulo y lo
importan las dos. Una cifra que describe una colección se calcula de la
colección, nunca se teclea. Y si una lista se copia -el catálogo entero estaba
escrito a mano en `llms.txt`-, ese archivo deja de ser estático y pasa a
generarse: en Next, una carpeta `llms.txt/` con un `route.ts` sirve en
`/llms.txt`. Ojo con borrar el de `public/`: lo estático gana a la ruta y la
nueva no se serviría nunca.

### 2026-09-14 - El hero prometía un orden y la página entregaba el contrario

El subtítulo de la portada de examia dice, en los primeros diez segundos:

> «...de ahí salen las preguntas: para estudiar solo, para retar a alguien con
> un código o para correr respondiendo.»

Tres modos, en ese orden. La página los contaba al revés: primero la carrera en
3D, luego las salas, y el simulacro con reloj -lo que la mayoría viene a
buscar- el quinto bloque, detrás de un vídeo de coches. Encima era el único de
los tres sin `id`, así que ni se podía enlazar ni salía en el índice lateral.

**Por qué importa más de lo que parece.** Una frase de apertura que enumera es
un índice: fija el orden en que el lector espera las cosas. Si la página lo
incumple, quien llega buscando lo primero de la lista tiene que atravesar lo
que menos le interesa para encontrarlo, y lo más raro -un circuito en 3D- se
lee antes de que nada explique para qué sirve el sitio.

**Qué se hace.** Cuando el titular o la entradilla enumeran, el orden de la
enumeración es el orden de las secciones. Y toda sección que se cuenta lleva
`id` y entrada en el índice: si no está en el índice, para quien lo usa no
existe.

**El efecto secundario que hay que revisar al reordenar.** Mover bloques rompe
las referencias del texto. Dos frases apuntaban hacia atrás y pasaron a apuntar
hacia delante:

- «La línea que hay que cruzar aquí es la misma que es la meta de la carrera»,
  escrita cuando la carrera ya se había visto. Ahora lleva «más abajo».
- «Y ese banco se juega con quien quieras»: su antecedente estaba en la sección
  que iba justo antes, y al cambiarla el «ese» se quedó sin referente.

Después de reordenar se lee la página entera seguida, buscando cada «ese»,
«aquí», «arriba», «como decíamos» y «el de antes».

### 2026-09-14 - Un `FAQPage` en el layout raíz se declara en todas las páginas

examia tenía dos. Uno en el grafo de `layout.tsx` y otro dentro de la sección
«¿Y esto de certificarse qué es?», los dos en la portada.

Lo del layout es lo grave: **el layout raíz se renderiza en todas las
pantallas**, así que el grafo prometía las preguntas frecuentes en
`/certificaciones`, en `/formato` y en cada una de las ochenta y tantas fichas
del catálogo, donde ese texto no aparece por ningún lado. Declarar respuestas
que no están en el HTML es justo la condición de la penalización, y estaba
ocurriendo en casi todas las URLs del sitio en vez de en ninguna.

**Qué va en el layout raíz y qué no.** Solo lo que es verdad en **todas** las
páginas: quién es el sitio, qué aplicación es, de quién es. Un `FAQPage`, un
`Product`, un `Article` o un `BreadcrumbList` describen **una** página y se
emiten desde esa página.

Se comprueba contando, no leyendo el código:

```bash
curl -s localhost:3100/ | grep -c '"@type":"FAQPage"'                        # 1
curl -s localhost:3100/certificaciones/aws-cloud-practitioner | grep -c FAQPage  # 0
```

### 2026-09-14 - Una portada que enseña qué se puede hacer y no cómo se hace

La portada de examia contaba muy bien los tres modos de juego -solo, con
amigos, corriendo- y no contaba en ningún sitio **cómo se llega hasta ahí**: de
dónde salen las preguntas, si hay que escribirlas a mano, qué hace falta tener
antes de poder retar a nadie. Se pasaba del muro de insignias al vídeo de
coches.

Quien ya conoce el producto rellena ese hueco solo, y por eso no se ve al
revisarla: el que la escribe siempre sabe cómo funciona. Quien llega de un
buscador ve un catálogo, un marcador y un circuito en 3D, y no sabe qué
tendría que hacer él.

Lo mismo con lo que tranquiliza. Que es gratis, que no pide tarjeta y que los
invitados no se registran estaba contestado **solo en las preguntas
frecuentes**, al final de una página muy larga. Son las tres dudas que deciden
si alguien sigue leyendo, y se contestaban después de haberle pedido que
siguiera.

**Qué lleva una portada de la zona, además de lo que ya está escrito arriba:**

- Un bloque de **cómo funciona en tres pasos**, después de la prueba o la
  demostración y antes del detalle. Es la pieza más acogedora que hay, y de
  paso sirve de índice de lo que viene debajo si el último paso nombra las
  secciones siguientes en su orden.
- Lo que **quita el miedo, arriba**: precio, si pide tarjeta, si hay que
  registrarse. Nunca solo en las preguntas frecuentes.
- Frases **cortas** en lo primero que se lee. La entradilla de examia era una
  sola de 33 palabras con dos subordinadas.

**Un detalle de la pastilla.** `.pastilla` es monoespaciada porque está pensada
para un dato. Una frase entera metida dentro se lee como un trozo de código, no
como algo que tranquiliza, y en un teléfono de 390 px tres frases ocupan tres
líneas justo encima de lo que hay que tocar. Dos o tres palabras por pastilla.

### 2026-09-14 - Dos destinos del índice puestos uno al lado del otro

**Qué pasó.** Al rehacer la portada de `examia` los dos bloques de preguntas
-"Qué es certificarse" y "Preguntas sobre examia"- se pusieron en dos columnas
de la misma fila, para que ocuparan menos. Los dos son destinos del índice
lateral, y el segundo dejó de encenderse: la barra marca dónde estás mirando
qué sección se está viendo, y dos bloques que empiezan a la misma altura están
siempre visibles los dos a la vez.

**Por qué está mal.** No es un fallo del observador ni del CSS: es que la
pregunta "¿en cuál de los dos estoy?" no tiene respuesta. Nunca hay un momento
en que se esté en uno y no en el otro. Cualquier desempate que se invente ahí
-el primero del DOM, el más alto, el más grande- es una respuesta arbitraria a
una pregunta mal planteada.

**Qué se hace.** Si el índice promete dos destinos, tienen que ser **dos sitios
distintos de la página**, uno debajo del otro. Uno al lado del otro no son dos
sitios: son uno. Y se comprueba con el navegador, haciendo `scrollIntoView` de
cada ancla y mirando qué enlace lleva `aria-current`: todas o ninguna.

### 2026-09-14 - El gesto de la marca, girado y medio transparente

**Qué pasó.** El resultado del reto de la portada de `examia` marca el mínimo de
aprobación sobre una barra de puntaje. Se puso reutilizando `.corte` -la firma
del sitio, un trazo ámbar discontinuo- girado noventa grados, de un píxel de
ancho y con la opacidad del 55% que trae la clase. En la captura de revisión
simplemente no estaba: el corte del 72% no se veía por ningún lado.

**Por qué está mal.** Por dos cosas a la vez. La primera, que un trazo
discontinuo al 55% sobre un píxel de ancho no se ve, y eso no lo detecta ningún
`build`: compila, despliega, y el dato que da sentido a la pantalla no está.
La segunda, que aunque se hubiera visto estaría mal: una versión girada y medio
transparente de la firma no es la firma, es una raya que se le parece, y eso ya
se anotó una vez en este mismo repo.

**Qué se hace.** La firma se usa donde es la firma -una vez por página- y donde
hace falta marcar un eje se dibuja una marca de eje: trazo sólido, opaco, y con
su número al lado. Y todo lo que pinta un dato se mira en una captura antes de
darlo por bueno, no solo en el código.

### 2026-09-14 - Un formateador sin la configuración de la casa

**Qué pasó.** Para dejar limpio el sangrado de unos componentes de `examia` se
ejecutó `npx prettier --write` sobre cuatro archivos. El repo no tiene
`.prettierrc`, así que prettier aplicó sus valores por defecto -comillas dobles
y punto y coma al final- y reescribió los cuatro archivos enteros en un estilo
que no es el del resto del código. `eslint` y `tsc` pasaron igual: nada de eso
es un error, solo es otro estilo.

**Por qué está mal.** Un formateador sin configuración no respeta el estilo del
proyecto: lo sustituye por el suyo. Y como toca cada línea, el diff deja de
decir qué se cambió de verdad: cuatro archivos aparecen reescritos enteros
cuando lo único que se quería era mover un comentario de sitio.

**Qué se hace.** Antes de ejecutar un formateador se mira si el repo tiene
configuración. Si no la tiene, el estilo se saca del código que ya está escrito
y se le pasan las opciones a mano -aquí `--no-semi --single-quote
--print-width 100`-. Y después se comprueba: abrir un archivo formateado y
compararlo con uno que no se tocó es un segundo y caza esto entero.

**Mejor todavía:** si la única razón para formatear es un bloque que quedó mal
indentado, se arregla ese bloque a mano y no se pasa nada por el resto.

### 2026-09-14 - Un `next dev` de horas sirviendo una hoja de Tailwind vieja

**Qué pasó.** Al dar más aire a la portada de `examia` se cambiaron los
espaciados del hero a `pt-14 sm:pt-24`. En la captura de revisión el titular
salía pegado al borde de arriba, cortado. El código era correcto: la clase
estaba en el marcado, `tsc` y `eslint` pasaban, y el componente era el que se
estaba mirando.

Medido en el navegador, `getComputedStyle(cabecera).paddingTop` daba `0px`. Y
bajando la hoja que servía el dev, `.pt-14` y `.sm\:pt-24` **no existían en
ella**: seguían las utilidades de la versión anterior del archivo. El servidor
llevaba horas levantado y su capa de Tailwind se había quedado atrás.

**Por qué está mal.** Porque el fallo se disfraza de error de diseño. Lo que se
ve es "el espaciado no funciona", y la reacción natural es cambiar el valor,
probar otra clase o meter un estilo en línea: tres cambios para arreglar algo
que no estaba roto. Y peor: **todas las capturas tomadas contra ese servidor
son mentira**, así que la revisión visual de esa sesión no vale.

**Cómo se reconoce.** La clase está en el HTML, el valor calculado es el de
por defecto, y la utilidad no aparece en la hoja servida. Dos comprobaciones de
diez segundos:

```
getComputedStyle(el).paddingTop        // dice 0px con la clase puesta
curl <la hoja .css del dev> | grep pt-14   // no está
```

**Qué se hace.** Cuando un cambio de espaciado, color o tamaño "no hace nada",
antes de tocar el valor se **mide**, y si la utilidad no está en la hoja se
reinicia el servidor con `rm -rf .next`. Y las capturas de revisión se toman
contra un servidor recién levantado, no contra uno que lleva toda la sesión
encendido.

### 2026-09-14 - Medir un contraste parseando `getComputedStyle` con una regex

**Qué pasó.** La portada de `examia` estrenó una banda negra de cierre, y para
comprobar que el texto encima cumplía se midió el contraste en el navegador
sacando los colores con `getComputedStyle` y leyendo los números con
`match(/[\d.]+/g)`. Salió `titular 1.48x` y `párrafo 1.01x`: valores
imposibles, porque el titular era blanco sobre casi negro.

**Por qué está mal.** El tema de la zona está escrito en `oklch`, así que el
navegador devuelve los colores computados en `lab(8.22 0.15 -8.03)`. Una regex
de números lee eso como si fueran R, G y B y da basura. Lo peligroso es que
**no falla: devuelve un número**, y un número con dos decimales se copia a un
comentario y se queda ahí como si estuviera medido. Es el mismo fallo que ya
está anotado -"el comentario decía que los contrastes estaban medidos"- pero un
paso más adentro.

**Qué se hace.** El contraste se mide **pintando**, no parseando. Un lienzo de
un píxel: se rellena con el color de fondo, se rellena encima con el del texto
-que así resuelve su alfa y su espacio de color solo- y se lee el píxel. Eso da
sRGB de verdad, que es lo que ve el ojo, sea cual sea la notación del tema.

```js
const g = document.createElement('canvas').getContext('2d')
g.fillStyle = fondo;  g.fillRect(0, 0, 1, 1)
g.fillStyle = tinta;  g.fillRect(0, 0, 1, 1)
const [r, v, a] = g.getImageData(0, 0, 1, 1).data
```

**La regla general:** cuando una medición da un valor que contradice lo que se
ve en la pantalla, el sospechoso es la medición, no la pantalla.

### 2026-09-14 - Una prueba atada al nivel del encabezado, no al rótulo

**Qué pasó.** Ya está anotado que una prueba no se ata al rótulo de una
sección. Esta vez se ató a su **nivel**: el arnés de la portada de `examia`
comprobaba que cambiar de insignia cambia el examen leyendo
`#tu-examen h3`. Al meter partes en el documento, los apartados bajaron de `h2`
a `h3` y el nombre del examen de `h3` a `h4`. La prueba siguió encontrando un
`h3` -el titular del apartado- y falló diciendo que el examen no cambiaba,
cuando cambiaba perfectamente.

**Por qué está mal.** Es el mismo fallo de antes con otra ropa. `h3` no es el
nombre de nada: es dónde cae ese texto en la jerarquía de hoy, y la jerarquía se
mueve cada vez que se reorganiza la página. Peor que fallar sería lo contrario:
que siguiera pasando porque quedó **algún** `h3` en ese apartado, y entonces la
prueba deja de comprobar lo que dice comprobar.

**Qué se hace.** El elemento que una prueba necesita señalar lleva su propio
gancho -`data-ficha="nombre"`- y la prueba se agarra a eso. Un `data-*` no
cambia al reescribir un titular ni al reordenar el documento, y deja escrito en
el marcado que ese nodo lo mira alguien más. Ni el texto ni la etiqueta HTML
sirven para eso: los dos son presentación.

### 2026-09-15 - `overflow-hidden` recortando contenido y una comprobación que decía que todo iba bien

**Qué pasó.** La portada de `examia` lleva reglas y bandas que se salen del
respiro lateral de `<main>` con márgenes negativos, y para que eso no saque una
barra de desplazamiento horizontal `<main>` tiene `overflow-hidden`. La
comprobación de responsive era `scrollWidth - clientWidth`, y daba **0 px en
los tres anchos que se miraban**.

Daba cero porque `overflow-hidden` no evita el desbordamiento: lo **recorta**.
En un teléfono de 390 px el titular y la entradilla salían 28 px fuera y se
cortaban por la derecha; a exactamente 1024 px, la URL `examia.kgstudio.top/jugar`
-una sola palabra de 25 caracteres que no parte- reventaba su columna y se
comía 13 px. Se veía en la captura, pero la cifra decía que no pasaba nada y la
cifra ganó.

**Por qué está mal.** Una comprobación que devuelve un número tranquilizador
sobre algo que está roto es peor que no tener comprobación: apaga la sospecha.
Y el fallo aparece **solo en anchos concretos** -a 390 sí, a 430 no, a 1024 sí,
a 1280 no- así que mirar dos tamaños no lo encuentra.

**Qué se hace.** Dos cosas.

Medir lo que de verdad importa: recorrer los elementos y quedarse con los que
tienen `getBoundingClientRect().right` mayor que el borde del contenedor. Eso
sí ve lo recortado, y se barre en **una docena de anchos**, incluidos los
límites exactos de los puntos de ruptura (639/640, 767/768, 1023/1024), que es
donde una rejilla cambia de forma y algo deja de caber.

Y arreglarlo en la causa, que casi siempre es una de estas dos:

- **Un hijo de rejilla o de flex sin `min-w-0`.** El mínimo automático de una
  pista es el contenido mínimo de lo que lleva dentro, así que un campo, una
  tabla o una palabra larga la empujan más allá del contenedor. `min-w-0` es
  lo que le da permiso para encoger.
- **Una palabra que no parte** -una URL, un código, un identificador-.
  `break-words` en el elemento que la contiene.

### 2026-09-15 - Un `aria-label` tapando justo el dato que hacía falta

**Qué pasó.** Las opciones del reto de la portada de `examia` llevaban
`aria-label={`Opción ${letra}: ${texto}`}`. Al contestar, la correcta se marca
con la palabra "correcta" y la que marcaste con "la tuya", dentro del mismo
botón. Quien usa lector de pantalla recorría las cuatro opciones después de
contestar y oía las cuatro **exactamente igual**: el `aria-label` sustituye al
contenido entero, así que las dos palabras que decían lo único importante -qué
era correcto y qué habías marcado- no se pronunciaban nunca.

**Por qué está mal.** `aria-label` no añade: **reemplaza**. Poner uno "para que
se lea mejor" congela el nombre accesible en el momento en que se escribió, y
cualquier cosa que el componente pinte después dentro de ese elemento deja de
existir para quien no ve la pantalla. Aquí el `aria-label` solo aportaba la
letra -"a", "b"-, que es una muleta visual que nadie necesita oír.

**Qué se hace.** El nombre accesible sale del contenido, y lo que es decoración
se oculta con `aria-hidden` -la letra-. Un `aria-label` solo cuando no hay
contenido que nombrar: un botón de solo icono, un campo sin etiqueta visible.

**Y un detalle que se ve al comprobarlo:** dos `<span>` hermanos se concatenan
**sin espacio** al calcular el nombre, así que salía
"...perfil de instanciacorrecta". Se arregla con un nodo de texto de un espacio
entre los dos. Esto no se ve leyendo el JSX: se ve leyendo el `textContent` del
botón en el navegador.

### 2026-09-15 - `eager` en 49 imágenes que ya no estaban arriba del pliegue

**Qué pasó.** La pared de insignias de la portada de `examia` pedía sus 49
imágenes con `loading="eager"` y `fetchPriority="high"`. Estaba bien puesto: la
regla de la zona es que lo de arriba del pliegue se pide `eager`, y la pared era
lo primero de la página.

Después se le puso una cabecera delante. Medido en una pantalla de 1440x900, la
pared arranca **691 px por debajo del pliegue**. La regla seguía escrita en el
código, pero su premisa se había ido: quedaban 49 peticiones a un CDN ajeno
marcadas como urgentes, disputándole el ancho de banda a lo único que sí se ve
al entrar.

**Por qué está mal.** Una optimización lleva dentro una suposición sobre el
diseño -"esto se ve primero"-, y el diseño se mueve. Cuando se mueve, la
optimización no se vuelve inútil: se vuelve **dañina**, porque sigue gastando el
presupuesto de red en lo que ya no toca. Y no avisa: no hay error, no hay aviso
de `build`, y la página se ve bien.

**Qué se hace.** Al mover un bloque de sitio se revisa lo que dependía de dónde
estaba. Y la pregunta se contesta midiendo, no de memoria:

```js
el.getBoundingClientRect().top - window.innerHeight   // < 0 está arriba del pliegue
```

**Un matiz que conviene saber:** quitar `eager` no quitó las peticiones. El
umbral de carga diferida de Chromium cubre de sobra esos 691 px, así que las 49
salen igual al cargar. Lo que cambia es que ya no van marcadas como urgentes.
Conviene no vender como "49 peticiones menos" lo que es "49 peticiones que ya no
adelantan a las importantes".

### 2026-09-15 - Una pestaña de fondo dejando la carrera abierta para todos

**Qué pasó.** En una carrera de sala, cada navegador avisa al servidor por dónde
va su coche cada 2,5 segundos, y el servidor cierra la carrera cuando nadie sin
cruzar la meta ha avisado en los últimos 45 segundos.

El bucle de dibujo va con `requestAnimationFrame`, que el navegador **congela**
al pasar la pestaña a segundo plano. El sondeo va con `setTimeout`, que **no se
congela**. Así que una pestaña de fondo seguía mandando la misma posición una y
otra vez, refrescando su marca de "sigo vivo" con un coche que llevaba parado
diez minutos. Los demás cruzaban la meta y la carrera no se cerraba hasta que
esa persona volvía a la pestaña o la cerraba.

**Por qué está mal.** Es el mismo fallo que ya estaba anotado -"mirar no es
correr", por quien abre la pantalla y no pulsa Arrancar- entrando por otra
puerta. Y es difícil de ver porque **las dos mitades funcionan**: el juego
avanza bien y el sondeo avisa bien; lo que falla es que dejan de estar de
acuerdo cuando el navegador para una y no la otra.

**Qué se hace.** Con la pestaña oculta se **lee sin avisar**: se sigue pidiendo
por dónde van los demás, pero no se manda la posición propia, así que el
silencio deja de bloquear a nadie y a los 45 segundos el servidor cierra. Al
volver, el primer aviso devuelve el coche a la pista.

**La regla general:** siempre que un temporizador y `requestAnimationFrame`
lleven la misma cuenta, hay que decidir qué pasa cuando el navegador congela uno
y no el otro. `document.hidden` es la pregunta, y hay que hacerla explícitamente
en el temporizador.

### 2026-09-15 - `setInterval` para sondear, y las respuestas llegando desordenadas

**Qué pasó.** El marcador de una sala se refrescaba con
`setInterval(tick, 4000)`. `setInterval` dispara pase lo que pase, sin esperar a
que termine la petición anterior: con la red de un móvil en una sala -que es la
única red que importa aquí- las peticiones se amontonan, varias quedan en vuelo
a la vez y las respuestas pueden llegar desordenadas. Una respuesta vieja que
llega después de una nueva repinta el marcador **hacia atrás**.

La carrera, en el mismo repo, ya lo hacía bien con `setTimeout` encadenado.

**Qué se hace.** Para sondear, `setTimeout` encadenado: se programa el siguiente
cuando el anterior ha terminado. Nunca hay dos en vuelo y la última respuesta es
siempre la más nueva. `setInterval` sirve para un reloj que no hace E/S -el
contador de segundos de un examen-, no para pedir cosas por red.

Y de paso, dos cosas que un sondeo tiene que llevar siempre:

- **Parar con la pestaña oculta**, y mirar de inmediato al volver. Nadie está
  viendo esa pantalla, y al otro lado hay un móvil gastando batería.
- **Frenar cuando falla.** Sin espera creciente, un servidor caído recibe quince
  peticiones por minuto y por persona justo cuando menos puede con ellas.

### 2026-09-15 - Un criterio prometido en la portada que el producto no aplicaba

**Qué pasó.** La portada de `examia` dice, con todas las letras: "cuando tres
seguidos cruzan el corte es cuando se agenda el examen". Es el consejo más
concreto de toda la página de venta. Dentro de la aplicación, **ese criterio no
existía en ninguna parte**: la pantalla de un banco enseñaba una tabla de temas,
una lista de intentos y un promedio, y dejaba el juicio al usuario.

Y el archivo que debía responderlo, `estadisticas.ts`, abría literalmente
diciendo "lo que responde la única pregunta que importa: ¿ya estoy listo para
presentar?" para después no responderla: cuatro consultas de datos crudos y
ninguna conclusión.

**Por qué está mal.** Dos cosas distintas, y las dos cuestan.

La primera es de producto: quien prepara una certificación no quiere una tabla,
quiere saber si ya puede pagar los 150 dólares del examen. Enseñar datos y
llamar a eso "estadísticas" es dejarle el trabajo difícil -el juicio- a quien
menos preparado está para hacerlo, que es justamente quien todavía no sabe el
tema.

La segunda es de confianza: un criterio que se promete en la página de venta y
no aparece en el producto es una promesa a medias. Quien llega por esa frase
espera encontrársela dentro.

**Qué se hace.** Cuando el texto comercial afirme una regla -"tres seguidos",
"en menos de un minuto", "sin cuenta"-, esa regla se **implementa y se prueba**,
o se quita del texto. No hay una tercera opción.

Y el juicio vive en el dominio, no en la pantalla: es una decisión de producto y
tiene que decir lo mismo se pinte donde se pinte. Con la parte pura separada de
la consulta -entran los puntajes, sale el veredicto- se prueba la regla entera
sin montar cuentas: qué pasa con una racha rota, con el corte exacto, con pocas
muestras. Los casos que se equivocan no son los bonitos: son el suspenso
reciente detrás de cuatro aprobados, que una implementación que cuente
"aprobados" en vez de "seguidos desde el final" da por bueno.

### 2026-09-16 - Una portada que empezaba con jerga y una orden

**Qué pasó.** La portada de `examia` pasó a ser el producto funcionando en una
sola pantalla, y lo primero que decía era **"Contéstale una a SAA-C03"**.

Funcionaba perfectamente para quien ya conocía el sitio, que es exactamente
quien no necesita la portada. A quien llega de un buscador le llegaban, en este
orden: una orden en imperativo, una sigla que no significa nada y un control
para elegir algo que no sabe qué es. Ni una frase que dijera qué es examia.

**Por qué está mal.** "Enseñar el producto en vez de hablar de él" es una buena
decisión, y al aplicarla se cayó en el extremo contrario: **cero contexto**.
Probar algo antes de saber qué es no es una demo, es un examen sorpresa. Y el
fallo no se ve desde dentro, porque quien diseña la pantalla ya sabe lo que
hace cada cosa.

**Qué se hace.** Lo mínimo que necesita alguien que llega de cero, y en este
orden:

1. **Una frase que diga qué es esto**, en castellano llano y sin nombres de
   producto, antes de cualquier control.
2. **Los pasos numerados** si hay más de uno. Dos números -"1 · ¿Qué preparas?",
   "2 · Contéstale una"- quitan toda la duda sobre qué hacer y cuestan dos
   líneas.
3. **Ninguna sigla sola.** "SAA-C03" va siempre con su nombre completo y sus
   datos al lado. Un código es una etiqueta para quien ya lo conoce y ruido
   para todos los demás.

**La comprobación que lo caza:** leer la pantalla entera imaginando que no se
sabe nada del producto, y preguntarse si se entiende qué es y qué hay que hacer
antes de tocar nada.

### 2026-09-16 - Un arnés que gritaba donde no pasaba nada

**Qué pasó.** El arnés `test:anchos` busca contenido que se sale de su
contenedor, y empezó a marcar cuarenta insignias en cuatro anchos. No había
nada roto: son una tira con `overflow-x: auto`, que se desplaza a lo ancho a
propósito.

**Por qué está mal.** El arnés existe para cazar contenido **recortado** -lo que
se sale y no hay forma de ver-, y lo que vive dentro de un carrusel se sale y sí
se llega a ello. Un arnés que grita donde no pasa nada se acaba ignorando, y
entonces deja de servir también para lo que sí importa. Un falso positivo
repetido cuesta más que no tener la comprobación.

**Qué se hace.** Se excluye lo que cuelga de un ancestro con `overflow-x: auto`
o `scroll`. La regla general: cuando una comprobación empiece a fallar en algo
que es correcto, se afina la comprobación en el mismo momento; posponerlo es
como se enseña a la gente a ignorar los avisos.

### 2026-09-16 - Un arnés que defendía una decisión y no una promesa

**Qué pasó.** La portada de `examia` se rehízo: era una sola pantalla sin
scroll con el producto dentro, y volvió a crecer con secciones porque como
página completa no contestaba las dos preguntas que deciden una portada -de
dónde salen las preguntas, y por qué esto y no un test gratis cualquiera-.

En el arnés había una comprobación que medía `scrollHeight <= innerHeight` con
el comentario "una pantalla es una pantalla, es la premisa entera del diseño".
Al reformar, esa comprobación falló sin que nada estuviera roto.

**Por qué está mal.** Una comprobación puede atarse a lo que la página
**promete** -que se entienda qué es antes de pedir nada, que se pueda tocar el
producto, que diga que es gratis sin bajar- o a **cómo se decidió resolverlo
esta vez** -que quepa en un alto de ventana-. Lo primero sobrevive a un
rediseño y lo segundo lo estorba: la comprobación se convierte en un voto
permanente a favor de una maquetación concreta, y el día que esa maquetación
deja de servir, el arnés grita y quien reforma aprende a saltárselo.

Es el mismo fallo que ya está anotado tres veces en este repo con otra ropa
-una prueba atada al primer `h1`, otra al primer `p`, otra a la altura- y
siempre acaba igual: se ignora el aviso.

**Qué se hace.** Al escribir una comprobación de interfaz, preguntarse si lo
que mide seguiría siendo verdad en un rediseño que resolviera lo mismo de otra
forma. Si la respuesta es no, se mide otra cosa. Aquí las tres de altura se
cambiaron por: que existan las secciones que la portada promete, que "es
gratis, no pide tarjeta" caiga dentro de la primera pantalla medido en píxeles,
y que en algún sitio se diga de dónde salen las preguntas.

**Y lo que la reforma arregló, que es lo de siempre:** enseñar el producto en
vez de hablar de él es buena decisión, pero un producto sin contexto no
convence de nada. La portada nueva toca primero -la pregunta contestable sigue
siendo lo primero que se ve- y explica después, en tres pasos, de dónde sale el
banco. Toda portada de la zona lleva ese bloque, y esta lo había perdido.

### 2026-09-16 - Un atajo en tiempo real que no atajaba, y nadie se enteraba

**Qué pasó.** Se añadió a las salas de `examia` un "timbre": un aviso por
Supabase Realtime que suena cuando el anfitrión arranca la partida, para que las
pantallas de los demás no tengan que esperar a su siguiente sondeo. El marcador
lo escucha y, al oírlo, va y pregunta.

Funcionaba en el papel y no funcionaba en la pantalla. `createBrowserClient` de
`@supabase/ssr` devuelve **siempre el mismo cliente**, y un cliente de Supabase
no admite dos canales suscritos al mismo tema: el que escuchaba abría
`sala:ABC12` y el que tocaba abría otro `sala:ABC12`, y esa segunda suscripción
se quedaba esperando para siempre. En la pantalla de la sala, donde el anfitrión
escucha y toca a la vez, el timbre no sonaba nunca.

**Por qué no se vio.** Porque no se rompió nada. No hubo excepción, no hubo nada
en la consola, y la partida arrancaba bien para todos: el sondeo hacía su
trabajo, como lo hacía antes de existir el timbre. Un atajo que falla en
silencio detrás de un camino que funciona es invisible por definición.

Se vio midiendo, y solo midiendo: el aviso le llegaba al invitado exactamente
cuando tocaba el siguiente sondeo, ni un milisegundo antes. Y ni siquiera eso
bastó a la primera, porque con el sondeo a segundo y medio los dos números se
parecen demasiado. Hubo que **subir el sondeo a 30 segundos** y volver a medir:
si el aviso sigue llegando en 3 y no en 24, el atajo existe.

**La regla.** Una optimización que se apoya en el camino lento como red de
seguridad **no se puede dar por buena porque la pantalla salga bien**. La
pantalla va a salir bien igual. Hay que medir que el atajo atajó, y para
medirlo hay que dejar el camino lento tan lento que no se pueda confundir con
el rápido.

**Y lo que la medición enseñó de paso, que era lo importante.** Puestos a
cronometrar, salieron los números de verdad: verificar el token contra Supabase
cuesta **183 ms** y una consulta a Postgres **81 ms**. O sea que la ruta del
marcador, que hacía cinco viajes por sondeo, gastaba medio segundo para
devolver algo que cambia dos veces por minuto, y ese era el motivo real por el
que el sondeo no podía bajar de cuatro segundos: no era el número correcto, era
lo que aguantaba la cuenta.

Antes de cambiar el transporte -websockets, SSE, long polling- hay que mirar lo
que cuesta cada viaje. Casi siempre el problema no es cada cuánto se pregunta,
es lo que se hace en cada pregunta.

### 2026-09-16 - Tres comprobaciones que pasaban por la razon equivocada

**Qué pasó.** Al escribir el arnés del informe de clase de `examia` -una
profesora, dos alumnos por código, un repaso- tres comprobaciones seguidas
dieron verde sin medir lo que decían medir:

1. **"El tema peor sale primero"**, escrita nombrando el tema: *Subredes antes
   que Redes*. Pero la sala reparte las preguntas con `order by random()`, así
   que cuál acaba peor depende de la partida. Fallaba y pasaba en ejecuciones
   seguidas sin tocar una línea.
2. **El mismo orden, ya sin nombres**, leyendo los porcentajes del texto de
   cada fila. `textContent` pega los nodos sin espacios: "2 de 2" seguido de
   "50.0%" devuelve **250**. La comprobación comparaba 250 con 250 y daba
   verde.
3. **"La profesora no sale como alumna"**, buscando su correo en la pantalla.
   Siempre fallaba, y no por el informe: la barra lateral enseña el nombre de
   la cuenta, así que el correo está ahí de todas formas.

**Por qué está mal.** Las tres son la misma familia y la de en medio es la
peligrosa: un arnés que falla se arregla, pero uno que **pasa por la razón
equivocada** se queda ahí dando confianza falsa durante meses. Las tres se
apoyaban en la presentación -el nombre del dato, el texto de la fila, el texto
de la página- en vez de en un asidero puesto para ellas.

**Qué se hace.** Lo que este repo ya hacía con `data-examen` en la portada, y
que hubo que aprender otra vez: **un atributo propio para lo que se comprueba**.
`data-tema` con `data-porcentaje` en cada fila, `data-alumnos` en cada fila de
la tabla, y el arnés lee atributos y no texto. Y el escenario se hace
determinista: la alumna contesta **según el tema que ve en pantalla**, no según
la posición de la pregunta, así que un tema acaba al 0% y el otro al 100% salga
el barajado que salga.

**La pregunta que las caza:** ¿esta comprobación podría dar verde estando el
producto roto? Si la respuesta no es un no rotundo, no mide nada.

### 2026-09-16 - El profesor salia en su propio informe como un alumno que no hizo nada

**Qué pasó.** El informe de clase listaba a **quien montó la sala** entre los
alumnos: con cero respuestas, con su correo por nombre, y contando además en
"entraron a la sala" y en "no contestaron nada". Una profesora que proyecta el
código y se queda mirando -que es lo que hace un profesor- leía que un alumno
de su clase no había hecho nada, y ese alumno era ella.

**Por qué no se vio antes.** Porque no se ve leyendo el código ni pasando las
pruebas: todo estaba bien calculado. Se ve **mirando la pantalla con datos que
se parezcan a los de verdad**, y por eso el informe se pintó con cinco alumnos
de nombres reales y resultados distintos en vez de con dos filas de prueba. Con
dos filas no habría llamado la atención.

**Qué se hace.** No se quita siempre al dueño, porque en una sala entre amigos
quien la monta también juega y su fila es tan suya como las demás. La condición
es **haber jugado**, no ser dueño: se quita la fila solo si es el dueño y no
contestó nada.

**Y la regla de fondo:** una pantalla nueva se mira con el contenido que va a
tener en uso, no con el mínimo que hace falta para que compile. Cinco nombres y
resultados variados enseñan lo que dos filas de "Ana" y "Bruno" esconden.


### 2026-09-22 - Las rayas largas sobrevivieron dentro de los `sitemap.xml`

**Qué pasó.** La limpieza del 2026-08-31 dejó dos: el `<image:title>` del hub
decía "Kevin Gonzalez — kagonzalezdev" y el de Distribuciones AGD,
"Distribuciones AGD — pinturas y ferretería en Bogotá".

**Por qué está mal.** Un `image:title` es contenido servido y es de los pocos
textos de la zona que Google lee palabra por palabra. Y el barrido se hizo sobre
HTML, JS y TSX, así que el `.xml` no entró en la búsqueda: la regla no falló, la
lista de extensiones sí.

**Qué se hace.** El barrido de rayas largas incluye `.xml`, `.txt` y `.json`
además del código. Lo que se sirve al público no se filtra por extensión.

### 2026-09-22 - Un sitio de la zona publicado sin `llms.txt`

**Qué pasó.** `parla.kgstudio.top/llms.txt` devolvía 404. Tenía `robots.txt`,
`sitemap.xml`, canonical, Open Graph y el `@graph` con el `@id` del hub: todo
menos la pieza que leen los buscadores con IA.

**Por qué está mal.** La tabla de "lo mínimo antes de considerarse publicado"
lista siete piezas y cumplir seis no es cumplirla. El `llms.txt` es además el
único sitio donde parla puede decir en prosa que interpreta y no responde, que
es lo que lo distingue de un traductor.

**Qué se hace.** Antes de dar por publicado un sitio se piden las cuatro rutas a
producción -`/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`- y se miran los
códigos. Compilar no es publicar, y "estaba en el repo" no es "responde".

### 2026-09-22 - El portafolio describía a la persona en vez de citarla

**Qué pasó.** El JSON-LD del portafolio declaraba su propio
`portafolio.kgstudio.top/#person` con cargo, estudios, dirección, `knowsAbout` y
un `worksFor` que además contradecía al del hub. Y en el comentario de al lado
estaba escrita la regla que incumplía: "el resto de sitios citan su `@id` en vez
de volver a describirla".

**Por qué está mal.** Dos fichas de la misma persona con `@id` distintos son dos
personas para un buscador, que es justo lo que el grafo de entidades existe para
evitar. Y son dos sitios donde corregir el mismo dato el día que cambie.

**Qué se hace.** El nodo `Person` de cualquier sitio de la zona lleva
`"@id": "https://kgstudio.top/#kevin"` y solo lo justo para entenderse suelto:
nombre, alias, url y cargo. Lo demás vive en el hub. Un comentario que enuncia
una regla no la cumple: se comprueba con `grep 'kgstudio.top/#kevin'` sobre el
HTML servido, que es donde se ve.

### 2026-09-22 - `lastmod` con `new Date()`, con la regla ya escrita

**Qué pasó.** El fallo del 2026-09-04 se corrigió en examia, monetiq y autoreel,
pero portafolio y parla siguieron fechando sus URLs con la hora de la petición.
El portafolio además listaba cinco anclas (`/#about`, `/#stack`...) como URLs
propias.

**Por qué está mal.** Lo primero ya está explicado arriba. Lo segundo es la
misma página declarada seis veces: un buscador recorta el fragmento y se queda
con la portada.

**Qué se hace.** Cuando una entrada del registro se corrige, se corrige en
**todos** los repos a la vez y se deja constancia de cuáles se miraron. Arreglar
el sitio donde se descubrió y dar el fallo por cerrado es lo que hizo falta
volver a arreglar hoy.

### 2026-09-22 - El README del hub explicaba una interfaz que ya no existía

**Qué pasó.** Describía un índice de nombres en `<ul class="index">` con
`data-text`, donde una copia naranja se despliega al confirmar el estado. La
página es desde hace tiempo un sistema orbital en Three.js con `<a class="node">`
y `<ul class="rows">`, y el estado lo marca un punto. La tabla de sitios de la
zona iba por cinco de once.

**Por qué está mal.** Es lo primero que se lee antes de tocar el repo, y un
ejemplo de "cómo agregar un sitio" copiado de ahí produce marcado que la página
ignora en silencio.

**Qué se hace.** El README se revisa en el mismo commit que cambia la estructura
que describe. Un ejemplo de marcado se copia del `index.html` de verdad, no se
escribe de memoria.

### 2026-09-22 - Un `og:image` declarado y un archivo que no existía

**Qué pasó.** El layout de monetiq declaraba
`images: [{ url: '/og-image.png', width: 1200, height: 630 }]` y ese PNG no
estaba en `public/`. La etiqueta salía perfecta en el HTML, con sus medidas y
su `alt`, y `https://monetiq.kgstudio.top/og-image.png` contestaba 404: cada
enlace compartido en WhatsApp o LinkedIn salía como una tarjeta gris.

**Por qué no se vio antes.** Porque revisar el SEO leyendo el HTML lo da por
bueno: la etiqueta está, las medidas están, el `twitter:card` es el que toca.
El fallo está al otro lado de la URL, y solo aparece pidiéndola.

**Qué se hace.** La imagen de compartir se genera con `opengraph-image.tsx`,
que es la convención de archivo de Next: si el archivo no está, no compila.
Una ruta escrita a mano en el metadata no avisa de nada. Y en cualquier
revisión de SEO, el `og:image` no se lee: se pide, y se mira que conteste 200
con un `content-type` de imagen.

### 2026-09-22 - Tres marcas distintas para el mismo producto

**Qué pasó.** MonetIQ tenía el `favicon.ico` de la plantilla de Next -un
triángulo blanco sobre un círculo negro-, los cinco iconos de la PWA con una
**F** verde, de cuando el producto se llamaba de otra manera, y en la barra del
sitio y del tablero una **M** verde. Tres marcas a la vez, según dónde mires.

**Por qué no se vio antes.** Porque un PNG no se revisa en un diff. El código
que los referencia estaba perfecto; lo que estaba mal era el dibujo de dentro,
y eso solo se ve abriendo el archivo o instalando la aplicación.

**Qué se hace.** Los iconos se generan con un script -`npm run iconos`, que
dibuja el SVG y lo rasteriza con sharp- en vez de subirse a mano. Así el dibujo
vive en texto, se lee en la revisión y cambiar la marca es cambiar una
constante. La letra va como trazo y no como `<text>`, porque un `<text>` depende
de las fuentes de la máquina que corre el script y el mismo comando daría
iconos distintos en otro computador.

### 2026-09-22 - Cumplir una regla por accidente sigue siendo no cumplirla

**Qué pasó.** El `robots.ts` de parla no nombraba a ningún rastreador de IA.
No perdía nada -el comodín les abría lo mismo-, así que al revisar "¿entran
GPTBot y ClaudeBot?" la respuesta era que sí y la casilla quedaba marcada.

**Por qué está mal.** Lo que la tabla pide es que estén **nombrados**, y no
por gusto: el día que el grupo `*` se restrinja, un sitio que los nombra sigue
dándoles paso y uno que no, se los lleva por delante sin que nadie lo decida.
Una regla que se cumple sola hoy es una regla que se rompe sola mañana.

**Qué se hace.** Los cuatro agentes se nombran, cada grupo repite la lista de
rutas privadas -que no hereda del comodín, ver el 2026-09-04- y la lista se
declara una sola vez en una constante. Comprobado pidiendo el `robots.txt`
servido, no leyendo el código que lo genera.

### 2026-09-22 - Trabajo terminado viviendo en una preview

**Qué pasó.** monetiq-web trabaja en `dev`, que es la rama por defecto del
repo, pero Vercel publica su producción desde `main`. Así que cada push a `dev`
levantaba una preview y se daba por publicado. Cuando se miró, `main` estaba
tres commits atrás y dos de ellos eran de SEO, de 21 días antes: el sitio de
verdad llevaba tres semanas sin nada de aquello.

**Por qué no se vio antes.** Porque el push sale bien, Vercel construye, el
despliegue queda `Ready` y el correo dice que todo fue bien. La palabra
"Preview" está en la lista de despliegues, que es justo donde no mira nadie
después de un push que no dio error.

**Qué se hace.** En cualquier repo cuya rama por defecto no sea la de
producción, se empuja a las dos: `git push origin dev:main`. Y un cambio no se
da por publicado porque el push saliera bien, sino **pidiendo la URL de
producción** y viendo el cambio en la respuesta. Es la misma regla de siempre
-no vale con que compile- aplicada al despliegue.

### 2026-09-22 - El único enlace que Google seguía iba a la copia

**Qué pasó.** Buscando "distribuciones agd" no salía el sitio por ninguna
parte: el primer resultado de la marca era el repo de GitHub. Y el `homepage`
de ese repo apuntaba a `distribuciones-agd.vercel.app`, la URL que Vercel
asigna sola, no a `distribucionesagd.kgstudio.top`. El resultado mejor
posicionado del negocio mandaba a una copia.

**Por qué importa.** Un sitio nuevo en un subdominio no tiene autoridad
ninguna; la gana por los enlaces que apuntan a él. GitHub reparte mucha, y la
estaba repartiendo a la copia. El `canonical` evita que Google cuente dos
sitios, pero no traslada el enlace: ese sigue contando para la URL enlazada.

**Qué se hace.** Al publicar un sitio de la zona, el `homepage` del repo se
pone en el dominio real, no en el `.vercel.app`. Y se comprueba que el sitio
esté indexado de verdad con `site:<dominio>` en el buscador: la "prueba en
tiempo real" de Search Console solo dice que la página **se podría** indexar,
no que lo esté. Para saberlo está la pestaña "Índice de Google".

### 2026-09-22 - La descripción del repo es un snippet de Google

**Qué pasó.** Mientras el dominio no esté indexado, el repo es lo que sale
cuando se busca la marca, y su descripción es el texto que Google enseña
debajo. La de Distribuciones AGD hablaba de un "product carousel" retirado tres
commits antes, iba en inglés, y llevaba raya larga. Los `topics` decían
`bootstrap` y `jquery`, que ya no se usaban. El README describía entera la
plantilla anterior.

**Qué se hace.** La descripción, los `topics` y el README del repo de un sitio
de cliente son contenido público de cara al cliente, no notas internas: se
escriben en español, con acentos, sin rayas largas, y se revisan en el mismo
commit que cambia lo que describen. Si el sitio se rehace, el README se rehace.

### 2026-09-22 - Pedir un resultado enriquecido que la página no puede sostener

**Qué pasó.** Search Console dio ocho elementos no válidos en Distribuciones
AGD -"debe especificarse offers, review o aggregateRating"- y al revisar el
resto de la zona salían siete más en el hub por lo mismo. Eran categorías de
ferretería marcadas como `Product` y los diez productos del índice marcados
como `SoftwareApplication`.

**Por qué está mal.** Cada uno de esos tipos es una promesa: `Product` promete
la ficha de un producto con precio, valoración o reseña; `SoftwareApplication`
promete la tarjeta de una aplicación con su precio y su puntuación. Si la
página no tiene con qué cumplirla, la tarjeta no sale igual, y encima el
informe queda con errores fijos que tapan uno de verdad el día que aparezca.

**Qué se hace.** Se escoge el tipo por lo que la página **es**, no por el
resultado que se quiere:

| La página | El tipo |
| --- | --- |
| Un catálogo de familias, sin precios | `OfferCatalog` dentro de `OfferCatalog` |
| Un índice que enlaza sitios | `WebSite` por entrada |
| La página de una aplicación de verdad | `SoftwareApplication`, con su `offers` |

Y la línea que separa los dos casos: en AGD el tipo era **falso** -una
categoría no es un producto- y se cambia. En parla el tipo es **verdad** -es
una aplicación- y se deja, aunque falte `aggregateRating` y Search Console lo
avise. Un aviso de "no apta para la tarjeta" no baja posiciones. Lo que no se
hace nunca es inventar una valoración para apagar el aviso: eso es una reseña
falsa y es motivo de acción manual.

### 2026-09-22 - Un `FAQPage` parafraseando lo que dice la página

**Qué pasó.** Dos casos en la misma revisión. itep declaraba seis preguntas
que no están en ninguna parte: ni en el bloque estático ni en la aplicación
que lo reemplaza. reinicia declaraba cuatro de las cinco que sí se leen, y las
declaraba **con otras palabras**: a "¿Cuánto cuesta?" le faltaba media frase, a
"¿Dan garantía?" lo de los repuestos, y "¿Atienden Mac?" no estaba.

**Por qué está mal.** Un `FAQPage` declara que esas preguntas y esas respuestas
están en la página. Si no están, o están en otra versión, se le está contando
a Google una página que el visitante no ve.

**Qué se hace.** El texto del JSON-LD se **copia** del que pinta la página, sin
resumir ni pulir. Si una pregunta no está en la página, no se declara; si se
quiere declarar, se escribe primero en la página. La comprobación es mecánica:
extraer las preguntas del HTML servido, extraerlas del JSON-LD y compararlas.
