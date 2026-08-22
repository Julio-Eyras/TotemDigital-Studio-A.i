package br.com.smartchannel.playerad.util

import android.content.Context
import br.com.smartchannel.playerad.config.PlayerConfigLoader

/**
 * Canvas = tamanho físico do painel (viewport fullscreen).
 * Preferir [PhysicalDisplaySize] em vez de DisplayMetrics “úteis” (sem barras).
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
        val physical = PhysicalDisplaySize.resolve(context)
        return Metrics(
            physical.width,
            physical.height,
            context.resources.displayMetrics.densityDpi,
            displayRotation,
            needsSurfaceCompensation = false,
        )
    }

    fun resolveFromConfig(context: Context): Metrics {
        return try {
            resolve(context, PlayerConfigLoader(context).load().displayRotation)
        } catch (_: Exception) {
            resolve(context, 0)
        }
    }
}
