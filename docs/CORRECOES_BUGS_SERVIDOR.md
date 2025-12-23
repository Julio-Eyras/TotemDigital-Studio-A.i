# 🔧 CORREÇÕES DE BUGS - SERVIDOR DE TESTE

**Data:** 2025-11-15  
**Problemas Identificados e Corrigidos**

---

## 🐛 PROBLEMAS ENCONTRADOS

### **1. Dashboard - Erro "column generated_at does not exist"**
- **Erro:** `Erro ao obter atividades recentes: column "generated_at" does not exist`
- **Causa:** Código tentando usar coluna `generated_at` que não existe nas tabelas `playlists` e `medias`
- **Arquivo:** `backend/src/services/dashboardService.ts`

### **2. Playlists - Erro "column pi.duration does not exist"**
- **Erro:** `Erro ao listar playlists: column pi.duration does not exist`
- **Causa:** Tabela `playlist_items` não tem coluna `duration`, usa `display_seconds`
- **Arquivo:** `backend/src/services/playlistService.ts`

### **3. QR Codes - Erro 404**
- **Erro:** `GET /api/qr-codes HTTP/1.1 404`
- **Causa:** Frontend chama `/api/qr-codes` mas backend só tinha `/api/qrcodes`
- **Arquivo:** `backend/src/index.ts`

### **4. Totems Pending - Erro 400**
- **Erro:** `GET /api/totems/pending HTTP/1.1 400`
- **Causa:** Comparação incorreta de boolean com integer no PostgreSQL
- **Arquivo:** `backend/src/services/totemService.ts`

### **5. Totem Stats - Erro "operator does not exist: boolean = integer"**
- **Erro:** `operator does not exist: boolean = integer`
- **Causa:** Comparação de `is_active` (boolean) com `1` (integer)
- **Arquivo:** `backend/src/services/totemService.ts`

### **6. Reports Types - Erro "invalid input syntax for type integer: NaN"**
- **Erro:** `invalid input syntax for type integer: "NaN"`
- **Causa:** Possível problema no frontend passando NaN como parâmetro
- **Status:** Verificar no frontend

---

## ✅ CORREÇÕES APLICADAS

### **1. dashboardService.ts**
```typescript
// ANTES:
COALESCE(created_at, generated_at) as timestamp

// DEPOIS:
created_at as timestamp
```

### **2. playlistService.ts**
```typescript
// ANTES:
COALESCE(SUM(pi.duration), 0) as total_duration

// DEPOIS:
COALESCE(SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)), 0) as total_duration
// E adicionado LEFT JOIN medias m ON pi.media_id = m.media_id
```

### **3. index.ts**
```typescript
// ADICIONADO:
app.use('/api/qr-codes', authMiddleware, qrcodeRoutes); // Alias para compatibilidade
```

### **4. totemService.ts - getAllTotems**
```typescript
// ANTES:
whereClause += ' AND t.is_active = ?';
params.push(filters.isActive ? 1 : 0);

// DEPOIS:
whereClause += ' AND COALESCE(t.is_active, false) = ?';
params.push(filters.isActive);
```

### **5. totemService.ts - getTotemStats**
```typescript
// ANTES:
WHERE ct.totem_id = ? AND c.is_active = 1

// DEPOIS:
WHERE ct.totem_id = ? AND COALESCE(c.is_active, true) = true
```

---

## 🚀 COMO APLICAR NO SERVIDOR

### **Opção 1: Atualizar via Git (Recomendado)**

```bash
# No servidor
cd /home/smartchannel/smartsignage-pro-main

# Atualizar código
git pull origin main

# Recompilar backend
cd backend
npm run build

# Reiniciar serviço
sudo systemctl restart smart-signage
```

### **Opção 2: Aplicar Correções Manualmente**

```bash
# No servidor
cd /home/smartchannel/smartsignage-pro-main/backend/src

# Fazer backup
cp -r services services.backup

# Aplicar correções (copiar arquivos corrigidos)
# Ou editar manualmente seguindo as correções acima

# Recompilar
npm run build

# Reiniciar serviço
sudo systemctl restart smart-signage
```

---

## 📋 VERIFICAÇÃO PÓS-CORREÇÃO

Após aplicar as correções, verificar:

```bash
# 1. Verificar logs
sudo journalctl -u smart-signage -f

# 2. Testar endpoints
curl http://localhost:3000/api/dashboard/activities?limit=10
curl http://localhost:3000/api/playlists
curl http://localhost:3000/api/qr-codes
curl http://localhost:3000/api/totems/pending

# 3. Verificar no navegador
# - Dashboard deve carregar atividades
# - Playlists deve listar corretamente
# - QR Codes deve funcionar
# - Totems deve listar pendentes
```

---

## ⚠️ PROBLEMAS RESTANTES

### **Reports Types - NaN**
- **Status:** Investigar no frontend
- **Possível causa:** Frontend passando NaN como parâmetro
- **Solução:** Verificar código do frontend que chama `/api/reports/types`

### **Tela Preta em Algumas Páginas**
- **Status:** Pode ser problema do frontend
- **Páginas afetadas:**
  - `/media` - Tela preta
  - `/playlists` - Tela preta (mas API funciona agora)
  - `/billing` - Tela preta
  - `/settings` - Tela preta
- **Solução:** Verificar console do navegador para erros JavaScript

---

## 📝 ARQUIVOS MODIFICADOS

1. ✅ `backend/src/services/dashboardService.ts`
2. ✅ `backend/src/services/playlistService.ts`
3. ✅ `backend/src/services/totemService.ts`
4. ✅ `backend/src/index.ts`

---

**✅ Correções prontas para aplicar no servidor!**

