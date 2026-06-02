# Integração Groner CRM

Documentação oficial: [API Groner CRM](https://ajuda.groner.app/pt-br/article/documentacao-da-api-groner-crm-vz2bq2/)

## 1. Configurar credenciais

### Gerar token (500 dias — recomendado)

```bash
curl -X POST "https://SEU_TENANT.api.groner.app/api/Conta/GerarToken" \
  -H "Content-Type: application/json" \
  -d '{"email":"integracao@suaempresa.com","senha":"SUA_SENHA"}'
```

Copie o `accessToken` retornado.

### Variáveis de ambiente

| Variável | Onde | Descrição |
|----------|------|-----------|
| `GRONER_TENANT` | `.env` / Vercel | Subdomínio da empresa (ex.: `mhz`) |
| `GRONER_TOKEN` | `.env` / Vercel | JWT Bearer — **somente no servidor** |

```powershell
copy .env.example .env
# Edite .env com tenant e token
```

Na **Vercel**: Project → Settings → Environment Variables → adicione as duas variáveis.

> O token **nunca** vai no frontend. A busca passa pela API `/api/groner/*`.

---

## 2. Buscar contato (implementado)

No formulário **Cliente**, use **Buscar na Groner**. A busca usa **todos os campos preenchidos** em paralelo:

| Campo no sistema | Endpoint Groner |
|------------------|-----------------|
| CPF / CNPJ | `GET /api/Lead/VerificarDocumento/{documento}` |
| E-mail | `GET /api/Lead/Verificar/{email}` |
| Telefone | `GET /api/Lead/VerificarCelular/{celular}/55` |
| Nome | `GET /api/Lead?query={nome}` |

Ao selecionar um contato:
- Preenche nome, documento, e-mail e telefone
- Guarda `Lead ID` e `Projeto ID` (se houver) para envio futuro do orçamento/PDF

---

## 3. Desenvolvimento local

```powershell
npm install
copy .env.example .env
# preencha GRONER_TENANT e GRONER_TOKEN

npm run dev:all
```

Isso sobe:
- **Web** — Vite em `http://localhost:5173`
- **API** — `http://localhost:3001` (proxy automático `/api` → API local)

Teste rápido:

```powershell
curl -X POST http://localhost:3001/api/groner/buscar-contato `
  -H "Content-Type: application/json" `
  -d '{"email":"cliente@email.com"}'
```

---

## 4. Deploy (Vercel)

1. Configure `GRONER_TENANT` e `GRONER_TOKEN` nas variáveis de ambiente
2. Faça push — as rotas em `api/groner/` viram serverless functions
3. O frontend chama `/api/groner/buscar-contato` no mesmo domínio

**GitHub Pages sozinho não roda a API** — use a Vercel como URL principal ou hospede a API em outro lugar e defina `VITE_API_BASE` no build.

---

## 5. Próximo passo (orçamento + PDF)

Fluxo planejado após busca do contato:

1. `POST /api/Orcamento` — criar orçamento no Projeto
2. `POST /api/Orcamento/{id}/ItensEmLote` — itens da proposta MHZ
3. Upload PDF → `POST /api/Arquivo` → `PUT /api/Projeto/{id}/AdicionarArquivo/{arquivoId}`
4. Campo personalizado tipo Arquivo → `POST /api/CampoPersonalizado/{id}/Responder`

IDs dos campos personalizados ficam em `config/groner-integracao.json` (a configurar no CRM).
