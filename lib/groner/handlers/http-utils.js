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

/** Exige MHZ_API_SECRET quando configurado no servidor. Em produção, bloqueia se ausente. */
export function requireApiAuth(req, res, _route) {
  const secret = getApiSecret();

  if (!secret) {
    if (process.env.VERCEL_ENV === 'production') {
      sendJson(res, 503, {
        ok: false,
        erro:
          'API bloqueada: configure MHZ_API_SECRET e VITE_MHZ_API_KEY (mesmo valor) na Vercel e redeploy.',
        code: 'API_NOT_CONFIGURED',
      });
      return false;
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
