import defaultConfig from '../config/precificacao.json';
import {
  loadStoredConfig,
  saveStoredConfig,
  clearStoredConfig,
  cloneConfig,
  notifyConfigUpdated,
} from './config-store.js';

const COBERTURAS_PADRAO = {
  ACESSO: ['Monitoramento online', 'Alertas de falha', 'Relatório mensal básico', 'Serviços avulsos sem desconto'],
  PADRAO: ['Tudo do Acesso', 'Suporte técnico remoto', 'Histórico de geração', 'Desconto em serviços avulsos'],
  PREMIUM: ['Tudo do Padrão', 'Prioridade no atendimento', 'Visitas programadas', 'Desconto em serviços avulsos'],
};

let activeConfig = loadStoredConfig(defaultConfig);

export let PLANOS = {};
export let SEM_PLANO = 'NENHUM';
export let FAIXAS_KWP = [];
export let FAIXAS_DESLOCAMENTO = [];
export let SERVICOS = [];
export let COBERTURAS = {};
export let CONFIG_PRECIFICACAO = activeConfig;

function rebuildDerived(config) {
  activeConfig = config;
  CONFIG_PRECIFICACAO = config;

  PLANOS = Object.fromEntries(
    Object.entries(config.planos).map(([codigo, plano]) => [
      codigo,
      {
        ...plano,
        codigo,
        descontoAvulso: Boolean(plano.desconto_avulso),
        coberturas: plano.coberturas ?? COBERTURAS_PADRAO[codigo] ?? [],
      },
    ]),
  );

  SEM_PLANO = config.constantes.sem_plano;

  FAIXAS_KWP = config.faixas_kwp.map((f) => ({
    ...f,
    precos: f.precos ?? undefined,
  }));

  FAIXAS_DESLOCAMENTO = config.faixas_deslocamento.map((f) => ({
    km_min: f.km_min,
    km_max: f.km_max,
    taxa: f.taxa_por_km,
  }));

  SERVICOS = config.servicos_avulsos.map((s) => ({
    codigo: s.codigo,
    descricao: s.descricao,
    fora: s.fora_plano,
    com: s.com_plano,
    tipo: s.tipo_calculo,
    presencial: s.presencial,
    keyword: s.keyword ?? s.descricao.split(' ').pop()?.toLowerCase() ?? s.codigo,
  }));

  COBERTURAS = Object.fromEntries(
    Object.entries(PLANOS).map(([codigo, p]) => [codigo, p.coberturas]),
  );
}

rebuildDerived(activeConfig);

export function getActiveConfig() {
  return activeConfig;
}

export function applyConfig(config, { persist = true } = {}) {
  const next = cloneConfig(config);
  if (persist) saveStoredConfig(next);
  rebuildDerived(next);
  notifyConfigUpdated();
  return next;
}

export function resetConfigToDefault() {
  clearStoredConfig();
  rebuildDerived(cloneConfig(defaultConfig));
  notifyConfigUpdated();
  return activeConfig;
}

export function exportActiveConfig() {
  return cloneConfig(activeConfig);
}

function getConstantes() {
  return activeConfig.constantes;
}

export function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

export function temPlanoContratado(plano) {
  return Boolean(plano) && plano !== SEM_PLANO;
}

export function planoTemDescontoAvulso(plano) {
  return Boolean(PLANOS[plano]?.descontoAvulso);
}

export function buscarFaixaKwp(kwp) {
  const { kwp_maximo_automatico } = getConstantes();
  if (kwp > kwp_maximo_automatico) return FAIXAS_KWP[FAIXAS_KWP.length - 1];
  return FAIXAS_KWP.find((f) => kwp > f.kwp_min && (f.kwp_max === null || kwp <= f.kwp_max));
}

export function labelFaixaKwp(faixa) {
  const { kwp_maximo_automatico } = getConstantes();
  if (!faixa || faixa.sob_consulta) return `Acima de ${kwp_maximo_automatico} kWp`;
  return `${faixa.kwp_min} a ${faixa.kwp_max} kWp`;
}

export function calcularDeslocamento(distanciaKm) {
  const km = Math.ceil(Number(distanciaKm) || 0);
  const { raio_base_km, distancia_maxima_automatica } = getConstantes();

  if (km <= raio_base_km) {
    return { km, km_excedente: 0, taxa: 0, valor: 0, a_combinar: false };
  }

  const faixa = FAIXAS_DESLOCAMENTO.find(
    (f) => km > f.km_min && (f.km_max === null || km <= f.km_max),
  );

  if (!faixa) {
    return { km, km_excedente: 0, taxa: 0, valor: 0, a_combinar: km > distancia_maxima_automatica };
  }

  const kmExcedente = km - raio_base_km;
  const valor = arredondar(kmExcedente * faixa.taxa);
  return { km, km_excedente: kmExcedente, taxa: faixa.taxa, valor, a_combinar: false };
}

