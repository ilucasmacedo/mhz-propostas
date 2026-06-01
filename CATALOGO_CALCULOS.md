# Catálogo de Cálculos — Sistema MHZ

> Documento de referência externa com **todas as variáveis, valores fixos, tabelas e fórmulas** do sistema de precificação.  
> Fonte de dados estruturada: [`config/precificacao.json`](config/precificacao.json)  
> Versão 1.0 · 29/05/2026

---

## Como usar este documento

| Finalidade | Onde olhar |
|------------|------------|
| Ver o que precisa ser preenchido na proposta | [§ 1 — Entradas](#1-entradas-variáveis-do-usuário) |
| Ver valores fixos e limites do sistema | [§ 2 — Constantes](#2-constantes-e-limites) |
| Consultar tabelas de preço | [§ 3–5 — Tabelas](#3-planos) |
| Entender as fórmulas | [§ 6 — Fórmulas](#6-fórmulas-de-cálculo) |
| Validar resultados | [§ 7 — Casos de teste](#7-casos-de-teste) |
| Importar para banco/planilha | Arquivo JSON em `config/precificacao.json` |
| Implementar cálculos no CRM | [`crm-painel.html`](crm-painel.html) (espelho 1:1) · [`GUIA_CRM_CAMPOS.md`](GUIA_CRM_CAMPOS.md) · `config/crm-calculos.json` |

---

## 1. Entradas (variáveis do usuário)

Valores que **precisam ser informados** para calcular uma proposta.

| Código | Nome | Tipo | Default | Obrigatório | Usado em |
|--------|------|------|---------|-------------|----------|
| `kwp` | Potência da usina | decimal (kWp) | 8,5 | Sim | Mensalidade, faixa kWp |
| `plano` | Plano selecionado | enum | NENHUM | Sim | Mensalidade, desconto avulso |
| `distancia_km` | Distância usina → base | decimal (km) | 35 | Sim | Deslocamento |
| `qtd_placas` | Quantidade de placas | inteiro | 16 | Não* | Manutenção preventiva |
| `valor_contrato` | Valor do contrato | R$ | 0 | Não* | Seguro |
| `valor_investimento` | Valor do investimento | R$ | 0 | Não | Taxa sobre investimento |
| `servicos_selecionados` | Serviços avulsos | lista | [] | Não | Total avulsos |

\* Obrigatório quando o serviço correspondente estiver selecionado.

### Opções de enum

**Plano (`plano`):**
- `NENHUM` — Sem plano recorrente
- `ACESSO` — Plano Acesso (Basic)
- `PADRAO` — Plano Padrão
- `PREMIUM` — Plano Premium

### Entradas internas (não expostas na UI hoje)

| Código | Default | Descrição |
|--------|---------|-----------|
| `percentual_investimento` | 4,5% | Taxa sobre investimento (faixa permitida: 4–5%) |
| `tem_plano_ativo` | false | Cliente já possui plano ativo |
| `incluir_deslocamento_global` | true | Soma deslocamento como item separado |

---

## 2. Constantes e limites

### Valores fixos do sistema

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `validade_proposta_dias` | **15** | Validade da proposta comercial (PDF) |
| `percentual_investimento_padrao` | **4,5%** | Taxa padrão sobre investimento |
| `raio_base_km` | **50 km** | Raio incluído na mensalidade dos planos |
| `kwp_maximo_automatico` | **50 kWp** | Acima disso → mensalidade sob consulta |
| `distancia_maxima_automatica` | **600 km** | Acima disso → deslocamento a combinar |
| `reajuste_deslocamento` | **× 1,60 (+60%)** | Multiplicador sobre bases 1,50 / 2,00 / 2,50 |
| `casas_decimais_moeda` | **2** | Arredondamento half-up |

### Limites e flags

| Condição | Limite | Efeito |
|----------|--------|--------|
| `kwp > 50` | 50 kWp | Mensalidade **sob consulta** |
| `distancia_km > 600` | 600 km | Deslocamento **a combinar** |
| `distancia_km ≤ 50` | 50 km | Deslocamento = **R$ 0** |

---

## 3. Planos

| Código | Nome | Desconto em avulsos | Observação |
|--------|------|---------------------|------------|
| `ACESSO` | Plano Acesso | Não | Preço cheio nos serviços avulsos |
| `PADRAO` | Plano Padrão | Sim | Usa coluna "Com plano" |
| `PREMIUM` | Plano Premium | Sim | Usa coluna "Com plano" |
| `NENHUM` | Sem plano | Não | Sem mensalidade recorrente |

**Regra de desconto avulso:**
```
usar_preco_com_plano =
  plano ∈ { PADRAO, PREMIUM }
  E (cliente tem plano ativo OU plano contratado com mensalidade calculável)
```

---

## 4. Tabela — Mensalidade por faixa de kWp

Valores em **R$/mês**. Regra de intervalo: **(min, max]** — limite inferior exclusivo.

| Faixa kWp | Acesso | Padrão | Premium | Sob consulta |
|-----------|--------|--------|---------|--------------|
| 0 a 5 | R$ 9,90 | R$ 39,90 | R$ 59,90 | — |
| 5 a 10 | R$ 14,90 | R$ 49,90 | R$ 89,90 | — |
| 10 a 15 | R$ 19,90 | R$ 59,90 | R$ 119,90 | — |
| 15 a 20 | R$ 24,90 | R$ 69,90 | R$ 149,90 | — |
| 20 a 25 | R$ 29,90 | R$ 79,90 | R$ 179,90 | — |
| 25 a 30 | R$ 34,90 | R$ 89,90 | R$ 209,90 | — |
| 30 a 35 | R$ 39,90 | R$ 99,90 | R$ 239,90 | — |
| 35 a 40 | R$ 44,90 | R$ 109,90 | R$ 269,90 | — |
| 40 a 45 | R$ 49,90 | R$ 119,90 | R$ 299,90 | — |
| 45 a 50 | R$ 54,90 | R$ 129,90 | R$ 329,90 | — |
| Acima de 50 | — | — | — | **Sim** |

**Exemplos de faixa:**
- kWp = 5 → faixa 0–5 (R$ 9,90 no Acesso)
- kWp = 5,01 → faixa 5–10
- kWp = 50 → faixa 45–50
- kWp = 50,01 → sob consulta

**Fórmula:**
```
mensalidade = tabela_faixas_kwp[faixa(kwp)].precos[plano]
```

---

## 5. Tabelas — Deslocamento e serviços avulsos

### 5.1 Taxa de deslocamento por distância

Taxa aplicada sobre **km excedentes aos 50 km**. Distância arredondada para cima (`ceil`).

| Faixa km | Taxa (R$/km) | Base de referência | Reajuste |
|----------|--------------|--------------------|----------|
| 0 a 50 | R$ 0,00 | — | Isento |
| 50 a 200 | R$ 2,40 | R$ 1,50 | +60% |
| 200 a 400 | R$ 3,20 | R$ 2,00 | +60% |
| 400 a 600 | R$ 4,00 | R$ 2,50 | +60% |
| Acima de 600 | — | — | A combinar |

**Fórmula:**
```
km = ceil(distancia_km)
km_excedente = km - 50
valor = km_excedente × taxa_da_faixa(km)
```

**Exemplo:** km = 120 → faixa 50–200, taxa 2,40 → 70 × 2,40 = **R$ 168,00**

### 5.2 Serviços avulsos

| Código | Descrição | Fora do plano | Com plano | Tipo | Presencial |
|--------|-----------|---------------|-----------|------|------------|
| `MANUT_PREVENTIVA` | Manutenção preventiva | R$ 32,00/placa | R$ 25,00/placa | × placas | Sim |
| `SEGURO` | Seguro | 2% do contrato | 1,5% do contrato | % contrato | Não |
| `MANUT_CORRETIVA` | Manutenção corretiva | R$ 320,00 | R$ 290,00 | Fixo | Sim |
| `TROCA_TITULARIDADE` | Troca de titularidade | R$ 150,00 | R$ 130,00 | Fixo | Sim |
| `ALTERACAO_PERCENTUAL` | Alteração de percentual | R$ 120,00 | R$ 100,00 | Fixo | Não |
| `WIFI_PRESENCIAL` | Config. Wi-Fi presencial | R$ 320,00 | R$ 290,00 | Fixo | Sim |
| `WIFI_REMOTA` | Config. Wi-Fi remota | R$ 150,00 | R$ 130,00 | Fixo | Não |
| `VISITA_LAUDO` | Visita técnica para laudo | R$ 350,00 | R$ 310,00 | Fixo | Sim |
| `VISITA_GARANTIA` | Visita acionamento garantia | R$ 480,00 | R$ 430,00 | Fixo | Sim |

**Fórmulas por tipo:**

| Tipo | Fórmula |
|------|---------|
| FIXO | `preco = fora_plano ou com_plano` |
| POR_PLACA | `preco = unitário × qtd_placas` |
| PERCENTUAL | `preco = valor_contrato × percentual` |

---

## 6. Fórmulas de cálculo

### Fluxo completo da proposta

```
┌─────────────────────────────────────────────────────────┐
│                    ENTRADAS DO FORMULÁRIO               │
│  kwp · plano · distancia_km · serviços   │
│  qtd_placas · valor_contrato · valor_investimento       │
└────────────────────────┬────────────────────────────────┘
                         ▼
              ┌──────────────────────┐
              │  1. MENSALIDADE      │  ← tabela faixas kWp
              │     (se plano ≠ NENHUM)
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  2. SERVIÇOS AVULSOS │  ← tabela serviços
              │     (Σ selecionados) │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  3. DESLOCAMENTO     │  ← tabela km (global)
              │     (se km > 50)     │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  4. TAXA INVESTIMENTO│  ← valor × 4,5%
              │     (se > 0)         │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  TOTAIS              │
              │  recorrente = mensalidade
              │  avulsos = Σ itens 2+3+4
              │  1ª cobrança = recorrente + avulsos
              └──────────────────────┘
```

### Resumo das fórmulas

| # | Cálculo | Fórmula |
|---|---------|---------|
| 1 | Arredondamento | `round((valor + ε) × 100) / 100` |
| 2 | Mensalidade | `tabela[kwp][plano]` |
| 3 | Deslocamento | `max(0, ceil(km) - 50) × taxa_faixa` |
| 4 | Serviço fixo | `preco_base` |
| 5 | Serviço por placa | `preco_base × qtd_placas` |
| 6 | Seguro | `valor_contrato × 0,02 ou × 0,015` |
| 7 | Taxa investimento | `valor_investimento × 0,045` |
| 8 | Total avulsos | `Σ serviços + deslocamento + taxa investimento` |
| 9 | 1ª cobrança | `mensalidade + total_avulsos` |

### Ordem de aplicação

1. Faixa kWp → plano → tipo cliente (sob consulta?)
2. Desconto avulso (Padrão/Premium?)
3. Serviços selecionados
4. Deslocamento global
5. Taxa sobre investimento
6. Arredondamento final por linha e total

---

## 7. Casos de teste

### Mensalidade + deslocamento

| # | kWp | Plano | km | Mensalidade | Deslocamento |
|---|-----|-------|----|-------------|--------------|
| 1 | 4 | Acesso | 30 | R$ 9,90 | R$ 0 |
| 2 | 7 | Padrão | 100 | R$ 49,90 | R$ 120,00 (50 × 2,40) |
| 3 | 25 | Premium | 250 | R$ 179,90 | R$ 640,00 (200 × 3,20) |
| 4 | 55 | Padrão | 40 | Sob consulta | R$ 0 |
| 5 | 10 | Acesso | 650 | R$ 19,90 | A combinar |

### Serviços avulsos

| # | Serviço | Placas | Contrato | Com plano | Esperado |
|---|---------|--------|----------|-----------|----------|
| 6 | Manutenção preventiva | 20 | — | Não | R$ 640,00 |
| 7 | Manutenção preventiva | 20 | — | Sim | R$ 500,00 |
| 8 | Seguro | — | R$ 50.000 | Não | R$ 1.000,00 |
| 9 | Seguro | — | R$ 50.000 | Sim | R$ 750,00 |

---

## 8. Mapeamento para tabelas futuras

O arquivo `config/precificacao.json` está estruturado para importação direta em banco de dados ou planilha:

| Seção JSON | Tabela sugerida | Registros |
|------------|-----------------|-----------|
| `entradas` | `parametros_entrada` | 11 |
| `constantes` | `configuracoes` | 1 linha (chave-valor) |
| `limites` | `regras_limite` | 5 |
| `planos` | `planos` | 3 |
| `faixas_kwp` | `faixas_kwp` | 11 |
| `faixas_deslocamento` | `faixas_deslocamento` | 5 |
| `servicos_avulsos` | `servicos_avulsos` | 9 |
| `formulas` | `formulas_calculo` | 12 |
| `casos_teste` | `casos_teste` | 9 |

### Exemplo de consulta SQL futura

```sql
-- Mensalidade para usina de 8 kWp no plano Padrão
SELECT precos->>'PADRAO' AS mensalidade
FROM faixas_kwp
WHERE 8 > kwp_min AND 8 <= kwp_max;
-- Resultado: 49.90
```

---

## 9. Relação com outros arquivos

| Arquivo | Papel |
|---------|-------|
| `config/precificacao.json` | **Dados** — tabelas, constantes, entradas (fonte para DB) |
| `src/pricing.js` | **Engine** — lógica de cálculo que consome os dados |
| `CATALOGO_CALCULOS.md` | **Visualização** — este documento |
| `sistema_precificacao_logica.md` | Especificação técnica detalhada |

---

*Documento gerado em 29/05/2026 · Catálogo de Cálculos MHZ v1.0*
