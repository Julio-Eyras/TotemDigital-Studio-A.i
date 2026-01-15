# Refatoração: Usar DispatchPlan Nativamente (Sem Conversão)

## 🎯 Problema Identificado

Atualmente estamos **convertendo DispatchPlan para formato antigo de playlist**, o que é uma **má prática** porque:

1. **DispatchPlan é superior** - Tem mais informações (priority, source, validityStart, validityEnd, metadata)
2. **Perda de dados** - Conversão descarta informações valiosas
3. **Código desnecessário** - Conversão adiciona complexidade sem benefício
4. **Manutenção difícil** - Dois formatos para manter

## ✅ Solução: Usar DispatchPlan Diretamente

### Por que DispatchPlan é Superior?

```kotlin
// Formato ANTIGO (PlaylistResponse)
data class PlaylistItem(
    val id: Int,
    val type: String,
    val url: String,
    val duration: Int?,
    val name: String?,
    val schedule: Schedule?  // Agendamento simples
)

// Formato NOVO (DispatchPlan) - SUPERIOR
data class DispatchPlan(
    val totemId: Int,
    val timestamp: String?,
    val playlistId: Int?,
    val playlistName: String?,
    val mediaItems: List<DispatchPlanMediaItem>,
    val totalDuration: Int?,
    val priority: Int?,              // ✅ Prioridade da campanha
    val source: String?,             // ✅ Origem (campaign, playlist, direct)
    val sourceId: Int?,              // ✅ ID da origem
    val validityStart: String?,      // ✅ Validade início
    val validityEnd: String?,        // ✅ Validade fim
    val metadata: Map<String, Any>?  // ✅ Metadados extensos
)

data class DispatchPlanMediaItem(
    val mediaId: Int,
    val order: Int,                  // ✅ Ordem explícita
    val duration: Int?,
    val url: String,
    val mediaType: String,
    val metadata: Map<String, Any>? // ✅ Metadados por item
)
```

### Vantagens do DispatchPlan

1. **Mais Informações**
   - Priority (prioridade da campanha)
   - Source (origem: campaign, playlist, direct)
   - ValidityStart/End (validade temporal)
   - Metadata extenso

2. **Melhor Estrutura**
   - Ordem explícita (`order`)
   - Tipo de mídia padronizado (`mediaType`)
   - Metadados por item e por plano

3. **Compatível com Dispatcher**
   - Formato nativo do dispatcher
   - Sem perda de dados na conversão
   - Suporta campanhas e mixagem

## 🔄 Refatoração Necessária

### Android

**ANTES (com conversão):**
```kotlin
// PlaylistManager.kt
fun loadFromDispatchPlan(...): Boolean {
    val dispatchPlan = apiClient.getDispatchPlan(...)
    val playlist = mapDispatchPlanToPlaylist(dispatchPlan) // ❌ Conversão desnecessária
    currentPlaylist = playlist
    // ...
}

fun getNextItem(): PlaylistItem? {
    return currentPlaylist?.items?.get(currentIndex) // ❌ Usa formato antigo
}
```

**DEPOIS (nativo):**
```kotlin
// PlaylistManager.kt
private var currentDispatchPlan: DispatchPlan? = null

fun loadFromDispatchPlan(...): Boolean {
    val dispatchPlan = apiClient.getDispatchPlan(...)
    currentDispatchPlan = dispatchPlan // ✅ Usa diretamente
    currentIndex = 0
    // ...
}

fun getNextItem(): DispatchPlanMediaItem? {
    return currentDispatchPlan?.mediaItems?.get(currentIndex) // ✅ Usa DispatchPlan
}

fun getCurrentDispatchPlan(): DispatchPlan? {
    return currentDispatchPlan
}
```

**MediaPlayer precisa ser atualizado:**
```kotlin
// MediaPlayer.kt
fun play(mediaItem: DispatchPlanMediaItem) { // ✅ Aceita DispatchPlanMediaItem
    when (mediaItem.mediaType.lowercase()) {
        "video" -> playVideo(mediaItem.url)
        "image" -> showImage(mediaItem.url, mediaItem.duration ?: 10)
        "html" -> showHtml(mediaItem.url, mediaItem.duration ?: 10)
    }
}
```

### webOS/Tizen

**ANTES (com conversão):**
```javascript
// app.js
const playlist = convertDispatchPlanToPlaylist(dispatchPlan); // ❌ Conversão
playlistManager.currentPlaylist = playlist;
```

**DEPOIS (nativo):**
```javascript
// app.js
currentDispatchPlan = dispatchPlan; // ✅ Usa diretamente

// MediaPlayer aceita DispatchPlanMediaItem
function playMediaItem(mediaItem) {
    switch(mediaItem.mediaType) {
        case 'video':
            mediaPlayer.playVideo(mediaItem.url);
            break;
        case 'image':
            mediaPlayer.showImage(mediaItem.url, mediaItem.duration || 10);
            break;
        case 'html':
            mediaPlayer.showHtml(mediaItem.url, mediaItem.duration || 10);
            break;
    }
}
```

## 📋 Plano de Refatoração

### Fase 1: Android
1. ✅ Remover `mapDispatchPlanToPlaylist()` de `PlaylistManager`
2. ✅ Mudar `currentPlaylist` para `currentDispatchPlan: DispatchPlan?`
3. ✅ Atualizar `getNextItem()` para retornar `DispatchPlanMediaItem`
4. ✅ Atualizar `MediaPlayer` para aceitar `DispatchPlanMediaItem`
5. ✅ Atualizar `PlayerViewModel` para usar `DispatchPlan` diretamente

