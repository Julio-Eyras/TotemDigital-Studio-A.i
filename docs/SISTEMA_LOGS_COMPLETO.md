# Sistema de Logs Completo - Smart Signage v2.1
## Documentação Completa

---

## 📋 **1. Visão Geral**

O sistema de logs foi completamente reimplementado para:
- ✅ **Centralizar todos os logs** no diretório de instalação (`/opt/smart-signage/Logs`)
- ✅ **Configuração parametrizável** via interface admin
- ✅ **Rotação automática** baseada em tamanho e dias
- ✅ **Monitoramento de espaço em disco** com alertas
- ✅ **Alertas administrativos** quando rotação acontece

---

## 🏗️ **2. Arquitetura**

### **A. Componentes Principais**

1. **Logger Configurável** (`backend/src/config/logger.ts`)
   - Winston com rotação diária
   - Configuração dinâmica do banco de dados
   - Múltiplos transportes (arquivo, erro, exceções)

2. **Serviço de Rotação** (`backend/src/services/logRotationService.ts`)
   - Monitoramento de espaço em disco
   - Rotação baseada em tamanho e dias
   - Alertas administrativos

3. **Rotas de Gerenciamento** (`backend/src/routes/logs.ts`)
   - API REST para gerenciar logs
   - Endpoints para configuração e monitoramento

4. **Interface Admin** (`frontend/src/pages/Settings/Settings.tsx`)
   - Aba específica para configurações de logs
   - Monitoramento em tempo real
   - Controle de rotação manual

---

## ⚙️ **3. Configurações Disponíveis**

### **Configurações de Rotação**

Todas as configurações são armazenadas na tabela `system_settings` e podem ser alteradas via interface admin:

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `log.rotation.max_size` | string | `100MB` | Tamanho máximo de cada arquivo antes de rotacionar (ex: 100MB, 1GB) |
| `log.rotation.max_days` | number | `30` | Número de dias para manter logs antigos |
| `log.rotation.min_free_space` | string | `1GB` | Espaço livre mínimo antes de iniciar rotação agressiva |
| `log.rotation.enabled` | boolean | `true` | Habilitar rotação automática |
| `log.rotation.compress` | boolean | `true` | Compactar logs antigos após rotação |
| `log.alerts.enabled` | boolean | `true` | Habilitar alertas administrativos |
| `log.alerts.email` | boolean | `false` | Enviar alertas por email (requer configuração) |
| `log.level` | string | `info` | Nível de log (error, warn, info, debug) |
| `log.directory` | string | `/opt/smart-signage/Logs` | Diretório onde os logs são armazenados |

---

## 📊 **4. Funcionalidades**

### **A. Rotação Automática**

#### **Critérios de Rotação:**
1. **Tamanho Máximo**: Quando arquivo atinge `max_size`
2. **Idade Máxima**: Quando arquivo excede `max_days` dias
3. **Espaço Livre**: Quando espaço livre < `min_free_space`

#### **Comportamento:**
- ✅ Rotação diária automática (winston-daily-rotate-file)
- ✅ Arquivos antigos são compactados (`.gz`)
- ✅ Arquivos além de `max_days` são excluídos automaticamente
- ✅ Verificação periódica a cada hora

### **B. Monitoramento de Espaço em Disco**

- ✅ Verificação a cada hora do espaço livre
- ✅ Cálculo do tamanho total dos arquivos de log
- ✅ Alertas quando espaço livre < `min_free_space`
- ✅ Exibição na interface admin

### **C. Alertas Administrativos**

#### **Tipos de Alertas:**
1. **Espaço em Disco Baixo** (`low_disk_space`)
   - Quando espaço livre < `min_free_space`
   - Prioridade: Alta
   - Enviado para todos os administradores

2. **Tamanho Máximo Atingido** (`max_size_reached`)
   - Quando arquivo atinge `max_size`
   - Prioridade: Média
   - Informa qual arquivo foi rotacionado

3. **Idade Máxima Atingida** (`max_age_reached`)
   - Quando arquivo excede `max_days` dias
   - Prioridade: Média
   - Arquivo será excluído

4. **Rotação Concluída** (`rotation_completed`)
   - Após rotação manual ou automática
   - Prioridade: Baixa
   - Informa quantos arquivos foram rotacionados/excluídos

---

## 🎨 **5. Interface Admin**

### **Aba "Logs" na Configurações**

A interface admin inclui uma aba específica para logs com:

1. **Monitoramento em Tempo Real**
   - Espaço em disco (total, usado, livre)
   - Barra de progresso visual
   - Status de rotação

2. **Configurações de Rotação**
   - Tamanho máximo (MB/GB)
   - Retenção em dias
   - Espaço livre mínimo
   - Habilitar/desabilitar rotação
   - Habilitar/desabilitar compressão
   - Habilitar/desabilitar alertas

3. **Lista de Arquivos de Log**
   - Tabela com todos os arquivos de log
   - Tamanho de cada arquivo
   - Idade em dias
   - Data de modificação

4. **Ações Rápidas**
   - Rotacionar logs manualmente
   - Recarregar configurações do logger
   - Atualizar informações

---

## 🔧 **6. API Endpoints**

### **GET /api/logs/config**
Obter configurações de logs

