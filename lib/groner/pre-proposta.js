import { gronerFetch, desembrulharResposta, extrairItens } from './client.js';
import {
  mapPrePropostaValores,
  combinarPropostaValores,
  mapProjetoFallbackValores,
} from './mappers.js';

function extrairId(obj) {
  return obj?.id ?? obj?.Id ?? null;
}

function extrairPrePropostaId(obj) {
  return obj?.prePropostaId ?? obj?.PrePropostaId ?? null;
}

function garantirArray(valor) {
  if (valor == null) return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== 'object') return [];
  if (valor.id ?? valor.Id) return [valor];
  const vals = Object.values(valor);
  if (vals.length && vals.every((v) => v && typeof v === 'object')) return vals;
  return [];
}

function extrairPrePropostasDoProjeto(projetoRaw) {
  const lista = projetoRaw?.prePropostas ?? projetoRaw?.PrePropostas ?? [];
  return garantirArray(lista);
}

function ordenarPrePropostas(lista) {
  return [...lista].sort((a, b) => {
    const da = new Date(a.dataCadastro ?? a.DataCadastro ?? 0).getTime();
    const db = new Date(b.dataCadastro ?? b.DataCadastro ?? 0).getTime();
    if (db !== da) return db - da;
    return (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0);
  });
}

async function buscarPrePropostaAceitaPorProjeto(projetoId) {
  try {
    return await gronerFetch(`/PrePropostaAceita/Projeto/${projetoId}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function buscarPrePropostaAceitaPorId(id) {
  return gronerFetch(`/PrePropostaAceita/${id}`);
}

async function buscarPrePropostaPorId(id) {
  return gronerFetch(`/PreProposta/${id}`);
}

async function listarPrePropostas(projetoId) {
  const data = await gronerFetch(
    `/PreProposta?projetoId=${projetoId}&pagina=1&tamanhoPagina=25`,
  );
  return extrairItens(data);
}

/**
 * Enriquece proposta aceita ou última pré-proposta com detalhes completos.
 * Nunca descarta potência só porque faltam módulos — combina todas as fontes.
 */
async function enriquecerProposta(resumo, { fonte, prePropostaIdHint = null } = {}) {
  if (!resumo || typeof resumo !== 'object') {
    return { potenciaKwp: null, qtdPlacas: null, precoSimulacao: null };
  }

  const fontes = [mapPrePropostaValores(resumo)];
  const resumoId = extrairId(resumo);

  if (fonte === 'aceita' && resumoId) {
    try {
      const detalhe = await buscarPrePropostaAceitaPorId(resumoId);
      fontes.push(mapPrePropostaValores(detalhe));
      resumo = { ...resumo, ...detalhe };
    } catch (err) {
      if (err.status !== 404) {
        console.warn('[groner] PrePropostaAceita detalhe:', err.message);
      }
    }
  }

  let parcial = combinarPropostaValores(...fontes);
  const prePropostaId =
    prePropostaIdHint ?? extrairPrePropostaId(resumo) ?? (fonte === 'ultima' ? resumoId : null);

  const precisaDetalhePreProposta =
    parcial.qtdPlacas == null ||
    parcial.potenciaKwp == null ||
    parcial.precoSimulacao == null;

  if (precisaDetalhePreProposta && prePropostaId) {
    try {
      const pre = await buscarPrePropostaPorId(prePropostaId);
      fontes.push(mapPrePropostaValores(pre));
    } catch (err) {
      if (err.status !== 404) {
        console.warn('[groner] PreProposta detalhe:', err.message);
      }
    }
  } else if (fonte === 'ultima' && resumoId && parcial.qtdPlacas == null) {
    try {
      const pre = await buscarPrePropostaPorId(resumoId);
      fontes.push(mapPrePropostaValores(pre));
    } catch (err) {
      if (err.status !== 404) {
        console.warn('[groner] PreProposta ultima detalhe:', err.message);
      }
    }
  }

  return combinarPropostaValores(...fontes);
}

/**
 * Obtém kWp, placas e valor da proposta aceita ou última pré-proposta do negócio.
 * Fallback final: campos do Projeto + estimativa consumo/130.
 */
export async function obterDadosPropostaNegocio(projetoId, projetoRaw = null) {
  const pid = Number(projetoId);
  if (!pid) {
    return {
      potenciaKwp: null,
      qtdPlacas: null,
      precoSimulacao: null,
      id: null,
      fonte: null,
    };
  }

  const projetoDesembrulhado = projetoRaw ? desembrulharResposta(projetoRaw) : null;
  const fallback = mapProjetoFallbackValores(projetoDesembrulhado);

  // 1. Proposta aceita
  let aceitaResumo = null;
  try {
    aceitaResumo = await buscarPrePropostaAceitaPorProjeto(pid);
  } catch (err) {
    if (err.status === 401 || err.status === 403) throw err;
    console.warn('[groner] PrePropostaAceita/Projeto:', err.message);
  }

  if (aceitaResumo && typeof aceitaResumo === 'object') {
    const aceitaId = extrairId(aceitaResumo);
    const valores = await enriquecerProposta(aceitaResumo, {
      fonte: 'aceita',
      prePropostaIdHint: extrairPrePropostaId(aceitaResumo),
    });
    const combinado = combinarPropostaValores(valores, fallback);

    return {
      potenciaKwp: combinado.potenciaKwp,
      qtdPlacas: combinado.qtdPlacas,
      precoSimulacao: combinado.precoSimulacao,
      id: aceitaId,
      fonte: 'aceita',
    };
  }

  // 2. Última pré-proposta gerada
  let ultimaResumo = null;
  const embutidas = extrairPrePropostasDoProjeto(projetoDesembrulhado);
  if (embutidas.length) {
    ultimaResumo = ordenarPrePropostas(embutidas)[0];
  }

  if (!ultimaResumo) {
    try {
      const lista = await listarPrePropostas(pid);
      if (lista.length) ultimaResumo = ordenarPrePropostas(lista)[0];
    } catch (err) {
      if (err.status === 401 || err.status === 403) throw err;
      console.warn('[groner] PreProposta lista:', err.message);
    }
  }

  if (ultimaResumo) {
    const ultimaId = extrairId(ultimaResumo);
    const valores = await enriquecerProposta(ultimaResumo, { fonte: 'ultima' });
    const combinado = combinarPropostaValores(valores, fallback);

    return {
      potenciaKwp: combinado.potenciaKwp,
      qtdPlacas: combinado.qtdPlacas,
      precoSimulacao: combinado.precoSimulacao,
      id: ultimaId,
      fonte: 'ultima',
    };
  }

  // 3. Fallback: só Projeto
  return {
    potenciaKwp: fallback.potenciaKwp,
    qtdPlacas: fallback.qtdPlacas,
    precoSimulacao: fallback.precoSimulacao,
    id: null,
    fonte: null,
  };
}
