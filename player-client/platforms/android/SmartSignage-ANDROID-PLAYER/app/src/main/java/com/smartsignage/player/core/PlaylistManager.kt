package com.smartsignage.player.core

import android.util.Log
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.models.PlaylistItem
import com.smartsignage.player.models.PlaylistResponse

/**
 * Playlist Manager - Android
 * Gerenciador de playlist
 */
class PlaylistManager(
    private val apiClient: APIClient
) {
    private var currentPlaylist: PlaylistResponse? = null
    private var currentIndex = 0
    private var lastUpdate: Long = 0

    companion object {
        private const val TAG = "PlaylistManager"
    }

    /**
     * Carrega playlist do servidor
     */
    suspend fun loadPlaylist(): Boolean {
        return try {
            val playlist = apiClient.getPlaylist()
            if (playlist != null && validatePlaylist(playlist)) {
                currentPlaylist = playlist
                lastUpdate = System.currentTimeMillis()
                currentIndex = 0
                true
            } else {
                Log.e(TAG, "Invalid playlist format")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load playlist", e)
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
     * Obtém próximo item da playlist
     */
    fun getNextItem(): PlaylistItem? {
        val playlist = currentPlaylist ?: return null
        if (playlist.items.isEmpty()) {
            return null
        }

        val item = playlist.items[currentIndex]
        currentIndex = (currentIndex + 1) % playlist.items.size
        return item
    }

    /**
     * Obtém item atual
     */
    fun getCurrentItem(): PlaylistItem? {
        val playlist = currentPlaylist ?: return null
        if (playlist.items.isEmpty()) {
            return null
        }

        return playlist.items[currentIndex]
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
        currentPlaylist = null
        currentIndex = 0
        lastUpdate = 0
    }
}

