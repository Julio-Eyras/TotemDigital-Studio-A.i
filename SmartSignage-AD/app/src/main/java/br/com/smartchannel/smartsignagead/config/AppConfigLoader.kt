package br.com.smartchannel.smartsignagead.config

import android.content.Context
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import org.json.JSONObject
import java.io.File

/**
 * Ordem de carregamento (cada ficheiro faz merge por cima do anterior):
 * 1) filesDir/app-config.json (ex.: guardado pela tela de debug)
 * 2) /sdcard/smartsignage-ad/app-config.json (pode falhar em targetSdk 34+ sem acesso amplo ao armazenamento)
 * 3) getExternalFilesDir/smartsignage-ad/app-config.json (recomendado para ADB: sem permissão extra)
 * 4) defaults se o JSON resultante for inválido ou vazio
 */
class AppConfigLoader(private val context: Context) {

    fun load(): AppConfig {
        val merged = JSONObject()
        mergeConfigInto(merged, File(context.filesDir, "app-config.json"), silent = false)
        mergeConfigInto(merged, File("/sdcard/smartsignage-ad/app-config.json"), silent = false)
        context.getExternalFilesDir(null)?.let { base ->
            mergeConfigInto(merged, File(File(base, "smartsignage-ad"), "app-config.json"), silent = true)
        }
        if (merged.length() == 0) return defaults()
        return parseJson(merged) ?: defaults()
    }

    private fun mergeConfigInto(merged: JSONObject, file: File, silent: Boolean) {
        if (!file.isFile) return
        val obj = readJsonObject(file)
        if (obj == null) {
            if (!silent) {
                SmartSignageAdLogger.w("CONFIG", "Ficheiro existe mas nao foi legivel: ${file.absolutePath}")
            }
            return
        }
        mergeInto(merged, obj)
    }

    fun defaults(): AppConfig = AppConfig(
        serverUrl = "http://192.168.1.110",
        uin = "tot001",
        deviceId = "ANDROID-AD-TOT001",
        mode = "hybrid",
        syncIntervalSeconds = 30,
        acceptImagesInPlaylist = true,
        fallbackPropagandasPerVinheta = 2,
        internalCacheLimitPercent = 30,
        imageDurationSeconds = 20,
        fallbackPropagandas = emptyList(),
        fallbackVinhetas = emptyList()
    )

    private fun readJsonObject(file: File): JSONObject? = try {
        JSONObject(file.readText(Charsets.UTF_8))
    } catch (_: Exception) {
        null
    }

    private fun mergeInto(target: JSONObject, source: JSONObject) {
        val keys = source.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            target.put(k, source.get(k))
        }
    }

    private fun parseJson(json: JSONObject): AppConfig? {
        return try {
            val serverUrl = json.optString("serverUrl", "").trim()
            val uin = json.optString("uin", "").trim()
            val deviceId = normalizeDeviceId(json.optString("deviceId", ""))
            if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) return null
            val mode = json.optString("mode", "hybrid").ifBlank { "hybrid" }
            val sync = json.optInt("syncIntervalSeconds", 30).coerceAtLeast(5)
            val acceptImages = json.optBoolean("acceptImagesInPlaylist", true)
            val ratio = json.optInt("fallbackPropagandasPerVinheta", 2).coerceAtLeast(1)
            val internalCacheLimitPercent = json.optInt("internalCacheLimitPercent", 30).coerceIn(5, 95)
            val imageDuration = json.optInt("imageDurationSeconds", 20).coerceAtLeast(1)
            val ads = json.optJSONArray("fallbackPropagandas")
            val vins = json.optJSONArray("fallbackVinhetas")
            AppConfig(
                serverUrl = serverUrl,
                uin = uin,
                deviceId = deviceId,
                mode = mode,
                syncIntervalSeconds = sync,
                acceptImagesInPlaylist = acceptImages,
                fallbackPropagandasPerVinheta = ratio,
                internalCacheLimitPercent = internalCacheLimitPercent,
                imageDurationSeconds = imageDuration,
                fallbackPropagandas = ads.toStringList(),
                fallbackVinhetas = vins.toStringList()
            )
        } catch (_: Exception) {
            null
        }
    }

    private fun org.json.JSONArray?.toStringList(): List<String> {
        if (this == null) return emptyList()
        val out = mutableListOf<String>()
        for (i in 0 until length()) {
            val value = optString(i, "").trim()
            if (value.isNotBlank()) out += value
        }
        return out
    }

    companion object {
        fun normalizeDeviceId(raw: String?): String =
            raw.orEmpty().trim().uppercase()
    }
}
