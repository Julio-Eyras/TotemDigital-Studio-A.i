# Comandos de Rede e Gerenciamento: Tizen vs Android TV

Este documento apresenta os comandos equivalentes para as plataformas **Samsung Tizen (SSSP)** e **Android TV**, organizados pelas mesmas categorias utilizadas para o webOS.

---

## 1. Controle de Energia e Sistema
Gerenciamento do estado operacional e ciclos de energia.

| Categoria | Samsung Tizen (SSSP/B2B API) | Android TV (Management API / Native) |
| :--- | :--- | :--- |
| **Reboot** | `b2bControl.rebootDevice()` | `PowerManager.reboot()` ou Comando MDM `REBOOT` |
| **Power Off** | `b2bControl.setPowerState("OFF")` | Requer privilégios de sistema (Device Owner) |
| **Power On** | Wake-on-LAN (WoL) via Magic Packet | Wake-on-LAN (WoL) ou HDMI-CEC |
| **Display On/Off** | `b2bControl.setScreenPower(true/false)` | `DisplayManager` ou `WindowManager` (via App) |
| **Schedule Power** | `b2bControl.setPowerTimer()` | Agendamento via Alarme ou Política MDM |

---

## 2. Monitoramento e Diagnóstico
Verificação de saúde e auditoria visual remota.

| Categoria | Samsung Tizen (SSSP/B2B API) | Android TV (Management API / Native) |
| :--- | :--- | :--- |
| **Get Status** | `b2bControl.getDeviceStatus()` | `BatteryManager` (Temp) / `ActivityManager` |
| **Screenshot** | `b2bControl.captureScreen()` | `MediaProjection` ou Comando MDM `SCREEN_CAPTURE` |
| **Storage Info** | `tizen.filesystem.getStorage()` | `StatFs` ou `StorageManager` |
| **Network Info** | `tizen.systeminfo.getPropertyValue("WIFI_NETWORK")` | `ConnectivityManager` / `WifiManager` |
| **Log Retrieval** | `b2bControl.getSystemLogs()` | `Logcat` (via App) ou MDM Log Retrieval |

---

## 3. Configuração de Hardware
Ajustes de periféricos e restrições de segurança.

| Categoria | Samsung Tizen (SSSP/B2B API) | Android TV (Management API / Native) |
| :--- | :--- | :--- |
| **Backlight** | `b2bControl.setBacklight(0-100)` | `Settings.System.SCREEN_BRIGHTNESS` |
| **Volume** | `tizen.tvaudiocontrol.setVolume(0-100)` | `AudioManager.setStreamVolume()` |
| **Mute** | `tizen.tvaudiocontrol.setMute(true/false)` | `AudioManager.setStreamMute()` |
| **OSD Lock** | `b2bControl.setOsdLock(true/false)` | `DevicePolicyManager.setStatusBarDisabled()` |
| **USB Lock** | `b2bControl.setUsbLock(true/false)` | `DevicePolicyManager.addUserRestriction(DISALLOW_USB_FILE_TRANSFER)` |
| **Orientation** | `b2bControl.setScreenOrientation()` | `Activity.setRequestedOrientation()` |

---

## 4. Gestão de Conteúdo e Arquivos
Manipulação de mídias no armazenamento local.

| Categoria | Samsung Tizen (SSSP/B2B API) | Android TV (Management API / Native) |
| :--- | :--- | :--- |
| **Download File** | `tizen.download.start()` | `DownloadManager` ou HTTP Client (OkHttp) |
| **Delete File** | `file.remove()` (Filesystem API) | `File.delete()` (Java/Kotlin API) |
| **List Files** | `directory.listFiles()` | `File.listFiles()` |
| **Clear Cache** | `b2bControl.clearBrowserCache()` | `context.cacheDir.deleteRecursively()` |

---

## Considerações de Implementação

### Samsung Tizen (SSSP)
As APIs de controle de hardware (B2B APIs) exigem que a aplicação seja instalada como uma **aplicação de sinalização (Signage App)** e que o dispositivo esteja no modo comercial. Muitas dessas funções são acessadas via o objeto `b2bapis` ou `tizen`.

### Android TV
Para controle total (como Reboot e Bloqueio de USB), o aplicativo deve ser definido como **Device Owner** (DPC). Em dispositivos de consumo, muitas dessas APIs são restritas por segurança, sendo necessário o uso de uma solução de **MDM (Mobile Device Management)** ou o provisionamento via Android Management API do Google.

---

## Referências
1. [Samsung Tizen Web Device API](https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references.html)
2. [Android Management API Reference](https://developers.google.com/android/management/reference/rest)
3. [Android Developers - DevicePolicyManager](https://developer.android.com/reference/android/app/admin/DevicePolicyManager)
