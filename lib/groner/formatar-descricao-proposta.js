/**
 * Monta descrição da proposta para campo personalizado no CRM Groner.
 * O CRM (campo 172) espera HTML: { "resposta": "<p>...</p>", "projetoId": 123 }
 */
function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(d) {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function escHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function montarTextoPlano(dados) {
  const { numeroProposta, dataEmissao, validadeDias, cliente, usina, plano, resultado, vendedor } =
    dados;

  const validade = new Date(dataEmissao);
  validade.setDate(validade.getDate() + (validadeDias || 0));

  const linhas = [
    'PROPOSTA COMERCIAL — MHZ',
    '',
    `Nº da proposta: ${numeroProposta}`,
    `Emissão: ${formatarData(dataEmissao)}`,
    `Validade: ${formatarData(validade)}`,
    '',
    'CLIENTE',
    `Nome: ${cliente?.nome || '—'}`,
    `CPF/CNPJ: ${cliente?.documento || '—'}`,
    `E-mail: ${cliente?.email || '—'}`,
    `Telefone: ${cliente?.telefone || '—'}`,
    '',
    'USINA',
    `Potência: ${usina?.kwp ?? '—'} kWp`,
    `Placas: ${usina?.qtdPlacas || '—'}`,
    `Endereço: ${usina?.endereco || '—'}`,
    `Distância da base: ${usina?.distanciaKm ?? '—'} km`,
    '',
    'PLANO SELECIONADO',
  ];

  if (plano?.nome === 'Sem plano') {
    linhas.push('Sem plano (apenas serviços avulsos)');
  } else {
    linhas.push(`${plano?.nome || '—'}`);
    linhas.push(`Mensalidade: ${formatarMoeda(resultado?.totais?.recorrente_mensal)}/mês`);
    linhas.push(`Faixa: ${plano?.faixa || '—'}`);
  }

  linhas.push('', 'DETALHAMENTO');

  const itens = resultado?.itens ?? [];
  if (itens.length) {
    for (const item of itens) {
      linhas.push(`${item.descricao} — ${formatarMoeda(item.subtotal)}`);
    }
  } else {
    linhas.push('Apenas mensalidade do plano');
  }

  linhas.push(
    '',
    'TOTAIS',
    `Mensalidade recorrente: ${plano?.nome === 'Sem plano' ? '—' : formatarMoeda(resultado?.totais?.recorrente_mensal)}`,
    `Serviços e taxas (avulsos): ${formatarMoeda(resultado?.totais?.avulsos)}`,
    `Total 1ª cobrança: ${formatarMoeda(resultado?.totais?.primeira_cobranca)}`,
  );

  if (resultado?.sob_consulta) {
    linhas.push('', 'Valores parciais sob consulta comercial.');
  }

  if (vendedor) {
    linhas.push('', `Vendedor: ${vendedor}`);
  }

  linhas.push('', 'Gerado pelo sistema MHZ Propostas');

  return linhas.join('\n');
}

/** Texto simples (legado / debug) */
export function formatarDescricaoProposta(dados) {
  return montarTextoPlano(dados);
}

/** HTML no formato do editor do CRM Groner */
export function formatarDescricaoPropostaHtml(dados) {
  const texto = montarTextoPlano(dados);
  return texto
    .split('\n')
    .map((linha) => {
      const t = linha.trim();
      if (!t) return '<p>&nbsp;</p>';
      return `<p>${escHtml(linha)}</p>`;
    })
    .join('');
}
