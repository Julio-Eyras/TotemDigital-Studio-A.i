package br.com.smartchannel.playerad.config

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Carrega configuração do Player-AD (serverUrl, uin, deviceId, acceptImagesInPlaylist,
 * fallbackPropagandasPerVinheta, maxSecondsWithoutServerCheck, storage, storagePathOverride).
 *
 * Ordem de busca:
 * 1. Arquivo interno em filesDir/player-config.json (se existir)
 * 2. Arquivo externo em /sdcard/smartsignage/player-config.json (se existir)
 * 3. Defaults embutidos (fallback)
 */
class PlayerConfigLoader(private val context: Context) {

    fun load(): PlayerConfig {
        // 1) interno (útil para debug/emulador; salva sem permissões)
        val internal = File(context.filesDir, "player-config.json")
        if (internal.exists()) {
            parseConfigFile(internal)?.let { return it }
        }

        // 2) externo (se existir, mantém compatibilidade com auto_install.sh)
        val external = File("/sdcard/smartsignage/player-config.json")
        if (external.exists()) {
            parseConfigFile(external)?.let { return it }
        }

        // 3) defaults seguros (substituir depois via config real)
        return PlayerConfig(
            serverUrl = "http://192.168.1.110",
            uin = "tot001",
            deviceId = "android-tv-tot001",
            acceptImagesInPlaylist = true,
            fallbackPropagandasPerVinheta = 3,
            maxSecondsWithoutServerCheck = 60,
            storageMode = PlayerStorageMode.AUTO,
            storagePathOverride = null
        )
    }

    private fun parseConfigFile(file: File): PlayerConfig? {
        return try {
            val text = file.readText(Charsets.UTF_8)
            val json = JSONObject(text)
            val serverUrl = json.optString("serverUrl", "").trim()
            val uin = json.optString("uin", "").trim()
            val deviceId = json.optString("deviceId", "").trim()
            if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) {
                null
            } else {
                val acceptImages = json.optBoolean("acceptImagesInPlaylist", true)
                val fallbackRatioRaw = json.optInt("fallbackPropagandasPerVinheta", 3)
                val fallbackRatio = fallbackRatioRaw.coerceAtLeast(1)
                val maxSecondsRaw = json.optInt("maxSecondsWithoutServerCheck", 60)
                val maxSeconds = maxSecondsRaw.coerceAtLeast(10)
                val storageMode = parseStorageMode(json.optString("storage", ""))
                val pathOverride = json.optString("storagePathOverride", "").trim().takeIf { it.isNotBlank() }
                PlayerConfig(
                    serverUrl = serverUrl,
                    uin = uin,
                    deviceId = deviceId,
                    acceptImagesInPlaylist = acceptImages,
                    fallbackPropagandasPerVinheta = fallbackRatio,
                    maxSecondsWithoutServerCheck = maxSeconds,
                    storageMode = storageMode,
                    storagePathOverride = pathOverride
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        fun parseStorageMode(raw: String?): PlayerStorageMode {
            if (raw.isNullOrBlank()) return PlayerStorageMode.AUTO
            return when (raw.trim().lowercase()) {
                "internal" -> PlayerStorageMode.INTERNAL
                "external_primary", "external", "externalprimary" -> PlayerStorageMode.EXTERNAL_PRIMARY
                "sdcard", "sd_card", "microsd", "secondary_external" -> PlayerStorageMode.SD_CARD
                "removable_preferred", "removable", "usb" -> PlayerStorageMode.REMOVABLE_PREFERRED
                "path_override", "path", "custom" -> PlayerStorageMode.PATH_OVERRIDE
                "auto" -> PlayerStorageMode.AUTO
                else -> PlayerStorageMode.AUTO
            }
        }

        /** Valor estável em JSON (`SD_CARD` → `"sdcard"`). */
        fun storageModeToJsonValue(mode: PlayerStorageMode): String = when (mode) {
            PlayerStorageMode.SD_CARD -> "sdcard"
            else -> mode.name.lowercase()
        }
    }
}

