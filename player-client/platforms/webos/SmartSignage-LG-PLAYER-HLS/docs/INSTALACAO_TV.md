# 📺 Guia de Instalação na TV LG webOS

Guia completo para fazer build e instalar o SmartSignage LG Player HLS na TV.

---

## 📋 Pré-requisitos

### 1. Software Necessário

#### Windows:
- **Node.js** (v14+): [Download](https://nodejs.org/)
- **webOS TV SDK**: [Download](https://webostv.developer.lge.com/develop/sdk/installing-the-sdk/)

#### Linux/Mac:
- **Node.js** (v14+)
- **webOS TV CLI** via npm:
  ```bash
  npm install -g @webos/tv-cli
  ```

### 2. Configuração da TV

#### Ativar Modo Desenvolvedor:

1. **Na TV LG:**
   - Abra a **LG Content Store**
   - Procure e instale o app **"Developer Mode"**
   - Abra o app Developer Mode
   - Faça login com sua conta LG (ou crie uma)
   - Ative:
     - ✅ **Developer Mode**
     - ✅ **Key Server**

2. **Obter IP da TV:**
   - No Developer Mode, anote o **IP Address** da TV
   - Exemplo: `192.168.1.50`

3. **Reiniciar TV:**
   - Reinicie a TV após ativar o modo desenvolvedor

---

## 🔧 Configuração do Ambiente

### 1. Instalar webOS CLI Tools

#### Windows:
Após instalar o webOS TV SDK, o CLI estará disponível no caminho de instalação.

#### Linux/Mac:
```bash
npm install -g @webos/tv-cli
```

Verificar instalação:
```bash
ares-package --version
ares-install --version
ares-launch --version
```

### 2. Configurar Dispositivo na TV

#### No PC (primeira vez):

```bash
ares-setup-device
```

**Opções:**
1. Escolha: `add device`
2. Preencha:
   - **Name:** `lg_tv` (ou nome de sua preferência)
   - **IP:** `192.168.1.50` (IP da sua TV)
   - **Port:** `22` (padrão)
   - **User:** `prisoner`
   - **Password:** (geralmente vazio ou deixe em branco)

#### Testar conexão:

```bash
ares-device-info lg_tv
```

Se funcionar, você verá informações da TV.

---

## 📦 Build do Aplicativo

### Opção 1: Usando Script (Recomendado)

```bash
cd player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS

# Dar permissão de execução (Linux/Mac)
chmod +x scripts/build.sh

# Executar build
./scripts/build.sh
```

Ou no Windows (PowerShell):
```powershell
cd player-client\platforms\webos\SmartSignage-LG-PLAYER-HLS
bash scripts/build.sh
```

### Opção 2: Build Manual

```bash
cd player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS

# Empacotar app
ares-package .
```

**Resultado:**
- Arquivo `.ipk` será criado no diretório
- Nome: `com.smartsignage.lgplayer.hls_1.0.0_all.ipk`

---

## 📤 Instalação na TV

### Opção 1: Usando Script (Recomendado)

```bash
# Substitua 'lg_tv' pelo nome do seu dispositivo
./scripts/deploy.sh lg_tv
```

Ou no Windows:
```powershell
bash scripts/deploy.sh lg_tv
```

### Opção 2: Instalação Manual

```bash
# Listar dispositivos configurados
ares-setup-device

# Instalar .ipk na TV
ares-install com.smartsignage.lgplayer.hls_1.0.0_all.ipk -d lg_tv
```

**Resultado:**
- App será instalado na TV
- Você verá mensagem de sucesso

---

## 🚀 Executar o App

### Lançar App na TV:

```bash
ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

**O que acontece:**
- App inicia automaticamente na TV
- Vídeo começa a reproduzir (se stream configurado)
- App fica em modo kiosk (invisível na lista de apps)

---

## 📊 Ver Logs

### Ver logs em tempo real:

```bash
ares-log -d lg_tv
```

### Ver logs específicos do app:

```bash
ares-log -d lg_tv | grep -i "smartsignage\|app\|player"
```

### Salvar logs em arquivo:

```bash
ares-log -d lg_tv > logs.txt
```

---

## ⚙️ Configuração do App

### 1. Configurar API do Backend

Antes de instalar, edite `config/config.example.json`:

```json
{
  "api_base_url": "http://SEU_SERVIDOR_IP:3000/api",
  "stream_url": "http://SEU_SERVIDOR_IP:3000/hls/canal01/playlist.m3u8",
  "fallback_urls": [
    "/media/usb/fallback.mp4"
  ]
}
```

**OU** configure via variável de ambiente (no backend).

### 2. Adicionar Vídeo Fallback (Opcional)

1. Conecte pendrive/USB na TV
2. Crie pasta: `/media/usb/smartdisplay/`
3. Copie `fallback.mp4` para essa pasta
4. Configure no `config.json`:

```json
{
  "fallback_urls": ["/media/usb/smartdisplay/fallback.mp4"]
}
```

---

## 🔄 Atualizar o App

### Rebuild e Reinstalar:

```bash
# 1. Fazer build novamente
./scripts/build.sh

# 2. Desinstalar versão antiga (opcional)
ares-uninstall com.smartsignage.lgplayer.hls -d lg_tv

# 3. Instalar nova versão
./scripts/deploy.sh lg_tv

# 4. Lançar novamente
ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

---

## 🐛 Troubleshooting

### Erro: "ares-package: command not found"

**Solução:**
- Instale o webOS TV SDK
- Ou instale via npm: `npm install -g @webos/tv-cli`
- Adicione ao PATH do sistema

### Erro: "Cannot connect to device"

**Solução:**
1. Verifique se TV está ligada e na mesma rede
2. Verifique IP da TV no Developer Mode
3. Teste ping: `ping 192.168.1.50`
4. Reconfigure dispositivo: `ares-setup-device`

### Erro: "Developer Mode expired"

**Solução:**
- O modo desenvolvedor expira após 50 horas
- Reative no app Developer Mode na TV
- Ou use renovação automática (configuração avançada)

### Erro: "App não inicia"

**Solução:**
1. Verifique logs: `ares-log -d lg_tv`
2. Verifique se `index.html` existe
3. Verifique permissões no `appinfo.json`
4. Tente reinstalar o app

### App não aparece na TV

**Solução:**
- Normal! App está em modo kiosk (`visible: false`)
- Use `ares-launch` para iniciar
- Ou configure auto-launch (configuração avançada)

### Vídeo não reproduz

**Solução:**
1. Verifique se stream URL está correta
2. Verifique se backend está rodando
3. Verifique logs para erros de CORS/rede
4. Teste stream URL no navegador primeiro

---

## 🔐 Auto-Launch (Iniciar Automaticamente)

Para que o app inicie automaticamente quando a TV ligar:

### Método 1: Via Developer Mode (Temporário)

No Developer Mode da TV:
- Configure "Auto Launch App"
- Selecione: `com.smartsignage.lgplayer.hls`

### Método 2: Via LG Commercial/Signage (Permanente)

Para produção comercial:
- Use LG Commercial Signage
- Configure auto-launch permanente
- Requer licença comercial

---

## 📝 Checklist de Instalação

Antes de considerar completo:

- [ ] webOS SDK instalado
- [ ] TV em modo desenvolvedor
- [ ] Dispositivo configurado no PC
- [ ] Conexão testada (`ares-device-info`)
- [ ] Build executado com sucesso
- [ ] .ipk criado
- [ ] App instalado na TV
- [ ] App executado (`ares-launch`)
- [ ] Logs verificados
- [ ] Stream reproduzindo
- [ ] Backend conectado
- [ ] Heartbeat funcionando

---

## 🎯 Comandos Rápidos (Referência)

```bash
# Build
ares-package .

# Instalar
ares-install com.smartsignage.lgplayer.hls_1.0.0_all.ipk -d lg_tv

# Executar
ares-launch com.smartsignage.lgplayer.hls -d lg_tv

# Ver logs
ares-log -d lg_tv

# Desinstalar
ares-uninstall com.smartsignage.lgplayer.hls -d lg_tv

# Listar apps instalados
ares-install -l -d lg_tv

# Info do dispositivo
ares-device-info lg_tv
```

---

## 📚 Recursos Adicionais

- [webOS TV Developer Docs](https://webostv.developer.lge.com/)
- [webOS CLI Reference](https://webostv.developer.lge.com/develop/tools/cli/)
- [Smart Signage Pro Backend Docs](../../../../../docs/)

---

**Última atualização:** 2025-12-19

