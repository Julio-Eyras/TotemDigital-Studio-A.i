package br.com.smartchannel.playerad.config

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Carrega configuração do Player-AD (serverUrl, uin, deviceId, acceptImagesInPlaylist,
 * allowPlaybackAudio, fallbackPropagandasPerVinheta, batimentoCardiaco, maxSecondsWithoutServerCheck, storage, storagePathOverride).
 *
 * Ordem de busca:
 * 1. Arquivo interno em filesDir/player-config.json (se existir)
 * 2. Arquivo externo em /sdcard/smartsignage/player-config.json (se existir)
 * 3. Defaults embutidos (fallback)
 */
class PlayerConfigLoader(private val context: Context) {

    fun load(): PlayerConfig {
        // 1) interno (útil para debug/emulador; salva sem permissões)
        val internal = PlayerConfigStore.internalConfigFile(context)
        if (internal.exists()) {
            try {
                parseConfigFile(internal)?.let { return it }
            } catch (_: Exception) {
                // Pode existir cópia ADB com dono root — tenta SD em seguida.
            }
        }

        val external = PlayerConfigStore.externalConfigFile()
        if (external.exists()) {
            parseConfigFile(external)?.let { return it }
        }

        // 3) defaults de instalação (alinhar com install-pendrive/config/exemplo-player-config.json)
        return PlayerConfig(
            serverUrl = "http://217.216.91.135:8080",
            uin = "T1000",
            deviceId = "T1000-Exterminator",
            acceptImagesInPlaylist = true,
            allowPlaybackAudio = false,
            fallbackPropagandasPerVinheta = 3,
            batimentoCardiaco = 15,
            maxSecondsWithoutServerCheck = 60,
            storageMode = PlayerStorageMode.AUTO,
            storagePathOverride = null,
            kioskMode = KioskMode.STRONG,
            screenOrientation = ScreenOrientationMode.PORTRAIT
        )
    }

