import { CLIENTE } from './cliente-config.js';
import {
  cloneConfig,
  downloadConfigJson,
  hasStoredConfig,
  readConfigFile,
} from './config-store.js';
import {
  applyConfig as applyPricingConfig,
  getActiveConfig,
  resetConfigToDefault as resetPricing,
} from './pricing.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'ok') {
  let el = document.getElementById('admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

export function mountAdmin(root) {
  let draft = cloneConfig(getActiveConfig());
  let activeTab = 'planos';

  const planoCodigos = () => Object.keys(draft.planos);

  function syncDraftFromDom() {
    draft.constantes.validade_proposta_dias = num('#adm-validade');
    draft.constantes.percentual_investimento_padrao = num('#adm-pct-inv');
    draft.constantes.raio_base_km = num('#adm-raio');
    draft.constantes.kwp_maximo_automatico = num('#adm-kwp-max');

    root.querySelectorAll('[data-plano-codigo]').forEach((row) => {
      const codigo = row.dataset.planoCodigo;
      draft.planos[codigo].nome = row.querySelector('[data-f=nome]').value.trim();
      draft.planos[codigo].tagline = row.querySelector('[data-f=tagline]').value.trim();
      draft.planos[codigo].alias = row.querySelector('[data-f=alias]').value.trim() || undefined;
      draft.planos[codigo].desconto_avulso = row.querySelector('[data-f=desconto]').checked;
      draft.planos[codigo].coberturas = row
        .querySelector('[data-f=coberturas]')
        .value.split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    });

    draft.faixas_kwp = [];
    root.querySelectorAll('[data-faixa-row]').forEach((row) => {
      const sob = row.querySelector('[data-f=sob]').checked;
      const faixa = {
        kwp_min: numEl(row.querySelector('[data-f=kwp_min]')),
        kwp_max: sob ? null : numEl(row.querySelector('[data-f=kwp_max]')),
        sob_consulta: sob,
        precos: sob ? null : {},
      };
      if (!sob) {
        planoCodigos().forEach((p) => {
          faixa.precos[p] = numEl(row.querySelector(`[data-f=preco-${p}]`));
        });
      }
      draft.faixas_kwp.push(faixa);
    });

    draft.faixas_deslocamento = [];
    root.querySelectorAll('[data-desl-row]').forEach((row) => {
      draft.faixas_deslocamento.push({
        km_min: numEl(row.querySelector('[data-f=km_min]')),
        km_max: row.querySelector('[data-f=km_max_null]').checked
          ? null
          : numEl(row.querySelector('[data-f=km_max]')),
        taxa_por_km: numEl(row.querySelector('[data-f=taxa]')),
      });
    });

    draft.servicos_avulsos = [];
    root.querySelectorAll('[data-serv-row]').forEach((row) => {
      draft.servicos_avulsos.push({
        codigo: row.querySelector('[data-f=codigo]').value.trim().toUpperCase().replace(/\s+/g, '_'),
        descricao: row.querySelector('[data-f=descricao]').value.trim(),
        fora_plano: numEl(row.querySelector('[data-f=fora]')),
        com_plano: numEl(row.querySelector('[data-f=com]')),
        tipo_calculo: row.querySelector('[data-f=tipo]').value,
        presencial: row.querySelector('[data-f=presencial]').checked,
        keyword: row.querySelector('[data-f=keyword]').value.trim() || undefined,
      });
    });
  }

  function num(sel) {
    const el = root.querySelector(sel);
    return el ? numEl(el) : 0;
  }

  function numEl(el) {
    const v = parseFloat(String(el.value).replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }

  function renderPlanos() {
    const cards = planoCodigos()
      .map((codigo) => {
        const p = draft.planos[codigo];
        return `
        <div class="admin-card" data-plano-codigo="${esc(codigo)}">
          <div class="admin-card-head">
            <strong>${esc(codigo)}</strong>
            <button type="button" class="btn btn-danger btn-sm" data-del-plano="${esc(codigo)}">Remover</button>
          </div>
          <div class="admin-fields">
            <label><span>Nome exibido</span><input data-f="nome" value="${esc(p.nome)}" /></label>
            <label><span>Tagline</span><input data-f="tagline" value="${esc(p.tagline)}" /></label>
            <label><span>Alias (opcional)</span><input data-f="alias" value="${esc(p.alias || '')}" placeholder="Basic" /></label>
            <label class="admin-check"><input type="checkbox" data-f="desconto" ${p.desconto_avulso ? 'checked' : ''} /> Desconto em serviços avulsos</label>
            <label class="span-2"><span>Coberturas (1 por linha)</span><textarea data-f="coberturas" rows="4">${esc((p.coberturas || []).join('\n'))}</textarea></label>
          </div>
        </div>`;
      })
      .join('');

    return `
      <div class="admin-section-head">
        <p>Edite nomes, taglines e se o plano dá desconto em avulsos.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="adm-add-plano">+ Adicionar plano</button>
      </div>
      <div class="admin-cards">${cards}</div>`;
  }

  function renderFaixas() {
    const cols = planoCodigos();
    const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
    const rows = draft.faixas_kwp
      .map((f, i) => {
        const sob = f.sob_consulta;
        const precos = sob
          ? `<td colspan="${cols.length}" class="muted">Sob consulta</td>`
          : cols
              .map(
                (p) =>
                  `<td><input type="number" step="0.01" data-f="preco-${p}" value="${f.precos?.[p] ?? 0}" class="admin-inp-sm" /></td>`,
              )
              .join('');
        return `
        <tr data-faixa-row="${i}">
          <td><input type="number" step="0.01" data-f="kwp_min" value="${f.kwp_min}" class="admin-inp-sm" /></td>
          <td><input type="number" step="0.01" data-f="kwp_max" value="${f.kwp_max ?? ''}" class="admin-inp-sm" ${sob ? 'disabled' : ''} /></td>
          <td><input type="checkbox" data-f="sob" ${sob ? 'checked' : ''} /></td>
          ${precos}
          <td><button type="button" class="btn-icon" data-del-faixa="${i}">×</button></td>
        </tr>`;
      })
      .join('');

    return `
      <div class="admin-section-head">
        <p>Mensalidade R$/mês por faixa de kWp. Intervalo (min, max].</p>
        <button type="button" class="btn btn-secondary btn-sm" id="adm-add-faixa">+ Faixa kWp</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Min kWp</th><th>Max kWp</th><th>Sob cons.</th>${head}<th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderDeslocamento() {
    const rows = draft.faixas_deslocamento
      .map(
        (f, i) => `
      <tr data-desl-row="${i}">
        <td><input type="number" data-f="km_min" value="${f.km_min}" class="admin-inp-sm" /></td>
        <td><input type="number" data-f="km_max" value="${f.km_max ?? ''}" class="admin-inp-sm" ${f.km_max === null ? 'disabled' : ''} /></td>
        <td><input type="checkbox" data-f="km_max_null" ${f.km_max === null ? 'checked' : ''} title="Sem limite superior" /></td>
        <td><input type="number" step="0.01" data-f="taxa" value="${f.taxa_por_km}" class="admin-inp-sm" /></td>
        <td><button type="button" class="btn-icon" data-del-desl="${i}">×</button></td>
      </tr>`,
      )
      .join('');

    return `
      <div class="admin-section-head">
        <p>Taxa R$/km excedente (após raio base). Marque "∞" quando km_max for aberto.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="adm-add-desl">+ Faixa km</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Km min</th><th>Km max</th><th>∞</th><th>Taxa R$/km</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderServicos() {
    const rows = draft.servicos_avulsos
      .map(
        (s, i) => `
      <tr data-serv-row="${i}">
        <td><input data-f="codigo" value="${esc(s.codigo)}" class="admin-inp-sm" /></td>
        <td><input data-f="descricao" value="${esc(s.descricao)}" /></td>
        <td><input type="number" step="0.001" data-f="fora" value="${s.fora_plano}" class="admin-inp-sm" /></td>
        <td><input type="number" step="0.001" data-f="com" value="${s.com_plano}" class="admin-inp-sm" /></td>
        <td>
          <select data-f="tipo" class="admin-inp-sm">
            <option value="FIXO" ${s.tipo_calculo === 'FIXO' ? 'selected' : ''}>Fixo</option>
            <option value="POR_PLACA" ${s.tipo_calculo === 'POR_PLACA' ? 'selected' : ''}>Por placa</option>
            <option value="PERCENTUAL" ${s.tipo_calculo === 'PERCENTUAL' ? 'selected' : ''}>% contrato</option>
          </select>
        </td>
        <td class="center"><input type="checkbox" data-f="presencial" ${s.presencial ? 'checked' : ''} /></td>
        <td><input data-f="keyword" value="${esc(s.keyword || '')}" placeholder="CRM checklist" class="admin-inp-sm" /></td>
        <td><button type="button" class="btn-icon" data-del-serv="${i}">×</button></td>
      </tr>`,
      )
      .join('');

    return `
      <div class="admin-section-head">
        <p>Serviços avulsos na proposta. Percentual: 0.02 = 2%. Keyword = texto buscado no checklist CRM.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="adm-add-serv">+ Serviço</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table admin-table-wide">
          <thead><tr>
            <th>Código</th><th>Descrição</th><th>Fora plano</th><th>Com plano</th>
            <th>Tipo</th><th>Pres.</th><th>Keyword CRM</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderConstantes() {
    const c = draft.constantes;
    return `
      <div class="admin-fields const-grid">
        <label><span>Validade proposta (dias)</span><input type="number" id="adm-validade" value="${c.validade_proposta_dias}" /></label>
        <label><span>Taxa investimento padrão (%)</span><input type="number" step="0.1" id="adm-pct-inv" value="${c.percentual_investimento_padrao}" /></label>
        <label><span>Raio base deslocamento (km)</span><input type="number" id="adm-raio" value="${c.raio_base_km}" /></label>
        <label><span>kWp máx. automático</span><input type="number" id="adm-kwp-max" value="${c.kwp_maximo_automatico}" /></label>
      </div>`;
  }

  function panelContent() {
    switch (activeTab) {
      case 'planos':
        return renderPlanos();
      case 'faixas':
        return renderFaixas();
      case 'deslocamento':
        return renderDeslocamento();
      case 'servicos':
        return renderServicos();
      case 'constantes':
        return renderConstantes();
      default:
        return '';
    }
  }

  function render() {
    const custom = hasStoredConfig();
    root.innerHTML = `
      <header class="page-header">
        <div>
          <h1>Administração — Precificação</h1>
          <p>Alterações salvas no navegador. Exporte o JSON para persistir no servidor ou compartilhar.</p>
        </div>
        <div class="header-actions">
          <span class="badge ${custom ? 'gerada' : ''}">${custom ? 'Config personalizada' : 'Config padrão'}</span>
        </div>
      </header>

      <div class="admin-toolbar">
        <button type="button" class="btn btn-primary" id="adm-save">Salvar alterações</button>
        <button type="button" class="btn btn-secondary" id="adm-export">Exportar JSON</button>
        <label class="btn btn-secondary admin-file-btn">
          Importar JSON
          <input type="file" id="adm-import" accept=".json,application/json" hidden />
        </label>
        <button type="button" class="btn btn-secondary" id="adm-reset">Restaurar padrão</button>
      </div>

      <nav class="admin-tabs">
        ${['planos', 'faixas', 'deslocamento', 'servicos', 'constantes']
          .map(
            (t) =>
              `<button type="button" class="admin-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${{ planos: 'Planos', faixas: 'Faixas kWp', deslocamento: 'Deslocamento', servicos: 'Serviços', constantes: 'Constantes' }[t]}</button>`,
          )
          .join('')}
      </nav>

      <div class="admin-panel">${panelContent()}</div>
    `;

    bindEvents();
  }

  function bindEvents() {
    root.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        activeTab = btn.dataset.tab;
        render();
      });
    });

    root.querySelector('#adm-save')?.addEventListener('click', () => {
      syncDraftFromDom();
      draft.meta.atualizado_em = new Date().toISOString().slice(0, 10);
      applyPricingConfig(draft, { persist: true });
      toast('Configuração salva! Propostas atualizadas.');
      render();
    });

    root.querySelector('#adm-export')?.addEventListener('click', () => {
      syncDraftFromDom();
      downloadConfigJson(draft, `precificacao-${CLIENTE.id || 'cliente'}-${Date.now()}.json`);
      toast('JSON exportado.');
    });

    root.querySelector('#adm-import')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const imported = await readConfigFile(file);
        draft = cloneConfig(imported);
        applyPricingConfig(draft, { persist: true });
        toast('JSON importado e aplicado.');
        render();
      } catch (err) {
        toast(err.message, 'err');
      }
      e.target.value = '';
    });

    root.querySelector('#adm-reset')?.addEventListener('click', () => {
      if (!confirm('Restaurar valores originais? Isso apaga a config personalizada deste navegador.')) return;
      draft = cloneConfig(resetPricing());
      toast('Configuração padrão restaurada.');
      render();
    });

    root.querySelector('#adm-add-plano')?.addEventListener('click', () => {
      syncDraftFromDom();
      const codigo = prompt('Código do plano (MAIÚSCULAS, ex: VIP):')?.trim().toUpperCase();
      if (!codigo || draft.planos[codigo]) return;
      draft.planos[codigo] = {
        codigo,
        nome: `Plano ${codigo}`,
        tagline: '',
        desconto_avulso: false,
        coberturas: [],
      };
      draft.faixas_kwp.forEach((f) => {
        if (f.precos) f.precos[codigo] = 0;
      });
      render();
    });

    root.querySelectorAll('[data-del-plano]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const codigo = btn.dataset.delPlano;
        if (!confirm(`Remover plano ${codigo}?`)) return;
        syncDraftFromDom();
        delete draft.planos[codigo];
        draft.faixas_kwp.forEach((f) => {
          if (f.precos) delete f.precos[codigo];
        });
        render();
      });
    });

    root.querySelector('#adm-add-faixa')?.addEventListener('click', () => {
      syncDraftFromDom();
      const last = draft.faixas_kwp.filter((f) => !f.sob_consulta).at(-1);
      const min = last?.kwp_max ?? 0;
      const precos = Object.fromEntries(planoCodigos().map((p) => [p, 0]));
      const idx = draft.faixas_kwp.findIndex((f) => f.sob_consulta);
      draft.faixas_kwp.splice(idx >= 0 ? idx : draft.faixas_kwp.length, 0, {
        kwp_min: min,
        kwp_max: min + 5,
        precos,
        sob_consulta: false,
      });
      render();
    });

    root.querySelectorAll('[data-del-faixa]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        draft.faixas_kwp.splice(Number(btn.dataset.delFaixa), 1);
        render();
      });
    });

    root.querySelector('#adm-add-desl')?.addEventListener('click', () => {
      syncDraftFromDom();
      draft.faixas_deslocamento.push({ km_min: 0, km_max: 50, taxa_por_km: 0 });
      render();
    });

    root.querySelectorAll('[data-del-desl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        draft.faixas_deslocamento.splice(Number(btn.dataset.delDesl), 1);
        render();
      });
    });

    root.querySelector('#adm-add-serv')?.addEventListener('click', () => {
      syncDraftFromDom();
      draft.servicos_avulsos.push({
        codigo: `SERVICO_${Date.now().toString(36).slice(-4).toUpperCase()}`,
        descricao: 'Novo serviço',
        fora_plano: 0,
        com_plano: 0,
        tipo_calculo: 'FIXO',
        presencial: false,
      });
      render();
    });

    root.querySelectorAll('[data-del-serv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftFromDom();
        draft.servicos_avulsos.splice(Number(btn.dataset.delServ), 1);
        render();
      });
    });

    root.querySelectorAll('[data-f=sob]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const row = cb.closest('[data-faixa-row]');
        row.querySelector('[data-f=kwp_max]').disabled = cb.checked;
      });
    });

    root.querySelectorAll('[data-f=km_max_null]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const row = cb.closest('[data-desl-row]');
        row.querySelector('[data-f=km_max]').disabled = cb.checked;
      });
    });
  }

  render();
}
