# Resumo Rápido: Erro 500 Nginx

**Problema:** `500 Internal Server Error` ao acessar `/login` ou `/subscriber-login`

---

## 🔍 DIAGNÓSTICO RÁPIDO (Execute no Servidor)

```bash
# 1. Ver o erro específico nos logs
sudo tail -30 /var/log/nginx/error.log

# 2. Verificar se build existe
ls -la /opt/smart-signage/frontend/build/index.html
# OU
ls -la /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/index.html

# 3. Verificar permissões
ls -la /opt/smart-signage/frontend/build/ | head -3

# 4. Verificar configuração do Nginx
sudo grep "root" /etc/nginx/sites-available/smartsignage
```

---

## 🔧 SOLUÇÃO RÁPIDA

### Opção 1: Script Automático

```bash
# No servidor Linux
chmod +x scripts/fix-nginx-500-error.sh
./scripts/fix-nginx-500-error.sh
```

### Opção 2: Manual

```bash
# 1. Compilar frontend (se necessário)
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend
npm install
npm run build

# 2. Corrigir permissões
sudo chown -R www-data:www-data /opt/smart-signage/frontend/build/
sudo chmod -R 755 /opt/smart-signage/frontend/build/

# 3. Verificar configuração
sudo nginx -t

# 4. Recarregar Nginx
sudo systemctl reload nginx

# 5. Testar
curl http://localhost/login
```

---

## 📋 INFORMAÇÕES NECESSÁRIAS

**Execute e envie o resultado:**

```bash
sudo tail -30 /var/log/nginx/error.log
```

Isso mostrará o erro específico que está causando o 500.

---

**Última atualização:** 2026-01-03
