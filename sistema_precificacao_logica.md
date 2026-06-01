# Sistema de Precificação — Dados, Regras e Lógica

> Especificação do modelo de precificação para implementação da engine de cálculo.  
> Fonte: planilha comercial oficial + `sistema_precificacao_acoes.md`  
> Versão 1.0 · 25/05/2026

---

## 1. Nomenclatura

| Nome na planilha | Alias no sistema | Código sugerido |
|------------------|------------------|-----------------|
| Plano Acesso     | Basic            | `ACESSO`        |
| Plano Padrão     | Padrão           | `PADRAO`        |
| Plano Premium    | Premium          | `PREMIUM`       |

Os três nomes referem-se ao **mesmo produto**. Usar **Plano Acesso** como nome canônico em telas e documentos; aceitar o alias `Basic` apenas em integrações legadas.

---

## 2. Tabelas de dados (seed)

### 2.1 Mensalidade por faixa de kWp

Valores em **R$/mês**, por usina. Aplicam-se a clientes no **raio de até 50 km** da base da empresa (ver § 3.2).

| `kwp_min` | `kwp_max` | Acesso | Padrão | Premium | `sob_consulta` |
|-----------|-----------|--------|--------|---------|----------------|
| 0         | 5         | 9,90   | 39,90  | 59,90   | false          |
| 5         | 10        | 14,90  | 49,90  | 89,90   | false          |
| 10        | 15        | 19,90  | 59,90  | 119,90  | false          |
| 15        | 20        | 24,90  | 69,90  | 149,90  | false          |
| 20        | 25        | 29,90  | 79,90  | 179,90  | false          |
| 25        | 30        | 34,90  | 89,90  | 209,90  | false          |
| 30        | 35        | 39,90  | 99,90  | 239,90  | false          |
| 35        | 40        | 44,90  | 109,90 | 269,90  | false          |
| 40        | 45        | 49,90  | 119,90 | 299,90  | false          |
| 45        | 50        | 54,90  | 129,90 | 329,90  | false          |
| 50        | null      | —      | —      | —       | **true**       |

**Regra de faixa (kWp):** usar intervalo **(min, max]** — limite inferior exclusivo, superior inclusivo.

- Ex.: `kWp = 5` → faixa `0–5` (R$ 9,90 no Acesso).
- Ex.: `kWp = 5,01` → faixa `5–10`.
- Ex.: `kWp > 50` → `sob_consulta = true` (sem valor automático).

```json
{
  "faixas_kwp": [
    { "kwp_min": 0,  "kwp_max": 5,  "precos": { "ACESSO": 9.90,  "PADRAO": 39.90,  "PREMIUM": 59.90  } },
    { "kwp_min": 5,  "kwp_max": 10, "precos": { "ACESSO": 14.90, "PADRAO": 49.90,  "PREMIUM": 89.90  } },
    { "kwp_min": 10, "kwp_max": 15, "precos": { "ACESSO": 19.90, "PADRAO": 59.90,  "PREMIUM": 119.90 } },
    { "kwp_min": 15, "kwp_max": 20, "precos": { "ACESSO": 24.90, "PADRAO": 69.90,  "PREMIUM": 149.90 } },
    { "kwp_min": 20, "kwp_max": 25, "precos": { "ACESSO": 29.90, "PADRAO": 79.90,  "PREMIUM": 179.90 } },
    { "kwp_min": 25, "kwp_max": 30, "precos": { "ACESSO": 34.90, "PADRAO": 89.90,  "PREMIUM": 209.90 } },
    { "kwp_min": 30, "kwp_max": 35, "precos": { "ACESSO": 39.90, "PADRAO": 99.90,  "PREMIUM": 239.90 } },
    { "kwp_min": 35, "kwp_max": 40, "precos": { "ACESSO": 44.90, "PADRAO": 109.90, "PREMIUM": 269.90 } },
    { "kwp_min": 40, "kwp_max": 45, "precos": { "ACESSO": 49.90, "PADRAO": 119.90, "PREMIUM": 299.90 } },
    { "kwp_min": 45, "kwp_max": 50, "precos": { "ACESSO": 54.90, "PADRAO": 129.90, "PREMIUM": 329.90 } },
    { "kwp_min": 50, "kwp_max": null, "sob_consulta": true }
  ]
}
```

### 2.2 Taxa de deslocamento por distância

