const API_BASE = import.meta.env.VITE_API_BASE || '';

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Envia descrição (campo texto) + PDF para o Projeto na Groner.
 */
export async function sincronizarDescricaoPropostaGroner({
  projetoId,
  proposta,
  pdfBlob,
  nomeArquivo,
  meta,
}) {
  const payload = { projetoId, proposta, meta };

  if (pdfBlob) {
    payload.pdf = {
      base64: await blobToBase64(pdfBlob),
      nomeArquivo: nomeArquivo || 'proposta.pdf',
    };
  }

  const res = await fetch(`${API_BASE}/api/groner/sincronizar-proposta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.erro || 'Falha ao sincronizar proposta com a Groner.');
  }

  return data;
}
