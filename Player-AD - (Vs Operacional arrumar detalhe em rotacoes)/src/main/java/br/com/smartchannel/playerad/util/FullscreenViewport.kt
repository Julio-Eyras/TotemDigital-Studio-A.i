package br.com.smartchannel.playerad.util

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.media3.ui.PlayerView

/**
 * Garante content frame do ExoPlayer em MATCH_PARENT (viewport = ecrã inteiro).
 * Chamada pontual — sem listeners (auto-rotação continua suspensa).
 */
object FullscreenViewport {

    fun applyToPlayerView(playerView: PlayerView) {
        val frame = playerView.findViewById<View>(androidx.media3.ui.R.id.exo_content_frame) ?: return
        val lp = frame.layoutParams as? FrameLayout.LayoutParams
            ?: FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER,
            )
        if (lp.width == ViewGroup.LayoutParams.MATCH_PARENT &&
            lp.height == ViewGroup.LayoutParams.MATCH_PARENT
        ) {
            return
        }
        lp.width = ViewGroup.LayoutParams.MATCH_PARENT
        lp.height = ViewGroup.LayoutParams.MATCH_PARENT
        lp.gravity = Gravity.CENTER
        frame.layoutParams = lp
    }
}
