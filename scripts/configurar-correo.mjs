#!/usr/bin/env node
/**
 * Configura el correo transaccional del proyecto Supabase de la zona.
 *
 * Un solo proyecto de Supabase sirve la identidad de parla, examia, arriendos y
 * autoreel. Eso tiene una consecuencia que conviene tener presente antes de
 * correr esto: la configuración de correo es UNA, compartida. Lo que se cambia
 * aquí cambia el correo de confirmación y el de recuperación de los cuatro
 * sitios a la vez.
 *
 * Qué hace:
 *
 * 1. Apunta el correo saliente al SMTP de Brevo, en vez del servidor compartido
 *    de Supabase. Ese servidor manda con cuentagotas (unos pocos correos por
 *    hora para todo el proyecto) y por eso examia y autoreel tuvieron que crear
 *    las cuentas dando el correo por bueno: la confirmación no llegaba.
 * 2. Enciende la confirmación de correo. Sin correo confirmado no se puede
 *    recuperar una cuenta, porque no hay a dónde mandar el enlace con la
 *    certeza de que llega a su dueño.
 * 3. Declara las URLs de retorno de los cuatro sitios. Supabase rechaza
 *    cualquier `redirectTo` que no esté en esa lista, así que sin este paso el
 *    enlace del correo lleva a la portada del sitio y la recuperación muere ahí,
 *    sin decir por qué.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_...  \
 *   BREVO_SMTP_PASS=...            \
 *   node scripts/configurar-correo.mjs [--aplicar]
 *
 * Sin `--aplicar` solo enseña lo que va a mandar y lo que hay ahora. Que el
 * modo por defecto sea el de mirar es a propósito: esto toca la puerta de
 * entrada de cuatro sitios en producción.
 */

const REF = process.env.SUPABASE_PROJECT_REF ?? "jmbrxrgznflxunwvypau";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SMTP_PASS = process.env.BREVO_SMTP_PASS;
const APLICAR = process.argv.includes("--aplicar");

const SMTP = {
  host: "smtp-relay.brevo.com",
  port: 587,
  user: "aa2fb2001@smtp-brevo.com",
  // El remitente que ve quien recibe. Tiene que ser un dominio verificado en
  // Brevo; si no lo está, Brevo acepta la conexión y rechaza el envío, que es
  // el fallo más difícil de diagnosticar de los tres.
  senderEmail: process.env.BREVO_SENDER ?? "kgagudelo@gmail.com",
  senderName: "kgstudio",
};

/** Los sitios de la zona que usan esta identidad. */
const SITIOS = [
  "https://parla.kgstudio.top",
  "https://examia.kgstudio.top",
  "https://autoreel.kgstudio.top",
  "https://arriendos.kgstudio.top",
  "https://monetiq.kgstudio.top",
];

/*
 * A dónde se permite volver desde un enlace de correo.
 *
 * Se listan las rutas concretas y además un comodín por sitio para las
 * previews de Vercel, que cambian de URL en cada despliegue. Sin el comodín,
 * probar el registro en una preview siempre falla y parece que el código está
 * mal cuando lo que falta es una entrada en esta lista.
 */
const REDIRECCIONES = [
  ...SITIOS.flatMap((s) => [`${s}/**`, `${s}/auth/callback`]),
  "https://*-revkelos-projects.vercel.app/**",
  "http://localhost:3000/**",
];

if (!TOKEN) {
  console.error(
    "Falta SUPABASE_ACCESS_TOKEN.\n" +
      "Se saca en https://supabase.com/dashboard/account/tokens (Personal access token)."
  );
  process.exit(1);
}
if (!SMTP_PASS) {
  console.error(
    "Falta BREVO_SMTP_PASS.\n" +
      "Es la clave SMTP de Brevo (SMTP & API > SMTP), no la contraseña de la cuenta."
  );
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const cabeceras = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const antes = await fetch(api, { headers: cabeceras });
if (!antes.ok) {
  console.error(`No se pudo leer la configuración: ${antes.status} ${await antes.text()}`);
  process.exit(1);
}
const actual = await antes.json();

console.log("Ahora mismo:");
console.log(`  SMTP:              ${actual.smtp_host ?? "(el compartido de Supabase)"}`);
console.log(`  confirmar correo:  ${actual.mailer_autoconfirm ? "NO (autoconfirm encendido)" : "sí"}`);
console.log(`  URL del sitio:     ${actual.site_url}`);
console.log(`  redirecciones:     ${actual.uri_allow_list || "(ninguna)"}`);

const cambios = {
  smtp_host: SMTP.host,
  smtp_port: SMTP.port,
  smtp_user: SMTP.user,
  smtp_pass: SMTP_PASS,
  smtp_admin_email: SMTP.senderEmail,
  smtp_sender_name: SMTP.senderName,
  // Un envío por segundo. Brevo aguanta más, pero el límite protege de un
  // bucle de reenvíos que se coma la cuota diaria en un minuto.
  rate_limit_email_sent: 60,
  // Lo que enciende la verificación de correo en TODOS los sitios de la zona.
  mailer_autoconfirm: false,
  // Una hora para confirmar o recuperar: suficiente para quien lo abre en el
  // móvil más tarde, corto para que un correo reenviado no valga una semana.
  mailer_otp_exp: 3600,
  uri_allow_list: REDIRECCIONES.join(","),
};

console.log("\nSe va a poner:");
for (const [k, v] of Object.entries(cambios)) {
  console.log(`  ${k}: ${k === "smtp_pass" ? "(oculta)" : v}`);
}

if (!APLICAR) {
  console.log("\nEsto fue solo la vista previa. Vuelve a correrlo con --aplicar.");
  process.exit(0);
}

const res = await fetch(api, {
  method: "PATCH",
  headers: cabeceras,
  body: JSON.stringify(cambios),
});

if (!res.ok) {
  console.error(`\nFalló: ${res.status} ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}

console.log("\nAplicado. El correo de los cuatro sitios sale ya por Brevo.");
console.log(
  "Comprueba con un registro de verdad antes de darlo por bueno: que la API\n" +
    "acepte la configuración no significa que Brevo acepte el remitente."
);
