import gronerIntegracao from '../../config/groner-integracao.json' with { type: 'json' };

/** Fallback MHZ — usado se JSON não carregar no serverless */
const DEFAULT_PRE_VENDA = {
  origemId: 35,
  tipoProjetoId: 223,
};

function num(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/** Origem "Pré-venda" — env > preVenda.origemId > origemId legado */
export function getOrigemPreVendaId() {
  const fromEnv = process.env.GRONER_ORIGEM_PRE_VENDA_ID?.trim();
  if (fromEnv) return num(fromEnv);

  const fromPreVenda = gronerIntegracao.preVenda?.origemId;
  if (fromPreVenda != null && fromPreVenda !== '') return num(fromPreVenda);

  const legado = gronerIntegracao.origemId;
  if (legado != null && legado !== '') return num(legado);

  return DEFAULT_PRE_VENDA.origemId;
}

/** Tipo de projeto "Pré-venda" — env > preVenda.tipoProjetoId > tipoProjetoId legado */
export function getTipoProjetoPreVendaId() {
  const fromEnv = process.env.GRONER_TIPO_PROJETO_PRE_VENDA_ID?.trim();
  if (fromEnv) return num(fromEnv);

  const fromPreVenda = gronerIntegracao.preVenda?.tipoProjetoId;
  if (fromPreVenda != null && fromPreVenda !== '') return num(fromPreVenda);

  const legado = gronerIntegracao.tipoProjetoId;
  if (legado != null && legado !== '') return num(legado);

  return DEFAULT_PRE_VENDA.tipoProjetoId;
}

export function getPreVendaConfig() {
  return {
    origemId: getOrigemPreVendaId(),
    tipoProjetoId: getTipoProjetoPreVendaId(),
  };
}
