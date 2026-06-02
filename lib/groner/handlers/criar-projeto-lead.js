import { isGronerConfigured } from '../client.js';
import { criarNovoProjetoParaLead } from '../criar-contato-proposta.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function handleCriarProjetoLead(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
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
