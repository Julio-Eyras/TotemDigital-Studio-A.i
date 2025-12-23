# Acesso ao PostgreSQL via SSH Tunnel (pgAdmin 4)

Este guia explica como configurar um túnel SSH para acessar o PostgreSQL remotamente usando pgAdmin 4 quando a porta 5432 está bloqueada pelo firewall.

## 📋 Pré-requisitos

- Acesso SSH ao servidor
- pgAdmin 4 instalado no seu computador local
- Credenciais PostgreSQL:
  - **Usuário:** `smartsignage`
  - **Senha:** `smartsignage123`
  - **Banco de dados:** `smartsignage`
  - **Host local:** `localhost`
  - **Porta local:** `5432`

## 🔧 Opção 1: SSH Tunnel via Linha de Comando (Linux/Mac/Windows WSL)

### Windows (PowerShell)

```powershell
# Criar túnel SSH
ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N
```

**Parâmetros:**
- `-L 5433:localhost:5432` - Redireciona porta local 5433 para porta 5432 do servidor
- `smartchannel@192.168.1.105` - Usuário e IP do servidor
- `-N` - Não executa comandos remotos, apenas mantém o túnel aberto

### Linux/Mac

```bash
# Criar túnel SSH
ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N
```

### Manter túnel aberto em segundo plano

```bash
# Linux/Mac - Usando nohup
nohup ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N &

# Ou usando screen/tmux
screen -S pg-tunnel
ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N
# Pressione Ctrl+A, depois D para sair sem encerrar
```

## 🔧 Opção 2: SSH Tunnel via pgAdmin 4 (Recomendado)

### Passo 1: Abrir pgAdmin 4

1. Abra o pgAdmin 4 no seu computador local
2. Clique com botão direito em **Servers** → **Create** → **Server**

### Passo 2: Configurar Connection

Na aba **General:**
- **Name:** `Smart Signage Pro (via SSH)`

### Passo 3: Configurar SSH Tunnel

Na aba **SSH Tunnel:**

1. **Marque a opção:** ✅ "Use SSH tunneling"

2. **Preencha os dados SSH:**
   - **Tunnel host:** `192.168.1.105` (ou IP externo do servidor)
   - **Tunnel port:** `22`
   - **Username:** `smartchannel`
   - **Authentication:** `Password` ou `Identity file`
   
   **Se usar senha:**
   - **Password:** [senha do usuário smartchannel]
   
   **Se usar chave SSH:**
   - **Identity file:** `/caminho/para/sua/chave_privada`
   - **Passphrase:** [se sua chave tiver passphrase]

### Passo 4: Configurar Connection PostgreSQL

Na aba **Connection:**

- **Host name/address:** `localhost` ⚠️ **IMPORTANTE: Use `localhost`, não o IP do servidor!**
- **Port:** `5432`
- **Maintenance database:** `smartsignage`
- **Username:** `smartsignage`
- **Password:** `smartsignage123`
- **Save password:** ✅ (opcional, para não digitar toda vez)

### Passo 5: Salvar e Conectar

1. Clique em **Save**
2. O pgAdmin irá criar o túnel SSH automaticamente e conectar ao PostgreSQL

## 🔧 Opção 3: SSH Tunnel via PuTTY (Windows)

### Passo 1: Configurar Session

1. Abra PuTTY
2. Em **Session:**
   - **Host Name:** `192.168.1.105` (ou IP externo)
   - **Port:** `22`
   - **Connection type:** SSH

### Passo 2: Configurar Tunnel

1. Vá em **Connection** → **SSH** → **Tunnels**
2. Em **Source port:** digite `5433`
3. Em **Destination:** digite `localhost:5432`
4. Clique em **Add**
5. Volte para **Session**, dê um nome e clique em **Save**

### Passo 3: Conectar

1. Clique em **Open**
2. Faça login no servidor
3. **Mantenha a janela do PuTTY aberta** (o túnel funciona enquanto ela estiver aberta)

### Passo 4: Configurar pgAdmin

No pgAdmin, configure a conexão:
- **Host:** `localhost`
- **Port:** `5433` ⚠️ **Use a porta do túnel local!**
- **Database:** `smartsignage`
- **Username:** `smartsignage`
- **Password:** `smartsignage123`

## ✅ Verificar Conexão

### Testar túnel SSH manualmente

```bash
# No terminal local, testar conexão ao túnel
psql -h localhost -p 5433 -U smartsignage -d smartsignage
# Digite a senha: smartsignage123
```

### Verificar no pgAdmin

1. Conecte ao servidor
2. Expanda **Databases** → `smartsignage` → **Schemas** → **public** → **Tables**
3. Você deve ver todas as tabelas do sistema

## 🛠️ Solução de Problemas

### Erro: "Connection refused"

- Verifique se o PostgreSQL está rodando no servidor:
  ```bash
  ssh smartchannel@192.168.1.105 "sudo systemctl status postgresql"
  ```

### Erro: "Permission denied (publickey)"

- Configure autenticação por senha ou use chave SSH:
  ```bash
  ssh-copy-id smartchannel@192.168.1.105
  ```

### Túnel fecha automaticamente

- Use `nohup` ou `screen`/`tmux` para manter o túnel aberto
- Ou configure SSH para manter conexão viva:
  ```bash
  # Adicione ao ~/.ssh/config
  Host smart-signage
    HostName 192.168.1.105
    User smartchannel
    ServerAliveInterval 60
    ServerAliveCountMax 3
  ```

### pgAdmin não conecta pelo túnel

- Verifique se a aba **SSH Tunnel** está preenchida corretamente
- Use `localhost` na aba **Connection**, nunca o IP do servidor
- Verifique se a porta 5432 está acessível localmente no servidor:
  ```bash
  ssh smartchannel@192.168.1.105 "sudo netstat -tlnp | grep 5432"
  ```

## 🔐 Segurança

### Recomendações:

1. **Altere a senha padrão do PostgreSQL:**
   ```bash
   ssh smartchannel@192.168.1.105
   sudo -u postgres psql -c "ALTER USER smartsignage WITH PASSWORD 'SENHA_FORTE_AQUI';"
   ```

2. **Use chaves SSH em vez de senhas:**
   ```bash
   ssh-keygen -t rsa -b 4096
   ssh-copy-id smartchannel@192.168.1.105
   ```

3. **Limite acesso ao PostgreSQL no servidor:**
   Edite `/etc/postgresql/16/main/pg_hba.conf` para permitir apenas conexões locais

4. **Configure firewall no servidor:**
   ```bash
   # Não abra a porta 5432 no firewall externo
   sudo ufw deny 5432/tcp
   ```

## 📝 Script Automático (Opcional)

Crie um script para facilitar o túnel:

**Linux/Mac** (`~/.local/bin/pg-tunnel.sh`):
```bash
#!/bin/bash
ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N -f
echo "Túnel PostgreSQL criado na porta local 5433"
echo "Use no pgAdmin: localhost:5433"
```

**Windows** (`pg-tunnel.bat`):
```batch
@echo off
start /B ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N
echo Túnel PostgreSQL criado na porta local 5433
echo Use no pgAdmin: localhost:5433
pause
```

---

✅ **Agora você pode acessar o PostgreSQL remotamente usando pgAdmin 4 via SSH Tunnel!**