**Resposta:**
```json
{
  "success": true,
  "data": {
    "maxSize": 104857600,
    "maxSizeFormatted": "100.00 MB",
    "maxDays": 30,
    "minFreeSpace": 1073741824,
    "minFreeSpaceFormatted": "1.00 GB",
    "enabled": true,
    "compress": true,
    "alertsEnabled": true,
    "logDirectory": "/opt/smart-signage/Logs"
  }
}
```

### **GET /api/logs/files**
Listar arquivos de log

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "name": "app-2024-01-15.log",
      "path": "/opt/smart-signage/Logs/app-2024-01-15.log",
      "size": 5242880,
      "sizeFormatted": "5.00 MB",
      "created": "2024-01-15T00:00:00Z",
      "modified": "2024-01-15T23:59:59Z",
      "age": 0
    }
  ]
}
```

### **GET /api/logs/disk-space**
Obter informações de espaço em disco

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total": 10737418240,
    "totalFormatted": "10.00 GB",
    "free": 8589934592,
    "freeFormatted": "8.00 GB",
    "used": 2147483648,
    "usedFormatted": "2.00 GB",
    "percentUsed": 20.0,
    "percentFree": "80.00"
  }
}
```

### **GET /api/logs/rotation-status**
Verificar status de rotação

**Resposta:**
```json
{
  "success": true,
  "data": {
    "needsRotation": false,
    "reason": "none",
    "details": {
      "message": "Não é necessário rotacionar logs"
    }
  }
}
```

### **POST /api/logs/rotate**
Rotacionar logs manualmente

**Resposta:**
```json
{
  "success": true,
  "message": "Logs rotacionados: 2 arquivos rotacionados, 1 arquivos excluídos",
  "data": {
    "filesRotated": 2,
    "filesDeleted": 1,
    "details": {
      "logDirectory": "/opt/smart-signage/Logs",
      "timestamp": "2024-01-15T12:00:00Z"
    }
  }
}
```

### **POST /api/logs/reload**
Recarregar configurações do logger

**Resposta:**
```json
{
  "success": true,
  "message": "Configurações do logger recarregadas com sucesso"
}
```

---

## 📝 **7. Como Aplicar**

### **1. Aplicar Schema de Configurações**

```bash
# Executar schema de configurações de logs
psql -U postgres -d smartsignage -f database/logs-config-schema.sql
```

### **2. Instalar Dependências**

```bash
cd backend
npm install winston-daily-rotate-file
```

### **3. Configurar Diretório de Logs**

O diretório de logs será criado automaticamente em:
```
/opt/smart-signage/Logs
```

Para alterar, edite a configuração `log.directory` na interface admin.

---

## 🔍 **8. Verificação**

### **Verificar Logs em Execução:**

```bash
# Ver logs atuais
tail -f /opt/smart-signage/Logs/app-current.log

# Ver logs de erro
tail -f /opt/smart-signage/Logs/error-current.log

# Ver exceções
tail -f /opt/smart-signage/Logs/exceptions-*.log
```

### **Verificar Espaço em Disco:**

```bash
# Ver tamanho do diretório de logs
du -sh /opt/smart-signage/Logs

# Ver arquivos de log
ls -lh /opt/smart-signage/Logs/
```

---

## ✅ **9. Checklist de Implementação**

- [x] Logger configurável com Winston
- [x] Rotação automática baseada em tamanho e dias
- [x] Monitoramento de espaço em disco
- [x] Sistema de alertas administrativos
- [x] Configurações parametrizáveis no banco
- [x] Interface admin para configuração
- [x] API REST para gerenciamento
- [x] Documentação completa

---

## 📂 **10. Estrutura de Arquivos**

```
backend/
  ├── src/
  │   ├── config/
  │   │   └── logger.ts              # Logger configurável
  │   ├── services/
  │   │   └── logRotationService.ts  # Serviço de rotação
  │   └── routes/
  │       └── logs.ts                # Rotas de gerenciamento
  └── package.json                    # Dependências (winston-daily-rotate-file)

frontend/
  └── src/
      └── pages/
          └── Settings/
              └── Settings.tsx        # Interface admin (aba Logs)

database/
  └── logs-config-schema.sql         # Schema de configurações

docs/
  └── SISTEMA_LOGS_COMPLETO.md      # Esta documentação
```

---

## 🎯 **11. Próximos Passos**

1. **Testar sistema de logs** - Executar e verificar geração de logs
2. **Configurar alertas** - Testar alertas administrativos
3. **Monitorar espaço** - Verificar monitoramento de disco
4. **Ajustar configurações** - Otimizar tamanhos e retenção

---

**Arquivos Criados/Modificados:**
- `backend/src/config/logger.ts` - Logger configurável
- `backend/src/services/logRotationService.ts` - Serviço de rotação
- `backend/src/routes/logs.ts` - Rotas de gerenciamento
- `backend/src/index.ts` - Integração do logger
- `backend/src/services/notificationService.ts` - Suporte a alertas
- `frontend/src/pages/Settings/Settings.tsx` - Interface admin
- `frontend/src/services/api/index.ts` - API de logs
- `database/logs-config-schema.sql` - Schema de configurações
- `backend/package.json` - Dependência winston-daily-rotate-file
- `docs/SISTEMA_LOGS_COMPLETO.md` - Documentação

