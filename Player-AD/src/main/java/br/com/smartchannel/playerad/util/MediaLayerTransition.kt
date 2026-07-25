package br.com.smartchannel.playerad.util

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.view.View
import br.com.smartchannel.playerad.R
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Véu escuro/translúcido entre mídias: cobre o frame residual (vídeo/imagem anterior)
 * e revela o conteúdo novo com fade curto — evita “flick” de predecessor.
 */
object MediaLayerTransition {

    /** Pico do véu — opaco na troca (evita ver camada de baixo nas letterboxes). */
    const val PEAK_ALPHA = 1.0f
    const val FADE_IN_MS = 70L
    const val FADE_OUT_MS = 100L

    suspend fun cover(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        view.visibility = View.VISIBLE
        view.bringToFront()
        val from = view.alpha.coerceIn(0f, 1f)
        if (from >= PEAK_ALPHA - 0.02f) {
            view.alpha = PEAK_ALPHA
            return
        }
        animateAlpha(view, from, PEAK_ALPHA, FADE_IN_MS)
    }

    suspend fun reveal(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        if (view.visibility != View.VISIBLE || view.alpha <= 0.02f) {
            view.alpha = 0f
            view.visibility = View.GONE
            return
        }
        animateAlpha(view, view.alpha, 0f, FADE_OUT_MS)
        view.visibility = View.GONE
    }

    fun reset(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        view.alpha = 0f
        view.visibility = View.GONE
    }

    private fun cancelRunning(view: View) {
        view.animate().cancel()
        (view.getTag(R.id.media_transition_animator) as? Animator)?.cancel()
        view.setTag(R.id.media_transition_animator, null)
    }

    private suspend fun animateAlpha(view: View, from: Float, to: Float, durationMs: Long) =
        suspendCancellableCoroutine { cont ->
            val animator = ObjectAnimator.ofFloat(view, View.ALPHA, from, to).apply {
                duration = durationMs.coerceAtLeast(1L)
            }
            view.setTag(R.id.media_transition_animator, animator)
            animator.addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    view.setTag(R.id.media_transition_animator, null)
                    if (cont.isActive) cont.resume(Unit)
                }

                override fun onAnimationCancel(animation: Animator) {
                    view.setTag(R.id.media_transition_animator, null)
                    if (cont.isActive) cont.resume(Unit)
                }
            })
            cont.invokeOnCancellation {
                animator.cancel()
                view.setTag(R.id.media_transition_animator, null)
            }
            animator.start()
        }
}
