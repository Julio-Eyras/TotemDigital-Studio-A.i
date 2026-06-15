package br.com.smartchannel.playerad.util

import android.app.Activity
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.view.Display
import android.view.Surface
import android.view.WindowManager
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import java.io.File

/**
 * Aplica rotação no Android (user_rotation) — necessário em TV boxes para girar a tela de fato.
 * Tenta Settings API e, se falhar, `su -c settings put` (TV_BOX_3 tem su).
 * [rotationApplied] só é true se o framebuffer realmente mudou (não basta gravar settings).
 */
object SystemDisplayRotation {

    fun apply(context: Context, displayRotation: Int): ApplyResult {
        val normalized = ((displayRotation % 4) + 4) % 4
        val userRotation = PlayerConfigLoader.displayRotationToUserRotation(normalized)
        val accelerometerLocked = lockAccelerometerRotation(context)
        val settingsWritten = writeUserRotation(context, userRotation)
        val displayEffective = isDisplayRotationEffective(context, normalized)
        return ApplyResult(
            userRotation = userRotation,
            rotationApplied = displayEffective,
            settingsWritten = settingsWritten,
            displayEffective = displayEffective,
            accelerometerLocked = accelerometerLocked
        )
    }

    data class ApplyResult(
        val userRotation: Int,
        /** True apenas se [Display.getRotation] confirma a orientação pedida. */
        val rotationApplied: Boolean,
        val settingsWritten: Boolean,
        val displayEffective: Boolean,
        val accelerometerLocked: Boolean
    )

    fun isDisplayRotationEffective(context: Context, displayRotation: Int): Boolean {
        val display = resolveDisplay(context) ?: return false
        val expected = displayRotationToSurfaceRotation(displayRotation)
        return display.rotation == expected
    }

    fun displayRotationToSurfaceRotation(displayRotation: Int): Int {
        return when (((displayRotation % 4) + 4) % 4) {
            1 -> Surface.ROTATION_0
            2 -> Surface.ROTATION_180
            3 -> Surface.ROTATION_270
            else -> Surface.ROTATION_90
        }
    }

    private fun resolveDisplay(context: Context): Display? {
        if (context is Activity) return context.display
        @Suppress("DEPRECATION")
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return null
        @Suppress("DEPRECATION")
        return wm.defaultDisplay
    }

    private fun lockAccelerometerRotation(context: Context): Boolean {
        if (putSystemInt(context, Settings.System.ACCELEROMETER_ROTATION, 0)) return true
        return runSuSettings("put system accelerometer_rotation 0")
    }

    private fun writeUserRotation(context: Context, userRotation: Int): Boolean {
        val value = userRotation.coerceIn(0, 3)
        if (putSystemInt(context, Settings.System.USER_ROTATION, value)) return true
        if (!runSuSettings("put system user_rotation $value")) return false
        return readUserRotation(context) == value
    }

    private fun putSystemInt(context: Context, key: String, value: Int): Boolean {
        return try {
            Settings.System.putInt(context.contentResolver, key, value)
            Settings.System.getInt(context.contentResolver, key) == value
        } catch (_: Exception) {
            false
        }
    }

    private fun runSuSettings(settingsArgs: String): Boolean {
        if (!suBinaryExists()) return false
        return try {
            val proc = Runtime.getRuntime().exec(arrayOf("su", "-c", "settings $settingsArgs"))
            val waiter = Thread { proc.waitFor() }
            waiter.start()
            waiter.join(5000)
            if (waiter.isAlive) {
                proc.destroy()
                return false
            }
            proc.exitValue() == 0
        } catch (_: Exception) {
            false
        }
    }

    fun readUserRotation(context: Context): Int? {
        return try {
            Settings.System.getInt(context.contentResolver, Settings.System.USER_ROTATION)
        } catch (_: Exception) {
            null
        }
    }

    private fun suBinaryExists(): Boolean {
        val paths = listOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/vendor/bin/su"
        )
        return paths.any { File(it).exists() }
    }
}
