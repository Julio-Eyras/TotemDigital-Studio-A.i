# Roteiro de testes manuais integrais — Smart Signage Studio

**Produto:** Smart Signage Studio (modo compacto / `TOTEMDIGITAL_COMPACT`)  
**Branch de referência:** `Smart-Signage-Studio-V3x`  
**Versão do roteiro:** 1.0 — 2026-05-29  

Este documento é o roteiro **completo** de validação manual. Complementa (não substitui):

- Smoke rápido: [CHECKLIST_STUDIO_STAGING.md](./CHECKLIST_STUDIO_STAGING.md)
- Testes automatizados: [TESTES.md](./TESTES.md), `e2e/README.md`
- Validação pós-instalação: [CHECKLIST-POS-INSTALL.md](./CHECKLIST-POS-INSTALL.md)

---

## Como usar

1. Preencha a **ficha de execução** (final do documento) antes de começar.
2. Execute os blocos **na ordem** (0 → 12); blocos 11–12 são opcionais conforme ambiente.
3. Marque cada item: ✅ passou · ❌ falhou · ⏭ ignorado (com motivo).
4. Para falhas, registe: passo, URL, utilizador, screenshot, trecho de log (`journalctl -u smart-signage -n 100`).
5. **Critério de liberação:** todos os itens **P0** devem passar; P1 com no máximo 2 falhas documentadas e plano de correção.

**Prioridade:** **P0** = bloqueia produção · **P1** = importante · **P2** = desejável / regressão

---

## Ficha rápida — dados de teste sugeridos

| Item | Valor sugerido |
|------|----------------|
| URL painel | `http://SEU_HOST:8080` (layout dividido) ou `:80` |
| URL API | `http://SEU_HOST:3000/api` ou proxy `/api` |
| Admin Studio | `totemdigital.admin` (seed v6) |
| Senha | Definida no install (não usar credenciais na UI) |
| Anunciante teste | Criar `Anunciante QA` + contrato ativo |
| Local / totem | 1 local, 1 totem online ou simulado |
| E-mail teste | Caixa real para SMTP |

---

## Matriz de perfis (executar subconjunto por release)

| Perfil | Login | Blocos obrigatórios |
|--------|-------|---------------------|
| `owner_system` / `admin` | Sim | 0–10 (completo) |
| `operador_faturamento` | Sim | 0, 1, 2, 7, 8, 9 |
| `operador_tecnico` | Sim | 0, 1, 2, 10, 11 (OTA, dispatcher) |
| `operador_comercial` | Sim | 0, 1, 2, 5, 6 |
| `publisher_user` | Sim | 0, 1, 2, 7 (só exibidor), 10 |
| `subscriber_user` | Sim | 0, 1, 5 (portal anunciante) |

---

## Bloco 0 — Pré-requisitos e ambiente (P0)

**Objetivo:** garantir que o ambiente de teste reflete produção Studio.

### 0.1 Deploy e build

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 0.1.1 | `git pull origin Smart-Signage-Studio-V3x` no servidor | Sem conflitos | P0 |
| 0.1.2 | Backend: `TOTEMDIGITAL_COMPACT=true` no `.env` | Variável presente | P0 |
| 0.1.3 | Frontend rebuild: `REACT_APP_TOTEMDIGITAL_COMPACT=true npm run build` | Build sem erro | P0 |
| 0.1.4 | Reiniciar `smart-signage` e Nginx | Serviços `active` | P0 |
| 0.1.5 | `curl -s http://localhost:3000/health` | `studioMode`/perfil Studio | P0 |
| 0.1.6 | `cd database && node validate-v6.js` | Sem erro (Postgres acessível) | P0 |
| 0.1.7 | `./scripts/validate-financial-schema.sh` | Colunas financeiras OK | P1 |
| 0.1.8 | Logs no boot: Financial Billing Worker, Invoice Worker, Playlist Mix/Engine | Sem `ERROR` crítico | P0 |

### 0.2 Checklist automático (opcional antes do manual)

```bash
cd backend && npm test
cd .. && npm run test:e2e
./scripts/validate-studio-finance-smoke.sh
```

- [ ] Testes unitários/integração backend: verde
- [ ] E2E Playwright mock: verde
- [ ] Smoke SQL financeiro: verde