Distância em **km** (rota ou linha reta — configurável; padrão: rota via API Maps).

| `km_min` | `km_max` | Taxa (R$/km) | Observação        |
|----------|----------|--------------|-------------------|
| 0        | 50       | 0            | Isento            |
| 50       | 200      | 2,40         | Base 1,50 + 60%   |
| 200      | 400      | 3,20         | Base 2,00 + 60%   |
| 400      | 600      | 4,00         | Base 2,50 + 60%   |
| 600      | null     | null         | **A combinar**    |

A taxa da faixa é aplicada sobre os **km excedentes aos 50 km** (ver fórmula em § 4.2).

**Reajuste vigente:** valores por km = tabela base × **1,60** (+60%).

### 2.3 Serviços avulsos

| Código                    | Descrição                              | Fora do plano      | Com plano ativo    | Tipo de cálculo   |
|---------------------------|----------------------------------------|--------------------|--------------------|-------------------|
| `MANUT_PREVENTIVA`        | Manutenção preventiva                  | R$ 32,00 / placa   | R$ 25,00 / placa   | × `qtd_placas`    |
| `SEGURO`                  | Seguro                                 | 2% do contrato     | 1,5% do contrato   | % `valor_contrato`|
| `MANUT_CORRETIVA`         | Manutenção corretiva                   | R$ 320,00          | R$ 290,00          | Fixo              |
| `TROCA_TITULARIDADE`      | Troca de titularidade                  | R$ 150,00          | R$ 130,00          | Fixo              |
| `ALTERACAO_PERCENTUAL`    | Alteração de percentual                | R$ 120,00          | R$ 100,00          | Fixo              |
| `WIFI_PRESENCIAL`         | Configuração de Wi-Fi presencial       | R$ 320,00          | R$ 290,00          | Fixo              |
| `WIFI_REMOTA`             | Configuração de Wi-Fi remota           | R$ 150,00          | R$ 130,00          | Fixo              |
| `VISITA_LAUDO`            | Visita técnica para laudo              | R$ 350,00          | R$ 310,00          | Fixo              |
| `VISITA_GARANTIA`         | Visita para acionamento de garantia    | R$ 480,00          | R$ 430,00          | Fixo              |

**Serviços presenciais** (podem somar deslocamento): `MANUT_PREVENTIVA`, `MANUT_CORRETIVA`, `WIFI_PRESENCIAL`, `VISITA_LAUDO`, `VISITA_GARANTIA`, `TROCA_TITULARIDADE` (quando exigir visita).

**Serviços remotos** (sem deslocamento): `WIFI_REMOTA`, `ALTERACAO_PERCENTUAL`.

### 2.4 Observações gerais (planilha OBS)

| Regra                    | Valor / comportamento                                      |
|--------------------------|------------------------------------------------------------|
| Taxa sobre investimento  | **4% a 5%** do valor do investimento da usina            |
| Raio base dos planos     | Mensalidade da tabela § 2.1 vale para usinas até **50 km** |
| Sob consulta (kWp)       | `kWp > 50` → preço manual, flag `sob_consulta`           |
| Sob consulta (cliente)   | Tipo **comercial** ou **industrial** → alerta + fluxo manual (mesmo com kWp ≤ 50) |
| Sob consulta (distância) | `km > 600` → flag `deslocamento_a_combinar`                |

A taxa de investimento (4–5%) é **independente** da mensalidade; usar percentual configurável no admin (padrão **4,5%** até definição comercial).

---

## 3. Regras de negócio

### 3.1 Plano ativo

Cliente **com plano ativo** quando existe contrato com:

- `status = ATIVO`
- `data_inicio <= hoje`
- `data_fim` nula ou `data_fim >= hoje`
- Vinculado à **mesma usina** do serviço/proposta

Com plano ativo → usar coluna **Com plano** na tabela § 2.3.

### 3.2 Mensalidade e distância

- A mensalidade (§ 2.1) **já pressupõe** usina até 50 km da base.
- Se `distancia_km > 50`, o sistema **não altera** a mensalidade automaticamente; o custo extra de deslocamento entra em **propostas/chamados** com serviço presencial ou item explícito de deslocamento (política comercial a confirmar para recorrência).

### 3.3 Sob consulta

Bloquear cálculo automático e exibir fluxo manual quando **qualquer** condição for verdadeira:

