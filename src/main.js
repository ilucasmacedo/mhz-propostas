import './styles.css';
import {
  PLANOS,
  SERVICOS,
  COBERTURAS,
  SEM_PLANO,
  CONFIG_PRECIFICACAO,
  calcularProposta,
  planoTemDescontoAvulso,
  temPlanoContratado,
  precosComparativoPlanos,
  formatarMoeda,
  gerarNumeroProposta,
} from './pricing.js';
import { exportarPropostaPdf, montarHtmlProposta } from './pdf.js';
import { mountPlaybook } from './playbook.js';
import { mountAdmin } from './admin.js';
import { CONFIG_UPDATED_EVENT } from './config-store.js';

const getValidadeDias = () => CONFIG_PRECIFICACAO.constantes.validade_proposta_dias;

let numeroProposta = gerarNumeroProposta();
let propostaGerada = false;

const els = {
  form: document.getElementById('form-proposta'),
  planosGrid: document.getElementById('planos-grid'),
  servicosGrid: document.getElementById('servicos-grid'),
  planoSelecionado: document.getElementById('plano-selecionado'),
  resumo: document.getElementById('resumo-conteudo'),
  alertas: document.getElementById('alertas'),
  badge: document.getElementById('badge-numero'),
  modal: document.getElementById('modal-overlay'),
  preview: document.getElementById('preview-container'),
  btnPreview: document.getElementById('btn-preview'),
  btnGerar: document.getElementById('btn-gerar'),
  btnBaixarPdf: document.getElementById('btn-baixar-pdf'),
  btnFechar: document.getElementById('btn-fechar'),
  btnFecharModal: document.getElementById('btn-fechar-modal'),
  viewProposta: document.getElementById('view-proposta'),
  viewPlaybook: document.getElementById('view-playbook'),
  viewAdmin: document.getElementById('view-admin'),
  playbookRoot: document.getElementById('playbook-root'),
  adminRoot: document.getElementById('admin-root'),
  navTabs: document.querySelectorAll('.nav-tab'),
};

const VIEW_TITLES = {
  proposta: 'MHZ — Nova Proposta Comercial',
  playbook: 'MHZ — Playbook Comercial + Operacional',
  admin: 'MHZ — Administração',
};

function switchView(view) {
  els.viewProposta.classList.toggle('active', view === 'proposta');
  els.viewProposta.classList.toggle('hidden', view !== 'proposta');
  els.viewPlaybook.classList.toggle('active', view === 'playbook');
  els.viewPlaybook.classList.toggle('hidden', view !== 'playbook');
  els.viewAdmin.classList.toggle('active', view === 'admin');
  els.viewAdmin.classList.toggle('hidden', view !== 'admin');

  els.navTabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  document.title = VIEW_TITLES[view] || VIEW_TITLES.proposta;
}

function refreshPropostaUi() {
  renderPlanos();
  renderServicos();
  renderResumo();
}

function getFormData() {
  return {
    cliente: {
      nome: document.getElementById('cliente-nome').value.trim(),
      documento: document.getElementById('cliente-documento').value.trim(),
      email: document.getElementById('cliente-email').value.trim(),
      telefone: document.getElementById('cliente-telefone').value.trim(),
    },
    usina: {
      kwp: parseFloat(document.getElementById('usina-kwp').value) || 0,
      qtdPlacas: parseInt(document.getElementById('usina-placas').value, 10) || 0,
      distanciaKm: parseFloat(document.getElementById('usina-distancia').value) || 0,
      endereco: document.getElementById('usina-endereco').value.trim(),
      valorInvestimento: parseFloat(document.getElementById('usina-investimento').value) || 0,
      valorContrato: parseFloat(document.getElementById('usina-contrato').value) || 0,
    },
    plano: els.planoSelecionado.value,
    servicos: [...document.querySelectorAll('.servico-check:checked')].map((cb) => cb.value),
  };
}

function getResultado() {
  const data = getFormData();
  return calcularProposta({
    kwp: data.usina.kwp,
    plano: data.plano,
    distanciaKm: data.usina.distanciaKm,
    servicosSelecionados: data.servicos,
    qtdPlacas: data.usina.qtdPlacas,
    valorContrato: data.usina.valorContrato,
    valorInvestimento: data.usina.valorInvestimento,
  });
}