---

## Bloco 1 — Acesso, segurança e sessão (P0)

**Pré-condição:** bloco 0 concluído.

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 1.1 | Abrir `/login` em janela anónima | Formulário sem credenciais pré-preenchidas ou expostas | P0 |
| 1.2 | Login com utilizador inválido | Mensagem de erro; permanece em `/login` | P0 |
| 1.3 | Login com admin Studio | Redireciona para `/dashboard` | P0 |
| 1.4 | Título / branding | **Smart Signage Studio** (ou nome configurado) | P1 |
| 1.5 | Abrir DevTools → Application → Local Storage | `token` e `user` presentes | P1 |
| 1.6 | `GET /api/dashboard/ui-context` sem token (browser ou curl) | 200; `totemDigitalCompact: true`, `installationProfile: single_publisher` | P0 |
| 1.7 | Menu utilizador → **Sair** | Volta a `/login`; token removido | P0 |
| 1.8 | Com sessão expirada (token inválido no storage), abrir `/dashboard` | Redireciona login **sem loop infinito** | P0 |
| 1.9 | `/forgot-password` | Página carrega; sem erro 500 | P2 |

---

## Bloco 2 — Navegação e menu Studio (P0)

**Utilizador:** `admin` ou `owner_system`.

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 2.1 | Dashboard | KPIs comerciais carregam; botão atualizar funciona | P0 |
| 2.2 | Menu **Anunciantes** → subitens (Publicar, Manutenção, Contratos, Mídias, Playlists, Campanhas) | Cada rota abre sem voltar ao dashboard | P0 |
| 2.3 | Menu **Administração** → Planos, Locais, Totens, Smart TVs, Faturamento, Contratos exibidor, Users, QR, Analytics, Relatórios | Itens visíveis para admin | P0 |
| 2.4 | **Configurações** → subitem **OTA Update** | Abre `/ota-updates` (não redireciona ao dashboard) | P0 |
| 2.5 | **Dispatcher** → Gerenciar, Monitor, Debug, Playlist Mix | Abre cada rota ou mensagem coerente se desligado | P1 |
| 2.6 | SmartDisplayFX | **Não** aparece no menu Studio (ou desligado) | P1 |
| 2.7 | Faturamento no menu: **Anunciantes** e **Exibidores** | Ambos acessíveis | P0 |
| 2.8 | URL com query (`/billing?type=subscriber&view=invoices`) | Página correta; item de menu destacado | P1 |
| 2.9 | Ctrl+K (Command Palette) | Rotas Studio listadas e navegam | P2 |

**Regressão conhecida:** admin em `/ota-updates` — ver `e2e/tests/ota-regression.spec.ts`.

---

## Bloco 3 — Planos, acessos e intervalos (P0)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 3.1 | **Planos & Acessos** → criar plano com preço Mensal | Gravação OK | P0 |
| 3.2 | Adicionar preços Quadrimestral, Semestral, Anual (pelo menos mais um) | Campos aceitos | P0 |
| 3.3 | **Intervalo de referência** | Lista só intervalos com preço definido | P0 |
| 3.4 | Preencher Stripe Price ID só em intervalos com preço | IDs opcionais coerentes | P1 |
| 3.5 | Editar plano já usado em contrato ativo | Bloqueio ou aviso de preços congelados | P1 |
| 3.6 | Planos expirados (se existir rota) | Lista separada funciona | P2 |
| 3.7 | Acessos anunciante → exibidor (se multi-agência) | Vínculo criado/listado | P2 |

---

## Bloco 4 — Infraestrutura: locais, totens, Smart TVs, players (P0)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 4.1 | Criar **local** com nome e vínculo ao exibidor owner | Persistido na listagem | P0 |
| 4.2 | Criar **totem** no local (UIN/identificador único) | Aparece em Totens / SmartvPlayer | P0 |
| 4.3 | Editar totem (nome, orientação, status) | Alterações gravadas | P1 |
| 4.4 | Criar **Smart TV** associada ao totem | Listagem por totem OK | P1 |
| 4.5 | **SmartvPlayer** / Players: listar, ver status | Sem erro; dados do totem | P1 |
| 4.6 | Rede visual / topologia (se habilitado) | Grafo ou lista carrega | P2 |

