# Debug de Erros de API

## Erros Reportados

1. **Erro 400 em `/api/totems`**
2. **Erro 500 em `/api/reports/types`**
3. **Erro 500 em `/api/qr-codes`**
4. **Erro 400 em `/api/billing`**

## Correções Aplicadas

### 1. Tratamento de Erros Melhorado
- Adicionados logs detalhados com stack trace em todas as rotas
- Melhoradas mensagens de erro para facilitar debug

### 2. Validação de Parâmetros
- Melhoradas mensagens de validação em `/api/totems`
- Garantidos valores padrão para `page` e `limit`

### 3. Conversão de Placeholders SQL
- Corrigido bug em `convertQuery()` do DatabaseWrapper
- Agora usa `values.length` ao invés de `paramIndex - 1`

## Como Verificar os Logs no Servidor

### 1. Verificar logs do backend
```bash
# Ver logs em tempo real
sudo journalctl -u smart-signage -f

# Ver últimas 100 linhas
sudo journalctl -u smart-signage -n 100

# Ver logs com filtro de erro
sudo journalctl -u smart-signage | grep "❌"
```

### 2. Verificar logs do nginx
```bash
# Ver logs de acesso
sudo tail -f /var/log/nginx/access.log

# Ver logs de erro
sudo tail -f /var/log/nginx/error.log
```

### 3. Testar endpoints diretamente
```bash
# Obter token de autenticação primeiro
TOKEN="seu_token_aqui"

# Testar /api/totems
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/totems

# Testar /api/reports/types
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/reports/types

# Testar /api/qr-codes
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/qr-codes

# Testar /api/billing
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/billing
```

## Possíveis Causas dos Erros

### Erro 400 (Bad Request)
- Parâmetros de query inválidos
- Validação falhando
- Formato de dados incorreto

### Erro 500 (Internal Server Error)
- Erro em query SQL
- Problema de conexão com banco de dados
- Erro em serviço interno
- Problema com conversão de placeholders SQL

## Próximos Passos

1. **Verificar logs do servidor** para identificar a causa exata dos erros
2. **Testar endpoints** diretamente com curl para ver mensagens de erro detalhadas
3. **Verificar conexão com banco de dados** se os erros persistirem
4. **Verificar se as tabelas existem** no banco de dados:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('totems', 'qr_codes', 'billing', 'reports');
   ```

## Comandos Úteis

```bash
# Reiniciar serviço
sudo systemctl restart smart-signage

# Ver status do serviço
sudo systemctl status smart-signage

# Verificar se o banco está acessível
psql -U smartsignage -d smartsignage -c "SELECT NOW();"

# Verificar conexões ativas
psql -U smartsignage -d smartsignage -c "SELECT count(*) FROM pg_stat_activity;"
```

