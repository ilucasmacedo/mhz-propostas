import http from 'node:http';
import { config } from 'dotenv';
import { handleBuscarContato, handleGronerStatus } from '../lib/groner/handlers/buscar-contato.js';
import { handleCarregarContato } from '../lib/groner/handlers/carregar-contato.js';
import { handleSincronizarProposta } from '../lib/groner/handlers/sincronizar-proposta.js';
import { handleUploadPdf } from '../lib/groner/handlers/upload-pdf.js';
import { handleGarantirContatoProposta } from '../lib/groner/handlers/garantir-contato.js';
import { handleCriarProjetoLead } from '../lib/groner/handlers/criar-projeto-lead.js';

config();

const PORT = Number(process.env.API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/api/groner/buscar-contato') {
    await handleBuscarContato(req, res);
    return;
  }

  if (pathname === '/api/groner/carregar-contato') {
    await handleCarregarContato(req, res);
    return;
  }

  if (pathname === '/api/groner/status') {
    await handleGronerStatus(req, res);
    return;
  }

  if (pathname === '/api/groner/sincronizar-proposta') {
    await handleSincronizarProposta(req, res);
    return;
  }

  if (pathname === '/api/groner/garantir-contato') {
    await handleGarantirContatoProposta(req, res);
    return;
  }

  if (pathname === '/api/groner/criar-projeto-lead') {
    await handleCriarProjetoLead(req, res);
    return;
  }

  if (pathname === '/api/groner/upload-pdf') {
    await handleUploadPdf(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, erro: 'Rota não encontrada.' }));
});

server.listen(PORT, () => {
  console.log(`[mhz-api] http://localhost:${PORT}`);
});
