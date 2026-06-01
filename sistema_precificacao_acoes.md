# Sistema de Precificação — Ações e Funcionalidades

> Documento de levantamento funcional do sistema de gestão e monitoramento solar.  
> Versão 1.0 · 25/05/2026

---

## 1. Cadastro de Clientes

Ações necessárias para gerenciar os dados dos clientes no sistema.

- **Criar cliente** — cadastrar nome, CPF/CNPJ, telefone, e-mail, endereço e tipo (residencial / comercial / industrial)
- **Editar cliente** — atualizar qualquer campo do cadastro
- **Inativar / reativar cliente** — controle de status sem excluir o histórico
- **Buscar cliente** — por nome, CPF/CNPJ ou número de contrato
- **Visualizar histórico** — ver contratos, serviços e propostas vinculados ao cliente
- **Exportar dados do cliente** — gerar ficha em PDF ou planilha

---

## 2. Cadastro de Usinas

Ações para registrar e gerenciar as usinas fotovoltaicas vinculadas aos clientes.

- **Criar usina** — informar potência (kWp), número de placas, inversor, localização (endereço + coordenadas), concessionária
- **Vincular usina ao cliente** — associação 1:N (um cliente pode ter múltiplas usinas)
- **Editar usina** — atualizar dados técnicos ou localização
- **Calcular distância** — a partir do CEP da usina até a base da empresa (em km), para aplicação da tabela de deslocamento
- **Inativar usina** — manter histórico sem cobranças ativas
- **Registrar troca de titularidade** — atualizar responsável legal e emitir cobrança do serviço

---

## 3. Gestão de Planos

Ações para contratar, alterar e cancelar planos mensais.

- **Selecionar plano** — Basic, Padrão ou Premium
- **Calcular mensalidade automaticamente** — com base na faixa de kWp da usina cadastrada
- **Ativar contrato de plano** — gerar contrato com data de início, vigência e forma de pagamento
- **Alterar plano** — upgrade ou downgrade com recálculo proporcional
- **Cancelar plano** — registrar data de saída e motivo
- **Aplicar desconto de plano nos serviços avulsos** — lógica automática ao vincular serviço a cliente com plano ativo
- **Exibir comparativo de planos** — tela de seleção com coberturas e preços por faixa kWp
- **Exibir alerta "sob consulta"** — para usinas acima de 50 kWp ou clientes comerciais/industriais

---

## 4. Precificação Dinâmica

Ações da engine de cálculo de preços.

- **Calcular preço por faixa kWp** — buscar na tabela o valor correspondente à faixa da usina
- **Aplicar taxa de deslocamento** — conforme tabela de km:
  - 0–50 km → isento
  - 50–200 km → R$ 2,40/km (base 1,50 + 60%)
  - 200–400 km → R$ 3,20/km (base 2,00 + 60%)
  - 400–600 km → R$ 4,00/km (base 2,50 + 60%)
  - acima de 600 km → a combinar (flag manual)
- **Aplicar desconto de plano nos serviços** — substituir preço "fora do plano" pelo "com plano" automaticamente
- **Recalcular ao mudar kWp** — atualizar preços em tempo real na tela de proposta
- **Validar faixas** — bloquear criação se kWp não se encaixar em nenhuma faixa e acionar fluxo "sob consulta"
- **Calcular seguro** — 2% do valor do contrato (sem plano) ou 1,5% (com plano)
- **Calcular manutenção preventiva** — R$ 32,00 ou R$ 25,00 × número de placas

---

## 5. Serviços Avulsos

Ações para registrar e cobrar serviços fora da mensalidade do plano.

| Serviço | Sem Plano | Com Plano |
|---|---|---|
| Manutenção preventiva | R$ 32,00/placa | R$ 25,00/placa |
| Seguro | 2% do contrato | 1,5% do contrato |
| Manutenção corretiva | R$ 320,00 | R$ 290,00 |
| Troca de titularidade | R$ 150,00 | R$ 130,00 |
| Alteração de percentual | R$ 120,00 | R$ 100,00 |
| Config. wifi presencial | R$ 320,00 | R$ 290,00 |
| Config. wifi remota | R$ 150,00 | R$ 130,00 |
| Visita técnica para laudo | R$ 350,00 | R$ 310,00 |
| Acionamento de garantia | R$ 480,00 | R$ 430,00 |

Ações sobre serviços avulsos:

- **Solicitar serviço avulso** — abrir chamado vinculado à usina e ao cliente
- **Aplicar tabela correta** — verificar se cliente possui plano ativo e usar coluna correta
- **Registrar deslocamento no chamado** — calcular custo extra de km para serviços presenciais
- **Aprovar orçamento** — cliente confirma antes da execução (fluxo de aprovação)
- **Registrar execução** — data, técnico responsável, observações
- **Emitir cobrança** — gerar fatura avulsa ou incluir na próxima recorrência
- **Cancelar chamado** — com motivo e sem cobrança se não executado

