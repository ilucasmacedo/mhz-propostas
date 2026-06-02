import { gronerApiFetch } from './groner-api.js';

/** Cria novo negócio Pré-venda para o Lead já selecionado na Groner. */
export async function criarProjetoLeadGroner({ leadId, cliente, usina }) {
  return gronerApiFetch('/api/groner/criar-projeto-lead', {
    json: { leadId, cliente, usina },
  });
}
