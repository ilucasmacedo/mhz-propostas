# Deploy via GitHub Pages

O site é publicado automaticamente a cada push na branch `main` (ou `master`).

## Configuração inicial (uma vez)

1. Crie um repositório no GitHub (ex.: `mhz-propostas`).
2. Envie o código:

   ```bash
   git init
   git add .
   git commit -m "Sistema de propostas MHZ"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
   git push -u origin main
   ```

3. No GitHub: **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
4. O workflow `.github/workflows/deploy.yml` roda sozinho no primeiro push.
5. URL do site: `https://SEU_USUARIO.github.io/NOME_DO_REPO/`

## Atualizar o site

Basta commitar e dar push — o deploy roda automaticamente.

```bash
git add .
git commit -m "Descrição da alteração"
git push
```

Acompanhe em **Actions** no GitHub.

## URLs úteis

| Página | Caminho |
|--------|---------|
| Propostas + Admin | `/` (index) |
| CRM (fórmulas) | `/crm-painel.html` |

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Simular build de produção (com subpasta do GitHub Pages)

No PowerShell, substitua `NOME_DO_REPO` pelo nome real do repositório:

```powershell
$env:BASE_PATH="/NOME_DO_REPO/"
npm run build
npm run preview
```

## Domínio próprio (opcional)

Em **Settings → Pages → Custom domain**, configure o domínio e altere o workflow para usar `BASE_PATH: /` em vez de `/${{ github.event.repository.name }}/`.

## Config do admin no servidor

Alterações no painel Admin ficam no `localStorage` do navegador. Para persistir para todos:

1. Admin → **Exportar JSON**
2. Substituir `config/precificacao.json` no repositório
3. Commit + push
