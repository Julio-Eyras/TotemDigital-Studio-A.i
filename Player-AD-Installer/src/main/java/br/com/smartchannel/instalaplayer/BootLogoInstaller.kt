package br.com.smartchannel.instalaplayer

import android.content.Context
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object BootLogoInstaller {
    private const val BOOTLOADER_PART = "/dev/block/mmcblk0p2"
    private const val MOUNT = "/mnt/bootlogo"
    private const val ANIM_SYSTEM = "/system/media/bootanimation.zip"
    private const val ANIM_VENDOR = "/vendor/media/bootanimation.zip"
    private const val SD_DIR = "/sdcard/smartsignage"
    private const val ASSET_BMP = "totemdigital.bmp"
    private const val ASSET_BMP_PORTRAIT = "totemdigital-portrait.bmp"
    private const val ASSET_BMP_REVERSE = "totemdigital-portrait-reverse.bmp"
    private const val ASSET_BMP_LANDSCAPE = "totemdigital-landscape.bmp"
    private const val ASSET_ANIM_PORTRAIT = "bootanimation-portrait.zip"
    private const val ASSET_ANIM_REVERSE = "bootanimation-portrait-reverse.zip"
    private const val ASSET_ANIM_LANDSCAPE = "bootanimation-landscape.zip"

    data class Report(
        val bootlogoOk: Boolean,
        val animationOk: Boolean,
        val logoChanged: Boolean,
        val animationChanged: Boolean,
        val messages: List<String>,
    ) {
        val changedAny: Boolean get() = logoChanged || animationChanged
    }

    fun apply(context: Context, orientation: BootOrientation): Report {
        val messages = mutableListOf<String>()
        val work = File(context.cacheDir, "boot-branding").apply {
            deleteRecursively()
            mkdirs()
        }
        val bmpAsset = bmpAssetFor(context, orientation)
        val animAsset = animAssetFor(context, orientation)
            ?: return Report(false, false, false, false, messages + "bootanimation.zip em falta no APK.")
        val bmp = extractAsset(context, bmpAsset, File(work, "totemdigital.bmp"))
            ?: return Report(false, false, false, false, messages + "$bmpAsset em falta no APK.")
        val zip = extractAsset(context, animAsset, File(work, "bootanimation.zip"))
            ?: return Report(false, false, false, false, messages + "$animAsset em falta no APK.")

        val wantLogo = sha256(bmp)
        val wantAnim = sha256(zip)
        messages += "Sentido escolhido: ${orientation.label}."
        messages += when (orientation) {
            BootOrientation.LANDSCAPE -> "Bootanimation paisagem (1920x1080)."
            BootOrientation.PORTRAIT -> "Bootanimation retrato (1080x1920)."
            BootOrientation.REVERSE_PORTRAIT -> "Bootanimation retrato invertido (1080x1920, 180°)."
        }

        RootShell.exec("mkdir -p $SD_DIR/backup")
        val pushedLogo = copyToSdcard(bmp, "$SD_DIR/totemdigital.bmp")
        val pushedAnim = copyToSdcard(zip, "$SD_DIR/bootanimation.zip")
        if (!pushedLogo || !pushedAnim) {
            messages += "Falha ao copiar logos oficiais para $SD_DIR."
            return Report(false, false, false, false, messages)
        }

        val current = inspect(work, wantLogo, wantAnim, messages)

        val logo = when {
            current.logoIsTotemDigital -> {
                messages += "Logo Android já é TotemDigital — sem alteração."
                true to false
            }
            else -> installBootlogo(messages) to true
        }
        val anim = when {
            current.animIsTotemDigital -> {
                messages += "Bootanimation já é TotemDigital — sem alteração."
                true to false
            }
            else -> installBootanimation(messages) to true
        }

        val logoOk = logo.first
        val animOk = anim.first
        val logoChanged = logo.second && logoOk
        val animChanged = anim.second && animOk
        if (logoOk && animOk) {
            RootShell.exec(
                "printf 'orientation=${orientation.name}\nlogo=$wantLogo\nanim=$wantAnim\n' > $SD_DIR/totemdigital-boot.sha256",
            )
        }
        return Report(logoOk, animOk, logoChanged, animChanged, messages)
    }

    private fun inspect(
        work: File,
        wantLogo: String,
        wantAnim: String,
        messages: MutableList<String>,
    ): Current {
        val inspectLogo = File(work, "inspect-bootlogo.bmp")
        val inspectAnim = File(work, "inspect-bootanimation.zip")
        val logoScript = """
            mkdir -p $MOUNT
            rm -f '${inspectLogo.absolutePath}'
            if mount -t vfat $BOOTLOADER_PART $MOUNT; then
              if [ -f $MOUNT/bootlogo.bmp ]; then
                cp $MOUNT/bootlogo.bmp '${inspectLogo.absolutePath}'
                echo LOGO_COPIED
              else
                echo MISSING_BOOTLOGO
              fi
              umount $MOUNT || true
            else
              echo MOUNT_FAIL
            fi
        """.trimIndent().replace('\n', ';')
        val animScript = """
            TARGET=$ANIM_SYSTEM
            [ -f $ANIM_VENDOR ] && TARGET=$ANIM_VENDOR
            rm -f '${inspectAnim.absolutePath}'
            if [ -f ${'$'}TARGET ]; then
              cp ${'$'}TARGET '${inspectAnim.absolutePath}'
              echo ANIM_COPIED
            else
              echo MISSING_ANIM
            fi
        """.trimIndent().replace('\n', ';')

        val logoOut = RootShell.exec(logoScript, 45_000L).combined
        val animOut = RootShell.exec(animScript, 20_000L).combined
        if (logoOut.contains("MOUNT_FAIL")) messages += "Não foi possível ler a partição do logo Android."
        if (logoOut.contains("MISSING_BOOTLOGO")) messages += "bootlogo.bmp ausente no bootloader."
        if (animOut.contains("MISSING_ANIM")) messages += "bootanimation.zip ausente em /system."

        val logoHash = inspectLogo.takeIf { it.isFile && it.length() > 0L }?.let { sha256(it) }
        val animHash = inspectAnim.takeIf { it.isFile && it.length() > 0L }?.let { sha256(it) }
        return Current(
            logoIsTotemDigital = logoHash.equals(wantLogo, ignoreCase = true),
            animIsTotemDigital = animHash.equals(wantAnim, ignoreCase = true),
        )
    }

    private fun installBootlogo(messages: MutableList<String>): Boolean {
        val script = """
            mkdir -p $MOUNT
            mount -t vfat $BOOTLOADER_PART $MOUNT || exit 11
            if [ -f $MOUNT/bootlogo.bmp ]; then
              cp $MOUNT/bootlogo.bmp $SD_DIR/backup/bootlogo-backup.bmp
            fi
            cp $SD_DIR/totemdigital.bmp $MOUNT/bootlogo.bmp
            sync
            umount $MOUNT || true
            echo BOOTLOGO_OK
        """.trimIndent().replace('\n', ';')
        val r = RootShell.exec(script, 60_000L)
        return if (r.combined.contains("BOOTLOGO_OK")) {
            messages += "Logo Android (bootloader) gravado com totemdigital.bmp."
            true
        } else {
            messages += "Logo Android não gravado ($BOOTLOADER_PART). ${r.combined.take(180)}"
            false
        }
    }

    private fun installBootanimation(messages: MutableList<String>): Boolean {
        val script = """
            mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null || true
            TARGET=$ANIM_SYSTEM
            [ -f $ANIM_VENDOR ] && TARGET=$ANIM_VENDOR
            if [ -f ${'$'}TARGET ]; then
              cp ${'$'}TARGET $SD_DIR/backup/bootanimation-backup.zip
            fi
            cp $SD_DIR/bootanimation.zip ${'$'}TARGET && chmod 644 ${'$'}TARGET && echo ANIM_OK
        """.trimIndent().replace('\n', ';')
        val r = RootShell.exec(script, 60_000L)
        return if (r.combined.contains("ANIM_OK") && r.ok) {
            messages += "Logo MBox (bootanimation.zip) gravado com TotemDigital."
            true
        } else {
            messages += "Bootanimation ficou em $SD_DIR/bootanimation.zip — /system pode estar só de leitura."
            false
        }
    }

    private fun extractAsset(context: Context, name: String, dest: File): File? {
        if (!assetExists(context, name)) return null
        context.assets.open(name).use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        }
        return dest.takeIf { it.exists() && it.length() > 64L }
    }

    private fun assetExists(context: Context, name: String): Boolean {
        return try {
            context.assets.open(name).use { true }
        } catch (_: Exception) {
            false
        }
    }

    private fun copyToSdcard(local: File, remote: String): Boolean {
        return RootShell.exec("cp '${local.absolutePath}' '$remote'", 30_000L).ok
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun bmpAssetFor(context: Context, orientation: BootOrientation): String {
        val preferred = when (orientation) {
            BootOrientation.PORTRAIT -> ASSET_BMP_PORTRAIT
            BootOrientation.REVERSE_PORTRAIT -> ASSET_BMP_REVERSE
            BootOrientation.LANDSCAPE -> ASSET_BMP_LANDSCAPE
        }
        return if (assetExists(context, preferred)) preferred else ASSET_BMP
    }

    private fun animAssetFor(context: Context, orientation: BootOrientation): String? {
        val preferred = when (orientation) {
            BootOrientation.PORTRAIT -> ASSET_ANIM_PORTRAIT
            BootOrientation.REVERSE_PORTRAIT -> ASSET_ANIM_REVERSE
            BootOrientation.LANDSCAPE -> ASSET_ANIM_LANDSCAPE
        }
        return when {
            assetExists(context, preferred) -> preferred
            orientation != BootOrientation.LANDSCAPE && assetExists(context, ASSET_ANIM_PORTRAIT) -> ASSET_ANIM_PORTRAIT
            assetExists(context, ASSET_ANIM_LANDSCAPE) -> ASSET_ANIM_LANDSCAPE
            else -> null
        }
    }

    private data class Current(
        val logoIsTotemDigital: Boolean,
        val animIsTotemDigital: Boolean,
    )
}
