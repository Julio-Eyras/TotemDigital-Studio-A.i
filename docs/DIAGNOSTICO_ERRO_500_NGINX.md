# Diagnóstico: Erro 500 Internal Server Error - Nginx

**Data:** 2026-01-03  
**Problema:** Nginx retorna 500 ao acessar `/subscriber-login` ou `/login`

---

## 🔍 DIAGNÓSTICO RÁPIDO

### 1. Verificar Logs do Nginx

O erro 500 geralmente indica um problema na configuração ou permissões. Os logs mostram o erro específico:

```bash
# Ver logs de erro do Nginx
sudo tail -50 /var/log/nginx/error.log

# Ver logs de acesso
sudo tail -50 /var/log/nginx/access.log
```

**Os logs mostrarão o erro específico!**

---

## 🚨 CAUSAS COMUNS

### Causa 1: Arquivo index.html Não Encontrado

**Sintoma:** Log mostra "No such file or directory"

**Solução:**
```bash
# Verificar se build existe
ls -la /opt/smart-signage/frontend/build/index.html

# Se não existir, verificar diretório de instalação
ls -la /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/index.html

# Se não existir em nenhum lugar, compilar frontend
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend
npm install
npm run build
```

---

### Causa 2: Permissões Incorretas

**Sintoma:** Log mostra "Permission denied"

**Solução:**
```bash
# Verificar permissões do diretório build
ls -la /opt/smart-signage/frontend/build/

# Corrigir permissões
sudo chown -R www-data:www-data /opt/smart-signage/frontend/build/
sudo chmod -R 755 /opt/smart-signage/frontend/build/

# OU se estiver em outro diretório
sudo chown -R www-data:www-data /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/
sudo chmod -R 755 /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/
```

---

### Causa 3: Diretório Root Incorreto no Nginx

**Sintoma:** Nginx está procurando em diretório errado

**Solução:**
```bash
# Verificar configuração do Nginx
sudo grep -A 5 "root" /etc/nginx/sites-available/smartsignage

# Verificar qual diretório está configurado
# Deve apontar para onde o build realmente está

# Se estiver errado, editar:
sudo nano /etc/nginx/sites-available/smartsignage

# Atualizar linha "root" para:
# root /opt/smart-signage/frontend/build;
# OU
# root /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build;

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

---

### Causa 4: Diretório Build Não Existe

**Sintoma:** Build não foi criado

**Solução:**
```bash
# Navegar para frontend
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend

# Verificar se node_modules existe
ls -la node_modules/

# Se não existir, instalar dependências
npm install

# Compilar frontend
npm run build

# Verificar se build foi criado
ls -la build/index.html
```

---

### Causa 5: Erro de Sintaxe no Nginx Config

**Sintoma:** Log mostra erro de sintaxe

**Solução:**
```bash
# Testar configuração
sudo nginx -t

# Se houver erros, corrigir e testar novamente
# Verificar arquivo de configuração
sudo nano /etc/nginx/sites-available/smartsignage
```

---

## 🔧 SOLUÇÃO PASSO A PASSO

### Passo 1: Verificar Logs

```bash
# Ver último erro
sudo tail -20 /var/log/nginx/error.log

# Procurar por erros específicos
sudo grep -i "error\|failed\|denied" /var/log/nginx/error.log | tail -10
```

**Copie o erro específico que aparecer!**

---

### Passo 2: Verificar Build

```bash
# Verificar se build existe
BUILD_DIRS=(
    "/opt/smart-signage/frontend/build"
    "/home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build"
)

for DIR in "${BUILD_DIRS[@]}"; do
    if [[ -f "$DIR/index.html" ]]; then
        echo "✅ Build encontrado em: $DIR"
        ls -la "$DIR/index.html"
    fi
done
```

---

### Passo 3: Verificar Permissões

```bash
# Verificar permissões
ls -la /opt/smart-signage/frontend/build/ | head -5

# Se necessário, corrigir
sudo chown -R www-data:www-data /opt/smart-signage/frontend/build/
sudo chmod -R 755 /opt/smart-signage/frontend/build/
```

---

### Passo 4: Verificar Configuração Nginx

```bash
# Ver configuração atual
sudo grep "root" /etc/nginx/sites-available/smartsignage

# Verificar se diretório existe
ROOT_DIR=$(sudo grep "root" /etc/nginx/sites-available/smartsignage | head -1 | sed 's/.*root[[:space:]]*\([^;]*\);.*/\1/' | xargs)
echo "Diretório configurado: $ROOT_DIR"
ls -la "$ROOT_DIR/index.html" 2>/dev/null || echo "❌ Arquivo não encontrado!"
```

---

### Passo 5: Testar e Recarregar

```bash
# Testar configuração
sudo nginx -t

# Se OK, recarregar
sudo systemctl reload nginx

# Verificar status
sudo systemctl status nginx
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Execute estes comandos e informe os resultados:

```bash
# 1. Ver logs de erro
sudo tail -30 /var/log/nginx/error.log

# 2. Verificar se build existe
ls -la /opt/smart-signage/frontend/build/index.html
# OU
ls -la /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend/build/index.html

# 3. Verificar permissões
ls -la /opt/smart-signage/frontend/build/ | head -3

# 4. Verificar configuração do Nginx
sudo grep "root" /etc/nginx/sites-available/smartsignage

# 5. Testar configuração
sudo nginx -t
```

---

## 🎯 SOLUÇÃO RÁPIDA (Tentativa)

Se você souber onde o build está, execute:

```bash
# 1. Compilar frontend (se necessário)
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/frontend
npm run build

# 2. Corrigir permissões
sudo chown -R www-data:www-data /opt/smart-signage/frontend/build/
sudo chmod -R 755 /opt/smart-signage/frontend/build/

# 3. Verificar configuração do Nginx
sudo nginx -t

# 4. Recarregar Nginx
sudo systemctl reload nginx

# 5. Testar novamente
curl http://localhost/login
```

---

## 📝 INFORMAÇÕES NECESSÁRIAS

Para diagnosticar melhor, preciso saber:

1. **O que aparece nos logs?**
   ```bash
   sudo tail -30 /var/log/nginx/error.log
   ```

2. **Onde está o build do frontend?**
   ```bash
   find /opt /home -name "index.html" -path "*/frontend/build/*" 2>/dev/null
   ```

3. **Qual diretório o Nginx está configurado para usar?**
   ```bash
   sudo grep "root" /etc/nginx/sites-available/smartsignage
   ```

---

**Última atualização:** 2026-01-03
