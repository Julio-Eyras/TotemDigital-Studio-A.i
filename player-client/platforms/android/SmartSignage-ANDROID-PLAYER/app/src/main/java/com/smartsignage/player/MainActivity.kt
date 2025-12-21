package com.smartsignage.player

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Obter referências
        playerContainer = findViewById(R.id.player_container)
        statusText = findViewById(R.id.status_text)
        fxWebView = findViewById(R.id.fx_webview)

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

        // Inicializar player
        viewModel.initialize()
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

