# Diagnóstico de Erros API de Mídia

## Erros Reportados

1. **GET /api/media - 500 (Internal Server Error)**
2. **POST /api/media/upload - 400 (Bad Request)**

## Passos para Diagnosticar

### 1. Verificar Logs do Servidor

```bash
# Ver logs em tempo real
sudo journalctl -u smart-signage -f

# Ver últimas 100 linhas
sudo journalctl -u smart-signage -n 100

# Ver logs com timestamps
sudo journalctl -u smart-signage --since "10 minutes ago"
```

### 2. Verificar Erros Específicos

Procure por estas mensagens nos logs:
- `❌ Erro ao listar mídia:` - Erro na rota GET
- `❌ Erro no multer:` - Erro no upload
- `❌ Erro ao fazer upload do arquivo:` - Erro após processamento do multer

### 3. Verificar Permissões do Diretório de Uploads

```bash
# Verificar se o diretório existe
ls -la /opt/smart-signage/public/assets/uploads

# Verificar permissões
stat /opt/smart-signage/public/assets/uploads

# Criar/Corrigir se necessário
sudo mkdir -p /opt/smart-signage/public/assets/uploads
sudo chown -R smartchannel:smartchannel /opt/smart-signage/public/assets/uploads
sudo chmod -R 755 /opt/smart-signage/public/assets/uploads
```

### 4. Verificar Configuração do Banco de Dados

```bash
# Verificar se o banco está acessível
cd /home/smartchannel/smartsignage-pro-main/backend
npm run build
node -e "const { getDatabase } = require('./dist/config/database'); console.log(getDatabase());"
```

### 5. Verificar MediaService

O erro 500 pode ser causado por:
- Problema na conexão com o banco de dados
- Tabela `media` não existe ou está corrompida
- Erro na query SQL

### 6. Verificar Autenticação

```bash
# Verificar se o token JWT está sendo enviado corretamente
# No navegador, abra DevTools > Network > Headers
# Verifique se há: Authorization: Bearer <token>
```

### 7. Testar Rota Manualmente

```bash
# Testar GET /api/media (requer token)
curl -H "Authorization: Bearer <seu-token>" \
  http://192.168.1.100:8080/api/media

# Testar upload (requer token e arquivo)
curl -X POST \
  -H "Authorization: Bearer <seu-token>" \
  -F "file=@/caminho/para/arquivo.jpg" \
  http://192.168.1.100:8080/api/media/upload
```

## Correções Aplicadas

1. ✅ Melhorado tratamento de erros na rota GET `/api/media`
   - Agora loga mensagem e stack trace completos
   - Retorna mensagem de erro descritiva

2. ✅ Melhorado tratamento de erros no middleware do multer
   - Logs mais detalhados
   - Verificação de `err.message` antes de usar

3. ✅ Tipagem corrigida no middleware do multer
   - Usa `AuthenticatedRequest` corretamente

## Próximos Passos

1. **Atualizar código no servidor:**
   ```bash
   cd /home/smartchannel/smartsignage-pro-main
   git pull origin main
   cd backend
   npm run build
   sudo systemctl restart smart-signage
   ```

2. **Verificar logs após restart:**
   ```bash
   sudo journalctl -u smart-signage -f
   ```

3. **Testar novamente no frontend e verificar logs**

4. **Se o erro persistir, compartilhar:**
   - Últimas 50 linhas dos logs do serviço
   - Mensagem de erro completa do console do navegador
   - Resposta completa da API (se disponível)

## Possíveis Causas

### Erro 500 - GET /api/media
- Banco de dados não inicializado
- Tabela `media` não existe
- Erro na query SQL do MediaService
- Problema de conexão com PostgreSQL

### Erro 400 - POST /api/media/upload
- Arquivo muito grande (limite excedido)
- Tipo de arquivo não permitido
- Diretório de uploads sem permissão
- Erro no multer (configuração incorreta)
- Validação do express-validator falhando

