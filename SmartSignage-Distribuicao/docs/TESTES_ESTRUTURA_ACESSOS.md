# 🧪 Testes - Estrutura de Acessos

**Data:** 2024-01-XX  
**Status:** ⏳ Pendente

---

## 📋 TESTES CRIADOS

### 1. ✅ Testes Unitários - Middleware

**Arquivo:** `backend/src/__tests__/middleware/operatorProtection.test.ts`

**Cenários testados:**
- ✅ Usuário não-operator pode acessar dados de clientes
- ✅ Operator bloqueado de acessar campaigns
- ✅ Operator bloqueado de acessar medias
- ✅ Operator pode acessar dados técnicos de totem (restart)
- ✅ Operator pode acessar logs de totem
- ✅ Operator pode acessar logs/config do SmartDisplayFX
- ✅ Operator bloqueado de acessar dados do SmartDisplayFX

---

## 🧪 TESTES MANUAIS RECOMENDADOS

### 1. Testar OPERATOR

#### Deve BLOQUEAR:
```bash
# Tentar acessar campanhas
curl -X GET http://localhost:3000/api/campaigns \
  -H "Authorization: Bearer <token_operator>"

# Tentar acessar mídia
curl -X GET http://localhost:3000/api/media \
  -H "Authorization: Bearer <token_operator>"

# Tentar acessar playlists
curl -X GET http://localhost:3000/api/playlists \
  -H "Authorization: Bearer <token_operator>"

# Tentar acessar relatórios
curl -X GET http://localhost:3000/api/reports \
  -H "Authorization: Bearer <token_operator>"

# Tentar acessar billing
curl -X GET http://localhost:3000/api/billing \
  -H "Authorization: Bearer <token_operator>"
```

**Resultado esperado:** `403 Forbidden` com mensagem de erro

#### Deve PERMITIR:
```bash
# Acessar logs de totem
curl -X GET http://localhost:3000/api/totems/1/logs \
  -H "Authorization: Bearer <token_operator>"

# Reiniciar totem
curl -X POST http://localhost:3000/api/totems/1/restart \
  -H "Authorization: Bearer <token_operator>"

# Capturar screenshot
curl -X POST http://localhost:3000/api/totems/1/screenshot \
  -H "Authorization: Bearer <token_operator>"

# Acessar logs do SmartDisplayFX
curl -X GET http://localhost:3000/api/smartdisplayfx/logs \
  -H "Authorization: Bearer <token_operator>"

# Acessar OTA updates
curl -X GET http://localhost:3000/api/ota-updates \
  -H "Authorization: Bearer <token_operator>"
```

**Resultado esperado:** `200 OK` ou resposta válida

---

### 2. Testar ADMIN_SQL

```bash
# Acessar qualquer recurso (deve permitir)
curl -X GET http://localhost:3000/api/campaigns \
  -H "Authorization: Bearer <token_admin_sql>"

# Verificar auditoria
# Deve ter registro em audit_logs
```

**Resultado esperado:** `200 OK` + registro de auditoria

---

### 3. Testar ADMIN (Cliente)

```bash
# Acessar dados do próprio cliente (deve permitir)
curl -X GET http://localhost:3000/api/campaigns?clientId=1 \
  -H "Authorization: Bearer <token_admin_cliente1>"

# Tentar acessar dados de outro cliente (deve bloquear)
curl -X GET http://localhost:3000/api/campaigns?clientId=2 \
  -H "Authorization: Bearer <token_admin_cliente1>"
```

**Resultado esperado:** 
- Próprio cliente: `200 OK`
- Outro cliente: `403 Forbidden`

---

## 🔍 VALIDAÇÕES

### 1. Verificar Auditoria

```sql
-- Verificar se ações de ADMIN_SQL e OPERATOR estão sendo auditadas
SELECT 
  user_id,
  action,
  entity,
  metadata,
  timestamp
FROM audit_logs
WHERE user_id IN (
  SELECT id FROM users WHERE role IN ('admin_sql', 'operator')
)
ORDER BY timestamp DESC
LIMIT 100;
```

### 2. Verificar Permissões

```sql
-- Verificar permissões de OPERATOR
SELECT 
  r.name as role,
  p.name as permission,
  p.resource,
  p.action
FROM roles r
JOIN role_permissions rp ON r.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE r.name = 'operator'
ORDER BY p.resource, p.action;
```

### 3. Verificar Bloqueios

```sql
-- Verificar se OPERATOR não tem permissões de clientes
SELECT 
  r.name as role,
  p.name as permission
FROM roles r
JOIN role_permissions rp ON r.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE r.name = 'operator'
  AND p.resource IN ('campaigns', 'medias', 'playlists', 'reports', 'billing', 'clients', 'analytics');
```

**Resultado esperado:** Nenhuma linha retornada (OPERATOR não deve ter essas permissões)

---

## 📝 CHECKLIST DE TESTES

### Testes Unitários
- [x] Testes de middleware criados
- [ ] Executar testes: `npm test -- operatorProtection.test.ts`

### Testes de Integração
- [ ] Testar OPERATOR bloqueado de dados de clientes
- [ ] Testar OPERATOR permitido em dados técnicos
- [ ] Testar ADMIN_SQL com auditoria
- [ ] Testar ADMIN com próprio cliente
- [ ] Testar ADMIN bloqueado de outro cliente

### Testes de Segurança
- [ ] Tentar bypass de middlewares
- [ ] Tentar acesso não autorizado
- [ ] Validar auditoria está funcionando
- [ ] Validar logs de segurança

---

## 🚀 COMO EXECUTAR TESTES

### 1. Testes Unitários

```bash
cd backend
npm test -- operatorProtection.test.ts
```

### 2. Testes de Integração

```bash
# Iniciar servidor
npm run dev

# Executar testes manuais (usar curl ou Postman)
# Ver exemplos acima
```

### 3. Verificar Logs

```bash
# Ver logs de auditoria
tail -f logs/audit.log

# Ver logs de erro
tail -f logs/error.log
```

---

**Última atualização:** 2024-01-XX