1. `kWp > 50`
2. `distancia_km > 600` (deslocamento)
3. Administrador marcou `forcar_sob_consulta` na proposta

Campos obrigatórios no fluxo manual: `valor_negociado`, `aprovado_por`, `motivo`.

### 3.4 Arredondamento

- Valores monetários: **2 casas decimais**, arredondamento **half-up** (`0,005` → `0,01`).
- Percentuais (seguro, investimento): calcular sobre valor bruto e arredondar o resultado final.
- Distância: usar **km inteiro** (arredondar para cima — `ceil`) para não subestimar deslocamento.

### 3.5 Recálculo em tempo real

Na tela de proposta, recalcular automaticamente quando alterar:

- `kWp`, `plano`, `distancia_km`, `qtd_placas`, lista de serviços, `valor_contrato`, `tem_plano_ativo`

---

## 4. Lógica de cálculo (engine)

### 4.1 Mensalidade do plano

```
ENTRADA: kWp, codigo_plano ∈ { ACESSO, PADRAO, PREMIUM }

faixa = buscar_faixa_kwp(kWp)   // regra (min, max] do § 2.1

SE faixa.sob_consulta:
  RETORNAR { sob_consulta: true, mensalidade: null }

mensalidade = faixa.precos[codigo_plano]
RETORNAR { sob_consulta: false, mensalidade }
```

### 4.2 Deslocamento

```
ENTRADA: distancia_km (inteiro, ceil)

SE distancia_km <= 50:
  RETORNAR { valor: 0, a_combinar: false }

SE distancia_km > 600:
  RETORNAR { valor: null, a_combinar: true }

faixa = faixa cuja distancia_km está em (km_min, km_max]
km_excedente = distancia_km - 50
valor = km_excedente × faixa.taxa_por_km

RETORNAR { valor, a_combinar: false, km_excedente, taxa: faixa.taxa_por_km }
```

**Exemplo:** `distancia_km = 120` → faixa 50–200, taxa 2,40 → `km_excedente = 70` → `70 × 2,40 = R$ 168,00`.

### 4.3 Serviço avulso

```
ENTRADA: codigo_servico, tem_plano_ativo, qtd_placas?, valor_contrato?

tabela = § 2.3
preco_base = tem_plano_ativo ? tabela.com_plano : tabela.fora_plano

SWITCH tipo_calculo:
  FIXO:           valor = preco_base
  POR_PLACA:      valor = preco_base × qtd_placas
  PERCENTUAL:     valor = valor_contrato × preco_base   // 0.02 ou 0.015

SE servico.presencial E distancia informada:
  valor += calcular_deslocamento(distancia_km).valor

RETORNAR valor
```

### 4.4 Taxa sobre investimento

```
ENTRADA: valor_investimento, percentual ∈ [4, 5]  // default config: 4.5

valor = valor_investimento × (percentual / 100)
RETORNAR arredondar(valor)
```

### 4.5 Total da proposta

```
mensalidade     = calcular_mensalidade(kWp, plano)     // pode ser null se sob consulta
servicos        = Σ calcular_servico_avulso(...)       // itens selecionados
deslocamento    = calcular_deslocamento(km)            // se item global ou serviços sem km próprio
taxa_investimento = calcular_taxa_investimento(...)    // se aplicável na proposta

total_avulsos   = servicos + deslocamento + taxa_investimento
total_mensal    = mensalidade                          // recorrente (exibir separado)
total_primeira  = total_mensal + total_avulsos         // primeira cobrança / proposta

RETORNAR {
  mensalidade_recorrente: total_mensal,
  total_avulsos,
  total_primeira_cobranca: total_primeira,
  sob_consulta: flags agregadas
}
```

**Ordem de aplicação:** faixa kWp → plano → plano ativo (serviços) → deslocamento por serviço/global → percentuais (seguro, investimento) → arredondamento final por linha e total.

---

## 5. Entradas obrigatórias por contexto

| Contexto           | Campos mínimos                                                                 |
|--------------------|--------------------------------------------------------------------------------|
| Proposta com plano | `kWp`, `plano`, CEP/coords usina, `cep_base` empresa           |
| Serviço preventiva | `qtd_placas`, `tem_plano_ativo`                                                |
| Seguro             | `valor_contrato`, `tem_plano_ativo`                                            |
| Serviço presencial | `distancia_km` (ou CEP usina + base para calcular)                             |
| Sob consulta       | `valor_negociado`, aprovador, motivo                                           |

