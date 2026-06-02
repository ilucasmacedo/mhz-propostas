import { gronerApiFetch } from './groner-api.js';

/**
 * Busca ou cria Lead + Projeto (Pré-venda) na Groner a partir do formulário.
 */
export async function garantirContatoPropostaGroner({
  leadId,
  projetoId,
  cliente,
  usina,
}) {
  return gronerApiFetch('/api/groner/garantir-contato', {
    json: { leadId, projetoId, cliente, usina },
  });
}
