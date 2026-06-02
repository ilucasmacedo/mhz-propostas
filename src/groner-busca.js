const API_BASE = import.meta.env.VITE_API_BASE || '';
const DEBOUNCE_MS = 450;
const MIN_BUSCA = 3;

function formatTelefone(valor) {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return valor || '';
}

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.erro || 'Falha na comunicação com a Groner.');
  }
  return data;
}

export function aplicarFormularioGroner(payload) {
  const { cliente, usina, groner } = payload.formulario ?? payload;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null && val !== '' && val !== undefined) el.value = val;
  };

  if (cliente) {
    set('cliente-nome', cliente.nome);
    set('cliente-documento', cliente.documento);
    set('cliente-email', cliente.email);
    set('cliente-telefone', formatTelefone(cliente.telefone));
  }

  if (usina) {
    if (usina.kwp != null) set('usina-kwp', usina.kwp);
    if (usina.qtdPlacas != null) set('usina-placas', usina.qtdPlacas);
    if (usina.endereco) set('usina-endereco', usina.endereco);
  }

  if (groner) {
    set('groner-lead-id', groner.leadId);
    set('groner-projeto-id', groner.projetoId ?? '');
  }

  const badge = document.getElementById('badge-groner');
  if (badge && groner) {
    const extra = usina?.consumoKwh ? ` · ${usina.consumoKwh} kWh/mês` : '';
    badge.textContent = groner.projetoId
      ? `Groner: ${groner.projetoNome || 'Projeto'} (#${groner.projetoId})${extra}`
      : `Groner: Lead #${groner.leadId}${extra}`;
    badge.classList.remove('hidden');
  }
}

