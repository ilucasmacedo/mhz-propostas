# Template — Sistema de Propostas + Groner

Pasta base para **escalar novos clientes** (outra empresa, outro tenant Groner, outros planos/preços).

## Estrutura

```
template/
  README.md                          ← este guia
  CHECKLIST-NOVO-CLIENTE.md          ← passo a passo na Groner + deploy
  config/
    cliente.json.example             ← marca, textos, localStorage
    groner-integracao.json.example   ← tenant, origem, campos CRM
    precificacao.json.example        ← planos, faixas, serviços (starter)
  .env.example
```

O código do sistema fica na **raiz do repositório** (compartilhado). Cada cliente novo = **cópia do projeto** + configs preenchidas.

---

## Criar projeto para um novo cliente

Na pasta **pai** (ex.: `CLIENTES GRONER`), rode:

```bash
node scripts/criar-projeto-cliente.mjs \
  --dest "../NovoCliente/sistema" \
  --id acme \
  --nome "ACME Energia Solar" \
  --nome-curto ACME \
  --tenant acmeenergiasolar \
  --slug acme-propostas
```

Isso:

1. Copia o projeto (sem `node_modules`, `.git`, `dist`)
2. Gera `config/cliente.json` e `config/groner-integracao.json`
3. Copia `precificacao.json` starter (edite planos/faixas no Admin ou JSON)
4. Atualiza `package.json` e `.env.example`

---

## O que configurar por cliente

| Arquivo | Conteúdo |
|---------|----------|
| `config/cliente.json` | Logo, site, e-mail, textos da UI, vendedor padrão |
| `config/groner-integracao.json` | Tenant Groner, origem/tipo Pré-venda, IDs campos personalizados |
| `config/precificacao.json` | Planos, faixas kWp, serviços, deslocamento |
| `.env` / Vercel | `GRONER_TENANT`, `GRONER_TOKEN`, origem/tipo opcional |

---

## Deploy separado por cliente

Cada pasta copiada = **repositório Git + projeto Vercel próprio**:

- `GRONER_TENANT` = tenant do cliente na Groner
- Domínio ou subdomínio próprio (ex.: `acme-propostas.vercel.app`)

---

## Referência MHZ

O projeto atual (`mhz-propostas`) já usa `config/cliente.json` com os valores MHZ. Use como referência ao preencher outro cliente.
