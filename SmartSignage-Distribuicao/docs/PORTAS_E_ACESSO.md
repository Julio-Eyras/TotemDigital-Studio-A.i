# Smart Signage Pro v2.0 - Portas e Acesso

## 📍 Portas do Sistema Administrativo

### Modo Single-Server (Recomendado para Kiosk)

| Serviço | Porta | URL de Acesso | Descrição |
|---------|-------|---------------|-----------|
| **Frontend Admin** | **80** | `http://IP:80` | Painel administrativo completo (Nginx) |
| **Backend API** | **3000** | `http://IP:3000` | API REST do backend |
| **Player Web** | **80** | `http://IP:80/player` | Player para totems |
| PostgreSQL | 5432 | `localhost:5432` | Banco de dados (interno) |

### Modo Docker

| Serviço | Porta | URL de Acesso | Descrição |
|---------|-------|---------------|-----------|
| **Frontend Admin** | **80** ou **8080** | `http://IP:80` ou `http://IP:8080` | Painel administrativo |
| **Backend API** | **3000** | `http://IP:3000` | API REST do backend |
| **Player Web** | **80** ou **8080** | `http://IP:80/player` ou `http://IP:8080/player` | Player para totems |
| Prometheus | 9090 | `http://IP:9090` | Monitoramento |
| Grafana | 3002 | `http://IP:3002` | Dashboards (admin/admin) |
| PostgreSQL | 5432 | `localhost:5432` | Banco de dados (interno) |
| Redis | 6379 | `localhost:6379` | Cache (interno) |
| Ollama | 11434 | `localhost:11434` | IA (interno) |

## 🖥️ Modo Kiosk - Player Web no Chromium

### Configuração Automática

Quando você instala o modo Kiosk durante a instalação, o sistema:

1. ✅ Instala ambiente gráfico XFCE
2. ✅ Configura auto-login
3. ✅ Configura Chromium para iniciar automaticamente
4. ✅ Abre o **Player Web** em modo kiosk (tela cheia)
5. ✅ Configura tela em modo **Portrait** (vertical)

### URL do Player no Modo Kiosk

O Chromium abre automaticamente:

```
http://IP-DO-SERVIDOR:80/player
```

**Exemplo:** Se o servidor tem IP `192.168.1.105`, o Chromium abrirá:
```
http://192.168.1.105:80/player
```

### Funcionalidades do Player Web

O player (`/player`) é uma página HTML5 dedicada que:

- ✅ Recebe playlists do servidor via API
- ✅ Reproduz mídia (vídeos, imagens, apresentações)
- ✅ Faz heartbeat automático com o servidor
- ✅ Sincroniza conteúdo automaticamente
- ✅ Funciona offline (cache local)
- ✅ Otimizado para exibição em totems

### Configuração do Chromium no Kiosk

O script de Kiosk (`~/.config/autostart/kiosk.sh`) configura o Chromium com:

```bash
chromium-browser \
    --kiosk \                           # Modo kiosk (tela cheia, sem barras)
    --no-first-run \                   # Não mostrar primeiro acesso
    --disable-infobars \               # Sem barras de informação
    --start-maximized \                # Maximizado
    --incognito \                      # Modo anônimo (sem cache persistente)
    --autoplay-policy=no-user-gesture-required \  # Permite autoplay
    "http://IP:80/player"              # URL do Player
```

## 🔐 Acesso Administrativo

### Painel Administrativo (Frontend)

**URL:** `http://IP-DO-SERVIDOR:80`

**Credenciais padrão:**
- **Usuário:** `admin`
- **Senha:** `admin123`

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

### API Backend (Desenvolvimento/Debug)

**URL:** `http://IP-DO-SERVIDOR:3000`

**Endpoints principais:**
- `/health` - Health check
- `/api/health` - API health check
- `/api/auth/login` - Login
- `/api/users` - CRUD Usuários
- `/api/clients` - CRUD Clientes
- `/api/media` - CRUD Mídia
- `/api/playlists` - CRUD Playlists
- `/api/players` - CRUD Players/Totems
- `/api/dashboard/stats` - Estatísticas do dashboard
- E muitos outros...

## 🔥 Firewall

O script de instalação configura automaticamente o firewall (UFW) para permitir:

- ✅ Porta **22** - SSH
- ✅ Porta **80** - HTTP (Frontend Admin + Player)
- ✅ Porta **443** - HTTPS (se configurado)
- ✅ Porta **3000** - Backend API
- ✅ Porta **3001** - Frontend alternativo
- ✅ Porta **8080** - Frontend (modo Docker)

## 📱 Resumo Rápido

### Para Acessar o Painel Administrativo:
```
http://IP-DO-SERVIDOR:80
```

### Para Visualizar o Player em um Totem:
```
http://IP-DO-SERVIDOR:80/player
```

### Para Desenvolvimento/Testes da API:
```
http://IP-DO-SERVIDOR:3000/api/health
```

## 🎯 Modo Kiosk (Totem Dedicado)

Quando você configura um totem com modo Kiosk:

1. O servidor inicia automaticamente o ambiente gráfico
2. O Chromium abre automaticamente em modo kiosk
3. A tela é configurada em **Portrait** (vertical)
4. O player carrega automaticamente a playlist do totem
5. Tudo funciona sem intervenção manual

**Perfeito para:**
- ✅ Totens de sinalização digital
- ✅ Displays publicitários
- ✅ Quiosques informativos
- ✅ Exibidores automáticos

