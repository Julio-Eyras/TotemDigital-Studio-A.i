# Como Acessar as Telas de Login, Publisher e Subscriber

**Data:** 2026-01-03

---

## 🎯 RESUMO RÁPIDO

- ✅ **Backend está funcionando** (porta 3000)
- ❓ **Frontend precisa ser servido** (via Nginx porta 80 ou dev server porta 3001)
- 📍 **URLs corretas** dependem de como o frontend está sendo servido

---

## 🔍 DIAGNÓSTICO

### 1. Verificar se Frontend Foi Compilado

```bash
# Verificar se build existe
ls -la /opt/smart-signage/frontend/build/

# Ou se instalado em outro diretório
ls -la /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/
```

**Se não existir**, o frontend precisa ser compilado:

```bash
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend
npm install
npm run build
```

---

### 2. Verificar se Nginx Está Servindo Frontend

```bash
# Verificar status do Nginx
sudo systemctl status nginx

# Verificar se porta 80 está em uso
sudo netstat -tlnp | grep :80

# Verificar configuração do Nginx
sudo nginx -t

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

---

### 3. Verificar Configuração do Nginx

O Nginx deve estar configurado para servir o frontend de:
- `/opt/smart-signage/frontend/build/` (padrão)

Verificar:

```bash
# Ver configuração do Nginx
sudo cat /etc/nginx/sites-available/smartsignage

# Verificar se root aponta para o build
grep -A 5 "root" /etc/nginx/sites-available/smartsignage
```

---

## 🌐 URLs PARA ACESSAR

### Modo Produção (Nginx na porta 80)

#### 1. Login Principal (Operadores/Admins)
```
http://192.168.1.110/login
```

#### 2. Login Subscriber (Assinantes)
```
http://192.168.1.110/subscriber-login
```

#### 3. Dashboard Principal (após login)
```
http://192.168.1.110/dashboard
```

#### 4. Publisher (via subdomínio)
```
http://publisher.192.168.1.110
```
**OU** (se não tiver DNS configurado):
```
http://192.168.1.110
```
(Detecta automaticamente se é publisher pelo header `X-Subdomain-Type`)

#### 5. Subscriber (via subdomínio)
```
http://subscriber.192.168.1.110
```
**OU** (se não tiver DNS configurado):
```
http://192.168.1.110
```
(Detecta automaticamente se é subscriber pelo header `X-Subdomain-Type`)

---

### Modo Desenvolvimento (Frontend na porta 3001)

Se o frontend estiver rodando em modo desenvolvimento:

```bash
# Iniciar frontend em modo dev
cd frontend
npm start
```

**URLs:**
- Login: `http://192.168.1.110:3001/login`
- Subscriber Login: `http://192.168.1.110:3001/subscriber-login`
- Dashboard: `http://192.168.1.110:3001/dashboard`

---

## 🔧 SOLUÇÃO: Compilar e Servir Frontend

### Passo 1: Compilar Frontend

```bash
# Navegar para diretório do frontend
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend

# Instalar dependências (se necessário)
npm install

# Compilar para produção
npm run build

# Verificar se build foi criado
ls -la build/
```

---

### Passo 2: Verificar Nginx

```bash
# Verificar se Nginx está rodando
sudo systemctl status nginx

# Se não estiver, iniciar
sudo systemctl start nginx

# Verificar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

---

### Passo 3: Verificar Diretório do Build

O Nginx deve apontar para o diretório correto:

```bash
# Verificar onde o build está
ls -la /opt/smart-signage/frontend/build/

# Se não existir, verificar diretório de instalação
ls -la /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/
```

**Se o build estiver em outro lugar**, atualizar configuração do Nginx:

```bash
# Editar configuração
sudo nano /etc/nginx/sites-available/smartsignage

# Atualizar linha "root" para apontar para o build correto
# Exemplo:
# root /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build;

# Recarregar Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧪 TESTE RÁPIDO

### Teste 1: Verificar se Frontend Está Acessível

```bash
# Testar se Nginx está servindo arquivos
curl http://localhost/

# Deve retornar HTML do index.html do React
```

### Teste 2: Verificar Rotas do Frontend

```bash
# Testar rota de login
curl http://localhost/login

# Deve retornar HTML (mesmo conteúdo do index.html, React Router cuida do resto)
```

### Teste 3: Verificar no Navegador

1. Acesse: `http://192.168.1.110`
2. Deve carregar a aplicação React
3. Se não estiver logado, deve redirecionar para `/login`
4. Acesse diretamente: `http://192.168.1.110/login`

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Frontend foi compilado? (`ls -la frontend/build/`)
- [ ] Nginx está rodando? (`sudo systemctl status nginx`)
- [ ] Nginx está servindo o diretório correto? (`grep root /etc/nginx/sites-available/smartsignage`)
- [ ] Porta 80 está aberta? (`sudo netstat -tlnp | grep :80`)
- [ ] Teste local funciona? (`curl http://localhost/`)
- [ ] Teste remoto funciona? (`curl http://192.168.1.110/`)

---

## 🚨 PROBLEMAS COMUNS

### Problema 1: "404 Not Found" ao acessar `/login`

**Causa:** Nginx não está servindo o frontend corretamente

**Solução:**
```bash
# Verificar se build existe
ls -la /opt/smart-signage/frontend/build/index.html

# Verificar configuração do Nginx
sudo nginx -t

# Verificar se root está correto
grep "root" /etc/nginx/sites-available/smartsignage

# Recarregar Nginx
sudo systemctl reload nginx
```

---

### Problema 2: "Cannot GET /login"

**Causa:** Frontend não foi compilado ou Nginx não está configurado para SPA

**Solução:**
```bash
# Compilar frontend
cd frontend && npm run build

# Verificar se Nginx tem try_files configurado
grep "try_files" /etc/nginx/sites-available/smartsignage

# Deve ter: try_files $uri $uri/ /index.html;
```

---

### Problema 3: Página em Branco

**Causa:** Frontend compilado mas assets não estão sendo servidos

**Solução:**
```bash
# Verificar se assets existem
ls -la /opt/smart-signage/frontend/build/static/

# Verificar configuração de arquivos estáticos no Nginx
# Deve ter location /static/ configurado
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Compilar frontend** (se ainda não foi feito)
2. **Verificar Nginx** está servindo o build
3. **Acessar** `http://192.168.1.110/login`
4. **Testar login** com usuário do sistema
5. **Acessar** subdomínios (se configurados)

---

## 📝 NOTAS IMPORTANTES

1. **Backend (porta 3000)** serve apenas a API (`/api/*`)
2. **Frontend (porta 80)** serve a interface web (`/`, `/login`, etc.)
3. **Nginx** faz proxy de `/api/*` para backend na porta 3000
4. **React Router** cuida do roteamento no frontend (SPA)
5. **Subdomínios** são detectados automaticamente pelo frontend

---

**Última atualização:** 2026-01-03
