const DEFAULT_TIMEOUT_MS = 25000;

function getConfig() {
  const tenant = process.env.GRONER_TENANT?.trim();
  const token = process.env.GRONER_TOKEN?.trim();

  if (!tenant || !token) {
    const err = new Error(
      'Integração Groner não configurada. Defina GRONER_TENANT e GRONER_TOKEN no .env ou na Vercel.',
    );
    err.code = 'GRONER_NOT_CONFIGURED';
    throw err;
  }

  return {
    tenant,
    token,
    baseUrl: `https://${tenant}.api.groner.app/api`,
  };
}

export function isGronerConfigured() {
  return Boolean(process.env.GRONER_TENANT?.trim() && process.env.GRONER_TOKEN?.trim());
}

async function gronerFetch(path, { method = 'GET', body } = {}) {
  const { token, baseUrl } = getConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const err = new Error(
        typeof data === 'object' && data?.title
          ? data.title
          : `Groner API ${res.status}: ${text.slice(0, 200)}`,
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

export function normalizarTelefone(telefone) {
  let digits = apenasDigitos(telefone);
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

function pickLead(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.lead && typeof raw.lead === 'object') return raw.lead;
  if (raw.id || raw.Id) return raw;
  if (raw.existe && raw.leadId) return { id: raw.leadId, ...raw };
  return null;
}

import { mapLeadDetalhe, mapProjetoDetalhe, montarPayloadFormulario } from './mappers.js';

function mapProjeto(p) {
  return mapProjetoDetalhe(p);
}

export function mapLead(raw) {
  const detalhe = mapLeadDetalhe(raw);
  if (!detalhe) return null;

  return {
    id: detalhe.id,
    nome: detalhe.nome,
    email: detalhe.email,
    documento: detalhe.documento,
    telefone: detalhe.telefone,
    ddi: detalhe.ddi,
    tipo: detalhe.tipo,
    origemId: raw?.origemId ?? raw?.OrigemId ?? null,
    consumo: detalhe.consumo,
    endereco: detalhe.endereco?.completo ?? '',
    projetos: detalhe.projetos,
  };
}

async function buscarPorDocumento(documento) {
  const doc = apenasDigitos(documento);
  if (doc.length < 11) return null;
  try {
    const data = await gronerFetch(`/Lead/VerificarDocumento/${doc}`);
    return mapLead(data);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function buscarPorEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  if (!value.includes('@')) return null;
  try {
    const data = await gronerFetch(`/Lead/Verificar/${encodeURIComponent(value)}`);
    return mapLead(data);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function buscarPorTelefone(telefone) {
  const tel = normalizarTelefone(telefone);
  if (tel.length < 10) return null;
  try {
    const data = await gronerFetch(`/Lead/VerificarCelular/${tel}/55`);
    return mapLead(data);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function buscarPorNome(nome) {
  const value = String(nome ?? '').trim();
  if (value.length < 3) return [];

  const data = await gronerFetch(
    `/Lead?query=${encodeURIComponent(value)}&pagina=1&tamanhoPagina=15`,
  );

  const items = data?.items ?? data?.Items ?? [];
  return items.map(mapLead).filter(Boolean);
}

export async function obterLeadPorId(id) {
  const data = await gronerFetch(`/Lead/${id}`);
  return mapLeadDetalhe(data);
}

export async function obterProjetoPorId(id) {
  const data = await gronerFetch(`/Projeto/${id}`);
  return mapProjetoDetalhe(data);
}

export async function carregarDadosFormulario(leadId, projetoId) {
  const lead = await obterLeadPorId(leadId);
  if (!lead) throw new Error('Contato não encontrado na Groner.');

  let projeto = null;
  const pid = projetoId || lead.projetos?.[0]?.id;
  if (pid) {
    try {
      projeto = await obterProjetoPorId(pid);
    } catch {
      projeto = lead.projetos?.find((p) => p.id === pid) ?? lead.projetos?.[0] ?? null;
    }
  }

  return {
    lead,
    projeto,
    formulario: montarPayloadFormulario(lead, projeto),
  };
}

export async function buscarContatosGroner(filtros) {
  const { nome, email, documento, telefone } = filtros ?? {};
  const encontrados = new Map();

  const add = (lead) => {
    if (lead?.id && !encontrados.has(lead.id)) {
      encontrados.set(lead.id, lead);
    }
  };

  const [porDoc, porEmail, porTel, porNome] = await Promise.all([
    documento ? buscarPorDocumento(documento) : null,
    email ? buscarPorEmail(email) : null,
    telefone ? buscarPorTelefone(telefone) : null,
    nome ? buscarPorNome(nome) : [],
  ]);

  if (porDoc) add(porDoc);
  if (porEmail) add(porEmail);
  if (porTel) add(porTel);
  if (Array.isArray(porNome)) porNome.forEach(add);

  const contatos = [...encontrados.values()];

  const enriquecidos = await Promise.all(
    contatos.map(async (c) => {
      if (c.projetos?.length) return c;
      try {
        return (await obterLeadPorId(c.id)) ?? c;
      } catch {
        return c;
      }
    }),
  );

  return enriquecidos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
