package br.com.smartchannel.smartsignagead.ui

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import br.com.smartchannel.smartsignagead.R
import br.com.smartchannel.smartsignagead.config.AppConfig
import br.com.smartchannel.smartsignagead.config.AppConfigLoader
import br.com.smartchannel.smartsignagead.util.PlaybackDiagnostics
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import org.json.JSONObject
import java.io.File

class DebugConfigActivity : AppCompatActivity() {
    private lateinit var editServerUrl: EditText
    private lateinit var editUin: EditText
    private lateinit var editDeviceId: EditText
    private lateinit var editRatio: EditText
    private lateinit var editInternalCacheLimitPercent: EditText
    private lateinit var switchAcceptImages: SwitchCompat
    private lateinit var textOffline: TextView
    private lateinit var btnRefreshDiagnostics: Button
    private lateinit var btnSaveStart: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_debug_config)

        editServerUrl = findViewById(R.id.editServerUrl)
        editUin = findViewById(R.id.editUin)
        editDeviceId = findViewById(R.id.editDeviceId)
        editRatio = findViewById(R.id.editRatio)
        editInternalCacheLimitPercent = findViewById(R.id.editInternalCacheLimitPercent)
        switchAcceptImages = findViewById(R.id.switchAcceptImages)
        textOffline = findViewById(R.id.textOfflineState)
        btnRefreshDiagnostics = findViewById(R.id.btnRefreshDiagnostics)
        btnSaveStart = findViewById(R.id.btnSaveStart)

        val cfg = AppConfigLoader(this).load()
        editServerUrl.setText(cfg.serverUrl)
        editUin.setText(cfg.uin)
        editDeviceId.setText(cfg.deviceId)
        editRatio.setText(cfg.fallbackPropagandasPerVinheta.toString())
        editInternalCacheLimitPercent.setText(cfg.internalCacheLimitPercent.toString())
        switchAcceptImages.isChecked = cfg.acceptImagesInPlaylist

        refreshDiagnosticsPanel()

        btnRefreshDiagnostics.setOnClickListener { refreshDiagnosticsPanel() }

        btnSaveStart.setOnClickListener {
            val config = readConfigOrNull() ?: return@setOnClickListener
            saveConfig(config)
            setResult(Activity.RESULT_OK)
            finish()
        }

        SmartSignageAdLogger.i("DEBUG_UI", "Ecra debug aberto (motivo: ${intent.getStringExtra("reason") ?: "-"})")
    }

    override fun onResume() {
        super.onResume()
        refreshDiagnosticsPanel()
    }

    private fun refreshDiagnosticsPanel() {
        val cfg = readConfigFromFieldsOrLoader()
        val report = PlaybackDiagnostics.buildReport(this, cfg)
        textOffline.text = report
    }

    /** Usa campos se URL/uin/device preenchidos; senao ficheiro (para limite % coerente ao editar). */
    private fun readConfigFromFieldsOrLoader(): AppConfig {
        val serverUrl = editServerUrl.text?.toString()?.trim().orEmpty()
        val uin = editUin.text?.toString()?.trim().orEmpty()
        val deviceId = editDeviceId.text?.toString()?.trim().orEmpty()
        val base = AppConfigLoader(this).load()
        if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) return base
        val ratio = editRatio.text?.toString()?.trim()?.toIntOrNull()?.coerceAtLeast(1) ?: base.fallbackPropagandasPerVinheta
        val cacheLimit = editInternalCacheLimitPercent.text?.toString()?.trim()?.toIntOrNull()?.coerceIn(5, 95)
            ?: base.internalCacheLimitPercent
        return base.copy(
            serverUrl = serverUrl,
            uin = uin,
            deviceId = deviceId,
            acceptImagesInPlaylist = switchAcceptImages.isChecked,
            fallbackPropagandasPerVinheta = ratio,
            internalCacheLimitPercent = cacheLimit
        )
    }

    private fun readConfigOrNull(): AppConfig? {
        val serverUrl = editServerUrl.text?.toString()?.trim().orEmpty()
        val uin = editUin.text?.toString()?.trim().orEmpty()
        val deviceId = editDeviceId.text?.toString()?.trim().orEmpty()
        val ratio = editRatio.text?.toString()?.trim()?.toIntOrNull()?.coerceAtLeast(1) ?: 3
        val cacheLimit = editInternalCacheLimitPercent.text?.toString()?.trim()?.toIntOrNull()?.coerceIn(5, 95) ?: 30
        if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) return null
        val old = AppConfigLoader(this).load()
        return old.copy(
            serverUrl = serverUrl,
            uin = uin,
            deviceId = deviceId,
            acceptImagesInPlaylist = switchAcceptImages.isChecked,
            fallbackPropagandasPerVinheta = ratio,
            internalCacheLimitPercent = cacheLimit
        )
    }

    private fun saveConfig(config: AppConfig) {
        val json = JSONObject().apply {
            put("serverUrl", config.serverUrl)
            put("uin", config.uin)
            put("deviceId", config.deviceId)
            put("mode", config.mode)
            put("syncIntervalSeconds", config.syncIntervalSeconds)
            put("acceptImagesInPlaylist", config.acceptImagesInPlaylist)
            put("fallbackPropagandasPerVinheta", config.fallbackPropagandasPerVinheta)
            put("internalCacheLimitPercent", config.internalCacheLimitPercent)
            put("imageDurationSeconds", config.imageDurationSeconds)
            put("fallbackPropagandas", config.fallbackPropagandas)
            put("fallbackVinhetas", config.fallbackVinhetas)
        }
        val text = json.toString()
        File(filesDir, "app-config.json").writeText(text, Charsets.UTF_8)
        try {
            val ext = File("/sdcard/smartsignage-ad/app-config.json")
            ext.parentFile?.mkdirs()
            ext.writeText(text, Charsets.UTF_8)
        } catch (_: Exception) {
        }
        try {
            getExternalFilesDir(null)?.let { base ->
                val scoped = File(File(base, "smartsignage-ad"), "app-config.json")
                scoped.parentFile?.mkdirs()
                scoped.writeText(text, Charsets.UTF_8)
            }
        } catch (_: Exception) {
        }
        SmartSignageAdLogger.i("DEBUG_UI", "Config salva (interno + tentativas externas)")
    }
}
