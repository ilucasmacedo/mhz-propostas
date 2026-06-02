/**
 * Cria etapa "Operação pós vendas" + status mensais na Groner.
 *
 * Uso: node scripts/groner-criar-funil-pos-vendas.mjs
 * Requer .env com GRONER_TENANT e GRONER_TOKEN (perfil Admin).
 *
 * Gera relatório em docs/local/groner-funil-pos-vendas.md (gitignored).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { desembrulharResposta, isGronerConfigured } from '../lib/groner/client.js';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs', 'local');
const OUT_MD = join(OUT_DIR, 'groner-funil-pos-vendas.md');
const OUT_JSON = join(OUT_DIR, 'groner-funil-pos-vendas.json');

const ETAPA_NOME = 'Operação pós vendas';
const ETAPA_COR = '#00B4D8';

const STATUS_NOMES = [
  'Mês 1 - Acompanhamento inicial',
  'Mês 2 - Monitoramento padrão',
  'Mês 3 - Revisão trimestral',
  'Mês 4 - Verificar garantia',
  'Mês 5 - Monitoramento padrão',
  'Mês 6 - Verificar limpeza',
  'Mês 7 - Monitoramento padrão',
  'Mês 8 - Monitoramento padrão',
  'Mês 9 - Revisão trimestral',
  'Mês 10 - Verificar garantia',
  'Mês 11 - Limpeza anual',
  'Mês 12 - Renovação',
  'Enviado para Garantia',
];

function getConfig() {
  const tenant = process.env.GRONER_TENANT?.trim() || 'mhzenergiasolar';
  const token = process.env.GRONER_TOKEN?.trim();
  if (!token) throw new Error('GRONER_TOKEN ausente no .env');
  return { tenant, token, baseUrl: `https://${tenant}.api.groner.app/api` };
}

function normalizarNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function extrairId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const inner = desembrulharResposta(obj);
  return inner?.id ?? inner?.Id ?? obj?.id ?? obj?.Id ?? null;
}

function extrairItens(data) {
  const inner = desembrulharResposta(data);
  if (inner == null) return [];
  if (Array.isArray(inner)) return inner;
  for (const key of ['items', 'Items', 'list', 'List', 'content', 'Content']) {
    const arr = inner[key];
    if (Array.isArray(arr)) return arr;
  }
  return [];
}

async function gronerApi(path, { method = 'GET', body } = {}) {
  const { token, baseUrl } = getConfig();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
        : `Groner ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return desembrulharResposta(data);
}

async function listarEtapas() {
  const data = await gronerApi('/EtapaLead?pagina=1&tamanhoPagina=100');
  return extrairItens(data);
}

async function listarStatusPorEtapa(etapaId) {
  try {
    const data = await gronerApi('/StatusProjeto/PorEtapas', {
      method: 'POST',
      body: [Number(etapaId)],
    });
    const itens = extrairItens(data);
    if (itens.length) return itens;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const vals = Object.values(data).filter((v) => v && typeof v === 'object' && (v.id || v.Id));
      if (vals.length) return vals;
    }
  } catch {
    /* fallback abaixo */
  }

  const all = await gronerApi('/StatusProjeto?pagina=1&tamanhoPagina=200');
  const itens = extrairItens(all);
  return itens.filter((s) => Number(s.etapaId ?? s.EtapaId) === Number(etapaId));
}

function inferirLojasIds(etapas) {
  for (const e of etapas) {
    const ids = e.lojasIds ?? e.LojasIds;
    if (Array.isArray(ids) && ids.length) return ids;
  }
  return [1];
}

function inferirOrdem(etapas) {
  let max = 0;
  for (const e of etapas) {
    const o = Number(e.ordem ?? e.Ordem ?? 0);
    if (o > max) max = o;
  }
  return max + 1;
}

async function criarEtapa(etapasExistentes) {
  const body = {
    nome: ETAPA_NOME,
    cor: ETAPA_COR,
    ordem: inferirOrdem(etapasExistentes),
    ativo: true,
    paralelo: false,
    negativo: false,
    lojasIds: inferirLojasIds(etapasExistentes),
  };

  const res = await gronerApi('/EtapaLead', { method: 'POST', body });
  const id = extrairId(res);
  if (!id) throw new Error('Etapa criada mas ID não retornado pela API.');
  return { id: Number(id), criada: true, payload: body, raw: res };
}

async function criarStatus(etapaId, nome, ordem) {
  const body = {
    etapaId: Number(etapaId),
    nome,
    tempo: 30,
    tipoTempo: 'Dia',
    ordem,
  };
  const res = await gronerApi('/StatusProjeto', { method: 'POST', body });
  const id = extrairId(res);
  if (!id) throw new Error(`Status "${nome}" criado mas ID não retornado.`);
  return { id: Number(id), criado: true, nome, ordem, raw: res };
}

