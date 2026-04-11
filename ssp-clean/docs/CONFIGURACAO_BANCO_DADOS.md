# Guia de Configuração - Credenciais do Banco de Dados

## 📍 Localização dos Arquivos de Configuração

### Arquivo Principal: `backend/.env`

O arquivo **`backend/.env`** é o arquivo principal onde todas as configurações do sistema são armazenadas, incluindo credenciais do banco de dados.

**Localização:**
```
/home/smartchannel/SmartSignage-PRO/backend/.env
```

### Arquivo de Template: `backend/env.example`

Este arquivo serve como template e exemplo de todas as variáveis disponíveis.

**Localização:**
```
/home/smartchannel/SmartSignage-PRO/backend/env.example
```

---

## 🔐 Configurações Padrão Atuais

### Credenciais do PostgreSQL (Padrão)

```
DATABASE_URL=postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage
DB_USER=smartsignage
DB_PASSWORD=smartsignage123
```

**⚠️ IMPORTANTE:** Estas são credenciais padrão de desenvolvimento. **ALTERE em produção!**

---

## ✏️ Como Alterar as Credenciais

### Opção 1: Editar o arquivo `.env` diretamente (Recomendado)

1. **Edite o arquivo `.env`:**
   ```bash
   nano /home/smartchannel/SmartSignage-PRO/backend/.env
   ```

2. **Altere as seguintes linhas:**
   ```env
   # Exemplo: alterando usuário e senha
   DATABASE_URL=postgresql://novo_usuario:nova_senha@localhost:5432/smartsignage
   DB_USER=novo_usuario
   DB_PASSWORD=nova_senha
   ```

3. **Salve o arquivo** (Ctrl+O, Enter, Ctrl+X no nano)

4. **Atualize a senha no PostgreSQL:**
   ```bash
   sudo -u postgres psql -c "ALTER USER smartsignage PASSWORD 'nova_senha';"
   ```
   
   Ou, se criou um novo usuário:
   ```bash
   sudo -u postgres psql -c "CREATE USER novo_usuario WITH PASSWORD 'nova_senha';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smartsignage TO novo_usuario;"
   ```

5. **Reinicie o serviço do backend:**
   ```bash
   sudo systemctl restart smart-signage
   ```

### Opção 2: Usar o script de instalação

O script `install-smartsignage.sh` também permite configurar as credenciais durante a instalação através do arquivo de configuração `smartsignage-config`.

---

## 🔒 Segurança: Precisa Criptografar a Senha?

### ❌ NÃO criptografe a senha no arquivo `.env`

**Razão:** O arquivo `.env` é lido diretamente pelo backend em tempo de execução. Se a senha estiver criptografada, o backend não conseguirá conectar ao banco de dados.

### ✅ O que fazer para manter seguro:

1. **Proteja o arquivo `.env` com permissões restritas:**
   ```bash
   # Definir propriedade para o usuário do backend
   sudo chown smartchannel:smartchannel /home/smartchannel/SmartSignage-PRO/backend/.env
   
   # Permitir apenas leitura para o proprietário (permissão 600)
   sudo chmod 600 /home/smartchannel/SmartSignage-PRO/backend/.env
   ```

2. **Nunca commite o arquivo `.env` no Git:**
   - O arquivo já está no `.gitignore`
   - Certifique-se de que não foi adicionado acidentalmente

3. **Use senhas fortes em produção:**
   ```bash
   # Gerar senha aleatória forte
   openssl rand -base64 32
   ```

4. **Configure firewall adequadamente:**
   - PostgreSQL só deve aceitar conexões de localhost ou rede local
   - Use `pg_hba.conf` para restringir acesso

5. **Mantenha o sistema atualizado:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

---

## 📋 Variáveis de Ambiente Importantes

### Banco de Dados

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage` | URL completa de conexão (tem precedência) |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_NAME` | `smartsignage` | Nome do banco de dados |
| `DB_USER` | `smartsignage` | Usuário do PostgreSQL |
| `DB_PASSWORD` | `smartsignage123` | Senha do PostgreSQL |

**Nota:** Se `DATABASE_URL` estiver definida, ela será usada. Caso contrário, o sistema usa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`.

### Autenticação JWT

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `JWT_SECRET` | `your-super-secret-jwt-key-change-this-in-production` | ⚠️ **ALTERE EM PRODUÇÃO!** |
| `JWT_EXPIRES_IN` | `24h` | Tempo de expiração do token JWT |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Tempo de expiração do refresh token |

**Gerar JWT_SECRET seguro:**
```bash
openssl rand -base64 64
```

### Outras Configurações Importantes

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `NODE_ENV` | `production` | Ambiente de execução |
| `PORT` | `3000` | Porta do backend |
| `UPLOAD_PATH` | `/opt/smart-signage/public/assets/uploads` | Diretório de uploads |
| `REDIS_URL` | `redis://localhost:6379` | URL do Redis (cache) |

---

## 🔍 Como o Backend Lê as Configurações

O backend lê as configurações através do arquivo:
```
backend/src/config/env.ts
```

Este arquivo:
1. Carrega o arquivo `.env` usando `dotenv`
2. Valida variáveis obrigatórias (como `DATABASE_URL` e `JWT_SECRET`)
3. Fornece valores padrão para variáveis opcionais
4. Exporta todas as configurações para uso no código

**Fluxo:**
```
.env → dotenv → env.ts → database-pg.ts → PostgreSQL Pool
```

---

## ✅ Checklist de Segurança em Produção

- [ ] Alterar `DB_PASSWORD` para senha forte
- [ ] Alterar `JWT_SECRET` usando `openssl rand -base64 64`
- [ ] Alterar `TWO_FACTOR_ENCRYPTION_KEY` usando `openssl rand -base64 32`
- [ ] Configurar permissões do `.env` (chmod 600)
- [ ] Verificar que `.env` não está no Git
- [ ] Configurar firewall adequadamente
- [ ] Configurar PostgreSQL `pg_hba.conf` para restringir acesso
- [ ] Usar HTTPS em produção
- [ ] Configurar backups automáticos do banco de dados
- [ ] Documentar credenciais em local seguro (gerenciador de senhas)

---

## 🆘 Solução de Problemas

### Backend não conecta ao banco

1. **Verificar se o PostgreSQL está rodando:**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Testar conexão manualmente:**
   ```bash
   psql -U smartsignage -d smartsignage -h localhost
   ```

3. **Verificar credenciais no `.env`:**
   ```bash
   grep -E "DATABASE_URL|DB_USER|DB_PASSWORD" /home/smartchannel/SmartSignage-PRO/backend/.env
   ```

4. **Verificar logs do backend:**
   ```bash
   sudo journalctl -u smart-signage -f
   ```

### Esqueci a senha

Se você esqueceu a senha do PostgreSQL:

1. **Resetar senha como superusuário:**
   ```bash
   sudo -u postgres psql
   ```
   
2. **No psql, execute:**
   ```sql
   ALTER USER smartsignage PASSWORD 'nova_senha';
   \q
   ```

3. **Atualize o `.env` com a nova senha**

4. **Reinicie o backend:**
   ```bash
   sudo systemctl restart smart-signage
   ```

---

## 📚 Referências

- Arquivo de exemplo: `backend/env.example`
- Código de configuração: `backend/src/config/env.ts`
- Código de conexão: `backend/src/config/database-pg.ts`
- Documentação PostgreSQL: https://www.postgresql.org/docs/

