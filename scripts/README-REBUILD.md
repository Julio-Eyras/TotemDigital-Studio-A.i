# 🔄 Scripts de Rebuild e Restart - Smart Signage Pro

Guia rápido para rebuild e restart do backend e frontend após atualizações.

## 📋 Scripts Disponíveis

### Ubuntu/Linux (Bash)

#### 1. **Rebuild Backend Apenas**
```bash
./scripts/rebuild-backend.sh
```
- Limpa cache do backend
- Recompila TypeScript
- Reinicia o servidor backend

#### 2. **Rebuild Frontend Apenas**
```bash
./scripts/rebuild-frontend.sh
```
- Limpa cache do frontend (webpack, React, ESLint)
- Recompila React
- Cria build de produção em `frontend/build/`

#### 3. **Rebuild Completo (Backend + Frontend)**
```bash
./scripts/rebuild-all.sh
```
- Executa rebuild do backend e frontend sequencialmente
- Reinicia Nginx automaticamente se estiver instalado

#### 4. **Limpar Cache Apenas (sem recompilar)**
```bash
./scripts/clean-cache.sh
```
- Limpa todos os caches sem recompilar
- Útil quando você quer apenas limpar cache manualmente

#### 5. **Forçar Rebuild Completo (quando mudanças não aparecem)**
```bash
./scripts/force-rebuild-frontend.sh
```
- **Use quando mudanças não aparecem após rebuild normal**
- Limpeza AGRESSIVA de cache
- Rebuild forçado com variáveis de ambiente limpas
- Verifica se arquivos estão no código fonte
- Opção `--reinstall` para reinstalar dependências

#### 6. **Verificar Build (diagnóstico)**
```bash
./scripts/verify-frontend-build.sh
```
- Verifica se o build está atualizado
- Compara datas dos arquivos fonte vs build
- Verifica se TotemPlayList está no build
- Verifica configuração do Nginx

### Script Completo Existente
```bash
./scripts/dev-build-restart.sh
```
- Script completo que faz tudo: para serviços, compila e reinicia
- Mais completo, mas mais lento (compila tudo sempre)

## 🔧 O Que Cada Script Faz

### Backend (rebuild-backend.sh)
1. ✅ Para processos Node.js do backend
2. ✅ Limpa pasta `backend/dist/`
3. ✅ Limpa cache do node_modules
4. ✅ Limpa cache do TypeScript (`*.tsbuildinfo`)
5. ✅ Limpa cache do npm
6. ✅ Recompila TypeScript (`npm run build`)
7. ✅ Reinicia backend em background
8. ✅ Verifica health check

### Frontend (rebuild-frontend.sh)
1. ✅ Para processos Node.js do frontend (porta 3001)
2. ✅ Limpa pasta `frontend/build/`
3. ✅ Limpa cache do webpack/react (`node_modules/.cache`)
4. ✅ Limpa cache do React (`.cache`)
5. ✅ Limpa cache do ESLint (`.eslintcache`)
6. ✅ Limpa todos os caches do webpack em node_modules
7. ✅ Limpa cache do npm
8. ✅ Aplica patches (patch-package)
9. ✅ Recompila React (`npm run build`)

## 🚀 Uso Rápido

### Após atualizar código do backend:
```bash
./scripts/rebuild-backend.sh
```

### Após atualizar código do frontend:
```bash
./scripts/rebuild-frontend.sh
```

### Após atualizar ambos:
```bash
./scripts/rebuild-all.sh
```

### Apenas limpar cache (sem recompilar):
```bash
./scripts/clean-cache.sh
```

**Nota:** Certifique-se de que os scripts têm permissão de execução:
```bash
chmod +x scripts/*.sh
```

## 📝 Comandos Manuais (se preferir)

### Backend:
```bash
# 1. Parar backend
pkill -f "node.*dist/index.js" || lsof -ti:3000 | xargs kill -9

# 2. Limpar cache
cd backend
rm -rf dist node_modules/.cache
rm -f *.tsbuildinfo
npm cache clean --force

# 3. Recompilar
npm run build

# 4. Reiniciar
npm start
```

### Frontend:
```bash
# 1. Parar frontend (se em dev mode)
lsof -ti:3001 | xargs kill -9 || pkill -f "react-scripts"

# 2. Limpar cache
cd frontend
rm -rf build node_modules/.cache .cache .eslintcache
find node_modules -type d -name ".cache" -exec rm -rf {} +
npm cache clean --force

# 3. Recompilar
npm run build
```

## ⚠️ Problemas Comuns

### Código antigo ainda está rodando?
1. Execute `./scripts/rebuild-backend.sh` ou `./scripts/rebuild-frontend.sh`
2. Os scripts param todos os processos antes de recompilar

### Mudanças não aparecem no frontend após rebuild?
**Este é um problema comum!** Siga estes passos:

1. **Forçar rebuild completo:**
   ```bash
   ./scripts/force-rebuild-frontend.sh
   ```
   Este script faz limpeza agressiva de cache e rebuild forçado.

2. **Limpar cache do NAVEGADOR:**
   - Chrome/Edge: `Ctrl+Shift+Delete` → Limpar cache
   - Firefox: `Ctrl+Shift+Delete` → Limpar cache
   - Ou use: `Ctrl+Shift+R` (hard refresh)

3. **Verificar se build foi atualizado:**
   ```bash
   ./scripts/verify-frontend-build.sh
   ```

4. **Se ainda não aparecer:**
   - Verifique se os arquivos estão no código fonte:
     ```bash
     ls -la frontend/src/pages/TotemPlayList/
     grep -r "totem-playlists" frontend/src/App.tsx
     ```
   - Verifique logs do navegador: `F12` → Console → Verificar erros
   - Verifique se Nginx está servindo o build correto:
     ```bash
     sudo systemctl reload nginx
     ```

### Cache não está sendo limpo?
1. Execute `./scripts/clean-cache.sh` primeiro
2. Depois execute o rebuild novamente
3. Para limpeza mais agressiva, use `./scripts/force-rebuild-frontend.sh`

### Build falha após atualização?
1. Limpe cache: `./scripts/clean-cache.sh`
2. Reinstale dependências: `npm install` (em backend ou frontend)
3. Execute rebuild novamente
4. Se persistir, use `./scripts/force-rebuild-frontend.sh --reinstall`

### Permissão negada ao executar script?
```bash
chmod +x scripts/*.sh
```

## 📊 Verificar Status

### Backend rodando?
```bash
curl http://localhost:3000/health
```

### Frontend build criado?
```bash
test -f frontend/build/index.html && echo "Build existe" || echo "Build não encontrado"
```

### Processos Node rodando?
```bash
ps aux | grep node
```

### Porta 3000 em uso?
```bash
lsof -i:3000
```

### Porta 3001 em uso?
```bash
lsof -i:3001
```
