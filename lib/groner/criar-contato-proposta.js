import {
  buscarContatosGroner,
  carregarDadosFormulario,
  desembrulharResposta,
  normalizarTelefone,
  apenasDigitos,
  obterLeadPorId,
  obterProjetoPorId,
} from './client.js';
import { getOrigemPreVendaId, getTipoProjetoPreVendaId } from './integracao-config.js';
import { montarPayloadFormulario } from './mappers.js';
import { montarUrlNegocioGroner } from './url.js';

function extrairId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const inner = desembrulharResposta(obj);
  const alvo = inner ?? obj;
  return alvo.id ?? alvo.Id ?? null;
}

function kwpParaConsumo(kwp) {
  const k = Number(kwp);
  if (!k || k <= 0) return null;
  return Math.round(k * 130);
}

function inferirTipoPessoa(documento) {
  const d = apenasDigitos(documento);
  if (d.length === 14) return 1;
  return 0;
}

function parseEnderecoCidadeUf(endereco) {
  const s = String(endereco ?? '').trim();
  if (!s) return { cidade: null, uf: null };
  const match = s.match(/(?:^|[—\-,/])\s*([^/—\-,]+)\/([A-Z]{2})\s*$/i);
  if (match) {
    return { cidade: match[1].trim(), uf: match[2].toUpperCase() };
  }
  return { cidade: null, uf: null };
}

