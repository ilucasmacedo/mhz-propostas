import { isGronerConfigured } from '../client.js';
import { sincronizarPropostaNaGroner } from '../sincronizar-proposta.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

export async function handleSincronizarProposta(req, res) {
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
    const projetoId = Number(body.projetoId);
    const proposta = body.proposta;
    const pdf = body.pdf;

    if (!projetoId) {
      sendJson(res, 400, {
        ok: false,
        erro: 'Informe o projetoId (negócio) vinculado na Groner.',
      });
      return;
    }

    if (!proposta?.resultado) {
      sendJson(res, 400, {
        ok: false,
        erro: 'Dados da proposta incompletos.',
      });
      return;
    }

    const sync = await sincronizarPropostaNaGroner({
      projetoId,
      proposta,
      pdf: null,
      meta: body.meta,
    });

    const nadaConfigurado =
      sync.descricao?.skipped &&
      sync.pdf?.skipped &&
      !sync.campos?.some((c) => c.ok);

    if (nadaConfigurado) {
      sendJson(res, 200, {
        ok: true,
        skipped: true,
        motivo: 'Configure descricaoProposta (172) e/ou pdfProposta em config/groner-integracao.json',
      });
      return;
    }

    const status = sync.ok === false ? 207 : 200;
    sendJson(res, status, sync);
  } catch (err) {
    console.error('[groner/sincronizar-proposta]', err);
    const detalhe =
      err.data && typeof err.data === 'object'
        ? JSON.stringify(err.data).slice(0, 400)
        : null;
    sendJson(res, err.status && err.status < 500 ? err.status : 500, {
      ok: false,
      erro: err.message || 'Erro ao sincronizar proposta na Groner.',
      code: err.code ?? 'GRONER_ERROR',
      detalhe,
    });
  }
}
