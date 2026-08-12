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

    private var changeLogos = false
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
        installCallback.set { success, message ->
            Handler(Looper.getMainLooper()).post { onPlayerInstallResult(success, message) }
        }
        showIntro()
    }

    override fun onResume() {
        super.onResume()
        if (waitingInstall && !finishedInstall && PlayerPackageInstaller.isPlayerInstalled(this)) {
            waitingInstall = false
            onPlayerInstallResult(true, "instalado")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        installCallback.set(null)
    }

    private fun showIntro() {
        textTitle.text = "Instala Player TotemDigital"
        textBody.text =
            "Este assistente instala o Player-AD nesta TV Box.\n\n" +
                "De seguida pergunta se deseja trocar os dois logos de arranque " +
                "(Android e MBox) pelo TotemDigital.\n\n" +
                "Logos exigem root (SuperSU → Permitir). Sem root o player instala na mesma."
        textStatus.text = "v${BuildConfig.VERSION_NAME}  ·  Player-AD empacotado"
        setBusy(false)
        btnPrimary.text = "Continuar"
        btnSecondary.text = "Sair"
        btnPrimary.setOnClickListener { showAskLogos() }
        btnSecondary.setOnClickListener { finish() }
        btnPrimary.requestFocus()
    }

    private fun showAskLogos() {
        textTitle.text = "Logos de arranque"
        textBody.text =
            "Deseja alterar os logos de boot?\n\n" +
                "• Logo Android (1.º ecrã, bootloader)\n" +
                "• Logo MBox (2.º ecrã, animação Android)\n\n" +
                "Escolha Não se esta box não tiver root, ou se quiser só o player."
        textStatus.text = if (RootShell.suPresent()) {
            "Root (su) detetado neste aparelho."
        } else {
            "Root não detetado — a opção Sim pode falhar nos logos."
        }
        setBusy(false)
        btnPrimary.text = "Sim, alterar logos"
        btnSecondary.text = "Não, só o player"
        btnPrimary.setOnClickListener {
            changeLogos = true
            startPlayerInstall()
        }
        btnSecondary.setOnClickListener {
            changeLogos = false
            startPlayerInstall()
        }
        btnPrimary.requestFocus()
    }

    private fun startPlayerInstall() {
        if (busy) return
        textTitle.text = "A instalar Player-AD"
        textBody.text =
            "Confirme a instalação no diálogo do Android (Permitir / Instalar).\n" +
                "Use o comando da TV se o diálogo aparecer por cima."
        setBusy(true)
        textStatus.text = "A preparar o APK…"
        if (!ensureUnknownSources()) return
        try {
            val apk = PlayerPackageInstaller.extractBundledApk(this)
            textStatus.text = "A abrir o instalador do sistema…"
            waitingInstall = true
            finishedInstall = false
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
        finishedInstall = true
        waitingInstall = false
        if (!success && !PlayerPackageInstaller.isPlayerInstalled(this)) {
            showError("Instalação do Player-AD recusada ou falhou.\n$message")
            return
        }
        if (changeLogos) {
            applyLogos()
        } else {
            showDone("Player-AD instalado. Logos de boot não foram alterados.")
        }
    }

    private fun applyLogos() {
        textTitle.text = "A alterar logos de boot"
        textBody.text =
            "Se o SuperSU aparecer, escolha Permitir / Always.\n" +
                "Isto grava o logo do bootloader e a animação Android."
        setBusy(true)
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
            textStatus.text = "Root OK. A gravar logos…"
            val report = withContext(Dispatchers.IO) { BootLogoInstaller.apply(this@InstallerActivity) }
            val summary = report.messages.joinToString("\n")
            when {
                report.bootlogoOk && report.animationOk ->
                    showDone("Player-AD e logos TotemDigital instalados.\n\n$summary", offerReboot = true)
                report.bootlogoOk || report.animationOk ->
                    showDone("Player-AD instalado. Logos parciais:\n\n$summary", offerReboot = true)
                else ->
                    showDone("Player-AD instalado. Logos não gravados:\n\n$summary")
            }
        }
    }

    private fun showDone(message: String, offerReboot: Boolean = false) {
        textTitle.text = "Concluído"
        textBody.text = message
        textStatus.text = if (PlayerPackageInstaller.isPlayerInstalled(this)) {
            "Pacote ${PlayerPackageInstaller.PLAYER_PACKAGE} presente."
        } else {
            "Player-AD não aparece ainda — reinicie a TV se necessário."
        }
        setBusy(false)
        btnPrimary.text = "Abrir Player-AD"
        btnSecondary.text = if (offerReboot) "Reiniciar a TV" else "Sair"
        btnPrimary.setOnClickListener { launchPlayer() }
        btnSecondary.setOnClickListener {
            if (offerReboot) rebootDevice() else finish()
        }
        btnPrimary.requestFocus()
    }

    private fun showError(message: String) {
        textTitle.text = "Falhou"
        textBody.text = message
        textStatus.text = "Pode tentar de novo."
        setBusy(false)
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

    private fun setBusy(value: Boolean) {
        busy = value
        progress.visibility = if (value) View.VISIBLE else View.GONE
        btnPrimary.isEnabled = !value
        btnSecondary.isEnabled = !value
    }

    companion object {
        private val installCallback = AtomicReference<((Boolean, String) -> Unit)?>(null)

        fun onInstallFinished(success: Boolean, message: String) {
            installCallback.get()?.invoke(success, message)
        }
    }
}