export function initGronerBusca({
  inputEntrada,
  sugestoesEntrada,
  btnEntrada,
  btnBuscar,
  resultadosEl,
  statusEl,
  getFiltros,
  onAplicado,
}) {
  let configurado = null;
  let debounceTimer = null;
  let ultimosContatos = [];

  async function checarStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/groner/status`);
      const data = await res.json();
      configurado = Boolean(data.configurado);
      if (statusEl) {
        statusEl.textContent = configurado
          ? 'Groner conectada'
          : 'Groner: configure GRONER_TENANT e GRONER_TOKEN na Vercel';
        statusEl.dataset.state = configurado ? 'ok' : 'warn';
      }
      const disabled = !configurado;
      if (btnBuscar) btnBuscar.disabled = disabled;
      if (btnEntrada) btnEntrada.disabled = disabled;
      if (inputEntrada) inputEntrada.disabled = disabled;
    } catch {
      configurado = false;
      if (statusEl) {
        statusEl.textContent = 'API indisponível — use a URL da Vercel com variáveis configuradas';
        statusEl.dataset.state = 'err';
      }
      if (btnBuscar) btnBuscar.disabled = true;
      if (btnEntrada) btnEntrada.disabled = true;
    }
  }

  function fecharSugestoes() {
    sugestoesEntrada?.classList.add('hidden');
    resultadosEl?.classList.add('hidden');
  }

  function renderLista(contatos, container, { compacto = false } = {}) {
    if (!container) return;

    if (!contatos.length) {
      container.innerHTML = '<p class="groner-empty">Nenhum contato encontrado na Groner.</p>';
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = `
      ${compacto ? '' : `<p class="groner-resultados-head">${contatos.length} contato(s) encontrado(s)</p>`}
      <ul class="groner-lista ${compacto ? 'groner-lista-compact' : ''}">
        ${contatos
          .map((c) => {
            const projeto = c.projetos?.[0];
            const projetoOpts =
              c.projetos?.length > 0
                ? c.projetos
                    .map(
                      (p) =>
                        `<option value="${p.id}" ${p.id === projeto?.id ? 'selected' : ''}>${esc(p.nome)}${p.consumo ? ` — ${p.consumo} kWh` : ''}</option>`,
                    )
                    .join('')
                : '';

            return `
          <li class="groner-item" data-lead-id="${c.id}">
            <div class="groner-item-main">
              <strong>${esc(c.nome || 'Sem nome')}</strong>
              <span>${esc(c.email || '—')} · ${esc(c.documento || '—')} · ${esc(formatTelefone(c.telefone) || '—')}</span>
              ${c.endereco ? `<span class="groner-item-end">${esc(c.endereco)}</span>` : ''}
            </div>
            ${
              projetoOpts
                ? `<label class="groner-projeto-pick"><span>Negócio (Projeto)</span><select class="groner-projeto-select">${projetoOpts}</select></label>`
                : '<span class="groner-sem-projeto">Sem negócio vinculado</span>'
            }
            <button type="button" class="btn btn-primary btn-sm groner-usar">Carregar dados</button>
          </li>`;
          })
          .join('')}
      </ul>`;

    container.querySelectorAll('.groner-usar').forEach((btn) => {
      btn.addEventListener('click', () => selecionarContato(btn, contatos));
    });

    container.classList.remove('hidden');
  }

  async function selecionarContato(btn, contatos) {
    const item = btn.closest('.groner-item');
    const leadId = Number(item.dataset.leadId);
    const contato = contatos.find((c) => c.id === leadId);
    const select = item.querySelector('.groner-projeto-select');
    const projetoId = select ? Number(select.value) : contato?.projetos?.[0]?.id ?? null;

    btn.disabled = true;
    btn.textContent = 'Carregando...';

    try {
      const data = await apiPost('/api/groner/carregar-contato', { leadId, projetoId });
      aplicarFormularioGroner(data);
      onAplicado?.(data);
      fecharSugestoes();

      if (inputEntrada && contato?.nome) {
        inputEntrada.value = contato.nome;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Carregar dados';
    }
  }

  async function buscar(filtros, targetEl) {
    const destino = targetEl ?? resultadosEl;
    const temFiltro =
      filtros.nome || filtros.email || filtros.documento || filtros.telefone;

    if (!temFiltro) {
      if (inputEntrada) {
        alert('Digite pelo menos 3 caracteres do nome (ou e-mail, CPF ou telefone).');
      } else {
        alert('Preencha ao menos um campo do cliente para buscar na Groner.');
      }
      return;
    }

    if (destino) {
      destino.innerHTML = '<p class="groner-empty">Consultando Groner...</p>';
      destino.classList.remove('hidden');
    }

    try {
      const data = await apiPost('/api/groner/buscar-contato', filtros);
      ultimosContatos = data.contatos ?? [];
      renderLista(ultimosContatos, destino, { compacto: destino === sugestoesEntrada });
    } catch (err) {
      if (destino) {
        destino.innerHTML = `<p class="groner-empty groner-erro">${esc(err.message)}</p>`;
        destino.classList.remove('hidden');
      }
    }
  }

  function buscarEntrada() {
    const termo = inputEntrada?.value.trim() ?? '';
    if (termo.length < MIN_BUSCA) {
      alert(`Digite pelo menos ${MIN_BUSCA} caracteres para buscar.`);
      return;
    }
    buscar(
      { nome: termo, email: termo.includes('@') ? termo : '', documento: '', telefone: '' },
      sugestoesEntrada,
    );
  }

  function agendarBuscaNome() {
    clearTimeout(debounceTimer);
    const termo = inputEntrada?.value.trim() ?? '';

    if (termo.length < MIN_BUSCA) {
      sugestoesEntrada?.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(() => {
      buscar({ nome: termo }, sugestoesEntrada);
    }, DEBOUNCE_MS);
  }

  btnEntrada?.addEventListener('click', (e) => {
    e.preventDefault();
    buscarEntrada();
  });

  inputEntrada?.addEventListener('input', agendarBuscaNome);

  inputEntrada?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarEntrada();
    }
    if (e.key === 'Escape') fecharSugestoes();
  });

  btnBuscar?.addEventListener('click', (e) => {
    e.preventDefault();
    buscar(getFiltros());
  });

  document.addEventListener('click', (e) => {
    if (
      sugestoesEntrada &&
      !sugestoesEntrada.contains(e.target) &&
      e.target !== inputEntrada &&
      e.target !== btnEntrada
    ) {
      sugestoesEntrada.classList.add('hidden');
    }
  });

  checarStatus();

  return { buscar, checarStatus, aplicarFormularioGroner };
}

/** @deprecated use aplicarFormularioGroner */
export function preencherClienteDaGroner(contato, projetoId) {
  aplicarFormularioGroner({
    formulario: {
      cliente: {
        nome: contato.nome,
        documento: contato.documento,
        email: contato.email,
        telefone: contato.telefone,
      },
      groner: { leadId: contato.id, projetoId },
    },
  });
}
