# 🗺️ Roadmap Visual - Smart Signage Pro v2.1

## 📅 Timeline Consolidado

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Q1 (Meses 1-3) - MONETIZAÇÃO E ESTABILIZAÇÃO                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Semana 1-2:  P0.1 - Billing (Stripe Integration)                       │
│ Semana 3-4:  P0.1 - Billing (Planos, Assinaturas)                      │
│ Semana 5-6:  P0.1 - Billing (Faturas, Frontend) + P0.2 (Rate Limiting)│
│ Semana 7-8:  P0.2 - Integração (Cache, Validação) + P0.3 (2FA TOTP)    │
│ Semana 9-12: P0.3 - 2FA (SMS) + P0.4 - Export Excel/PDF               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Q2 (Meses 4-6) - OPERAÇÃO E UX                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Semana 13-16: P1.5 - Controle Remoto (Reinício, Screenshot, Logs, OTA) │
│ Semana 17-20: P1.6 - Dashboards Customizáveis                           │
│ Semana 21-24: P2.8 - Multi-idioma (i18n)                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Q3 (Meses 7-9) - EXPANSÃO E DIFERENCIAÇÃO                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Semana 25-28: P1.7 - App Mobile (Setup, Auth, Dashboard)                │
│ Semana 29-32: P1.7 - App Mobile (Totens, Upload, Notificações)          │
│ Semana 33-36: P2.9 - Editor Visual (início)                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Q4 (Meses 10-12) - FEATURES AVANÇADAS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Semana 37-44: P2.9 - Editor Visual (completo)                           │
│ Semana 45-48: P2.10 - Redes Sociais + P2.11 - Geolocalização            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Matriz de Priorização Visual (Ajustada)

```
IMPACTO
  ↑
  │
ALTO│ [P0.1⭐] [P0.2] [P0.3] [P0.4] [P1.5⭐] [P2.9] [P3.14]
    │  Billing  Integ 2FA  Export  Controle Editor  API
    │
    │
MÉDIO│ [P1.6] [P1.7] [P2.8] [P2.10] [P2.11] [P3.12]
    │  Dash   Mobile i18n  Social  Geo     A/B
    │
    │
BAIXO│ [P3.13]
    │  Stream
    │
    └──────────────────────────────────────────→ COMPLEXIDADE
                  BAIXA    MÉDIA    ALTA
    
⭐ = Prioridade ajustada (mudou de posição)
```

---

## 📊 Priorização por ROI

| Feature | Impacto | Complexidade | ROI | Prioridade | Status |
|---------|---------|--------------|-----|------------|--------|
| **P0.1 - Billing** ⭐ | 🔴 Alto | 🟡 Média | 🔴 Alto | **P0** | ⬆️ Subiu |
| P0.2 - Integração Frontend | 🔴 Alto | 🟡 Média | 🔴 Alto | P0 | ✅ Mantido |
| P0.3 - 2FA/MFA | 🔴 Alto | 🟡 Média | 🔴 Alto | P0 | ✅ Mantido |
| P0.4 - Export Relatórios | 🔴 Alto | 🟢 Baixa | 🔴 Alto | P0 | ✅ Mantido |
| **P1.5 - Controle Remoto** ⭐ | 🔴 Alto | 🟡 Média | 🔴 Alto | **P1** | ⬆️ Novo |
| P1.6 - Dashboards Custom | 🟡 Médio | 🟡 Média | 🟡 Médio | P1 | ✅ Mantido |
| **P1.7 - App Mobile** ⭐ | 🟡 Médio | 🟡 Média | 🟡 Médio | **P2** | ⬇️ Desceu |
| P2.8 - Multi-idioma | 🟡 Médio | 🟢 Baixa | 🟡 Médio | P2 | ✅ Mantido |
| P2.9 - Editor Visual | 🔴 Alto | 🔴 Alta | 🟡 Médio | P2 | ✅ Mantido |
| P2.10 - Redes Sociais | 🟡 Médio | 🟡 Média | 🟡 Médio | P2 | ✅ Mantido |
| P2.11 - Geolocalização | 🟡 Médio | 🟡 Média | 🟡 Médio | P2 | ✅ Mantido |
| P3.12 - A/B Testing | 🟡 Médio | 🔴 Alta | 🟢 Baixo | P3 | ✅ Mantido |
| P3.13 - Streaming | 🟡 Médio | 🔴 Alta | 🟢 Baixo | P3 | ✅ Mantido |
| P3.14 - API Pública | 🔴 Alto | 🔴 Alta | 🟡 Médio | P3 | ✅ Mantido |
| P3.15 - BI/Data Warehouse | 🟡 Médio | 🔴 Alta | 🟢 Baixo | P3 | ✅ Mantido |

---

## 🚀 Quick Start - Próximas 4 Semanas (AJUSTADO)

### Semana 1-2: Billing - Stripe Integration ⭐ **PRIORIDADE MÁXIMA**
```bash
# Backend
cd backend
npm install stripe
# Implementar integração Stripe
# Criar rotas de pagamento
# Sistema de planos
```

### Semana 3-4: Billing - Planos e Faturas
```bash
# Backend
# Implementar sistema de planos
# Faturas automáticas
# Frontend de billing
```

### Semana 5-6: Integração Frontend + Rate Limiting
```bash
# Frontend
cd frontend
npm install @tanstack/react-query
# Implementar interceptor 429
# Implementar React Query
# Validação de payload
```

### Semana 7-8: 2FA
```bash
# Backend
cd backend
npm install speakeasy qrcode
# Implementar TOTP
# Criar rotas 2FA
```

---

## 📈 Métricas de Sucesso

### P0 (Crítico):
- ✅ **Billing processando pagamentos** (receita ativa)
- ✅ Taxa de erro 429 reduzida em 90%
- ✅ Requisições ao servidor reduzidas em 60%
- ✅ 100% dos usuários com 2FA disponível
- ✅ 100% dos relatórios exportáveis

### P1 (Alta):
- ✅ Controle remoto funcional (reinício, screenshot, logs, OTA)
- ✅ Redução de 80%+ em custos operacionais
- ✅ Dashboards customizáveis por usuário
- ✅ App mobile com 80% das funcionalidades (P2)

### P2 (Média):
- ✅ Suporte a 3+ idiomas
- ✅ Editor visual funcional
- ✅ Conteúdo contextual funcionando
- ✅ Integração com 2+ redes sociais

---

**Última atualização:** 2025-11-27  
**Versão:** 2.0 (Priorização Ajustada)

## 📝 Mudanças Principais

1. ⬆️ **Billing:** P1 → **P0** (CRÍTICO - Core do negócio)
2. ⬆️ **Controle Remoto:** Novo → **P1** (ALTA - Reduz custos)
3. ⬇️ **App Mobile:** P1 → **P2** (MÉDIA - Não crítico)
4. ✅ **Multi-idioma:** Mantido P2 (MÉDIA - Baixa complexidade)