---

## Bloco 5 — Anunciantes, contratos e conteúdo (P0)

### 5.1 Anunciante e contrato

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 5.1.1 | Criar anunciante (subscriber) com dados mínimos | Listagem atualiza | P0 |
| 5.1.2 | Aba **Contratos**: plano + intervalo (ex. quadrimestral) | Valor acordado preenche do plano | P0 |
| 5.1.3 | Alterar valor acordado (negociação) e datas início/fim | Data fim recalcula; gravação OK | P0 |
| 5.1.4 | Reabrir contrato | `billing_interval` e valor persistidos | P0 |
| 5.1.5 | Listagem **Contratos (Anunciantes)** dedicada | Filtros e abertura de detalhe | P1 |

### 5.2 Mídia, vinhetas, playlists

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 5.2.1 | Upload de imagem/vídeo na biblioteca do anunciante | Upload OK; preview/listagem | P0 |
| 5.2.2 | Editar metadados / aprovar mídia (fluxo Studio) | Estado coerente (aprovada se automático) | P1 |
| 5.2.3 | Criar **playlist** e adicionar mídias | Playlist salva | P0 |
| 5.2.4 | **Vinhetas** (se usado): upload/listagem | Sem erro 400/500 | P2 |
| 5.2.5 | **Smart Playlist** (se habilitado) | Regras gravam | P2 |

### 5.3 Campanhas e publicação rápida

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 5.3.1 | Criar campanha: título, datas, vínculo anunciante | Campanha na listagem | P0 |
| 5.3.2 | Associar totens / players à campanha | Vínculos persistidos | P0 |
| 5.3.3 | Associar mídias e/ou playlists | Conteúdo na campanha | P0 |
| 5.3.4 | Ativar/publicar campanha (conforme UI) | Status ativo ou agendado | P0 |
| 5.3.5 | **Publicar em tela** (`/quick-publish`) | Fluxo simplificado conclui | P1 |
| 5.3.6 | Listagem campanhas modo admin: somente leitura global (se aplicável) | Mensagem/UI coerente | P2 |

### 5.4 Portal anunciante (`subscriber_user`)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 5.4.1 | Login subscriber | Dashboard anunciante | P1 |
| 5.4.2 | Só vê mídias/campanhas do próprio `subscriber_id` | Sem dados de outro anunciante (IDOR) | P0 |
| 5.4.3 | Tentar URL de outro anunciante (ID diferente) | 403 ou redirect | P0 |

---

## Bloco 6 — Exibidor, contratos e repasse (P0)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 6.1 | **Contratos (Exibidores)**: criar contrato com intervalo e valor | Datas mínimas respeitadas | P0 |
| 6.2 | Configurar **revenue share** (% e mínimo se existir) | Gravação OK | P0 |
| 6.3 | Contrato ativo gera expectativa de fatura incoming (worker ou emissão manual) | Fatura exibidor no painel | P1 |

---

## Bloco 7 — Faturamento e cobrança (P0)

### 7.1 Painel e KPIs

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 7.1.1 | Abrir **Faturamento** → visão geral | KPIs e planos sem travar | P0 |
| 7.1.2 | KPI **Repasse pendente** — clicar | Filtra faturas exibidor `revenue_share` / `pending_payout` | P0 |
| 7.1.3 | KPI **Campanhas pagas sem repasse** | Filtro aplicado | P0 |
| 7.1.4 | Tabela anunciantes: colunas **Contrato** e **Período** | Valores corretos | P1 |
| 7.1.5 | Dashboard → atalho faturas vencidas | Abre faturamento filtrado | P2 |

### 7.2 Faturas anunciante

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 7.2.1 | Aba/listagem **Anunciantes** | Paginação funciona | P0 |
| 7.2.2 | Abrir detalhe de fatura | Dados, PIX/link se configurado | P1 |
| 7.2.3 | **Registar pagamento** em fatura de campanha | Status pago; data de pagamento | P0 |
| 7.2.4 | Após pagamento, verificar repasse automático (se `FINANCIAL_AUTO_REVENUE_SHARE=true`) | Nova fatura exibidor outgoing / pending_payout | P0 |

