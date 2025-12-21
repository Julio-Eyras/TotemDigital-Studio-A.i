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

sealed class PlayerState {
    object Loading : PlayerState()
    data class Playing(val item: PlaylistItem) : PlayerState()
    data class Error(val message: String) : PlayerState()
    object Idle : PlayerState()
}

