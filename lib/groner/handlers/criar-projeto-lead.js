import { isGronerConfigured } from '../client.js';
import { criarNovoProjetoParaLead } from '../criar-contato-proposta.js';
import {
  handleOptions,
  readJsonBody,
  requireApiAuth,
  sendJson,
  setCors,
} from './http-utils.js';

export async function handleCriarProjetoLead(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, erro: 'Use POST.' });
    return;
  }

  if (!requireApiAuth(req, res, 'criar-projeto-lead')) return;

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

    if (!leadId) {
      sendJson(res, 400, {
        ok: false,
        erro: 'Informe o leadId do contato selecionado na Groner.',
      });
      return;
    }

    const result = await criarNovoProjetoParaLead({
      leadId,
      cliente: body.cliente,
      usina: body.usina,
    });

    sendJson(res, 200, {
      ok: true,
      criado: true,
      acao: result.acao,
      leadId: result.leadId,
      projetoId: result.projetoId,
      urlNegocio: result.urlNegocio,
      preVenda: result.preVenda,
      lead: result.lead,
      projeto: result.projeto,
      formulario: result.formulario,
    });
  } catch (err) {
    console.error('[groner/criar-projeto-lead]', err);
    sendJson(res, err.status && err.status < 500 ? err.status : 500, {
      ok: false,
      erro: err.message || 'Erro ao criar projeto na Groner.',
      code: err.code ?? 'GRONER_ERROR',
      detalhe:
        err.data && typeof err.data === 'object'
          ? JSON.stringify(err.data).slice(0, 400)
          : null,
    });
  }
}
