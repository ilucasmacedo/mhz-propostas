import { diagnosticarBuscaGroner, isGronerConfigured } from '../client.js';
import {
  handleOptions,
  isDiagnosticoEnabled,
  sendJson,
  setCors,
} from './http-utils.js';

export async function handleGronerDiagnostico(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, erro: 'Use GET.' });
    return;
  }

  if (!isDiagnosticoEnabled()) {
    sendJson(res, 404, { ok: false, erro: 'Endpoint desabilitado em produção.' });
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
