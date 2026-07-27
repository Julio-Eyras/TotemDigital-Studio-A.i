package br.com.smartchannel.playerad.util

import android.content.Context

object PlayerAdPrefs {
    const val NAME = "playerad_prefs"
    const val KEY_SU_GRANTED = "su_granted"
    const val KEY_DEV_FIRST_RUN_DONE = "dev_first_run_done"
    const val KEY_DEV_LAST_VERSION_CODE = "dev_last_version_code"
    /** Último [AppDirs.root] absoluto — usado para migração ao mudar volume/modo. */
    const val KEY_LAST_STORAGE_ROOT = "last_storage_root"

    fun prefs(context: Context) =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun isSuGranted(context: Context): Boolean =
        prefs(context).getBoolean(KEY_SU_GRANTED, false)

    fun setSuGranted(context: Context, granted: Boolean) {
        prefs(context).edit().putBoolean(KEY_SU_GRANTED, granted).apply()
    }
}