### 7.3 Faturas exibidor e repasse

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 7.3.1 | Aba **Exibidores** como admin | 200; listagem (não 403) | P0 |
| 7.3.2 | **Marcar repasse como pago** em linha outgoing | Status atualizado | P0 |
| 7.3.3 | Diálogo **Emitir faturas do período** | Seletores com pesquisa; escopo anunciante/exibidor | P0 |
| 7.3.4 | Emitir com opção **repasses revenue share** | Resumo de criados/ignorados | P1 |
| 7.3.5 | `publisher_user` owner: acede só ao seu faturamento | Isolamento OK | P1 |

### 7.4 API e scripts (validação técnica)

```bash
BASE="http://SEU_HOST:3001/api" USER=totemdigital.admin PASS='...' \
  ./scripts/validate-studio-finance-api.sh
```

- [ ] Smoke API financeira: verde

---

## Bloco 8 — Notificações, e-mail e PIX (P1)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 8.1 | Log backend: Email Service conectado | SMTP OK | P1 |
| 8.2 | Enviar lembrete/fatura de teste | E-mail recebido com link | P1 |
| 8.3 | E-mail de **repasse** ao exibidor (não é cobrança PIX) | Texto e link corretos | P1 |
| 8.4 | QR PIX na fatura (se `FINANCIAL_*` configurado) | QR renderiza | P2 |
| 8.5 | Centro de notificações in-app (se ativo) | Alerta de fatura aparece | P2 |

---

## Bloco 9 — Stripe (P1, se habilitado)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 9.1 | Plano com Price IDs por intervalo | IDs salvos | P1 |
| 9.2 | Checkout no intervalo escolhido (ex. semestral) | Usa price ID correto | P1 |
| 9.3 | Webhook Stripe (evento teste) | 200 nos logs; sem 500 | P1 |

---

## Bloco 10 — Dispatcher, playlist mix e operação em tela (P0)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 10.1 | **Dispatcher → Gerenciar**: ver fila / totens | UI carrega | P1 |
| 10.2 | **Monitor**: totens online/offline | Estados atualizam | P1 |
| 10.3 | **Debug**: timeline ou batch sem erro | Resposta JSON OK | P2 |
| 10.4 | Campanha ativa no totem de teste: plano de mídia no dispatcher | Itens corretos no debug/player | P0 |
| 10.5 | **Playlist Mix**: criar/editar mix | Worker processa (log ou efeito no player) | P1 |
| 10.6 | Player físico ou simulador: conteúdo exibido | Mídia da campanplaylist correta | P0 |
| 10.7 | Totem sem campanha válida | Fallback `totem_playlists` ou plano vazio (sem crash) | P1 |

---

## Bloco 11 — Administração avançada (P1)

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 11.1 | **Utilizadores**: criar operador técnico com `flag_smart_1` | OTA visível no menu | P1 |
| 11.2 | Utilizador sem flag: OTA **não** no menu | Filtragem OK | P1 |
| 11.3 | **OTA Updates**: listar, ver estatísticas | Página carrega | P0 |
| 11.4 | Nova atualização OTA (arquivo `.zip` pequeno teste) | Upload e registo draft | P1 |
| 11.5 | Ativar / pausar atualização | Status muda | P2 |
| 11.6 | **Configurações**: parâmetros gerais, rotação de logs | Gravação e leitura | P1 |
| 11.7 | **QR-Codes**: criar e listar | Sem 404 | P1 |
| 11.8 | **Tags**, **Relatórios**, **Analytics**, **IA** | Página abre ou redirect aceitável Studio | P2 |
| 11.9 | **Admin Tools** (se visível) | Cron/SQL somente admin | P2 |

---

## Bloco 12 — Instalação limpa e infraestrutura web (P1, opcional)

**Ambiente:** VM nova ou container.

| # | Passo | Esperado | P |
|---|--------|----------|---|
| 12.1 | `./scripts/install-smartsignage.sh` — HTTP opção **2** (site :80, painel :8080) | Install conclui | P1 |
| 12.2 | `validate-v6.js` pós-install | Seeds e perfil Studio OK | P0 |
| 12.3 | Login sem credenciais na UI | Admin owner com `publisher_id` | P0 |
| 12.4 | Site corporativo `:80` não sobrescreve `index.html` do painel | Páginas distintas | P1 |
| 12.5 | `./scripts/start-services.sh` | Nginx + smart-signage ativos | P0 |
| 12.6 | Portas 80 e 3000 (ou 8080) respondem | curl 200 | P0 |

