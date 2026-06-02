import { diagnosticarBuscaGroner, isGronerConfigured } from '../client.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function handleGronerDiagnostico(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, erro: 'Use GET.' });
    return;
  }

  try {
    if (!isGronerConfigured()) {
      sendJson(res, 503, { ok: false, erro: 'Groner não configurada.' });
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    const query = url.searchParams.get('q') || url.searchParams.get('query') || '';

    const resultado = await diagnosticarBuscaGroner(query);
    sendJson(res, resultado.ok ? 200 : 400, resultado);
  } catch (err) {
    sendJson(res, 500, { ok: false, erro: err.message });
  }
}
