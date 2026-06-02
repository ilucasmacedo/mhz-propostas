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

function mapProjeto(p) {
  if (!p) return null;
  return {
    id: p.id ?? p.Id,
    nome: p.nome ?? p.Nome ?? 'Projeto',
    consumo: p.consumo ?? p.Consumo ?? null,
  };
}

export function mapLead(raw) {
  const lead = pickLead(raw);
  if (!lead) return null;

  const projetos = (lead.projetos ?? lead.Projetos ?? [])
    .map(mapProjeto)
    .filter(Boolean);

  return {
    id: lead.id ?? lead.Id,
    nome: lead.nome ?? lead.Nome ?? '',
    email: lead.email ?? lead.Email ?? '',
    documento: lead.documento ?? lead.Documento ?? '',
    telefone: lead.celular ?? lead.Celular ?? lead.telefone ?? lead.Telefone ?? '',
    ddi: lead.ddiCelular ?? lead.DDICelular ?? '55',
    tipo: lead.tipo ?? lead.Tipo ?? null,
    origemId: lead.origemId ?? lead.OrigemId ?? null,
    projetos,
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
  return mapLead(data);
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
