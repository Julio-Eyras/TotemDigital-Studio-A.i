# Intervalos de cobrança (mensal, quadrimestral, semestral, anual)

Documentação operacional e técnica — fonte única: `database/`, `backend/`, `frontend/`.

## Intervalos suportados

| Código | Rótulo | Meses por período |
|--------|--------|-------------------|
| `month` | Mensal | 1 |
| `four_month` | Quadrimestral | 4 |
| `semester` | Semestral | 6 |
| `year` | Anual | 12 |

## Onde se aplica

- **Planos** (`plans`): quatro preços + intervalo de referência; Stripe: quatro Price IDs.
- **Contratos de anunciante** (`subscriber_contracts.billing_interval` + valor negociado).
- **Contratos de publisher** (`publisher_contracts.subscription_interval`).
- **Assinaturas** (`subscriptions.billing_interval` + metadata).
- **Emissão de faturas de anunciante**: período ancorado em `subscriber_contracts.start_date` (`financialAdminService`).
- **Faturas de assinatura publisher** (modo Pro, sem Stripe ativo): `invoiceService` com valor do período completo.

## Upgrade em servidor já instalado

```bash
cd /caminho/TotemDigital
export PGPASSWORD='...'
export DB_NAME=smartsignage DB_USER=postgres DB_HOST=localhost

chmod +x scripts/apply-billing-interval-upgrades.sh
./scripts/apply-billing-interval-upgrades.sh
```

O script aplica de forma idempotente:

1. Bloco de upgrade em `part4` (planos, contratos, subscriptions, Stripe price columns).
2. `part17` (procedure `create_subscriber_with_contracts` com `billing_interval`).

Depois: rebuild/restart do backend e frontend.

## Stripe (obrigatório para checkout)

Por plano, criar no [Stripe Dashboard](https://dashboard.stripe.com) quatro **Prices** recorrentes e preencher em **Planos e acesso**:

- ID Preço Stripe (Mensal)
- ID Preço Stripe (Quadrimestral)
- ID Preço Stripe (Semestral)
- ID Preço Stripe (Anual)

Sem Price ID para o intervalo escolhido, o checkout retorna erro de configuração.

## Modo compacto vs Pro

| Modo | Faturas anunciante | Assinaturas publisher |
|------|--------------------|------------------------|
| **Compacto** | `FinancialBillingWorker` (cron) | Não usa publisher billing para gestores |
| **Pro** | Idem + painel completo | `InvoiceWorker` (se sem assinatura Stripe ativa) |

## Checklist de testes manuais

1. Plano com 4 preços distintos → salvar → tabela lista os quatro valores.
2. Novo contrato de anunciante (quadrimestral) com valor negociado ≠ plano → emitir fatura → valor e período corretos.
3. Editar contrato: mudar intervalo **não** apaga valor já preenchido.
4. Criar anunciante + contrato na mesma tela → no BD, `billing_interval` preenchido (não só `payment_terms`).
5. Checkout Stripe (se habilitado) com intervalo semestral → assinatura com `billing_interval` correto.

## Código de referência

- `backend/src/utils/billingIntervals.ts`
- `frontend/src/utils/billingIntervals.ts`
- Testes: `backend/src/__tests__/unit/utils/billingIntervals.test.ts`

## Histórico

- Removida cópia legada `client_v2/` (schema duplicado). Usar apenas `database/`.
