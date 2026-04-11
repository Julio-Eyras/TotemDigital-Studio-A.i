# Checklist de Aplicação - Implementação Completa

## ✅ IMPLEMENTAÇÃO CONCLUÍDA

Todas as funcionalidades foram implementadas com sucesso! Agora siga este checklist para aplicar as mudanças.

---

## 📋 CHECKLIST DE APLICAÇÃO

### Fase 1: Banco de Dados ⚠️ OBRIGATÓRIO

- [ ] **Aplicar Migration 002**
  ```bash
  # Opção 1: Script automatizado
  ./scripts/apply-migration-002.sh
  
  # Opção 2: Manual
  psql -U smartsignage -d smartsignage -f database/migrations/002-add-flags-and-operator-roles.sql
  ```

- [ ] **Verificar Tabelas Criadas**
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_name IN ('user_flags', 'role_flags_default');
  ```

- [ ] **Verificar Roles Criadas**
  ```sql
  SELECT name FROM roles 
  WHERE name IN ('owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial');
  ```

- [ ] **Verificar Flags Padrão**
  ```sql
  SELECT COUNT(*) FROM role_flags_default;
  -- Deve retornar pelo menos 8
  ```

---

### Fase 2: Backend ⚠️ OBRIGATÓRIO

- [ ] **Rebuild Backend**
  ```bash
  cd backend
  npm install
  npm run build
  ```

- [ ] **Verificar Imports**
  - ✅ `detectSubdomain` e `validateSubdomainAccess` importados em `index.ts`
  - ✅ Middlewares aplicados antes das rotas

- [ ] **Reiniciar Backend**
  ```bash
  # Se usando PM2
  pm2 restart smartsignage-backend
  
  # Se usando systemd
  sudo systemctl restart smartsignage-backend
  
  # Ou manualmente
  npm start
  ```

- [ ] **Verificar Logs**
  ```bash
  tail -f backend/logs/app.log
  # Verificar se não há erros de importação
  ```

---

### Fase 3: Frontend ⚠️ OBRIGATÓRIO

- [ ] **Rebuild Frontend**
  ```bash
  cd frontend
  npm install
  npm run build
  ```

- [ ] **Verificar Build**
  - ✅ Sem erros de TypeScript
  - ✅ Sem erros de lint

- [ ] **Reiniciar Frontend** (se aplicável)
  ```bash
  # Se usando servidor de desenvolvimento
  npm start
  
  # Se usando Nginx, apenas rebuild é suficiente
  ```

---

### Fase 4: Testes Básicos ✅ RECOMENDADO

- [ ] **Testar Login**
  - Fazer login com usuário existente
  - Verificar se `user.flags` está presente na resposta

- [ ] **Testar Menus**
  - Verificar se menus são filtrados por role
  - Verificar se menus duplicados foram removidos

- [ ] **Testar Rotas Protegidas**
  - Tentar acessar `/totems` (requer `flag_smart_0`)
  - Tentar acessar `/smart-tvs` (requer `flag_smart_0`)
  - Verificar se acesso é negado sem flag

- [ ] **Testar Relação 1:N**
  - Criar totem
  - Adicionar múltiplas Smart TVs ao totem
  - Verificar endpoint `/api/totems/:id/smart-tvs`

---

### Fase 5: Infraestrutura (Opcional - Produção) 📝

- [ ] **Configurar DNS**
  - Registrar `publisher.sistema.com`
  - Registrar `subscriber.sistema.com`

- [ ] **Configurar Nginx**
  - Seguir guia em `docs/CONFIGURACAO_INFRAESTRUTURA_SUBDOMINIOS.md`
  - Criar server blocks para cada subdomínio

- [ ] **Configurar SSL/TLS**
  - Obter certificados Let's Encrypt
  - Configurar HTTPS

- [ ] **Testar Subdomínios**
  - Acessar `publisher.sistema.com` → Deve carregar PublisherLayout
  - Acessar `subscriber.sistema.com` → Deve carregar SubscriberLayout
  - Acessar `sistema.com` → Deve carregar Layout padrão

---

## 🧪 TESTES DETALHADOS

### Teste 1: Sistema de Flags

```bash
# 1. Fazer login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senha"}'

# 2. Verificar resposta - deve incluir flags
# 3. Tentar acessar rota protegida
curl -X GET http://localhost:3000/api/totems \
  -H "Authorization: Bearer TOKEN"
```

### Teste 2: Relação 1:N (Totem → Smart TVs)

```bash
# 1. Listar Smart TVs de um totem
curl -X GET http://localhost:3000/api/totems/1/smart-tvs \
  -H "Authorization: Bearer TOKEN"

# 2. Criar múltiplas Smart TVs para o mesmo totem
curl -X POST http://localhost:3000/api/smart-tvs \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 1, "identifier": "TV-001", ...}'

curl -X POST http://localhost:3000/api/smart-tvs \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totem_id": 1, "identifier": "TV-002", ...}'

# 3. Verificar se ambas foram criadas
curl -X GET http://localhost:3000/api/totems/1/smart-tvs \
  -H "Authorization: Bearer TOKEN"
```

### Teste 3: Subdomínios (se configurado)

```bash
# 1. Testar detecção de subdomínio
curl -H "Host: publisher.sistema.com" http://localhost:3000/api/health

# 2. Verificar header X-Subdomain-Type na resposta
```

---

## 🆘 TROUBLESHOOTING

### Erro: "Cannot find module './middleware/subdomain.middleware'"

**Solução:** Verificar se o arquivo existe e rebuild do backend:
```bash
cd backend
npm run build
```

### Erro: "Table 'user_flags' does not exist"

**Solução:** Aplicar migration:
```bash
./scripts/apply-migration-002.sh
```

### Erro: "Flag not found" no frontend

**Solução:** Verificar se flags estão sendo carregadas no login. Verificar `authSlice.ts` e resposta da API de login.

### Layout errado sendo carregado

**Solução:** 
1. Verificar `window.location.hostname` no console do navegador
2. Verificar se subdomínio está configurado corretamente
3. Verificar logs do backend para ver qual subdomínio foi detectado

---

## 📊 VALIDAÇÃO FINAL

Após aplicar todas as mudanças, verifique:

- [ ] ✅ Migration aplicada sem erros
- [ ] ✅ Backend inicia sem erros
- [ ] ✅ Frontend compila sem erros
- [ ] ✅ Login funciona e carrega flags
- [ ] ✅ Menus são filtrados corretamente
- [ ] ✅ Rotas protegidas funcionam
- [ ] ✅ Relação 1:N funciona (Totem → Smart TVs)
- [ ] ✅ Subdomínios funcionam (se configurados)

---

## 🎉 CONCLUSÃO

Se todos os itens acima estão marcados, a implementação está **100% completa e funcional**!

**Próximos passos opcionais:**
- Configurar infraestrutura de produção (DNS, Nginx, SSL)
- Criar usuários com novas roles
- Personalizar flags por usuário
- Expandir sistema de flags conforme necessário

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
