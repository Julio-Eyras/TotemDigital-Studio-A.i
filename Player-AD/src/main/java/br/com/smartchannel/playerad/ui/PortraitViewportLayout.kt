package br.com.smartchannel.playerad.ui

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout
import kotlin.math.roundToInt

/**
 * Viewport fixo 9:16 (portrait) centrado no espaço disponível.
 * Todo o conteúdo (vídeo, imagem, HTML) é renderizado dentro desta área.
 */
class PortraitViewportLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    /** Largura / altura em portrait (9:16). */
    private val aspectWidth = 9f
    private val aspectHeight = 16f

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val maxW = MeasureSpec.getSize(widthMeasureSpec)
        val maxH = MeasureSpec.getSize(heightMeasureSpec)
        if (maxW <= 0 || maxH <= 0) {
            super.onMeasure(widthMeasureSpec, heightMeasureSpec)
            return
        }

        val maxRatio = maxW.toFloat() / maxH.toFloat()
        val targetRatio = aspectWidth / aspectHeight

        val targetW: Int
        val targetH: Int
        if (maxRatio > targetRatio) {
            targetH = maxH
            targetW = (maxH * targetRatio).roundToInt()
        } else {
            targetW = maxW
            targetH = (maxW / targetRatio).roundToInt()
        }

        super.onMeasure(
            MeasureSpec.makeMeasureSpec(targetW, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(targetH, MeasureSpec.EXACTLY)
        )
    }
}
