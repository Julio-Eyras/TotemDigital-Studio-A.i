# Player Android TV

Player cliente para Android TV (Android 7.0+ / API 24+).

## 📋 Requisitos

- Android Studio
- Android SDK (API 24+)
- Android TV SDK
- Kotlin 1.8+
- Gradle 7.0+

## 🚀 Instalação

### 1. Configurar Ambiente

```bash
# Instalar Android Studio
# Configurar Android SDK
# Configurar variáveis de ambiente ANDROID_HOME
```

### 2. Build

```bash
cd platforms/android
./gradlew assembleDebug
```

### 3. Instalar no Dispositivo

```bash
# Conectar dispositivo Android TV via USB ou ADB over network
adb install app/build/outputs/apk/debug/app-debug.apk
```

## 🔧 Desenvolvimento

### Estrutura

```
android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/smartsignage/player/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── api/
│   │   │   │   ├── player/
│   │   │   │   └── services/
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## 📚 Documentação

- [Android TV Developer Guide](https://developer.android.com/training/tv)
- [Leanback Library](https://developer.android.com/training/tv/start/start)

