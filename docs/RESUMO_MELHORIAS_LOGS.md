# Resumo: Melhorias em Logs e Diagnóstico - Auto-Registro

## ✅ Implementações Realizadas

### 1. Logs Detalhados no Backend

**Arquivo:** `backend/src/routes/player.ts`

- ✅ **Request ID único** para cada requisição (formato: `REG-1234567890-abc123`)
- ✅ **Logs detalhados** em cada etapa do processo:
  - Início do registro
  - Validação de dados
  - Verificação de UIN duplicado
  - Verificação de hardware duplicado
  - Criação no banco de dados
  - Busca após criação
  - Erros completos com stack trace
- ✅ **Medição de tempo** de cada requisição
- ✅ **Informações detalhadas** de erro (em desenvolvimento)

### 2. Logs Detalhados no Player

**Arquivo:** `player/index.html`

- ✅ **Request ID único** para cada tentativa (formato: `PLAYER-1234567890-abc123`)
- ✅ **Logs detalhados** em cada etapa:
  - Coleta de hardware
  - Geração de UIN
  - Envio da requisição
  - Resposta do servidor
  - Erros de rede
  - Erros de parsing
- ✅ **Tratamento robusto de erros** com fallbacks
- ✅ **Informações detalhadas** de erro para debug

### 3. Endpoints de Debug

**Arquivo:** `backend/src/routes/debug.ts`

Novos endpoints criados:

- ✅ `GET /api/debug/player-registration-logs` - Lista totens registrados e logs
- ✅ `GET /api/debug/totem/:id` - Informações detalhadas de um totem
- ✅ `GET /api/debug/system-info` - Informações do sistema e estatísticas

### 4. Script de Diagnóstico

**Arquivo:** `scripts/diagnose-player-registration.sh`

Script automatizado que coleta:

- ✅ Informações do sistema
- ✅ Status do backend
- ✅ Logs do backend
- ✅ Status do banco de dados
- ✅ Testes de API
- ✅ Configurações
- ✅ Guia para coletar logs do player

### 5. Documentação Completa

**Arquivo:** `docs/COLETA_LOGS_DIAGNOSTICO.md`

Guia completo com:

- ✅ Como coletar logs do backend
- ✅ Como coletar logs do player
- ✅ Como rastrear Request IDs
- ✅ Endpoints de debug
- ✅ Problemas comuns e soluções
- ✅ Checklist de informações para reportar

---

## 🚀 Como Usar

### Coleta Automática de Logs

```bash
# Executar script de diagnóstico
cd /opt/smart-signage
sudo bash scripts/diagnose-player-registration.sh
```

**Saída:** Arquivos em `/tmp/smartsignage-diagnosis-YYYYMMDD-HHMMSS/`

### Ver Logs em Tempo Real

```bash
# Backend
sudo journalctl -u smart-signage -f

# Buscar por Request ID específico
sudo journalctl -u smart-signage | grep "REG-1234567890-abc123"
```

### Coletar Logs do Player

1. Abrir player no navegador
2. Abrir DevTools (F12)
3. Ir para aba "Console"
4. Recarregar página
5. Copiar logs (especialmente os com Request ID)

### Usar Endpoints de Debug

```bash
# Ver logs de registro
curl http://localhost:8080/api/debug/player-registration-logs

# Ver informações de um totem
curl http://localhost:8080/api/debug/totem/1

# Ver informações do sistema
curl http://localhost:8080/api/debug/system-info
```

---

## 📊 Estrutura dos Logs

### Backend (Request ID: REG-xxx)

```
[REG-1234567890-abc123] 📡 Iniciando auto-registro de totem
[REG-1234567890-abc123] 📋 Dados recebidos: {...}
[REG-1234567890-abc123] ✅ Validação passou. UIN: SSP-xxx
[REG-1234567890-abc123] 🔍 Verificando se UIN já existe...
[REG-1234567890-abc123] ✅ UIN não existe, pode prosseguir
[REG-1234567890-abc123] 🔍 Verificando hardware duplicado...
[REG-1234567890-abc123] ✅ Hardware não está duplicado
[REG-1234567890-abc123] 🔢 Obtendo próximo totem_id...
[REG-1234567890-abc123] ✅ Totem ID obtido: 1
[REG-1234567890-abc123] 💾 Criando totem no banco de dados...
[REG-1234567890-abc123] ✅ Totem inserido no banco de dados
[REG-1234567890-abc123] 🔍 Buscando totem criado...
[REG-1234567890-abc123] ✅ Totem encontrado após criação
[REG-1234567890-abc123] ✅ Auto-registro concluído com sucesso em 150ms
```

### Player (Request ID: PLAYER-xxx)

```
[PLAYER-1234567890-abc123] 📡 Iniciando auto-registro no servidor...
[PLAYER-1234567890-abc123] 🌐 API Base URL: http://localhost:8080/api
[PLAYER-1234567890-abc123] 🔧 Coletando informações de hardware...
[PLAYER-1234567890-abc123] ✅ Hardware coletado: {...}
[PLAYER-1234567890-abc123] 🔑 Gerando UIN...
[PLAYER-1234567890-abc123] ✅ UIN gerado: SSP-xxx
[PLAYER-1234567890-abc123] 📤 Enviando requisição de registro...
[PLAYER-1234567890-abc123] 📥 Resposta recebida: {status: 201, ok: true}
[PLAYER-1234567890-abc123] ✅ Auto-registro concluído: {...}
[PLAYER-1234567890-abc123] 💾 UIN salvo no localStorage: SSP-xxx
```

---

## 🔍 Rastreamento de Problemas

### Passo 1: Identificar Request ID

1. **No player:** Anote o Request ID dos logs do console
2. **No backend:** Use o mesmo Request ID para buscar nos logs

### Passo 2: Buscar Logs

```bash
# Backend
sudo journalctl -u smart-signage | grep "REG-1234567890-abc123"

# Arquivo de log
grep "REG-1234567890-abc123" /opt/smart-signage/backend/logs/app.log
```

### Passo 3: Analisar

- Verifique cada etapa do processo
- Identifique onde ocorreu o erro
- Verifique mensagens de erro completas
- Verifique stack traces (se houver)

### Passo 4: Testar

Use os endpoints de debug para verificar:

```bash
# Ver se totem foi criado
curl http://localhost:8080/api/debug/player-registration-logs

# Ver detalhes do totem
curl http://localhost:8080/api/debug/totem/SSP-xxx
```

---

## 📝 Checklist para Reportar Problemas

Quando reportar um problema, inclua:

- [ ] Request ID do player (`PLAYER-xxx`)
- [ ] Request ID do backend (`REG-xxx`)
- [ ] UIN gerado (se houver)
- [ ] Logs completos do console do navegador
- [ ] Logs do backend com Request ID
- [ ] Mensagem de erro completa
- [ ] Status HTTP da resposta
- [ ] Payload enviado (do Network tab)
- [ ] Resposta do servidor (do Network tab)
- [ ] Resultado do script de diagnóstico
- [ ] Screenshot da tela de erro (se houver)

---

## 🎯 Próximos Passos

1. **Teste o auto-registro novamente**
2. **Observe os logs detalhados**
3. **Use o Request ID para rastrear a requisição**
4. **Se ainda houver problemas, execute o script de diagnóstico**
5. **Colete todas as informações seguindo o checklist**

---

**Última atualização:** 2025-11-04  
**Versão:** 2.1.0

