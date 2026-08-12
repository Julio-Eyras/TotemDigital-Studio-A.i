package br.com.smartchannel.instalaplayer

import android.content.Context
import android.provider.Settings
import java.io.File

object BootLogoInstaller {
    private const val BOOTLOADER_PART = "/dev/block/mmcblk0p2"
    private const val MOUNT = "/mnt/bootlogo"
    private const val ANIM_TARGET = "/system/media/bootanimation.zip"

    data class Report(
        val bootlogoOk: Boolean,
        val animationOk: Boolean,
        val messages: List<String>,
    )

    fun apply(context: Context): Report {
        val messages = mutableListOf<String>()
        val work = File(context.cacheDir, "boot-branding").apply {
            deleteRecursively()
            mkdirs()
        }
        val bmp = File(work, "bootlogo.bmp")
        val zip = File(work, "bootanimation.zip")
        val portrait = isPortraitPreferred(context)
        BrandingAssets.writeBootlogoBmp(bmp)
        BrandingAssets.writeBootanimationZip(zip, portrait)
        messages += "Assets gerados (bootanimation ${if (portrait) "retrato 1080x1920" else "paisagem 1920x1080"})."

        RootShell.exec("mkdir -p /sdcard/smartsignage/backup")
        val pushedLogo = RootShell.exec("cp '${bmp.absolutePath}' /sdcard/smartsignage/bootlogo.bmp")
        val pushedAnim = RootShell.exec("cp '${zip.absolutePath}' /sdcard/smartsignage/bootanimation.zip")
        if (!pushedLogo.ok || !pushedAnim.ok) {
            messages += "Falha ao copiar assets para /sdcard/smartsignage."
            return Report(false, false, messages)
        }

        val logo = installBootlogo(messages)
        val anim = installBootanimation(messages)
        return Report(logo, anim, messages)
    }

    private fun installBootlogo(messages: MutableList<String>): Boolean {
        val script = """
            mkdir -p $MOUNT
            mount -t vfat $BOOTLOADER_PART $MOUNT || exit 11
            if [ -f $MOUNT/bootlogo.bmp ]; then
              cp $MOUNT/bootlogo.bmp /sdcard/smartsignage/backup/bootlogo-backup.bmp
            fi
            cp /sdcard/smartsignage/bootlogo.bmp $MOUNT/bootlogo.bmp
            sync
            umount $MOUNT || true
            echo BOOTLOGO_OK
        """.trimIndent().replace('\n', ';')
        val r = RootShell.exec(script, 60_000L)
        return if (r.combined.contains("BOOTLOGO_OK")) {
            messages += "Logo Android (bootloader) substituído."
            true
        } else {
            messages += "Logo Android não gravado (partição $BOOTLOADER_PART). ${r.combined.take(180)}"
            false
        }
    }

    private fun installBootanimation(messages: MutableList<String>): Boolean {
        val script = """
            mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null || true
            if [ -f $ANIM_TARGET ]; then
              cp $ANIM_TARGET /sdcard/smartsignage/backup/bootanimation-backup.zip
            fi
            cp /sdcard/smartsignage/bootanimation.zip $ANIM_TARGET && chmod 644 $ANIM_TARGET && echo ANIM_OK
        """.trimIndent().replace('\n', ';')
        val r = RootShell.exec(script, 60_000L)
        return if (r.combined.contains("ANIM_OK") && r.ok) {
            messages += "Logo MBox/Android (bootanimation) substituído."
            true
        } else {
            messages += "Bootanimation ficou em /sdcard/smartsignage/bootanimation.zip — /system pode estar só de leitura."
            false
        }
    }

    private fun isPortraitPreferred(context: Context): Boolean {
        val rotation = Settings.System.getInt(context.contentResolver, Settings.System.USER_ROTATION, 0)
        return rotation == 1 || rotation == 3
    }
}
