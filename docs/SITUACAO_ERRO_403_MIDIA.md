# Situação Atual - Erro 403 ao Acessar Arquivos de Mídia

## 🔍 Problema Identificado

Após upload de mídia, ao tentar acessar o arquivo, ocorre erro **403 Forbidden**:

```
GET http://192.168.1.100:8080/assets/uploads/uploads/client-1/medias/sadsa.mp4 403 (Forbidden)
```

## 📊 Análise do Problema

### 1. Caminho do Arquivo Salvo
**Arquivo salvo em:**
```
/home/smartchannel/smartsignage-pro-main/public/assets/uploads/uploads/client-1/medias/sadsa.mp4
```

**Servidor configurado para servir de:**
```
/opt/smart-signage/public/assets/
```

### 2. Discrepância de Caminhos

**Problema:** O arquivo está sendo salvo no diretório do projeto (`/home/smartchannel/smartsignage-pro-main/`) em vez do diretório de instalação (`/opt/smart-signage/`).

**Causa Raiz:**
- O `StorageService` estava usando `process.env.UPLOAD_PATH` diretamente
- Se `UPLOAD_PATH` não estiver configurado, usa padrão `/opt/smart-signage/public/assets`
- Mas parece que em algum momento está usando o diretório do projeto

### 3. Permissões

Mesmo que o caminho estivesse correto, o erro 403 indica problema de permissões:
- Arquivos precisam ter permissão 644 (rw-r--r--)
- Diretórios precisam ter permissão 755 (rwxr-xr-x)
- O servidor web (nginx/node) precisa ter acesso de leitura

## ✅ Correções Implementadas

### 1. StorageService - Uso Consistente de Configuração

**Arquivo:** `backend/src/services/storageService.ts`

**Mudança:**
- Agora usa `getStoragePath()` do `mediaConfig` em vez de `process.env.UPLOAD_PATH` diretamente
- Garante que o caminho seja o mesmo usado pelo multer
- Fallback para `process.env.UPLOAD_PATH` se `mediaConfig` não estiver disponível

**Código:**
```typescript
constructor() {
  // Usar a mesma configuração do mediaConfig para garantir consistência
  try {
    const { getStoragePath } = require('../config/mediaConfig');
    const storagePath = getStoragePath();
    this.basePath = storagePath.replace(/\/uploads\/?$/, '') || '/opt/smart-signage/public/assets';
    this.uploadsPath = path.join(this.basePath, 'uploads');
  } catch (error) {
    // Fallback
    this.basePath = process.env.UPLOAD_PATH || '/opt/smart-signage/public/assets';
    this.uploadsPath = path.join(this.basePath, 'uploads');
  }
}
```

### 2. Melhorias em Permissões

**Função `ensureDirectoryExists()`:**
- Agora garante permissões 755 mesmo se o diretório já existir
- Ajusta permissões de diretórios pais também
- Logs de aviso se não conseguir alterar permissões (não bloqueia)

**Função `saveMediaFile()`:**
- Define permissões 644 nos arquivos salvos
- Adiciona logs de debug com caminho relativo esperado
- Tratamento de erro não bloqueante para permissões

### 3. Script de Instalação

**Arquivo:** `install-smartsignage.sh`

**Função `validate_and_fix_upload_permissions()`:**
- Valida e corrige permissões automaticamente durante instalação
- Detecta usuário do servidor web (nginx/www-data)
- Ajusta permissões para garantir acesso de leitura
- Testa acesso a arquivos existentes

## 🔧 Ações Necessárias no Servidor

### 1. Verificar Variável de Ambiente

```bash
# Verificar se UPLOAD_PATH está configurado
echo $UPLOAD_PATH

# Ou verificar no .env do backend
cat /opt/smart-signage/backend/.env | grep UPLOAD_PATH
```

**Deve estar:**
```
UPLOAD_PATH=/opt/smart-signage/public/assets
```

### 2. Verificar Configuração no Banco

```sql
SELECT setting_key, setting_value 
FROM system_settings 
WHERE setting_key = 'media.storage.path';
```

**Deve retornar:**
```
media.storage.path | /opt/smart-signage/public/assets/uploads
```

### 3. Corrigir Permissões Manualmente (Se Necessário)

```bash
# Corrigir permissões dos diretórios
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
sudo find /opt/smart-signage/public/assets/uploads -type f -exec chmod 644 {} \;

# Corrigir ownership
sudo chown -R smartchannel:smartchannel /opt/smart-signage/public/assets/uploads

# Se usar nginx
sudo chown -R smartchannel:nginx /opt/smart-signage/public/assets/uploads
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
```

### 4. Mover Arquivos Existentes (Se Necessário)

Se houver arquivos salvos no diretório errado:

```bash
# Mover arquivos do diretório do projeto para o diretório de instalação
sudo mv /home/smartchannel/smartsignage-pro-main/public/assets/uploads/uploads/* \
        /opt/smart-signage/public/assets/uploads/uploads/ 2>/dev/null || true

# Ajustar permissões após mover
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
sudo find /opt/smart-signage/public/assets/uploads -type f -exec chmod 644 {} \;
```

### 5. Reiniciar Serviço

```bash
# Reiniciar backend
sudo systemctl restart smart-signage
# ou
pm2 restart smart-signage
```

## 🧪 Testes de Validação

Após aplicar as correções:

1. **Teste de Upload:**
   - Fazer upload de nova mídia
   - Verificar logs: deve mostrar caminho em `/opt/smart-signage/...`
   - Verificar que arquivo foi salvo no local correto

2. **Teste de Acesso:**
   - Tentar acessar URL: `http://192.168.1.100:8080/assets/uploads/uploads/client-1/medias/arquivo.mp4`
   - Deve retornar 200 OK (não 403)
   - Arquivo deve carregar no navegador

3. **Teste de Permissões:**
   ```bash
   # Verificar permissões
   ls -la /opt/smart-signage/public/assets/uploads/uploads/client-1/medias/
   
   # Deve mostrar:
   # drwxr-xr-x (755) para diretórios
   # -rw-r--r-- (644) para arquivos
   ```

## 📝 Próximos Passos

1. ✅ Código corrigido e compilado
2. ⏳ Aplicar correções no servidor (verificar UPLOAD_PATH, permissões)
3. ⏳ Testar upload de nova mídia
4. ⏳ Validar acesso aos arquivos
5. ⏳ Mover arquivos existentes se necessário

## 🔗 Arquivos Modificados

- `backend/src/services/storageService.ts` - Uso consistente de configuração e melhorias em permissões
- `install-smartsignage.sh` - Função de validação automática de permissões

## 📌 Notas Importantes

- O problema pode ser resolvido apenas configurando corretamente `UPLOAD_PATH` no `.env`
- A função de validação no script de instalação previne o problema em novas instalações
- Arquivos já salvos no diretório errado precisam ser movidos manualmente

