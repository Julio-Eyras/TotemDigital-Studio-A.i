package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Pré-visualização da montagem na área rolável da configuração.
 * A barra fixa (orientação + ações) fica fora deste container.
 *
 * Mesma estratégia de [br.com.smartchannel.playerad.util.ViewDisplayRotation]:
 * reset → medir o slot → resize → no próximo post pivot/rotation/translation
 * (evita a metade superior preta ao girar 90°/270°).
 */
object ConfigOrientationPreview {

    fun apply(activity: Activity, root: View?, displayRotation: Int) {
        val target = root ?: return
        val normalized = ((displayRotation % 4) + 4) % 4

        resetRoot(target)
        target.requestLayout()
        target.post {
            val metrics = activity.resources.displayMetrics
            val slotW = target.width.takeIf { it > 0 } ?: metrics.widthPixels
            val slotH = target.height.takeIf { it > 0 } ?: metrics.heightPixels
            if (slotW <= 0 || slotH <= 0) return@post

            val panelLandscape = metrics.widthPixels >= metrics.heightPixels
            if (panelLandscape) {
                applyLandscapeBuffer(target, normalized, slotW, slotH)
            } else {
                applyPortraitBuffer(target, normalized, slotW, slotH)
            }

            PlayerAdLogger.i(
                "DEBUG_UI",
                "Preview orientação config: ${PlayerConfigLoader.displayRotationLabel(normalized)} " +
                    "slot=${slotW}x${slotH} panel=${metrics.widthPixels}x${metrics.heightPixels}"
            )
        }
    }

    /** Buffer landscape (ex.: 1280×672 em TV box com user_rotation portrait). */
    private fun applyLandscapeBuffer(target: View, normalized: Int, slotW: Int, slotH: Int) {
        // Mesmos graus que [ViewDisplayRotation] (painel portrait físico).
        when (normalized) {
            0 -> applyQuarterTurn(target, 270f, slotW, slotH)
            1 -> Unit // já em reset
            2 -> applyHalfTurn(target, slotW, slotH)
            else -> applyQuarterTurn(target, 90f, slotW, slotH)
        }
    }

    /** Buffer já em portrait lógico (altura maior que largura). */
    private fun applyPortraitBuffer(target: View, normalized: Int, slotW: Int, slotH: Int) {
        when (normalized) {
            0 -> Unit // já em reset
            1 -> applyQuarterTurn(target, 90f, slotW, slotH)
            2 -> applyHalfTurn(target, slotW, slotH)
            else -> applyQuarterTurn(target, 270f, slotW, slotH)
        }
    }

    /**
     * 90°/270°: filho com dimensões trocadas, pivot no centro, centrado no slot —
     * corrige o “tudo preto em cima”.
     */
    private fun applyQuarterTurn(target: View, degrees: Float, slotW: Int, slotH: Int) {
        resizeRoot(target, slotH, slotW)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else slotH
            val vh = if (target.height > 0) target.height else slotW
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = degrees
            target.translationX = (slotW - vw) / 2f
            target.translationY = (slotH - vh) / 2f
        }
    }

    private fun applyHalfTurn(target: View, slotW: Int, slotH: Int) {
        resizeRoot(target, slotW, slotH)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else slotW
            val vh = if (target.height > 0) target.height else slotH
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = 180f
            target.translationX = 0f
            target.translationY = 0f
        }
    }

    private fun resetRoot(target: View) {
        target.rotation = 0f
        target.translationX = 0f
        target.translationY = 0f
        target.pivotX = 0f
        target.pivotY = 0f
        val lp = target.layoutParams
        if (lp is android.widget.LinearLayout.LayoutParams) {
            lp.width = ViewGroup.LayoutParams.MATCH_PARENT
            lp.height = 0
            lp.weight = 1f
            target.layoutParams = lp
        } else {
            val fallback = lp ?: ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            fallback.width = ViewGroup.LayoutParams.MATCH_PARENT
            fallback.height = ViewGroup.LayoutParams.MATCH_PARENT
            target.layoutParams = fallback
        }
    }

    private fun resizeRoot(target: View, width: Int, height: Int) {
        val lp = target.layoutParams
        if (lp is android.widget.LinearLayout.LayoutParams) {
            lp.width = width
            lp.height = height
            lp.weight = 0f
            target.layoutParams = lp
        } else {
            val fallback = lp ?: ViewGroup.LayoutParams(width, height)
            fallback.width = width
            fallback.height = height
            target.layoutParams = fallback
        }
    }
}
