package br.com.smartchannel.instalaplayer

import android.content.Context

/**
 * A escolha de logos tem de sobreviver ao diálogo do PackageInstaller
 * (a activity pode ser recriada; o processo pode morrer).
 */
object InstallerDraft {
    private const val PREFS = "instala_player_draft"
    private const val KEY_CHANGE = "changeLogos"
    private const val KEY_ORIENTATION = "bootOrientation"
    private const val KEY_ORIENTATION_PICKED = "orientationPicked"
    private const val KEY_WAITING = "waitingInstall"
    private const val KEY_FINISHED = "finishedInstall"

    fun save(
        context: Context,
        changeLogos: Boolean,
        orientation: BootOrientation,
        orientationPicked: Boolean,
        waitingInstall: Boolean,
        finishedInstall: Boolean,
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_CHANGE, changeLogos)
            .putString(KEY_ORIENTATION, orientation.name)
            .putBoolean(KEY_ORIENTATION_PICKED, orientationPicked)
            .putBoolean(KEY_WAITING, waitingInstall)
            .putBoolean(KEY_FINISHED, finishedInstall)
            .commit()
    }

    fun load(context: Context): Draft {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val name = p.getString(KEY_ORIENTATION, BootOrientation.PORTRAIT.name)
        val orientation = BootOrientation.entries.firstOrNull { it.name == name }
            ?: BootOrientation.PORTRAIT
        return Draft(
            changeLogos = p.getBoolean(KEY_CHANGE, false),
            orientation = orientation,
            orientationPicked = p.getBoolean(KEY_ORIENTATION_PICKED, false),
            waitingInstall = p.getBoolean(KEY_WAITING, false),
            finishedInstall = p.getBoolean(KEY_FINISHED, false),
        )
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    }

    data class Draft(
        val changeLogos: Boolean,
        val orientation: BootOrientation,
        val orientationPicked: Boolean,
        val waitingInstall: Boolean,
        val finishedInstall: Boolean,
    )
}