function formatarMensalidadeResumo(valor, plano) {
  if (!temPlanoContratado(plano)) return 'Sem plano';
  return formatarMoeda(valor);
}

function renderPlanos() {
  const data = getFormData();
  const comparativo = precosComparativoPlanos(data.usina.kwp);
  const selecionado = els.planoSelecionado.value;

  const cardSemPlano = `
    <article
      class="plano-card plano-card-nenhum ${selecionado === SEM_PLANO ? 'selected' : ''}"
      data-plano="${SEM_PLANO}"
      role="button"
      tabindex="0"
      aria-pressed="${selecionado === SEM_PLANO}"
    >
      <h3 class="plano-nome">Sem plano</h3>
      <p class="plano-tagline">Apenas serviços avulsos</p>
      <p class="plano-preco">—<small>/mês</small></p>
      <p class="plano-faixa">Sem mensalidade recorrente</p>
      <ul class="plano-coberturas">
        <li>Cobrança só dos serviços selecionados</li>
        <li>Preços avulsos sem desconto de plano</li>
      </ul>
    </article>`;

  els.planosGrid.innerHTML =
    cardSemPlano +
    comparativo
      .map((plano) => {
        const isSelected = plano.codigo === selecionado;
        const isRecomendado = plano.codigo === 'PADRAO';
        const precoHtml = plano.sob_consulta
          ? '<p class="plano-preco sob-consulta">Sob consulta</p>'
          : `<p class="plano-preco">${formatarMoeda(plano.mensalidade)}<small>/mês</small></p>`;

        const coberturas = (COBERTURAS[plano.codigo] || [])
          .map((c) => `<li>${c}</li>`)
          .join('');

        return `
        <article
          class="plano-card ${isSelected ? 'selected' : ''} ${isRecomendado ? 'recomendado' : ''}"
          data-plano="${plano.codigo}"
          role="button"
          tabindex="0"
          aria-pressed="${isSelected}"
        >
          <h3 class="plano-nome">${plano.nome}</h3>
          <p class="plano-tagline">${plano.tagline}</p>
          ${precoHtml}
          <p class="plano-faixa">Faixa ${plano.faixa}</p>
          <ul class="plano-coberturas">${coberturas}</ul>
        </article>`;
      })
      .join('');

  els.planosGrid.querySelectorAll('.plano-card').forEach((card) => {
    const select = () => {
      els.planoSelecionado.value = card.dataset.plano;
      renderPlanos();
      renderServicos();
      renderResumo();
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });
}

function renderServicos() {
  const data = getFormData();
  const comPlano = planoTemDescontoAvulso(data.plano);
  const selecionados = new Set(
    [...document.querySelectorAll('.servico-check:checked')].map((cb) => cb.value),
  );

  els.servicosGrid.innerHTML = SERVICOS.map((s) => {
    const preco = comPlano ? s.com : s.fora;
    const sufixo =
      s.tipo === 'POR_PLACA' ? '/placa' : s.tipo === 'PERCENTUAL' ? ' do contrato' : '';
    const labelPreco = comPlano ? 'com plano (Padrão/Premium)' : 'sem desconto de plano';
    const checked = selecionados.has(s.codigo) ? 'checked' : '';

    return `
    <label class="servico-item">
      <input type="checkbox" class="servico-check" value="${s.codigo}" ${checked} />
      <div>
        <strong>${s.descricao}</strong>
        <span>${formatarMoeda(preco)}${sufixo} (${labelPreco})</span>
      </div>
    </label>`;
  }).join('');
}

function renderAlertas(resultado) {
  const alertas = [];

  if (resultado.motivos_sob_consulta.includes('KWP_ACIMA_50')) {
    alertas.push('Usina acima de 50 kWp — mensalidade sob consulta comercial.');
  }
  if (resultado.motivos_sob_consulta.includes('DISTANCIA_ACIMA_600')) {
    alertas.push('Distância acima de 600 km — taxa de deslocamento a combinar.');
  }
  if (resultado.deslocamento.valor > 0) {
    alertas.push(
      `Deslocamento: ${resultado.deslocamento.km_excedente} km excedentes × ${formatarMoeda(resultado.deslocamento.taxa)}/km = ${formatarMoeda(resultado.deslocamento.valor)}`,
    );
  }

  els.alertas.innerHTML = alertas.map((a) => `<div class="alerta">${a}</div>`).join('');
}

function renderResumo() {
  const resultado = getResultado();
  renderAlertas(resultado);

  const itensHtml =
    resultado.itens.length > 0
      ? `<ul>${resultado.itens.map((i) => `<li><span>${i.descricao}</span><span>${formatarMoeda(i.subtotal)}</span></li>`).join('')}</ul>`
      : '<p style="color:var(--text-muted);font-size:0.9rem;margin:0">Nenhum item adicional selecionado.</p>';

  els.resumo.innerHTML = `
    <div class="resumo-item">
      <label>Mensalidade</label>
      <div class="valor">${formatarMensalidadeResumo(resultado.totais.recorrente_mensal, resultado.plano)}</div>
    </div>
    <div class="resumo-item">
      <label>Avulsos + taxas</label>
      <div class="valor">${formatarMoeda(resultado.totais.avulsos)}</div>
    </div>
    <div class="resumo-item destaque">
      <label>1ª cobrança</label>
      <div class="valor">${formatarMoeda(resultado.totais.primeira_cobranca)}</div>
    </div>
    <div class="resumo-itens">
      <h3>Itens da proposta</h3>
      ${itensHtml}
    </div>`;
}

function montarDadosProposta() {
  const data = getFormData();
  const resultado = getResultado();

  let planoInfo;
  if (temPlanoContratado(data.plano)) {
    planoInfo = precosComparativoPlanos(data.usina.kwp).find(
      (p) => p.codigo === data.plano,
    );
  } else {
    planoInfo = { nome: 'Sem plano', faixa: '—' };
  }

  if (!propostaGerada) {
    numeroProposta = gerarNumeroProposta();
    propostaGerada = true;
    els.badge.textContent = `Proposta ${numeroProposta}`;
    els.badge.classList.add('gerada');
  }

  return {
    numeroProposta,
    dataEmissao: new Date(),
    validadeDias: getValidadeDias(),
    cliente: data.cliente,
    usina: data.usina,
    plano: {
      nome: planoInfo.nome,
      faixa: planoInfo.faixa,
    },
    resultado,
    vendedor: 'Equipe Comercial MHZ',
  };
}

function abrirPreview() {
  const dados = montarDadosProposta();
  els.preview.innerHTML = montarHtmlProposta(dados);
  els.modal.classList.remove('hidden');
}

function fecharModal() {
  els.modal.classList.add('hidden');
}

async function baixarPdf() {
  const dados = montarDadosProposta();
  els.preview.innerHTML = montarHtmlProposta(dados);

  const elemento = els.preview.querySelector('.pdf-proposta');
  if (!elemento) {
    alert('Não foi possível montar a proposta para PDF.');
    return;
  }

  const nomeCliente = dados.cliente.nome.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);
  const nomeArquivo = `Proposta_${dados.numeroProposta}_${nomeCliente || 'cliente'}.pdf`;

  els.btnBaixarPdf.disabled = true;
  els.btnGerar.disabled = true;
  els.btnBaixarPdf.textContent = 'Gerando PDF...';

  try {
    await exportarPropostaPdf(elemento, nomeArquivo);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    alert(`Erro ao gerar PDF: ${err?.message || 'Tente novamente.'}`);
  } finally {
    els.btnBaixarPdf.disabled = false;
    els.btnGerar.disabled = false;
    els.btnBaixarPdf.textContent = 'Baixar PDF';
  }
}

function init() {
  mountPlaybook(els.playbookRoot);
  mountAdmin(els.adminRoot);

  window.addEventListener(CONFIG_UPDATED_EVENT, refreshPropostaUi);

  els.navTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(tab.dataset.view);
    });
  });

  renderServicos();
  renderPlanos();
  renderResumo();

  const inputs = els.form.querySelectorAll('input, select');
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      renderPlanos();
      renderServicos();
      renderResumo();
    });
    input.addEventListener('change', () => {
      renderPlanos();
      renderServicos();
      renderResumo();
    });
  });

  els.servicosGrid.addEventListener('change', renderResumo);

  els.btnPreview.addEventListener('click', () => {
    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }
    abrirPreview();
  });

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }
    abrirPreview();
    await baixarPdf();
  });

  els.btnBaixarPdf.addEventListener('click', baixarPdf);
  els.btnFechar.addEventListener('click', fecharModal);
  els.btnFecharModal.addEventListener('click', fecharModal);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) fecharModal();
  });
}

init();
