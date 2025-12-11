# Correções de Erros da API

## Problemas Identificados e Corrigidos

### 1. Erro 400/500 em várias rotas (campaigns, playlists, qr-codes, reports)
**Causa:** O middleware de autenticação definia apenas `req.user.id`, mas várias rotas usavam `req.user.userId`

**Correção:** Adicionado `userId` como alias de `id` no middleware de autenticação

**Arquivo corrigido:** `backend/src/middleware/auth.middleware.ts`

### 2. Erro 500 em `/api/reports/types`
**Causa:** A rota `/types` estava DEPOIS da rota `/:id`, então Express capturava `/types` como `/:id` com `id='types'`

**Correção:** Movida rota `/types` para ANTES de `/:id`

**Arquivo corrigido:** `backend/src/routes/reports.ts`

### 3. Erro de extensões do navegador no console
**Causa:** Extensões do Chrome/Edge interceptam mensagens

**Correção:** Adicionado tratamento para suprimir esse erro específico

**Arquivo corrigido:** `frontend/src/index.tsx`

## Como Aplicar as Correções no Servidor

### Passo 1: Atualizar código do repositório
```bash
cd /home/smartchannel/smartsignage-pro-main
git pull origin main
```

### Passo 2: Recompilar o backend
```bash
cd backend
npm run build
```

### Passo 3: Reiniciar o serviço
```bash
sudo systemctl restart smart-signage
```

### Passo 4: Verificar logs
```bash
sudo journalctl -u smart-signage -f
```

## Verificação

Após aplicar as correções, verifique se os erros foram resolvidos:

1. **Erro 400 em playlists:** Deve funcionar ao criar playlist
2. **Erro 500 em `/api/reports/types`:** Deve retornar lista de tipos
3. **Erro 500 em `/api/qr-codes`:** Deve listar QR codes corretamente
4. **Erro de extensões:** Não deve mais aparecer no console

## Notas

- Todas as correções foram commitadas e enviadas para o repositório
- O código TypeScript está correto, apenas precisa ser recompilado
- Os erros não afetam a funcionalidade, mas poluem o console e podem causar problemas de UX

