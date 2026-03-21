# Player-AD – “aplicativo apresenta erro” / crash na TV

## 1) Garantir APK recente (layout Media3)

Se o `activity_main.xml` ainda usasse `com.google.android.exoplayer2.ui.PlayerView` com dependências **Media3**, o app pode fechar ao abrir. O layout correto é `androidx.media3.ui.PlayerView`.

Recompile e instale de novo:

```bash
cd ~/SmartSignage-Pro/Player-AD
./scripts/auto_install.sh
```

## 2) HTTP (LAN) com `targetSdk` alto

Com `targetSdk` 34, chamadas `http://` ao servidor podem ser bloqueadas sem `usesCleartextTraffic`. O manifest do Player-AD define `android:usesCleartextTraffic="true"` para uso em rede local.

## 3) Capturar o erro real (logcat)

Sem `rg`, use o script:

```bash
cd ~/SmartSignage-Pro/Player-AD
./scripts/capture-crash-log.sh
```

Ou manualmente:

```bash
adb logcat -c
adb shell am start -n br.com.smartchannel.playerad/.ui.MainActivity
# reproduza o erro
adb logcat -d | grep -iE "AndroidRuntime|FATAL|playerad|Player-AD"
adb logcat -b crash -d
```

Envie as linhas com **FATAL EXCEPTION** e **Caused by**.

## 4) Falha de rede / Dispatcher

Se não houver crash, mas tela preta: o `heartbeat` pode estar falhando (IP errado, firewall, HTTPS obrigatório). Veja `adb logcat` filtrando `Player-AD` após o build com `Log.e` em `MainActivity`.