function montarMarkdown(relatorio) {
  const linhas = [
    '# Funil Groner — Operação pós vendas',
    '',
    `Gerado em: **${relatorio.geradoEm}**`,
    `Tenant: \`${relatorio.tenant}\``,
    '',
    '## Etapa',
    '',
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| Nome | ${relatorio.etapa.nome} |`,
    `| ID | **${relatorio.etapa.id}** |`,
    `| Ação | ${relatorio.etapa.acao} |`,
    '',
    '## Status',
    '',
    '| # | Nome | ID | Ação |',
    '|---|------|----|------|',
  ];

  relatorio.status.forEach((s, i) => {
    linhas.push(`| ${i + 1} | ${s.nome} | **${s.id}** | ${s.acao} |`);
  });

  linhas.push(
    '',
    '## Links',
    '',
    `- CRM: https://${relatorio.tenant}.groner.app`,
    `- Negócio (exemplo): \`https://${relatorio.tenant}.groner.app/negocio/{projetoId}/aba/2\``,
    '',
    '## Mover negócio para um status',
    '',
    '```http',
    `PUT https://${relatorio.tenant}.api.groner.app/api/Projeto/{projetoId}`,
    'Content-Type: application/json',
    '',
    '{ "Propriedade": "StatusId", "Valor": "' + (relatorio.status[0]?.id ?? 'ID') + '" }',
    '```',
    '',
    '## JSON (para config interna)',
    '',
    'Arquivo: `docs/local/groner-funil-pos-vendas.json`',
    '',
  );

  if (relatorio.erros?.length) {
    linhas.push('## Erros / avisos', '');
    relatorio.erros.forEach((e) => linhas.push(`- ${e}`));
    linhas.push('');
  }

  return linhas.join('\n');
}

async function main() {
  if (!isGronerConfigured()) {
    console.error('❌ Crie .env com GRONER_TENANT=mhzenergiasolar e GRONER_TOKEN');
    process.exit(1);
  }

  const { tenant } = getConfig();
  const relatorio = {
    geradoEm: new Date().toISOString(),
    tenant,
    etapa: { nome: ETAPA_NOME, id: null, acao: '' },
    status: [],
    erros: [],
  };

  console.log(`\n📋 Funil Groner — ${ETAPA_NOME}\n`);

  let etapas = await listarEtapas();
  console.log(`   ${etapas.length} etapa(s) existente(s)`);

  const alvo = normalizarNome(ETAPA_NOME);
  let etapa = etapas.find((e) => normalizarNome(e.nome ?? e.Nome) === alvo);

  if (etapa) {
    const id = Number(etapa.id ?? etapa.Id);
    relatorio.etapa = { nome: ETAPA_NOME, id, acao: 'Já existia (reutilizada)' };
    console.log(`✓ Etapa já existe — ID ${id}`);
  } else {
    try {
      const criada = await criarEtapa(etapas);
      etapa = { id: criada.id, nome: ETAPA_NOME };
      relatorio.etapa = { nome: ETAPA_NOME, id: criada.id, acao: 'Criada agora' };
      console.log(`✓ Etapa criada — ID ${criada.id}`);
    } catch (err) {
      relatorio.erros.push(`Criar etapa: ${err.message}`);
      console.error(`❌ Falha ao criar etapa: ${err.message}`);
      console.error('   Crie manualmente no CRM e rode o script de novo.');
      await mkdir(OUT_DIR, { recursive: true });
      relatorio.etapa.acao = 'Falhou — ver erros';
      await writeFile(OUT_MD, montarMarkdown(relatorio), 'utf8');
      await writeFile(OUT_JSON, JSON.stringify(relatorio, null, 2), 'utf8');
      process.exit(1);
    }
  }

  const etapaId = relatorio.etapa.id;
  let statusExistentes = await listarStatusPorEtapa(etapaId);
  const mapStatus = new Map(
    statusExistentes.map((s) => [normalizarNome(s.nome ?? s.Nome), s]),
  );

  for (let i = 0; i < STATUS_NOMES.length; i++) {
    const nome = STATUS_NOMES[i];
    const key = normalizarNome(nome);
    const existente = mapStatus.get(key);

    if (existente) {
      const id = Number(existente.id ?? existente.Id);
      relatorio.status.push({ nome, id, acao: 'Já existia' });
      console.log(`  · ${nome} — ID ${id} (existente)`);
      continue;
    }

    try {
      const criado = await criarStatus(etapaId, nome, i + 1);
      relatorio.status.push({ nome, id: criado.id, acao: 'Criado agora' });
      console.log(`  ✓ ${nome} — ID ${criado.id}`);
    } catch (err) {
      relatorio.erros.push(`Status "${nome}": ${err.message}`);
      relatorio.status.push({ nome, id: null, acao: `Erro: ${err.message}` });
      console.error(`  ❌ ${nome}: ${err.message}`);
    }
  }

  const configSugerida = {
    posVendas: {
      etapaId,
      etapaNome: ETAPA_NOME,
      statusInicialId: relatorio.status[0]?.id ?? null,
      statusRenovacaoId: relatorio.status.find((s) => s.nome.includes('Renovação'))?.id ?? null,
      statusGarantiaId:
        relatorio.status.find((s) => s.nome.includes('Enviado para Garantia'))?.id ?? null,
      status: Object.fromEntries(
        relatorio.status.filter((s) => s.id).map((s) => [s.nome, s.id]),
      ),
    },
  };
  relatorio.configSugerida = configSugerida;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_MD, montarMarkdown(relatorio), 'utf8');
  await writeFile(OUT_JSON, JSON.stringify(relatorio, null, 2), 'utf8');

  console.log(`\n📄 Relatório: docs/local/groner-funil-pos-vendas.md`);
  console.log(`📄 JSON:      docs/local/groner-funil-pos-vendas.json\n`);

  if (relatorio.erros.length) process.exit(1);
}

main().catch((err) => {
  console.error('❌', err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
