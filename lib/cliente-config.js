import cliente from '../config/cliente.json' with { type: 'json' };
import gronerIntegracao from '../config/groner-integracao.json' with { type: 'json' };

export function getClienteConfig() {
  return cliente;
}

export function getClienteNomeCurto() {
  return cliente.nomeCurto || cliente.nome || 'Cliente';
}

export function getGronerTenantEsperado() {
  return gronerIntegracao.tenant?.trim() || process.env.GRONER_TENANT?.trim() || '';
}

export function getGronerNotaCadastroLead() {
  return cliente.groner?.notaCadastroLead || `Cadastro automático — ${getClienteNomeCurto()} (Pré-venda)`;
}

export function getGronerNotaProjetoPrefixo() {
  return cliente.groner?.notaProjetoPrefixo || `Proposta ${getClienteNomeCurto()}`;
}
