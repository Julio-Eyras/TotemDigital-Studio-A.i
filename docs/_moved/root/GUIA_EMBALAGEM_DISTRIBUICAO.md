# 📦 Guia de Embalagem para Distribuição - Smart Signage Pro

## Diretórios e Arquivos Essenciais para Zipar

### ✅ **INCLUIR no ZIP:**

```
SmartSignage-Pro/
├── backend/                    # ✅ Backend completo (sem node_modules)
│   ├── src/                    # ✅ Código fonte
│   ├── package.json            # ✅ Dependências
│   ├── tsconfig.json           # ✅ Config TypeScript
│   └── env.example             # ✅ Exemplo de configuração
│
├── frontend/                   # ✅ Frontend completo (sem node_modules)
│   ├── src/                    # ✅ Código fonte
│   ├── public/                 # ✅ Arquivos públicos
│   ├── package.json            # ✅ Dependências
│   └── tsconfig.json           # ✅ Config TypeScript
│
├── database/                   # ✅ Scripts e schemas do banco
│   ├── schema.sql              # ✅ Schema principal
│   ├── carga-inicial-2025.sql  # ✅ Carga inicial (seeds 2025)
│   └── scripts/                # ✅ Scripts auxiliares
│
├── docker/                    # ✅ Entrypoints Docker
│   ├── entrypoint.sh
│   ├── app-entrypoint.sh
│   └── nginx-entrypoint.sh
│
├── nginx/                      # ✅ Configurações Nginx
│   └── *.conf                  # ✅ Todos os arquivos de config
│
├── monitoring/                 # ✅ Configurações de monitoramento
│   ├── prometheus/
│   └── grafana/
│
├── scripts/                    # ✅ Scripts de instalação/manutenção
│   └── *.sh                    # ✅ Todos os scripts úteis
│
├── player-client/              # ✅ Cliente player (se aplicável)
│   └── platforms/              # ✅ Builds por plataforma
│
├── docker-compose.yml           # ✅ Configuração Docker Compose
├── Dockerfile*                  # ✅ Todos os Dockerfiles
├── env.example                  # ✅ Exemplo de variáveis de ambiente
├── install-smartsignage.sh      # ✅ Script principal de instalação
└── README.md                    # ✅ Documentação (se houver)
```

### ❌ **NÃO INCLUIR no ZIP:**

```
❌ node_modules/                 # Será instalado na máquina destino
❌ dist/                         # Será compilado na máquina destino
❌ build/                        # Será compilado na máquina destino
❌ coverage/                     # Relatórios de teste
❌ logs/                         # Logs locais
❌ .env                          # Configurações locais (usar env.example)
❌ .git/                         # Repositório Git (opcional)
❌ .vscode/                      # Configurações do editor
❌ .idea/                        # Configurações do IDE
❌ *.log                         # Arquivos de log
❌ uploads/                      # Uploads locais
❌ backups/                      # Backups locais
❌ postgres_data/                # Dados do banco (volumes Docker)
❌ redis_data/                   # Dados do Redis (volumes Docker)
❌ .cursor/                      # Arquivos do Cursor
```

## 🚀 Método Rápido: Usar o Script de Distribuição

O projeto possui scripts que criam o pacote completo automaticamente:

### **Método Recomendado (cria ZIP diretamente):**

```bash
# Linux/Mac - Cria ZIP diretamente
./criar-zip-distribuicao.sh

# Windows PowerShell - Cria ZIP diretamente
.\criar-zip-distribuicao.ps1
```

### **Método Alternativo (cria diretório primeiro, depois zipar manualmente):**

```bash
# Executar o script de criação de pacote
./criar-pacote-distribuicao.sh

# Isso criará o diretório: SmartSignage-Distribuicao/
# Depois, zipar apenas esse diretório:
zip -r SmartSignage-Pro-v2.1.zip SmartSignage-Distribuicao/
```

**Nota:** O método recomendado (`criar-zip-distribuicao.sh` ou `.ps1`) é mais rápido e cria o ZIP automaticamente. Use `criar-pacote-distribuicao.sh` apenas se precisar inspecionar o conteúdo antes de zipar.

## 📋 Método Manual: Comandos para Criar o ZIP

### No Linux/Mac:

```bash
# Criar ZIP excluindo arquivos desnecessários
zip -r SmartSignage-Pro-v2.1.zip . \
  -x "node_modules/*" \
  -x "dist/*" \
  -x "build/*" \
  -x "coverage/*" \
  -x "logs/*" \
  -x ".env" \
  -x ".git/*" \
  -x ".vscode/*" \
  -x ".idea/*" \
  -x "*.log" \
  -x "uploads/*" \
  -x "backups/*" \
  -x "postgres_data/*" \
  -x "redis_data/*" \
  -x ".cursor/*" \
  -x "*.swp" \
  -x "*.swo" \
  -x ".DS_Store"
```

### No Windows (PowerShell):

```powershell
# Criar ZIP excluindo arquivos desnecessários
Compress-Archive -Path `
  backend\src,backend\package.json,backend\tsconfig.json,backend\env.example,`
  frontend\src,frontend\public,frontend\package.json,frontend\tsconfig.json,`
  database,`
  docker,`
  nginx,`
  monitoring,`
  scripts,`
  player-client,`
  docker-compose.yml,`
  Dockerfile*,`
  env.example,`
  install-smartsignage.sh `
  -DestinationPath SmartSignage-Pro-v2.1.zip
```

## ✅ Verificação do Pacote

Após criar o ZIP, verificar se contém:

- [ ] `backend/src/` - Código fonte do backend
- [ ] `backend/package.json` - Dependências do backend
- [ ] `frontend/src/` - Código fonte do frontend
- [ ] `frontend/package.json` - Dependências do frontend
- [ ] `database/` - Scripts e schemas do banco
- [ ] `docker-compose.yml` - Configuração Docker
- [ ] `Dockerfile*` - Dockerfiles necessários
- [ ] `install-smartsignage.sh` - Script de instalação
- [ ] `env.example` - Exemplo de configuração

## 📦 Tamanho Esperado

- **Com código fonte apenas**: ~50-100 MB
- **Com builds incluídos**: ~200-500 MB
- **Com node_modules**: ~500 MB - 2 GB (NÃO RECOMENDADO)

## 🎯 Instalação na Máquina Destino

### Linux/Mac:

```bash
# 1. Extrair o ZIP
unzip SmartSignage-Pro-v2.1.zip

# 2. Corrigir permissões e line endings (IMPORTANTE!)
chmod +x *.sh
./FIX-SCRIPT-PERMISSIONS.sh

# 3. Copiar env.example para .env e configurar
cp env.example .env
nano .env  # ou seu editor preferido

# 4. Executar instalação
./scripts/install-smartsignage.sh
```

### ⚠️ Se der erro "arquivo necessarios nao encontrado":

```bash
# Converter line endings
dos2unix install-smartsignage.sh
# OU
sed -i 's/\r$//' install-smartsignage.sh

# Dar permissão de execução
chmod +x install-smartsignage.sh

# Executar novamente
./scripts/install-smartsignage.sh
```

**Veja `SOLUCAO-ERRO-INSTALL-SCRIPT.md` para mais detalhes.**

## ⚠️ Importante

- **NUNCA** inclua arquivos `.env` com credenciais reais
- **SEMPRE** use `env.example` como base
- **VERIFIQUE** se não há dados sensíveis no código
- **TESTE** o pacote em uma máquina limpa antes de distribuir


