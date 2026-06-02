const API_BASE = import.meta.env.VITE_API_BASE || '';

async function enviarPdfGroner({ projetoId, pdfBlob, nomeArquivo }) {
  const res = await fetch(`${API_BASE}/api/groner/upload-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'X-Projeto-Id': String(projetoId),
      'X-Nome-Arquivo': encodeURIComponent(nomeArquivo || 'proposta.pdf'),
    },
    body: pdfBlob,
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.erro || 'Falha ao enviar PDF para a Groner.');
  }
  return data;
}

/**
 * Envia descrição + campos para a Groner; PDF vai em rota separada (binário).
 */
export async function sincronizarDescricaoPropostaGroner({
  projetoId,
  proposta,
  pdfBlob,
  nomeArquivo,
  meta,
}) {
  const res = await fetch(`${API_BASE}/api/groner/sincronizar-proposta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projetoId, proposta, meta }),
  });

  const data = await res.json();

  if (res.status === 503 || (res.status >= 400 && res.status !== 207)) {
    throw new Error(data.erro || 'Falha ao sincronizar proposta com a Groner.');
  }

  let pdfResult = data.pdf ?? { skipped: true };
  if (pdfBlob) {
    try {
      const pdfData = await enviarPdfGroner({ projetoId, pdfBlob, nomeArquivo });
      pdfResult = pdfData.pdf ?? { ok: true };
      data.urlNegocio = pdfData.urlNegocio ?? data.urlNegocio;
    } catch (err) {
      pdfResult = { ok: false, erro: err.message };
      data.erros = [...(data.erros ?? []), `PDF: ${err.message}`];
      data.ok = false;
      data.erro = data.erros.join('\n');
    }
  }

  data.pdf = pdfResult;

  const algoOk =
    data.descricao?.ok ||
    pdfResult?.ok ||
    data.campos?.some((c) => c.ok);

  if (!algoOk) {
    throw new Error(data.erro || 'Nada foi gravado na Groner. Verifique token e projeto vinculado.');
  }

  if (data.erros?.length) {
    data.ok = false;
    data.erro = data.erros.join('\n');
  } else {
    data.ok = true;
  }

  return data;
}