### Fase 2: webOS
1. ✅ Remover `convertDispatchPlanToPlaylist()` de `app.js`
2. ✅ Usar `currentDispatchPlan` diretamente
3. ✅ Atualizar `MediaPlayer` para aceitar `DispatchPlanMediaItem`
4. ✅ Atualizar `playNext()` para usar `DispatchPlanMediaItem`

### Fase 3: Tizen
1. ✅ Remover `convertDispatchPlanToValidation()` de `app.js`
2. ✅ Usar `currentDispatchPlan` diretamente
3. ✅ Atualizar `HLSPlayer` para aceitar `DispatchPlanMediaItem`
4. ✅ Extrair stream URL diretamente de `DispatchPlanMediaItem`

## 🎯 Benefícios da Refatoração

1. **Código Mais Simples**
   - Remove código de conversão
   - Menos bugs potenciais
   - Mais fácil de manter

2. **Melhor Performance**
   - Sem overhead de conversão
   - Menos objetos criados
   - Menos memória usada

3. **Mais Informações Disponíveis**
   - Priority, source, validity disponíveis
   - Metadata completo
   - Melhor para analytics

4. **Alinhado com Backend**
   - Formato nativo do dispatcher
   - Sem perda de dados
   - Facilita futuras extensões

## ⚠️ Compatibilidade

**Manter compatibilidade com sistema legado:**
- `loadLegacyPlaylist()` continua funcionando
- Fallback para formato antigo se necessário
- Migração gradual possível

## 📝 Exemplo Completo

### Android - PlaylistManager Refatorado

```kotlin
class PlaylistManager(
    private val apiClient: APIClient,
    private val context: Context? = null
) {
    private var currentDispatchPlan: DispatchPlan? = null
    private var currentIndex = 0
    private var lastUpdate: Long = 0
    private val cacheManager: MediaCacheManager? = context?.let { MediaCacheManager(it) }

    /**
     * Carrega DispatchPlan diretamente (sem conversão)
     */
    suspend fun loadFromDispatchPlan(
        uin: String,
        deviceToken: String,
        deviceId: String,
        timezone: String
    ): Boolean {
        return try {
            val dispatchResponse = apiClient.getDispatchPlan(
                uin = uin,
                deviceToken = deviceToken,
                deviceId = deviceId,
                timestampIso = null,
                timezone = timezone
            )

            if (dispatchResponse?.success == true && dispatchResponse.plan != null) {
                currentDispatchPlan = dispatchResponse.plan
                
                // Processar cache em background
                cacheManager?.let { manager ->
                    CoroutineScope(Dispatchers.IO).launch {
                        manager.processDispatchPlan(dispatchResponse.plan!!, apiClient)
                    }
                }
                
                currentIndex = 0
                lastUpdate = System.currentTimeMillis()
                true
            } else {
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load from DispatchPlan", e)
            false
        }
    }

    /**
     * Obtém próximo item (retorna DispatchPlanMediaItem diretamente)
     */
    fun getNextItem(): DispatchPlanMediaItem? {
        val plan = currentDispatchPlan ?: return null
        if (plan.mediaItems.isEmpty()) {
            return null
        }

        val item = plan.mediaItems[currentIndex]
        currentIndex = (currentIndex + 1) % plan.mediaItems.size
        return item
    }

    /**
     * Obtém item atual
     */
    fun getCurrentItem(): DispatchPlanMediaItem? {
        val plan = currentDispatchPlan ?: return null
        if (plan.mediaItems.isEmpty()) {
            return null
        }
        return plan.mediaItems[currentIndex]
    }

    /**
     * Obtém DispatchPlan completo
     */
    fun getCurrentDispatchPlan(): DispatchPlan? {
        return currentDispatchPlan
    }

    /**
     * Obtém caminho local de uma mídia (se disponível em cache)
     */
    fun getLocalPath(mediaId: Int): String? {
        return cacheManager?.getLocalPath(mediaId)
    }
}
```

### Android - MediaPlayer Refatorado

```kotlin
class MediaPlayer(private val context: Context) {
    private var exoPlayer: ExoPlayer? = null
    private var imageView: ImageView? = null
    private var webView: WebView? = null

    /**
     * Reproduz item de mídia do DispatchPlan
     */
    fun play(mediaItem: DispatchPlanMediaItem) {
        // Tentar usar caminho local primeiro
        val url = getLocalPath(mediaItem.mediaId) ?: mediaItem.url
        
        when (mediaItem.mediaType.lowercase()) {
            "video" -> playVideo(url)
            "image" -> showImage(url, mediaItem.duration ?: 10)
            "html" -> showHtml(url, mediaItem.duration ?: 10)
            else -> playVideo(url) // Fallback
        }
    }

    private fun playVideo(url: String) {
        // Implementação ExoPlayer
    }

    private fun showImage(url: String, durationSeconds: Int) {
        // Implementação ImageView
    }

    private fun showHtml(url: String, durationSeconds: Int) {
        // Implementação WebView
    }
}
```

## ✅ Conclusão

**DispatchPlan DEVE ser usado diretamente**, sem conversão para formato antigo. A refatoração é necessária para:

1. ✅ Aproveitar todas as informações do DispatchPlan
2. ✅ Simplificar o código
3. ✅ Melhorar performance
4. ✅ Facilitar manutenção futura

**Próximo passo:** Implementar refatoração completa para usar DispatchPlan nativamente em todos os players.
