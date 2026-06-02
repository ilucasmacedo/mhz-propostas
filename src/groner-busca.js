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

  async function checarStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/groner/status`);
      const data = await res.json();
      configurado = Boolean(data.configurado);
      if (statusEl) {
        statusEl.textContent = configurado
          ? 'Groner conectada — busca Lead + Projetos'
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
        statusEl.textContent = 'API indisponível — use a URL da Vercel';
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

  function renderLista(leads, container, { compacto = false } = {}) {
    if (!container) return;

    if (!leads.length) {
      container.innerHTML =
        '<p class="groner-empty">Nenhum contato encontrado. Tente o <strong>nome do Lead</strong> (ex.: LV CAUSA ANIMAL LTDA) ou o <strong>nome do Projeto</strong> (ex.: BICHO LEGAL).</p>';
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = `
      ${compacto ? '' : `<p class="groner-resultados-head">${leads.length} contato(s) — selecione o negócio (projeto)</p>`}
      <ul class="groner-lista ${compacto ? 'groner-lista-compact' : ''}">
        ${leads
          .map((lead) => {
            const projetosHtml =
              lead.projetos?.length > 0
                ? `<ul class="groner-projetos">
                    ${lead.projetos
                      .map(
                        (p) => `
                      <li>
                        <button
                          type="button"
                          class="groner-projeto-btn"
                          data-lead-id="${lead.id}"
                          data-projeto-id="${p.id}"
                        >
                          <span class="groner-projeto-nome">${esc(p.nome)}</span>
                          ${p.consumo ? `<span class="groner-projeto-meta">${p.consumo} kWh</span>` : ''}
                        </button>
                      </li>`,
                      )
                      .join('')}
                  </ul>`
                : '<p class="groner-sem-projeto">Nenhum negócio (projeto) vinculado a este lead.</p>';

            return `
          <li class="groner-item" data-lead-id="${lead.id}">
            <div class="groner-item-lead">
              <span class="groner-label">Contato (Lead)</span>
              <strong>${esc(lead.nome || 'Sem nome')}</strong>
              <span class="groner-item-meta">${esc(lead.email || '—')} · ${esc(lead.documento || '—')} · ${esc(formatTelefone(lead.telefone) || '—')}</span>
              ${lead.endereco ? `<span class="groner-item-end">${esc(lead.endereco)}</span>` : ''}
            </div>
            <div class="groner-item-projetos">
              <span class="groner-label">Negócios (Projetos) — ${lead.projetos?.length ?? 0}</span>
              ${projetosHtml}
            </div>
          </li>`;
          })
          .join('')}
      </ul>`;

    container.querySelectorAll('.groner-projeto-btn').forEach((btn) => {
      btn.addEventListener('click', () =>
        carregarProjeto(Number(btn.dataset.leadId), Number(btn.dataset.projetoId), btn),
      );
    });

    container.classList.remove('hidden');
  }

  async function carregarProjeto(leadId, projetoId, btn) {
    const label = btn?.querySelector('.groner-projeto-nome')?.textContent ?? 'projeto';

    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
    }

    try {
      const data = await apiPost('/api/groner/carregar-contato', { leadId, projetoId });
      aplicarFormularioGroner(data);
      onAplicado?.(data);
      fecharSugestoes();

      const lead = data.lead;
      if (inputEntrada && lead?.nome) {
        inputEntrada.value = lead.nome;
      }
    } catch (err) {
      alert(`Erro ao carregar ${label}: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }
  }

  async function buscar(filtros, targetEl) {
    const destino = targetEl ?? resultadosEl;
    const temFiltro =
      filtros.nome || filtros.email || filtros.documento || filtros.telefone;

    if (!temFiltro) {
      alert('Digite pelo menos 3 caracteres (nome do Lead ou do Projeto).');
      return;
    }

    if (destino) {
      destino.innerHTML = '<p class="groner-empty">Buscando Lead e Projetos na Groner...</p>';
      destino.classList.remove('hidden');
    }

    try {
      const data = await apiPost('/api/groner/buscar-contato', filtros);
      renderLista(data.contatos ?? [], destino, { compacto: destino === sugestoesEntrada });
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
      alert(`Digite pelo menos ${MIN_BUSCA} caracteres.`);
      return;
    }
    buscar(
      {
        nome: termo,
        email: termo.includes('@') ? termo : '',
        documento: '',
        telefone: '',
      },
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
