import './playbook.css';
import playbookHtml from './playbook.html?raw';

export function mountPlaybook(container) {
  container.innerHTML = playbookHtml;
  initPlaybook(container);
}

function initPlaybook(root) {
  const tabs = root.querySelectorAll('[data-playbook-tab]');
  const panels = root.querySelectorAll('[data-playbook-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.playbookTab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.playbookPanel === id));
    });
  });

  root.querySelectorAll('[data-stage-toggle]').forEach((header) => {
    header.addEventListener('click', () => {
      header.closest('.stage')?.classList.toggle('open');
    });
  });

  root.querySelectorAll('.msg-bubble').forEach((bubble) => {
    bubble.addEventListener('click', async () => {
      const clone = bubble.cloneNode(true);
      clone.querySelector('.msg-label')?.remove();
      const text = clone.textContent.trim();
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        bubble.classList.add('copied');
        const labelEl = bubble.querySelector('.msg-label');
        if (labelEl) {
          const original = labelEl.textContent;
          labelEl.textContent = '✓ Copiado!';
          setTimeout(() => {
            labelEl.textContent = original;
            bubble.classList.remove('copied');
          }, 2000);
        } else {
          setTimeout(() => bubble.classList.remove('copied'), 2000);
        }
      } catch {
        alert('Não foi possível copiar. Selecione o texto manualmente.');
      }
    });
  });
}
