package br.com.smartchannel.playerad.util

import android.content.Context
import android.provider.Settings
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import java.io.File

/**
 * Aplica rotação no Android (user_rotation) — necessário em TV boxes para girar a tela de fato.
 * Tenta Settings API e, se falhar, `su -c settings put` (TV_BOX_3 tem su).
 */
object SystemDisplayRotation {

    fun apply(context: Context, displayRotation: Int): ApplyResult {
        val userRotation = PlayerConfigLoader.displayRotationToUserRotation(displayRotation)
        val accelerometerLocked = lockAccelerometerRotation(context)
        val rotationApplied = setUserRotation(context, userRotation)
        return ApplyResult(
            userRotation = userRotation,
            rotationApplied = rotationApplied,
            accelerometerLocked = accelerometerLocked
        )
    }

    data class ApplyResult(
        val userRotation: Int,
        val rotationApplied: Boolean,
        val accelerometerLocked: Boolean
    )

    private fun lockAccelerometerRotation(context: Context): Boolean {
        if (putSystemInt(context, Settings.System.ACCELEROMETER_ROTATION, 0)) return true
        return runSuSettings("put system accelerometer_rotation 0")
    }

    private fun setUserRotation(context: Context, userRotation: Int): Boolean {
        val value = userRotation.coerceIn(0, 3)
        if (putSystemInt(context, Settings.System.USER_ROTATION, value)) return true
        return runSuSettings("put system user_rotation $value")
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
            waiter.join(3000)
            if (waiter.isAlive) {
                proc.destroy()
                return false
            }
            proc.exitValue() == 0
        } catch (_: Exception) {
            false
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
