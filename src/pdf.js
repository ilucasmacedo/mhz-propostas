import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  LOGO_ALT,
  getRodapePdf,
  getVendedorPadrao,
  getCapaPdfImagem,
  getCapaPdfParagrafos,
} from './cliente-config.js';
import {
  getMatrizCoberturasPlanos,
  getOrdemPlanosPdf,
  rotuloPlanoPdf,
  isPlanoRecomendado,
  exibicaoPrecoPlano,
} from './pricing.js';

const PDF_RENDER_ID = 'pdf-render-host';
const PDF_LARGURA_PX = 794;
const PDF_ALTURA_PX = 1123;

async function capturarPaginaPdf(pageEl) {
  return html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: PDF_LARGURA_PX,
    height: PDF_ALTURA_PX,
    windowWidth: PDF_LARGURA_PX,
    windowHeight: PDF_ALTURA_PX,
    scrollX: 0,
    scrollY: 0,
  });
}

async function montarPdfMultipaginas(pages) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

  for (let i = 0; i < pages.length; i++) {
    const canvas = await capturarPaginaPdf(pages[i]);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  return pdf.output('blob');
}

function getRenderHost() {
  let host = document.getElementById(PDF_RENDER_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = PDF_RENDER_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PDF_LARGURA_PX}px;max-width:${PDF_LARGURA_PX}px;background:#fff;pointer-events:none;`;
    document.body.appendChild(host);
  }
  return host;
}

async function aguardarRender(root) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  const imgs = root?.querySelectorAll('img') ?? [];
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/** Gera PDF em memória (para enviar à Groner) — 1 canvas por .pdf-page = exatamente 3 páginas */
export async function gerarPropostaPdfBlob(elemento) {
  if (!elemento) {
    throw new Error('Elemento da proposta não encontrado.');
  }

  const host = getRenderHost();
  host.innerHTML = '';
  const clone = elemento.cloneNode(true);
  clone.style.width = `${PDF_LARGURA_PX}px`;
  host.appendChild(clone);

  await aguardarRender(clone);

  const pages = [...clone.querySelectorAll('.pdf-page')];
  if (!pages.length) {
    host.innerHTML = '';
    throw new Error('Páginas do PDF não encontradas.');
  }

  try {
    return await montarPdfMultipaginas(pages);
  } finally {
    host.innerHTML = '';
  }
}

