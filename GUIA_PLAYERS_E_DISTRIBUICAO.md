# 📦 Guia Completo: Players, Distribuição e Instalação

## 🎯 Por que criar um diretório de distribuição?

### ✅ **Vantagens do Diretório de Distribuição:**

1. **Pacote Limpo e Independente**
   - Contém apenas o necessário para instalação
   - Exclui automaticamente `node_modules`, builds, logs, etc.
   - Tamanho reduzido (~50-100 MB vs ~2 GB com tudo)

2. **Facilita Distribuição**
   - Um único ZIP contém tudo necessário
   - Não precisa do Git na máquina destino
   - Funciona mesmo sem acesso ao repositório

3. **Versão Específica**
   - Captura uma versão específica do código
   - Não depende de branches/tags do Git
   - Reproduzível e testável

4. **Instalação Simplificada**
   - Script de instalação já incluído
   - Configurações de exemplo prontas
   - Documentação incluída

### ⚠️ **Git vs Distribuição:**

| Aspecto | Git | Distribuição |
|---------|-----|--------------|
| **Tamanho** | ~2 GB (com histórico) | ~50-100 MB |
| **Dependências** | Requer Git instalado | Independente |
| **Acesso** | Requer acesso ao repositório | Funciona offline |
| **Versão** | Pode mudar (branch/tag) | Versão fixa |
| **Builds** | Precisa compilar | Opcional incluir builds |
| **Uso** | Desenvolvimento | Produção/Deploy |

**Recomendação:** Use Git para desenvolvimento, Distribuição para deploy em produção.

---

## 🎮 Estrutura dos Players

### Diretórios de Players no Projeto:

```
SmartSignage-Pro/
├── player-client/                    # ✅ Player principal (TODAS as plataformas)
│   ├── core/                        # Lógica compartilhada
│   ├── shared/                      # Recursos compartilhados
│   │   └── smartdisplayfx/          # Efeitos visuais
│   └── platforms/                   # ✅ Implementações por plataforma
│       ├── webos/                   # LG webOS
│       ├── android/                 # Android TV
│       ├── linux-electron/          # Linux (Electron)
│       ├── linux-cpp/               # Linux (C++)
│       ├── tizen/                   # Samsung Tizen
│       └── windows-electron/        # Windows (Electron)
│
├── Player-SmartDisplayFX-client/    # ✅ Cliente com efeitos FX
├── Player-Smart-FX-Interface/      # ✅ Interface de efeitos
├── player-agent/                    # Agente de comunicação
└── player-fx/                       # Biblioteca de efeitos
```

### ✅ **O que está incluído no pacote de distribuição:**

O script `criar-pacote-distribuicao.sh` agora inclui:
- ✅ `player-client/` completo (todas as plataformas)
- ✅ `Player-SmartDisplayFX-client/`
- ✅ `Player-Smart-FX-Interface/`
- ✅ `player-agent/` (se existir)
- ✅ `player-fx/` (se existir)
- ✅ `player/` (se existir)

---

## 🚀 Como Instalar e Fazer Funcionar os Players

### 1. **Instalação Automática (Recomendado)**

O script `install-smartsignage.sh` gerencia a instalação dos players:

```bash
# Instalar todos os players
./install-smartsignage.sh --all-players

# Instalar players específicos
./install-smartsignage.sh \
  --player-webos \
  --player-android \
  --player-linux-electron
```

### 2. **Flags de Instalação de Players:**

```bash
--player-webos              # Instalar player para LG webOS
--player-android            # Instalar player para Android TV
--player-linux-electron     # Instalar player Linux (Electron)
--player-linux-cpp          # Instalar player Linux (C++)
--player-windows-electron   # Instalar player Windows (Electron)
--player-tizen              # Instalar player Samsung Tizen
--player-smartdisplayfx     # Instalar SmartDisplayFX
--player-fx-interface       # Instalar FX Interface
--all-players               # Instalar TODOS os players
```

### 3. **Instalação Manual por Plataforma**

#### **webOS (LG Smart TV):**

```bash
cd player-client/platforms/webos
npm install
./build.sh
# Instalar na TV via Developer Mode
ares-install com.smartsignage.player_1.0.0_armv7.ipk
```

#### **Android TV:**

```bash
cd player-client/platforms/android
./gradlew assembleDebug
# Instalar via ADB
adb install app/build/outputs/apk/debug/app-debug.apk
```

#### **Linux Electron:**

```bash
cd player-client/platforms/linux-electron
npm install
npm run build
# Instalar como serviço systemd
sudo cp systemd/smartsignage-player.service /etc/systemd/system/
sudo systemctl enable smartsignage-player
sudo systemctl start smartsignage-player
```

#### **Tizen (Samsung Smart TV):**

