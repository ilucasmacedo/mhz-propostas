import { mapLeadDetalhe, mapProjetoDetalhe, montarPayloadFormulario } from './mappers.js';

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

function extrairItens(data) {
  if (Array.isArray(data)) return data;
  return (
    data?.items ??
    data?.Items ??
    data?.content ??
    data?.Content ??
    data?.results ??
    data?.Results ??
    data?.data ??
    data?.Data ??
    []
  );
}

/** Mesmos parâmetros que a busca global do CRM Groner (tela Pesquisar na Groner) */
function paramsPesquisaProjeto(query) {
  const q = encodeURIComponent(String(query ?? '').trim());
  return `query=${q}&criterio=Todos&ordenarPor=DataCadastro_DESC&pageSize=20`;
}

function mapProjetoBusca(raw) {
  const p = mapProjetoDetalhe(raw);
  if (!p) return null;
  const lead = raw?.lead ?? raw?.Lead ?? raw?.leadCard ?? raw?.LeadCard;
  return {
    ...p,
    leadId:
      p.leadId ??
      lead?.id ??
      lead?.Id ??
      raw?.leadId ??
      raw?.LeadId ??
      raw?.idLead ??
      raw?.IdLead,
    leadNome: lead?.nome ?? lead?.Nome ?? raw?.leadNome ?? raw?.LeadNome ?? null,
  };
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
    projetos: detalhe.projetos ?? [],
  };
}

function mapLeadParaLista(detalhe, { projetosExtras = [], via = [] } = {}) {
  if (!detalhe) return null;

  const projetosMap = new Map();
  for (const p of [...(detalhe.projetos ?? []), ...projetosExtras]) {
    if (p?.id) projetosMap.set(p.id, p);
  }

  return {
    id: detalhe.id,
    nome: detalhe.nome,
    email: detalhe.email,
    documento: detalhe.documento,
    telefone: detalhe.telefone,
    endereco: detalhe.endereco?.completo ?? '',
    projetos: [...projetosMap.values()],
    via: [...new Set(via)],
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

/** Busca contatos (Leads) — GET /api/Lead?query= */
async function buscarLeadsPorQuery(query) {
  const value = String(query ?? '').trim();
  if (value.length < 3) return [];

  const data = await gronerFetch(
    `/Lead?query=${encodeURIComponent(value)}&pagina=1&tamanhoPagina=25`,
  );

  return extrairItens(data).map((item) => mapLead(item)).filter(Boolean);
}

/** Busca negócios (Projetos) — igual ao CRM: GET /api/Projeto/Pesquisar?query=...&criterio=Todos&... */
async function buscarProjetosPorQuery(query) {
  const value = String(query ?? '').trim();
  if (value.length < 3) return [];

  const mapItems = (data) => extrairItens(data).map(mapProjetoBusca).filter(Boolean);
  const params = paramsPesquisaProjeto(value);

  try {
    let data = await gronerFetch(`/Projeto/Pesquisar?${params}`);
    let items = mapItems(data);
    if (items.length) return items;

    data = await gronerFetch(
      `/Projeto?query=${encodeURIComponent(value)}&pagina=1&tamanhoPagina=20`,
    );
    return mapItems(data);
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
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

/**
 * Busca unificada: Lead (contato) + Projeto (negócio).
 * Agrupa por Lead e lista todos os projetos vinculados.
 */
export async function buscarContatosGroner(filtros) {
  const { nome, email, documento, telefone } = filtros ?? {};
  const queryTexto = nome || email || documento || telefone || '';

  const leadIds = new Set();
  const projetosPorLead = new Map();
  const viaPorLead = new Map();

  const marcarVia = (leadId, via) => {
    if (!leadId) return;
    leadIds.add(leadId);
    if (!viaPorLead.has(leadId)) viaPorLead.set(leadId, new Set());
    viaPorLead.get(leadId).add(via);
  };

  const addProjeto = (leadId, projeto) => {
    if (!leadId || !projeto?.id) return;
    if (!projetosPorLead.has(leadId)) projetosPorLead.set(leadId, new Map());
    projetosPorLead.get(leadId).set(projeto.id, projeto);
  };

  const [porDoc, porEmail, porTel, leadsQuery, projetosQuery] = await Promise.all([
    documento ? buscarPorDocumento(documento) : null,
    email ? buscarPorEmail(email) : null,
    telefone ? buscarPorTelefone(telefone) : null,
    queryTexto.length >= 3 ? buscarLeadsPorQuery(queryTexto) : [],
    queryTexto.length >= 3 ? buscarProjetosPorQuery(queryTexto) : [],
  ]);

  if (porDoc?.id) marcarVia(porDoc.id, 'documento');
  if (porEmail?.id) marcarVia(porEmail.id, 'email');
  if (porTel?.id) marcarVia(porTel.id, 'telefone');

  for (const lead of leadsQuery) {
    if (lead?.id) marcarVia(lead.id, 'lead');
  }

  for (const projeto of projetosQuery) {
    if (projeto.leadId) {
      marcarVia(projeto.leadId, 'projeto');
      addProjeto(projeto.leadId, projeto);
    }
  }

  const resultados = await Promise.all(
    [...leadIds].map(async (leadId) => {
      try {
        const detalhe = await obterLeadPorId(leadId);
        const extras = [...(projetosPorLead.get(leadId)?.values() ?? [])];
        return mapLeadParaLista(detalhe, {
          projetosExtras: extras,
          via: [...(viaPorLead.get(leadId) ?? [])],
        });
      } catch {
        return null;
      }
    }),
  );

  return resultados
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
