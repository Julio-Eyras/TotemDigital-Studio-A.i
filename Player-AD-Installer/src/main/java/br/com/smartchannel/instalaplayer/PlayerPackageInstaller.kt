package br.com.smartchannel.instalaplayer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import java.io.File

object PlayerPackageInstaller {
    const val ACTION_INSTALL_RESULT = "br.com.smartchannel.instalaplayer.INSTALL_RESULT"
    const val PLAYER_PACKAGE = "br.com.smartchannel.playerad"
    const val ASSET_APK = "player-ad.apk"

    fun extractBundledApk(context: Context): File {
        val dest = File(context.cacheDir, "player-ad.apk")
        context.assets.open(ASSET_APK).use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        }
        if (!dest.exists() || dest.length() < 100_000L) {
            throw IllegalStateException("APK do Player-AD em falta no instalador")
        }
        return dest
    }

    fun startSession(context: Context, apk: File): Int {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(PLAYER_PACKAGE)
        val sessionId = installer.createSession(params)
        val session = installer.openSession(sessionId)
        try {
            session.openWrite("base.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { input -> input.copyTo(out) }
                session.fsync(out)
            }
            val intent = Intent(context, InstallResultReceiver::class.java).setAction(ACTION_INSTALL_RESULT)
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                if (android.os.Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            val pi = PendingIntent.getBroadcast(context, sessionId, intent, flags)
            session.commit(pi.intentSender)
        } catch (e: Exception) {
            session.abandon()
            throw e
        }
        return sessionId
    }

    fun isPlayerInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(PLAYER_PACKAGE, 0)
            true
        } catch (_: Exception) {
            false
        }
    }
}