export function calcularMensalidade(kwp, plano) {
  const faixa = buscarFaixaKwp(kwp);

  if (!temPlanoContratado(plano)) {
    return { sob_consulta: false, motivos: [], mensalidade: null, faixa };
  }

  const motivos = [];
  if (faixa.sob_consulta) motivos.push('KWP_ACIMA_50');

  if (motivos.length > 0) {
    return { sob_consulta: true, motivos, mensalidade: null, faixa };
  }

  return {
    sob_consulta: false,
    motivos: [],
    mensalidade: faixa.precos?.[plano] ?? null,
    faixa,
  };
}

/** Adicional embutido na mensalidade (distância acima do raio base), sem expor como item avulso */
export function adicionalMensalidadeDistancia(distanciaKm, incluirDeslocamentoGlobal = true) {
  if (!incluirDeslocamentoGlobal) return 0;
  const { raio_base_km } = getConstantes();
  if ((Number(distanciaKm) || 0) <= raio_base_km) return 0;
  const d = calcularDeslocamento(distanciaKm);
  if (d.a_combinar) return 0;
  return d.valor;
}

export function mensalidadeRecorrenteComDistancia(
  kwp,
  plano,
  distanciaKm,
  incluirDeslocamentoGlobal = true,
) {
  const base = calcularMensalidade(kwp, plano);
  if (base.sob_consulta || base.mensalidade == null) {
    return { ...base, mensalidadeRecorrente: null };
  }
  const adicional = adicionalMensalidadeDistancia(distanciaKm, incluirDeslocamentoGlobal);
  return {
    ...base,
    mensalidadeRecorrente: arredondar(base.mensalidade + adicional),
  };
}

export function calcularServico(servico, opts) {
  const { temPlanoAtivo, qtdPlacas, valorContrato, distanciaKm, incluirDeslocamento } = opts;
  const precoBase = temPlanoAtivo ? servico.com : servico.fora;
  let subtotal = 0;

  switch (servico.tipo) {
    case 'FIXO':
      subtotal = precoBase;
      break;
    case 'POR_PLACA':
      subtotal = precoBase * (qtdPlacas || 0);
      break;
    case 'PERCENTUAL':
      subtotal = (valorContrato || 0) * precoBase;
      break;
    default:
      subtotal = 0;
  }

  subtotal = arredondar(subtotal);

  let deslocamento = 0;
  const { raio_base_km } = getConstantes();
  if (incluirDeslocamento && servico.presencial && distanciaKm > raio_base_km) {
    const d = calcularDeslocamento(distanciaKm);
    deslocamento = d.a_combinar ? 0 : d.valor;
  }

  return {
    codigo: servico.codigo,
    descricao: servico.descricao,
    subtotal: arredondar(subtotal + deslocamento),
    valorServico: subtotal,
    deslocamento,
  };
}

export function gerarNumeroProposta() {
  const ano = new Date().getFullYear();
  const { numero_proposta_seq_min: min, numero_proposta_seq_max: max } = getConstantes();
  const seq = String(Math.floor(Math.random() * (max - min + 1)) + min);
  return `${ano}-${seq}`;
}

