package br.com.smartchannel.instalaplayer

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicReference

class InstallerActivity : AppCompatActivity() {

    private lateinit var textTitle: TextView
    private lateinit var textBody: TextView
    private lateinit var textStatus: TextView
    private lateinit var progress: ProgressBar
    private lateinit var btnPrimary: Button
    private lateinit var btnSecondary: Button
    private lateinit var btnTertiary: Button

    private var changeLogos = false
    private var bootOrientation = BootOrientation.PORTRAIT
    private var orientationPicked = false
    private var applyingLogos = false
    private var busy = false
    private var waitingInstall = false
    private var finishedInstall = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_installer)
        textTitle = findViewById(R.id.textTitle)
        textBody = findViewById(R.id.textBody)
        textStatus = findViewById(R.id.textStatus)
        progress = findViewById(R.id.progress)
        btnPrimary = findViewById(R.id.btnPrimary)
        btnSecondary = findViewById(R.id.btnSecondary)
        btnTertiary = findViewById(R.id.btnTertiary)
        installCallback.set { success, message ->
            Handler(Looper.getMainLooper()).post { onPlayerInstallResult(success, message) }
        }
        restoreDraft(savedInstanceState)
        val playerPresent = PlayerPackageInstaller.isPlayerInstalled(this)
        when {
            !finishedInstall && changeLogos && orientationPicked && playerPresent -> {
                waitingInstall = false
                applyLogos()
            }
            waitingInstall && !finishedInstall -> {
                textTitle.text = "A instalar Player-AD"
                textBody.text = "A retomar após o instalador do sistema…"
                setBusy(true)
                hideTertiary()
                if (playerPresent) {
                    onPlayerInstallResult(true, "retomado")
                }
            }
            else -> showIntro()
        }
    }

    override fun onResume() {
        super.onResume()
        if (waitingInstall && !finishedInstall && PlayerPackageInstaller.isPlayerInstalled(this)) {
            waitingInstall = false
            onPlayerInstallResult(true, "instalado")
        }
    }

    override fun onDestroy() {
        if (!finishedInstall) persistDraft()
        installCallback.set(null)
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_CHANGE_LOGOS, changeLogos)
        outState.putString(STATE_ORIENTATION, bootOrientation.name)
        outState.putBoolean(STATE_ORIENTATION_PICKED, orientationPicked)
        outState.putBoolean(STATE_WAITING, waitingInstall)
        outState.putBoolean(STATE_FINISHED, finishedInstall)
        persistDraft()
    }

    private fun showIntro() {
        textTitle.text = "Instala Player TotemDigital"
        textBody.text =
            "Este assistente raiz faz duas coisas:\n\n" +
                "1. Instala/atualiza o Player-AD.\n" +
                "2. Grava os logos de boot TotemDigital no sentido que o técnico escolher " +
                "(retrato, retrato invertido ou paisagem).\n\n" +
                "Os logos oficiais vêm dentro deste APK. Root (SuperSU → Permitir) " +
                "é necessário para os logos. Sem root o player instala na mesma."
        textStatus.text = if (RootShell.suPresent()) {
            "v${BuildConfig.VERSION_NAME}  ·  root detetado"
        } else {
            "v${BuildConfig.VERSION_NAME}  ·  root não detetado"
        }
        setBusy(false)
        hideTertiary()
        btnPrimary.text = "Continuar"
        btnSecondary.text = "Só o player"
        btnPrimary.setOnClickListener {
            changeLogos = true
            persistDraft()
            showOrientationPicker()
        }
        btnSecondary.setOnClickListener {
            changeLogos = false
            persistDraft()
            startPlayerInstall()
        }
        btnPrimary.requestFocus()
    }

    private fun showOrientationPicker() {
        textTitle.text = "Posição do totem"
        textBody.text =
            "Escolha o sentido das imagens de boot conforme o totem está fixado.\n\n" +
                "• Retrato — painel em pé, topo para cima\n" +
                "• Retrato invertido — o outro sentido vertical (logo ao contrário)\n" +
                "• Paisagem — painel deitado\n\n" +
                "Se o logo ficar de cabeça para baixo no arranque, volte a correr o instalador e escolha o outro retrato."
        textStatus.text = "As imagens oficiais vêm dentro deste APK."
        setBusy(false)
        btnTertiary.visibility = View.VISIBLE
        btnPrimary.text = BootOrientation.PORTRAIT.label
        btnSecondary.text = BootOrientation.REVERSE_PORTRAIT.label
        btnTertiary.text = BootOrientation.LANDSCAPE.label
        btnPrimary.setOnClickListener { chooseOrientation(BootOrientation.PORTRAIT) }
        btnSecondary.setOnClickListener { chooseOrientation(BootOrientation.REVERSE_PORTRAIT) }
        btnTertiary.setOnClickListener { chooseOrientation(BootOrientation.LANDSCAPE) }
        btnPrimary.requestFocus()
    }

    private fun chooseOrientation(orientation: BootOrientation) {
        bootOrientation = orientation
        orientationPicked = true
        persistDraft()
        hideTertiary()
        startPlayerInstall()
    }

    private fun startPlayerInstall() {
        if (busy) return
        textTitle.text = "A instalar Player-AD"
        textBody.text =
            "Confirme a instalação no diálogo do Android (Permitir / Instalar).\n" +
                "Use o comando da TV se o diálogo aparecer por cima."
        setBusy(true)
        hideTertiary()
        textStatus.text = "A preparar o APK…"
        if (!ensureUnknownSources()) return
        try {
            val apk = PlayerPackageInstaller.extractBundledApk(this)
            textStatus.text = "A abrir o instalador do sistema…"
            waitingInstall = true
            finishedInstall = false
            persistDraft()
            PlayerPackageInstaller.startSession(this, apk)
        } catch (e: Exception) {
            showError("Não foi possível iniciar a instalação do Player-AD.\n${e.message}")
        }
    }

    private fun ensureUnknownSources(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
        if (packageManager.canRequestPackageInstalls()) return true
        textStatus.text = "Autorize «fontes desconhecidas» para este instalador e volte a Continuar."
        setBusy(false)
        hideTertiary()
        btnPrimary.text = "Abrir permissão"
        btnSecondary.text = "Tentar mesmo assim"
        btnPrimary.setOnClickListener {
            try {
                startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:$packageName"),
                    ),
                )
            } catch (_: Exception) {
                textStatus.text = "Ecrã de permissão indisponível neste OEM. Tente instalar na mesma."
            }
        }
        btnSecondary.setOnClickListener { startPlayerInstall() }
        return false
    }

    private fun onPlayerInstallResult(success: Boolean, message: String) {
        if (finishedInstall) return
        waitingInstall = false
        persistDraft()
        if (!success && !PlayerPackageInstaller.isPlayerInstalled(this)) {
            showError("Instalação do Player-AD recusada ou falhou.\n$message")
            return
        }
        if (changeLogos) {
            applyLogos()
        } else {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) { restoreKioskHome() }
                showDone("Player-AD instalado. Logos de boot não foram alterados.")
            }
        }
    }

    private fun applyLogos() {
        if (finishedInstall || applyingLogos) return
        applyingLogos = true
        textTitle.text = "A gravar logos de boot"
        textBody.text =
            "Sentido: ${bootOrientation.label}.\n" +
                "Se o SuperSU aparecer, escolha Permitir / Always.\n" +
                "Grava sempre as imagens deste sentido (substitui o logo anterior)."
        setBusy(true)
        hideTertiary()
        textStatus.text = "A pedir root…"
        lifecycleScope.launch {
            val authorized = withContext(Dispatchers.IO) { RootShell.isAuthorized(90_000L) }
            if (!authorized) {
                showDone(
                    "Player-AD instalado.\n\n" +
                        "Logos NÃO alterados: root recusado ou inexistente.\n" +
                        "Pode repetir depois ou usar os scripts ADB."
                )
                return@launch
            }
            textStatus.text = "Root OK. A gravar logos deste sentido…"
            val report = withContext(Dispatchers.IO) {
                BootLogoInstaller.apply(this@InstallerActivity, bootOrientation)
            }
            withContext(Dispatchers.IO) { restoreKioskHome() }
            val summary = report.messages.joinToString("\n")
            when {
                report.bootlogoOk && report.animationOk && !report.changedAny ->
                    showDone("Player-AD instalado. Logos TotemDigital já estavam neste sentido e foram regravados.\n\n$summary", offerReboot = true)
                report.bootlogoOk && report.animationOk ->
                    showDone("Player-AD instalado. Logos TotemDigital gravados neste sentido.\n\n$summary", offerReboot = true)
                report.bootlogoOk || report.animationOk ->
                    showDone("Player-AD instalado. Logos parciais:\n\n$summary", offerReboot = report.changedAny)
                else ->
                    showDone("Player-AD instalado. Logos não gravados:\n\n$summary")
            }
        }
    }

    private fun restoreKioskHome() {
        val pkg = PlayerPackageInstaller.PLAYER_PACKAGE
        RootShell.exec(
            "cmd package enable $pkg/.ui.PlayerHomeAlias; " +
                "cmd package set-home-activity --user 0 $pkg/.ui.MainActivity; " +
                "cmd package set-home-activity $pkg/.ui.MainActivity; " +
                "cmd role add-role-holder --user 0 android.app.role.HOME $pkg",
            15_000L,
        )
    }

    private fun persistDraft() {
        InstallerDraft.save(
            this,
            changeLogos,
            bootOrientation,
            orientationPicked,
            waitingInstall,
            finishedInstall,
        )
    }

    private fun restoreDraft(savedInstanceState: Bundle?) {
        if (savedInstanceState != null) {
            changeLogos = savedInstanceState.getBoolean(STATE_CHANGE_LOGOS, false)
            waitingInstall = savedInstanceState.getBoolean(STATE_WAITING, false)
            finishedInstall = savedInstanceState.getBoolean(STATE_FINISHED, false)
            orientationPicked = savedInstanceState.getBoolean(STATE_ORIENTATION_PICKED, false)
            val name = savedInstanceState.getString(STATE_ORIENTATION)
            bootOrientation = BootOrientation.entries.firstOrNull { it.name == name }
                ?: BootOrientation.PORTRAIT
            persistDraft()
            return
        }
        val draft = InstallerDraft.load(this)
        changeLogos = draft.changeLogos
        bootOrientation = draft.orientation
        orientationPicked = draft.orientationPicked
        waitingInstall = draft.waitingInstall
        finishedInstall = draft.finishedInstall
    }

    private fun showDone(message: String, offerReboot: Boolean = false) {
        waitingInstall = false
        finishedInstall = true
        applyingLogos = false
        InstallerDraft.clear(this)
        textTitle.text = "Concluído"
        textBody.text = message
        textStatus.text = if (PlayerPackageInstaller.isPlayerInstalled(this)) {
            "Pacote ${PlayerPackageInstaller.PLAYER_PACKAGE} presente."
        } else {
            "Player-AD não aparece ainda — reinicie a TV se necessário."
        }
        setBusy(false)
        hideTertiary()
        btnPrimary.text = "Abrir Player-AD"
        btnSecondary.text = if (offerReboot) "Reiniciar a TV" else "Sair"
        btnPrimary.setOnClickListener { launchPlayer() }
        btnSecondary.setOnClickListener {
            if (offerReboot) rebootDevice() else finish()
        }
        btnPrimary.requestFocus()
    }

    private fun showError(message: String) {
        waitingInstall = false
        finishedInstall = true
        applyingLogos = false
        InstallerDraft.clear(this)
        textTitle.text = "Falhou"
        textBody.text = message
        textStatus.text = "Pode tentar de novo."
        setBusy(false)
        hideTertiary()
        btnPrimary.text = "Tentar de novo"
        btnSecondary.text = "Sair"
        btnPrimary.setOnClickListener { showIntro() }
        btnSecondary.setOnClickListener { finish() }
        btnPrimary.requestFocus()
    }

    private fun launchPlayer() {
        val launch = packageManager.getLaunchIntentForPackage(PlayerPackageInstaller.PLAYER_PACKAGE)
        if (launch != null) {
            startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } else {
            textStatus.text = "Player-AD instalado mas sem launcher visível. Reinicie a TV."
        }
    }

    private fun rebootDevice() {
        textStatus.text = "A reiniciar…"
        lifecycleScope.launch {
            val r = withContext(Dispatchers.IO) { RootShell.exec("reboot", 8_000L) }
            if (!r.ok) {
                textStatus.text = "Não foi possível reiniciar por root. Desligue e ligue a TV."
            }
        }
    }

    private fun hideTertiary() {
        btnTertiary.visibility = View.GONE
        btnTertiary.setOnClickListener(null)
    }

    private fun setBusy(value: Boolean) {
        busy = value
        progress.visibility = if (value) View.VISIBLE else View.GONE
        btnPrimary.isEnabled = !value
        btnSecondary.isEnabled = !value
        btnTertiary.isEnabled = !value
    }

    companion object {
        private const val STATE_CHANGE_LOGOS = "changeLogos"
        private const val STATE_ORIENTATION = "bootOrientation"
        private const val STATE_ORIENTATION_PICKED = "orientationPicked"
        private const val STATE_WAITING = "waitingInstall"
        private const val STATE_FINISHED = "finishedInstall"
        private val installCallback = AtomicReference<((Boolean, String) -> Unit)?>(null)

        fun onInstallFinished(success: Boolean, message: String) {
            installCallback.get()?.invoke(success, message)
        }
    }
}
