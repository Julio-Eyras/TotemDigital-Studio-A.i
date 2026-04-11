# Solução: Erro 404 em Assets (subscriber-X)

**Data:** 2026-02-16  
**Problema:** Arquivos retornam 404 mesmo estando nos diretórios corretos

---

## 🔍 Diagnóstico

### Arquivos Existem ✅
- ✅ Arquivos estão em `/opt/smart-signage/public/assets/uploads/subscriber-X/medias/`
- ✅ Permissões dos arquivos: `644` (corretas)
- ✅ Permissões dos diretórios: `755` (corretas)

### Problema Identificado ⚠️
- ⚠️ Nginx precisa de acesso aos arquivos
- ⚠️ Ownership atual: `smartchannel:smartchannel`
- ⚠️ Nginx roda como: `www-data` (Ubuntu/Debian)

---

## ✅ Solução

### Opção 1: Mudar Nginx para Proxy (Mais Simples - Recomendado)

Como o backend já está servindo os arquivos corretamente, podemos fazer o Nginx fazer proxy para o backend ao invés de servir diretamente. Isso resolve o problema de permissões sem precisar ajustar ownership.

**Execute:**

```bash
sudo ./scripts/fix-nginx-assets-proxy.sh
```

Ou manualmente, edite `/etc/nginx/sites-available/smart-signage` e substitua:

```nginx
location /assets/ {
    alias /opt/smart-signage/public/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Por:

```nginx
location /assets/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Depois recarregue:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Opção 2: Ajustar Permissões

Execute os seguintes comandos com **sudo**:

```bash
# 1. Ajustar ownership para www-data (Nginx)
sudo chown -R www-data:www-data /opt/smart-signage/public/assets

# 2. Garantir permissões corretas
sudo find /opt/smart-signage/public/assets -type d -exec chmod 755 {} \;
sudo find /opt/smart-signage/public/assets -type f -exec chmod 644 {} \;

# 3. Recarregar Nginx
sudo systemctl reload nginx
```

### Opção 3: Usar Script de Permissões

```bash
# Executar script que ajusta permissões automaticamente
sudo ./scripts/fix-nginx-assets-access.sh
```

### Opção 4: Ajustar Apenas Grupo (Sem Mudar Owner)

Se preferir manter o owner como `smartchannel`:

```bash
# Adicionar www-data ao grupo smartchannel
sudo usermod -a -G smartchannel www-data

# Ajustar grupo dos arquivos
sudo chgrp -R smartchannel /opt/smart-signage/public/assets

# Dar permissão de leitura ao grupo
sudo chmod -R g+r /opt/smart-signage/public/assets

# Recarregar Nginx
sudo systemctl reload nginx
```

---

## 🧪 Verificação

Após aplicar a solução, teste:

```bash
# Testar acesso via backend (porta 3000)
curl -I http://localhost:3000/assets/uploads/subscriber-1/medias/Cestto_00005.png

# Testar acesso via Nginx (porta 80)
curl -I http://localhost/assets/uploads/subscriber-1/medias/Cestto_00005.png

# Ou pelo IP do servidor
curl -I http://192.168.1.110/assets/uploads/subscriber-1/medias/Cestto_00005.png
```

**Deve retornar:** `HTTP/1.1 200 OK`

---

## 📋 Checklist

- [ ] Ownership ajustado para www-data
- [ ] Permissões de diretórios: 755
- [ ] Permissões de arquivos: 644
- [ ] Nginx recarregado
- [ ] Teste de acesso bem-sucedido

---

## 🔧 Alternativa: Backend Serve Diretamente

Se o problema persistir, o backend já está configurado para servir os arquivos diretamente:

- ✅ Backend serve `/assets` via Express.static
- ✅ Arquivos acessíveis em `http://backend:3000/assets/...`
- ✅ Nginx pode fazer proxy para o backend se necessário

---

## 📝 Notas

- **Permissões mínimas necessárias:** Nginx precisa de **leitura** (r) nos arquivos e **execução** (x) nos diretórios
- **Segurança:** Não usar permissões 777 (muito permissivas)
- **Recomendado:** Ownership `www-data:www-data` ou grupo compartilhado
