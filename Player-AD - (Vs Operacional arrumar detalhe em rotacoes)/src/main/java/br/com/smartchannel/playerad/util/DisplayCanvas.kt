package br.com.smartchannel.playerad.util

import android.content.Context
import android.util.DisplayMetrics
import br.com.smartchannel.playerad.config.PlayerConfigLoader

/**
 * Canvas = DisplayMetrics do painel (viewport fullscreen, sem compensação de rotação).
 */
object DisplayCanvas {

    data class Metrics(
        val width: Int,
        val height: Int,
        val densityDpi: Int,
        val displayRotation: Int,
        val needsSurfaceCompensation: Boolean,
    )

    fun resolve(context: Context, displayRotation: Int): Metrics {
        val metrics: DisplayMetrics = context.resources.displayMetrics
        val w = metrics.widthPixels.coerceAtLeast(1)
        val h = metrics.heightPixels.coerceAtLeast(1)
        return Metrics(w, h, metrics.densityDpi, displayRotation, needsSurfaceCompensation = false)
    }

    fun resolveFromConfig(context: Context): Metrics {
        return try {
            resolve(context, PlayerConfigLoader(context).load().displayRotation)
        } catch (_: Exception) {
            resolve(context, 0)
        }
    }
}
