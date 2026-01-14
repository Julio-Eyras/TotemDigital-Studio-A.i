# Smart Signage Android Player

Player Android completo com suporte a DispatchPlan nativo, cache local, servidor HTTP local e **descoberta automática via mDNS (NSD)**.

## 🚀 Funcionalidades

- ✅ DispatchPlan nativo (sem conversão)
- ✅ Cache local de mídias
- ✅ Servidor HTTP local (porta 8080)
- ✅ **Descoberta automática via mDNS (NSD)** ⭐ NOVO
- ✅ Validação temporal (validityStart/validityEnd)
- ✅ Modo offline
- ✅ Heartbeat periódico
- ✅ Sincronização automática

## 🔍 Descoberta Automática (mDNS/NSD)

### Como Funciona

1. **Totem Android anuncia via NSD API:**
   - Nome: `Publisher-{deviceId}`
   - Serviço: `_smartsignage-totem._tcp`
   - Porta: 8080
   - Atributos TXT: role=publisher, player=android, version=2.1.0, totemUIN={UIN}

2. **Smart TVs descobrem automaticamente:**
   - webOS: via `webOS.service.mdns`
   - Tizen: via SSDP ou mDNS
   - Não requer configuração manual de IP

3. **Fallback:**
   - Se mDNS não disponível, usa scan básico
   - Se scan falhar, usa servidor central

### Permissões Necessárias

Adicionadas automaticamente no `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
```

### Verificar Descoberta

```bash
# Via adb shell
adb shell dumpsys nsd

# Ou usar app de teste mDNS na rede local
```

## 📋 Componentes

### PlayerViewModel.kt
ViewModel principal que gerencia estado do player.

### discovery/TotemDiscoveryService.kt ⭐ NOVO
Gerencia registro e descoberta via NSD API (mDNS).

### server/LocalHttpServer.kt
Servidor HTTP local para servir mídias às Smart TVs.

### cache/MediaCacheManager.kt
Gerenciador de cache local de mídias.

### core/PlaylistManager.kt
Gerencia DispatchPlan nativo.

### player/MediaPlayer.kt
Player de mídia usando ExoPlayer.

## 🔧 Configuração

### AndroidManifest.xml

Permissões já adicionadas:
- `CHANGE_WIFI_MULTICAST_STATE` - Necessário para mDNS
- `INTERNET` - Comunicação com backend
- `ACCESS_NETWORK_STATE` - Verificar conectividade

### build.gradle

Dependências já incluídas:
- `androidx.lifecycle:lifecycle-viewmodel-ktx` - ViewModel
- `androidx.media3:media3-exoplayer` - Player de mídia
- `com.squareup.okhttp3:okhttp` - HTTP client

## 📝 Requisitos

- Android SDK 24+ (Android 7.0+)
- Permissões de rede configuradas
- TOTEM_UIN configurado (SharedPreferences ou config remota)

## 🎯 Integração

### Inicialização Automática

O `TotemDiscoveryService` é inicializado automaticamente no `PlayerViewModel.initialize()`:

```kotlin
// Registro automático via mDNS
discoveryService = TotemDiscoveryService(getApplication())
discoveryService?.registerTotem(TOTEM_UIN, 8080)
```

### Limpeza Automática

O serviço é desregistrado automaticamente em `onCleared()`:

```kotlin
override fun onCleared() {
    discoveryService?.unregisterTotem()
}
```

## 📚 Documentação Relacionada

- `docs/ANALISE_MDNS_SSDP_SCAN.md` - Análise completa de mDNS/SSDP
- `docs/ANALISE_MDNS_SSDP_SCAN_ANDROID.md` - Detalhes específicos Android
- `docs/ARQUITETURA-DESCOBERTA-TOTEM-LOCAL.md` - Arquitetura de descoberta

## 🔍 Troubleshooting

**Problema**: Totem não aparece na descoberta
- Verificar se permissões estão no AndroidManifest.xml
- Verificar se TOTEM_UIN está configurado
- Verificar logs: `adb logcat | grep TotemDiscoveryService`

**Problema**: Erro FAILURE_ALREADY_ACTIVE
- Serviço já está registrado (normal após reinicialização)
- O sistema tenta desregistrar e registrar novamente automaticamente

**Problema**: Erro FAILURE_INTERNAL_ERROR
- NSD pode não estar disponível no dispositivo
- Verificar se dispositivo suporta NSD API
- Fallback para scan básico ou servidor central
