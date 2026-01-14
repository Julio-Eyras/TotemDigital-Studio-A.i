package com.smartsignage.player.core

import android.content.Context
import android.util.Log
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.models.PlaylistItem
import com.smartsignage.player.models.PlaylistResponse
import com.smartsignage.player.models.DispatchPlan
import com.smartsignage.player.models.DispatchPlanMediaItem
import com.smartsignage.player.cache.MediaCacheManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Playlist Manager - Android
 * Gerenciador de playlist com cache local
 */
class PlaylistManager(
    private val apiClient: APIClient,
    private val context: Context? = null
) {
    private val cacheManager: MediaCacheManager? = context?.let { MediaCacheManager(it) }
    
    // Formato NOVO (preferencial): DispatchPlan nativo
    var currentDispatchPlan: DispatchPlan? = null
        private set
    
    // Formato ANTIGO (legado): PlaylistResponse (mantido para compatibilidade)
    private var currentPlaylist: PlaylistResponse? = null
    private var currentIndex = 0
    private var lastUpdate: Long = 0

    companion object {
        private const val TAG = "PlaylistManager"
    }

    /**
     * Carrega playlist LEGADA do servidor.
     *
     * Mantido para compatibilidade, mas o fluxo preferencial é via DispatchPlan.
     */
    suspend fun loadLegacyPlaylist(): Boolean {
        return try {
            val playlist = apiClient.getPlaylist()
            if (playlist != null && validatePlaylist(playlist)) {
                currentPlaylist = playlist
                lastUpdate = System.currentTimeMillis()
                currentIndex = 0
                true
            } else {
                Log.e(TAG, "Invalid legacy playlist format")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load legacy playlist", e)

            if (e.message?.contains("403") == true || e.message?.contains("FORBIDDEN") == true) {
                Log.e(TAG, "Acesso negado: totem não acessível através de contratos/planos ativos")
            }

            false
        }
    }

    /**
     * NOVO FLUXO: Carrega conteúdo a partir de um DispatchPlan do dispatcher.
     *
     * Usa DispatchPlan NATIVAMENTE, sem conversão para formato antigo.
     * Processa cache local de mídias em background.
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

            if (dispatchResponse == null) {
                Log.e(TAG, "Dispatch response is null")
                false
            } else if (!dispatchResponse.success || dispatchResponse.plan == null) {
                Log.e(TAG, "Dispatch failed: ${dispatchResponse.error}")
                false
            } else {
                val plan: DispatchPlan = dispatchResponse.plan
                
                // Armazenar DispatchPlan nativamente (sem conversão)
                currentDispatchPlan = plan
                currentPlaylist = null // Limpar formato antigo
                
                // Processar cache de mídias em background (se cacheManager disponível)
                if (cacheManager != null) {
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val stats = cacheManager.processDispatchPlan(plan, apiClient)
                            Log.i(TAG, "Cache processado: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas")
                        } catch (e: Exception) {
                            Log.e(TAG, "Erro ao processar cache", e)
                        }
                    }
                }
                
                lastUpdate = System.currentTimeMillis()
                currentIndex = 0
                Log.i(TAG, "DispatchPlan carregado nativamente: ${plan.playlistName} (${plan.mediaItems.size} itens)")
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load from DispatchPlan", e)
            false
        }
    }

    /**
     * Valida formato da playlist
     */
    private fun validatePlaylist(playlist: PlaylistResponse): Boolean {
        if (playlist.items.isEmpty()) {
            return false
        }

        // Validar cada item
        for (item in playlist.items) {
            if (item.id == 0 || item.type.isEmpty() || item.url.isEmpty()) {
                return false
            }
        }

        return true
    }

    /**
     * Obtém caminho local de uma mídia (se disponível em cache)
     */
    fun getLocalPath(mediaId: Int): String? {
        return cacheManager?.getLocalPath(mediaId)
    }
    
    /**
     * Carrega último DispatchPlan em cache (modo offline)
     */
    suspend fun loadLastDispatchPlanFromCache(): DispatchPlan? {
        return cacheManager?.loadLastDispatchPlan()
    }
    
    /**
     * DEPRECATED: Converte DispatchPlan para PlaylistResponse (mantido apenas para compatibilidade)
     * 
     * @deprecated Use getCurrentDispatchPlan() e trabalhe diretamente com DispatchPlan
     * TODO: Remover quando todos os componentes usarem DispatchPlan nativamente
     */
    @Deprecated("Use getCurrentDispatchPlan() instead")
    fun mapDispatchPlanToPlaylist(plan: DispatchPlan, useLocalPaths: Boolean = false): PlaylistResponse {
        val items = plan.mediaItems.map { mediaItem ->
            val type = when (mediaItem.mediaType.lowercase()) {
                "video" -> "video"
                "image" -> "image"
                "html", "web" -> "html"
                else -> "video"
            }
            
            var url = mediaItem.url
            if (useLocalPaths && cacheManager != null) {
                val localPath = cacheManager.getLocalPath(mediaItem.mediaId)
                if (localPath != null) {
                    url = "file://$localPath"
                }
            }
            
            PlaylistItem(
                id = mediaItem.mediaId,
                type = type,
                url = url,
                duration = mediaItem.duration?.let { it * 1000 }, // Converter segundos para ms
                name = mediaItem.metadata?.get("name") as? String,
                schedule = null
            )
        }

        return PlaylistResponse(
            id = plan.playlistId ?: 0,
            name = plan.playlistName ?: "DispatchPlan Playlist",
            items = items
        )
    }

    /**
     * Obtém próximo item (preferencialmente do DispatchPlan, fallback para playlist legada)
     */
    fun getNextItem(): DispatchPlanMediaItem? {
        // Prioridade 1: DispatchPlan (formato nativo)
        val plan = currentDispatchPlan
        if (plan != null && plan.mediaItems.isNotEmpty()) {
            val item = plan.mediaItems[currentIndex]
            currentIndex = (currentIndex + 1) % plan.mediaItems.size
            return item
        }
        
        // Fallback: Playlist legada (compatibilidade)
        val playlist = currentPlaylist
        if (playlist != null && playlist.items.isNotEmpty()) {
            val item = playlist.items[currentIndex]
            currentIndex = (currentIndex + 1) % playlist.items.size
            // Converter para DispatchPlanMediaItem (temporário, até remover formato antigo)
            return convertPlaylistItemToDispatchPlanMediaItem(item)
        }
        
        return null
    }

    /**
     * Obtém item atual (preferencialmente do DispatchPlan, fallback para playlist legada)
     */
    fun getCurrentItem(): DispatchPlanMediaItem? {
        // Prioridade 1: DispatchPlan (formato nativo)
        val plan = currentDispatchPlan
        if (plan != null && plan.mediaItems.isNotEmpty()) {
            return plan.mediaItems[currentIndex]
        }
        
        // Fallback: Playlist legada (compatibilidade)
        val playlist = currentPlaylist
        if (playlist != null && playlist.items.isNotEmpty()) {
            val item = playlist.items[currentIndex]
            // Converter para DispatchPlanMediaItem (temporário, até remover formato antigo)
            return convertPlaylistItemToDispatchPlanMediaItem(item)
        }
        
        return null
    }
    
    /**
     * Obtém DispatchPlan completo (formato nativo)
     */
    fun getCurrentDispatchPlan(): DispatchPlan? {
        return currentDispatchPlan
    }
    
    /**
     * Conversão temporária: PlaylistItem -> DispatchPlanMediaItem (para compatibilidade)
     * TODO: Remover quando formato antigo for completamente descontinuado
     */
    private fun convertPlaylistItemToDispatchPlanMediaItem(item: PlaylistItem): DispatchPlanMediaItem {
        return DispatchPlanMediaItem(
            mediaId = item.id,
            order = currentIndex,
            duration = item.duration?.div(1000), // Converter ms para segundos
            url = item.url,
            mediaType = item.type,
            metadata = mapOf("name" to (item.name ?: ""))
        )
    }

    /**
     * Obtém item por ID
     */
    fun getItemById(id: Int): PlaylistItem? {
        return currentPlaylist?.items?.find { it.id == id }
    }

    /**
     * Verifica se playlist precisa ser atualizada
     */
    fun needsUpdate(updateInterval: Long = 300000): Boolean { // 5 minutos padrão
        if (lastUpdate == 0L) {
            return true
        }

        val now = System.currentTimeMillis()
        return (now - lastUpdate) >= updateInterval
    }

    /**
     * Reseta playlist
     */
    fun reset() {
        currentDispatchPlan = null
        currentPlaylist = null
        currentIndex = 0
        lastUpdate = 0
    }
}

