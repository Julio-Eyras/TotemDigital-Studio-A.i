# Player-AD — build e instalação

O Player-AD é instalado na TV Box/Android por ADB ou pendrive. O instalador do servidor não instala o APK.

## 1. Valores principais

```text
Pacote Android: br.com.smartchannel.playerad
Projeto: Player-AD/
APK release: Player-AD/build/outputs/apk/release/Player-AD-release.apk
Cópia pendrive: install-pendrive/apk/Player-AD-release.apk
Config externa: /sdcard/smartsignage/player-config.json
Versão operacional: 2.11
Build operacional: 111
```

## 2. Pré-requisitos no Windows

```powershell
adb version
java -version
adb devices -l
```

O aparelho deve aparecer como `device`, não `offline` nem `unauthorized`.

## 3. Build e instalação ADB recomendada

Preserva a configuração já gravada no aparelho:

```powershell
cd C:\TotemDigital-Studio\Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 -NoConfigPush
```

O script:

1. compila `assembleRelease`;
2. copia o APK para `install-pendrive\apk`;
3. executa `adb install -r -d -g`;
4. configura kiosk/rotação;
5. abre `MainActivity`.

## 4. Build limpo

```powershell
cd C:\TotemDigital-Studio\Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 `
  -Clean `
  -NoConfigPush
```

## 5. Instalar APK já compilado

```powershell
cd C:\TotemDigital-Studio\Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 `
  -SkipBuild `
  -NoConfigPush
```

Ou diretamente:

```powershell
adb install -r -d -g `
  C:\TotemDigital-Studio\Player-AD\build\outputs\apk\release\Player-AD-release.apk

adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity
```

## 6. Instalar e enviar configuração

Use apenas em provisionamento inicial ou quando quiser substituir deliberadamente a configuração do aparelho:

```powershell
cd C:\TotemDigital-Studio\Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 `
  -ConfigJson "C:\configs\player-producao.json"
```

Exemplo mínimo:

```json
{
  "serverUrl": "https://totemdigital.app.br",
  "uin": "T1000",
  "deviceId": "T1000-Exterminator",
  "displayRotation": 0,
  "screenOrientation": "portrait"
}
```

Ambientes:

```text
Produção: https://totemdigital.app.br
DEV:      https://dev.totemdigital.app.br
TESTE:    https://test.totemdigital.app.br
```

## 7. Outras opções do script

```text
-NoCopyToPendrive  não atualiza install-pendrive/apk
-NoConfigPush      não sobrescreve player-config.json
-NoLaunch          não abre a aplicação no final
-OpenConfig        abre a tela de configuração
-NoKioskSetup      não aplica provisionamento kiosk
-UserRotation N    valor Android user_rotation (default: 1)
```

## 8. Instalação por pendrive

1. Compile o APK no PC.
2. Confirme o arquivo:

```powershell
Get-Item C:\TotemDigital-Studio\install-pendrive\apk\Player-AD-release.apk
```

3. Copie a pasta `install-pendrive` para o pendrive.
4. No Android, siga:

```text
install-pendrive/docs/MANUAL-INSTALACAO-PLAYER-AD.md
install-pendrive/LEIA-ME.txt
```

## 9. Verificação

```powershell
adb shell dumpsys package br.com.smartchannel.playerad |
  Select-String "versionCode|versionName"

adb shell settings get system user_rotation
adb shell settings get system accelerometer_rotation

adb logcat -d -s Player-AD:I *:S
```

Esperado para a TV Box de referência:

```text
versionName=2.11
versionCode=111
accelerometer_rotation=0
Player-AD inicia em MainActivity
heartbeat e dispatch respondem
playlist é baixada para cache e reproduzida
```

## 10. Designação e download no painel

Em **Configurações → APK**, o painel apresenta a versão Android oficialmente
designada para produção, SHA-256, build, commit, certificado e documentação.

O upload continua no módulo OTA. Ao ativar um pacote Android, ele passa a ser a
versão designada de produção. A aba APK e o heartbeat consultam o mesmo
registro; não use o nome do arquivo ou a maior versão como fonte de verdade.

## 10. Atualização segura do APK

```powershell
adb devices -l
cd C:\TotemDigital-Studio\Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 -NoConfigPush
```

Não faça push da configuração em atualizações normais: isso pode voltar `displayRotation`, `uin`, `deviceId` ou `serverUrl` para os valores do arquivo-modelo.

## 11. Diagnóstico rápido

```powershell
# Aplicação instalada?
adb shell pm list packages | Select-String playerad

# Processo ativo?
adb shell pidof br.com.smartchannel.playerad

# Reiniciar sem reinstalar:
adb shell am force-stop br.com.smartchannel.playerad
adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity

# Testar servidor configurado:
curl.exe -I https://totemdigital.app.br/api/health
```

