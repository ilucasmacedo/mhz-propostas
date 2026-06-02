# Cliente base — padrão para novos projetos

**Esta pasta contém só o que você precisa copiar/preencher por cliente.**  
O código do sistema fica na **raiz do repositório** (fora daqui).

## O que tem aqui

```
cliente-base/
  LEIA-ME.md                 ← este arquivo
  CHECKLIST.md               ← passo a passo Groner + deploy
  .env.example               ← GRONER_TENANT, GRONER_TOKEN
  config/
    cliente.json             ← marca, logo, site, textos da tela
    groner-integracao.json   ← tenant, origem, campos personalizados
    precificacao.json        ← planos, faixas kWp, serviços (starter)
```

## Como usar

### Opção A — Script automático (recomendado)

Na raiz do projeto MHZ (pasta `sistema`), rode:

```bash
npm run novo-cliente -- ^
  --dest "../../NovoCliente/sistema" ^
  --id acme ^
  --nome "ACME Energia Solar" ^
  --nome-curto ACME ^
  --tenant acmeenergiasolar ^
  --slug acme-propostas
```

Isso copia **todo o sistema** para a pasta destino e preenche os 3 JSONs + `.env.example`.

### Opção B — Manual

1. Duplique a pasta `sistema` inteira para o novo cliente
2. Copie os arquivos de `cliente-base/config/` → `config/` (substituindo)
3. Preencha os valores (tenant, logo, campos Groner, preços)
4. Copie `cliente-base/.env.example` → `.env` na raiz

## Onde fica cada coisa no projeto ativo

| Pasta/arquivo | Cliente |
|---------------|---------|
| `cliente-base/` | **Modelo vazio** (não mexe em produção) |
| `config/cliente.json` | MHZ ou outro — **valores em uso** |
| `config/groner-integracao.json` | Integração Groner em uso |
| `config/precificacao.json` | Preços/planos em uso |

## Referência MHZ

Veja `config/cliente.json` na raiz — exemplo preenchido da MHZ.
