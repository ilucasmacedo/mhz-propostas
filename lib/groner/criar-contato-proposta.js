import {
  buscarLeadExato,
  carregarDadosFormulario,
  desembrulharResposta,
  gronerMutate,
  normalizarTelefone,
  apenasDigitos,
  obterLeadPorId,
  obterProjetoPorId,
} from './client.js';
import { getOrigemPreVendaId, getTipoProjetoPreVendaId } from './integracao-config.js';
import { montarPayloadFormulario } from './mappers.js';
import { montarUrlNegocioGroner } from './url.js';
import { getGronerNotaCadastroLead, getGronerNotaProjetoPrefixo } from '../cliente-config.js';

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

/** Só reutiliza Lead se CPF, e-mail ou telefone bater exatamente na Groner (nunca por nome). */
async function buscarContatoExistente({ cliente }) {
  const doc = apenasDigitos(cliente?.documento);
  const email = String(cliente?.email ?? '').trim();
  const telefone = String(cliente?.telefone ?? '').trim();

  if (!doc && !email && !telefone) return null;

  return buscarLeadExato({ documento: doc || undefined, email, telefone });
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
    Nota: getGronerNotaCadastroLead(),
  };

  const res = await gronerMutate('/Lead', body);
  const leadId = extrairId(res);
  if (!leadId) throw new Error('Lead criado na Groner, mas ID não retornado.');

  return { leadId: Number(leadId), raw: res };
}

async function criarProjetoNaGroner({ leadId, cliente, usina }) {
  const tipoProjetoId = getTipoProjetoPreVendaId();
  const origemId = getOrigemPreVendaId();
  if (!tipoProjetoId) {
    throw new Error(
      'Tipo de projeto Pré-venda não configurado. Defina preVenda.tipoProjetoId em config/groner-integracao.json ou GRONER_TIPO_PROJETO_PRE_VENDA_ID no .env.',
    );
  }

  const nomeCliente = String(cliente?.nome ?? 'Cliente').trim();
  const kwp = usina?.kwp != null ? `${usina.kwp} kWp` : '';
  const sufixo = [kwp, usina?.qtdPlacas ? `${usina.qtdPlacas} placas` : '']
    .filter(Boolean)
    .join(' · ');

  const body = {
    Nome: (`Pré-venda — ${nomeCliente}${sufixo ? ` · ${sufixo}` : ''}`).slice(0, 120),
    LeadId: Number(leadId),
    TipoProjetoId: tipoProjetoId,
    OrigemId: origemId || undefined,
    Consumo: kwpParaConsumo(usina?.kwp) || undefined,
    Descricao: String(usina?.endereco ?? '').trim() || undefined,
    Nota: `${getGronerNotaProjetoPrefixo()} · ${usina?.kwp ?? '?'} kWp · ${usina?.qtdPlacas ?? '?'} placas`,
  };

  const res = await gronerMutate('/Projeto', body);
  const projetoId = extrairId(res);
  if (!projetoId) throw new Error('Projeto criado na Groner, mas ID não retornado.');

  return { projetoId: Number(projetoId), raw: res };
}

/**
 * Novo negócio Pré-venda para um Lead já vinculado (mesmo contato, outro modelo/proposta).
 */
export async function criarNovoProjetoParaLead({ leadId, cliente, usina }) {
  const lid = Number(leadId);
  if (!lid) {
    throw new Error(
      'Selecione um contato na Groner (Buscar → Carregar dados) antes de gerar projeto novo.',
    );
  }

  const lead = await obterLeadPorId(lid);
  if (!lead) throw new Error('Contato (Lead) não encontrado na Groner.');

  const criadoProj = await criarProjetoNaGroner({
    leadId: lid,
    cliente: {
      nome: cliente?.nome ?? lead.nome,
      email: cliente?.email ?? lead.email,
      documento: cliente?.documento ?? lead.documento,
      telefone: cliente?.telefone ?? lead.telefone,
    },
    usina,
  });

  const dados = await carregarDadosFormulario(lid, criadoProj.projetoId);

  return {
    ok: true,
    criado: true,
    leadId: lid,
    projetoId: criadoProj.projetoId,
    urlNegocio: montarUrlNegocioGroner(criadoProj.projetoId),
    acao: 'Novo projeto Pré-venda (origem + tipo) para contato existente',
    preVenda: {
      origemId: getOrigemPreVendaId(),
      tipoProjetoId: getTipoProjetoPreVendaId(),
    },
    ...dados,
  };
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
    acao.push('Lead encontrado (CPF/e-mail/telefone iguais)');
  }

  if (!leadIdFinal) {
    const criado = await criarLeadNaGroner({ cliente, usina });
    leadIdFinal = criado.leadId;
    acao.push('Lead criado (origem Pré-venda)');
  }

  // Sempre novo negócio Pré-venda — não reutiliza projeto antigo do contato
  const criadoProj = await criarProjetoNaGroner({
    leadId: leadIdFinal,
    cliente,
    usina,
  });
  projetoIdFinal = criadoProj.projetoId;
  acao.push('Projeto criado (tipo Pré-venda)');

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