export function calcularProposta(input) {
  const constantes = getConstantes();
  const {
    kwp,
    plano,
    distanciaKm,
    servicosSelecionados = [],
    qtdPlacas = 0,
    valorContrato = 0,
    valorInvestimento = 0,
    percentualInvestimento = constantes.percentual_investimento_padrao,
    incluirDeslocamentoGlobal = true,
    temPlanoAtivo = false,
  } = input;

  const mensalidadeResult = temPlanoContratado(plano)
    ? calcularMensalidade(kwp, plano)
    : { sob_consulta: false, motivos: [], mensalidade: null, faixa: buscarFaixaKwp(kwp) };

  const deslocamento = calcularDeslocamento(distanciaKm);
  const motivos = [...mensalidadeResult.motivos];

  const usarPrecoComPlano =
    planoTemDescontoAvulso(plano) &&
    (temPlanoAtivo || (temPlanoContratado(plano) && !mensalidadeResult.sob_consulta));

  if (deslocamento.a_combinar) motivos.push('DISTANCIA_ACIMA_600');

  const mensalidadeRecorrente =
    temPlanoContratado(plano) && !mensalidadeResult.sob_consulta && mensalidadeResult.mensalidade != null
      ? arredondar(
          mensalidadeResult.mensalidade +
            adicionalMensalidadeDistancia(distanciaKm, incluirDeslocamentoGlobal),
        )
      : mensalidadeResult.mensalidade;

  const itens = [];

  if (temPlanoContratado(plano) && !mensalidadeResult.sob_consulta && PLANOS[plano]) {
    itens.push({
      tipo: 'MENSALIDADE',
      codigo: plano,
      descricao: `${PLANOS[plano].nome} — faixa ${labelFaixaKwp(mensalidadeResult.faixa)}`,
      subtotal: mensalidadeRecorrente,
    });
  }

  let totalAvulsos = 0;

  for (const codigo of servicosSelecionados) {
    const servico = SERVICOS.find((s) => s.codigo === codigo);
    if (!servico) continue;
    const result = calcularServico(servico, {
      temPlanoAtivo: usarPrecoComPlano,
      qtdPlacas,
      valorContrato,
      distanciaKm,
      incluirDeslocamento: false,
    });
    itens.push({
      tipo: 'SERVICO',
      codigo,
      descricao: servico.descricao,
      subtotal: result.subtotal,
    });
    totalAvulsos += result.subtotal;
  }

  if (valorInvestimento > 0) {
    const taxaInv = arredondar(valorInvestimento * (percentualInvestimento / 100));
    itens.push({
      tipo: 'INVESTIMENTO',
      codigo: 'TAXA_INVESTIMENTO',
      descricao: `Taxa sobre investimento (${percentualInvestimento}%)`,
      subtotal: taxaInv,
    });
    totalAvulsos += taxaInv;
  }

  totalAvulsos = arredondar(totalAvulsos);
  const sobConsultaPlano = temPlanoContratado(plano) && mensalidadeResult.sob_consulta;
  const primeiraCobranca =
    sobConsultaPlano && deslocamento.a_combinar
      ? null
      : arredondar((mensalidadeRecorrente || 0) + totalAvulsos);

  return {
    sob_consulta: sobConsultaPlano || deslocamento.a_combinar,
    motivos_sob_consulta: motivos,
    mensalidade: mensalidadeRecorrente,
    faixa_kwp: mensalidadeResult.faixa,
    plano,
    itens,
    deslocamento,
    totais: {
      recorrente_mensal: mensalidadeRecorrente,
      avulsos: totalAvulsos,
      primeira_cobranca: primeiraCobranca,
    },
  };
}

export function precosComparativoPlanos(kwp, distanciaKm = 0, planoSelecionado = null) {
  const adicional = adicionalMensalidadeDistancia(distanciaKm);

  return Object.keys(PLANOS).map((codigo) => {
    const result = calcularMensalidade(kwp, codigo);
    let mensalidade = result.mensalidade;
    const incluirKm =
      codigo === 'PREMIUM' || (planoSelecionado && codigo === planoSelecionado);
    if (mensalidade != null && adicional > 0 && !result.sob_consulta && incluirKm) {
      mensalidade = arredondar(mensalidade + adicional);
    }
    const parcelas = getParcelasCartaoPlano(codigo);
    return {
      ...PLANOS[codigo],
      mensalidade,
      parcelas_cartao: parcelas,
      parcela_cartao:
        parcelas && mensalidade != null ? arredondar(mensalidade / parcelas) : null,
      sob_consulta: result.sob_consulta,
      faixa: labelFaixaKwp(result.faixa),
    };
  });
}

const ORDEM_PLANOS_PDF = ['ACESSO', 'PADRAO', 'PREMIUM'];

/** Matriz de coberturas para página comparativa do PDF */
export function getMatrizCoberturasPlanos() {
  const matriz = activeConfig.matriz_coberturas_planos;
  if (Array.isArray(matriz) && matriz.length) return matriz;
  return [];
}

export function getOrdemPlanosPdf() {
  return ORDEM_PLANOS_PDF.filter((c) => PLANOS[c]);
}

export function rotuloPlanoPdf(codigo) {
  const p = PLANOS[codigo];
  if (!p) return codigo;
  if (codigo === 'ACESSO' && p.alias) return String(p.alias).toUpperCase();
  if (codigo === 'PADRAO') return 'PADRÃO';
  return (p.nome || codigo).replace(/^Plano\s+/i, '').toUpperCase();
}

export function isPlanoRecomendado(codigo) {
  return Boolean(PLANOS[codigo]?.recomendado);
}

export function getParcelasCartaoPlano(codigo) {
  const n = Number(PLANOS[codigo]?.parcelas_cartao);
  return n > 1 ? n : null;
}

/** Como exibir preço na UI/PDF: mensal ou parcelas no cartão (Premium) */
export function exibicaoPrecoPlano(codigo, mensalidade) {
  const parcelas = getParcelasCartaoPlano(codigo);
  if (parcelas && mensalidade != null && mensalidade !== undefined) {
    return {
      modo: 'parcelas',
      parcelas,
      valorParcela: arredondar(mensalidade / parcelas),
      mensalidade,
    };
  }
  return { modo: 'mensal', mensalidade };
}
