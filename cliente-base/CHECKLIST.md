# Checklist — Novo cliente Groner

## 1. Groner (CRM)

- [ ] Confirmar **tenant** (subdomínio): `https://{tenant}.groner.app`
- [ ] Gerar **token** Admin: `POST /api/Conta/GerarToken`
- [ ] Anotar **Origem** Pré-venda (id)
- [ ] Anotar **Tipo de projeto** Pré-venda (id)
- [ ] Mapear **campos personalizados** do negócio (kWp, PDF, descrição, etc.)
- [ ] Anotar **aba dinâmica** onde ficam os campos (geralmente `2`)

## 2. Config

- [ ] Preencher `config/cliente.json` (logo, site, e-mail)
- [ ] Preencher `config/groner-integracao.json`
- [ ] Ajustar `config/precificacao.json`
- [ ] Criar `.env` a partir de `cliente-base/.env.example`

## 3. Teste local

```bash
npm install
npm run dev:all
```

## 4. Deploy

- [ ] Repositório Git + Vercel separados
- [ ] Variáveis `GRONER_TENANT` e `GRONER_TOKEN`
