package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Pré-visualização da montagem na tela de configuração: gira todo o formulário
 * para o operador ver como o player ficará com o [displayRotation] escolhido.
 */
object ConfigOrientationPreview {

    fun apply(activity: Activity, root: View?, displayRotation: Int) {
        val target = root ?: return
        val normalized = ((displayRotation % 4) + 4) % 4
        target.post {
            val metrics = activity.resources.displayMetrics
            val w = metrics.widthPixels.toFloat()
            val h = metrics.heightPixels.toFloat()
            if (w <= 0f || h <= 0f) return@post

            target.pivotX = w / 2f
            target.pivotY = h / 2f

            if (w >= h) {
                applyLandscapeBuffer(target, normalized, w, h)
            } else {
                applyPortraitBuffer(target, normalized, w, h)
            }

            PlayerAdLogger.i(
                "DEBUG_UI",
                "Preview orientação config: ${PlayerConfigLoader.displayRotationLabel(normalized)} " +
                    "(${w.toInt()}x${h.toInt()})"
            )
        }
    }

    /** Buffer landscape (ex.: 1280×672 em TV box com user_rotation portrait). */
    private fun applyLandscapeBuffer(target: View, normalized: Int, w: Float, h: Float) {
        when (normalized) {
            0 -> {
                target.rotation = 90f
                target.translationX = (h - w) / 2f
                target.translationY = (w - h) / 2f
                resizeRoot(target, h.toInt(), w.toInt())
            }
            1 -> resetRoot(target, w.toInt(), h.toInt())
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
    }

    /** Buffer já em portrait lógico (altura maior que largura). */
    private fun applyPortraitBuffer(target: View, normalized: Int, w: Float, h: Float) {
        when (normalized) {
            0 -> resetRoot(target, w.toInt(), h.toInt())
            1 -> {
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
    }

    private fun resetRoot(target: View, width: Int, height: Int) {
        target.rotation = 0f
        target.translationX = 0f
        target.translationY = 0f
        resizeRoot(target, width, height)
    }

    private fun resizeRoot(target: View, width: Int, height: Int) {
        val lp = target.layoutParams ?: ViewGroup.LayoutParams(width, height)
        lp.width = width
        lp.height = height
        target.layoutParams = lp
    }
}
