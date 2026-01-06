# Guia de Teste Rápido - Nginx Subdomínios

## 🚀 Testes Rápidos

### 1. Verificar Configuração Nginx

```bash
# Testar sintaxe do Nginx
sudo nginx -t

# Se houver erros, verificar:
sudo tail -20 /var/log/nginx/error.log
```

### 2. Verificar Configuração Gerada

```bash
# Ver o arquivo de configuração gerado
cat /etc/nginx/sites-available/smart-signage | grep -A 5 "server_name"

# Verificar se os subdomínios estão configurados
grep -E "publisher|subscriber|X-Subdomain-Type" /etc/nginx/sites-available/smart-signage
```

### 3. Testar Subdomínios Localmente (sem DNS)

```bash
# Testar Publisher
curl -H "Host: publisher.sistema.com" http://localhost/api/health -v

# Testar Subscriber
curl -H "Host: subscriber.sistema.com" http://localhost/api/health -v

# Testar Domínio Principal
curl -H "Host: sistema.com" http://localhost/api/health -v
```

### 4. Verificar Headers Enviados

```bash
# Verificar se o header X-Subdomain-Type está sendo enviado
curl -H "Host: publisher.sistema.com" http://localhost/api/health -I | grep -i "subdomain"

# Ou com curl mais detalhado:
curl -H "Host: publisher.sistema.com" http://localhost/api/health -v 2>&1 | grep -i "subdomain"
```

### 5. Testar no Navegador (com /etc/hosts)

Se estiver testando localmente, adicione ao `/etc/hosts`:

```bash
# Editar hosts (Linux/Mac)
sudo nano /etc/hosts

# Adicionar linhas:
127.0.0.1 sistema.com
127.0.0.1 publisher.sistema.com
127.0.0.1 subscriber.sistema.com
```

Depois acesse no navegador:
- `http://sistema.com` - Deve carregar Layout principal
- `http://publisher.sistema.com` - Deve carregar PublisherLayout
- `http://subscriber.sistema.com` - Deve carregar SubscriberLayout

### 6. Verificar Logs do Backend

```bash
# Ver logs do backend para verificar se está recebendo os headers
tail -f /var/log/smartsignage/backend.log

# Ou se estiver rodando via npm:
cd backend && npm run dev
# (verificar console para ver headers recebidos)
```

### 7. Testar Isolamento de Dados

```bash
# Fazer login como Publisher e verificar se só vê seus dados
# Fazer login como Subscriber e verificar se só vê seus dados
```

---

## 🔍 Comandos de Diagnóstico

### Verificar Status do Nginx

```bash
# Status
sudo systemctl status nginx

# Recarregar configuração
sudo systemctl reload nginx

# Reiniciar se necessário
sudo systemctl restart nginx
```

### Verificar Portas em Uso

```bash
# Verificar se porta 80 está em uso
sudo netstat -tlnp | grep :80

# Ou com ss
sudo ss -tlnp | grep :80
```

### Verificar Processos Node

```bash
# Ver se backend está rodando
ps aux | grep node

# Verificar porta 3000
sudo netstat -tlnp | grep :3000
```

---

## ⚠️ Problemas Comuns

### Erro: "nginx: [emerg] bind() to 0.0.0.0:80 failed"

**Causa:** Porta 80 já está em uso

**Solução:**
```bash
# Ver o que está usando a porta 80
sudo lsof -i :80

# Parar o serviço que está usando (ex: Apache)
sudo systemctl stop apache2
```

### Erro: "nginx: [emerg] invalid server_name"

**Causa:** Sintaxe incorreta no server_name

**Solução:**
```bash
# Verificar sintaxe
sudo nginx -t

# Verificar a linha problemática
grep -n "server_name" /etc/nginx/sites-available/smart-signage
```

### Subdomínio não carrega layout correto

**Causa:** Frontend não está detectando o subdomínio

**Solução:**
1. Verificar console do navegador (F12)
2. Verificar se `window.location.hostname` está correto
3. Verificar logs do backend para ver qual subdomínio foi detectado

---

## ✅ Checklist de Validação

- [ ] Nginx inicia sem erros (`sudo nginx -t`)
- [ ] Configuração contém 3 server blocks (principal, publisher, subscriber)
- [ ] Headers `X-Subdomain-Type` estão sendo enviados
- [ ] Backend recebe os headers corretamente
- [ ] Frontend detecta subdomínio e carrega layout correto
- [ ] Isolamento de dados funciona (publisher só vê seus dados)
- [ ] Logs não mostram erros relacionados a subdomínios

---

## 📝 Notas

- Se estiver testando sem DNS, use `/etc/hosts` para mapear domínios localmente
- Para produção, configure DNS apontando para o IP do servidor
- Certifique-se de que o backend está rodando antes de testar
- Verifique se o frontend foi compilado (`npm run build`)

---

**Boa sorte com os testes!** 🚀
