package com.smartsignage.player.models

/**
 * Modelos de dados para o player Android TV
 */

data class AuthResponse(
    val token: String,
    val refreshToken: String
)

data class PlaylistResponse(
    val id: Int,
    val name: String,
    val items: List<PlaylistItem>
)

data class PlaylistItem(
    val id: Int,
    val type: String, // "video", "image", "html"
    val url: String,
    val duration: Int?,
    val name: String?,
    val schedule: Schedule?
)

data class Schedule(
    val daysOfWeek: List<Int>?,
    val startTime: String?,
    val endTime: String?,
    val startDate: String?,
    val endDate: String?
)

data class PlayerConfigResponse(
    val serverUrl: String,
    val heartbeatInterval: Int,
    val mediaPath: String,
    val autoStart: Boolean,
    val fullscreen: Boolean,
    val portrait: Boolean,
    val abandonPin: String
)

data class HeartbeatData(
    val status: String,
    val timestamp: String,
    val metrics: Map<String, Any>?
)

/**
 * Novos modelos para integração com o Dispatcher/DispatchPlan
 */

/**
 * Resposta de autenticação de dispositivo (/api/player/token)
 */
data class DeviceTokenResponse(
    val token: String,
    val expiresIn: Long?
)

/**
 * Item de mídia dentro do DispatchPlan
 */
data class DispatchPlanMediaItem(
    val mediaId: Int,
    val order: Int,
    val duration: Int?,
    val url: String,
    val mediaType: String,
    val metadata: Map<String, Any>?
)

/**
 * Plano de exibição retornado pelo Dispatcher
 */
data class DispatchPlan(
    val totemId: Int,
    val timestamp: String?,
    val playlistId: Int?,
    val playlistName: String?,
    val mediaItems: List<DispatchPlanMediaItem>,
    val totalDuration: Int?,
    val priority: Int?,
    val source: String?,
    val sourceId: Int?
)

/**
 * Resposta completa de /api/player/dispatch
 */
data class DispatchResponse(
    val success: Boolean,
    val fromCache: Boolean,
    val executionTimeMs: Long?,
    val plan: DispatchPlan?,
    val error: String?
)

sealed class PlayerState {
    object Loading : PlayerState()
    // Suporta tanto PlaylistItem (legado) quanto DispatchPlanMediaItem (nativo)
    data class Playing(val item: Any) : PlayerState() {
        // Helper para obter DispatchPlanMediaItem se disponível
        fun getMediaItem(): DispatchPlanMediaItem? {
            return item as? DispatchPlanMediaItem
        }
        // Helper para obter PlaylistItem (compatibilidade)
        fun getPlaylistItem(): PlaylistItem? {
            return item as? PlaylistItem
        }
    }
    data class Error(val message: String) : PlayerState()
    object Idle : PlayerState()
}

