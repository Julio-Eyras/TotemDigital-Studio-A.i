# SmartSignage-AD - Manual Operacional

Data: 2026-04-07

## 1) Objetivo

Padronizar build, instalacao e distribuicao do SmartSignage-AD em dispositivos Android.

## 2) Estrutura principal

- `SmartSignage-AD/app/` - app Android
- `SmartSignage-AD/scripts/` - scripts de build/install
- `install-pendrive-smartsignage-ad/` - kit ADB/pendrive dedicado

## 3) Fluxo recomendado (Windows)

### 3.1 Build + install ADB

```powershell
cd C:\SmartSignage-Pro\SmartSignage-AD
.\instalar-dispositivo.cmd
```

### 3.2 Build limpo

```powershell
cd C:\SmartSignage-Pro\SmartSignage-AD
.\instalar-dispositivo.cmd -Clean
```

## 4) Tela Debug/Config

No app:

- primeiro arranque abre Debug automaticamente;
- para abrir depois: 8 toques no texto de bootstrap.

A tela permite:

- editar `serverUrl`, `uin`, `deviceId`;
- editar `fallbackPropagandasPerVinheta`;
- ligar/desligar `acceptImagesInPlaylist`;
- verificar estado offline (fonte do plano + ultimo dispatch + contagem de midias locais).

## 5) Arquivos de configuracao

### Interno (prioritario)

- `filesDir/app-config.json`

### Externo (compatibilidade instalacao)

- `/sdcard/smartsignage-ad/app-config.json`

Parametro novo:

- `internalCacheLimitPercent` (default 30): limite maximo de uso do storage interno (`AppDirs.root`) para cache.
  - ao atingir/ultrapassar o limite, escrita de cache passa a ser obrigatoriamente em SD/USB.

## 6) Fallback e persistencia

- ultimo plano: `last-dispatch-plan.json`
- fonte atual: `current-plan-source.txt`
- fallback: `ONLINE -> PERSISTED -> FALLBACK_LOCAL`
- ordem local: `1 vinheta -> N propagandas` (N em `fallbackPropagandasPerVinheta`)
- politica de midia:
  - **efetiva**: SD/USB (`smartsignage-ad/vinhetas` e `smartsignage-ad/propagandas`)
  - **demo interna**: assets do APK copiados para `filesDir/demo-media/*` (contingencia)

## 7) Kit de distribuicao

Pasta:

- `install-pendrive-smartsignage-ad/`

Conteudo:

- `apk/` (APK release)
- `config/app-config.example.json`
- `scripts/install-from-pc-adb.bat`
- `scripts/install-from-pc-adb.sh`

## 8) Troubleshooting rapido

- **adb nao encontrado**
  - instalar Android Platform Tools e ajustar PATH.

- **erro de assinatura ao instalar**
  - script ja tenta desinstalar e reinstalar automaticamente.

- **app sem conectar no backend**
  - revisar `serverUrl`, rede e firewall.

## 9) Encerramento

Conversao Android base do SmartSignage-AD concluida com fases 0 a 5.
