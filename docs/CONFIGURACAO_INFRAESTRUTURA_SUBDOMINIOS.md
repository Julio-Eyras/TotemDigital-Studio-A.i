# Configuração de Infraestrutura - Subdomínios

## 📋 Visão Geral

**✅ AUTOMATIZADO NO SCRIPT DE INSTALAÇÃO**

A configuração de subdomínios está **automaticamente integrada** no `install-smartsignage.sh`. 
Este documento descreve a configuração e como personalizar se necessário.

**Subdomínios suportados:**
- `sistema.com` (ou `smartsignage.com`) - Interface principal
- `publisher.sistema.com` - Interface para publishers
- `subscriber.sistema.com` - Interface para subscribers

**Nota:** O Nginx é configurado automaticamente durante a instalação com suporte a subdomínios.

---

## 🌐 1. CONFIGURAÇÃO DNS

### 1.1. Registrar Subdomínios

No seu provedor de DNS, adicione os seguintes registros:

```
Tipo    Nome              Valor              TTL
A       @                 192.168.1.100      3600
A       publisher         192.168.1.100      3600
A       subscriber        192.168.1.100      3600
CNAME   www               sistema.com        3600
```

**Nota:** Substitua `192.168.1.100` pelo IP do seu servidor.

### 1.2. Verificar DNS

```bash
# Verificar resolução DNS
dig sistema.com
dig publisher.sistema.com
dig subscriber.sistema.com

# Ou usando nslookup
nslookup publisher.sistema.com
nslookup subscriber.sistema.com
```

---

## 🔧 2. CONFIGURAÇÃO NGINX

### 2.1. Arquivo de Configuração Principal

Crie ou edite `/etc/nginx/sites-available/smartsignage`:

```nginx
# =============================================
# Smart Signage Pro - Configuração Nginx
# =============================================

# Upstream para o backend Node.js
upstream backend {
    server localhost:3000;
    keepalive 64;
}

# =============================================
# SERVER: Domínio Principal (sistema.com)
# =============================================
server {
    listen 80;
    listen [::]:80;
    server_name sistema.com www.sistema.com;

    # Redirecionar HTTP para HTTPS (opcional)
    # return 301 https://$server_name$request_uri;

    # Ou servir diretamente (desenvolvimento)
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# =============================================
# SERVER: Subdomínio Publisher (publisher.sistema.com)
# =============================================
server {
    listen 80;
    listen [::]:80;
    server_name publisher.sistema.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Subdomain-Type publisher;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# =============================================
# SERVER: Subdomínio Subscriber (subscriber.sistema.com)
# =============================================
server {
    listen 80;
    listen [::]:80;
    server_name subscriber.sistema.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Subdomain-Type subscriber;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 2.2. Configuração HTTPS (SSL/TLS) - Produção

Para produção, configure SSL usando Let's Encrypt:

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obter certificados para todos os domínios
sudo certbot --nginx -d sistema.com -d www.sistema.com -d publisher.sistema.com -d subscriber.sistema.com

# Certbot irá atualizar automaticamente os arquivos do Nginx
```

### 2.3. Ativar Configuração

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/smartsignage /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

---

## 🔒 3. CONFIGURAÇÃO SSL/TLS (OPCIONAL - PRODUÇÃO)

### 3.1. Configuração Nginx com SSL

Após obter os certificados, o Nginx será atualizado automaticamente. Exemplo:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name publisher.sistema.com;

    ssl_certificate /etc/letsencrypt/live/sistema.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sistema.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://backend;
        # ... (mesmas configurações de proxy)
    }
}
```

---

## ⚙️ 4. VARIÁVEIS DE AMBIENTE

### 4.1. Backend (.env)

Adicione as seguintes variáveis ao arquivo `.env` do backend:

```env
# Subdomínios
PUBLISHER_SUBDOMAIN=publisher.sistema.com
SUBSCRIBER_SUBDOMAIN=subscriber.sistema.com
MAIN_DOMAIN=sistema.com

# CORS - Adicionar subdomínios
CORS_ORIGIN=http://sistema.com,http://www.sistema.com,http://publisher.sistema.com,http://subscriber.sistema.com,https://sistema.com,https://www.sistema.com,https://publisher.sistema.com,https://subscriber.sistema.com
```

### 4.2. Frontend

O frontend detecta automaticamente o subdomínio via `window.location.hostname`, não requer configuração adicional.

---

## 🧪 5. TESTES DE CONFIGURAÇÃO

### 5.1. Testar Resolução DNS

```bash
# Verificar se os subdomínios resolvem corretamente
curl -I http://publisher.sistema.com
curl -I http://subscriber.sistema.com
```

### 5.2. Testar Headers

```bash
# Verificar se o header X-Subdomain-Type está sendo enviado
curl -H "Host: publisher.sistema.com" http://localhost -v
```

### 5.3. Testar no Navegador

1. Acesse `http://publisher.sistema.com` - Deve carregar PublisherLayout
2. Acesse `http://subscriber.sistema.com` - Deve carregar SubscriberLayout
3. Acesse `http://sistema.com` - Deve carregar Layout padrão

---

## 🔍 6. TROUBLESHOOTING

### Problema: Subdomínio não resolve

**Solução:**
```bash
# Verificar DNS
dig publisher.sistema.com

# Verificar configuração Nginx
sudo nginx -t

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

### Problema: Layout errado sendo carregado

**Solução:**
1. Verificar console do navegador (F12)
2. Verificar se `window.location.hostname` está correto
3. Verificar logs do backend para ver qual subdomínio foi detectado

### Problema: CORS bloqueando requisições

**Solução:**
1. Adicionar subdomínios ao `CORS_ORIGIN` no `.env`
2. Reiniciar o backend
3. Verificar headers CORS na resposta

---

## 📝 7. CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Registrar subdomínios no DNS
- [ ] Configurar Nginx com server blocks para cada subdomínio
- [ ] Adicionar variáveis de ambiente no backend
- [ ] Testar resolução DNS
- [ ] Testar acesso aos subdomínios
- [ ] Configurar SSL/TLS (produção)
- [ ] Testar layouts específicos
- [ ] Verificar isolamento de dados por subdomínio

---

## 🚀 8. COMANDOS RÁPIDOS

```bash
# Recarregar Nginx
sudo systemctl reload nginx

# Verificar status do Nginx
sudo systemctl status nginx

# Ver logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Testar configuração Nginx
sudo nginx -t

# Renovar certificados SSL (Let's Encrypt)
sudo certbot renew
```

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
