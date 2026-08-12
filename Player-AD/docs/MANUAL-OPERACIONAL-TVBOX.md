# Player-AD — Manual operacional (TV box / totem)

Guia de instalação, provisionamento, boot customizado e manutenção em campo.

**Manual do utilizador (instalação + configuração):** [MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md](./MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md)  

**Versão do app referida:** 1.33  
**Arquitetura (dev):** [MANUAL-ARQUITETURA-DESENVOLVIMENTO.md](./MANUAL-ARQUITETURA-DESENVOLVIMENTO.md)  
**Hardware / procurement:** [../../docs/hardware/README.md](../../docs/hardware/README.md)

---

## 1. Pré-requisitos

| Item | Detalhe |
|------|---------|
| PC | Windows com PowerShell 5.1+ |
| JDK | Temurin 17 (`JAVA_HOME`) |
| ADB | Android Platform Tools no `PATH` |
| Python | 3.x + Pillow (boot logo/animation) |
| Dispositivo | Android 7+ (API 24), USB debug autorizado |
| Rede | Servidor Totem Digital acessível (`serverUrl`) |

---

## 2. Instalação completa (TV box totem)

```powershell
cd Player-AD\scripts
.\install-player-adb.ps1
```

O script:
1. Compila `assembleRelease`
2. Copia APK para `install-pendrive/apk/`
3. `adb install -r -d -g`
4. Envia `player-config.json` → `/sdcard/smartsignage/`
5. Provisiona kiosk (portrait, launcher, immersive) — **padrão totem**

### Flags úteis

| Flag | Uso |
|------|-----|
| `-SkipBuild` | Só instala APK já compilado |
| `-NoKioskSetup` | **Celular / teste** — sem alterar launcher/rotação SO |
| `-OpenConfig` | Abre tela de configuração após install |
| `-NoLaunch` | Não inicia MainActivity |
| `-ConfigJson "C:\path\config.json"` | Config customizada |
| `-UserRotation 1` | Portrait no SO (default totem) |

### Instalação em celular (teste, sem “prender” o aparelho)

```powershell
.\install-player-adb.ps1 -SkipBuild -NoKioskSetup -OpenConfig
```

Use `"kioskMode": "immersive"` no JSON (não `strong`).

---

## 3. Configuração (`player-config.json`)

Local externo: `/sdcard/smartsignage/player-config.json`  
Local interno: `filesDir/player-config.json` (prioridade se existir)

Exemplo mínimo:

```json
{
  "serverUrl": "https://totemdigital.app.br",
  "uin": "CODIGO-UIN",
  "deviceId": "CODIGO-UIN",
  "storage": "external_primary",
  "maxCacheSizeMb": 1000,
  "kioskMode": "strong",
  "displayRotation": 0,
  "screenOrientation": "portrait",
  "acceptImagesInPlaylist": true,
  "allowPlaybackAudio": true,
  "fallbackPropagandasPerVinheta": 3,
  "batimentoCardiaco": 120,
  "maxSecondsWithoutServerCheck": 600
}
```

Com Let's Encrypt no instalador, site + painel + API ficam em `https://totemdigital.app.br` (porta 443). A porta 8080 permanece HTTP auxiliar (IP/LAN). `serverUrl` do Player-AD = origem HTTPS **sem** porta e **sem** barra no fim.
### Orientação (`displayRotation`)

| Valor | Modo |
|-------|------|
| 0 | Retrato (portrait) |
| 1 | Paisagem (landscape) |
| 2 | Retrato invertido |
| 3 | Paisagem invertida |

No totem portrait Allwinner: `user_rotation=1` no SO (aplicado pelo script de install).

### Kiosk

| Modo | Comportamento |
|------|----------------|
| `strong` | Fullscreen + lock task + bloqueio Home/Recentes (se SO permitir) |
| `immersive` | Só fullscreen imersivo |

Na **tela de config** (debug) o kiosk fica sempre relaxado.

---

## 4. Abrir configuração no totem

- **3 toques rápidos** no botão OK / centro (D-pad ou toque na tela)
- Toast: “Mais N toque(s) no OK…”

Salvar config → **Aplicar e iniciar** (barra fixa no rodapé).

---

## 5. Boot customizado (duas fases)

### Fase 1 — Bootlogo (Allwinner, antes do Android)

Logo estático na particão bootloader (`bootlogo.bmp` 1280×720).

```powershell
cd Player-AD\scripts
.\install-bootlogo.ps1
# ou com PNG custom:
.\install-bootlogo.ps1 -InputLogo "C:\caminho\logo.png"
adb reboot
```

Assets: `install-pendrive/bootanimation/logo-totemdigital-boot.png`, `bootlogo.bmp`

