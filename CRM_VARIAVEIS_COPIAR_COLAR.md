# CRM — Variáveis para copiar e colar (v2 — espelho index.html)

> **Use o painel:** [`crm-painel.html`](crm-painel.html) — fórmulas completas com botão Copiar  
> Fonte: `pricing.js` · Planos: Acesso, Padrão, Premium · **Sem** Basic/Essencial inventados

---

## Entrada

```
[[CampoKwpProjeto]]                 Potência kWp
[[CampoQtdPlacasProjeto]]           Nº placas
[[CampoKmProjeto]]                  Distância km
[[CampoPlanoProjeto]]               NENHUM | ACESSO | PADRAO | PREMIUM
[[CampoValorInvestimentoProjeto]]   Valor investimento R$ (manual, se aplicável)
[[CampoValorContratoProjeto]]       Valor contrato seguro R$ (manual, se aplicável)
[[CampoServicosChecklistProjeto]]   Checklist 9 serviços
```

---

## Calculados (ordem)

```
[[CampoMensalidadeProjeto]]           Mensalidade R$/mês
[[CampoTemDescontoAvulsoProjeto]]     1 = desconto avulso ativo
[[CampoDeslocamentoProjeto]]          Taxa deslocamento
[[CampoTotalServicosAvulsosProjeto]]  Soma checklist
[[CampoTaxaInvestimentoProjeto]]      4,5% investimento
[[CampoTotalAvulsosProjeto]]          Serviços + desloc + taxa inv
[[CampoPrimeiraCobrancaProjeto]]      Mensalidade + avulsos
```

> Fórmulas NCalc completas: abra **crm-painel.html** → abas Calculados e Checklist.

---

## Deslocamento (referência rápida)

```
if([[CampoKmProjeto]] <= 50, 0, Round((Ceiling([[CampoKmProjeto]]) - 50) * if([[CampoKmProjeto]] <= 200, 2.4, if([[CampoKmProjeto]] <= 400, 3.2, 4)), 2))
```

---

## Tem desconto avulso

```
if([[CampoKwpProjeto]] > 50, 0, if([[CampoPlanoProjeto]] LIKE '%PADRAO%', 1, if([[CampoPlanoProjeto]] LIKE '%PREMIUM%', 1, 0)))
```

---

## Taxa investimento

```
if([[CampoValorInvestimentoProjeto]] > 0, Round([[CampoValorInvestimentoProjeto]] * 0.045, 2), 0)
```

---

## Primeira cobrança

```
[[CampoMensalidadeProjeto]] + [[CampoTotalAvulsosProjeto]]
```

---

## Checklist — opções exatas

1. Manutenção preventiva  
2. Seguro  
3. Manutenção corretiva  
4. Troca de titularidade  
5. Alteração de percentual  
6. Configuração Wi-Fi presencial  
7. Configuração Wi-Fi remota  
8. Visita técnica para laudo  
9. Visita para acionamento de garantia  

---

## Removido (não usar)

```
[[CampoLimpezaBaseProjeto]]
[[CampoPlanoBasicProjeto]]
[[CampoPlanoEssencialProjeto]]
[[CampoMonitoramentoGestaoBaseProjeto]]
[[CampoServicoTecnicoBaseProjeto]]
[[CampoAdMobProjeto]]          ← deslocamento é calculado direto, não campo separado de entrada
[[CampoTipoClienteProjeto]]    ← removido; sistema considera apenas residencial
```
