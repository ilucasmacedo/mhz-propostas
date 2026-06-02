const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Cria novo negócio Pré-venda para o Lead já selecionado na Groner. */
export async function criarProjetoLeadGroner({ leadId, cliente, usina }) {
  const res = await fetch(`${API_BASE}/api/groner/criar-projeto-lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId, cliente, usina }),
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.erro || 'Falha ao criar projeto na Groner.');
  }

  return data;
}
