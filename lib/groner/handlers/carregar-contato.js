import { carregarDadosFormulario, isGronerConfigured } from '../client.js';
import {
  handleOptions,
  readJsonBody,
  sendJson,
  setCors,
} from './http-utils.js';

export async function handleCarregarContato(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, erro: 'Use POST.' });
    return;
  }

  try {
    if (!isGronerConfigured()) {
      sendJson(res, 503, {
        ok: false,
        erro: 'Integração Groner não configurada no servidor.',
        code: 'GRONER_NOT_CONFIGURED',
      });
      return;
    }

    const body = await readJsonBody(req);
    const leadId = Number(body.leadId);
    const projetoId = body.projetoId ? Number(body.projetoId) : null;

    if (!leadId) {
      sendJson(res, 400, { ok: false, erro: 'leadId é obrigatório.' });
      return;
    }

    const dados = await carregarDadosFormulario(leadId, projetoId);

    sendJson(res, 200, {
      ok: true,
      ...dados,
    });
  } catch (err) {
    console.error('[groner/carregar-contato]', err);
    sendJson(res, err.status && err.status < 500 ? err.status : 500, {
      ok: false,
      erro: err.message || 'Erro ao carregar contato da Groner.',
      code: err.code ?? 'GRONER_ERROR',
    });
  }
}