---

## 6. Configurações administráveis

Devem ser editáveis pelo módulo **Configurações** (sem deploy):

| Chave                         | Padrão              | Descrição                              |
|-------------------------------|---------------------|----------------------------------------|
| `cep_base_empresa`            | —                   | Origem do cálculo de distância         |
| `percentual_investimento`     | 4,5                 | Entre 4 e 5 (%)                        |
| `validade_proposta_dias`      | 15                  | Expiração da proposta                  |
| `faixas_kwp`                  | § 2.1               | Tabela completa                        |
| `faixas_deslocamento`         | § 2.2               | Tabela completa                        |
| `servicos_avulsos`            | § 2.3               | Preços e tipos                         |
| `planos_habilitados`          | Acesso, Padrão, Premium | Campanhas / reajuste              |

---

## 7. Saídas da engine (para API / UI)

```typescript
// Contrato de resposta sugerido (referência)

interface ResultadoPrecificacao {
  sob_consulta: boolean;
  motivos_sob_consulta: string[];  // ex: ["KWP_ACIMA_50"]

  mensalidade: number | null;
  faixa_kwp: { min: number; max: number | null; label: string } | null;
  plano: 'ACESSO' | 'PADRAO' | 'PREMIUM';

  itens: Array<{
    tipo: 'MENSALIDADE' | 'SERVICO' | 'DESLOCAMENTO' | 'INVESTIMENTO';
    codigo: string;
    descricao: string;
    quantidade?: number;
    unitario?: number;
    subtotal: number;
  }>;

  deslocamento: {
    km: number;
    km_excedente: number;
    taxa_por_km: number | null;
    valor: number | null;
    a_combinar: boolean;
  } | null;

  totais: {
    recorrente_mensal: number | null;
    avulsos: number;
    primeira_cobranca: number | null;
  };
}
```

---

## 8. Casos de teste (referência)

| # | kWp | Plano   | km  | Plano ativo | Esperado mensalidade | Deslocamento      |
|---|-----|---------|-----|-------------|----------------------|-------------------|
| 1 | 4   | Acesso  | 30  | —           | R$ 9,90              | R$ 0              |
| 2 | 7   | Padrão  | 100 | —           | R$ 49,90             | 50 × 2,40 = R$ 120 |
| 3 | 25  | Premium | 250 | sim         | R$ 179,90            | 200 × 3,20 = R$ 640 |
| 4 | 55  | Padrão  | 40  | —           | sob consulta         | —                 |
| 5 | 10  | Acesso  | 650 | —           | R$ 19,90             | a combinar        |

| # | Serviço           | Placas | Contrato   | Com plano | Esperado        |
|---|-------------------|--------|------------|------------|-----------------|
| 6 | MANUT_PREVENTIVA  | 20     | —          | não        | 20 × 32 = R$ 640|
| 7 | MANUT_PREVENTIVA  | 20     | —          | sim        | 20 × 25 = R$ 500|
| 8 | SEGURO            | —      | R$ 50.000  | não        | R$ 1.000        |
| 9 | SEGURO            | —      | R$ 50.000  | sim        | R$ 750          |

---

## 9. Pendências comerciais (validar com negócio)

1. **Deslocamento na mensalidade recorrente:** usina a 80 km paga só avulso ou também acréscimo fixo na mensalidade?
2. **km > 600:** fórmula parcial até 600 + complemento manual, ou 100% manual?
3. **Limites de faixa kWp:** confirmar se `kWp = 0` é permitido no cadastro.
4. **Taxa 4–5%:** incide na proposta inicial, no contrato total ou só em upsell de equipamento?
5. **Upgrade/downgrade de plano:** fórmula de proporcional (dias restantes no ciclo).

Até validação, implementar conforme este documento e registrar decisão nas configurações.

---

## 10. Relação com outros documentos

| Arquivo                         | Conteúdo                                      |
|---------------------------------|-----------------------------------------------|
| `sistema_precificacao_acoes.md` | O que o sistema **faz** (funcionalidades)       |
| `sistema_precificacao_logica.md`| **Como calcular** (este arquivo)              |

---

*Documento gerado em 25/05/2026 · Engine de Precificação Solar v1.0*