    private fun parseConfigFile(file: File): PlayerConfig? {
        return try {
            val text = file.readText(Charsets.UTF_8)
            val json = JSONObject(text)
            val serverUrl = json.optString("serverUrl", "").trim()
            val uin = normalizeActivationCode(json.optString("uin", ""))
            val deviceId = json.optString("deviceId", "").trim()
            if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) {
                null
            } else {
                val acceptImages = json.optBoolean("acceptImagesInPlaylist", true)
                val allowAudio = json.optBoolean("allowPlaybackAudio", false)
                val fallbackRatioRaw = json.optInt("fallbackPropagandasPerVinheta", 3)
                val fallbackRatio = fallbackRatioRaw.coerceAtLeast(1)
                val batimentoRaw = json.optInt("batimentoCardiaco", 15)
                val batimento = batimentoRaw.coerceAtLeast(10)
                val maxSecondsRaw = json.optInt("maxSecondsWithoutServerCheck", 60)
                val maxSeconds = maxSecondsRaw.coerceAtLeast(10)
                val storageMode = parseStorageMode(json.optString("storage", ""))
                val pathOverride = json.optString("storagePathOverride", "").trim().takeIf { it.isNotBlank() }
                val kioskMode = parseKioskMode(json.optString("kioskMode", ""))
                val displayRotation = if (json.has("displayRotation")) {
                    json.optInt("displayRotation", 0).coerceIn(0, 3)
                } else {
                    displayRotationFromMode(parseScreenOrientation(json.optString("screenOrientation", "")))
                }
                val screenOrientation = displayRotationToMode(displayRotation)
                PlayerConfig(
                    serverUrl = serverUrl,
                    uin = uin,
                    deviceId = deviceId,
                    acceptImagesInPlaylist = acceptImages,
                    allowPlaybackAudio = allowAudio,
                    fallbackPropagandasPerVinheta = fallbackRatio,
                    batimentoCardiaco = batimento,
                    maxSecondsWithoutServerCheck = maxSeconds,
                    storageMode = storageMode,
                    storagePathOverride = pathOverride,
                    kioskMode = kioskMode,
                    displayRotation = displayRotation,
                    screenOrientation = screenOrientation
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        fun parseKioskMode(raw: String?): KioskMode {
            if (raw.isNullOrBlank()) return KioskMode.STRONG
            return when (raw.trim().lowercase()) {
                "immersive", "fullscreen", "soft" -> KioskMode.IMMERSIVE
                "strong", "lock", "hard" -> KioskMode.STRONG
                else -> KioskMode.STRONG
            }
        }

        fun kioskModeToJsonValue(mode: KioskMode): String = when (mode) {
            KioskMode.IMMERSIVE -> "immersive"
            KioskMode.STRONG -> "strong"
        }

        fun parseScreenOrientation(raw: String?): ScreenOrientationMode {
            if (raw.isNullOrBlank()) return ScreenOrientationMode.PORTRAIT
            return when (raw.trim().lowercase()) {
                "landscape", "horizontal" -> ScreenOrientationMode.LANDSCAPE
                "reverse_portrait", "reverseportrait", "portrait_reverse" -> ScreenOrientationMode.REVERSE_PORTRAIT
                "reverse_landscape", "reverselandscape", "landscape_reverse" -> ScreenOrientationMode.REVERSE_LANDSCAPE
                "portrait", "vertical", "9x16" -> ScreenOrientationMode.PORTRAIT
                else -> ScreenOrientationMode.PORTRAIT
            }
        }

        fun displayRotationToUserRotation(displayRotation: Int): Int = when ((displayRotation % 4 + 4) % 4) {
            // Painel TV landscape nativo: portrait = user_rotation 1, landscape = 0, etc.
            0 -> 1
            1 -> 0
            2 -> 3
            3 -> 2
            else -> 1
        }

        fun displayRotationToMode(rotation: Int): ScreenOrientationMode = when ((rotation % 4 + 4) % 4) {
            1 -> ScreenOrientationMode.LANDSCAPE
            2 -> ScreenOrientationMode.REVERSE_PORTRAIT
            3 -> ScreenOrientationMode.REVERSE_LANDSCAPE
            else -> ScreenOrientationMode.PORTRAIT
        }

        fun displayRotationFromMode(mode: ScreenOrientationMode): Int = when (mode) {
            ScreenOrientationMode.PORTRAIT -> 0
            ScreenOrientationMode.LANDSCAPE -> 1
            ScreenOrientationMode.REVERSE_PORTRAIT -> 2
            ScreenOrientationMode.REVERSE_LANDSCAPE -> 3
        }

        fun displayRotationLabel(rotation: Int): String = when ((rotation % 4 + 4) % 4) {
            1 -> "90° — paisagem (landscape)"
            2 -> "180° — retrato invertido"
            3 -> "270° — paisagem invertida"
            else -> "0° — retrato (portrait)"
        }

        private fun resolveScreenOrientation(json: JSONObject): ScreenOrientationMode {
            if (json.has("displayRotation")) {
                return displayRotationToMode(json.optInt("displayRotation", 0))
            }
            return parseScreenOrientation(json.optString("screenOrientation", ""))
        }

        fun screenOrientationToJsonValue(mode: ScreenOrientationMode): String = when (mode) {
            ScreenOrientationMode.PORTRAIT -> "portrait"
            ScreenOrientationMode.LANDSCAPE -> "landscape"
            ScreenOrientationMode.REVERSE_PORTRAIT -> "reverse_portrait"
            ScreenOrientationMode.REVERSE_LANDSCAPE -> "reverse_landscape"
        }

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

        /** Mesma regra que `normalizeTotemUin` no backend e `activationCode.js` no player-web. */
        fun normalizeActivationCode(raw: String?): String {
            val normalized = raw
                .orEmpty()
                .trim()
                .uppercase()
                .replace('–', '-')
                .replace('—', '-')
                .replace(Regex("\\s+"), "")
            val compact = normalized.replace("-", "")
            return if (Regex("^TD[A-Z0-9]{8}$").matches(compact)) {
                "TD-${compact.substring(2, 6)}-${compact.substring(6, 10)}"
            } else {
                normalized
            }
        }
    }
}

