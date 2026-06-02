import gronerIntegracao from '../../config/groner-integracao.json' with { type: 'json' };
import { desembrulharResposta } from './client.js';
import { getAbaDinamicaId } from './campos-config.js';

function getConfig() {
  const tenant = process.env.GRONER_TENANT?.trim();
  const token = process.env.GRONER_TOKEN?.trim();
  if (!tenant || !token) {
    throw new Error('Integração Groner não configurada.');
  }
  return {
    token,
    baseUrl: `https://${tenant}.api.groner.app/api`,
  };
}

const DEFAULT_TIMEOUT_MS = 120000;

function extrairArquivoId(data) {
  const inner = desembrulharResposta(data) ?? data;
  if (!inner || typeof inner !== 'object') return null;
  return (
    inner.id ??
    inner.Id ??
    inner.arquivoId ??
    inner.ArquivoId ??
    inner.arquivo?.id ??
    inner.Arquivo?.Id ??
    null
  );
}

function getAbaDinamicaIdLocal() {
  return getAbaDinamicaId();
}

/**
 * Upload do PDF gerado — igual ao CRM:
 * POST /api/arquivo?campoId=171&projetoId=...&comprimir=false&abaDinamicaId=2
 * multipart: file (application/pdf)
 */
export async function enviarPdfCampoPersonalizado({
  projetoId,
  campoId,
  buffer,
  nomeArquivo = 'proposta.pdf',
  comprimir = false,
  abaDinamicaId = getAbaDinamicaIdLocal(),
}) {
  const pid = Number(projetoId);
  const cid = Number(campoId);
  if (!pid || !cid) {
    throw new Error('projetoId e campoId (pdfProposta) são obrigatórios.');
  }

  const { token, baseUrl } = getConfig();
  const params = new URLSearchParams({
    campoId: String(cid),
    projetoId: String(pid),
    comprimir: String(comprimir),
    abaDinamicaId: String(abaDinamicaId ?? 2),
  });

  const url = `${baseUrl}/arquivo?${params.toString()}`;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', blob, nomeArquivo);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: form,
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const err = new Error(
        typeof data === 'object' && data?.title
          ? data.title
          : `Groner upload PDF ${res.status}: ${text.slice(0, 300)}`,
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }

    const arquivoId = extrairArquivoId(data);
    return {
      arquivoId,
      raw: desembrulharResposta(data),
    };
  } finally {
    clearTimeout(timer);
  }
}
