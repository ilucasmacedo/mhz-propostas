/** Texto exato das opções do campo radio Plano no CRM Groner */
export const PLANO_GRONER = {
  NENHUM: 'Sem plano',
  ACESSO: 'Plano Acesso',
  PADRAO: 'Plano Padrão',
  PREMIUM: 'Plano Premium',
};

export function planoParaGroner(codigo) {
  const key = String(codigo ?? 'NENHUM').trim().toUpperCase();
  return PLANO_GRONER[key] ?? PLANO_GRONER.NENHUM;
}
