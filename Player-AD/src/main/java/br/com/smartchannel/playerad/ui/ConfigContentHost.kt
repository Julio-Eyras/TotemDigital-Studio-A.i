package br.com.smartchannel.playerad.ui

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout

/**
 * Container do formulário que recebe rotação de preview.
 * clipChildren=false evita cortar conteúdo durante transformações.
 */
class ConfigContentHost @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    init {
        clipChildren = false
        clipToPadding = false
    }
}
