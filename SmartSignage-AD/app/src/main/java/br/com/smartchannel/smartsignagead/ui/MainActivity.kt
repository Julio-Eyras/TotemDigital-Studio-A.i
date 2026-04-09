package br.com.smartchannel.smartsignagead.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import br.com.smartchannel.smartsignagead.R
import br.com.smartchannel.smartsignagead.api.DispatcherApiClient
import br.com.smartchannel.smartsignagead.config.AppConfigLoader
import br.com.smartchannel.smartsignagead.playback.PlayerController
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var textBootstrap: TextView
    private lateinit var scrollPlaybackStatus: ScrollView
    private lateinit var textPlaybackStatus: TextView
    private var playbackJob: Job? = null
    private var devTapCount: Int = 0
    private var lastTapMs: Long = 0L
    private var devOpen = false
    private var cachedConfig: br.com.smartchannel.smartsignagead.config.AppConfig? = null

    private val debugLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        devOpen = false
        startPlayer()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.playerView)
        imageView = findViewById(R.id.imageView)
        textBootstrap = findViewById(R.id.textBootstrap)
        scrollPlaybackStatus = findViewById(R.id.scrollPlaybackStatus)
        textPlaybackStatus = findViewById(R.id.textPlaybackStatus)
        val config = AppConfigLoader(this).load()
        cachedConfig = config
        SmartSignageAdLogger.i(
            "BOOTSTRAP",
            "Config carregada: serverUrl=${config.serverUrl}, uin=${config.uin}, deviceId=${config.deviceId}, mode=${config.mode}, sync=${config.syncIntervalSeconds}s"
        )

        textBootstrap.text = getString(
            R.string.bootstrap_message_with_config,
            config.serverUrl,
            config.uin,
            config.deviceId,
            config.mode,
            config.syncIntervalSeconds
        )
        textBootstrap.setOnClickListener { registerDevTap() }

        val internalCfg = java.io.File(filesDir, "app-config.json")
        val externalCfg = java.io.File("/sdcard/smartsignage-ad/app-config.json")
        val appScopedCfg = getExternalFilesDir(null)?.let { java.io.File(java.io.File(it, "smartsignage-ad"), "app-config.json") }
        if (!internalCfg.exists() && !externalCfg.exists() && appScopedCfg?.exists() != true) {
            openDebug("first_run")
            return
        }

        startPlayer()
    }

    private fun startPlayer() {
        if (playbackJob != null) return
        val config = cachedConfig ?: AppConfigLoader(this).load().also { cachedConfig = it }
        lifecycleScope.launch {
            try {
                val api = DispatcherApiClient(
                    baseUrl = config.serverUrl,
                    uin = config.uin,
                    deviceId = config.deviceId
                )
                exoPlayer = ExoPlayer.Builder(this@MainActivity).build()
                playerView.player = exoPlayer
                textBootstrap.visibility = View.GONE
                val controller = PlayerController(
                    context = this@MainActivity,
                    config = config,
                    apiClient = api,
                    exoPlayer = exoPlayer,
                    imageView = imageView,
                    onIdleStatus = { msg ->
                        runOnUiThread {
                            if (isFinishing || isDestroyed) return@runOnUiThread
                            if (msg.isNullOrEmpty()) {
                                scrollPlaybackStatus.visibility = View.GONE
                            } else {
                                textPlaybackStatus.text = msg
                                scrollPlaybackStatus.visibility = View.VISIBLE
                                scrollPlaybackStatus.scrollTo(0, 0)
                            }
                        }
                    }
                )
                playbackJob = launch { controller.start() }
                SmartSignageAdLogger.i("PLAYBACK", "PlayerController iniciado")
            } catch (e: Exception) {
                SmartSignageAdLogger.e("PLAYBACK", "Falha ao iniciar controller", e)
            }
        }
    }

    private fun registerDevTap() {
        if (devOpen) return
        val now = android.os.SystemClock.uptimeMillis()
        devTapCount = if (now - lastTapMs > 1200L) 1 else devTapCount + 1
        lastTapMs = now
        if (devTapCount >= 8) {
            devTapCount = 0
            openDebug("tap_8")
        }
    }

    private fun openDebug(reason: String) {
        if (devOpen) return
        devOpen = true
        cachedConfig = null
        if (::textBootstrap.isInitialized) textBootstrap.visibility = View.VISIBLE
        if (::scrollPlaybackStatus.isInitialized) scrollPlaybackStatus.visibility = View.GONE
        playbackJob?.cancel()
        playbackJob = null
        if (::exoPlayer.isInitialized) exoPlayer.stop()
        val intent = Intent(this, DebugConfigActivity::class.java).apply {
            putExtra("reason", reason)
        }
        debugLauncher.launch(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        playbackJob?.cancel()
        playbackJob = null
        if (::exoPlayer.isInitialized) exoPlayer.release()
    }
}
