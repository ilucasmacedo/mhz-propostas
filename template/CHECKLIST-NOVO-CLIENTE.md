# Checklist — Novo cliente Groner

## 1. Groner (CRM)

- [ ] Confirmar **tenant** (subdomínio): `https://{tenant}.groner.app`
- [ ] Gerar **token** Admin: `POST /api/Conta/GerarToken`
- [ ] Anotar **Origem** Pré-venda (id)
- [ ] Anotar **Tipo de projeto** Pré-venda (id)
- [ ] Mapear **campos personalizados** do negócio (kWp, PDF, descrição, etc.)
- [ ] Anotar **aba dinâmica** onde ficam os campos (geralmente `2`)

## 2. Config local

- [ ] Rodar `criar-projeto-cliente.mjs` ou copiar pasta manualmente
- [ ] Preencher `config/cliente.json` (logo, site, e-mail)
- [ ] Preencher `config/groner-integracao.json`
- [ ] Ajustar `config/precificacao.json` (planos e preços do produto)
- [ ] Criar `.env` a partir de `.env.example`

## 3. Teste local

```bash
npm install
npm run dev:all
```

- [ ] Busca Lead/Projeto na Groner
- [ ] Gerar PDF + sync campos
- [ ] Gerar projeto novo (mesmo contato)

## 4. Deploy

- [ ] Repositório Git novo (ou monorepo)
- [ ] Vercel: `GRONER_TENANT`, `GRONER_TOKEN`
- [ ] Logo acessível por URL (S3 Groner ou CDN)

## 5. Produto / precificação

- [ ] Planos e faixas kWp no Admin ou JSON
- [ ] Serviços avulsos e coberturas
- [ ] Playbook (se usar) — editar conteúdo em `src/playbook.js`
