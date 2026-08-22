package br.com.smartchannel.playerad.util

import android.app.Activity
import android.content.res.Configuration
import android.view.View
import android.view.ViewGroup

/**
 * Fallback quando `user_rotation` não altera o framebuffer (TV_BOX_3 / Android 14).
 * Gira o [contentHost] para a montagem pedida e **centra** no ecrã (evita mídia na metade de baixo).
 *
 * Usa [PhysicalDisplaySize] (ex. 1280×720) — não os DisplayMetrics “úteis” (ex. 1280×672) —
 * para o host em retrato ser 720×1280 (9:16) e mídia 1080×1920 preencher sem faixas.
 */
object ViewDisplayRotation {

    private var lastRootIdentity: Int = 0
    private var lastSignature: String? = null

    /** Força reaplicar no próximo [apply] (ex.: após edge-to-edge). */
    fun invalidateCache() {
        lastSignature = null
        lastRootIdentity = 0
    }

    fun apply(activity: Activity, root: View?, displayRotation: Int, enabled: Boolean) {
        val target = root ?: return
        val rootId = System.identityHashCode(target)
        if (!enabled) {
            if (lastRootIdentity != rootId || lastSignature != "off") {
                reset(target)
                lastRootIdentity = rootId
                lastSignature = "off"
            }
            return
        }
        val normalized = ((displayRotation % 4) + 4) % 4
        if (normalized == 1) {
            // Paisagem nativa — sem compensação visual
            if (lastRootIdentity != rootId || lastSignature != "off") {
                reset(target)
                lastRootIdentity = rootId
                lastSignature = "off"
            }
            return
        }

        val physical = PhysicalDisplaySize.resolve(activity)
        val screenW = physical.width
        val screenH = physical.height
        if (screenW <= 0 || screenH <= 0) return

        val signature = "$normalized|$screenW|$screenH"
        if (lastRootIdentity == rootId && lastSignature == signature) {
            return
        }

        target.post {
            val physical2 = PhysicalDisplaySize.resolve(activity)
            val appDm = activity.resources.displayMetrics
            // Preferir físico 1280×720; se o SO reportar só 672, ainda usamos 720 para 9:16,
            // mas expandimos o root para o mesmo canvas — evita host “fora” da janela (ecrã preto).
            val w2 = maxOf(physical2.width, appDm.widthPixels)
            val h2 = maxOf(physical2.height, appDm.heightPixels)
            if (w2 <= 0 || h2 <= 0) return@post
            val sig2 = "$normalized|$w2|$h2"
            if (lastRootIdentity == System.identityHashCode(target) && lastSignature == sig2) return@post

            expandAncestorCanvas(target, w2, h2)

            // TV portrait física + framebuffer landscape (Allwinner): 270° em mount 0
            // deixa o conteúdo em pé; 90° ficava de cabeça para baixo no painel Panasonic.
            when (normalized) {
                0 -> applyQuarterTurn(target, 270f, w2, h2)
                2 -> applyHalfTurn(target, w2, h2)
                else -> applyQuarterTurn(target, 90f, w2, h2)
            }
            lastRootIdentity = System.identityHashCode(target)
            lastSignature = sig2
            PlayerAdLogger.i(
                "DISPLAY",
                "Viewport físico ${w2}x${h2} (appMetrics=${appDm.widthPixels}x${appDm.heightPixels})",
            )
        }
    }

    /**
     * 90°/270°: filho com dimensões trocadas (portrait lógico), pivot no centro do filho,
     * depois centrado no framebuffer landscape — corrige o “tudo preto em cima”.
     */
    private fun applyQuarterTurn(target: View, degrees: Float, screenW: Int, screenH: Int) {
        resizeRoot(target, screenH, screenW)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else screenH
            val vh = if (target.height > 0) target.height else screenW
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = degrees
            target.translationX = (screenW - vw) / 2f
            target.translationY = (screenH - vh) / 2f
            PlayerAdLogger.i(
                "KIOSK",
                "Fallback visual aplicado: viewRot=${degrees.toInt()}° " +
                    "screen=${screenW}x${screenH} host=${vw}x${vh} " +
                    "tx=${target.translationX.toInt()} ty=${target.translationY.toInt()}",
            )
        }
    }

    private fun applyHalfTurn(target: View, screenW: Int, screenH: Int) {
        resizeRoot(target, screenW, screenH)
        target.requestLayout()
        target.post {
            val vw = if (target.width > 0) target.width else screenW
            val vh = if (target.height > 0) target.height else screenH
            target.pivotX = vw / 2f
            target.pivotY = vh / 2f
            target.rotation = 180f
            target.translationX = 0f
            target.translationY = 0f
            PlayerAdLogger.i(
                "KIOSK",
                "Fallback visual aplicado: viewRot=180° " +
                    "screen=${screenW}x${screenH} host=${vw}x${vh}",
            )
        }
    }

    fun isConfigurationOrientationMatch(displayRotation: Int, orientation: Int): Boolean {
        val normalized = ((displayRotation % 4) + 4) % 4
        return when (normalized) {
            1, 3 -> orientation == Configuration.ORIENTATION_LANDSCAPE
            else -> orientation == Configuration.ORIENTATION_PORTRAIT
        }
    }

    private fun reset(target: View) {
        target.rotation = 0f
        target.translationX = 0f
        target.translationY = 0f
        target.pivotX = 0f
        target.pivotY = 0f
        val lp = target.layoutParams ?: return
        lp.width = ViewGroup.LayoutParams.MATCH_PARENT
        lp.height = ViewGroup.LayoutParams.MATCH_PARENT
        target.layoutParams = lp
    }

    private fun resizeRoot(target: View, width: Int, height: Int) {
        val lp = target.layoutParams ?: ViewGroup.LayoutParams(width, height)
        lp.width = width
        lp.height = height
        target.layoutParams = lp
    }

    /** Garante que o root acompanha o framebuffer físico (ex. 1280×720). */
    private fun expandAncestorCanvas(target: View, width: Int, height: Int) {
        val root = (target.parent as? ViewGroup) ?: return
        root.clipChildren = false
        root.clipToPadding = false
        resizeRoot(root, width, height)
        (root.parent as? ViewGroup)?.let { grand ->
            grand.clipChildren = false
            grand.clipToPadding = false
        }
    }
}
