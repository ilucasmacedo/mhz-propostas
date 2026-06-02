import gronerIntegracao from '../../config/groner-integracao.json' with { type: 'json' };

/** ID do campo personalizado — prioridade: env > config JSON */
export function getCampoId(chave) {
  const envMap = {
    descricaoProposta: process.env.GRONER_CAMPO_DESCRICAO_PROPOSTA_ID,
    pdfProposta: process.env.GRONER_CAMPO_PDF_PROPOSTA_ID,
    kwp: process.env.GRONER_CAMPO_KWP_ID,
    qtdPlacas: process.env.GRONER_CAMPO_QTD_PLACAS_ID,
    valorTotalProposta: process.env.GRONER_CAMPO_VALOR_TOTAL_PROPOSTA_ID,
    valorTotalSistema: process.env.GRONER_CAMPO_VALOR_TOTAL_SISTEMA_ID,
    plano: process.env.GRONER_CAMPO_PLANO_ID,
    mensalidade: process.env.GRONER_CAMPO_MENSALIDADE_ID,
  };

  const fromEnv = envMap[chave]?.trim();
  if (fromEnv) return Number(fromEnv);

  const fromJson = gronerIntegracao.camposPersonalizados?.[chave];
  if (fromJson != null && fromJson !== '') return Number(fromJson);

  return null;
}

export function getAbaDinamicaId() {
  const fromEnv = process.env.GRONER_ABA_DINAMICA_ID?.trim();
  if (fromEnv) return Number(fromEnv);
  const fromJson = gronerIntegracao.abaDinamicaId;
  return fromJson != null ? Number(fromJson) : 2;
}

export function getCamposConfigurados() {
  const chaves = Object.keys(gronerIntegracao.camposPersonalizados ?? {});
  return Object.fromEntries(chaves.map((k) => [k, getCampoId(k)]));
}
