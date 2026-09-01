// Copia de seguridad de los esquemas que se van a mover.
//
// No hay pg_dump en esta maquina y el plan gratuito de Supabase no trae
// backups, asi que se vuelca a JSON con el propio cliente. El volumen lo
// permite: unas 2000 filas en total. Guarda tambien el DDL suficiente para
// saber que habia (columnas, indices, politicas, claves foraneas).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const DESTINO = process.env.DESTINO;
fs.mkdirSync(DESTINO, { recursive: true });

const u = new URL(process.env.POSTGRES_URL_NON_POOLING);
u.searchParams.delete("sslmode");
const c = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
await c.connect();

/*
 * TODOS los esquemas de aplicacion, no una seleccion.
 *
 * La primera version respaldaba solo los tres que se iban a migrar. Parecia
 * razonable y fue exactamente el hueco por el que se perdieron los bancos de
 * examia: lo que no estaba en esta lista no tenia copia, y el plan gratuito de
 * Supabase no trae backups (pitr_enabled: false, backups: []).
 */
const ESQUEMAS = ["parla", "exams", "arriendos", "autoreel", "pagobot"];
const resumen = {};

for (const esq of ESQUEMAS) {
  const { rows: tablas } = await c.query(
    `select table_name from information_schema.tables
     where table_schema = $1 and table_type = 'BASE TABLE' order by 1`,
    [esq]
  );
  resumen[esq] = {};
  const datos = {};
  for (const { table_name } of tablas) {
    const r = await c.query(`select * from "${esq}"."${table_name}"`);
    datos[table_name] = r.rows;
    resumen[esq][table_name] = r.rows.length;
  }
  fs.writeFileSync(
    path.join(DESTINO, `${esq}.datos.json`),
    JSON.stringify(datos, null, 1)
  );
}

// Estructura: columnas, claves foraneas, politicas RLS e indices.
const estructura = {};
for (const esq of ESQUEMAS) {
  estructura[esq] = {
    columnas: (
      await c.query(
        `select table_name, column_name, data_type, is_nullable, column_default
         from information_schema.columns where table_schema = $1
         order by table_name, ordinal_position`,
        [esq]
      )
    ).rows,
    foraneas: (
      await c.query(
        `select tc.table_name, kcu.column_name, ccu.table_schema fs, ccu.table_name ft, ccu.column_name fc
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
         join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
         where tc.table_schema = $1 and tc.constraint_type = 'FOREIGN KEY'`,
        [esq]
      )
    ).rows,
    politicas: (
      await c.query(
        `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = $1`,
        [esq]
      )
    ).rows,
    indices: (await c.query(`select tablename, indexdef from pg_indexes where schemaname = $1`, [esq]))
      .rows,
    funciones: (
      await c.query(
        `select p.proname, pg_get_functiondef(p.oid) def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = $1 and p.prokind = 'f'
           and p.proname not like 'gbt%' and p.proname not like '%_dist'
           and p.proname not like 'gbtreekey%'`,
        [esq]
      )
    ).rows,
    vistas: (
      await c.query(
        `select table_name, view_definition from information_schema.views where table_schema = $1`,
        [esq]
      )
    ).rows,
  };
}
fs.writeFileSync(path.join(DESTINO, "estructura.json"), JSON.stringify(estructura, null, 1));

console.log("Respaldo en " + DESTINO);
for (const [esq, tablas] of Object.entries(resumen)) {
  const total = Object.values(tablas).reduce((a, b) => a + b, 0);
  console.log(`  ${esq}: ${Object.keys(tablas).length} tablas, ${total} filas`);
}
const archivos = fs.readdirSync(DESTINO);
console.log("  archivos: " + archivos.join(", "));
let bytes = 0;
for (const f of archivos) bytes += fs.statSync(path.join(DESTINO, f)).size;
console.log("  tamano: " + (bytes / 1024).toFixed(0) + " KB");

await c.end();
