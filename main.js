/* ── Comprobación de estado ───────────────────────────────────
 *
 * No podemos leer la respuesta de otro origen, pero sí distinguir
 * entre "el servidor contestó" y "no hubo red": una petición no-cors
 * resuelve (opaca) cuando el host responde y rechaza cuando no.
 *
 * El nombre solo se pinta ante una respuesta confirmada. Si algo falla
 * se queda en gris en vez de marcarse como caído: un falso negativo por
 * la red del visitante no debe desmentir un sitio que está bien.
 */

const TIMEOUT_MS = 6000;

async function probe(link) {
  const url = link.dataset.probe;
  if (!url) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    link.dataset.state = 'live';
    link.title = 'Responde correctamente';
  } catch {
    // Sin señal: el nombre se queda apagado.
  } finally {
    clearTimeout(timer);
  }
}

document.querySelectorAll('.entry__link[data-probe]').forEach(probe);

/* ── Muro de proyectos ────────────────────────────────────────
 *
 * Un solo lugar de lectura: recorrer los nombres cambia el texto de
 * arriba. La descripción ya está en el DOM dentro de cada proyecto,
 * así que sin JS —o en móvil— la página sigue completa.
 */

const stage = document.getElementById('stage');

if (stage) {
  const idle = stage.innerHTML;

  document.querySelectorAll('.proj').forEach((proj) => {
    const target = proj.querySelector('.proj__link');
    const desc = proj.querySelector('.proj__desc');
    if (!target || !desc) return;

    const show = () => { stage.textContent = desc.textContent.trim(); };
    const clear = () => { stage.innerHTML = idle; };

    target.addEventListener('mouseenter', show);
    target.addEventListener('focus', show);
    target.addEventListener('mouseleave', clear);
    target.addEventListener('blur', clear);
  });
}

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
