/*
 * Comprobación de estado del registro.
 *
 * No podemos leer la respuesta de otro origen, pero sí distinguir entre
 * "el servidor contestó" y "no hubo red": una petición no-cors resuelve
 * (opaca) cuando el host responde y rechaza cuando no.
 *
 * El punto solo se enciende en verde ante una respuesta confirmada. Si algo
 * falla se queda neutro en vez de ponerse rojo: un falso negativo por red del
 * visitante no debe hacer parecer caído un sitio que está bien.
 */

const TIMEOUT_MS = 6000;

async function probe(dot) {
  const url = dot.dataset.probe;
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
    dot.dataset.state = 'live';
    dot.closest('.rec__link')?.setAttribute('title', 'Responde correctamente');
  } catch {
    // Sin señal: dejamos el punto neutro.
  } finally {
    clearTimeout(timer);
  }
}

document.querySelectorAll('.dot[data-probe]').forEach(probe);

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
