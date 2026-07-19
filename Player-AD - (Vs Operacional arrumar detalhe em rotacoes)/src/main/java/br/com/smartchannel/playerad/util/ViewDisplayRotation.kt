package br.com.smartchannel.playerad.util

import android.app.Activity
import android.content.res.Configuration
import android.view.View
import android.view.ViewGroup
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Fallback quando `user_rotation` não altera o framebuffer (TV_BOX_3 / Android 14).
 * Gira o conteúdo da Activity (vídeo, imagem, UI) conforme [displayRotation].
 */
object ViewDisplayRotation {

    fun apply(activity: Activity, root: View?, displayRotation: Int, enabled: Boolean) {
        val target = root ?: return
        if (!enabled) {
            reset(target)
            return
        }
        val normalized = ((displayRotation % 4) + 4) % 4
        if (normalized == 1) {
            reset(target)
            return
        }

        target.post {
            val metrics = activity.resources.displayMetrics
            val w = metrics.widthPixels.toFloat()
            val h = metrics.heightPixels.toFloat()
            if (w <= 0f || h <= 0f) return@post

            target.pivotX = w / 2f
            target.pivotY = h / 2f

            when (normalized) {
                0 -> {
                    target.rotation = 90f
                    target.translationX = (h - w) / 2f
                    target.translationY = (w - h) / 2f
                    resizeRoot(target, h.toInt(), w.toInt())
                }
                2 -> {
                    target.rotation = 180f
                    target.translationX = 0f
                    target.translationY = 0f
                    resizeRoot(target, w.toInt(), h.toInt())
                }
                else -> {
                    target.rotation = 270f
                    target.translationX = (h - w) / 2f
                    target.translationY = (w - h) / 2f
                    resizeRoot(target, h.toInt(), w.toInt())
                }
            }
            PlayerAdLogger.i(
                "KIOSK",
                "Fallback visual aplicado: ${normalized * 90}° (${w.toInt()}x${h.toInt()} → portrait)"
            )
        }
    }

    fun isConfigurationOrientationMatch(displayRotation: Int, orientation: Int): Boolean {
        val normalized = ((displayRotation % 4) + 4) % 4
        return when (normalized) {
            1, 3 -> orientation == Configuration.ORIENTATION_LANDSCAPE
            else -> orientation == Configuration.ORIENTATION_PORTRAIT
        }
    }

    private fun reset(target: View) {
        target.rotation = 0f
        target.translationX = 0f
        target.translationY = 0f
        val lp = target.layoutParams ?: return
        lp.width = ViewGroup.LayoutParams.MATCH_PARENT
        lp.height = ViewGroup.LayoutParams.MATCH_PARENT
        target.layoutParams = lp
    }

    private fun resizeRoot(target: View, width: Int, height: Int) {
        val lp = target.layoutParams ?: ViewGroup.LayoutParams(width, height)
        lp.width = width
        lp.height = height
        target.layoutParams = lp
    }
}
