# Funil Groner — Operação pós vendas

Script local para criar a etapa **Operação pós vendas** e os 13 status de pós-venda na Groner.

> O **resultado da execução** fica em `docs/local/` (gitignored — não sobe para a Vercel).

---

## Pré-requisitos

1. Arquivo `.env` na raiz do projeto:

```env
GRONER_TENANT=mhzenergiasolar
GRONER_TOKEN=seu-token-jwt-aqui
```

2. Token com perfil **Administrador** (criar etapas e status).

---

## Executar

```powershell
cd "c:\Users\Lucas Macedo\Documents\CLIENTES GRONER\MHZ\sistema"
node scripts/groner-criar-funil-pos-vendas.mjs
```

O script é **idempotente**: se a etapa ou um status já existir (mesmo nome), reutiliza sem duplicar.

---

## O que é criado na Groner

### Etapa

| Nome | Cor |
|------|-----|
| Operação pós vendas | `#00B4D8` |

### Status (ordem)

1. Mês 1 - Acompanhamento inicial  
2. Mês 2 - Monitoramento padrão  
3. Mês 3 - Revisão trimestral  
4. Mês 4 - Verificar garantia  
5. Mês 5 - Monitoramento padrão  
6. Mês 6 - Verificar limpeza  
7. Mês 7 - Monitoramento padrão  
8. Mês 8 - Monitoramento padrão  
9. Mês 9 - Revisão trimestral  
10. Mês 10 - Verificar garantia  
11. Mês 11 - Limpeza anual  
12. Mês 12 - Renovação  
13. Enviado para Garantia  

---

## Arquivos gerados (após rodar o script)

| Arquivo | Conteúdo |
|---------|----------|
| `docs/local/groner-funil-pos-vendas.md` | Relatório legível com IDs da etapa e de cada status |
| `docs/local/groner-funil-pos-vendas.json` | JSON com IDs para uso em config/automação |

---

## Status da execução

**Pendente** — aguardando `.env` com `GRONER_TOKEN` neste ambiente.

Após executar, abra `docs/local/groner-funil-pos-vendas.md` para ver os IDs criados.

---

## Mover negócio para um status (manual)

```http
PUT https://mhzenergiasolar.api.groner.app/api/Projeto/{projetoId}
Content-Type: application/json
Authorization: Bearer {token}

{ "Propriedade": "StatusId", "Valor": "{statusId}" }
```
