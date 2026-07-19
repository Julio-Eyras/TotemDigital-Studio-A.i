package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import br.com.smartchannel.playerad.config.KioskMode
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Aplica kiosk fullscreen (imersivo ou forte) conforme [PlayerConfig].
 * Na tela de debug o modo é sempre relaxado (sem lock task, barras visíveis).
 */
object KioskController {

    fun applyPlayback(activity: Activity, config: PlayerConfig) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        DisplayPresentationController.apply(activity, config)
        when (config.kioskMode) {
            KioskMode.IMMERSIVE -> {
                releaseLockTask(activity)
                enterImmersiveMode(activity)
                PlayerAdLogger.i("KIOSK", "Modo imersivo (fullscreen)")
            }
            KioskMode.STRONG -> {
                enterImmersiveMode(activity)
                tryStartLockTask(activity)
                PlayerAdLogger.i("KIOSK", "Modo forte (lock task + imersivo)")
            }
        }
    }

    fun applyDebug(activity: Activity) {
        releaseLockTask(activity)
        showSystemBars(activity)
        PlayerAdLogger.i("KIOSK", "Debug: kiosk relaxado (barras visíveis, sem lock task)")
    }

    fun shouldBlockSystemKey(kioskMode: KioskMode, keyCode: Int): Boolean {
        if (kioskMode != KioskMode.STRONG) return false
        return when (keyCode) {
            KeyEvent.KEYCODE_HOME,
            KeyEvent.KEYCODE_APP_SWITCH,
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_SEARCH,
            KeyEvent.KEYCODE_ASSIST,
            KeyEvent.KEYCODE_VOICE_ASSIST -> true
            else -> false
        }
    }

    private fun enterImmersiveMode(activity: Activity) {
        try {
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } catch (e: Exception) {
            Log.w("Player-AD", "Immersive (WindowInsets) falhou; flags legadas: ${e.message}")
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    }

    fun showSystemBars(activity: Activity) {
        try {
            val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            controller.show(WindowInsetsCompat.Type.systemBars())
        } catch (e: Exception) {
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun tryStartLockTask(activity: Activity) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
                    activity.startLockTask()
                }
            }
        } catch (e: Exception) {
            Log.w("Player-AD", "startLockTask indisponível (whitelist/device owner?): ${e.message}")
            PlayerAdLogger.w("KIOSK", "Lock task não ativado: ${e.message ?: "sem permissão"}")
        }
    }

    fun releaseLockTask(activity: Activity) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                if (am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE) {
                    activity.stopLockTask()
                }
            }
        } catch (e: Exception) {
            Log.w("Player-AD", "stopLockTask falhou: ${e.message}")
        }
    }
}
