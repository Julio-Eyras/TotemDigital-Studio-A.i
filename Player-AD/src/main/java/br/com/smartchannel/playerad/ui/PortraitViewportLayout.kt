package br.com.smartchannel.playerad.ui

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout
import br.com.smartchannel.playerad.util.PlayerAdLogger

/**
 * Viewport 9:16 (portrait) centrado, ou canvas lógico completo quando o SO já roda portrait.
 */
class PortraitViewportLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private var lastLoggedMode: String? = null

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val parentW = MeasureSpec.getSize(widthMeasureSpec)
        val parentH = MeasureSpec.getSize(heightMeasureSpec)
        val viewport = PortraitViewportMetrics.resolveFromConfig(context)

        var targetW = viewport.width
        var targetH = viewport.height

        if (parentW > 0 && parentH > 0) {
            targetW = targetW.coerceAtMost(parentW)
            targetH = targetH.coerceAtMost(parentH)
        }

        if (lastLoggedMode != viewport.mode) {
            lastLoggedMode = viewport.mode
            PlayerAdLogger.i(
                "DISPLAY",
                "PortraitViewport mode=${viewport.mode} size=${targetW}x${targetH} parent=${parentW}x${parentH}"
            )
        }

        super.onMeasure(
            MeasureSpec.makeMeasureSpec(targetW, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(targetH, MeasureSpec.EXACTLY)
        )
    }
}
