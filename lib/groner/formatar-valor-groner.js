/**
 * Parse e formatação de números para campos Numero da Groner (pt-BR).
 * A API trata ponto como separador a remover — "59.9" vira 599.
 * Sempre enviar vírgula decimal: "59,90", "1239,90", "8,50".
 */

/** Converte string/number BR ou EN para número JavaScript. */
export function parseNumeroGroner(valor) {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }

  let s = String(valor).trim();
  if (!s) return null;

  s = s.replace(/[R$\s]/gi, '');

  if (/^\d+(\.\d+)?$/.test(s)) {
    return Number(s);
  }

  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(',', '.'));
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+\.\d{3},\d+$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }

  const normalizado = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Formata número para campo personalizado Numero na Groner.
 * @param {number|string|null} valor
 * @param {{ decimais?: number, inteiro?: boolean }} opts
 */
export function formatarNumeroGroner(valor, { decimais = 2, inteiro = false } = {}) {
  const n = parseNumeroGroner(valor);
  if (n == null) return null;

  if (inteiro) {
    return String(Math.round(n));
  }

  const casas = Math.max(0, decimais);
  const [intPart, decPart = ''] = n.toFixed(casas).split('.');
  if (casas === 0) return intPart;
  return `${intPart},${decPart}`;
}

/** Atalho para valores monetários (mensalidade, totais). */
export function formatarMoedaGroner(valor) {
  return formatarNumeroGroner(valor, { decimais: 2 });
}

/** kWp — até 2 casas decimais. */
export function formatarKwpGroner(valor) {
  return formatarNumeroGroner(valor, { decimais: 2 });
}

/** Quantidade inteira (placas). */
export function formatarInteiroGroner(valor) {
  return formatarNumeroGroner(valor, { inteiro: true });
}

/** Mapeia chave do campo → formatter. */
export function formatarValorCampoGroner(chave, valor) {
  if (valor == null || valor === '') return null;

  switch (chave) {
    case 'kwp':
      return formatarKwpGroner(valor);
    case 'qtdPlacas':
      return formatarInteiroGroner(valor);
    case 'valorTotalProposta':
    case 'valorTotalSistema':
    case 'mensalidade':
      return formatarMoedaGroner(valor);
    default:
      return formatarNumeroGroner(valor);
  }
}