```bash
cd player-client/platforms/tizen
./build.sh
# Instalar via Tizen Studio
tizen install -n smartsignage-player.wgt
```

---

## 🔧 Como o Sistema Funciona com Diferentes Players

### **Arquitetura:**

```
┌─────────────────────────────────────────┐
│         Backend (API Server)            │
│  - Gerencia playlists                   │
│  - Distribui conteúdo                   │
│  - Recebe heartbeats                     │
└──────────────┬──────────────────────────┘
               │
               │ HTTP/WebSocket
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐         ┌──────▼─────┐
│ webOS  │         │  Android   │
│ Player │         │    TV      │
└────────┘         └────────────┘
    │                    │
    │                    │
┌───▼────┐         ┌──────▼─────┐
│ Linux  │         │   Tizen    │
│Electron│         │   Player   │
└────────┘         └────────────┘
```

### **Fluxo de Funcionamento:**

1. **Registro do Player:**
   - Player se conecta ao backend via API
   - Envia informações de hardware (plataforma, versão, etc.)
   - Recebe UIN (Unique Identifier Number)

2. **Sincronização:**
   - Player consulta playlists atribuídas
   - Baixa mídia necessária (cache local)
   - Sincroniza com servidor periodicamente

3. **Reprodução:**
   - Player executa playlists localmente
   - Envia heartbeats para o servidor
   - Reporta status e métricas

4. **Efeitos Visuais (SmartDisplayFX):**
   - Players com suporte a FX carregam `smartdisplayfx/`
   - Conectam via MQTT para sincronização entre totens
   - Aplicam efeitos visuais (Neon Warp Flow, etc.)

---

## 📋 Versões e Features dos Players

### **Versões Disponíveis:**

Cada plataforma pode ter múltiplas versões:

```
player-client/platforms/
├── webos/
│   ├── v1.0/          # Versão básica
│   ├── v2.0/          # Com SmartDisplayFX
│   └── v3.0/          # Com IA e interatividade
```

### **Features por Versão:**

| Feature | webOS | Android | Linux | Tizen |
|--------|-------|---------|-------|-------|
| **Reprodução Básica** | ✅ | ✅ | ✅ | ✅ |
| **SmartDisplayFX** | ✅ | ✅ | ✅ | ✅ |
| **Reconhecimento Facial** | ✅ | ⏳ | ✅ | ⏳ |
| **Leitura de Tags** | ✅ | ✅ | ✅ | ✅ |
| **MQTT Sync** | ✅ | ✅ | ✅ | ✅ |
| **Cache Local** | ✅ | ✅ | ✅ | ✅ |
| **Offline Mode** | ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Atualizando o Script de Distribuição

O script `criar-pacote-distribuicao.sh` foi atualizado para incluir:

1. ✅ Todos os diretórios de players
2. ✅ Scripts de instalação
3. ✅ Documentação de cada plataforma
4. ✅ Configurações de exemplo

### **Verificar o que foi incluído:**

```bash
# Executar o script
./criar-pacote-distribuicao.sh

# Verificar conteúdo
cd SmartSignage-Distribuicao
ls -la player-client/platforms/
```

---

## 📦 Criar ZIP para Distribuição

### **Método 1: Script Automático (Recomendado)**

```bash
# Linux/Mac
./criar-zip-distribuicao.sh

# Windows
.\criar-zip-distribuicao.ps1
```

### **Método 2: Usar o Pacote de Distribuição**

```bash
# Criar pacote
./criar-pacote-distribuicao.sh

# Zipar o diretório criado
zip -r SmartSignage-Pro-v2.1.zip SmartSignage-Distribuicao/
```

---

## ✅ Checklist de Distribuição

Antes de distribuir, verificar:

- [ ] Todos os players estão incluídos (`player-client/platforms/`)
- [ ] SmartDisplayFX está incluído
- [ ] Scripts de instalação estão presentes
- [ ] `env.example` está atualizado
- [ ] Documentação está incluída
- [ ] `node_modules` NÃO está incluído
- [ ] Builds compilados são opcionais (podem ser gerados na instalação)

---

## 🎯 Resumo

1. **Diretório de distribuição é útil** mesmo com Git porque:
   - Cria pacote limpo e independente
   - Facilita deploy em produção
   - Não requer Git na máquina destino

2. **Todos os players estão incluídos** no script atualizado:
   - `player-client/` com todas as plataformas
   - Players com efeitos FX
   - Scripts de instalação

3. **Instalação funciona assim:**
   - Script detecta plataforma automaticamente
   - Instala dependências específicas
   - Configura serviços (systemd, etc.)
   - Players se conectam ao backend via API

4. **Versões e features:**
   - Cada plataforma tem sua implementação
   - Features são ativadas via configuração
   - SmartDisplayFX funciona em todas as plataformas suportadas

