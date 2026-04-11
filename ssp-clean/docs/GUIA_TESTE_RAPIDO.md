# Guia de Teste Rápido - Sistema Integrado

## 🚀 Teste de Instalação Completa

### 1. Instalação do Zero

```bash
# Executar instalação fresh
./scripts/install-smartsignage.sh --fresh
```

**O que verificar:**
- ✅ Schema aplicado sem erros
- ✅ Tabelas `user_flags` e `role_flags_default` criadas
- ✅ Função `get_user_effective_flags()` criada
- ✅ Novas roles inseridas
- ✅ Nginx configurado com subdomínios

---

## 🗄️ Validação do Banco de Dados

### Verificar Tabelas

```sql
-- 1. Verificar tabelas de flags
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('user_flags', 'role_flags_default');
-- Deve retornar 2 linhas

-- 2. Verificar estrutura
\d user_flags
\d role_flags_default
```

### Verificar Roles

```sql
-- Verificar novas roles
SELECT name, description FROM roles 
WHERE name IN ('owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial');
-- Deve retornar 4 linhas
```

### Verificar Flags Padrão

```sql
-- Verificar flags padrão configuradas
SELECT role, 
       flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
       flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
FROM role_flags_default
ORDER BY role;
-- Deve retornar pelo menos 8 roles
```

### Testar Função SQL

```sql
-- Testar função get_user_effective_flags
-- (Substitua 1 pelo ID de um usuário existente)
SELECT * FROM get_user_effective_flags(1);

-- Verificar se owner_system retorna todas true
SELECT * FROM get_user_effective_flags(
  (SELECT id FROM users WHERE role = 'owner_system' LIMIT 1)
);
-- Todas as flags devem ser true
```

---

## 🌐 Validação do Nginx

### Verificar Configuração

```bash
# Testar configuração do Nginx
sudo nginx -t
# Deve retornar: "syntax is ok" e "test is successful"

# Verificar server blocks
sudo grep -A 2 "server_name" /etc/nginx/sites-available/smart-signage
# Deve mostrar:
# - server_name _; (principal)
# - server_name publisher.*; (publisher)
# - server_name subscriber.*; (subscriber)
```

### Verificar Headers

```bash
# Verificar se headers X-Subdomain-Type estão configurados
sudo grep "X-Subdomain-Type" /etc/nginx/sites-available/smart-signage
# Deve mostrar 3 ocorrências:
# - X-Subdomain-Type main
# - X-Subdomain-Type publisher
# - X-Subdomain-Type subscriber
```

---

## 🔧 Validação do Backend

### Verificar Logs

```bash
# Verificar se backend iniciou sem erros
# (Ajuste o caminho conforme sua instalação)
tail -f /opt/smart-signage/backend/logs/app.log

# Ou se estiver usando Docker
docker logs smartsignage-backend
```

### Testar Endpoint de Flags

```bash
# Fazer login e obter token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"senha"}' | jq -r '.token')

# Verificar se flags estão sendo carregadas
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN" | jq '.flags'
# Deve retornar objeto com flags (flag_smart_0 a flag_smart_9)
```

### Testar Middleware de Flags

```bash
# Testar rota protegida por flag
# (Ajuste conforme suas rotas)
curl -X GET http://localhost:3000/api/totems \
  -H "Authorization: Bearer $TOKEN"
# Deve retornar lista de totens se flag_smart_0 estiver ativa
```

---

## 🎨 Validação do Frontend

### Verificar Detecção de Subdomínio

1. **Acessar domínio principal:**
   ```
   http://localhost:8080
   ```
   - Deve carregar layout principal

2. **Acessar subdomínio publisher:**
   ```
   http://publisher.localhost:8080
   ```
   - Deve carregar `PublisherLayout`
   - Menu deve mostrar opções de publisher

3. **Acessar subdomínio subscriber:**
   ```
   http://subscriber.localhost:8080
   ```
   - Deve carregar `SubscriberLayout`
   - Menu deve mostrar opções de subscriber

### Verificar Flags no Frontend

1. **Fazer login**
2. **Verificar Redux Store:**
   ```javascript
   // No console do navegador
   window.__REDUX_DEVTOOLS_EXTENSION__ && 
   window.__REDUX_DEVTOOLS_EXTENSION__.connect()
   // Verificar se user.flags está presente
   ```

3. **Testar FlagGuard:**
   - Componentes protegidos devem aparecer/desaparecer conforme flags

---

## ✅ Checklist de Validação

### Banco de Dados
- [ ] Tabelas `user_flags` e `role_flags_default` existem
- [ ] Novas roles foram criadas (4 roles)
- [ ] Flags padrão foram configuradas (8+ roles)
- [ ] Função `get_user_effective_flags()` funciona

### Nginx
- [ ] Configuração válida (`nginx -t` passa)
- [ ] Server blocks para subdomínios configurados
- [ ] Headers `X-Subdomain-Type` configurados

### Backend
- [ ] Backend inicia sem erros
- [ ] Flags são carregadas no middleware de auth
- [ ] Função SQL é usada (verificar logs)
- [ ] Rotas protegidas por flags funcionam

### Frontend
- [ ] Detecção de subdomínio funciona
- [ ] Layouts corretos são carregados
- [ ] Flags aparecem no Redux store
- [ ] Menu filtra por flags/roles

---

## 🐛 Problemas Comuns

### Função SQL não encontrada
```sql
-- Verificar se função existe
SELECT proname FROM pg_proc WHERE proname = 'get_user_effective_flags';
-- Se não existir, executar part9-triggers-functions.sql
```

### Nginx não reconhece subdomínios
```bash
# Verificar se server_name está correto
sudo grep "server_name" /etc/nginx/sites-available/smart-signage

# Recarregar Nginx
sudo nginx -s reload
```

### Flags não aparecem no frontend
```javascript
// Verificar se backend está retornando flags
// No Network tab, verificar resposta de /api/users/me
// Deve incluir campo "flags"
```

---

## 📝 Próximos Passos

1. **Criar usuários de teste** com diferentes roles
2. **Testar permissões** por flag
3. **Validar isolamento** de dados (publisher/subscriber)
4. **Testar subdomínios** em produção (com DNS configurado)

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
**Status:** ✅ Pronto para Teste
