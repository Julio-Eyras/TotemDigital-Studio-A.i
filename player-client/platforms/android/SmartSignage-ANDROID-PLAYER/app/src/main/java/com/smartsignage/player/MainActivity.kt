package com.smartsignage.player

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import com.smartsignage.player.storage.StorageHelper
import androidx.lifecycle.ViewModelProvider
import com.smartsignage.player.models.PlayerState
import com.smartsignage.player.smartdisplayfx.SmartDisplayFxConfig
import com.smartsignage.player.smartdisplayfx.SmartDisplayFxManager
import com.smartsignage.player.viewmodels.PlayerViewModel

/**
 * MainActivity - Smart Signage Player Android TV
 * Activity principal do player
 */
class MainActivity : FragmentActivity() {

    private lateinit var viewModel: PlayerViewModel
    private lateinit var playerContainer: android.widget.FrameLayout
    private lateinit var statusText: TextView
    private lateinit var fxWebView: WebView
    private var smartDisplayFxManager: SmartDisplayFxManager? = null
    private var debugPanel: LinearLayout? = null
    private var debugStorageText: TextView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Obter referências
        playerContainer = findViewById(R.id.player_container)
        statusText = findViewById(R.id.status_text)
        fxWebView = findViewById(R.id.fx_webview)
        debugPanel = findViewById(R.id.debug_panel)
        debugStorageText = findViewById(R.id.debug_storage_text)

        // Inicializar ViewModel
        viewModel = ViewModelProvider(this)[PlayerViewModel::class.java]

        // Configurar container do media player
        viewModel.setPlayerContainer(playerContainer)

        // Inicializar SmartDisplayFX
        initializeSmartDisplayFX()

        // Observar estado do player
        viewModel.playerState.observe(this) { state ->
            when (state) {
                is PlayerState.Loading -> {
                    statusText.text = "Carregando..."
                    statusText.visibility = View.VISIBLE
                }
                is PlayerState.Playing -> {
                    statusText.visibility = View.GONE
                }
                is PlayerState.Error -> {
                    statusText.text = state.message
                    statusText.visibility = View.VISIBLE
                }
                is PlayerState.Idle -> {
                    statusText.text = "Aguardando conteúdo..."
                    statusText.visibility = View.VISIBLE
                }
            }
        }

        // Observar mensagens de erro
        viewModel.errorMessage.observe(this) { message ->
            if (message != null) {
                statusText.text = message
                statusText.visibility = View.VISIBLE
            }
        }

        // Debug: toggle painel e botão Atualizar info storage
        findViewById<Button>(R.id.btn_debug).setOnClickListener {
            val panel = debugPanel
            if (panel != null) {
                panel.visibility = if (panel.visibility == View.VISIBLE) View.GONE else View.VISIBLE
                if (panel.visibility == View.VISIBLE) viewModel.refreshDebugStorageInfo()
            }
        }
        findViewById<Button>(R.id.btn_debug_refresh_storage).setOnClickListener {
            viewModel.refreshDebugStorageInfo()
        }
        viewModel.debugStorageInfo.observe(this) { info ->
            debugStorageText?.text = formatDebugStorageInfo(info)
        }

        // Inicializar player
        viewModel.initialize()
    }

    private fun formatDebugStorageInfo(info: StorageHelper.DebugStorageInfo?): String {
        if (info == null) return "Storage: a carregar..."
        val sb = StringBuilder()
        sb.append("Ordem de resolução: ${info.resolutionOrder}\n\n")
        for (e in info.entries) {
            sb.append("${e.label}\n")
            sb.append("  Path: ${e.path}\n")
            sb.append("  Espaço livre: ${e.freeSpaceBytes / (1024*1024)} MB\n")
            sb.append("  Ficheiros em propagandas: ${e.fileCount}\n")
            if (e.fileNames.isNotEmpty()) {
                sb.append("  Ficheiros: ${e.fileNames.take(15).joinToString(", ")}${if (e.fileNames.size > 15) "..." else ""}\n")
            }
            sb.append("\n")
        }
        return sb.toString()
    }

    /**
     * Inicializa SmartDisplayFX
     */
    private fun initializeSmartDisplayFX() {
        try {
            // Obter configuração (pode vir de SharedPreferences, config file, etc.)
            val config = SmartDisplayFxConfig(
                siteId = "site-01", // TODO: obter da configuração
                totemId = "totem-${System.currentTimeMillis()}", // TODO: obter da configuração
                mqttUrl = "ws://localhost:9001", // TODO: obter da configuração
                mqttPrefix = "smartdisplay",
                backendBaseUrl = "http://localhost:3000/api" // TODO: obter da configuração
            )

            smartDisplayFxManager = SmartDisplayFxManager(this, fxWebView, config)
            
            // Conectar MQTT (opcional - WebView também pode usar MQTT via JavaScript)
            // smartDisplayFxManager?.connectMqtt()
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Failed to initialize SmartDisplayFX", e)
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.resume()
    }

    override fun onPause() {
        super.onPause()
        viewModel.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        smartDisplayFxManager?.disconnect()
        viewModel.cleanup()
    }
}

