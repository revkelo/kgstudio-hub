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
