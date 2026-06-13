package br.com.smartchannel.playerad.util

import android.content.Context
import android.provider.Settings
import java.io.File

/**
 * Diagnóstico somente leitura: root, rotação do SO e dicas de provisionamento ADB.
 * O app não altera firmware nem tenta obter root persistente.
 */
object DeviceProvisioningDiagnostics {

    /** Rotação portrait típica em painel landscape (90°). Alinhado a install-player-adb.ps1. */
    const val EXPECTED_USER_ROTATION_PORTRAIT = 1

    data class Report(
        val rootSuAvailable: Boolean,
        val userRotation: Int?,
        val accelerometerRotation: Int?,
        val hwRotation: String?,
        val persistHwRotation: String?,
        val portraitSystemOk: Boolean,
        val bootAnimationPath: String?,
        val model: String,
        val device: String
    )

    fun scan(context: Context, expectedUserRotation: Int = EXPECTED_USER_ROTATION_PORTRAIT): Report {
        val userRot = readSystemInt(context, Settings.System.USER_ROTATION)
        val accelRot = readSystemInt(context, Settings.System.ACCELEROMETER_ROTATION)
        val portraitOk = userRot == expectedUserRotation && accelRot == 0

        return Report(
            rootSuAvailable = detectSuAvailable(),
            userRotation = userRot,
            accelerometerRotation = accelRot,
            hwRotation = readSystemProperty("ro.sf.hwrotation"),
            persistHwRotation = readSystemProperty("persist.sys.hwrotation"),
            portraitSystemOk = portraitOk,
            bootAnimationPath = findBootAnimationPath(),
            model = readSystemProperty("ro.product.model"),
            device = readSystemProperty("ro.product.device")
        )
    }

    fun formatDebugText(report: Report, expectedUserRotation: Int = EXPECTED_USER_ROTATION_PORTRAIT): String {
        val rootLine = if (report.rootSuAvailable) {
            "Root (su): disponível — logo boot /system pode ser alterável"
        } else {
            "Root (su): não disponível (normal em produção)"
        }

        val userRotText = report.userRotation?.toString() ?: "?"
        val accelText = report.accelerometerRotation?.toString() ?: "?"
        val portraitLine = if (report.portraitSystemOk) {
            "Portrait no SO: OK (user_rotation=$userRotText, rotação automática desligada)"
        } else {
            "Portrait no SO: pendente — rode install-player-adb.ps1 no PC com USB/ADB"
        }

        val bootLine = report.bootAnimationPath?.let { path ->
            if (report.rootSuAvailable) {
                "Logo boot: $path (substituição possível com root)"
            } else {
                "Logo boot: $path (troca exige root ou firmware OEM)"
            }
        } ?: "Logo boot: caminho padrão não encontrado (pode estar em partição OEM)"

        val hwLine = buildString {
            if (!report.hwRotation.isNullOrBlank()) append("ro.sf.hwrotation=${report.hwRotation} ")
            if (!report.persistHwRotation.isNullOrBlank()) append("persist.sys.hwrotation=${report.persistHwRotation}")
        }.trim()

        return buildString {
            appendLine("=== Provisionamento Android (somente leitura) ===")
            appendLine("Dispositivo: ${report.model.ifBlank { "?" }} (${report.device.ifBlank { "?" }})")
            appendLine(rootLine)
            appendLine("user_rotation: $userRotText (esperado $expectedUserRotation para portrait 9:16)")
            appendLine("accelerometer_rotation: $accelText (0 = fixo)")
            if (hwLine.isNotBlank()) appendLine(hwLine)
            appendLine(portraitLine)
            appendLine(bootLine)
            appendLine()
            append("Provisionamento completo (portrait + launcher + config): ")
            appendLine("Player-AD\\scripts\\install-player-adb.ps1")
            append("Diagnóstico detalhado no PC: Player-AD\\scripts\\diagnose-android-box.ps1")
        }
    }

    private fun readSystemInt(context: Context, key: String): Int? {
        return try {
            Settings.System.getInt(context.contentResolver, key)
        } catch (_: Settings.SettingNotFoundException) {
            null
        } catch (_: Exception) {
            null
        }
    }

    private fun readSystemProperty(name: String): String {
        return try {
            val clazz = Class.forName("android.os.SystemProperties")
            val get = clazz.getMethod("get", String::class.java, String::class.java)
            (get.invoke(null, name, "") as? String).orEmpty().trim()
        } catch (_: Exception) {
            ""
        }
    }

    private fun findBootAnimationPath(): String? {
        val candidates = listOf(
            "/system/media/bootanimation.zip",
            "/vendor/media/bootanimation.zip",
            "/oem/media/bootanimation.zip"
        )
        return candidates.firstOrNull { File(it).exists() }
    }

    /** Verifica binário su e teste rápido (timeout); não mantém sessão root. */
    private fun detectSuAvailable(): Boolean {
        val suPaths = listOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/vendor/bin/su"
        )
        if (suPaths.none { File(it).exists() }) return false
        return try {
            val proc = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
            val waiter = Thread { proc.waitFor() }
            waiter.start()
            waiter.join(2000)
            if (waiter.isAlive) {
                proc.destroy()
                return false
            }
            proc.inputStream.bufferedReader().readText().contains("uid=0")
        } catch (_: Exception) {
            false
        }
    }
}
