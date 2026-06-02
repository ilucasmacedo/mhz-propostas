import {
  buscarContatosGroner,
  getGronerTenantInfo,
  isGronerConfigured,
  validarConexaoGroner,
} from '../client.js';
import {
  handleOptions,
  readJsonBody,
  requireApiAuth,
  sendJson,
  setCors,
} from './http-utils.js';

export async function handleBuscarContato(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, erro: 'Use POST.' });
    return;
  }

  if (!requireApiAuth(req, res, 'buscar-contato')) return;

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
      criterios: {
        nome: nome || null,
        email: email || null,
        documento: documento || null,
        telefone: telefone || null,
      },
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

export async function handleGronerStatus(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (!requireApiAuth(req, res, 'status')) return;

  const tenantInfo = getGronerTenantInfo();
  const conexao = tenantInfo.configurado ? await validarConexaoGroner() : null;

  sendJson(res, 200, {
    ok: true,
    configurado: tenantInfo.configurado,
    tenantLength: tenantInfo.tenantLength,
    tenantOk: tenantInfo.tenantOk,
    tenantHint: tenantInfo.tenantHint,
    conexao,
  });
}
