# SmartSignage Player-AD — Notas técnicas de instalação

> **Manual do utilizador (instalação + configuração):**  
> [MANUAL-USUARIO-PLAYER-AD.md](./MANUAL-USUARIO-PLAYER-AD.md)  
> Cópia canónica no repositório: `Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md`

Versão do app de referência: `2.13` (`versionCode=113`)  
Data kit: 2026-08-21

## 1) Objetivo

Este documento (técnico) complementa o manual do utilizador e centraliza:

- montar o pendrive de instalacao;
- instalar via ADB (PC + cabo USB/OTG);
- instalar diretamente com pendrive na TV Box;
- orientar equipe tecnica e utilizador final;
- reduzir erros de assinatura, Java/Gradle e configuracao.

## 2) Estrutura oficial do kit pendrive

Use a pasta `install-pendrive` como raiz do conteudo a copiar para o USB.

```
install-pendrive/
  apk/
    Player-AD-release.apk
    COLOQUE_O_APK_AQUI.txt
  config/
    exemplo-player-config.json
  midias/
    README.txt
    propagandas/   (opcional)
    vinhetas/      (opcional)
  scripts/
    install-from-pc-adb.bat
    install-from-pc-adb.sh
    install-on-android.sh
  docs/
    MANUAL-INSTALACAO-PLAYER-AD.md
    MANUAL-INSTALACAO-PLAYER-AD.pdf
  README.md
  LEIA-ME.txt
```

## 3) Pre-requisitos tecnicos

### 3.1 Para build no PC

- Windows com PowerShell.
- JDK 17 (Temurin recomendado) configurado.
- Gradle Wrapper do projeto (`Player-AD/gradlew.bat`).

### 3.2 Para instalacao via ADB

- Android Platform Tools (`adb`) no PATH.
- TV Box com:
  - Opcoes de programador ativas;
  - Depuracao USB ativa;
  - autorizacao RSA concedida ao PC.

### 3.3 Para instalacao por pendrive (sem PC)

- Gestor de ficheiros na TV Box.
- Permissao para instalar apps desconhecidas.

## 4) Como gerar e atualizar o kit no repositorio

### 4.1 Build release do app

No projeto `Player-AD`:

```powershell
cd C:\SmartSignage-Pro\Player-AD
.\gradlew.bat assembleRelease --no-daemon
```

APK esperado:

- `Player-AD\build\outputs\apk\release\Player-AD-release.apk`

### 4.2 Copiar APK para o kit pendrive

```powershell
$apk = "C:\SmartSignage-Pro\Player-AD\build\outputs\apk\release\Player-AD-release.apk"
Copy-Item -Force $apk "C:\SmartSignage-Pro\install-pendrive\apk\Player-AD-release.apk"
```

### 4.3 Ajustar configuracao de exemplo

Edite:

- `install-pendrive\config\exemplo-player-config.json`

Campos principais:

- `serverUrl`
- `uin`
- `deviceId`
- `fallbackPropagandasPerVinheta`

Exemplo:

```json
{
  "serverUrl": "https://totemdigital.app.br",
  "uin": "tot001",
  "deviceId": "ANDROID-TV-TOT001",
  "fallbackPropagandasPerVinheta": 3
}
```

## 5) Instalacao via ADB (procedimento tecnico recomendado)

### 5.1 Windows

Na pasta `install-pendrive`:

```cmd
scripts\install-from-pc-adb.bat
```

Esse script:

- localiza APK em `apk\*.apk`;
- executa `adb install -r -d -g`;
- envia `config\exemplo-player-config.json` para `/sdcard/smartsignage/player-config.json` se existir.

### 5.2 Linux/macOS/Git Bash

```bash
bash scripts/install-from-pc-adb.sh
```

Com envio explicito de config:

```bash
bash scripts/install-from-pc-adb.sh "" config/exemplo-player-config.json
```

### 5.3 Tratamento de erro de assinatura

Se ocorrer:

- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

Execute:

```bash
adb uninstall br.com.smartchannel.playerad
adb install -r -d -g caminho/do/apk
```

## 6) Instalacao direta por pendrive (sem PC)

1. Inserir USB na TV Box.
2. Abrir gestor de ficheiros.
3. Ir para `apk/`.
4. Selecionar `Player-AD-release.apk`.
5. Confirmar instalacao.
6. Se solicitado, permitir instalacao de apps desconhecidas.

Observacao:

- Este metodo nao depende de ADB.
- Ideal para operacao em campo quando nao ha notebook disponivel.

## 7) Script no Android (cenario root)

Arquivo:

- `scripts/install-on-android.sh`

Uso tipico:

```bash
adb push install-pendrive /sdcard/install-pendrive
adb shell su -c "sh /sdcard/install-pendrive/scripts/install-on-android.sh"
```

Sem root, preferir instalacao manual por gestor de ficheiros ou via ADB no PC.

## 8) Pos-instalacao e verificacao

### 8.1 Confirmar versao instalada

```bash
adb shell dumpsys package br.com.smartchannel.playerad | grep -E "versionCode|versionName"
```

### 8.2 Abrir app via ADB

```bash
adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity
```

### 8.3 Coletar log de erro

```bash
adb logcat -d | grep -i -E "playerad|AndroidRuntime|FATAL|Exception"
```

## 9) Localizacao de arquivos no Android

### 9.1 Configuracao

- `/sdcard/smartsignage/player-config.json`

### 9.2 Midias fallback

- `/sdcard/Android/data/br.com.smartchannel.playerad/files/propagandas/`
- `/sdcard/Android/data/br.com.smartchannel.playerad/files/vinhetas/`

## 10) Troubleshooting rapido

- **adb nao encontra dispositivo**
  - verifique cabo de dados;
  - confirme depuracao USB;
  - confirme popup RSA no Android.

- **App nao instala**
  - valide que APK e release valido;
  - tente desinstalar versao anterior (conflito de assinatura).

- **App fecha ao abrir**
  - colete logcat;
  - validar se APK atual foi realmente instalado;
  - confirmar versao em `dumpsys package`.

## 11) Manual do utilizador final (resumo)

Passo a passo simples:

1. Ligue a TV Box.
2. Insira o pendrive.
3. Abra o gestor de ficheiros.
4. Entre em `apk/`.
5. Toque em `Player-AD-release.apk`.
6. Toque em Instalar.
7. Abra o app SmartSignage Player-AD.

Se aparecer bloqueio de seguranca, permitir "instalar apps desconhecidas" para o gestor de ficheiros.

## 12) Boas praticas operacionais

- Sempre incrementar `versionCode` a cada release.
- Manter `versionName` coerente (ex.: 1.2, 1.3).
- Testar em 1 dispositivo antes da distribuicao em massa.
- Manter este manual junto do kit no USB.
- Guardar historico de versoes instaladas por cliente/site.