---

## 6. Geração de Propostas

Ações para criar, enviar e gerenciar propostas comerciais.

- **Criar proposta** — a partir dos dados da usina, plano selecionado e serviços avulsos
- **Calcular totais automaticamente** — mensalidade + serviços + deslocamento
- **Gerar número de proposta** — sequencial com ano (ex: 2026-0001)
- **Exportar proposta em PDF** — layout formatado pronto para envio
- **Exportar proposta em HTML** — versão navegável
- **Enviar proposta por e-mail** — integração com cliente de e-mail ou SMTP
- **Definir validade da proposta** — padrão 15 dias, configurável
- **Aprovar proposta** — cliente aceita → contrato gerado automaticamente
- **Reprovar / renegociar proposta** — fluxo de edição e reenvio
- **Versionar proposta** — histórico de versões caso haja alterações

---

## 7. Contratos

Ações para formalizar e acompanhar contratos ativos.

- **Gerar contrato** — a partir de proposta aprovada
- **Assinar digitalmente** — integração com plataforma de assinatura (ex: DocuSign, ClickSign)
- **Registrar data de início e vigência** — controle de ciclo de vida
- **Renovar contrato** — automático ou manual com notificação
- **Encerrar contrato** — data de término e motivo
- **Armazenar contrato assinado** — repositório por cliente/usina

---

## 8. Faturamento e Cobranças

Ações do módulo financeiro.

- **Gerar cobrança recorrente** — mensalidade do plano todo mês na data definida
- **Gerar cobrança avulsa** — para serviços pontuais
- **Emitir boleto / PIX / link de pagamento**
- **Registrar pagamento** — manual ou via webhook do gateway
- **Controlar inadimplência** — alertas automáticos por dias de atraso
- **Emitir nota fiscal** — NFS-e integrada ou manual
- **Aplicar reajuste** — percentual sobre a mensalidade (anual ou por contrato)
- **Exportar relatório financeiro** — receita por período, inadimplência, serviços mais cobrados

---

## 9. Relatórios e Exportações

Ações de inteligência e dados do sistema.

- **Relatório de clientes ativos por plano** — filtrado por tipo, faixa kWp e região
- **Relatório de receita mensal recorrente (MRR)**
- **Relatório de serviços mais solicitados**
- **Relatório de propostas por status** — criadas, aprovadas, expiradas
- **Relatório de deslocamentos** — custo por região e técnico
- **Exportar qualquer listagem em CSV/XLSX**
- **Exportar proposta em PDF**
- **Exportar ficha do cliente em PDF**

---

## 10. Configurações do Sistema

Ações administrativas para manter as tabelas e regras atualizadas.

- **Editar tabela de preços por faixa kWp** — por plano (Basic, Padrão, Premium)
- **Editar tabela de deslocamento por km**
- **Editar tabela de serviços avulsos** — preços com e sem plano
- **Cadastrar usuários internos** — técnicos, vendedores, administradores
- **Definir permissões por perfil** — quem pode criar proposta, aprovar, emitir cobrança etc.
- **Configurar e-mail e notificações** — alertas de proposta expirada, inadimplência, chamado aberto
- **Configurar validade padrão de propostas**
- **Configurar base de distância (CEP de origem)** — para cálculo automático de km
- **Ativar / desativar planos disponíveis** — para períodos de campanha ou reajuste

---

## 11. Fluxos de Status

Mapeamento dos estados possíveis de cada entidade principal.

### Proposta
```
Rascunho → Enviada → Aguardando aprovação → Aprovada → Contrato gerado
                                          → Reprovada → Renegociação
                  → Expirada
```

### Chamado de Serviço
```
Aberto → Orçamento enviado → Aprovado → Em execução → Concluído → Faturado
                           → Reprovado → Cancelado
```

### Contrato
```
Ativo → Renovado → Encerrado
      → Inadimplente → Suspenso → Reativado / Cancelado
```

---

## 12. Integrações Necessárias

Serviços externos que o sistema deve se conectar.

- **Gateway de pagamento** — geração de boleto, PIX e cartão (ex: Asaas, Stripe, Pagar.me)
- **SMTP / e-mail** — envio de propostas, cobranças e notificações
- **Assinatura digital** — formalização de contratos (ex: DocuSign, ClickSign, ZapSign)
- **NFS-e** — emissão de nota fiscal de serviço (API da prefeitura ou via NFe.io)
- **Google Maps / CEP API** — cálculo automático de distância entre usina e base
- **Inversor / monitoramento** — leitura de dados de geração (Fronius, Growatt, SolarEdge etc.) para alertas automáticos de falha

---

*Documento gerado em 25/05/2026 · Sistema de Precificação Solar v1.0*
