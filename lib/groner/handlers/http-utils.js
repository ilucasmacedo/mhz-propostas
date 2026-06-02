const DEFAULT_JSON_MAX = 512 * 1024;
const DEFAULT_PDF_MAX = 15 * 1024 * 1024;

export function setCors(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Projeto-Id, X-Nome-Arquivo',
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
