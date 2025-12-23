package com.smartsignage.player.hls

/**
 * Data classes compartilhadas
 */

data class Config(
    val apiBaseUrl: String,
    val streamUrl: String = "",
    val heartbeatInterval: Long,
    val commandPollInterval: Long,
    val watchdogInterval: Long,
    val fallbackUrls: List<String>
)

data class ValidationResult(
    val streamUrl: String? = null
)

data class Command(
    val action: String,
    val stream: String? = null,
    val volume: Float? = null
)

