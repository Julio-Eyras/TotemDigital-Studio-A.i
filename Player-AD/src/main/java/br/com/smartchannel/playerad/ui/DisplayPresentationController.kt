package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.util.DisplayMetrics
import android.view.View
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.SystemDisplayRotation
import br.com.smartchannel.playerad.util.ViewDisplayRotation

/**
 * Aplica montagem física do painel (SO + fallback visual) e regista métricas de ecrã.
 */
object DisplayPresentationController {

    fun apply(activity: Activity, config: PlayerConfig) {
        val contentHost = activity.findViewById<View>(R.id.contentHost) ?: activity.findViewById(R.id.root)

        val systemResult = SystemDisplayRotation.apply(activity, config.displayRotation)
        val needsVisualFallback = !systemResult.displayEffective
        ViewDisplayRotation.apply(
            activity = activity,
            root = contentHost,
            displayRotation = config.displayRotation,
            enabled = needsVisualFallback
        )

        logPresentationState(activity, config, systemResult.displayEffective, needsVisualFallback)
    }

    private fun logPresentationState(
        activity: Activity,
        config: PlayerConfig,
        systemEffective: Boolean,
        visualFallback: Boolean
    ) {
        val metrics: DisplayMetrics = activity.resources.displayMetrics
        val mode = PlayerConfigLoader.displayRotationLabel(config.displayRotation)
        PlayerAdLogger.i(
            "DISPLAY",
            buildString {
                append("viewport=9:16 | mount=")
                append(config.displayRotation)
                append(" (")
                append(mode)
                append(") | panel=")
                append(metrics.widthPixels)
                append('x')
                append(metrics.heightPixels)
                append(" dpi=")
                append(metrics.densityDpi)
                append(" | systemRotation=")
                append(if (systemEffective) "effective" else "ineffective")
                if (visualFallback) append(" | visualFallback=on")
            }
        )
    }
}
