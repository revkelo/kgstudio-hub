import assert from 'node:assert/strict';
import fs from 'node:fs';
// The hub intentionally has no package.json; load the standalone Pages module as ESM.
const source=fs.readFileSync(new URL('../functions/api/status.js',import.meta.url),'utf8');
const {onRequestGet}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const originalFetch=globalThis.fetch;
try {
  globalThis.fetch=async url => {
    if(url.includes('examia.')) return new Response(null,{status:503});
    if(url.includes('pagobot.')) return Response.json({ok:true,db:false});
    if(url.includes('parla.')) throw new Error('network unavailable');
    return url.includes('/api/estado') ? Response.json({ok:true}) : new Response('available');
  };
  const response=await onRequestGet();
  const {services}=await response.json();
  assert.equal(Object.keys(services).length,8);
  assert.equal(services.examia.ok,false);
  assert.equal(services.pagobot.ok,false);
  assert.equal(services.parla.ok,false);
  assert.equal(services.itep.ok,true);
  assert.equal(services.arriendos.ok,true);
  assert.equal(services.monetiq,undefined);
  assert.equal(services.autoreel,undefined);
  console.log('Estado: HTTP 503, fallo de base y fallo de red quedan apagados; destinos retirados ausentes.');
} finally {globalThis.fetch=originalFetch;}
