# Guia de Deploy - Android TV Player

## Pré-requisitos

1. **Android Studio**
   - Versão mais recente
   - Android SDK (API 24+)
   - Android TV SDK

2. **Certificado de Assinatura**
   - Criar keystore para assinar APK de release

3. **Dispositivo Android TV**
   - Android 7.0+ (API 24+)
   - Conectado via USB ou ADB over network

## Build

### Debug

```bash
cd platforms/android
./gradlew assembleDebug
```

APK será gerado em: `app/build/outputs/apk/debug/app-debug.apk`

### Release

1. **Configurar keystore**
   - Criar keystore: `keytool -genkey -v -keystore smartsignage.keystore -alias smartsignage -keyalg RSA -keysize 2048 -validity 10000`
   - Adicionar ao `app/build.gradle`:
   ```gradle
   signingConfigs {
       release {
           storeFile file('smartsignage.keystore')
           storePassword 'your_password'
           keyAlias 'smartsignage'
           keyPassword 'your_password'
       }
   }
   ```

2. **Build release**
   ```bash
   ./gradlew assembleRelease
   ```

APK será gerado em: `app/build/outputs/apk/release/app-release.apk`

## Instalação

### Via ADB

```bash
# Conectar dispositivo
adb devices

# Instalar
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Via USB

1. Habilitar "Depuração USB" no dispositivo
2. Conectar via USB
3. Android Studio → Run → Run 'app'

## Publicação

### Google Play Store

1. Criar conta de desenvolvedor
2. Criar app no Play Console
3. Fazer upload do APK assinado
4. Preencher informações do app
5. Enviar para revisão

## Configuração

Editar `PlayerViewModel.kt`:
- `API_BASE_URL`: URL do backend
- `TOTEM_UIN`: UIN do totem
- `TOTEM_SECRET`: Secret do totem

Ou usar SharedPreferences para configuração dinâmica.

## Troubleshooting

### App não inicia
- Verificar logs: `adb logcat | grep SmartSignage`
- Verificar permissões no AndroidManifest.xml
- Verificar se dispositivo é Android TV

### Erro de conexão
- Verificar `API_BASE_URL`
- Verificar permissão INTERNET
- Verificar firewall

### Mídia não carrega
- Verificar URLs das mídias
- Verificar CORS no backend
- Verificar permissões de rede

