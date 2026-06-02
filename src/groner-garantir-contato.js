const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Busca ou cria Lead + Projeto (Pré-venda) na Groner a partir do formulário.
 */
export async function garantirContatoPropostaGroner({
  leadId,
  projetoId,
  cliente,
  usina,
}) {
  const res = await fetch(`${API_BASE}/api/groner/garantir-contato`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId, projetoId, cliente, usina }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.erro || 'Falha ao vincular/cadastrar contato na Groner.');
  }

  return data;
}
