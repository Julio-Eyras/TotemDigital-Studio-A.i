# Compilação Automática vs Manual

**Data:** 2026-02-16

---

## 📋 Resumo

### ✅ **Modo Desenvolvimento** (Auto-rebuild)
- **Backend:** `npm run dev` → usa **nodemon** (rebuild automático)
- **Frontend:** `npm start` → usa **react-scripts** (hot reload automático)

### ⚠️ **Modo Produção** (Manual)
- **Backend:** Precisa compilar manualmente com `npm run build`
- **Frontend:** Precisa compilar manualmente com `npm run build`
- **Serviços:** Rodam código compilado (não recompilam automaticamente)

---

## 🔄 Como Funciona

### Backend

#### Modo Desenvolvimento (`npm run dev`)
```bash
cd backend
npm run dev
```
- ✅ Usa **nodemon** + **ts-node**
- ✅ Monitora arquivos `.ts` e recompila automaticamente
- ✅ Reinicia servidor quando detecta mudanças
- ✅ Não gera arquivos em `dist/` (executa direto do TypeScript)

#### Modo Produção (`npm run build` + `npm start`)
```bash
cd backend
npm run build  # Compila TypeScript → JavaScript em dist/
npm start      # Executa dist/index.js
```
- ⚠️ Precisa compilar manualmente após mudanças
- ✅ Gera arquivos compilados em `dist/`
- ✅ Serviço systemd usa este modo

---

### Frontend

#### Modo Desenvolvimento (`npm start`)
```bash
cd frontend
npm start
```
- ✅ Usa **react-scripts** (webpack dev server)
- ✅ Hot Module Replacement (HMR)
- ✅ Recompila automaticamente ao salvar arquivos
- ✅ Atualiza browser automaticamente

#### Modo Produção (`npm run build`)
```bash
cd frontend
npm run build
```
- ⚠️ Precisa compilar manualmente após mudanças
- ✅ Gera arquivos otimizados em `build/`
- ✅ Nginx serve arquivos estáticos deste diretório

---

## 🚀 Script de Compilação Manual

Existe um script que compila ambos e reinicia serviços:

```bash
./compila.sh
```

**O que faz:**
1. Compila backend (`npm run build`)
2. Compila frontend (`npm run build`)
3. Reinicia serviço `smart-signage` (backend)
4. Recarrega Nginx (frontend)

---

## 📊 Status Atual do Sistema

### Serviços Rodando (Produção)
- ✅ `smart-signage.service` → Backend compilado
- ✅ `nginx.service` → Frontend estático

### Processos de Desenvolvimento
- ❌ Nenhum processo `nodemon` rodando
- ❌ Nenhum processo `react-scripts` rodando

**Conclusão:** Sistema está rodando em **modo produção** (compilado)

---

## 🔧 Para Aplicar Mudanças

### Opção 1: Script Automatizado (Recomendado)
```bash
./compila.sh
```

### Opção 2: Manual
```bash
# Backend
cd backend && npm run build
sudo systemctl restart smart-signage

# Frontend
cd frontend && npm run build
sudo systemctl reload nginx
```

### Opção 3: Modo Desenvolvimento
```bash
# Backend (terminal 1)
cd backend && npm run dev

# Frontend (terminal 2)
cd frontend && npm start
```

---

## ⚠️ Importante

**Em produção:**
- ⚠️ Mudanças no código **NÃO** são aplicadas automaticamente
- ✅ Precisa compilar manualmente após alterações
- ✅ Reiniciar serviços após compilar

**Em desenvolvimento:**
- ✅ Mudanças são aplicadas automaticamente
- ✅ Hot reload funciona
- ✅ Não precisa reiniciar manualmente

---

## 📝 Checklist Após Alterações

- [ ] Compilar backend: `cd backend && npm run build`
- [ ] Compilar frontend: `cd frontend && npm run build`
- [ ] Reiniciar backend: `sudo systemctl restart smart-signage`
- [ ] Recarregar Nginx: `sudo systemctl reload nginx`
- [ ] Verificar logs: `sudo journalctl -u smart-signage -f`

**Ou simplesmente:** `./compila.sh` ✅
