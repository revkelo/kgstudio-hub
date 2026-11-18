// Fixed destinations only. Never turn this endpoint into an arbitrary URL proxy.
const services = {
  portafolio: ['https://portafolio.kgstudio.top/'],
  parla: ['https://parla.kgstudio.top/'],
  reinicia: ['https://reinicia.kgstudio.top/'],
  pagobot: ['https://pagobot.kgstudio.top/health', true],
  arriendos: ['https://arriendos.kgstudio.top/login'],
  examia: ['https://examia.kgstudio.top/api/salud', true],
  itep: ['https://itep.kgstudio.top/api/estado', true],
  agd: ['https://distribucionesagd.kgstudio.top/'],
};

export async function onRequestGet() {
  const entries = await Promise.all(Object.entries(services).map(async ([id, [url, json]]) => {
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000), cache: 'no-store' });
      let ok = response.ok;
      if (json && ok) {
        const state = await response.json();
        ok = state.ok === true && state.db !== false;
      } else { await response.body?.cancel(); }
      return [id, { ok, status: response.status }];
    } catch { return [id, { ok: false, status: null }]; }
  }));
  return Response.json({ services: Object.fromEntries(entries) }, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' }
  });
}
