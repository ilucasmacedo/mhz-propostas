import { getCampoId } from './campos-config.js';
import { enviarPdfCampoPersonalizado } from './arquivo.js';
import { formatarDescricaoPropostaHtml } from './formatar-descricao-proposta.js';
import { responderCampoPersonalizado } from './client.js';
import { montarUrlNegocioGroner } from './url.js';
import { planoParaGroner } from './plano-groner.js';
import { formatarValorCampoGroner } from './formatar-valor-groner.js';

async function responderCampo(chave, projetoId, resposta, { texto = false } = {}) {
  const campoId = getCampoId(chave);
  if (!campoId) {
    return { chave, skipped: true, motivo: 'Campo não configurado' };
  }

  const valor = texto ? String(resposta ?? '').trim() : formatarValorCampoGroner(chave, resposta);
  if (!valor) {
    return { chave, skipped: true, motivo: 'Valor vazio' };
  }

  await responderCampoPersonalizado(campoId, {
    projetoId,
    resposta: valor,
  });

  return { chave, ok: true, campoId, valor };
}

function montarValoresCampos(proposta, meta = {}) {
  const usina = proposta?.usina ?? {};
  const totais = proposta?.resultado?.totais ?? {};
  const valorProposta = totais.primeira_cobranca;

  const precoSimulacao = meta.precoSimulacao ?? null;
  const valorSistema =
    precoSimulacao != null && precoSimulacao !== ''
      ? precoSimulacao
      : usina.valorInvestimento || usina.valorContrato || valorProposta;

  const codigoPlano = proposta?.plano?.codigo ?? proposta?.resultado?.plano ?? 'NENHUM';

  return {
    kwp: usina.kwp,
    qtdPlacas: usina.qtdPlacas ?? meta.qtdPlacasProjeto,
    valorTotalProposta: valorProposta,
    valorTotalSistema: valorSistema,
    plano: planoParaGroner(codigoPlano),
    mensalidade: totais.recorrente_mensal,
  };
}

/**
 * Grava descrição, PDF e campos numéricos no Projeto Groner selecionado.
 */
export async function sincronizarPropostaNaGroner({ projetoId, proposta, pdf, meta }) {
  const pid = Number(projetoId);
  if (!pid) {
    throw new Error('projetoId inválido.');
  }

  const resultado = {
    ok: true,
    projetoId: pid,
    urlNegocio: montarUrlNegocioGroner(pid),
    descricao: null,
    pdf: null,
    campos: [],
  };

  const campoDescricao = getCampoId('descricaoProposta');
  if (campoDescricao) {
    try {
      const html = formatarDescricaoPropostaHtml(proposta);
      await responderCampoPersonalizado(campoDescricao, {
        projetoId: pid,
        resposta: html,
      });
      resultado.descricao = { ok: true, campoId: campoDescricao };
    } catch (err) {
      resultado.descricao = { ok: false, erro: err.message };
      resultado.erros = [...(resultado.erros ?? []), `Descrição: ${err.message}`];
    }
  } else {
    resultado.descricao = { skipped: true };
  }

  const campoPdf = getCampoId('pdfProposta');
  if (pdf?.base64 && campoPdf) {
    try {
      const buffer = Buffer.from(pdf.base64, 'base64');
      const nome = pdf.nomeArquivo || `Proposta_${proposta?.numeroProposta || 'MHZ'}.pdf`;
      const upload = await enviarPdfCampoPersonalizado({
        projetoId: pid,
        campoId: campoPdf,
        buffer,
        nomeArquivo: nome,
      });
      resultado.pdf = { ok: true, campoId: campoPdf, arquivoId: upload.arquivoId };
    } catch (err) {
      resultado.pdf = { ok: false, erro: err.message };
      resultado.erros = [...(resultado.erros ?? []), `PDF: ${err.message}`];
    }
  } else if (pdf?.base64) {
    resultado.pdf = { skipped: true, motivo: 'pdfProposta não configurado' };
  } else {
    resultado.pdf = { skipped: true, motivo: 'PDF enviado em rota separada (/api/groner/upload-pdf)' };
  }

  const valores = montarValoresCampos(proposta, meta);

  const camposNumericos = [
    'kwp',
    'qtdPlacas',
    'valorTotalProposta',
    'valorTotalSistema',
    'mensalidade',
  ];
  const camposTexto = ['plano'];

  const camposResultado = [];
  for (const chave of [...camposNumericos, ...camposTexto]) {
    try {
      const item = await responderCampo(
        chave,
        pid,
        valores[chave],
        camposTexto.includes(chave) ? { texto: true } : {},
      );
      camposResultado.push(item);
    } catch (err) {
      camposResultado.push({ chave, ok: false, erro: err.message });
      resultado.erros = [...(resultado.erros ?? []), `${chave}: ${err.message}`];
    }
  }
  resultado.campos = camposResultado;

  if (resultado.erros?.length) {
    resultado.ok = false;
    resultado.erro = resultado.erros.join('\n');
  }

  return resultado;
}