---

## Bloco 13 — Regressões e não-funcionais (P1)

| # | Área | Passo | Esperado | P |
|---|------|--------|----------|---|
| 13.1 | Performance | Abrir listagens com 100+ registos | Paginação < 3s percebido | P2 |
| 13.2 | Browser | Chrome + Edge última versão | UI utilizável | P1 |
| 13.3 | Mobile | Menu responsivo (tablet) | Drawer funciona | P2 |
| 13.4 | Tema | Alternar claro/escuro | Persiste após reload | P2 |
| 13.5 | API | Rate limit login (várias tentativas) | Bloqueio ou 429 coerente | P2 |
| 13.6 | Backup | Export/backup admin (se usado) | Ficheiro gerado | P2 |

---

## Critérios de aceite — release Studio

| Área | Mínimo (P0) |
|------|-------------|
| Segurança | Login sem credenciais expostas; logout e JWT expirado sem loop |
| Studio | `ui-context` compact; menu faturamento completo; OTA acessível para admin |
| Contratos | 4 intervalos; valor negociado; datas coerentes |
| Conteúdo | Upload mídia + campanha + dispatch em totem teste |
| Faturamento | Emissão, pagamento campanha, repasse exibidor |
| Workers | Financial + Invoice + Mix/Engine no boot |
| E2E/automação | `npm test` backend + `npm run test:e2e` verdes no CI |

---

## Troubleshooting rápido

| Sintoma | Verificar |
|---------|-----------|
| OTA volta ao dashboard | Role `admin` em `rolePermissions`; rebuild frontend |
| 403 publisher-billing | `TOTEMDIGITAL_COMPACT=true`; `publisher_id` no user |
| Menu sem Exibidores | Build Studio; limpar cache |
| E-mail não envia | SMTP, `FINANCIAL_WORKER_ENABLED`, logs notification |
| Dispatcher vazio | Campanha ativa, totem online, timezone/datas |
| 502 no login | `systemctl status smart-signage`; porta 3000 |
| Intervalos só mensal/anual | Schema `price_four_month`, `price_semester` |

---

## Registro de execução

| Campo | Valor |
|-------|--------|
| Data | |
| Executor | |
| Ambiente (URL) | |
| Commit / branch | |
| Build frontend (data) | |
| Resultado P0 | ☐ Aprovado ☐ Reprovado |
| Resultado P1 | ☐ Aprovado ☐ Reprovado com ressalvas |
| Falhas (link/issue) | |
| Aprovador | |

### Resumo por bloco

| Bloco | Título | Passou | Falhou | Ignorado |
|-------|--------|--------|--------|----------|
| 0 | Pré-requisitos | | | |
| 1 | Acesso e sessão | | | |
| 2 | Navegação Studio | | | |
| 3 | Planos | | | |
| 4 | Infraestrutura | | | |
| 5 | Anunciantes e conteúdo | | | |
| 6 | Exibidor e repasse | | | |
| 7 | Faturamento | | | |
| 8 | E-mail / PIX | | | |
| 9 | Stripe | | | |
| 10 | Dispatcher / player | | | |
| 11 | Admin avançado | | | |
| 12 | Instalação limpa | | | |
| 13 | Regressões | | | |

---

## Referência cruzada — automação

| Roteiro manual (bloco) | Teste automatizado |
|------------------------|-------------------|
| 1, 2 | `e2e/tests/auth.spec.ts`, `studio-navigation.spec.ts` |
| 2 (OTA) | `e2e/tests/ota-regression.spec.ts` |
| 5 | `e2e/tests/content.spec.ts` |
| 7 | `e2e/tests/billing.spec.ts`, `validate-studio-finance-*` |
| 3–7 | `backend` billing/financial `*.test.ts` |
| 0 | `validate-v6.js`, CI `test.yml` |

---

*Documento mantido em `docs/`. Sugestões de melhoria: abrir issue ou PR na branch Studio.*
