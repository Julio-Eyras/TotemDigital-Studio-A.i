package br.com.smartchannel.playerad.ui

import android.content.Context
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.SystemDisplayRotation
import kotlin.math.roundToInt

/**
 * Calcula o retângulo disponível para o viewport 9:16.
 *
 * Em TV boxes com `user_rotation=1`, [android.util.DisplayMetrics] continua landscape (ex.: 1280×672)
 * mas o framebuffer já é exibido em portrait físico. Neste caso o canvas lógico inteiro mapeia para
 * ~9:16 no painel — não devemos letterboxar para 378×672 dentro do buffer landscape.
 */
object PortraitViewportMetrics {

    data class ViewportSize(val width: Int, val height: Int, val mode: String)

    fun resolve(context: Context, displayRotation: Int): ViewportSize {
        val metrics = context.resources.displayMetrics
        val maxW = metrics.widthPixels.coerceAtLeast(1)
        val maxH = metrics.heightPixels.coerceAtLeast(1)
        val normalized = ((displayRotation % 4) + 4) % 4
        val portraitMount = normalized == 0 || normalized == 2

        if (portraitMount && maxW > maxH && SystemDisplayRotation.isUserRotationAligned(context, displayRotation)) {
            return ViewportSize(maxW, maxH, "full_logical_canvas")
        }

        val aspectW = 9f
        val aspectH = 16f
        val maxRatio = maxW.toFloat() / maxH.toFloat()
        val targetRatio = aspectW / aspectH

        return if (maxRatio > targetRatio) {
            val h = maxH
            val w = (maxH * targetRatio).roundToInt()
            ViewportSize(w, h, "letterbox_width")
        } else {
            val w = maxW
            val h = (maxW / targetRatio).roundToInt()
            ViewportSize(w, h, "letterbox_height")
        }
    }

    fun resolveFromConfig(context: Context): ViewportSize {
        return try {
            val rotation = PlayerConfigLoader(context).load().displayRotation
            resolve(context, rotation)
        } catch (_: Exception) {
            resolve(context, 0)
        }
    }
}
