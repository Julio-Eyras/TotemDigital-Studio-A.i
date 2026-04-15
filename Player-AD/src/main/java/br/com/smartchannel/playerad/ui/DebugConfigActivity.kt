package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.lifecycle.lifecycleScope
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.config.PlayerStorageMode
import br.com.smartchannel.playerad.util.LocalNetworkAddresses
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.AppDirs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DebugConfigActivity : AppCompatActivity() {

    private lateinit var editServerUrl: EditText
    private lateinit var editUin: EditText
    private lateinit var editDeviceId: EditText
    private lateinit var switchAcceptImages: SwitchCompat
    private lateinit var editMaxSecondsWithoutServerCheck: EditText
    private lateinit var spinnerStorage: Spinner
    private lateinit var editStoragePath: EditText

    private lateinit var btnTestHeartbeat: Button
    private lateinit var btnTestDispatch: Button
    private lateinit var btnApplyAndStart: Button
    private lateinit var btnStartWithoutSave: Button

    private lateinit var textReason: TextView
    private lateinit var textStatus: TextView
    private lateinit var textIpEthernet: TextView
    private lateinit var textIpWifi: TextView
    private lateinit var labelIpOther: TextView
    private lateinit var textIpOther: TextView

    private lateinit var btnRefreshOperationalLog: Button
    private lateinit var btnClearOperationalLog: Button
    private lateinit var textOperationalLog: TextView
    private lateinit var textOfflineState: TextView

    private var lastHeartbeatToken: String? = null
    private var lastDispatchPlan: JSONObject? = null

    private var heartbeatOk: Boolean = false
    private var dispatchOk: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_debug_config)

        editServerUrl = findViewById(R.id.editServerUrl)
        editUin = findViewById(R.id.editUin)
        editDeviceId = findViewById(R.id.editDeviceId)
        switchAcceptImages = findViewById(R.id.switchAcceptImages)
        editMaxSecondsWithoutServerCheck = findViewById(R.id.editMaxSecondsWithoutServerCheck)
        spinnerStorage = findViewById(R.id.spinnerStorage)
        editStoragePath = findViewById(R.id.editStoragePath)

        btnTestHeartbeat = findViewById(R.id.btnTestHeartbeat)
        btnTestDispatch = findViewById(R.id.btnTestDispatch)
        btnApplyAndStart = findViewById(R.id.btnApplyAndStart)
        btnStartWithoutSave = findViewById(R.id.btnStartWithoutSave)

        textReason = findViewById(R.id.textReason)
        textStatus = findViewById(R.id.textStatus)
        textIpEthernet = findViewById(R.id.textIpEthernet)
        textIpWifi = findViewById(R.id.textIpWifi)
        labelIpOther = findViewById(R.id.labelIpOther)
        textIpOther = findViewById(R.id.textIpOther)

        btnRefreshOperationalLog = findViewById(R.id.btnRefreshOperationalLog)
        btnClearOperationalLog = findViewById(R.id.btnClearOperationalLog)
        textOperationalLog = findViewById(R.id.textOperationalLog)
        textOfflineState = findViewById(R.id.textOfflineState)

        bindLocalIps()

        val reason = intent.getStringExtra(EXTRA_REASON) ?: "manual"
        textReason.text = "Modo desenvolvimento aberto: $reason"
        PlayerAdLogger.i("DEBUG_UI", "Ecrã de configuração/debug aberto: $reason")

        val current = PlayerConfigLoader(this).load()
        editServerUrl.setText(current.serverUrl)
        editUin.setText(current.uin)
        editDeviceId.setText(current.deviceId)
        switchAcceptImages.isChecked = current.acceptImagesInPlaylist
        editMaxSecondsWithoutServerCheck.setText(current.maxSecondsWithoutServerCheck.toString())

        val storageModes = resources.getStringArray(R.array.player_storage_modes)
        val spinAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, storageModes)
        spinAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerStorage.adapter = spinAdapter
        val modeKey = PlayerConfigLoader.storageModeToJsonValue(current.storageMode)
        val sel = storageModes.indexOf(modeKey).let { if (it >= 0) it else 0 }
        spinnerStorage.setSelection(sel)
        editStoragePath.setText(current.storagePathOverride.orEmpty())

        setHeartbeatAndDispatchState(heartbeatOk = false, dispatchOk = false)

        btnTestHeartbeat.setOnClickListener {
            runTestHeartbeat()
        }
        btnTestDispatch.setOnClickListener {
            runTestDispatchPlan()
        }

        btnApplyAndStart.setOnClickListener {
            val cfg = readConfigOrNull()
            if (cfg == null) {
                setStatus("Configuração inválida. Preencha serverUrl, uin e deviceId. Se storage=path_override, preencha o caminho absoluto.")
                return@setOnClickListener
            }

            // A ideia aqui é "debug antes de alterar": só salvamos quando o usuário confirma.
            saveConfigInternal(cfg)
            setResult(Activity.RESULT_OK)
            finish()
        }

        btnStartWithoutSave.setOnClickListener {
            setResult(Activity.RESULT_OK)
            finish()
        }

        btnRefreshOperationalLog.setOnClickListener { refreshOperationalLog() }
        btnClearOperationalLog.setOnClickListener { confirmClearOperationalLog() }

        refreshOfflineState()
        refreshOperationalLog()
    }

    override fun onResume() {
        super.onResume()
        refreshOfflineState()
        refreshOperationalLog()
    }

    private fun refreshOperationalLog() {
        lifecycleScope.launch {
            val text = withContext(Dispatchers.IO) {
                PlayerAdLogger.readTail(maxLines = 400)
            }
            textOperationalLog.text = text
        }
    }

    private fun refreshOfflineState() {
        lifecycleScope.launch {
            val text = withContext(Dispatchers.IO) { buildOfflineStateText() }
            textOfflineState.text = text
        }
    }

    private fun buildOfflineStateText(): String {
        val root = AppDirs.root(this)
        val propDir = File(root, "propagandas")
        val vinDir = File(root, "vinhetas")
        val dispatchFile = File(root, "last-dispatch-plan.json")
        val sourceFile = File(root, "current-plan-source.txt")

        val propagandasCount = listMediaCount(propDir)
        val vinhetasCount = listMediaCount(vinDir)

        val source = try {
            if (sourceFile.exists()) sourceFile.readText(Charsets.UTF_8).trim().ifBlank { "-" } else "-"
        } catch (_: Exception) { "-" }

        val dispatchSummary = if (!dispatchFile.exists()) {
            "ultimo_dispatch: (nao encontrado)"
        } else {
            try {
                val raw = dispatchFile.readText(Charsets.UTF_8)
                val json = JSONObject(raw)
                val planObj = json.optJSONObject("plan")
                val playlistName = planObj?.optString("playlistName", "(sem nome)") ?: "(sem nome)"
                val playlistId = planObj?.optLong("playlistId", 0L) ?: 0L
                val items = planObj?.optJSONArray("mediaItems")?.length() ?: 0
                val modified = formatEpoch(dispatchFile.lastModified())
                "ultimo_dispatch: $playlistName (id=$playlistId, itens=$items, mod=$modified)"
            } catch (_: Exception) {
                "ultimo_dispatch: (invalido/corrompido)"
            }
        }

        return buildString {
            append("fonte_plano_atual: $source")
            append("\n$dispatchSummary")
            append("\npropagandas: $propagandasCount arquivo(s)")
            append("\nvinhetas: $vinhetasCount arquivo(s)")
            append("\nroot: ${root.absolutePath}")
        }
    }

    private fun listMediaCount(dir: File): Int {
        if (!dir.exists() || !dir.isDirectory) return 0
        return dir.listFiles { f ->
            f.isFile && (
                f.name.endsWith(".mp4", true) ||
                    f.name.endsWith(".webm", true) ||
                    f.name.endsWith(".mov", true) ||
                    f.name.endsWith(".jpg", true) ||
                    f.name.endsWith(".jpeg", true) ||
                    f.name.endsWith(".png", true)
                )
        }?.size ?: 0
    }

    private fun formatEpoch(ms: Long): String {
        if (ms <= 0L) return "-"
        return try {
            SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(ms))
        } catch (_: Exception) {
            ms.toString()
        }
    }

    private fun confirmClearOperationalLog() {
        AlertDialog.Builder(this)
            .setTitle("Limpar registo")
            .setMessage("Apagar todo o ficheiro operacional? Esta ação não pode ser anulada.")
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton("Limpar") { _, _ ->
                lifecycleScope.launch {
                    val ok = withContext(Dispatchers.IO) { PlayerAdLogger.clearFile() }
                    refreshOfflineState()
                    refreshOperationalLog()
                    appendStatus(if (ok) "Registo operacional limpo." else "Não foi possível limpar o registo.")
                }
            }
            .show()
    }

    private fun bindLocalIps() {
        val summary = LocalNetworkAddresses.collect()
        val (eth, wifi) = LocalNetworkAddresses.formatForUi(summary)
        textIpEthernet.text = eth
        textIpWifi.text = wifi
        if (summary.otherLines.isNotEmpty()) {
            labelIpOther.visibility = android.view.View.VISIBLE
            textIpOther.visibility = android.view.View.VISIBLE
            textIpOther.text = summary.otherLines.joinToString("\n")
        } else {
            labelIpOther.visibility = android.view.View.GONE
            textIpOther.visibility = android.view.View.GONE
        }
    }

    private fun readConfigOrNull(): PlayerConfig? {
        val serverUrl = editServerUrl.text?.toString()?.trim().orEmpty()
        val uin = editUin.text?.toString()?.trim().orEmpty()
        val deviceId = editDeviceId.text?.toString()?.trim().orEmpty()
        if (serverUrl.isBlank() || uin.isBlank() || deviceId.isBlank()) return null
        val loaded = PlayerConfigLoader(this).load()
        val modeRaw = spinnerStorage.selectedItem as? String
        val storageMode = PlayerConfigLoader.parseStorageMode(modeRaw)
        val pathOverride = editStoragePath.text?.toString()?.trim().orEmpty()
        if (storageMode == PlayerStorageMode.PATH_OVERRIDE && pathOverride.isBlank()) return null
        val maxSecondsRaw = editMaxSecondsWithoutServerCheck.text?.toString()?.trim().orEmpty()
        val maxSeconds = maxSecondsRaw.toIntOrNull()?.coerceAtLeast(10)
            ?: loaded.maxSecondsWithoutServerCheck.coerceAtLeast(10)
        return PlayerConfig(
            serverUrl = serverUrl,
            uin = uin,
            deviceId = deviceId,
            acceptImagesInPlaylist = switchAcceptImages.isChecked,
            fallbackPropagandasPerVinheta = loaded.fallbackPropagandasPerVinheta,
            maxSecondsWithoutServerCheck = maxSeconds,
            storageMode = storageMode,
            storagePathOverride = pathOverride.takeIf { it.isNotBlank() }
        )
    }

    private fun setHeartbeatAndDispatchState(heartbeatOk: Boolean, dispatchOk: Boolean) {
        this.heartbeatOk = heartbeatOk
        this.dispatchOk = dispatchOk

        // Liberar "Aplicar e iniciar" apenas quando pelo menos o heartbeat funciona.
        // (A busca do dispatch é opcional para não travar desenvolvimento offline.)
        btnApplyAndStart.isEnabled = this.heartbeatOk
        btnApplyAndStart.alpha = if (this.heartbeatOk) 1f else 0.5f
    }

    private fun setStatus(msg: String) {
        textStatus.text = msg
    }

    private fun appendStatus(msg: String) {
        val prev = textStatus.text?.toString().orEmpty()
        textStatus.text = if (prev.isBlank()) msg else prev + "\n" + msg
    }

    private fun runTestHeartbeat() {
        val cfg = readConfigOrNull()
        if (cfg == null) {
            setStatus("Configuração inválida. Preencha serverUrl, uin e deviceId.")
            return
        }

        setStatus("Testando heartbeat...")
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                try {
                    val apiClient = DispatcherApiClient(cfg.serverUrl, cfg.uin, cfg.deviceId)
                    val token = apiClient.heartbeat()
                    Result.success(token)
                } catch (e: Exception) {
                    Result.failure<String>(e)
                }
            }

            result.onSuccess { token ->
                lastHeartbeatToken = token
                heartbeatOk = true
                appendStatus("✔ Heartbeat OK")
                appendStatus("token (parcial): ${token.take(10)}...")
                PlayerAdLogger.i("DEBUG_UI", "Teste heartbeat OK (ecrã debug)")
                setHeartbeatAndDispatchState(heartbeatOk = true, dispatchOk = dispatchOk)
                refreshOfflineState()
                refreshOperationalLog()
            }.onFailure { err ->
                heartbeatOk = false
                dispatchOk = false
                lastHeartbeatToken = null
                lastDispatchPlan = null
                setStatus("✖ Heartbeat falhou: ${err.message ?: err.toString()}")
                PlayerAdLogger.e("DEBUG_UI", "Teste heartbeat falhou (ecrã debug)", err)
                setHeartbeatAndDispatchState(heartbeatOk = false, dispatchOk = false)
                suggestBasedOnError(err)
                refreshOfflineState()
                refreshOperationalLog()
            }
        }
    }

    private fun runTestDispatchPlan() {
        val cfg = readConfigOrNull()
        if (cfg == null) {
            setStatus("Configuração inválida. Preencha serverUrl, uin e deviceId.")
            return
        }

        setStatus("Buscando DispatchPlan...")
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                try {
                    val token = lastHeartbeatToken
                        ?: DispatcherApiClient(cfg.serverUrl, cfg.uin, cfg.deviceId).heartbeat()

                    lastHeartbeatToken = token

                    val apiClient = DispatcherApiClient(cfg.serverUrl, cfg.uin, cfg.deviceId)
                    val json = apiClient.getDispatchPlan(token)
                    Result.success(json)
                } catch (e: Exception) {
                    Result.failure<JSONObject>(e)
                }
            }

            result.onSuccess { json ->
                lastDispatchPlan = json
                dispatchOk = true
                heartbeatOk = true

                val planSummary = summarizeDispatch(json)
                setStatus("✔ DispatchPlan OK\n\n$planSummary")
                val planObj = json.optJSONObject("plan")
                val name = planObj?.optString("playlistName", "") ?: ""
                val pid = planObj?.optLong("playlistId", 0L) ?: 0L
                val items = planObj?.optJSONArray("mediaItems")?.length() ?: 0
                val campaignIdForLog = planObj?.let { p ->
                    if (p.has("campaignId")) p.optLong("campaignId", 0L) else null
                }
                PlayerAdLogger.logDispatchPlanReceived(pid, name.ifBlank { "(sem nome)" }, items, campaignIdForLog)
                PlayerAdLogger.i("DEBUG_UI", "Teste DispatchPlan OK (ecrã debug)")
                setHeartbeatAndDispatchState(heartbeatOk = heartbeatOk, dispatchOk = dispatchOk)
                refreshOfflineState()
                refreshOperationalLog()
            }.onFailure { err ->
                dispatchOk = false
                lastDispatchPlan = null
                setStatus("✖ DispatchPlan falhou: ${err.message ?: err.toString()}")
                PlayerAdLogger.e("DEBUG_UI", "Teste DispatchPlan falhou (ecrã debug)", err)
                suggestBasedOnError(err)
                setHeartbeatAndDispatchState(heartbeatOk = heartbeatOk, dispatchOk = false)
                refreshOfflineState()
                refreshOperationalLog()
            }
        }
    }

    private fun summarizeDispatch(json: JSONObject): String {
        val planObj = json.optJSONObject("plan")
        val playlistName = planObj?.optString("playlistName", "DispatchPlan").orEmpty()
        val playlistId = planObj?.optLong("playlistId", 0L) ?: 0L
        val campaignId = planObj?.optLong("campaignId", 0L) ?: 0L
        val itemsArray: JSONArray = planObj?.optJSONArray("mediaItems") ?: JSONArray()

        var videos = 0
        var images = 0
        for (i in 0 until itemsArray.length()) {
            val obj = itemsArray.optJSONObject(i) ?: continue
            val mediaType = obj.optString("mediaType", "")
            val isImage = mediaType.lowercase().contains("image")
            if (isImage) images++ else videos++
        }

        return buildString {
            append("- playlist: $playlistName (id=$playlistId)")
            append("\n- campaignId: $campaignId")
            append("\n- itens: ${itemsArray.length()} (vídeos=$videos, imagens=$images)")
        }
    }

    private fun suggestBasedOnError(err: Throwable) {
        val msg = err.message?.lowercase().orEmpty()
        when {
            msg.contains("unknownhost") || msg.contains("host") -> {
                appendStatus("\nSugestão: verifique `serverUrl` (IP/DNS) e conectividade de rede do dispositivo.")
            }
            msg.contains("cleartxt") || msg.contains("cleartext") || msg.contains("http") -> {
                appendStatus("\nSugestão: teste `https` ou confirme `usesCleartextTraffic=true` no manifesto.")
            }
            msg.contains("timeout") -> {
                appendStatus("\nSugestão: aumenta timeout no backend/rede (firewall) ou confirme que o IP/porta está acessível.")
            }
        }
    }

    private fun saveConfigInternal(cfg: PlayerConfig) {
        val json = JSONObject().apply {
            put("serverUrl", cfg.serverUrl)
            put("uin", cfg.uin)
            put("deviceId", cfg.deviceId)
            put("acceptImagesInPlaylist", cfg.acceptImagesInPlaylist)
            put("fallbackPropagandasPerVinheta", cfg.fallbackPropagandasPerVinheta)
            put("maxSecondsWithoutServerCheck", cfg.maxSecondsWithoutServerCheck)
            put("storage", PlayerConfigLoader.storageModeToJsonValue(cfg.storageMode))
            if (cfg.storageMode == PlayerStorageMode.PATH_OVERRIDE && !cfg.storagePathOverride.isNullOrBlank()) {
                put("storagePathOverride", cfg.storagePathOverride)
            }
        }
        val internal = File(filesDir, "player-config.json")
        internal.writeText(json.toString(), Charsets.UTF_8)
        Log.i("Player-AD", "Config salva internamente em filesDir/player-config.json")

        // Opcional: tentar também atualizar a cópia externa, caso exista/permita.
        try {
            val external = File("/sdcard/smartsignage/player-config.json")
            external.parentFile?.mkdirs()
            external.writeText(json.toString(), Charsets.UTF_8)
        } catch (_: Exception) {
            // Sem permissões: silencioso (loader já prioriza interno).
        }
    }

    companion object {
        const val EXTRA_REASON = "reason"
    }
}

