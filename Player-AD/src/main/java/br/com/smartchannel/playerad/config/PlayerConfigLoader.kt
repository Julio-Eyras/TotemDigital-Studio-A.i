package br.com.smartchannel.playerad.config

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Carrega configuração do Player-AD (serverUrl, uin, deviceId).
 *
 * Ordem de busca:
 * 1. Arquivo externo em /sdcard/smartsignage/player-config.json (se existir)
 * 2. Arquivo interno em filesDir/player-config.json (se existir)
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
            deviceId = "android-tv-tot001"
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
                PlayerConfig(serverUrl, uin, deviceId)
            }
        } catch (_: Exception) {
            null
        }
    }
}

