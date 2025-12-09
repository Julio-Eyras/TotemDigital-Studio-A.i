# 🔧 Correção: Erro 413 (Request Entity Too Large) e 502 (Bad Gateway)

## 📋 Problema Identificado

- **Erro 413**: Arquivo muito grande para upload
- **Erro 502**: Bad Gateway (backend pode ter caído após mudanças)

## ✅ Correções Aplicadas no Código

Os limites foram aumentados de **100MB para 500MB** em:

1. ✅ **Backend Express** (`backend/src/index.ts`):
   - `express.json({ limit: '500mb' })`
   - `express.urlencoded({ extended: true, limit: '500mb' })`

2. ✅ **Multer** (`backend/src/routes/media.ts`):
   - `fileSize: 500 * 1024 * 1024` (500MB)

3. ✅ **Nginx** (todos os arquivos de configuração):
   - `client_max_body_size 500M`
   - `client_body_buffer_size 512k`

## 🚀 Como Aplicar no Servidor

### **Passo 1: Atualizar Código**

```bash
cd /home/smartchannel/smartsignage-pro-main
git pull origin main
```

### **Passo 2: Recompilar Backend**

```bash
cd backend
npm run build
```

### **Passo 3: Atualizar Configuração do Nginx**

O Nginx precisa ser atualizado manualmente porque o script de instalação cria a configuração dinamicamente.

#### **Opção A: Editar Configuração Existente**

```bash
# Editar arquivo de configuração do Nginx
sudo nano /etc/nginx/sites-available/smart-signage
```

Procure por `client_max_body_size` e altere para:

```nginx
client_max_body_size 500M;
client_body_buffer_size 512k;
```

**IMPORTANTE**: Adicione essas linhas dentro do bloco `server` que escuta na porta 8080 (painel administrativo), especialmente antes do `location /api/`:

```nginx
server {
    listen 8080;
    server_name _;
    
    # ADICIONAR AQUI:
    client_max_body_size 500M;
    client_body_buffer_size 512k;
    
    # ... resto da configuração ...
    
    location /api/ {
        proxy_pass http://localhost:3000;
        # ... resto do proxy ...
    }
}
```

#### **Opção B: Usar Arquivo de Template**

Se preferir, você pode copiar o arquivo atualizado:

```bash
# Fazer backup da configuração atual
sudo cp /etc/nginx/sites-available/smart-signage /etc/nginx/sites-available/smart-signage.backup

# Copiar nova configuração (se disponível)
sudo cp /home/smartchannel/smartsignage-pro-main/nginx/nginx-complete.conf /etc/nginx/sites-available/smart-signage

# OU editar manualmente conforme Opção A
```

### **Passo 4: Testar Configuração do Nginx**

```bash
# Testar configuração
sudo nginx -t
```

Se houver erros, corrija antes de continuar.

### **Passo 5: Reiniciar Serviços**

```bash
# Reiniciar backend
sudo systemctl restart smart-signage

# Recarregar Nginx (sem downtime)
sudo systemctl reload nginx

# OU reiniciar Nginx (com pequeno downtime)
sudo systemctl restart nginx
```

### **Passo 6: Verificar Status**

```bash
# Verificar se backend está rodando
sudo systemctl status smart-signage

# Verificar se Nginx está rodando
sudo systemctl status nginx

# Ver logs do backend em tempo real
sudo journalctl -u smart-signage -f
```

## 🔍 Verificação da Configuração

### **Verificar Limite do Nginx**

```bash
# Verificar configuração atual
grep -r "client_max_body_size" /etc/nginx/
```

Deve mostrar `500M` ou `500M`.

### **Verificar Limite do Backend**

```bash
# Verificar código compilado
grep -r "limit.*500" /home/smartchannel/smartsignage-pro-main/backend/dist/index.js
```

### **Testar Upload**

1. Acesse `http://192.168.1.106:8080/media`
2. Tente fazer upload de um arquivo menor que 500MB
3. Verifique se não há mais erro 413

## ⚠️ Troubleshooting

### **Erro 502 (Bad Gateway)**

Se ainda houver erro 502 após reiniciar:

```bash
# Verificar se backend está rodando
sudo systemctl status smart-signage

# Ver logs de erro
sudo journalctl -u smart-signage -n 50

# Verificar se porta 3000 está em uso
sudo netstat -tlnp | grep 3000

# Verificar logs do Nginx
sudo tail -50 /var/log/nginx/error.log
```

### **Backend Não Inicia**

```bash
# Tentar iniciar manualmente
cd /home/smartchannel/smartsignage-pro-main/backend
node dist/index.js

# Verificar erros de compilação
cd /home/smartchannel/smartsignage-pro-main/backend
npm run build
```

### **Nginx Não Recarrega**

```bash
# Verificar sintaxe
sudo nginx -t

# Ver logs de erro
sudo tail -50 /var/log/nginx/error.log

# Reiniciar completamente
sudo systemctl restart nginx
```

## 📝 Notas Importantes

1. **Limite de 500MB**: Adequado para a maioria dos vídeos e arquivos de mídia. Se precisar de mais, ajuste todos os valores proporcionalmente.

2. **Memória**: Uploads grandes consomem mais memória. Certifique-se de que o servidor tem RAM suficiente.

3. **Timeout**: Se uploads grandes falharem por timeout, pode ser necessário aumentar `proxy_read_timeout` no Nginx:

```nginx
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_read_timeout 300s;  # 5 minutos
    # ... resto da configuração ...
}
```

4. **Espaço em Disco**: Certifique-se de que há espaço suficiente em `/opt/smart-signage/public/assets/uploads` para armazenar os arquivos.

## ✅ Checklist Final

- [ ] Código atualizado (`git pull`)
- [ ] Backend recompilado (`npm run build`)
- [ ] Nginx configurado com `client_max_body_size 500M`
- [ ] Nginx testado (`nginx -t`)
- [ ] Backend reiniciado (`systemctl restart smart-signage`)
- [ ] Nginx recarregado (`systemctl reload nginx`)
- [ ] Upload testado com sucesso
- [ ] Sem erros 413 ou 502

---

**Última atualização**: 2025-11-15

