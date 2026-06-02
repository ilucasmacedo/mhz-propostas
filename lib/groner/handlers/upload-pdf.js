import { isGronerConfigured } from '../client.js';
import { getCampoId } from '../campos-config.js';
import { enviarPdfCampoPersonalizado } from '../arquivo.js';
import { montarUrlNegocioGroner } from '../url.js';
import {
  handleOptions,
  readRawBody,
  sendJson,
  setCors,
} from './http-utils.js';

/** Upload do PDF em binário (evita limite de body JSON na Vercel). */
export async function handleUploadPdf(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    handleOptions(req, res);
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, erro: 'Use POST.' });
    return;
  }

  try {
    if (!isGronerConfigured()) {
      sendJson(res, 503, {
        ok: false,
        erro: 'Integração Groner não configurada no servidor.',
        code: 'GRONER_NOT_CONFIGURED',
      });
      return;
    }

    const projetoId = Number(req.headers['x-projeto-id']);
    const nomeRaw = req.headers['x-nome-arquivo'];
    const nomeArquivo = nomeRaw ? decodeURIComponent(String(nomeRaw)) : 'proposta.pdf';
    const campoPdf = getCampoId('pdfProposta');

    if (!projetoId) {
      sendJson(res, 400, { ok: false, erro: 'Header X-Projeto-Id é obrigatório.' });
      return;
    }

    if (!campoPdf) {
      sendJson(res, 400, {
        ok: false,
        erro: 'Campo pdfProposta (171) não configurado.',
        code: 'PDF_CAMPO_NAO_CONFIGURADO',
      });
      return;
    }

    const buffer = await readRawBody(req);
    if (!buffer?.length) {
      sendJson(res, 400, { ok: false, erro: 'Corpo da requisição vazio (PDF ausente).' });
      return;
    }

    const upload = await enviarPdfCampoPersonalizado({
      projetoId,
      campoId: campoPdf,
      buffer,
      nomeArquivo,
    });

    sendJson(res, 200, {
      ok: true,
      projetoId,
      urlNegocio: montarUrlNegocioGroner(projetoId),
      pdf: { ok: true, campoId: campoPdf, arquivoId: upload.arquivoId },
    });
  } catch (err) {
    console.error('[groner/upload-pdf]', err);
    const detalhe =
      err.data && typeof err.data === 'object'
        ? JSON.stringify(err.data).slice(0, 400)
        : null;
    sendJson(res, err.status && err.status < 500 ? err.status : 500, {
      ok: false,
      erro: err.message || 'Erro ao enviar PDF para a Groner.',
      code: err.code ?? 'GRONER_PDF_ERROR',
      detalhe,
    });
  }
}
