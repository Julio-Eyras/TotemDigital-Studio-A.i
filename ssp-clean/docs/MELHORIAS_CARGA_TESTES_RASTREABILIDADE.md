# 🚀 Melhorias Sugeridas para Carga de Testes e Rastreabilidade

## 📊 Análise Atual

### ✅ O que já está bom:
- Campanhas com períodos 2025 → 2027/2030
- Logs básicos de execução (execution_logs, event_logs)
- Dispatcher logs com decisões
- Alguns logs de interação

### ⚠️ O que pode melhorar:

1. **Cobertura temporal limitada** - Logs concentrados em "agora" (NOW() - INTERVAL)
2. **Poucos edge cases** - Falta cenários de erro, timeout, validação falhada
3. **Dados pouco variados** - Mesmos padrões repetidos
4. **Falta dados de performance** - Poucos logs para testar queries pesadas
5. **Rastreabilidade incompleta** - Falta correlação entre diferentes tipos de logs

---

## 🎯 Melhorias Propostas

### 1. **Logs Históricos Distribuídos (2025-2030)**

**Problema:** Logs concentrados em "agora", difícil testar filtros de período longo.

**Solução:** Criar blocos de logs distribuídos ao longo de 6 anos:
- 2025: Início (janeiro-março)
- 2026: Meio (junho-setembro)
- 2027: Fim de contratos padrão (dezembro)
- 2028: Renovação/Extensão (setembro)
- 2029: Operação contínua (março-junho)
- 2030: Fim simbólico (dezembro)

**Benefício:** Testar telas de rastreabilidade com filtros de data realistas.

---

### 2. **Edge Cases e Cenários de Erro**

**Problema:** Poucos casos de erro para testar tratamento de exceções.

**Solução:** Adicionar logs de:
- Timeouts de conexão
- Validações falhadas (temporal, técnica, integridade)
- Mídias corrompidas
- Totens offline por longos períodos
- Campanhas expiradas no meio da execução
- Conflitos de prioridade
- Falhas de cache

**Benefício:** Testar resiliência e tratamento de erros.

---

### 3. **Dados para Testes de Performance**

**Problema:** Poucos logs para testar queries com muitos registros.

**Solução:** Criar blocos de logs em massa:
- 1000+ execution_logs distribuídos
- 500+ event_logs variados
- 200+ dispatcher_log com diferentes cenários
- 100+ interaction_logs

**Benefício:** Testar performance de queries, paginação, filtros.

---

### 4. **Variação Realista de Horários e Dias**

**Problema:** Logs concentrados em poucos horários.

**Solução:** Distribuir logs ao longo de:
- Diferentes horas do dia (madrugada, manhã, tarde, noite)
- Diferentes dias da semana
- Diferentes meses/estações
- Picos de tráfego (fins de semana, feriados)

**Benefício:** Testar agendamento, filtros temporais, relatórios por período.

---

### 5. **Correlação Entre Logs (Rastreabilidade Completa)**

**Problema:** Logs isolados, difícil rastrear fluxo completo.

**Solução:** Criar sequências correlacionadas:
- `playlist_request` → `dispatcher_log` → `playlist_delivered` → `play_start` → `play_end`
- `campaign_create` → `media_approve` → `playlist_generate` → `totem_assign` → `play_start`
- `totem_offline` → `heartbeat_failed` → `playlist_request_failed` → `alert_created`

**Benefício:** Testar telas de rastreabilidade que mostram fluxo completo.

---

### 6. **Dados para Dispatcher Log (Cenários Variados)**

**Problema:** Poucos dispatcher_logs, todos similares.

**Solução:** Criar logs para:
- Múltiplos candidatos (3-5 campanhas competindo)
- Single winner (1 campanha vencedora)
- Cache hit vs cache miss
- Validações parciais (temporal OK, técnica falhou)
- Decisões em diferentes horários/dias

**Benefício:** Testar lógica de dispatcher, visualização de decisões.

---

### 7. **Interaction Logs Mais Completos**

**Problema:** Poucos interaction_logs, apenas gestos básicos.

**Solução:** Adicionar:
- Scans de QR codes com diferentes campanhas
- Reconhecimento facial (com person_id)
- Múltiplos gestos (wave, point, touch, swipe)
- Interações em diferentes totens
- Correlação com execution_logs (interação durante reprodução)

**Benefício:** Testar analytics de interação, rastreabilidade de engajamento.

---

### 8. **Audit Logs Completos**

**Problema:** Poucos audit_logs, apenas ações básicas.

**Solução:** Adicionar logs para:
- Todas as ações CRUD (create, read, update, delete)
- Aprovações/rejeições
- Logins/logouts
- Mudanças de permissão
- Ações de diferentes usuários (admin, publisher, subscriber)
- Ações em diferentes entidades (campaign, media, totem, playlist)

**Benefício:** Testar auditoria completa, compliance, segurança.

---

### 9. **Dados para Testes de Integração**

**Problema:** Falta dados que simulam integração real.

**Solução:** Criar sequências que simulam:
- Player solicitando playlist → Backend gerando → Player recebendo → Player reproduzindo
- Múltiplos totens simultaneamente
- Sincronização de cache
- Heartbeat contínuo
- Eventos transacionais em sequência

**Benefício:** Testar integração end-to-end, fluxos completos.

---

### 10. **Metadados Ricos para Filtros**

**Problema:** Metadados simples, difícil filtrar.

**Solução:** Adicionar metadados estruturados:
- `test_case`: Identificador do caso de teste
- `period`: Período temporal (start_2025, middle_2026, etc.)
- `scenario`: Cenário de teste (success, error, timeout, etc.)
- `totem_location`: Localização do totem
- `campaign_type`: Tipo de campanha
- `user_role`: Role do usuário que gerou o log

**Benefício:** Facilitar filtros em telas de rastreabilidade.

---

## 📝 Implementação Sugerida

### Prioridade Alta (Implementar Agora):
1. ✅ Logs históricos distribuídos 2025-2030 (já feito parcialmente)
2. ⚠️ Edge cases e cenários de erro
3. ⚠️ Correlação entre logs (rastreabilidade)
4. ⚠️ Dispatcher logs variados

### Prioridade Média:
5. Dados para performance (muitos logs)
6. Variação realista de horários
7. Interaction logs completos

### Prioridade Baixa (Futuro):
8. Audit logs completos (pode ser incremental)
9. Dados para integração (pode ser via testes E2E)
10. Metadados ricos (pode ser incremental)

---

## 🎯 Próximos Passos

1. **Implementar edge cases** - Adicionar logs de erro, timeout, validação falhada
2. **Expandir dispatcher_logs** - Mais cenários de decisão
3. **Criar sequências correlacionadas** - Rastreabilidade completa
4. **Adicionar interaction_logs variados** - QR scans, gestos, reconhecimento
