package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Pré-visualização da montagem na área rolável da configuração.
 * A barra fixa (orientação + «Aplicar») fica fora deste container.
 */
object ConfigOrientationPreview {

    fun apply(activity: Activity, root: View?, displayRotation: Int) {
        val target = root ?: return
        val normalized = ((displayRotation % 4) + 4) % 4
        target.post {
            val metrics = activity.resources.displayMetrics
            val hostW = target.width.takeIf { it > 0 }?.toFloat() ?: metrics.widthPixels.toFloat()
            val hostH = target.height.takeIf { it > 0 }?.toFloat() ?: metrics.heightPixels.toFloat()
            if (hostW <= 0f || hostH <= 0f) return@post

            target.pivotX = hostW / 2f
            target.pivotY = hostH / 2f

            val panelLandscape = metrics.widthPixels >= metrics.heightPixels
            if (panelLandscape) {
                applyLandscapeBuffer(target, normalized, hostW, hostH)
            } else {
                applyPortraitBuffer(target, normalized, hostW, hostH)
            }

            target.requestLayout()
            PlayerAdLogger.i(
                "DEBUG_UI",
                "Preview orientação config: ${PlayerConfigLoader.displayRotationLabel(normalized)} " +
                    "host=${hostW.toInt()}x${hostH.toInt()} panel=${metrics.widthPixels}x${metrics.heightPixels}"
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
            1 -> resetRoot(target)
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
            0 -> resetRoot(target)
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

    private fun resetRoot(target: View) {
        target.rotation = 0f
        target.translationX = 0f
        target.translationY = 0f
        val lp = target.layoutParams ?: ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
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
