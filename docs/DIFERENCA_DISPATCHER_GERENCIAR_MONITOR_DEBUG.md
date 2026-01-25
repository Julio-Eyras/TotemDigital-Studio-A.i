# Diferença entre Dispatcher: Gerenciar, Monitor e Debug Online

## 📋 Visão Geral

O sistema Dispatcher possui três interfaces distintas, cada uma com um propósito específico:

---

## 1. 🎛️ **Gerenciar Dispatcher** (`/dispatcher-manager`)

### **Objetivo:**
**Configuração e visualização do que será exibido**

### **O que faz:**
- Visualiza **campanhas elegíveis** para um totem em um momento específico
- Mostra **playlists disponíveis** e suas mídias
- Exibe **timeline** de exibição (o que será exibido em cada horário)
- Permite **simular** o que o dispatcher decidiria exibir
- Mostra **planos de exibição** antes de serem aplicados

### **Quando usar:**
- ✅ Antes de criar/editar campanhas - ver o que está elegível
- ✅ Planejamento - ver timeline de exibição
- ✅ Validação - verificar se campanhas estão configuradas corretamente
- ✅ Simulação - testar diferentes timestamps e ver o resultado

### **Foco:**
**Conteúdo e agendamento** - "O que será exibido?"

---

## 2. 📊 **Monitor Dispatcher** (`/dispatcher-monitor`)

### **Objetivo:**
**Monitoramento histórico de decisões já tomadas**

### **O que faz:**
- Mostra **histórico de decisões** do dispatcher (logs do banco)
- Exibe **quais campanhas foram selecionadas** em cada momento
- Mostra **playlists elegíveis** que foram consideradas
- Visualiza **planos de exibição** que foram gerados
- Permite **filtrar por totem e período**
- Mostra **métricas de cache** (quantas vezes veio do cache vs banco)

### **Quando usar:**
- ✅ Análise histórica - ver o que foi exibido no passado
- ✅ Auditoria - verificar decisões tomadas
- ✅ Troubleshooting - entender por que uma campanha não foi exibida
- ✅ Relatórios - analisar padrões de exibição

### **Foco:**
**Histórico e auditoria** - "O que foi exibido?"

---

## 3. 🔧 **Debug Online** (`/dispatcher-debug`)

### **Objetivo:**
**Debug técnico em tempo real - diagnóstico de problemas**

### **O que faz:**
- Mostra **status do Redis** em tempo real (por que não está operando)
- Exibe **queries SQL** executadas (comando, parâmetros, duração, linhas)
- Mostra **mensagens recebidas/respondidas** do dispatcher
- Visualiza **conteúdo completo** de requests e responses
- Permite **auto-refresh** para monitoramento contínuo
- Mostra **estatísticas** (queries com erro, durações médias)

### **Quando usar:**
- ✅ Diagnóstico técnico - descobrir por que algo não funciona
- ✅ Performance - ver queries lentas
- ✅ Debug de Redis - verificar conexão e erros
- ✅ Rastreamento de mensagens - ver exatamente o que foi enviado/recebido
- ✅ Troubleshooting avançado - entender o fluxo completo

### **Foco:**
**Diagnóstico técnico** - "Por que não está funcionando?"

---

## 📊 Comparação Rápida

| Característica | Gerenciar | Monitor | Debug Online |
|---------------|-----------|---------|--------------|
| **Foco** | Conteúdo/Agendamento | Histórico/Auditoria | Diagnóstico Técnico |
| **Dados** | Elegíveis/Futuro | Decisões passadas | Técnico em tempo real |
| **Quando usar** | Planejamento | Análise | Troubleshooting |
| **Redis** | ❌ Não mostra | ⚠️ Apenas métricas | ✅ Status completo |
| **Queries SQL** | ❌ Não mostra | ❌ Não mostra | ✅ Todas as queries |
| **Mensagens** | ❌ Não mostra | ⚠️ Apenas decisões | ✅ Request/Response completo |
| **Tempo real** | ⚠️ Simulação | ❌ Histórico | ✅ Auto-refresh |

---

## 🎯 Fluxo de Uso Recomendado

### **Cenário 1: Planejamento de Campanha**
1. **Gerenciar** → Ver campanhas elegíveis e timeline
2. Criar/editar campanha
3. **Gerenciar** → Verificar se aparece corretamente

### **Cenário 2: Campanha não está sendo exibida**
1. **Monitor** → Ver histórico - a campanha foi considerada?
2. Se não apareceu no histórico → **Gerenciar** → Ver se está elegível
3. Se está elegível mas não aparece → **Debug Online** → Ver queries e mensagens

### **Cenário 3: Sistema lento ou erros**
1. **Debug Online** → Ver status Redis e queries lentas
2. **Monitor** → Ver se há padrão nos erros
3. Corrigir problema técnico

---

## 💡 Resumo

- **Gerenciar** = "O que será exibido?" (planejamento)
- **Monitor** = "O que foi exibido?" (histórico)
- **Debug Online** = "Por que não funciona?" (diagnóstico técnico)

Cada ferramenta tem seu propósito e se complementam para uma visão completa do sistema Dispatcher.
