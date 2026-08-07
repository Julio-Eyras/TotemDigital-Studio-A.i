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
 * [rotationApplied] só é true se o framebuffer / viewport realmente mudou (não basta gravar settings).
 */
object SystemDisplayRotation {

    fun apply(context: Context, displayRotation: Int): ApplyResult {
        val normalized = ((displayRotation % 4) + 4) % 4
        val userRotation = PlayerConfigLoader.displayRotationToUserRotation(normalized)

        // Já provisionado no SO (ex.: install-player-adb.ps1) — evita su -c e pop-up SuperSU.
        val currentUser = readUserRotation(context)
        val currentAccel = readAccelerometerRotation(context)
        if (currentUser == userRotation && currentAccel == 0) {
            val displayEffective = isDisplayRotationEffective(context, normalized)
            return ApplyResult(
                userRotation = userRotation,
                rotationApplied = displayEffective,
                settingsWritten = false,
                displayEffective = displayEffective,
                accelerometerLocked = true
            )
        }

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
        /** True apenas se o viewport/framebuffer confirma a orientação pedida. */
        val rotationApplied: Boolean,
        val settingsWritten: Boolean,
        val displayEffective: Boolean,
        val accelerometerLocked: Boolean
    )

    /**
     * O framebuffer do SO já está na orientação da montagem — sem fallback visual?
     *
     * Em Allwinner (TV_BOX_3) `user_rotation` grava mas as métricas ficam sempre
     * landscape (ex.: 1280×720). Aí:
     * - montagem 1 (paisagem nativa) → OK sem fallback
     * - montagens 0/2/3 → aspecto “bate” por acaso (3 também é landscape) mas o
     *   conteúdo sai deitado/invertido no painel físico — precisa [ViewDisplayRotation].
     */
    fun isViewportMatchingMount(context: Context, displayRotation: Int): Boolean {
        val mount = ((displayRotation % 4) + 4) % 4
        val dm = context.resources.displayMetrics
        val portraitViewport = dm.heightPixels > dm.widthPixels
        val portraitMount = MediaViewportRotation.isPortraitMount(displayRotation)
        if (portraitViewport != portraitMount) return false

        val display = resolveDisplay(context)
        val expectedSurface = displayRotationToSurfaceRotation(mount)
        if (display != null && display.rotation == expectedSurface) {
            // Surface confirma a montagem (dispositivo que aplica rotação de verdade).
            return true
        }

        // Surface não confirma (Allwinner típico): só a montagem nativa do eixo
        // (0 retrato com viewport portrait real, 1 paisagem com viewport landscape)
        // conta como efectiva. 2 e 3 são inversões — sempre precisam de compensação.
        return when (mount) {
            0 -> portraitViewport
            1 -> !portraitViewport
            else -> false
        }
    }

    fun isDisplayRotationEffective(context: Context, displayRotation: Int): Boolean {
        return isViewportMatchingMount(context, displayRotation)
    }

    /** TV boxes costumam aplicar user_rotation mas [Display.getRotation] continua em 0. */
    fun isUserRotationAligned(context: Context, displayRotation: Int): Boolean {
        val expected = PlayerConfigLoader.displayRotationToUserRotation(displayRotation)
        return readUserRotation(context) == expected
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
        if (readAccelerometerRotation(context) == 0) return true
        if (putSystemInt(context, Settings.System.ACCELEROMETER_ROTATION, 0)) return true
        return runSuSettings("put system accelerometer_rotation 0")
    }

    private fun writeUserRotation(context: Context, userRotation: Int): Boolean {
        val value = userRotation.coerceIn(0, 3)
        if (readUserRotation(context) == value) return true
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

    fun readAccelerometerRotation(context: Context): Int? {
        return try {
            Settings.System.getInt(context.contentResolver, Settings.System.ACCELEROMETER_ROTATION)
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
