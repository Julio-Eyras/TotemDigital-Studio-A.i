package br.com.smartchannel.playerad.ui

import android.app.Activity
import android.view.View
import br.com.smartchannel.playerad.R
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.DisplayCanvas
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.SystemDisplayRotation
import br.com.smartchannel.playerad.util.ViewDisplayRotation

/**
 * Aplica montagem física do painel (SO + fallback visual) e regista métricas de ecrã.
 */
object DisplayPresentationController {

    fun apply(activity: Activity, config: PlayerConfig) {
        val playbackHost = activity.findViewById<View>(R.id.contentHost)
        val configHost = activity.findViewById<View>(R.id.configContentHost)

        if (playbackHost == null && configHost != null) {
            if (!SystemDisplayRotation.isUserRotationAligned(activity, config.displayRotation)) {
                SystemDisplayRotation.apply(activity, config.displayRotation)
            }
            ConfigOrientationPreview.apply(activity, configHost, config.displayRotation)
            return
        }

        if (playbackHost == null) {
            if (!SystemDisplayRotation.isUserRotationAligned(activity, config.displayRotation)) {
                SystemDisplayRotation.apply(activity, config.displayRotation)
            }
            return
        }

        val alreadyAligned = SystemDisplayRotation.isUserRotationAligned(activity, config.displayRotation)
        val systemResult = if (alreadyAligned) {
            SystemDisplayRotation.ApplyResult(
                userRotation = PlayerConfigLoader.displayRotationToUserRotation(config.displayRotation),
                rotationApplied = true,
                settingsWritten = false,
                displayEffective = true,
                accelerometerLocked = true
            )
        } else {
            SystemDisplayRotation.apply(activity, config.displayRotation)
        }
        val needsVisualFallback = !systemResult.displayEffective &&
            !SystemDisplayRotation.isUserRotationAligned(activity, config.displayRotation)
        ViewDisplayRotation.apply(
            activity = activity,
            root = playbackHost,
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
        val canvas = DisplayCanvas.resolve(activity, config.displayRotation)
        val mode = PlayerConfigLoader.displayRotationLabel(config.displayRotation)
        PlayerAdLogger.i(
            "DISPLAY",
            buildString {
                append("canvas=")
                append(canvas.width)
                append('x')
                append(canvas.height)
                append(" mount=")
                append(config.displayRotation)
                append(" (")
                append(mode)
                append(") dpi=")
                append(canvas.densityDpi)
                append(" | systemRotation=")
                append(if (systemEffective) "effective" else "ineffective")
                if (!systemEffective && SystemDisplayRotation.isUserRotationAligned(activity, config.displayRotation)) {
                    append(" | userRotation=aligned")
                }
                if (canvas.needsSurfaceCompensation) append(" | surfaceComp=suspended")
                if (visualFallback) append(" | visualFallback=on")
            },
        )
    }
}
