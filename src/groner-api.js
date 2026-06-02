const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function gronerApiFetch(path, { method = 'POST', json, body, headers = {} } = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...(json != null ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json != null ? JSON.stringify(json) : body,
  });

  const data = await res.json();
  if (!res.ok || data.ok === false) {
    const err = new Error(data.erro || 'Falha na comunicação com a API.');
    err.code = data.code;
    err.status = res.status;
    throw err;
  }

  return data;
}
