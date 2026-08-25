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
    private const val TMP_DIR = "/data/local/tmp/td-boot"
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

        val wantLogo = md5(bmp)
        val wantAnim = md5(zip)
        messages += "Sentido escolhido: ${orientation.label}."
        messages += "Assets: $bmpAsset / $animAsset."
        messages += "MD5 logo=$wantLogo"
        messages += "MD5 anim=$wantAnim"

        val previous = readStamp()
        if (previous != null) {
            messages += "Stamp anterior:\n$previous"
        }

        RootShell.exec("mkdir -p $SD_DIR/backup $TMP_DIR")
        if (!stageFile(bmp, "$TMP_DIR/totemdigital.bmp") || !stageFile(zip, "$TMP_DIR/bootanimation.zip")) {
            messages += "Falha ao copiar logos oficiais para $TMP_DIR."
            return Report(false, false, false, false, messages)
        }
        RootShell.exec("cp $TMP_DIR/totemdigital.bmp $SD_DIR/totemdigital.bmp")
        RootShell.exec("cp $TMP_DIR/bootanimation.zip $SD_DIR/bootanimation.zip")

        val beforeLogo = hashRemote("$MOUNT/bootlogo.bmp", work, mountFirst = true)
        val beforeAnim = hashRemote(animationTarget(), work, mountFirst = false)
        val logoOk = installBootlogo(work, wantLogo, messages)
        val animOk = installBootanimation(work, wantAnim, messages)

        if (logoOk && beforeLogo.equals(wantLogo, ignoreCase = true)) {
            messages += "Logo Android já coincidia e foi regravado."
        }
        if (animOk && beforeAnim.equals(wantAnim, ignoreCase = true)) {
            messages += "Bootanimation já coincidia e foi regravado."
        }

        RootShell.exec(
            "printf 'orientation=${orientation.name}\\nlogo=$wantLogo\\nanim=$wantAnim\\n' > $SD_DIR/totemdigital-boot.md5",
        )
        return Report(logoOk, animOk, logoOk, animOk, messages)
    }

    private fun readStamp(): String? {
        val r = RootShell.exec(
            "cat $SD_DIR/totemdigital-boot.md5 2>/dev/null || cat $SD_DIR/totemdigital-boot.sha256 2>/dev/null",
            8_000L,
        )
        return r.output.trim().takeIf { it.isNotBlank() }
    }

    private fun animationTarget(): String {
        val r = RootShell.exec(
            "[ -f $ANIM_VENDOR ] && echo $ANIM_VENDOR || echo $ANIM_SYSTEM",
            8_000L,
        )
        return r.output.trim().ifBlank { ANIM_SYSTEM }
    }

    private fun hashRemote(path: String, work: File, mountFirst: Boolean): String? {
        val script = if (mountFirst) {
            """
            umount $MOUNT 2>/dev/null || true
            mkdir -p $MOUNT
            if mount -t vfat $BOOTLOADER_PART $MOUNT; then
              if [ -f '$path' ]; then
                md5sum '$path' 2>/dev/null || toybox md5sum '$path'
              fi
              umount $MOUNT || true
            fi
            """.trimIndent()
        } else {
            """
            if [ -f '$path' ]; then
              md5sum '$path' 2>/dev/null || toybox md5sum '$path'
            fi
            """.trimIndent()
        }
        return parseMd5(RootShell.runScript(work, script, 45_000L).combined)
    }

    private fun parseMd5(output: String): String? {
        return output.lineSequence()
            .map { it.trim().split(Regex("\\s+")).firstOrNull().orEmpty() }
            .firstOrNull { it.length == 32 && it.matches(Regex("[0-9a-fA-F]{32}")) }
    }

    private fun installBootlogo(work: File, wantLogo: String, messages: MutableList<String>): Boolean {
        val r = RootShell.runScript(
            work,
            """
            umount $MOUNT 2>/dev/null || true
            mkdir -p $MOUNT
            mkdir -p $SD_DIR/backup
            mount -t vfat $BOOTLOADER_PART $MOUNT || { echo MOUNT_FAIL; exit 11; }
            echo PARTITION_FILES
            ls -la $MOUNT || true
            if [ -f $MOUNT/bootlogo.bmp ]; then
              cp $MOUNT/bootlogo.bmp $SD_DIR/backup/bootlogo-backup.bmp
            fi
            cp $TMP_DIR/totemdigital.bmp $MOUNT/bootlogo.bmp
            sync
            HASH=${'$'}(md5sum $MOUNT/bootlogo.bmp 2>/dev/null || toybox md5sum $MOUNT/bootlogo.bmp)
            echo "VERIFY ${'$'}HASH"
            umount $MOUNT || true
            echo BOOTLOGO_OK
            """.trimIndent(),
            60_000L,
        )
        messages += r.combined.take(500)
        val got = parseMd5(r.combined)
        return if (r.combined.contains("BOOTLOGO_OK") && got.equals(wantLogo, ignoreCase = true)) {
            messages += "Logo Android (bootloader) gravado e verificado neste sentido."
            true
        } else {
            messages += "Logo Android não confirmado ($BOOTLOADER_PART). hash=$got want=$wantLogo"
            false
        }
    }

    private fun installBootanimation(work: File, wantAnim: String, messages: MutableList<String>): Boolean {
        val r = RootShell.runScript(
            work,
            """
            TARGET=$ANIM_SYSTEM
            [ -f $ANIM_VENDOR ] && TARGET=$ANIM_VENDOR
            echo ANIM_TARGET=${'$'}TARGET
            # SuperSU -mm: remount no namespace do init (senão /system continua RO de verdade).
            blockdev --setrw /dev/block/by-name/system 2>/dev/null || true
            mount -o rw,remount /system 2>/dev/null || mount -o rw,remount / 2>/dev/null || true
            mount -o rw,remount /vendor 2>/dev/null || true
            if [ -f "${'$'}TARGET" ]; then
              cp "${'$'}TARGET" $SD_DIR/backup/bootanimation-backup.zip
            fi
            if cp $TMP_DIR/bootanimation.zip "${'$'}TARGET"; then
              chmod 644 "${'$'}TARGET" 2>/dev/null || true
              chown root:root "${'$'}TARGET" 2>/dev/null || true
              sync
              HASH=${'$'}(md5sum "${'$'}TARGET" 2>/dev/null || toybox md5sum "${'$'}TARGET")
              echo "VERIFY ${'$'}HASH"
              echo SYSTEM_ANIM_OK
            else
              echo SYSTEM_ANIM_FAIL
            fi
            if [ -d /data/adb/modules ]; then
              mkdir -p /data/adb/modules/totemdigital-boot/system/media
              printf 'id=totemdigital-boot\nname=TotemDigital bootanimation\nversion=1.7\nversionCode=8\nauthor=TotemDigital\ndescription=bootanimation do sentido escolhido no instalador\n' > /data/adb/modules/totemdigital-boot/module.prop
              cp $TMP_DIR/bootanimation.zip /data/adb/modules/totemdigital-boot/system/media/bootanimation.zip
              echo MAGISK_ANIM_OK
            fi
            mount -o ro,remount /system 2>/dev/null || true
            echo ANIM_DONE
            """.trimIndent(),
            60_000L,
        )
        messages += r.combined.take(500)
        val got = parseMd5(r.combined)
        val persisted = r.combined.contains("SYSTEM_ANIM_OK") && got.equals(wantAnim, ignoreCase = true)
        val magisk = r.combined.contains("MAGISK_ANIM_OK")
        return if (persisted || magisk) {
            messages += when {
                persisted -> "Bootanimation gravado em /system e verificado. Reinicie a TV."
                else -> "Bootanimation gravado (módulo Magisk — persiste após reboot)."
            }
            true
        } else {
            messages += "Bootanimation não persistiu em /system (só de leitura). hash=$got want=$wantAnim"
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

    private fun stageFile(local: File, remote: String): Boolean {
        val r = RootShell.exec("cp '${local.absolutePath}' '$remote' && chmod 644 '$remote'", 30_000L)
        return r.ok
    }

    private fun md5(file: File): String {
        val digest = MessageDigest.getInstance("MD5")
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
}
