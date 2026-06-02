#!/usr/bin/env node
/**
 * Cria uma cópia do sistema para um novo cliente Groner.
 *
 * Uso:
 *   node scripts/criar-projeto-cliente.mjs \
 *     --dest "../OutroCliente/sistema" \
 *     --id acme \
 *     --nome "ACME Energia Solar" \
 *     --nome-curto ACME \
 *     --tenant acmeenergiasolar \
 *     --slug acme-propostas
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENTE_BASE = path.join(ROOT, 'cliente-base');

const IGNORE = new Set([
  'node_modules',
  'dist',
  '.git',
  '.cursor',
  'debug-218c80.log',
]);

const IGNORE_PREFIX = [];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-/g, '_');
      out[key] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function shouldSkip(name) {
  if (IGNORE.has(name)) return true;
  if (name === '.env' || name === '.env.local' || name === '.env.production') return true;
  if (name.startsWith('debug-') && name.endsWith('.log')) return true;
  return false;
}

function copyDir(src, dest, rel = '') {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const name = entry.name;
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    const relPath = rel ? `${rel}/${name}` : name;

    if (shouldSkip(name)) continue;

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, relPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function loadTemplateJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CLIENTE_BASE, 'config', name), 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);

  const dest = args.dest ? path.resolve(args.dest) : null;
  const id = args.id?.trim();
  const nome = args.nome?.trim();
  const nomeCurto = args.nome_curto?.trim() || id?.toUpperCase();
  const tenant = args.tenant?.trim();
  const slug = args.slug?.trim() || `${id}-propostas`;

  if (!dest || !id || !nome || !tenant) {
    console.error(`
Uso:
  node scripts/criar-projeto-cliente.mjs \\
    --dest "../Caminho/novo-cliente/sistema" \\
    --id acme \\
    --nome "ACME Energia Solar" \\
    --nome-curto ACME \\
    --tenant acmeenergiasolar \\
    --slug acme-propostas
`);
    process.exit(1);
  }

  if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
    console.error(`Destino não vazio: ${dest}`);
    process.exit(1);
  }

  console.log(`Copiando projeto para ${dest}...`);
  copyDir(ROOT, dest);

  const cliente = loadTemplateJson('cliente.json');
  cliente.id = id;
  cliente.nome = nome;
  cliente.nomeCurto = nomeCurto;
  cliente.slug = slug;
  cliente.produto.sistemaNome = `${nomeCurto} Propostas`;
  cliente.marca.logoAlt = nome;
  cliente.marca.vendedorPadrao = `Equipe Comercial ${nomeCurto}`;
  cliente.localStorage.precificacaoKey = `${id}-precificacao-v1`;
  cliente.localStorage.eventoConfig = `${id}-config-updated`;
  cliente.groner.notaCadastroLead = `Cadastro automático — ${nomeCurto} Propostas (Pré-venda)`;
  cliente.groner.notaProjetoPrefixo = `Proposta ${nomeCurto}`;

  writeJson(path.join(dest, 'config/cliente.json'), cliente);

  const groner = loadTemplateJson('groner-integracao.json');
  groner.tenant = tenant;
  writeJson(path.join(dest, 'config/groner-integracao.json'), groner);

  const precificacao = loadTemplateJson('precificacao.json');
  precificacao.meta.descricao = `Precificação ${nomeCurto}`;
  writeJson(path.join(dest, 'config/precificacao.json'), precificacao);

  const envExample = fs.readFileSync(path.join(CLIENTE_BASE, '.env.example'), 'utf8');
  fs.writeFileSync(
    path.join(dest, '.env.example'),
    envExample.replace(/SUBSTITUA_TENANT_GRONER/g, tenant),
    'utf8',
  );

  const pkgPath = path.join(dest, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = slug;
  writeJson(pkgPath, pkg);

  console.log(`
Projeto criado: ${dest}

Próximos passos:
  1. cd "${dest}"
  2. Edite config/groner-integracao.json (origem, tipo, campos personalizados)
  3. Ajuste config/precificacao.json ou use o Admin após subir o app
  4. cp .env.example .env  →  GRONER_TOKEN + tenant
  5. npm install && npm run dev:all
  6. git init && repositório + Vercel separados para este cliente

Veja cliente-base/CHECKLIST.md
`);
}

main();
