package br.com.smartchannel.playerad.ui

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
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
import br.com.smartchannel.playerad.api.ApiHttpException
import br.com.smartchannel.playerad.api.DispatcherApiClient
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.playback.PlayerController
import br.com.smartchannel.playerad.util.AppDirs
import br.com.smartchannel.playerad.util.FullscreenViewport
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.PlayerAdPrefs
import br.com.smartchannel.playerad.util.StorageRootMigrator
import br.com.smartchannel.playerad.util.StorageVolumeMonitor
import java.io.File
import android.webkit.WebView
import android.widget.ImageView
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Player em kiosk fullscreen — só entra após configuração inicial concluída.
 * Na 1ª execução redireciona para [DebugConfigActivity] sem inicializar vídeo/kiosk.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var cacheManager: MediaCacheManager
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerView: PlayerView
    private lateinit var imageView: ImageView
    private lateinit var htmlWebView: WebView

    private var playbackJob: Job? = null
    private var playerController: PlayerController? = null
    private var storageMonitor: StorageVolumeMonitor? = null
    private var storageChangeJob: Job? = null
    private var devUiOpen: Boolean = false

    private var devTapCount: Int = 0
    private var lastDevTapAtMs: Long = 0L
    private var kioskConfig: br.com.smartchannel.playerad.config.PlayerConfig? = null

    private val prefs by lazy { PlayerAdPrefs.prefs(this) }

    private val debugLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        devUiOpen = false
        if (needsSetupFlow()) {
            launchSetupFlow("setup_required", onboarding = false)
            return@registerForActivityResult
        }
        // Reaplica montagem no contentHost da Main (o debug só rodava o configHost)
        // e reinicia o loop com o displayRotation gravado.
        restartPlayerAfterConfigChange("debug_closed")
    }

    private fun needsSetupFlow(): Boolean {
        if (prefs.getBoolean(PlayerAdPrefs.KEY_DEV_FIRST_RUN_DONE, false)) {
            return false
        }
        // Config já presente (ex.: push via adb) — não bloquear o player após update do APK.
        return try {
            val cfg = PlayerConfigLoader(this).load()
            val valid = cfg.serverUrl.isNotBlank() && cfg.uin.isNotBlank() && cfg.deviceId.isNotBlank()
            if (valid) {
                prefs.edit()
                    .putBoolean(PlayerAdPrefs.KEY_DEV_FIRST_RUN_DONE, true)
                    .putInt(PlayerAdPrefs.KEY_DEV_LAST_VERSION_CODE, currentVersionCode())
                    .commit()
                false
            } else {
                true
            }
        } catch (_: Exception) {
            true
        }
    }

    private fun launchSetupFlow(reason: String, onboarding: Boolean) {
        PlayerAdLogger.i("SETUP", "Redirecionando para configuração: $reason (onboarding=$onboarding)")
        val intent = Intent(this, DebugConfigActivity::class.java).apply {
            putExtra(DebugConfigActivity.EXTRA_REASON, reason)
            putExtra(DebugConfigActivity.EXTRA_ONBOARDING, onboarding)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        startActivity(intent)
        finish()
    }

    private fun openDebug(reason: String) {
        if (devUiOpen) return
        devUiOpen = true

        playbackJob?.cancel()
        playbackJob = null
        try {
            playerController?.release()
        } catch (_: Exception) { }
        playerController = null
        try {
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
        } catch (_: Exception) { }

        KioskController.releaseLockTask(this)
        val intent = Intent(this, DebugConfigActivity::class.java).apply {
            putExtra(DebugConfigActivity.EXTRA_REASON, reason)
            putExtra(DebugConfigActivity.EXTRA_ONBOARDING, false)
        }
        debugLauncher.launch(intent)
    }

    private fun restartPlayerAfterConfigChange(reason: String) {
        val cfg = PlayerConfigLoader(this).load()
        kioskConfig = cfg
        PlayerAdLogger.i(
            "ORIENT",
            "Reinício pós-config ($reason) mount=${cfg.displayRotation} " +
                "(${br.com.smartchannel.playerad.config.PlayerConfigLoader.displayRotationLabel(cfg.displayRotation)})",
        )
        cacheManager.reconcileForDisplayRotation(cfg.displayRotation)
        if (!devUiOpen) {
            KioskController.applyPlayback(this, cfg)
        }
        playbackJob?.cancel()
        playbackJob = null
        try {
            playerController?.release()
        } catch (_: Exception) { }
        playerController = null
        try {
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
        } catch (_: Exception) { }
        startPlayer()
    }

    private fun startPlayer() {
        if (playbackJob != null) return

        playbackJob = lifecycleScope.launch {
            while (isActive && !devUiOpen) {
                var restartDelayMs = WATCHDOG_RESTART_DELAY_MS
                try {
                    val config = PlayerConfigLoader(this@MainActivity).load()
                    ensureStorageRootMigrated()
                    cacheManager.reloadStorageRootsIfNeeded()
                    cacheManager.applyLimitsFromConfig(config)
                    // Garante montagem alinhada mesmo se o loop reiniciar via watchdog
                    withContext(kotlinx.coroutines.Dispatchers.Main) {
                        if (!devUiOpen) {
                            kioskConfig = config
                            KioskController.applyPlayback(this@MainActivity, config)
                        }
                    }
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
                        config.mediaTransitionEnabled,
                        config.fallbackPropagandasPerVinheta,
                        config.batimentoCardiaco,
                        config.maxSecondsWithoutServerCheck,
                        config.pollAdaptive,
                        config.displayRotation,
                        otaCoordinator,
                        findViewById(R.id.displayIdleOverlay),
                        findViewById(R.id.mediaTransitionOverlay),
                    )
                    PlayerAdLogger.i("WATCHDOG", "Loop do player iniciado mount=${config.displayRotation}")
                    playerController?.start()
                    PlayerAdLogger.w("WATCHDOG", "Loop do player terminou; reiniciando em ${WATCHDOG_RESTART_DELAY_MS}ms")
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    if (e is ApiHttpException && e.code == 429) {
                        restartDelayMs = (e.retryAfterSeconds ?: 60L)
                            .coerceIn(1L, 15L * 60L) * 1000L
                    }
                    Log.e("Player-AD", "Falha no loop playback/Dispatcher; watchdog tentará reiniciar", e)
                    PlayerAdLogger.e(
                        "WATCHDOG",
                        "Falha no loop playback/Dispatcher; reinício em ${restartDelayMs}ms",
                        e,
                    )
                } finally {
                    try {
                        exoPlayer.stop()
                    } catch (_: Exception) { }
                }
                delay(restartDelayMs)
            }
        }
    }

    /** Migra cache/plano se o root mudou desde a última execução. */
    private fun ensureStorageRootMigrated() {
        val newRoot = AppDirs.root(this)
        val previous = prefs.getString(PlayerAdPrefs.KEY_LAST_STORAGE_ROOT, null)
            ?.takeIf { it.isNotBlank() }
            ?.let { File(it) }
        val result = StorageRootMigrator.migrateIfNeeded(previous, newRoot)
        if (result.migrated) {
            cacheManager.reloadStorageRootsIfNeeded()
            cacheManager.init()
        }
        prefs.edit()
            .putString(PlayerAdPrefs.KEY_LAST_STORAGE_ROOT, newRoot.absolutePath)
            .apply()
    }

    private fun onStorageVolumeChanged(action: String) {
        if (devUiOpen) return
        storageChangeJob?.cancel()
        storageChangeJob = lifecycleScope.launch {
            delay(STORAGE_CHANGE_DEBOUNCE_MS)
            PlayerAdLogger.w("STORAGE", "A reiniciar player após $action")
            playbackJob?.cancel()
            playbackJob = null
            try {
                playerController?.release()
            } catch (_: Exception) { }
            playerController = null
            try {
                exoPlayer.stop()
                exoPlayer.clearMediaItems()
            } catch (_: Exception) { }
            ensureStorageRootMigrated()
            val cfg = PlayerConfigLoader(this@MainActivity).load()
            cacheManager.reloadStorageRootsIfNeeded()
            cacheManager.applyLimitsFromConfig(cfg)
            startPlayer()
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
            return
        }
        val remaining = DEV_TAPS_REQUIRED - devTapCount
        if (remaining in 1..3) {
            android.widget.Toast.makeText(
                this,
                "Mais $remaining toque(s) no OK para abrir configuração",
                android.widget.Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun completeStartup() {
        kioskConfig = PlayerConfigLoader(this).load()
        if (!devUiOpen) {
            KioskController.applyPlayback(this, kioskConfig!!)
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() { }
            }
        )

        startPlayer()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (needsSetupFlow()) {
            launchSetupFlow(reason = "first_run", onboarding = true)
            return
        }

        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.playerView)
        imageView = findViewById(R.id.imageView)
        htmlWebView = findViewById(R.id.htmlWebView)

        cacheManager = (application as PlayerAdApplication).mediaCacheManager

        storageMonitor = StorageVolumeMonitor { action ->
            onStorageVolumeChanged(action)
        }.also { it.register(this) }

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15_000, 50_000, 2_500, 5_000)
            .build()
        exoPlayer = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .build()
        playerView.player = exoPlayer
        playerView.useController = false
        playerView.controllerHideOnTouch = false
        // FILL + matrix FIT (largura cheia landscape) no PlayerController — ver MediaViewportRotation
        playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FILL
        playerView.setKeepContentOnPlayerReset(true)
        // TRANSPARENT + stop/reset do ExoPlayer → flash branco na TV; preto cobre o shutter.
        playerView.setShutterBackgroundColor(Color.BLACK)
        playerView.setBackgroundColor(Color.BLACK)
        playerView.post { FullscreenViewport.applyToPlayerView(playerView) }

        completeStartup()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (devUiOpen) return
        // Não reaplicar DisplayPresentation/ViewDisplayRotation aqui — métricas oscilam
        // (648/672/720) e o re-layout parece reinício constante do app.
        kioskConfig?.let { KioskController.ensureForegroundChrome(this, it) }
    }

    override fun onPause() {
        // Manter playback e ecrã ligados — pause/stop por apps transitórios (file manager)
        // não deve parecer “crash” nem apagar a superfície.
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        try {
            if (::exoPlayer.isInitialized) {
                exoPlayer.playWhenReady = true
            }
        } catch (_: Exception) { }
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (devUiOpen) return
        val cfg = PlayerConfigLoader(this).load()
        kioskConfig = cfg
        // Chrome leve: não re-layout do contentHost (evita flicker a cada resume/focus).
        KioskController.ensureForegroundChrome(this, cfg)
        try {
            if (::exoPlayer.isInitialized) {
                exoPlayer.playWhenReady = true
                if (exoPlayer.playbackState == androidx.media3.common.Player.STATE_READY ||
                    exoPlayer.playbackState == androidx.media3.common.Player.STATE_BUFFERING
                ) {
                    exoPlayer.play()
                }
            }
        } catch (_: Exception) { }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (!hasFocus || devUiOpen) return
        kioskConfig?.let { KioskController.ensureForegroundChrome(this, it) }
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
        storageChangeJob?.cancel()
        storageChangeJob = null
        storageMonitor?.unregister(this)
        storageMonitor = null
        playbackJob?.cancel()
        playbackJob = null
        try {
            if (::exoPlayer.isInitialized) exoPlayer.release()
        } catch (_: Exception) { }
    }

    companion object {
        private const val DEV_TAPS_REQUIRED = 3
        private const val WATCHDOG_RESTART_DELAY_MS = 2_000L
        private const val STORAGE_CHANGE_DEBOUNCE_MS = 1_500L
    }
}
