package br.com.smartchannel.playerad.util

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.DocumentsContract
import android.util.Log

/**
 * Escape de kiosk na tela de debug: explorador e launcher Android (não o Player-AD).
 * O alias HOME permanece ligado — o Player-AD continua a ser o kiosk por defeito.
 */
object KioskEscape {

    const val HOME_ACTIVITY = ".ui.MainActivity"
    const val HOME_ALIAS = "br.com.smartchannel.playerad.ui.PlayerHomeAlias"

    val FILE_MANAGER_PACKAGES = listOf(
        "com.android.documentsui",
        "com.google.android.documentsui",
        "com.softwinner.TvdFileManager",
        "com.droidlogic.FileBrower",
        "com.droidlogic.app.FileBrower",
        "com.estrongs.android.pop",
        "com.jrm.filemanager",
    )

    data class LaunchResult(val ok: Boolean, val detail: String)

    fun homeAliasComponent(context: Context): ComponentName =
        ComponentName(context.packageName, HOME_ALIAS)

    fun setHomeAliasEnabled(context: Context, enabled: Boolean) {
        val state = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        try {
            context.packageManager.setComponentEnabledSetting(
                homeAliasComponent(context),
                state,
                PackageManager.DONT_KILL_APP,
            )
            PlayerAdLogger.i(
                "KIOSK",
                if (enabled) "HOME alias ligado (totem)" else "HOME alias desligado (debug)",
            )
        } catch (e: Exception) {
            Log.w("Player-AD", "HOME alias: ${e.message}")
            PlayerAdLogger.w("KIOSK", "HOME alias falhou: ${e.message ?: "erro"}")
        }
    }

    /**
     * Garante que o Player-AD é o launcher HOME. Não desliga o alias: abrir o
     * menu Android é só uma visita; o totem continua a ser o kiosk no reboot e no botão HOME.
     */
    fun restorePreferredHome(context: Context) {
        setHomeAliasEnabled(context, enabled = true)
        val pkg = context.packageName
        val component = "$pkg/$HOME_ACTIVITY"
        if (!SuAccessHelper.suBinaryPresent()) return
        try {
            val script = """
                cmd package set-home-activity --user 0 $component
                cmd package set-home-activity $component
                cmd role add-role-holder --user 0 android.app.role.HOME $pkg
                """.trimIndent()
            val proc = Runtime.getRuntime().exec(arrayOf("su", "-c", script))
            val waiter = Thread { proc.waitFor() }
            waiter.start()
            waiter.join(8_000L)
            PlayerAdLogger.i("KIOSK", "HOME por defeito: $component")
        } catch (e: Exception) {
            PlayerAdLogger.w("KIOSK", "set-home-activity: ${e.message ?: "erro"}")
        }
    }

    fun pickOtherHomeComponent(
        selfPackage: String,
        candidates: List<ComponentName>,
    ): ComponentName? {
        return pickOtherHome(
            selfPackage,
            candidates.map { it.packageName to it.className },
        )?.let { ComponentName(it.first, it.second) }
    }

    /**
     * Primeiro HOME que não é o Player-AD. Pares package/class para testes JVM.
     */
    fun pickOtherHome(
        selfPackage: String,
        candidates: List<Pair<String, String>>,
    ): Pair<String, String>? {
        return candidates.firstOrNull { it.first != selfPackage }
    }

    fun pickFileManagerPackage(
        installed: Collection<String>,
        preferred: List<String> = FILE_MANAGER_PACKAGES,
    ): String? {
        return preferred.firstOrNull { installed.contains(it) }
    }

    fun openSystemLauncher(context: Context): LaunchResult {
        val others = queryHomeComponents(context).filter { it.packageName != context.packageName }
        val picked = pickOtherHomeComponent(context.packageName, others)
        val result = if (picked != null) {
            start(
                context,
                Intent(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_HOME)
                    .setComponent(picked)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                "Launcher: ${picked.packageName}",
            )
        } else {
            start(
                context,
                Intent(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                "Lista de apps Android TV",
            )
        }
        restorePreferredHome(context)
        return result
    }

    fun openFileExplorer(context: Context): LaunchResult {
        val installed = installedPackages(context)
        val pkg = pickFileManagerPackage(installed)
        if (pkg != null) {
            val launch = launchIntentFor(context, pkg)
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                return start(context, launch, "Explorador: $pkg")
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val browse = Intent(Intent.ACTION_VIEW).apply {
                addCategory(Intent.CATEGORY_DEFAULT)
                setDataAndType(
                    DocumentsContract.buildRootUri("com.android.externalstorage.documents", "primary"),
                    DocumentsContract.Document.MIME_TYPE_DIR,
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val browseResult = start(context, browse, "Explorador DocumentsUI")
            if (browseResult.ok) return browseResult
        }
        val getContent = Intent(Intent.ACTION_GET_CONTENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return start(context, getContent, "Selector de ficheiros")
    }

    private fun queryHomeComponents(context: Context): List<ComponentName> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PackageManager.MATCH_ALL
        } else {
            0
        }
        val list = context.packageManager.queryIntentActivities(intent, flags)
        return list.mapNotNull { ri ->
            val ai = ri.activityInfo ?: return@mapNotNull null
            ComponentName(ai.packageName, ai.name)
        }
    }

    private fun launchIntentFor(context: Context, pkg: String): Intent? {
        val pm = context.packageManager
        pm.getLaunchIntentForPackage(pkg)?.let { return it }
        val leanback = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
            .setPackage(pkg)
        val info = pm.queryIntentActivities(leanback, 0).firstOrNull()?.activityInfo ?: return null
        return Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
            .setClassName(info.packageName, info.name)
    }

    private fun installedPackages(context: Context): Set<String> {
        return FILE_MANAGER_PACKAGES.filter { pkg ->
            try {
                context.packageManager.getPackageInfo(pkg, 0)
                true
            } catch (_: Exception) {
                false
            }
        }.toSet()
    }

    private fun start(context: Context, intent: Intent, detail: String): LaunchResult {
        return try {
            context.startActivity(intent)
            PlayerAdLogger.i("KIOSK", detail)
            LaunchResult(true, detail)
        } catch (e: Exception) {
            val msg = e.message ?: "falhou"
            PlayerAdLogger.w("KIOSK", "$detail: $msg")
            LaunchResult(false, msg)
        }
    }
}
