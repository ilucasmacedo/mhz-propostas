# Guia CRM — Campos alinhados ao index.html

> **Fonte da verdade:** `src/pricing.js` + `config/precificacao.json`  
> **Painel copiar/colar:** [`crm-painel.html`](crm-painel.html) (fórmulas geradas automaticamente)  
> Versão 2.0 · 29/05/2026

---

## O que mudou (v2)

Removido do CRM tudo que **não existe** no sistema de proposta:

- Plano Basic / Plano Essencial  
- Limpeza Base, Monitoramento Gestão Base, Serviço Técnico Base  
- Termografia, Seguro Base (percentual fixo inventado)  
- Campos de conta de energia  

Planos oficiais: **NENHUM**, **ACESSO** (Basic), **PADRAO**, **PREMIUM**.

---

## Ordem de criação no CRM

```
1. Campos de entrada (7)
2. Mensalidade recorrente
3. Tem desconto avulso
4. Taxa de deslocamento
5. Total serviços avulsos (checklist)
6. Taxa sobre investimento
7. Total avulsos
8. Primeira cobrança
```

Abra o **crm-painel.html** → aba **Calculados** → copie nome, código, variável e fórmula de cada card.

---

## Campos de entrada

| Nome | Código | Variável | Tipo |
|------|--------|----------|------|
| Potência (kWp) | `Kwp` | `[[CampoKwpProjeto]]` | Número |
| Nº de placas | `QtdPlacas` | `[[CampoQtdPlacasProjeto]]` | Número |
| Distância da base (km) | `Km` | `[[CampoKmProjeto]]` | Número |
| Plano | `Plano` | `[[CampoPlanoProjeto]]` | Radio: NENHUM, ACESSO, PADRAO, PREMIUM |
| Valor do investimento (R$) | `ValorInvestimento` | `[[CampoValorInvestimentoProjeto]]` | Moeda (opcional) |
| Valor do contrato p/ seguro (R$) | `ValorContrato` | `[[CampoValorContratoProjeto]]` | Moeda (opcional) |
| Serviços adicionais | `ServicosChecklist` | `[[CampoServicosChecklistProjeto]]` | Checklist (9 opções) |

---

## Regras críticas (igual pricing.js)

### Mensalidade
- Tabela faixas kWp × plano (até 50 kWp)  
- **Sob consulta** → retorne `0` no CRM: kWp > 50  
- Plano **NENHUM** → mensalidade = 0  

### Deslocamento
- Isento até **50 km**  
- `valor = (ceil(km) - 50) × taxa`  
- Faixas: 51–200 → R$ 2,40/km · 201–400 → R$ 3,20/km · 401+ → R$ 4,00/km  

### Desconto em serviços avulsos
- **Acesso** e **sem plano** → preço cheio (fora_plano)  
- **Padrão** e **Premium** + kWp ≤ 50 → preço com_plano  

### Campo Plano (radio) — texto completo
O CRM **não retorna só o código** (`ACESSO`) — devolve a **string completa** da opção (ex.: `Plano Acesso`, `ACESSO`, etc.).  
Por isso as fórmulas usam:

```
[[CampoPlanoProjeto]] LIKE '%Acesso%'
```

Isso significa: *“o texto que veio do campo contém ‘Acesso’?”* — funciona com string parcial ou completa.  
Palavras-chave usadas: Acesso/Basic, Padrão/Padrao, Premium, Sem plano/Nenhum.

### Primeira cobrança
```
mensalidade + serviços_avulsos + deslocamento + taxa_investimento
```

---

## Checklist — 9 serviços (mesmos do index.html)

1. Manutenção preventiva  
2. Seguro  
3. Manutenção corretiva  
4. Troca de titularidade  
5. Alteração de percentual  
6. Configuração Wi-Fi presencial  
7. Configuração Wi-Fi remota  
8. Visita técnica para laudo  
9. Visita para acionamento de garantia  

Use **1 campo Checklist** + **1 fórmula** com `[[CampoServicosChecklistProjeto]] LIKE '%palavra%'`.  
Detalhes e fórmula completa na aba **Checklist** do painel.

---

## Casos de teste

Valide no painel (aba **Validador**) ou no index.html:

| kWp | Plano | km | Mensalidade | Deslocamento | 1ª cobrança |
|-----|-------|-----|-------------|--------------|-------------|
| 8,5 | Acesso | 80 | R$ 14,90 | R$ 72,00 | R$ 86,90 |
| 7 | Padrão | 100 | R$ 49,90 | R$ 120,00 | R$ 169,90 |
| 4 | Acesso | 30 | R$ 9,90 | R$ 0 | R$ 9,90 |

---

## Referência

- Catálogo completo: [`CATALOGO_CALCULOS.md`](CATALOGO_CALCULOS.md)  
- Dados JSON CRM: [`config/crm-calculos.json`](config/crm-calculos.json)  
- Engine JS: [`src/crm-calculos.js`](src/crm-calculos.js) → reexporta `pricing.js`
