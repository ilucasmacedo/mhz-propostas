import html2pdf from 'html2pdf.js';

const PDF_RENDER_ID = 'pdf-render-host';

function getHtml2Pdf() {
  return typeof html2pdf === 'function' ? html2pdf : html2pdf.default;
}

function getRenderHost() {
  let host = document.getElementById(PDF_RENDER_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = PDF_RENDER_ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:794px;max-width:794px;background:#fff;pointer-events:none;';
    document.body.appendChild(host);
  }
  return host;
}

async function aguardarRender() {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export async function exportarPropostaPdf(elemento, nomeArquivo) {
  if (!elemento) {
    throw new Error('Elemento da proposta não encontrado.');
  }

  const host = getRenderHost();
  host.innerHTML = '';
  const clone = elemento.cloneNode(true);
  clone.style.width = '100%';
  host.appendChild(clone);

  await aguardarRender();

  const gerarPdf = getHtml2Pdf();
  if (typeof gerarPdf !== 'function') {
    host.innerHTML = '';
    throw new Error('Biblioteca de PDF indisponível.');
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename: nomeArquivo,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      width: 794,
      logging: false,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] },
  };

  try {
    await gerarPdf().set(opt).from(clone).save();
  } finally {
    host.innerHTML = '';
  }
}

export function montarHtmlProposta(dados) {
  const {
    numeroProposta,
    dataEmissao,
    validadeDias,
    cliente,
    usina,
    plano,
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

  return `
    <div class="pdf-proposta">
      <header class="pdf-header">
        <div class="pdf-brand">
          <div class="pdf-logo">MHZ</div>
          <div>
            <h1>Proposta Comercial</h1>
            <p>Monitoramento e Gestão Solar</p>
          </div>
        </div>
        <div class="pdf-meta">
          <p><strong>Nº:</strong> ${numeroProposta}</p>
          <p><strong>Emissão:</strong> ${formatDate(dataEmissao)}</p>
          <p><strong>Validade:</strong> ${formatDate(dataValidade)}</p>
        </div>
      </header>

      ${alertaSobConsulta}

      <section class="pdf-section">
        <h2>Dados do Cliente</h2>
        <div class="pdf-grid">
          <p><span>Nome:</span> ${cliente.nome}</p>
          <p><span>CPF/CNPJ:</span> ${cliente.documento || '—'}</p>
          <p><span>E-mail:</span> ${cliente.email || '—'}</p>
          <p><span>Telefone:</span> ${cliente.telefone || '—'}</p>
        </div>
      </section>

      <section class="pdf-section">
        <h2>Dados da Usina</h2>
        <div class="pdf-grid">
          <p><span>Potência:</span> ${usina.kwp} kWp</p>
          <p><span>Placas:</span> ${usina.qtdPlacas || '—'}</p>
          <p><span>Endereço:</span> ${usina.endereco || '—'}</p>
          <p><span>Distância da base:</span> ${usina.distanciaKm} km</p>
        </div>
      </section>

      <section class="pdf-section">
        <h2>Plano Selecionado</h2>
        <div class="pdf-plano-box">
          <h3>${plano.nome}</h3>
          <p class="pdf-plano-valor">${plano.nome === 'Sem plano' ? '—' : `${formatMoeda(resultado.totais.recorrente_mensal)}<span>/mês</span>`}</p>
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
          <strong>${plano.nome === 'Sem plano' ? '—' : formatMoeda(resultado.totais.recorrente_mensal)}</strong>
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
          <li>Valores de mensalidade válidos para usinas em raio de até 50 km da base operacional.</li>
          <li>Deslocamento acima de 50 km conforme tabela comercial vigente.</li>
          <li>Proposta válida por ${validadeDias} dias a partir da emissão.</li>
          <li>Usinas acima de 50 kWp ou clientes comerciais/industriais podem requerer negociação personalizada.</li>
        </ul>
      </section>

      <footer class="pdf-footer">
        <p>Vendedor: ${vendedor || 'Equipe Comercial MHZ'}</p>
        <p>mhzenergia.com.br · contato@mhzenergia.com.br</p>
      </footer>
    </div>
  `;
}
