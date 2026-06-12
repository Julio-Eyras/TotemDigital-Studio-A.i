package br.com.smartchannel.playerad.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import br.com.smartchannel.playerad.PlayerAdApplication
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.playback.PlayerController
import br.com.smartchannel.playerad.util.PlayerAdLogger
import android.webkit.WebView
import android.widget.ImageView
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * MainActivity – entrada do Player-AD em Android TV.
 *
 * Responsável por:
 * - Colocar a Activity em modo imersivo (kiosk básico)
 * - Iniciar o fluxo de heartbeat + dispatch
 * - Delegar playback a um controlador (a ser implementado com ExoPlayer)
 */
class MainActivity : AppCompatActivity() {

    private lateinit var cacheManager: MediaCacheManager
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var htmlWebView: WebView

    private var playbackJob: Job? = null
    private var playerController: PlayerController? = null
    private var devUiOpen: Boolean = false

    private var devTapCount: Int = 0
    private var lastDevTapAtMs: Long = 0L
    private var kioskConfig: br.com.smartchannel.playerad.config.PlayerConfig? = null

    private val prefs by lazy {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    }

    private val debugLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        // Qualquer ação de "Iniciar" no debug permite voltar ao fluxo normal.
        devUiOpen = false
        val versionCode = currentVersionCode()
        prefs.edit()
            .putBoolean(KEY_DEV_FIRST_RUN_DONE, true)
            .putInt(KEY_DEV_LAST_VERSION_CODE, versionCode)
            .apply()
        startPlayer()
    }

    private fun openDebug(reason: String) {
        if (devUiOpen) return
        devUiOpen = true

        // Pausa/cancela o loop para não consumir rede enquanto você configura.
        playbackJob?.cancel()
        playbackJob = null
        try {
            exoPlayer.stop()
        } catch (_: Exception) { }

        KioskController.releaseLockTask(this)
        val intent = Intent(this, DebugConfigActivity::class.java).apply {
            putExtra(DebugConfigActivity.EXTRA_REASON, reason)
        }
        debugLauncher.launch(intent)
    }

    private fun startPlayer() {
        // Evita iniciar duas vezes.
        if (playbackJob != null) return

        playbackJob = lifecycleScope.launch {
            while (isActive && !devUiOpen) {
                try {
                    val config = PlayerConfigLoader(this@MainActivity).load()
                    cacheManager.reloadStorageRootsIfNeeded()
                    val appVersion = br.com.smartchannel.playerad.BuildConfig.VERSION_NAME
                    val apiClient = DispatcherApiClient(config.serverUrl, config.uin, config.deviceId, appVersion)
                    val otaCoordinator = br.com.smartchannel.playerad.ota.OtaUpdateCoordinator(
                        this@MainActivity,
                        apiClient,
                        appVersion
                    )
                    playerController = PlayerController(
                        this@MainActivity,
                        apiClient,
                        cacheManager,
                        exoPlayer,
                        playerView,
                        imageView,
                        htmlWebView,
                        config.acceptImagesInPlaylist,
                        config.allowPlaybackAudio,
                        config.fallbackPropagandasPerVinheta,
                        config.maxSecondsWithoutServerCheck,
                        otaCoordinator
                    )
                    PlayerAdLogger.i("WATCHDOG", "Loop do player iniciado")
                    playerController?.start()
                    PlayerAdLogger.w("WATCHDOG", "Loop do player terminou; reiniciando em ${WATCHDOG_RESTART_DELAY_MS}ms")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.e("Player-AD", "Falha no loop playback/Dispatcher; watchdog tentará reiniciar", e)
                    PlayerAdLogger.e("WATCHDOG", "Falha no loop playback/Dispatcher; reinício programado", e)
                } finally {
                    try {
                        exoPlayer.stop()
                    } catch (_: Exception) { }
                }
                delay(WATCHDOG_RESTART_DELAY_MS)
            }
        }
    }

    private fun registerDevTap() {
        if (devUiOpen) return

        val now = SystemClock.uptimeMillis()
        val windowMs = 1200L
        devTapCount = if (now - lastDevTapAtMs > windowMs) 1 else devTapCount + 1
        lastDevTapAtMs = now

        if (devTapCount >= DEV_TAPS_REQUIRED) {
            devTapCount = 0
            openDebug("tap_$DEV_TAPS_REQUIRED")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        kioskConfig = PlayerConfigLoader(this).load()
        if (!devUiOpen) {
            KioskController.applyPlayback(this, kioskConfig!!)
        }

        playerView = findViewById(R.id.playerView)
        imageView = findViewById(R.id.imageView)
        htmlWebView = findViewById(R.id.htmlWebView)

        cacheManager = (application as PlayerAdApplication).mediaCacheManager

        // Inicializar ExoPlayer
        exoPlayer = ExoPlayer.Builder(this).build()
        playerView.player = exoPlayer

        // Carregar configuração do player (serverUrl, uin, deviceId)
        val firstRun = !prefs.getBoolean(KEY_DEV_FIRST_RUN_DONE, false) ||
            prefs.getInt(KEY_DEV_LAST_VERSION_CODE, -1) != currentVersionCode()
        if (firstRun) {
            openDebug("first_run")
            return
        }

        startPlayer()

        // Kiosk: desabilita BACK usando o dispatcher (evita override de método deprecated).
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    // Intencionalmente vazio: não sai da aplicação.
                }
            }
        )
    }

    override fun onResume() {
        super.onResume()
        if (!devUiOpen) {
            val cfg = PlayerConfigLoader(this).load()
            kioskConfig = cfg
            KioskController.applyPlayback(this, cfg)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && !devUiOpen) {
            kioskConfig?.let { KioskController.applyPlayback(this, it) }
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (!devUiOpen && ev.action == MotionEvent.ACTION_DOWN) {
            registerDevTap()
        }
        return super.dispatchTouchEvent(ev)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        val cfg = kioskConfig ?: PlayerConfigLoader(this).load().also { kioskConfig = it }
        if (KioskController.shouldBlockSystemKey(cfg.kioskMode, keyCode)) {
            return true
        }
        val isPrimaryClick =
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER
        if (isPrimaryClick) {
            registerDevTap()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /** Compatível com API 28+ ([PackageInfo.longVersionCode]) sem usar [PackageInfo.versionCode] deprecado. */
    private fun currentVersionCode(): Int {
        return try {
            val info = packageManager.getPackageInfo(packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.longVersionCode.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt()
            } else {
                @Suppress("DEPRECATION")
                info.versionCode
            }
        } catch (_: Exception) {
            -1
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        playbackJob?.cancel()
        playbackJob = null
        try {
            if (::exoPlayer.isInitialized) exoPlayer.release()
        } catch (_: Exception) { }
    }

    companion object {
        private const val PREFS_NAME = "playerad_prefs"
        private const val KEY_DEV_FIRST_RUN_DONE = "dev_first_run_done"
        private const val KEY_DEV_LAST_VERSION_CODE = "dev_last_version_code"
        private const val DEV_TAPS_REQUIRED = 8
        private const val WATCHDOG_RESTART_DELAY_MS = 10_000L
    }
}

