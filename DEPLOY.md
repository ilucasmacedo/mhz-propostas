# Deploy — GitHub Pages + Vercel

O mesmo repositório pode publicar nos **dois** lugares. Cada push no `main` atualiza os dois (se estiverem conectados).

| Onde | URL | Observação |
|------|-----|------------|
| **GitHub Pages** | `https://ilucasmacedo.github.io/mhz-propostas/` | Usa subpasta `/mhz-propostas/` (automático no Actions) |
| **Vercel** | `https://mhz-propostas.vercel.app` (ou domínio próprio) | Build na raiz `/` — sem `BASE_PATH` |

---

## GitHub Pages

O site é publicado automaticamente a cada push na branch `main` (ou `master`).

### Configuração inicial (uma vez)

1. Repositório: [github.com/ilucasmacedo/mhz-propostas](https://github.com/ilucasmacedo/mhz-propostas)
2. No GitHub: **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
3. O workflow `.github/workflows/deploy.yml` roda sozinho a cada push.

### Atualizar

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

Acompanhe em **Actions** no GitHub.

---

## Vercel

### Configuração inicial (uma vez)

1. Acesse [vercel.com](https://vercel.com) e entre com a conta GitHub.
2. **Add New → Project** → importe `ilucasmacedo/mhz-propostas`.
3. Deixe as opções padrão (Vite detectado automaticamente):
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Não** defina `BASE_PATH` — na Vercel o site roda na raiz.
4. Clique em **Deploy**.

Pronto. Cada `git push` no `main` dispara deploy na Vercel e no GitHub Pages.

### Deploy manual (opcional)

Com a [CLI da Vercel](https://vercel.com/docs/cli) instalada:

```bash
npm i -g vercel
vercel --prod
```

---

## URLs úteis

| Página | Caminho |
|--------|---------|
| Propostas + Admin | `/` |
| CRM (fórmulas) | `/crm-painel.html` |

---

## Escalar para outro cliente (novo tenant Groner)

Pasta base em **`cliente-base/`** (só configs padrão) + script de cópia:

```bash
npm run novo-cliente -- \
  --dest "../OutroCliente/sistema" \
  --id acme \
  --nome "ACME Energia Solar" \
  --nome-curto ACME \
  --tenant acmeenergiasolar \
  --slug acme-propostas
```

Depois: edite `config/groner-integracao.json`, `config/precificacao.json`, `.env` e faça deploy em **repositório + Vercel separados**.

Guia: [`cliente-base/LEIA-ME.md`](cliente-base/LEIA-ME.md) · Checklist: [`cliente-base/CHECKLIST.md`](cliente-base/CHECKLIST.md)

Cada cliente usa **`config/cliente.json`** (marca, textos) — a MHZ já está configurada nesse arquivo.

---

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Simular build do GitHub Pages (com subpasta)

No PowerShell:

```powershell
$env:BASE_PATH="/mhz-propostas/"
npm run build
npm run preview
```

Na Vercel, use `npm run build` sem `BASE_PATH`.

---

## Domínio próprio (opcional)

- **GitHub Pages:** Settings → Pages → Custom domain (e altere o workflow para `BASE_PATH: /`).
- **Vercel:** Project → Settings → Domains.

---

## Config do admin no servidor

Alterações no painel Admin ficam no `localStorage` do navegador. Para persistir para todos:

1. Admin → **Exportar JSON**
2. Substituir `config/precificacao.json` no repositório
3. Commit + push
