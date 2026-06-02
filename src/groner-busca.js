const API_BASE = import.meta.env.VITE_API_BASE || '';

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

export function initGronerBusca({
  btnBuscar,
  resultadosEl,
  statusEl,
  getFiltros,
  onSelecionar,
}) {
  let configurado = null;

  async function checarStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/groner/status`);
      const data = await res.json();
      configurado = Boolean(data.configurado);
      if (statusEl) {
        statusEl.textContent = configurado
          ? 'Groner conectada'
          : 'Groner: configure GRONER_TENANT e GRONER_TOKEN no servidor';
        statusEl.dataset.state = configurado ? 'ok' : 'warn';
      }
      if (btnBuscar) btnBuscar.disabled = !configurado;
    } catch {
      configurado = false;
      if (statusEl) {
        statusEl.textContent = 'API indisponível — rode npm run dev:all ou use a Vercel';
        statusEl.dataset.state = 'err';
      }
      if (btnBuscar) btnBuscar.disabled = true;
    }
  }

  function renderResultados(contatos) {
    if (!resultadosEl) return;

    if (!contatos.length) {
      resultadosEl.innerHTML = '<p class="groner-empty">Nenhum contato encontrado na Groner.</p>';
      resultadosEl.classList.remove('hidden');
      return;
    }

    resultadosEl.innerHTML = `
      <p class="groner-resultados-head">${contatos.length} contato(s) encontrado(s)</p>
      <ul class="groner-lista">
        ${contatos
          .map((c) => {
            const projetos =
              c.projetos?.length > 0
                ? c.projetos
                    .map(
                      (p) =>
                        `<option value="${p.id}">${esc(p.nome)}${p.consumo ? ` — ${p.consumo} kWh` : ''}</option>`,
                    )
                    .join('')
                : '';

            return `
          <li class="groner-item" data-lead-id="${c.id}">
            <div class="groner-item-main">
              <strong>${esc(c.nome || 'Sem nome')}</strong>
              <span>${esc(c.email || '—')} · ${esc(c.documento || '—')} · ${esc(formatTelefone(c.telefone) || '—')}</span>
            </div>
            ${
              projetos
                ? `<label class="groner-projeto-pick"><span>Projeto</span><select class="groner-projeto-select">${projetos}</select></label>`
                : '<span class="groner-sem-projeto">Sem projeto vinculado</span>'
            }
            <button type="button" class="btn btn-secondary btn-sm groner-usar">Usar este contato</button>
          </li>`;
          })
          .join('')}
      </ul>`;

    resultadosEl.querySelectorAll('.groner-usar').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.groner-item');
        const leadId = Number(item.dataset.leadId);
        const contato = contatos.find((c) => c.id === leadId);
        const select = item.querySelector('.groner-projeto-select');
        const projetoId = select ? Number(select.value) : contato.projetos?.[0]?.id ?? null;
        onSelecionar?.({ contato, projetoId });
        resultadosEl.classList.add('hidden');
      });
    });

    resultadosEl.classList.remove('hidden');
  }

  async function buscar() {
    const filtros = getFiltros();
    if (!filtros.nome && !filtros.email && !filtros.documento && !filtros.telefone) {
      alert('Preencha ao menos um campo do cliente para buscar na Groner.');
      return;
    }

    btnBuscar.disabled = true;
    btnBuscar.textContent = 'Buscando...';
    if (resultadosEl) {
      resultadosEl.innerHTML = '<p class="groner-empty">Consultando Groner...</p>';
      resultadosEl.classList.remove('hidden');
    }

    try {
      const res = await fetch(`${API_BASE}/api/groner/buscar-contato`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filtros),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.erro || 'Falha na busca.');
      }

      renderResultados(data.contatos ?? []);
    } catch (err) {
      if (resultadosEl) {
        resultadosEl.innerHTML = `<p class="groner-empty groner-erro">${esc(err.message)}</p>`;
        resultadosEl.classList.remove('hidden');
      }
    } finally {
      btnBuscar.disabled = !configurado;
      btnBuscar.textContent = 'Buscar na Groner';
    }
  }

  btnBuscar?.addEventListener('click', (e) => {
    e.preventDefault();
    buscar();
  });

  checarStatus();

  return { buscar, checarStatus };
}

export function preencherClienteDaGroner(contato, projetoId) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null && val !== '') el.value = val;
  };

  set('cliente-nome', contato.nome);
  set('cliente-documento', contato.documento);
  set('cliente-email', contato.email);
  set('cliente-telefone', formatTelefone(contato.telefone));
  set('groner-lead-id', contato.id);
  set('groner-projeto-id', projetoId ?? '');

  const badge = document.getElementById('badge-groner');
  if (badge) {
    badge.textContent = projetoId
      ? `Groner: Lead #${contato.id} · Projeto #${projetoId}`
      : `Groner: Lead #${contato.id}`;
    badge.classList.remove('hidden');
  }
}
