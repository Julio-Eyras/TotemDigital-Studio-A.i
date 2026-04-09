package br.com.smartchannel.smartsignagead.config

data class AppConfig(
    val serverUrl: String,
    val uin: String,
    val deviceId: String,
    val mode: String = "hybrid",
    val syncIntervalSeconds: Int = 30,
    val acceptImagesInPlaylist: Boolean = true,
    val fallbackPropagandasPerVinheta: Int = 2,
    val internalCacheLimitPercent: Int = 30,
    val imageDurationSeconds: Int = 20,
    val fallbackPropagandas: List<String> = emptyList(),
    val fallbackVinhetas: List<String> = emptyList()
)
