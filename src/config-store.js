import { getEventoConfigAtualizada, getStorageKeyPrecificacao } from './cliente-config.js';

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

export function loadStoredConfig(defaultConfig) {
  try {
    const raw = localStorage.getItem(getStorageKeyPrecificacao());
    if (raw) return JSON.parse(raw);
  } catch {
    /* usa padrão */
  }
  return cloneConfig(defaultConfig);
}

export function saveStoredConfig(config) {
  localStorage.setItem(getStorageKeyPrecificacao(), JSON.stringify(config));
}

export function clearStoredConfig() {
  localStorage.removeItem(getStorageKeyPrecificacao());
}

export function hasStoredConfig() {
  return Boolean(localStorage.getItem(getStorageKeyPrecificacao()));
}

export function downloadConfigJson(config, filename = 'precificacao.json') {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readConfigFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch {
        reject(new Error('Arquivo JSON inválido.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}

export const CONFIG_UPDATED_EVENT = getEventoConfigAtualizada();

export function notifyConfigUpdated() {
  window.dispatchEvent(new CustomEvent(CONFIG_UPDATED_EVENT));
}