export async function exportarPropostaPdf(elemento, nomeArquivo) {
  const blob = await gerarPropostaPdfBlob(elemento);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

export function montarHtmlProposta(dados) {
  const {
    numeroProposta,
    dataEmissao,
    validadeDias,
    cliente,
    usina,
    plano,
    comparativoPlanos,
    resultado,
    vendedor,
  } = dados;

  const dataValidade = new Date(dataEmissao);
  dataValidade.setDate(dataValidade.getDate() + validadeDias);

  const formatDate = (d) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);

  const formatMoeda = (v) =>
    v === null || v === undefined
      ? 'Sob consulta'
      : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const htmlPrecoComparativo = (codigo, mensalidade, sobConsulta) => {
    if (sobConsulta) return { preco: 'Sob consulta', rodape: 'Pagamento mensal' };
    const exib = exibicaoPrecoPlano(codigo, mensalidade);
    if (exib.modo === 'parcelas') {
      return {
        preco: `12x de ${formatMoeda(exib.valorParcela)}`,
        rodape: 'no cartão',
      };
    }
    return {
      preco: `${formatMoeda(exib.mensalidade)}<span>/mês</span>`,
      rodape: 'Pagamento mensal',
    };
  };

  const htmlPrecoPlanoSelecionado = (codigo, mensalidade, semPlano) => {
    if (semPlano) return '—';
    const exib = exibicaoPrecoPlano(codigo, mensalidade);
    if (exib.modo === 'parcelas') {
      return `12x de ${formatMoeda(exib.valorParcela)}<span> no cartão</span>`;
    }
    return `${formatMoeda(mensalidade)}<span>/mês</span>`;
  };

  const labelMensalidadeResumo = () => {
    if (plano.nome === 'Sem plano') return '—';
    const exib = exibicaoPrecoPlano(plano.codigo, resultado.totais.recorrente_mensal);
    if (exib.modo === 'parcelas') {
      return `12x de ${formatMoeda(exib.valorParcela)} (cartão)`;
    }
    return formatMoeda(resultado.totais.recorrente_mensal);
  };

  const itensHtml = resultado.itens
    .map(
      (item) => `
      <tr>
        <td>${item.descricao}</td>
        <td class="valor">${formatMoeda(item.subtotal)}</td>
      </tr>`,
    )
    .join('');

  const alertaSobConsulta = resultado.sob_consulta
    ? `<div class="alerta">⚠ Parte desta proposta requer valores sob consulta comercial.</div>`
    : '';

  const ordemPlanos = getOrdemPlanosPdf();
  const planosOrdenados = (comparativoPlanos ?? [])
    .slice()
    .sort((a, b) => ordemPlanos.indexOf(a.codigo) - ordemPlanos.indexOf(b.codigo));

  const matriz = getMatrizCoberturasPlanos();
  const celulaIcone = (inclui) =>
    inclui
      ? '<span class="pdf-matriz-check" aria-hidden="true">✓</span>'
      : '<span class="pdf-matriz-dash">—</span>';

  const matrizHtml =
    matriz.length && ordemPlanos.length
      ? `
          <section class="pdf-section pdf-section-matriz">
            <h2>O que cada plano inclui</h2>
            <p class="pdf-comparativo-sub">Compare a capacidade de atendimento antes de escolher o plano mensal.</p>
            <div class="pdf-matriz-wrap">
              <table class="pdf-matriz" role="grid">
                <thead>
                  <tr>
                    <th class="pdf-matriz-recurso-head" scope="col"></th>
                    ${ordemPlanos
                      .map((cod) => {
                        const destaque = isPlanoRecomendado(cod);
                        const selecionado = plano.codigo === cod;
                        return `<th scope="col" class="pdf-matriz-col-head ${destaque ? 'pdf-matriz-col-head--dark' : ''} ${selecionado ? 'pdf-matriz-col-head--sel' : ''}">${rotuloPlanoPdf(cod)}</th>`;
                      })
                      .join('')}
                  </tr>
                </thead>
                <tbody>
                  ${matriz
                    .map(
                      (linha) => `
                  <tr>
                    <th class="pdf-matriz-recurso" scope="row">${linha.recurso}</th>
                    ${ordemPlanos
                      .map(
                        (cod) =>
                          `<td class="pdf-matriz-cell ${plano.codigo === cod ? 'pdf-matriz-cell--sel' : ''}">${celulaIcone(Boolean(linha[cod]))}</td>`,
                      )
                      .join('')}
                  </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </section>`
      : '';

  const todosSobConsulta =
    planosOrdenados.length > 0 && planosOrdenados.every((p) => p.sob_consulta);

  const faixaRef = planosOrdenados[0]?.faixa ?? plano.faixa;

  const comparativoHtml =
    planosOrdenados.length && !todosSobConsulta
      ? `
          <section class="pdf-section pdf-section-comparativo">
            <h2>Planos mensais — compare as opções</h2>
            <p class="pdf-comparativo-sub">Valores para <strong>${usina.kwp} kWp</strong> (faixa ${faixaRef}). Escolha um plano no formulário; a proposta abaixo usa o plano selecionado.</p>
            <div class="pdf-comparativo-grid">
              ${planosOrdenados
                .map((p) => {
                  const selecionado = plano.codigo === p.codigo;
                  const recomendado = isPlanoRecomendado(p.codigo);
                  const { preco, rodape: rodapePreco } = htmlPrecoComparativo(
                    p.codigo,
                    p.mensalidade,
                    p.sob_consulta,
                  );
                  const badges = [
                    recomendado ? '<span class="pdf-plano-badge pdf-plano-badge-rec">Recomendado</span>' : '',
                    selecionado ? '<span class="pdf-plano-badge pdf-plano-badge-sel">Desta proposta</span>' : '',
                  ]
                    .filter(Boolean)
                    .join('');
                  return `
                <article class="pdf-plano-card ${recomendado ? 'pdf-plano-card--premium' : ''} ${selecionado ? 'pdf-plano-card--selected' : ''}">
                  ${badges ? `<div class="pdf-plano-badges">${badges}</div>` : ''}
                  <div class="pdf-plano-card-head">
                    <h3>${p.nome}</h3>
                    ${p.alias ? `<p class="pdf-plano-card-alias">${p.alias}</p>` : ''}
                  </div>
                  <div class="pdf-plano-card-body">
                    <p class="pdf-plano-card-tagline">${p.tagline || ''}</p>
                <p class="pdf-plano-card-preco">${preco}</p>
                <p class="pdf-plano-card-foot">${rodapePreco}</p>
                  </div>
                </article>`;
                })
                .join('')}
            </div>
            <p class="pdf-comparativo-foot">Planos flexíveis para a necessidade da sua usina e máximo de performance.</p>
          </section>`
      : planosOrdenados.length && todosSobConsulta
        ? `<section class="pdf-section pdf-section-comparativo"><h2>Planos mensais</h2><p class="pdf-comparativo-sub">Para ${usina.kwp} kWp os valores de mensalidade são <strong>sob consulta comercial</strong>.</p></section>`
        : '';

  const planoSelecionadoTitulo =
    plano.nome === 'Sem plano'
      ? 'Proposta sem plano (serviços avulsos)'
      : 'Plano desta proposta (enviado à Groner)';

  const capaImagem = getCapaPdfImagem();
  const capaParagrafos = getCapaPdfParagrafos();
  const textosMhzHtml = capaParagrafos
    .map((p) => `<p class="pdf-capa-texto">${p}</p>`)
    .join('');

  const imagemRodapeHtml = capaImagem
    ? `<div class="pdf-p1-hero"><img class="pdf-capa-img" src="${capaImagem}" alt="${LOGO_ALT}" crossorigin="anonymous" /></div>`
    : '';

  return `
    <div class="pdf-proposta">
      <!-- PÁGINA 1: Proposta + cliente + usina + institucional MHZ -->
      <div class="pdf-page pdf-page--1">
        <div class="pdf-p1-top">
          <header class="pdf-header">
            <div class="pdf-brand">
              <h1>Proposta Comercial</h1>
              <p>Monitoramento e Gestão Solar</p>
            </div>
            <div class="pdf-meta">
              <p><strong>Nº:</strong> ${numeroProposta}</p>
              <p><strong>Emissão:</strong> ${formatDate(dataEmissao)}</p>
              <p><strong>Validade:</strong> ${formatDate(dataValidade)}</p>
            </div>
          </header>

          ${alertaSobConsulta}

          <section class="pdf-section pdf-section-dados">
            <h2>Dados do Cliente</h2>
            <div class="pdf-grid pdf-grid--dados">
              <p><span>Nome:</span> ${cliente.nome}</p>
              <p><span>CPF/CNPJ:</span> ${cliente.documento || '—'}</p>
              <p><span>E-mail:</span> ${cliente.email || '—'}</p>
              <p><span>Telefone:</span> ${cliente.telefone || '—'}</p>
            </div>
          </section>

          <section class="pdf-section pdf-section-dados">
            <h2>Dados da Usina</h2>
            <div class="pdf-grid pdf-grid--dados">
              <p><span>Potência:</span> ${usina.kwp} kWp</p>
              <p><span>Placas:</span> ${usina.qtdPlacas || '—'}</p>
              <p><span>Endereço:</span> ${usina.endereco || '—'}</p>
              <p><span>Distância da base:</span> ${usina.distanciaKm} km</p>
            </div>
          </section>

          ${textosMhzHtml ? `<div class="pdf-p1-institutional">${textosMhzHtml}</div>` : ''}
        </div>
        ${imagemRodapeHtml}
      </div>

      <!-- PÁGINA 2: Coberturas + valores para o kWp -->
      <div class="pdf-page pdf-page--2">
        <p class="pdf-intro-box">Esta proposta apresenta as opções de monitoramento e gestão solar da MHZ para a sua usina, com comparativo de planos, coberturas e valores personalizados conforme a potência informada.</p>
        ${matrizHtml}
        ${comparativoHtml}
      </div>

      <!-- PÁGINA 3: Proposta fechada + condições + assinatura -->
      <div class="pdf-page pdf-page--3">
        <section class="pdf-section">
          <h2>${planoSelecionadoTitulo}</h2>
          <div class="pdf-plano-box ${plano.codigo && plano.codigo !== 'NENHUM' ? 'pdf-plano-box--selected' : ''}">
            <h3>${plano.nome}</h3>
            <p class="pdf-plano-valor">${htmlPrecoPlanoSelecionado(plano.codigo, resultado.totais.recorrente_mensal, plano.nome === 'Sem plano')}</p>
            <p class="pdf-plano-faixa">${plano.nome === 'Sem plano' ? 'Contratação apenas de serviços avulsos' : `Faixa: ${plano.faixa}`}</p>
          </div>
        </section>

        <section class="pdf-section">
          <h2>Detalhamento</h2>
          <table class="pdf-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${itensHtml || '<tr><td colspan="2">Apenas mensalidade do plano</td></tr>'}
            </tbody>
          </table>
        </section>

        <section class="pdf-totais">
          <div class="pdf-total-row">
            <span>Mensalidade recorrente</span>
            <strong>${labelMensalidadeResumo()}</strong>
          </div>
          <div class="pdf-total-row">
            <span>Serviços e taxas (avulsos)</span>
            <strong>${formatMoeda(resultado.totais.avulsos)}</strong>
          </div>
          <div class="pdf-total-row destaque">
            <span>Total 1ª cobrança</span>
            <strong>${formatMoeda(resultado.totais.primeira_cobranca)}</strong>
          </div>
        </section>

        <section class="pdf-section pdf-obs">
          <h2>Condições</h2>
          <ul>
            <li>Valores de mensalidade conforme potência da usina e localização.</li>
            <li>Proposta válida por ${validadeDias} dias a partir da emissão.</li>
            <li>Usinas acima de 50 kWp ou clientes comerciais/industriais podem requerer negociação personalizada.</li>
          </ul>
        </section>

        <section class="pdf-assinaturas">
          <div class="pdf-assinatura-col">
            <div class="pdf-assinatura-linha"></div>
            <p>Cliente</p>
          </div>
          <div class="pdf-assinatura-col">
            <div class="pdf-assinatura-linha"></div>
            <p>Grupo MHZ</p>
          </div>
        </section>
        <p class="pdf-assinatura-data">Data: _____/_____/__________</p>

        <footer class="pdf-footer">
          <p>Vendedor: ${vendedor || getVendedorPadrao()}</p>
          <p>${getRodapePdf()}</p>
        </footer>
      </div>
    </div>
  `;
}