### Fase 2 — Bootanimation (animação Android)

Texto TotemDigital + linha amarela, portrait 1080×1920:

```powershell
.\install-bootanimation.ps1 -Portrait
adb reboot
```

Regenerar ZIPs (Python):

```powershell
python build-bootanimation.py
python build-bootanimation.py --width 1080 --height 1920 --output ..\..\install-pendrive\bootanimation\bootanimation-portrait.zip
```

Parâmetros em `build-bootanimation.py`: `TEXT_ROTATION_DEG`, `TEXT_SCALE`, `ACCENT_RGB`.

**Requisito:** root (`su`) + `/system` gravável.

---

## 6. Rotação automática da mídia (v1.34+)

Se vídeo/imagem estiver em orientação diferente da config (ex.: landscape num totem portrait):

- **Vídeo:** transformação no `TextureView` (ExoPlayer)
- **Imagem:** rotação do bitmap antes de exibir

Log esperado (`player-ad-operations.log` ou logcat tag `Player-AD`):

```text
[DISPLAY] Correção orientação vídeo 1920x1080 → 90° (mount=0)
```

Se não girar: ver secção 8 (troubleshooting).

---

## 7. Comandos do dia a dia

```powershell
# Diagnóstico
.\diagnose-android-box.ps1

# Só rotação SO
.\set-android-display-rotation.ps1 -Rotation 1

# Log operacional
adb exec-out run-as br.com.smartchannel.playerad cat files/player-ad-operations.log

# Reiniciar app
adb shell am force-stop br.com.smartchannel.playerad
adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity

# Versão instalada
adb shell dumpsys package br.com.smartchannel.playerad | findstr versionName
```

---

## 8. Troubleshooting

### App não instala

- Conflito de assinatura: script desinstala e reinstala automaticamente
- `INSTALL_FAILED`: verificar `adb devices` → `device`

### Portrait não aplica

```powershell
adb shell settings get system user_rotation          # esperado: 1
adb shell settings get system accelerometer_rotation # esperado: 0
.\set-android-display-rotation.ps1 -Rotation 1
```

### SuperSU pede root a cada ~15 min

- SuperSU → Player-AD → **Permitir sempre**
- v1.31+ evita `su` quando `user_rotation` já está correto

### Bootanimation não muda

- Verificar `/system` gravável: diagnóstico no script
- Backup em `/sdcard/smartsignage/backup/`

### Bootlogo não muda (Allwinner)

- Partição: `/dev/block/mmcblk0p2`
- Montagem: `/mnt/bootlogo` (script cria se não existir)
- Formato: BMP 1280×720 RGB 24-bit

### Mídia não gira (v1.34)

1. Confirmar versão ≥ 1.34 (`adb shell dumpsys package br.com.smartchannel.playerad | findstr versionName`)
2. Ver log `DISPLAY` — deve mostrar `raw=`, `eff=`, `meta=` e `total=` graus
3. Vídeo landscape + config portrait → `total=90` ou `270`
4. Se invertido: reportar combinação (config + tipo mídia) para ajuste de sentido

### Sem rede / offline

Ordem de fallback do `PlayerController`:
1. Plano online (dispatch)
2. Último plano persistido (`last-dispatch-plan.json`)
3. Arquivos locais `propagandas/` e `vinhetas/`

---

## 9. Estrutura de pastas no dispositivo

| Caminho | Conteúdo |
|---------|----------|
| `/sdcard/smartsignage/player-config.json` | Config externa |
| `filesDir/player-config.json` | Config interna (prioridade) |
| `filesDir/player-ad-operations.log` | Log operacional |
| `AppDirs/propagandas/` | Cache de mídias |
| `AppDirs/vinhetas/` | Vinhetas locais |
| `/system/media/bootanimation.zip` | Animação boot Android |

---

## 10. Deploy servidor (atualizar backend/frontend)

O Player-AD na box **não** usa `install-smartsignage.sh` para updates web.

No servidor staging/produção:

```bash
cd ~/TotemDigital && git pull
./scripts/deploy-backfront-build.sh
```

---

## 11. Referência rápida de scripts

| Script | Função |
|--------|--------|
| `install-player-adb.ps1` | Build + install + kiosk |
| `install-bootanimation.ps1` | Boot animation Android |
| `install-bootlogo.ps1` | Bootlogo Allwinner |
| `build-bootanimation.py` | Gera ZIP bootanimation |
| `build-bootlogo.py` | PNG → bootlogo.bmp |
| `diagnose-android-box.ps1` | Diagnóstico ADB |
| `set-android-display-rotation.ps1` | Rotação SO |

---

*Última atualização: jul/2026 — Player-AD v1.34*