async function gronerPost(path, body) {
  const tenant = process.env.GRONER_TENANT?.trim();
  const token = process.env.GRONER_TOKEN?.trim();
  if (!tenant || !token) throw new Error('Integração Groner não configurada.');

  const res = await fetch(`https://${tenant}.api.groner.app/api${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
        : `Groner POST ${path} → ${res.status}: ${text.slice(0, 300)}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return desembrulharResposta(data);
}

async function buscarContatoExistente({ cliente }) {
  const filtros = {
    nome: cliente?.nome?.trim() || '',
    email: cliente?.email?.trim() || '',
    documento: cliente?.documento?.trim() || '',
    telefone: cliente?.telefone?.trim() || '',
  };

  const temFiltro = filtros.nome || filtros.email || filtros.documento || filtros.telefone;
  if (!temFiltro) return null;

  const contatos = await buscarContatosGroner(filtros);
  if (!contatos.length) return null;

  const docAlvo = apenasDigitos(filtros.documento);
  const emailAlvo = filtros.email.toLowerCase();

  let melhor = contatos[0];
  if (docAlvo) {
    const porDoc = contatos.find((c) => apenasDigitos(c.documento) === docAlvo);
    if (porDoc) melhor = porDoc;
  } else if (emailAlvo) {
    const porEmail = contatos.find((c) => String(c.email ?? '').toLowerCase() === emailAlvo);
    if (porEmail) melhor = porEmail;
  }

  return melhor;
}

async function criarLeadNaGroner({ cliente, usina }) {
  const origemId = getOrigemPreVendaId();
  if (!origemId) {
    throw new Error(
      'Origem Pré-venda não configurada. Defina preVenda.origemId em config/groner-integracao.json ou GRONER_ORIGEM_PRE_VENDA_ID no .env.',
    );
  }

  const { cidade, uf } = parseEnderecoCidadeUf(usina?.endereco);
  const tel = normalizarTelefone(cliente?.telefone);
  const nome = String(cliente?.nome ?? '').trim();
  if (!nome) throw new Error('Nome do cliente é obrigatório para cadastrar na Groner.');

  const body = {
    Nome: nome,
    Email: String(cliente?.email ?? '').trim() || undefined,
    Celular: tel || undefined,
    DDICelular: '55',
    Documento: apenasDigitos(cliente?.documento) || undefined,
    Tipo: inferirTipoPessoa(cliente?.documento),
    OrigemId: origemId,
    Cidade: cidade || undefined,
    UF: uf || undefined,
    Consumo: kwpParaConsumo(usina?.kwp) || undefined,
    CriarProjeto: false,
    Nota: 'Cadastro automático — MHZ Propostas (Pré-venda)',
  };

  const res = await gronerPost('/Lead', body);
  const leadId = extrairId(res);
  if (!leadId) throw new Error('Lead criado na Groner, mas ID não retornado.');

  return { leadId: Number(leadId), raw: res };
}

async function criarProjetoNaGroner({ leadId, cliente, usina }) {
  const tipoProjetoId = getTipoProjetoPreVendaId();
  if (!tipoProjetoId) {
    throw new Error(
      'Tipo de projeto Pré-venda não configurado. Defina preVenda.tipoProjetoId em config/groner-integracao.json ou GRONER_TIPO_PROJETO_PRE_VENDA_ID no .env.',
    );
  }

  const nomeCliente = String(cliente?.nome ?? 'Cliente').trim();
  const body = {
    Nome: `Pré-venda — ${nomeCliente}`.slice(0, 120),
    LeadId: Number(leadId),
    TipoProjetoId: tipoProjetoId,
    Consumo: kwpParaConsumo(usina?.kwp) || undefined,
    Descricao: String(usina?.endereco ?? '').trim() || undefined,
    Nota: `Proposta MHZ · ${usina?.kwp ?? '?'} kWp · ${usina?.qtdPlacas ?? '?'} placas`,
  };

  const res = await gronerPost('/Projeto', body);
  const projetoId = extrairId(res);
  if (!projetoId) throw new Error('Projeto criado na Groner, mas ID não retornado.');

  return { projetoId: Number(projetoId), raw: res };
}

/**
 * Garante Lead + Projeto na Groner para sync da proposta.
 */
export async function garantirContatoPropostaGroner({ leadId, projetoId, cliente, usina }) {
  const pid = Number(projetoId);
  const lid = Number(leadId);

  if (pid) {
    let dados;
    if (lid) {
      dados = await carregarDadosFormulario(lid, pid);
    } else {
      const projeto = await obterProjetoPorId(pid);
      const lead = projeto?.leadId ? await obterLeadPorId(projeto.leadId) : null;
      dados = {
        lead,
        projeto,
        formulario: montarPayloadFormulario(
          lead ?? {
            id: projeto?.leadId,
            nome: cliente?.nome,
            email: cliente?.email,
            documento: cliente?.documento,
            telefone: cliente?.telefone,
            endereco: { completo: usina?.endereco ?? '' },
          },
          projeto,
        ),
      };
    }

    return {
      ok: true,
      criado: false,
      leadId: dados.formulario?.groner?.leadId ?? lid,
      projetoId: pid,
      urlNegocio: montarUrlNegocioGroner(pid),
      acao: 'Negócio já vinculado',
      ...dados,
    };
  }

  let leadIdFinal = lid || null;
  let projetoIdFinal = null;
  const acao = [];

  const existente = await buscarContatoExistente({ cliente });
  if (existente?.id) {
    leadIdFinal = existente.id;
    acao.push('Lead encontrado na busca');

    if (existente.projetos?.length) {
      projetoIdFinal = existente.projetos[0].id;
      acao.push('Projeto existente reutilizado');
    }
  }

  if (!leadIdFinal) {
    const criado = await criarLeadNaGroner({ cliente, usina });
    leadIdFinal = criado.leadId;
    acao.push('Lead criado (origem Pré-venda)');
  }

  if (!projetoIdFinal) {
    const criadoProj = await criarProjetoNaGroner({
      leadId: leadIdFinal,
      cliente,
      usina,
    });
    projetoIdFinal = criadoProj.projetoId;
    acao.push('Projeto criado (tipo Pré-venda)');
  }

  const dados = await carregarDadosFormulario(leadIdFinal, projetoIdFinal);

  return {
    ok: true,
    criado: acao.some((a) => a.includes('criado')),
    leadId: leadIdFinal,
    projetoId: projetoIdFinal,
    urlNegocio: montarUrlNegocioGroner(projetoIdFinal),
    acao: acao.join(' · '),
    preVenda: {
      origemId: getOrigemPreVendaId(),
      tipoProjetoId: getTipoProjetoPreVendaId(),
    },
    ...dados,
  };
}
