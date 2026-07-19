package br.com.smartchannel.playerad.util

import android.app.Activity
import android.content.res.Configuration
import android.view.View
import android.view.ViewGroup

/**
 * Fallback quando `user_rotation` não altera o framebuffer (TV_BOX_3 / Android 14).
 * Gira o [contentHost] para a montagem pedida e **centra** no ecrã (evita mídia na metade de baixo).
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
            // Paisagem nativa — sem compensação visual
            reset(target)
            return
        }

        target.post {
            val metrics = activity.resources.displayMetrics
            val screenW = metrics.widthPixels
            val screenH = metrics.heightPixels
            if (screenW <= 0 || screenH <= 0) return@post

            when (normalized) {
                0 -> applyQuarterTurn(target, 90f, screenW, screenH)
                2 -> applyHalfTurn(target, screenW, screenH)
                else -> applyQuarterTurn(target, 270f, screenW, screenH)
            }
            PlayerAdLogger.i(
                "KIOSK",
                "Fallback visual: ${normalized * 90}° screen=${screenW}x${screenH} " +
                    "host=${target.width}x${target.height} " +
                    "tx=${target.translationX.toInt()} ty=${target.translationY.toInt()}",
            )
        }
    }

    /**
     * 90°/270°: filho com dimensões trocadas (portrait lógico), pivot no centro do filho,
     * depois centrado no framebuffer landscape — corrige o “tudo preto em cima”.
     */
    private fun applyQuarterTurn(target: View, degrees: Float, screenW: Int, screenH: Int) {
        resizeRoot(target, screenH, screenW)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else screenH
            val vh = if (target.height > 0) target.height else screenW
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = degrees
            target.translationX = (screenW - vw) / 2f
            target.translationY = (screenH - vh) / 2f
        }
    }

    private fun applyHalfTurn(target: View, screenW: Int, screenH: Int) {
        resizeRoot(target, screenW, screenH)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else screenW
            val vh = if (target.height > 0) target.height else screenH
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = 180f
            target.translationX = 0f
            target.translationY = 0f
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
        target.pivotX = 0f
        target.pivotY = 0f
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
