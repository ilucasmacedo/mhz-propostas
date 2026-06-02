import gronerIntegracao from '../../config/groner-integracao.json' with { type: 'json' };

export function getTenantGroner() {
  return process.env.GRONER_TENANT?.trim() || gronerIntegracao.tenant || '';
}

export function getAbaNegocioId() {
  const fromEnv = process.env.GRONER_ABA_DINAMICA_ID?.trim();
  if (fromEnv) return Number(fromEnv);
  const fromJson = gronerIntegracao.abaDinamicaId;
  return fromJson != null ? Number(fromJson) : 2;
}

/** URL do negócio na Groner — aba onde ficam os campos personalizados */
export function montarUrlNegocioGroner(projetoId) {
  const pid = Number(projetoId);
  if (!pid) return null;
  const tenant = getTenantGroner();
  const aba = getAbaNegocioId();
  return `https://${tenant}.groner.app/negocio/${pid}/aba/${aba}`;
}
