package br.com.smartchannel.playerad.config

import android.content.Context
import android.util.Log
import br.com.smartchannel.playerad.util.PlayerAdLogger
import org.json.JSONObject
import java.io.File
import java.io.IOException

/**
 * Persistência de [player-config.json] (interno + SD).
 * Gravação tolerante a falhas: não deve derrubar a app se filesDir estiver com dono errado (ex.: push ADB como root).
 */
object PlayerConfigStore {

    const val FILE_NAME = "player-config.json"
    const val EXTERNAL_PATH = "/sdcard/smartsignage/player-config.json"

    data class SaveResult(
        val internalOk: Boolean,
        val externalOk: Boolean
    ) {
        val anyOk: Boolean get() = internalOk || externalOk
    }

    fun toJson(cfg: PlayerConfig): String = JSONObject().apply {
        put("serverUrl", cfg.serverUrl)
        put("uin", cfg.uin)
        put("deviceId", PlayerConfigLoader.normalizeDeviceId(cfg.deviceId))
        put("acceptImagesInPlaylist", cfg.acceptImagesInPlaylist)
        put("allowPlaybackAudio", cfg.allowPlaybackAudio)
        put(
            "mediaTransitionEnabled",
            PlayerConfigLoader.coerceMediaTransitionEnabled(cfg.mediaTransitionEnabled),
        )
        put("fallbackPropagandasPerVinheta", cfg.fallbackPropagandasPerVinheta)
        put("batimentoCardiaco", cfg.batimentoCardiaco)
        put("maxSecondsWithoutServerCheck", cfg.maxSecondsWithoutServerCheck)
        put("pollAdaptive", cfg.pollAdaptive.toJson())
        put("storage", PlayerConfigLoader.storageModeToJsonValue(cfg.storageMode))
        if (cfg.storageMode == PlayerStorageMode.PATH_OVERRIDE && !cfg.storagePathOverride.isNullOrBlank()) {
            put("storagePathOverride", cfg.storagePathOverride)
        }
        put("maxCacheSizeMb", PlayerConfigLoader.coerceMaxCacheSizeMb(cfg.maxCacheSizeMb))
        cfg.maxCachePercentOfVolume?.let { put("maxCachePercentOfVolume", it.coerceIn(1, 90)) }
        put("kioskMode", PlayerConfigLoader.kioskModeToJsonValue(cfg.kioskMode))
        put("displayRotation", cfg.displayRotation.coerceIn(0, 3))
        put("screenOrientation", PlayerConfigLoader.screenOrientationToJsonValue(cfg.screenOrientation))
    }.toString()

    @Throws(IOException::class)
    fun save(context: Context, cfg: PlayerConfig): SaveResult {
        val text = toJson(cfg)
        var internalOk = false
        var externalOk = false

        try {
            val internal = File(context.filesDir, FILE_NAME)
            internal.writeText(text, Charsets.UTF_8)
            internalOk = true
            Log.i("Player-AD", "Config salva internamente em filesDir/$FILE_NAME")
        } catch (e: Exception) {
            PlayerAdLogger.w("CONFIG", "Falha ao gravar config interna: ${e.message}")
        }

        try {
            val external = File(EXTERNAL_PATH)
            external.parentFile?.mkdirs()
            external.writeText(text, Charsets.UTF_8)
            externalOk = true
            Log.i("Player-AD", "Config salva em $EXTERNAL_PATH")
        } catch (e: Exception) {
            PlayerAdLogger.w("CONFIG", "Falha ao gravar config SD: ${e.message}")
        }

        if (!internalOk && !externalOk) {
            throw IOException("Não foi possível gravar player-config.json (interno nem SD)")
        }
        return SaveResult(internalOk = internalOk, externalOk = externalOk)
    }

    fun internalConfigFile(context: Context): File =
        File(context.filesDir, FILE_NAME)

    fun externalConfigFile(): File =
        File(EXTERNAL_PATH)
}
