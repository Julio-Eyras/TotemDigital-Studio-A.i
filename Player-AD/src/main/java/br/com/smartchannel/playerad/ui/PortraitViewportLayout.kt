package br.com.smartchannel.playerad.ui

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout
import br.com.smartchannel.playerad.util.DisplayCanvas
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Viewport de mídia = **100%** da área útil do ecrã (largura × altura do painel).
 * Sem auto-rotação — só garante measure EXACTLY em fullscreen.
 */
class PortraitViewportLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    private var lastLoggedSize: String? = null

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec).coerceAtLeast(1)
        val h = MeasureSpec.getSize(heightMeasureSpec).coerceAtLeast(1)
        logOnce(w, h)
        super.onMeasure(
            MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY),
        )
    }

    private fun logOnce(w: Int, h: Int) {
        val canvas = DisplayCanvas.resolveFromConfig(context)
        val key = "${canvas.width}x${canvas.height}:$w:$h"
        if (lastLoggedSize == key) return
        lastLoggedSize = key
        PlayerAdLogger.i(
            "DISPLAY",
            "Viewport fullscreen ${w}x${h} (canvas=${canvas.width}x${canvas.height})",
        )
    }
}
