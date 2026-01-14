# Refatoração: DispatchPlan Nativo - Implementação

## ✅ O Que Foi Feito

Refatoramos o código para usar **DispatchPlan diretamente**, sem conversão para formato antigo de playlist.

### Mudanças Principais

#### 1. MediaPlayer - Android

**ANTES:**
```kotlin
fun play(item: PlaylistItem, onEnd: () -> Unit)
```

**DEPOIS:**
```kotlin
// Suporta ambos os formatos (compatibilidade)
fun play(item: PlaylistItem, onEnd: () -> Unit) // Legado
fun play(mediaItem: DispatchPlanMediaItem, onEnd: () -> Unit) // Nativo ✅
```

**Melhorias:**
- ✅ Aceita `DispatchPlanMediaItem` diretamente
- ✅ Usa caminho local automaticamente (se disponível via callback)
- ✅ Mantém compatibilidade com formato antigo

#### 2. PlaylistManager - Android

**ANTES:**
```kotlin
private var currentPlaylist: PlaylistResponse? = null

fun loadFromDispatchPlan(...): Boolean {
    val playlist = mapDispatchPlanToPlaylist(dispatchPlan) // ❌ Conversão
    currentPlaylist = playlist
}

fun getNextItem(): PlaylistItem? {
    return currentPlaylist?.items?.get(currentIndex) // ❌ Formato antigo
}
```

**DEPOIS:**
```kotlin
// Formato NOVO (preferencial)
var currentDispatchPlan: DispatchPlan? = null

// Formato ANTIGO (legado - compatibilidade)
private var currentPlaylist: PlaylistResponse? = null

fun loadFromDispatchPlan(...): Boolean {
    currentDispatchPlan = dispatchResponse.plan // ✅ Usa diretamente
    currentPlaylist = null // Limpa formato antigo
}

fun getNextItem(): DispatchPlanMediaItem? {
    // Prioridade 1: DispatchPlan (nativo)
    val plan = currentDispatchPlan
    if (plan != null && plan.mediaItems.isNotEmpty()) {
        val item = plan.mediaItems[currentIndex]
        currentIndex = (currentIndex + 1) % plan.mediaItems.size
        return item // ✅ Retorna DispatchPlanMediaItem diretamente
    }
    
    // Fallback: Playlist legada (compatibilidade)
    // ...
}
```

**Melhorias:**
- ✅ Armazena `DispatchPlan` nativamente
- ✅ Retorna `DispatchPlanMediaItem` diretamente
- ✅ Mantém compatibilidade com formato antigo
- ✅ Remove conversão desnecessária

#### 3. PlayerViewModel - Android

**ANTES:**
```kotlin
private fun playNext() {
    val item = playlistManager.getNextItem() // PlaylistItem
    mediaPlayer?.play(item) { ... }
}
```

**DEPOIS:**
```kotlin
private fun playNext() {
    val mediaItem = playlistManager.getNextItem() // DispatchPlanMediaItem ✅
    
    // Validar validade temporal do DispatchPlan
    val dispatchPlan = playlistManager.getCurrentDispatchPlan()
    if (dispatchPlan != null) {
        // Validar validityStart/validityEnd
        // ...
    }
    
    mediaPlayer?.play(mediaItem) { ... } // ✅ Usa DispatchPlanMediaItem
}
```

**Melhorias:**
- ✅ Usa `DispatchPlanMediaItem` diretamente
- ✅ Valida validade temporal do DispatchPlan
- ✅ Configura callback para caminhos locais

#### 4. PlayerState - Android

**ANTES:**
```kotlin
data class Playing(val item: PlaylistItem) : PlayerState()
```

**DEPOIS:**
```kotlin
data class Playing(val item: Any) : PlayerState() {
    fun getMediaItem(): DispatchPlanMediaItem? {
        return item as? DispatchPlanMediaItem
    }
    fun getPlaylistItem(): PlaylistItem? {
        return item as? PlaylistItem
    }
}
```

**Melhorias:**
- ✅ Suporta ambos os formatos
- ✅ Helpers para acesso type-safe

---

## 🎯 Benefícios da Refatoração

### 1. Mais Informações Disponíveis

**Antes (PlaylistItem):**
```kotlin
PlaylistItem(
    id: 123,
    type: "video",
    url: "http://...",
    duration: 10000,
    name: "Video"
)
```

