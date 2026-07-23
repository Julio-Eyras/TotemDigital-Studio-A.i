package br.com.smartchannel.playerad.config

import android.content.Context
import org.json.JSONObject
import java.io.File

/** Persistência local de displaySchedule (server → heartbeat / apply_player_config). */
object DisplayScheduleStore {
    private fun file(context: Context): File = File(context.filesDir, "display-schedule.json")

    fun load(context: Context): DisplaySchedule {
        val f = file(context)
        if (!f.exists()) return DisplaySchedule()
        return try {
            DisplaySchedule.fromJson(JSONObject(f.readText(Charsets.UTF_8)))
        } catch (_: Exception) {
            DisplaySchedule()
        }
    }

    fun save(context: Context, schedule: DisplaySchedule) {
        try {
            file(context).writeText(schedule.toJson().toString(), Charsets.UTF_8)
        } catch (_: Exception) {
            // best-effort
        }
    }

    fun applyJson(context: Context, raw: JSONObject?): DisplaySchedule {
        val schedule = DisplaySchedule.fromJson(raw)
        save(context, schedule)
        return schedule
    }
}
