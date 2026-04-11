# 🔧 Atualização de Rotas - Subníveis do Cliente

**Data:** 2024-01-XX

---

## 📋 ROTAS QUE PRECISAM SER ATUALIZADAS

### 1. Campaigns (`/api/campaigns`)

**GET /stats** - Estatísticas
- ✅ Atualizado: `['admin', 'gerente_marketing', 'visualizador']`

**DELETE /:id** - Deletar campanha
- ✅ Atualizado: `['admin', 'gerente_marketing']`

**Outras rotas:**
- GET / - Listar: `admin`, `gerente_marketing`, `visualizador`, `editoracao` (read)
- POST / - Criar: `admin`, `gerente_marketing`
- PUT /:id - Atualizar: `admin`, `gerente_marketing`

---

### 2. Media (`/api/media`)

**Rotas:**
- GET / - Listar: `admin`, `gerente_marketing`, `editoracao`, `visualizador`
- POST /upload - Upload: `admin`, `gerente_marketing`, `editoracao`
- PUT /:id - Atualizar: `admin`, `gerente_marketing`, `editoracao`
- DELETE /:id - Deletar: `admin`, `gerente_marketing`, `editoracao`

---

### 3. Playlists (`/api/playlists`)

**Rotas:**
- GET / - Listar: `admin`, `gerente_marketing`, `visualizador`
- POST / - Criar: `admin`, `gerente_marketing`
- PUT /:id - Atualizar: `admin`, `gerente_marketing`
- DELETE /:id - Deletar: `admin`, `gerente_marketing`

---

### 4. Reports (`/api/reports`)

**Rotas:**
- GET / - Listar: `admin`, `gerente_marketing`, `visualizador`
- GET /stats - Estatísticas: `admin`, `gerente_marketing`, `visualizador`
- POST / - Criar: `admin`, `gerente_marketing`
- DELETE /:id - Deletar: `admin`, `gerente_marketing`

---

### 5. Analytics (`/api/analytics`)

**Rotas:**
- GET /dashboard - Dashboard: `admin`, `gerente_marketing`, `visualizador`
- GET /performance - Performance: `admin`, `gerente_marketing`, `visualizador`
- GET /revenue - Receita: `admin`, `gerente_marketing`, `visualizador`
- GET /alerts - Alertas: `admin`, `gerente_marketing`, `visualizador`

---

### 6. Billing (`/api/billing`)

**Rotas:**
- Todas as rotas: Apenas `admin` (não incluir gerente_marketing)

---

### 7. Tags (`/api/tags`)

**Rotas:**
- GET / - Listar: `admin`, `gerente_marketing`, `editoracao`
- POST / - Criar: `admin`, `gerente_marketing`, `editoracao`
- PUT /:id - Atualizar: `admin`, `gerente_marketing`
- DELETE /:id - Deletar: `admin`, `gerente_marketing`

---

### 8. SmartDisplayFX (`/api/smartdisplayfx`)

**Rotas:**
- GET /logs - Logs: `admin`, `gerente_marketing`, `visualizador`
- POST /events/interaction - Eventos: `admin`, `gerente_marketing`

---

### 9. Smart Playlist (`/api/smart-playlist`)

**Rotas:**
- GET /stats - Estatísticas: `admin`, `gerente_marketing`
- DELETE /:id - Deletar: `admin`, `gerente_marketing`
- POST /bulk-generate - Gerar em massa: `admin`, `gerente_marketing`

---

### 10. Totems (`/api/totems`)

**Rotas:**
- Ações técnicas (restart, screenshot, logs): `admin`, `operator`
- Gerenciamento (create, update, delete): `admin`
- Leitura: `admin`, `gerente_marketing`, `visualizador`

---

## 🔧 MIDDLEWARE DE VALIDAÇÃO POR AÇÃO

Criar middleware para validar ações baseadas em permissões:

```typescript
// backend/src/middleware/validateAction.middleware.ts

export const validateAction = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    // Mapeamento de roles e ações permitidas
    const roleActions: Record<string, string[]> = {
      'admin': ['read', 'create', 'update', 'delete'],
      'gerente_marketing': ['read', 'create', 'update', 'delete'], // Para marketing
      'editoracao': ['read', 'create', 'update', 'delete'], // Apenas para medias
      'visualizador': ['read']
    };
    
    const allowedActions = roleActions[userRole] || [];
    
    if (!allowedActions.includes(action)) {
      return res.status(403).json({
        error: 'Ação não permitida para sua role',
        code: 'ACTION_NOT_ALLOWED',
        role: userRole,
        resource,
        action
      });
    }
    
    next();
  };
};
```

---

## 📝 RESUMO DAS MUDANÇAS

### Roles Substituídas:
- `manager` → `gerente_marketing` (para marketing)
- `viewer` → `visualizador` (para visualização)
- `editoracao` → Novo role (para edição de conteúdo)

### Permissões por Role:

| Ação | ADMIN | GERENTE_MARKETING | EDITORACAO | VISUALIZADOR |
|------|-------|-------------------|------------|--------------|
| **Campanhas** | ✅ Todas | ✅ Todas | ✅ (read) | ✅ (read) |
| **Mídias** | ✅ Todas | ✅ Todas | ✅ (read/create/update/delete) | ✅ (read) |
| **Playlists** | ✅ Todas | ✅ Todas | ❌ | ✅ (read) |
| **Relatórios** | ✅ Todas | ✅ (read/create) | ❌ | ✅ (read) |
| **Analytics** | ✅ Todas | ✅ (read) | ❌ | ✅ (read) |
| **Billing** | ✅ Todas | ❌ | ❌ | ❌ |
| **Tags** | ✅ Todas | ✅ Todas | ✅ (read/create) | ❌ |

---

**Última atualização:** 2024-01-XX

