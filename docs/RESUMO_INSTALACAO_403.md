# Resumo - Configuração de Instalação para Resolver Erro 403

## ✅ O que JÁ está configurado no script de instalação

### 1. **Criação do arquivo .env com UPLOAD_PATH correto**

**Localização:** `install-smartsignage.sh` (linha ~2401)

O script cria o arquivo `.env` na raiz (`$INSTALL_DIR/.env`) com:
```bash
UPLOAD_PATH=$INSTALL_DIR/public/assets/uploads
```

**Exemplo:** Se `INSTALL_DIR=/opt/smart-signage`, então:
```
UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
```

### 2. **Criação do .env no diretório backend**

**NOVO:** Agora o script também cria `backend/.env` com as mesmas configurações, garantindo que o backend leia o caminho correto.

### 3. **Validação automática de permissões**

**Função:** `validate_and_fix_upload_permissions()` (linha ~4058)

**O que faz:**
- ✅ Cria os diretórios necessários se não existirem
- ✅ Ajusta permissões: diretórios 755, arquivos 644
- ✅ Ajusta ownership para o usuário correto
- ✅ Detecta usuário do servidor web (nginx/www-data)
- ✅ Testa acesso aos arquivos existentes
- ✅ Valida que os diretórios são acessíveis

**Quando é chamada:**
- Durante instalação Docker (linha ~3345)
- Durante instalação Single-Server (linha ~4984)

### 4. **Criação dos diretórios necessários**

O script cria automaticamente:
- `$INSTALL_DIR/public/assets/uploads`
- `$INSTALL_DIR/public/assets`
- `$INSTALL_DIR/public`

## ⚠️ Se a instalação JÁ foi realizada

Se você já instalou o sistema antes dessas correções, você precisa:

### 1. **Verificar/Corrigir o arquivo .env**

```bash
# Verificar se UPLOAD_PATH está correto
cat /opt/smart-signage/.env | grep UPLOAD_PATH

# Deve mostrar:
# UPLOAD_PATH=/opt/smart-signage/public/assets/uploads

# Se estiver errado, corrigir:
sudo nano /opt/smart-signage/.env
# Alterar para: UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
```

### 2. **Criar/Corrigir backend/.env**

```bash
# Copiar .env para backend
sudo cp /opt/smart-signage/.env /opt/smart-signage/backend/.env

# Ou criar manualmente com o caminho correto
sudo nano /opt/smart-signage/backend/.env
# Adicionar: UPLOAD_PATH=/opt/smart-signage/public/assets/uploads
```

### 3. **Corrigir permissões manualmente**

```bash
# Executar a função de validação manualmente (ou executar os comandos abaixo)
cd /opt/smart-signage
sudo chmod -R 755 public/assets/uploads
sudo find public/assets/uploads -type f -exec chmod 644 {} \;
sudo chown -R smartchannel:smartchannel public/assets/uploads

# Se usar nginx
sudo chown -R smartchannel:nginx public/assets/uploads
```

### 4. **Mover arquivos existentes (se necessário)**

Se houver arquivos salvos no diretório errado:

```bash
# Verificar onde estão os arquivos
find /home/smartchannel -name "*.mp4" -o -name "*.jpg" 2>/dev/null | head -5

# Se estiverem em /home/smartchannel/smartsignage-pro-main/...
# Mover para o diretório correto
sudo mkdir -p /opt/smart-signage/public/assets/uploads/uploads/client-1/medias
sudo mv /home/smartchannel/smartsignage-pro-main/public/assets/uploads/uploads/client-1/medias/* \
        /opt/smart-signage/public/assets/uploads/uploads/client-1/medias/ 2>/dev/null || true

# Ajustar permissões após mover
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
sudo find /opt/smart-signage/public/assets/uploads -type f -exec chmod 644 {} \;
```

### 5. **Reiniciar o serviço**

```bash
sudo systemctl restart smart-signage
# ou
pm2 restart smart-signage
```

## 🔍 Como verificar se está correto

### 1. **Verificar variável de ambiente no backend**

```bash
# Verificar se o backend está lendo o .env correto
cd /opt/smart-signage/backend
node -e "require('dotenv').config(); console.log(process.env.UPLOAD_PATH)"
# Deve mostrar: /opt/smart-signage/public/assets/uploads
```

### 2. **Verificar permissões**

```bash
# Verificar permissões dos diretórios
ls -la /opt/smart-signage/public/assets/uploads/
# Diretórios devem mostrar: drwxr-xr-x (755)
# Arquivos devem mostrar: -rw-r--r-- (644)
```

### 3. **Testar acesso**

```bash
# Testar se um arquivo é acessível
curl -I http://localhost:8080/assets/uploads/uploads/client-1/medias/arquivo.mp4
# Deve retornar: HTTP/1.1 200 OK (não 403)
```

## 📝 Resumo das Correções no Código

### 1. **StorageService** (`backend/src/services/storageService.ts`)
- ✅ Agora usa `getStoragePath()` do `mediaConfig` em vez de `process.env.UPLOAD_PATH` diretamente
- ✅ Garante consistência com o caminho usado pelo multer
- ✅ Melhorias em permissões (755 para diretórios, 644 para arquivos)
- ✅ Logs de debug adicionados

### 2. **Script de Instalação** (`install-smartsignage.sh`)
- ✅ Cria `.env` na raiz com `UPLOAD_PATH` correto
- ✅ **NOVO:** Também cria `backend/.env` com as mesmas configurações
- ✅ Função `validate_and_fix_upload_permissions()` valida e corrige permissões automaticamente
- ✅ Chamada em ambos os modos de instalação (Docker e Single-Server)

## ✅ Conclusão

**Para novas instalações:**
- ✅ Tudo está configurado automaticamente
- ✅ O script cria os diretórios, configura o .env e ajusta permissões

**Para instalações existentes:**
- ⚠️ Precisa verificar/corrigir manualmente o `.env`
- ⚠️ Precisa corrigir permissões manualmente
- ⚠️ Pode precisar mover arquivos existentes

**Recomendação:**
Se possível, executar novamente o script de instalação com `--preserve-db` para aplicar todas as correções automaticamente:
```bash
sudo bash install-smartsignage.sh --preserve-db
```

