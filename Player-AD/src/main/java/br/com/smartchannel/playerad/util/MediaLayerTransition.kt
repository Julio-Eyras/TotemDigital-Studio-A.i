package br.com.smartchannel.playerad.util

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.view.Choreographer
import android.view.View
import br.com.smartchannel.playerad.R
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Véu opaco no root (acima do contentHost): cobre frame residual do TextureView
 * e revela o conteúdo novo — evita “flick”/ghosting entre mídias (pior em landscape).
 */
object MediaLayerTransition {

    const val PEAK_ALPHA = 1.0f
    /** Cover imediato (sem fade-in). */
    const val FADE_IN_MS = 0L
    /** Reveal curto; conteúdo já está pronto por baixo. */
    const val FADE_OUT_MS = 60L

    suspend fun cover(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        view.visibility = View.VISIBLE
        view.bringToFront()
        view.elevation = 64f
        view.alpha = PEAK_ALPHA
        view.invalidate()
        // Garante 1 frame composto opaco antes de mexer no TextureView/imagem.
        awaitFrames(view, 1)
    }

    suspend fun reveal(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        if (view.visibility != View.VISIBLE || view.alpha <= 0.02f) {
            view.alpha = 0f
            view.visibility = View.GONE
            return
        }
        // Mais um frame com conteúdo novo já visível sob o véu.
        awaitFrames(view, 1)
        animateAlpha(view, view.alpha, 0f, FADE_OUT_MS)
        view.visibility = View.GONE
    }

    fun reset(overlay: View?) {
        val view = overlay ?: return
        cancelRunning(view)
        view.alpha = 0f
        view.visibility = View.GONE
    }

    /** Espera N frames do Choreographer (composição GPU). */
    suspend fun awaitFrames(anchor: View?, count: Int) {
        if (count <= 0) return
        val view = anchor
        repeat(count) {
            suspendCancellableCoroutine { cont ->
                val choreographer = Choreographer.getInstance()
                val callback = Choreographer.FrameCallback {
                    if (cont.isActive) cont.resume(Unit)
                }
                cont.invokeOnCancellation { choreographer.removeFrameCallback(callback) }
                if (view != null) {
                    view.post {
                        choreographer.postFrameCallback(callback)
                    }
                } else {
                    choreographer.postFrameCallback(callback)
                }
            }
        }
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
