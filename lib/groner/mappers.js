function apenasDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
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
  if (!p) return null;

  const consumo = p.consumo ?? p.Consumo ?? null;
  const potencia =
    p.usinaPotenciaKwp ??
    p.UsinaPotenciaKwp ??
    p.potenciaKwp ??
    p.PotenciaKwp ??
    p.potencia ??
    p.Potencia ??
    consumoParaKwp(consumo);

  return {
    id: p.id ?? p.Id,
    nome: p.nome ?? p.Nome ?? 'Projeto',
    leadId: p.leadId ?? p.LeadId ?? null,
    consumo,
    potenciaKwp: potencia,
    descricao: p.descricao ?? p.Descricao ?? '',
    nota: p.nota ?? p.Nota ?? '',
    tipoProjetoId: p.tipoProjetoId ?? p.TipoProjetoId ?? null,
    statusId: p.statusId ?? p.StatusId ?? null,
    qtdPlacas: p.quantidadePlacas ?? p.QuantidadePlacas ?? null,
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
    },
    meta: {
      descricaoProjeto: projeto?.descricao ?? '',
      notaProjeto: projeto?.nota ?? '',
    },
  };
}
