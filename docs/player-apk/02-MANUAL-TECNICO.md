# Player-AD — Manual técnico

## Componentes

- `MainActivity`: ciclo de vida, watchdog e modo quiosque.
- `PlayerController`: dispatch, cache, agenda e reprodução.
- `DispatcherApiClient`: token, heartbeat, plano e comandos.
- `PlayerEventsClient`: eventos persistentes e sincronização.
- `OtaUpdateCoordinator`: download, integridade e instalação OTA.

## Diagnóstico

```bash
adb devices -l
adb shell dumpsys package br.com.smartchannel.playerad | grep -E "versionCode|versionName"
adb logcat -s "Player-AD:*"
```

Verifique primeiro: conectividade, token, heartbeat, versão do plano, espaço em
disco, cache, agenda e estado do decodificador.

## Identidade

- Package: `br.com.smartchannel.playerad`.
- UIN e Device ID são canônicos, sem espaços e em maiúsculas.
- A assinatura do APK deve ser compatível com a versão instalada.

## Atualização

O backend oferece apenas o pacote designado no canal de produção. O player
compara a versão, respeita rollout, baixa o arquivo, valida SHA-256 e reporta o
estado da instalação.

Referências: `Player-AD/docs/MANUAL-ARQUITETURA-DESENVOLVIMENTO.md` e
`Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md`.
