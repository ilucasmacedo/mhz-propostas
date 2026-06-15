function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function parseNumeroPositivo(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseInteiroPositivo(valor) {
  const n = parseNumeroPositivo(valor);
  return n != null ? Math.round(n) : null;
}

/** Primeiro valor numérico positivo da lista */
function primeiroNaoNulo(...valores) {
  for (const v of valores) {
    const n = parseNumeroPositivo(v);
    if (n != null) return n;
  }
  return null;
}

const CAMPOS_POTENCIA = [
  'potenciaCc',
  'PotenciaCC',
  'PotenciaCc',
  'usinaPotenciaKwp',
  'UsinaPotenciaKwp',
  'potenciaKwp',
  'PotenciaKwp',
  'potencia',
  'Potencia',
  'potenciaModulos',
  'PotenciaModulos',
];

const CAMPOS_QTD_MODULOS = [
  'quantidadePlacas',
  'QuantidadePlacas',
  'quantidadeModulos',
  'QuantidadeModulos',
  'qtdModulos',
  'QtdModulos',
  'numeroModulos',
  'NumeroModulos',
  'totalModulos',
  'TotalModulos',
  'qtdPlacas',
  'QtdPlacas',
  'numeroPlacas',
  'NumeroPlacas',
];

const OBJETOS_ANINHADOS_KIT = [
  'kitFechado',
  'KitFechado',
  'kit',
  'Kit',
  'preProposta',
  'PreProposta',
  'simulacao',
  'Simulacao',
  'dadosKit',
  'DadosKit',
];

const LISTAS_KITS = [
  'kitsSelecionados',
  'KitsSelecionados',
  'kits',
  'Kits',
  'itensKit',
  'ItensKit',
];

const CAMPOS_PRECO = [
  'precoSimulacao',
  'PrecoSimulacao',
  'precoSimulacaoAceita',
  'PrecoSimulacaoAceita',
  'valorTotal',
  'ValorTotal',
  'precoTotal',
  'PrecoTotal',
  'total',
  'Total',
  'valorProposta',
  'ValorProposta',
  'valorFinal',
  'ValorFinal',
];

function lerCampo(obj, nome) {
  return obj?.[nome];
}

/** Potência CC (kWp) — ordem de leitura conforme API Groner */
export function extrairPotenciaKwp(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const valores = CAMPOS_POTENCIA.map((c) => lerCampo(obj, c));
  return primeiroNaoNulo(...valores);
}

function somarModulosListaKits(lista) {
  if (!Array.isArray(lista) || !lista.length) return null;

  let total = 0;
  let encontrou = false;

  for (const kit of lista) {
    if (!kit || typeof kit !== 'object') continue;
    const qtdModulos = primeiroNaoNulo(
      kit.qtdModulos,
      kit.QtdModulos,
      kit.quantidadeModulos,
      kit.QuantidadeModulos,
      kit.numeroModulos,
      kit.NumeroModulos,
    );
    if (qtdModulos == null) continue;
    const quantidade = parseNumeroPositivo(kit.quantidade ?? kit.Quantidade) ?? 1;
    total += qtdModulos * quantidade;
    encontrou = true;
  }

  return encontrou ? Math.round(total) : null;
}

/** Quantidade de placas/módulos — campos diretos, objetos aninhados e listas de kits */
export function extrairQtdModulos(obj, visitados = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return null;
  if (visitados.has(obj)) return null;
  visitados.add(obj);

  const direto = primeiroNaoNulo(...CAMPOS_QTD_MODULOS.map((c) => lerCampo(obj, c)));
  if (direto != null) return Math.round(direto);

  for (const chave of LISTAS_KITS) {
    const soma = somarModulosListaKits(obj[chave]);
    if (soma != null) return soma;
  }

  for (const chave of OBJETOS_ANINHADOS_KIT) {
    const nested = obj[chave];
    if (nested && typeof nested === 'object') {
      const qtd = extrairQtdModulos(nested, visitados);
      if (qtd != null) return qtd;
    }
  }

  return null;
}

/** Valor da proposta — ordem de leitura conforme API Groner */
export function extrairPrecoSimulacao(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return primeiroNaoNulo(...CAMPOS_PRECO.map((c) => lerCampo(obj, c)));
}

/** Mapeia um objeto bruto (aceita, pré-proposta ou projeto) para os três campos principais */
export function mapPrePropostaValores(raw) {
  if (!raw || typeof raw !== 'object') {
    return { potenciaKwp: null, qtdPlacas: null, precoSimulacao: null };
  }
  return {
    potenciaKwp: extrairPotenciaKwp(raw),
    qtdPlacas: extrairQtdModulos(raw),
    precoSimulacao: extrairPrecoSimulacao(raw),
  };
}

/** Combina múltiplas fontes — primeira não nula de cada campo (não descarta potência por falta de módulos) */
export function combinarPropostaValores(...fontes) {
  let potenciaKwp = null;
  let qtdPlacas = null;
  let precoSimulacao = null;

  for (const fonte of fontes) {
    if (!fonte) continue;
    if (potenciaKwp == null && fonte.potenciaKwp != null) potenciaKwp = fonte.potenciaKwp;
    if (qtdPlacas == null && fonte.qtdPlacas != null) qtdPlacas = fonte.qtdPlacas;
    if (precoSimulacao == null && fonte.precoSimulacao != null) {
      precoSimulacao = fonte.precoSimulacao;
    }
  }

  return { potenciaKwp, qtdPlacas, precoSimulacao };
}

/** Fallback final: campos diretos do Projeto + estimativa kWp por consumo (somente se proposta não tiver) */
export function mapProjetoFallbackValores(projetoRaw) {
  if (!projetoRaw || typeof projetoRaw !== 'object') {
    return { potenciaKwp: null, qtdPlacas: null, precoSimulacao: null };
  }

  const mapeado = mapPrePropostaValores(projetoRaw);
  const consumo = projetoRaw.consumo ?? projetoRaw.Consumo ?? null;

  return {
    potenciaKwp: mapeado.potenciaKwp ?? consumoParaKwp(consumo),
    qtdPlacas:
      mapeado.qtdPlacas ??
      parseInteiroPositivo(projetoRaw.quantidadePlacas ?? projetoRaw.QuantidadePlacas),
    precoSimulacao: mapeado.precoSimulacao,
  };
}

/** Mescla dados da proposta sobre o projeto mapeado */
export function aplicarPropostaNoProjeto(projeto, proposta) {
  if (!projeto) return null;
  if (!proposta) return projeto;

  return {
    ...projeto,
    potenciaKwp: proposta.potenciaKwp ?? projeto.potenciaKwp,
    qtdPlacas: proposta.qtdPlacas ?? projeto.qtdPlacas,
    precoSimulacao: proposta.precoSimulacao ?? projeto.precoSimulacao,
    propostaFonte: proposta.fonte ?? null,
    propostaId: proposta.id ?? null,
  };
}

/** Estimativa kWp a partir do consumo mensal (kWh) — referência mercado BR */
export function consumoParaKwp(consumoKwh) {
  const c = Number(consumoKwh);
  if (!c || c <= 0) return null;
  const kwp = c / 130;
  return Math.round(kwp * 100) / 100;
}

function montarEndereco(lead) {
  const e = lead.endereco ?? lead.Endereco ?? lead;
  const logradouro = e.logradouro ?? e.Logradouro ?? '';
  const numero = e.numero ?? e.Numero ?? '';
  const bairro = e.bairro ?? e.Bairro ?? '';
  const cidade = lead.cidade ?? lead.Cidade ?? e.cidade ?? e.Cidade ?? '';
  const uf = lead.uf ?? lead.UF ?? e.uf ?? e.UF ?? '';
  const cep = lead.cep ?? lead.CEP ?? e.cep ?? e.CEP ?? '';

  const rua = [logradouro, numero].filter(Boolean).join(', ');
  const local = [cidade, uf].filter(Boolean).join('/');
  const partes = [rua, bairro, local].filter(Boolean);

  return {
    logradouro,
    numero,
    bairro,
    cidade,
    uf,
    cep: apenasDigitos(cep),
    completo: partes.length ? partes.join(' — ') : '',
  };
}

export function mapProjetoDetalhe(p) {
  if (!p || typeof p !== 'object') return null;

  const id = p.id ?? p.Id ?? p.projetoId ?? p.ProjetoId;
  if (!id) return null;

  const consumo = p.consumo ?? p.Consumo ?? null;
  const potencia = extrairPotenciaKwp(p) ?? consumoParaKwp(consumo);

  return {
    id,
    nome: p.nome ?? p.Nome ?? p.nomeProjeto ?? p.NomeProjeto ?? 'Projeto',
    leadId: p.leadId ?? p.LeadId ?? p.idLead ?? p.IdLead ?? null,
    consumo,
    potenciaKwp: potencia,
    descricao: p.descricao ?? p.Descricao ?? '',
    nota: p.nota ?? p.Nota ?? '',
    tipoProjetoId: p.tipoProjetoId ?? p.TipoProjetoId ?? null,
    statusId: p.statusId ?? p.StatusId ?? null,
    qtdPlacas: extrairQtdModulos(p) ?? parseInteiroPositivo(p.quantidadePlacas ?? p.QuantidadePlacas),
    precoSimulacao: extrairPrecoSimulacao(p),
  };
}

export function mapLeadDetalhe(raw) {
  const lead = raw?.lead ?? raw;
  if (!lead?.id && !lead?.Id) return null;

  const endereco = montarEndereco(lead);
  const consumoLead = lead.consumo ?? lead.Consumo ?? null;

  const projetos = (lead.projetos ?? lead.Projetos ?? [])
    .map(mapProjetoDetalhe)
    .filter(Boolean);

  return {
    id: lead.id ?? lead.Id,
    nome: lead.nome ?? lead.Nome ?? '',
    email: lead.email ?? lead.Email ?? '',
    documento: lead.documento ?? lead.Documento ?? '',
    telefone: lead.celular ?? lead.Celular ?? lead.telefone ?? lead.Telefone ?? '',
    ddi: lead.ddiCelular ?? lead.DDICelular ?? '55',
    tipo: lead.tipo ?? lead.Tipo ?? null,
    consumo: consumoLead,
    endereco,
    projetos,
  };
}

export function montarPayloadFormulario(lead, projeto) {
  const consumo = projeto?.consumo ?? lead?.consumo ?? null;
  const kwp = projeto?.potenciaKwp ?? consumoParaKwp(consumo);

  return {
    cliente: {
      nome: lead.nome,
      documento: lead.documento,
      email: lead.email,
      telefone: lead.telefone,
    },
    usina: {
      kwp: kwp ?? undefined,
      qtdPlacas: projeto?.qtdPlacas ?? undefined,
      endereco: lead.endereco?.completo || projeto?.descricao || undefined,
      consumoKwh: consumo ?? undefined,
    },
    groner: {
      leadId: lead.id,
      projetoId: projeto?.id ?? null,
      projetoNome: projeto?.nome ?? null,
      precoSimulacao: projeto?.precoSimulacao ?? null,
      qtdPlacasProjeto: projeto?.qtdPlacas ?? null,
      propostaFonte: projeto?.propostaFonte ?? null,
      propostaId: projeto?.propostaId ?? null,
    },
    meta: {
      descricaoProjeto: projeto?.descricao ?? '',
      notaProjeto: projeto?.nota ?? '',
    },
  };
}
