import { buscarContatosGroner, isGronerConfigured } from '../client.js';

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

export async function handleBuscarContato(req, res) {
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
    const nome = String(body.nome ?? '').trim();
    const email = String(body.email ?? '').trim();
    const documento = String(body.documento ?? '').trim();
    const telefone = String(body.telefone ?? '').trim();

    if (!nome && !email && !documento && !telefone) {
      sendJson(res, 400, {
        ok: false,
        erro: 'Informe ao menos um: nome, e-mail, CPF/CNPJ ou telefone.',
      });
      return;
    }

    const contatos = await buscarContatosGroner({ nome, email, documento, telefone });

    sendJson(res, 200, {
      ok: true,
      total: contatos.length,
      contatos,
      criterios: { nome: nome || null, email: email || null, documento: documento || null, telefone: telefone || null },
    });
  } catch (err) {
    console.error('[groner/buscar-contato]', err);
    sendJson(res, err.status && err.status < 500 ? err.status : 500, {
      ok: false,
      erro: err.message || 'Erro ao buscar contato na Groner.',
      code: err.code ?? 'GRONER_ERROR',
    });
  }
}

export async function handleGronerStatus(_req, res) {
  setCors(res);
  sendJson(res, 200, {
    ok: true,
    configurado: isGronerConfigured(),
    tenant: process.env.GRONER_TENANT ? `${process.env.GRONER_TENANT.slice(0, 2)}***` : null,
  });
}