**Depois (DispatchPlanMediaItem):**
```kotlin
DispatchPlanMediaItem(
    mediaId: 123,
    order: 1,
    duration: 10, // segundos
    url: "http://...",
    mediaType: "video",
    metadata: mapOf(
        "name" to "Video",
        "checksum" to "abc123...",
        "size" to 10485760,
        "mimeType" to "video/mp4",
        "priority" to 10,
        "campaignId" to 5
    )
)
```

### 2. Validação Temporal

Agora podemos validar `validityStart` e `validityEnd` do DispatchPlan:

```kotlin
val dispatchPlan = playlistManager.getCurrentDispatchPlan()
if (dispatchPlan != null) {
    val now = System.currentTimeMillis()
    val validityStart = dispatchPlan.validityStart?.let { 
        java.time.Instant.parse(it).toEpochMilli() 
    }
    val validityEnd = dispatchPlan.validityEnd?.let { 
        java.time.Instant.parse(it).toEpochMilli() 
    }
    
    if (validityStart != null && now < validityStart) {
        // Aguardar até ser válido
    }
    
    if (validityEnd != null && now > validityEnd) {
        // Recarregar DispatchPlan
    }
}
```

### 3. Prioridade e Source

Podemos usar `priority` e `source` do DispatchPlan:

```kotlin
val dispatchPlan = playlistManager.getCurrentDispatchPlan()
if (dispatchPlan?.priority != null) {
    // Aplicar lógica baseada em prioridade
}

if (dispatchPlan?.source == "campaign") {
    // Lógica específica para campanhas
}
```

### 4. Metadata Extenso

Acesso a metadados completos:

```kotlin
val mediaItem = playlistManager.getCurrentItem()
val checksum = mediaItem?.metadata?.get("checksum") as? String
val size = mediaItem?.metadata?.get("size") as? Long
val campaignId = mediaItem?.metadata?.get("campaignId") as? Int
```

---

## 📊 Comparação: Antes vs Depois

### Antes (Com Conversão)

```
DispatchPlan (Backend)
    ↓
mapDispatchPlanToPlaylist() ❌ Conversão
    ↓
PlaylistResponse (Formato Antigo)
    ↓
PlaylistItem (Perde informações)
    ↓
MediaPlayer.play(PlaylistItem)
```

**Problemas:**
- ❌ Perde priority, source, validityStart, validityEnd
- ❌ Perde metadata extenso
- ❌ Código de conversão desnecessário
- ❌ Dois formatos para manter

### Depois (Nativo)

```
DispatchPlan (Backend)
    ↓
currentDispatchPlan = dispatchPlan ✅ Direto
    ↓
DispatchPlanMediaItem (Formato Nativo)
    ↓
MediaPlayer.play(DispatchPlanMediaItem) ✅
```

**Vantagens:**
- ✅ Mantém todas as informações
- ✅ Código mais simples
- ✅ Melhor performance
- ✅ Um único formato (DispatchPlan)

---

## 🔄 Compatibilidade Mantida

A refatoração **mantém compatibilidade** com o sistema legado:

1. **MediaPlayer** aceita ambos os formatos
2. **PlaylistManager** suporta ambos os formatos
3. **PlayerState** suporta ambos os formatos
4. **Fallback** para formato antigo se necessário

---

## 📝 Próximos Passos

### webOS e Tizen

Aplicar mesma refatoração:

1. ✅ Remover `convertDispatchPlanToPlaylist()`
2. ✅ Usar `currentDispatchPlan` diretamente
3. ✅ Atualizar `MediaPlayer` para aceitar `DispatchPlanMediaItem`
4. ✅ Validar validade temporal

### Remover Formato Antigo (Futuro)

Quando todos os players usarem DispatchPlan nativamente:

1. Remover `PlaylistResponse` e `PlaylistItem`
2. Remover métodos de conversão
3. Simplificar código

---

## ✅ Status

- ✅ **Android:** Refatorado para usar DispatchPlan nativamente
- ⏳ **webOS:** Pendente (ainda usa conversão)
- ⏳ **Tizen:** Pendente (ainda usa conversão)

**Próximo passo:** Refatorar webOS e Tizen para usar DispatchPlan nativamente.
