# Checklist de smoke manual — Smart Signage Studio (staging)

> **Roteiro manual completo (todos os módulos):** [ROTEIRO_TESTES_MANUAIS_INTEGRAIS.md](./ROTEIRO_TESTES_MANUAIS_INTEGRAIS.md)  
> Este ficheiro é o **smoke rápido** pós-deploy; use o roteiro integral para homologação de release.

Use após `git pull` na branch `Smart-Signage-Studio-V3x`, aplicar schema/seeds se faltar colunas novas, e rebuild com:

- **Frontend:** `REACT_APP_TOTEMDIGITAL_COMPACT=true`
- **Backend:** `TOTEMDIGITAL_COMPACT=true`

---

## 1. Pré-requisitos (servidor)

- [ ] Backend e frontend rebuildados e serviços reiniciados
- [ ] Postgres com schema atualizado (`is_system_owner`, `installation.profile`, `price_four_month`, `price_semester`, `billing_interval` em contratos anunciante e exibidor; `publisher_billing.contract_id` / `period_start` / `period_end`)
- [ ] Seed v6 aplicado: admin com `publisher_id` do exibidor owner
- [ ] `.env` backend: `TOTEMDIGITAL_COMPACT=true`, SMTP configurado, `FINANCIAL_*` (PIX, `FINANCIAL_PUBLIC_APP_URL`, `FINANCIAL_WORKER_ENABLED=true`, `FINANCIAL_AUTO_REVENUE_SHARE=true` em Studio)
- [ ] Logs do backend ao arrancar: mensagem **Smart Signage Studio** e `Perfil de instalação ativo: single_publisher`

---

## 2. Login e segurança

- [ ] Tela de login **sem** credenciais padrão expostas (`admin` / `admin123`)
- [ ] Login com utilizador admin/owner funciona
- [ ] Nome da app: **Smart Signage Studio** (ou equivalente no título)

---

## 3. Perfil Studio (API / UI)

- [ ] `GET /api/dashboard/ui-context` → `totemDigitalCompact: true`, `installationProfile: single_publisher`, `capabilities.publisherBillingForAdmins: true`
- [ ] `GET /health` → `studioMode: true`, `profile: smart-signage-studio`
- [ ] Menu dono/admin inclui **Faturamento** com **Anunciantes** e **Exibidores**
- [ ] Menu inclui **Contratos (Exibidores)** ou atalho equivalente
- [ ] SmartDisplayFX **não** aparece no menu (código preservado, feature off no compacto)

---

## 4. Planos e intervalos

- [ ] **Planos & Acessos** → criar/editar plano com preços: Mensal, Quadrimestral, Semestral, Anual (pelo menos um obrigatório)
- [ ] **Intervalo de referência** só lista intervalos com preço
- [ ] Campos **ID Preço Stripe** aparecem **só** para intervalos com preço no plano
- [ ] Plano com contratos vinculados: preços/recursos congelados (mensagem de bloqueio)

---

## 5. Contratos de anunciante

- [ ] **Editar anunciante** → aba Contratos: intervalo Mensal / Quadrimestral / Semestral / Anual
- [ ] Ao escolher plano + intervalo, **valor acordado** preenche com preço do plano
- [ ] Valor acordado pode ser alterado (negociação)
- [ ] Data fim recalcula ao mudar início ou intervalo (não fica preso a 31/12)
- [ ] Gravar contrato e reabrir: `billing_interval` e valor persistidos

---

## 6. Contratos de exibidor

- [ ] Criar/editar contrato de exibidor com intervalo e datas alinhadas (mínimo por período, padrão +1 ano)
- [ ] **Repasse / revenue share** configurável no fluxo de exibidor
- [ ] Emissão automática gera fatura **incoming** para contrato exibidor com `subscription_amount` (FinancialBillingWorker)

---

## 7. Faturamento (UI)

- [ ] **Faturamento** → Visão geral (`/billing` ou `?view=plans`) carrega KPIs/planos sem travar
- [ ] Painel: KPIs **Repasse pendente** e **Campanhas pagas sem repasse**; clique filtra faturas exibidor `revenue_share` / `pending_payout`
- [ ] Tabela anunciantes: colunas **Contrato** e **Período** (faturas por contrato recorrente)
- [ ] Tabela exibidor: ação **Marcar repasse como pago** em linhas `outgoing` + `pending_payout`
- [ ] **Anunciantes** (`?view=invoices&type=subscriber`) lista faturas com paginação
- [ ] **Exibidores** (`type=publisher`) acessível para admin/owner (**não** bloqueado por guard antigo)
- [ ] Seletor de tipo atualiza `view=` na URL; item de menu correto fica destacado
- [ ] **Limpar filtro** volta à visão geral
- [ ] Dashboard: atalho para faturas vencidas abre faturamento filtrado

---

## 8. Faturamento (API / workers)

