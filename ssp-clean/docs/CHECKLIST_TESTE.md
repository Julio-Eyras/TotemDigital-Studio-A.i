# Checklist de Teste - Sistema Integrado

## ✅ Pré-requisitos

- [ ] PostgreSQL instalado e rodando
- [ ] Node.js instalado (v18+)
- [ ] Nginx instalado
- [ ] Permissões sudo disponíveis

---

## 🗄️ Banco de Dados

### Schema
- [ ] Schema aplicado sem erros
- [ ] Tabela `user_flags` existe
- [ ] Tabela `role_flags_default` existe
- [ ] Função `get_user_effective_flags()` existe

### Dados Iniciais
- [ ] Role `owner_system` criada
- [ ] Role `operador_tecnico` criada
- [ ] Role `operador_faturamento` criada
- [ ] Role `operador_comercial` criada
- [ ] Flags padrão configuradas (8+ roles)

### Validação SQL
- [ ] `SELECT * FROM get_user_effective_flags(1);` funciona
- [ ] Owner system retorna todas flags true
- [ ] Flags padrão estão corretas por role

---

## 🌐 Nginx

### Configuração
- [ ] `sudo nginx -t` passa sem erros
- [ ] Server block principal configurado (porta 8080)
- [ ] Server block `publisher.*` configurado
- [ ] Server block `subscriber.*` configurado
- [ ] Header `X-Subdomain-Type: main` configurado
- [ ] Header `X-Subdomain-Type: publisher` configurado
- [ ] Header `X-Subdomain-Type: subscriber` configurado

### Funcionamento
- [ ] Nginx está rodando
- [ ] Porta 80 responde (player)
- [ ] Porta 8080 responde (admin)
- [ ] Subdomínios respondem corretamente

---

## 🔧 Backend

### Inicialização
- [ ] Backend inicia sem erros
- [ ] Conexão com banco de dados OK
- [ ] Middlewares carregados corretamente

### Autenticação
- [ ] Login funciona
- [ ] Token JWT é gerado
- [ ] Flags são carregadas no `req.user`
- [ ] Função SQL é usada (verificar logs)

### Rotas Protegidas
- [ ] Rotas com `requireFlag()` funcionam
- [ ] Acesso negado quando flag não existe
- [ ] Acesso permitido quando flag existe

---

## 🎨 Frontend

### Build
- [ ] Frontend compila sem erros
- [ ] Build gerado em `frontend/build/`

### Detecção de Subdomínio
- [ ] Domínio principal carrega `Layout`
- [ ] `publisher.*` carrega `PublisherLayout`
- [ ] `subscriber.*` carrega `SubscriberLayout`

### Redux Store
- [ ] User está no store após login
- [ ] Flags estão no `user.flags`
- [ ] Flags são array de strings

### Componentes
- [ ] `FlagGuard` funciona corretamente
- [ ] `useFlags` hook funciona
- [ ] Menu filtra por flags/roles

---

## 🔐 Segurança

### Isolamento de Dados
- [ ] Publisher só vê seus próprios dados
- [ ] Subscriber só vê seus próprios dados
- [ ] Admin vê todos os dados

### Permissões
- [ ] Flags bloqueiam acesso corretamente
- [ ] Owner system tem acesso total
- [ ] Operadores têm acesso limitado

---

## 📊 Performance

### Banco de Dados
- [ ] Função SQL é mais rápida que queries múltiplas
- [ ] Índices estão criados

### Backend
- [ ] Flags são carregadas uma vez por requisição
- [ ] Cache funciona (se implementado)

---

## 🐛 Problemas Encontrados

### Erros
- [ ] Listar erros encontrados:
  - 
  - 
  - 

### Avisos
- [ ] Listar avisos encontrados:
  - 
  - 
  - 

---

## ✅ Resultado Final

- [ ] **TODOS OS TESTES PASSARAM**
- [ ] Sistema está pronto para uso
- [ ] Documentação está completa

---

**Data do Teste:** _______________
**Testado por:** _______________
**Versão Testada:** _______________
