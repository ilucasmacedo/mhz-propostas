const DEFAULT_JSON_MAX = 512 * 1024;
const DEFAULT_PDF_MAX = 15 * 1024 * 1024;

function getAllowedOrigins() {
  const raw =
    process.env.MHZ_ALLOWED_ORIGINS?.trim() ||
    'https://mhz-propostas.vercel.app,http://localhost:5173,http://localhost:4173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getApiSecret() {
  return process.env.MHZ_API_SECRET?.trim() || '';
}

function readApiKey(req) {
  const header = req.headers['x-mhz-key'];
  if (header) return String(header).trim();

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();

  return '';
}

// #region agent log
function auditApiAccess(req, route, data = {}) {
  fetch('http://127.0.0.1:7478/ingest/72b8b388-8a42-46df-a178-2832bafd6d18', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '218c80' },
    body: JSON.stringify({
      sessionId: '218c80',
      location: 'http-utils.js:auditApiAccess',
      message: 'API Groner acessada',
      hypothesisId: 'H1',
      data: {
        route,
        method: req.method,
        hasSecretConfigured: Boolean(getApiSecret()),
        hasValidKey: Boolean(getApiSecret()) && readApiKey(req) === getApiSecret(),
        origin: req.headers.origin || null,
        referer: req.headers.referer ? String(req.headers.referer).slice(0, 80) : null,
        ...data,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export function setCors(req, res) {
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else if (!getApiSecret()) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-MHZ-Key, Authorization, X-Projeto-Id, X-Nome-Arquivo',
  );
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function handleOptions(req, res) {
  setCors(req, res);
  res.statusCode = 204;
  res.end();
}

/** Exige MHZ_API_SECRET quando configurado no servidor. */
export function requireApiAuth(req, res, route) {
  auditApiAccess(req, route);

  const secret = getApiSecret();
  if (!secret) {
    if (process.env.VERCEL_ENV === 'production') {
      console.warn('[mhz-api] MHZ_API_SECRET não configurado — endpoints Groner públicos.');
    }
    return true;
  }

  if (readApiKey(req) !== secret) {
    sendJson(res, 401, {
      ok: false,
      erro: 'Não autorizado. Configure X-MHZ-Key no cliente.',
      code: 'UNAUTHORIZED',
    });
    return false;
  }

  return true;
}

export function readJsonBody(req, maxBytes = DEFAULT_JSON_MAX) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Body JSON excede o limite permitido.'), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });

    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}

export function readRawBody(req, maxBytes = DEFAULT_PDF_MAX) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Upload excede o limite permitido.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function isDiagnosticoEnabled() {
  return process.env.GRONER_DEBUG === '1' || process.env.VERCEL_ENV !== 'production';
}