- [ ] Admin/owner: `GET /api/publisher-billing/:id` responde **200** (não 403)
- [ ] `publisher_user` do exibidor owner acede ao seu faturamento
- [ ] **Emitir faturas do período** (diálogo): escopo, seletores com pesquisa, contratos ativos; opcional **repasses revenue share** após campanhas pagas
- [ ] Logs: **Financial Billing Worker** ativo; emissão automática sem erro crítico (`autoRevenueShare: true` se repasse automático)
- [ ] Repasse: após pagamento de fatura de campanha, worker ou emissão manual gera fatura exibidor `revenue_share` / `pending_payout`
- [ ] Logs: **Invoice Worker** (Stripe) ativo; geração/marcação vencidas sem erro crítico
- [ ] Logs: **Playlist Mix** e **Playlist Engine** workers iniciados
- [ ] Cron de alertas (5 min) registado nos logs

---

## 9. Notificações e e-mail

- [ ] SMTP testado (log: Email Service conectado)
- [ ] Fatura pendente de teste: envio manual ou lembrete automático chega ao e-mail (com link e PIX se configurado)
- [ ] Logs mostram `Lembretes de fatura enviados` / `E-mail de fatura enviado` (não só “email não enviado”)

---

## 10. Stripe (se ativo em staging)

- [ ] Plano com Price IDs Stripe nos intervalos usados
- [ ] Checkout/assinatura no intervalo escolhido (ex.: quadrimestral) usa o price ID correto
- [ ] Webhook Stripe processado sem 500 nos logs

---

## 11. Publicar em Tela (Opção C — Rápido / Criar)

**Implementado no código (homologar em campo):** anti-duplo-clique em Publicar/Gerar HTML; flags `ai_text_assist` / `ai_video` nos planos (seeds + instalador); E2E mock com rotas publish-board; player já suporta `media_type: html`.

- [ ] **Rápido** (`/quick-publish?mode=quick`): upload MP4/imagem → mídia aprovada → publicar em totem
- [ ] **Criar** (`?mode=create`): aba Criar → preset Promoção ou Cardápio → preview animado (HTML offline, sem CDN)
- [ ] **Gerar animação HTML** → mídia `html` selecionada → **Publicar agora** (playlist/campanha automáticas, não expostas na UI)
- [ ] Cardápio: alterar preço em **Cardápio por cliente** → tela reflete em até ~60s (API `/api/publish-board/public-menu/:subscriberId`)
- [ ] **Sugerir textos com IA**: botão ativo só com `AI_PROVIDER` configurado; aviso claro se indisponível
- [ ] **Vídeo IA (Premium)**: plano base mostra mensagem informativa (fila stub)
- [ ] `/publish-board` redireciona para `?mode=create`

---

## 12. Operação diária

- [ ] Criar campanha, associar totens, dispatcher responde
- [ ] Playlist Mix: criar/editar mix e verificar que o worker processa (log ou comportamento no player)
- [ ] Upload de mídia e aprovação no perfil Studio (mídia aprovada automaticamente se aplicável)

---

## 13. Instalação nova (opcional — VM limpa)

- [ ] Instalador: Enter na pergunta HTTP → **opção 2** (site 80, painel 8080) por defeito
- [ ] Pós-install: login sem credenciais na UI; admin ligado ao publisher owner

---

## Critérios de “OK para produção”

| Área | Mínimo aceitável |
|------|------------------|
| Segurança | Login sem credenciais expostas |
| Studio | Menu faturamento anunciante + exibidor; `ui-context` correto |
| Contratos | 4 intervalos + valor negociado persistido |
| Faturamento | Emissão/listagem anunciante e exibidor para admin |
| Workers | Financial + Invoice + Mix/Engine sem falha no boot |
| E-mail | Pelo menos 1 lembrete/fatura de teste recebido |

---

## Se algo falhar — onde olhar

| Sintoma | Verificar |
|---------|-----------|
| 403 em publisher-billing | `TOTEMDIGITAL_COMPACT=true`, utilizador com role/publisher_id |
| Menu sem Exibidores | Rebuild frontend Studio; cache do browser |
| Intervalos só Mensal/Anual | Schema/seed; colunas `price_four_month`, `price_semester` |
| E-mail não sai | SMTP, `FINANCIAL_WORKER_ENABLED`, logs `FinancialNotificationService` |
| Stripe intervalo errado | Price ID no plano só no intervalo com preço |

---

## Comandos úteis

```bash
git pull origin Smart-Signage-Studio-V3x

# Validar seed/schema (com Postgres acessível)
cd database && node validate-v6.js

# Colunas financeiras (publisher billing_interval, períodos)
./scripts/validate-financial-schema.sh

# Smoke read-only pós-deploy (contratos, faturas, planos)
./scripts/validate-studio-finance-smoke.sh

# Smoke HTTP (backend a correr; login ou TOKEN)
BASE="http://SEU_HOST:3001/api" USER=admin PASS='...' ./scripts/validate-studio-finance-api.sh

# Emissão manual (token admin): POST /api/financial-admin/issue-invoices
# Corpo opcional: subscriberId, contractId, publisherId, publisherContractId, dueInDays

# Backend (exemplo)
cd backend && npm test -- --testPathPattern="installationPolicy|installationRuntime|billingIntervals"
```

Branch de trabalho: **`Smart-Signage-Studio-V3x`** · base histórica: `Totem-Digital-V3x`.
