# Seeds e Modo Demo - Documentação
## Resumo das Implementações

---

## 📊 **1. Seeds para Teste das VIEWs**

### **Arquivo: `database/seeds-views-test.sql`**

#### **Dados Criados:**

1. **Execution Logs** (15 registros)
   - Logs recentes (últimas 24h)
   - Logs com erro
   - Logs antigos (última semana)
   - Logs por hora (para testar `v_execution_stats_hourly`)

2. **Remote Commands** (6 registros)
   - Comandos completados
   - Comandos pendentes
   - Comandos em execução
   - Comandos falhados

3. **Audit Logs** (15 registros)
   - Ações de hoje (login, create, update, delete, approve)
   - Ações dos últimos dias
   - Diferentes tipos de entidades (media, campaign, totem, user, client)

4. **User Roles e Permissões**
   - 5 roles: admin, manager, operator, viewer, client
   - 15 permissões diferentes
   - Relacionamentos entre usuários, roles e permissões

5. **Analytics Sessions** (7 sessões)
   - Sessões com métricas de emoções
   - Sessões com gestos
   - Diferentes totens e localizações

6. **Analytics Emotions** (11 registros)
   - Emoções detectadas (happy, neutral, sad, surprised)
   - Níveis de confiança
   - Timestamps variados

7. **Analytics Gestures** (5 registros)
   - Gestos detectados (wave, point, thumbs_up)
   - Coordenadas e confiança
   - Ações acionadas

8. **Analytics QR Scans** (5 registros)
   - Scans de QR codes
   - Diferentes totens e localizações
   - User agents e IPs

9. **Export Queries** (4 queries)
   - Queries para diferentes views
   - Diferentes formatos (xlsx, pdf, csv)
   - Configurações de exportação

10. **Export Schedules** (4 agendamentos)
    - Schedules diários, semanais, mensais
    - Diferentes cron expressions
    - Estatísticas de execução

11. **Export Executions** (6 execuções)
    - Execuções completadas
    - Execuções falhadas
    - Execução em andamento
    - Métricas de performance

12. **Campaign Totems** (6 relacionamentos)
    - Relacionamentos entre campanhas e totens
    - Agendamentos de execução

13. **Campaign Playlists** (4 relacionamentos)
    - Relacionamentos entre campanhas e playlists
    - Prioridades

14. **Approval Workflows** (5 workflows)
    - Workflows aprovados, em revisão, rejeitados
    - Comentários de revisão

---

## 🎬 **2. Modo Demo Local no Player**

### **Comportamento:**

Quando o player é acessado **sem UIN** (recém instalado), ele:
1. ✅ **Não tenta se registrar no servidor**
2. ✅ **Entra automaticamente em modo demo**
3. ✅ **Toca uma vinheta local em loop**
4. ✅ **Não requer conexão com o servidor**

### **Implementação:**

#### **A. Função `startDemoMode()`**
- Detecta quando não há UIN
- Cria vinheta demo local (SVG)
- Inicia reprodução em loop

#### **B. Função `createDemoVinhet()`**
- Cria SVG animado com:
  - Background gradiente (azul)
  - Texto "Smart Signage Pro" com animação de fade
  - Texto "Modo Demonstração"
  - Instruções para configurar UIN
  - Versão do sistema

#### **C. Função `startDemoPlayback()`**
- Loop de 10 segundos
- Recria a vinheta a cada ciclo
- Sem fim até UIN ser configurado

---

## 📝 **3. Como Usar**

### **Aplicar Seeds:**

```bash
# No servidor PostgreSQL
psql -U postgres -d smartsignage -f database/seeds-views-test.sql
```

### **Testar Views:**

```sql
-- Ver logs de execução
SELECT * FROM v_execution_logs_complete LIMIT 10;

-- Ver estatísticas diárias
SELECT * FROM v_execution_stats_daily ORDER BY period DESC;

-- Ver estatísticas horárias
SELECT * FROM v_execution_stats_hourly ORDER BY period DESC;

-- Ver usuários com roles
SELECT * FROM v_users_with_roles;

-- Ver logs de auditoria
SELECT * FROM v_audit_logs_complete ORDER BY audit_timestamp DESC LIMIT 20;

-- Ver atividades por dia
SELECT * FROM v_user_activities_daily ORDER BY period DESC;

-- Ver analytics
SELECT * FROM v_analytics_sessions_complete LIMIT 10;

-- Ver execuções de exportação
SELECT * FROM v_export_executions_complete ORDER BY started_at DESC LIMIT 10;
```

### **Testar Modo Demo:**

1. Acesse o player **sem UIN**:
   ```
   http://servidor/player
   ```

2. A vinheta demo deve aparecer automaticamente

3. Para sair do modo demo, configure o UIN:
   ```
   http://servidor/player?uin=SEU_UIN
   ```

---

## ✅ **Checklist de Verificação**

- [x] Seeds criados para testar todas as views
- [x] Modo demo implementado no player
- [x] Vinheta local criada (SVG)
- [x] Loop automático implementado
- [x] Player não tenta se registrar quando em modo demo
- [x] Documentação criada

---

## 📋 **Estrutura de Arquivos**

```
database/
  ├── seeds-views-test.sql      # Seeds para testar views
  ├── carga-inicial-db-smarsignage-v4.sql  # Carga inicial principal (seeds v4)
  └── smartchannel-db.sql        # Schema consolidado (inclui views)

player/
  ├── index.html                 # Player com modo demo
  └── demo-vinhet.html          # Vinheta demo (HTML alternativo)

docs/
  └── SEEDS_E_MODO_DEMO.md      # Esta documentação
```

---

## 🎯 **Próximos Passos**

1. **Testar seeds** - Executar no banco e verificar dados
2. **Testar views** - Executar queries nas views criadas
3. **Testar modo demo** - Acessar player sem UIN
4. **Personalizar vinheta** - Adicionar logo ou imagens se necessário

---

**Arquivos Criados/Modificados:**
- `database/seeds-views-test.sql` - Seeds completos
- `player/index.html` - Modo demo implementado
- `player/demo-vinhet.html` - Vinheta demo alternativa
- `docs/SEEDS_E_MODO_DEMO.md` - Documentação

