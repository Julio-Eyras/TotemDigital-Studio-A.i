package br.com.smartchannel.playerad.util

import android.app.Activity
import android.content.Context
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowManager

/**
 * Tamanho físico do framebuffer (ex.: 1280×720 na TV_BOX_3).
 *
 * [android.content.res.Resources.getDisplayMetrics] muitas vezes devolve a área
 * “útil” sem barras (ex.: 1280×672). Com isso o fallback [ViewDisplayRotation]
 * cria host 672×1280 (≠ 9:16) e o FIT de mídia 1080×1920 deixa faixas pretas.
 */
object PhysicalDisplaySize {

    data class Size(val width: Int, val height: Int)

    fun resolve(context: Context): Size {
        var width = 0
        var height = 0

        try {
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            if (wm != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val bounds = wm.maximumWindowMetrics.bounds
                    width = maxOf(width, bounds.width())
                    height = maxOf(height, bounds.height())
                } else {
                    val real = DisplayMetrics()
                    @Suppress("DEPRECATION")
                    wm.defaultDisplay.getRealMetrics(real)
                    width = maxOf(width, real.widthPixels)
                    height = maxOf(height, real.heightPixels)
                }

                val display = when {
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && context is Activity ->
                        context.display
                    else -> {
                        @Suppress("DEPRECATION")
                        wm.defaultDisplay
                    }
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    display?.mode?.let { mode ->
                        width = maxOf(width, mode.physicalWidth)
                        height = maxOf(height, mode.physicalHeight)
                    }
                }
            }
        } catch (_: Exception) {
            // fallback abaixo
        }

        val app = context.resources.displayMetrics
        width = maxOf(width, app.widthPixels)
        height = maxOf(height, app.heightPixels)

        return Size(width.coerceAtLeast(1), height.coerceAtLeast(1))
    }
}
