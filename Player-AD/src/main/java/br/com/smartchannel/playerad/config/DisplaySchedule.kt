package br.com.smartchannel.playerad.config

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

/**
 * Horário de trabalho da tela (espelho de player_settings.displaySchedule).
 */
data class DisplaySchedule(
    val enabled: Boolean = false,
    val timezone: String = "America/Sao_Paulo",
    val daysOfWeek: Set<Int> = (0..6).toSet(),
    val onTime: String = "08:00",
    val offTime: String = "22:00",
    val keepAliveWhileOff: Boolean = true,
    val keepAliveIntervalMinutes: Int = 10,
    val forceMode: String? = null, // "on" | "off" | null
) {
    companion object {
        fun fromJson(raw: JSONObject?): DisplaySchedule {
            if (raw == null) return DisplaySchedule()
            val daysArr = raw.optJSONArray("daysOfWeek")
            val days = mutableSetOf<Int>()
            if (daysArr != null) {
                for (i in 0 until daysArr.length()) {
                    val d = daysArr.optInt(i, -1)
                    if (d in 0..6) days += d
                }
            }
            val force = raw.optString("forceMode", "").trim().lowercase()
            return DisplaySchedule(
                enabled = raw.optBoolean("enabled", false),
                timezone = raw.optString("timezone", "America/Sao_Paulo").ifBlank { "America/Sao_Paulo" },
                daysOfWeek = if (days.isEmpty()) (0..6).toSet() else days,
                onTime = normalizeHm(raw.optString("onTime", "08:00")),
                offTime = normalizeHm(raw.optString("offTime", "22:00")),
                keepAliveWhileOff = raw.optBoolean("keepAliveWhileOff", true),
                keepAliveIntervalMinutes = raw.optInt("keepAliveIntervalMinutes", 10).coerceIn(5, 30),
                forceMode = when (force) {
                    "on", "off" -> force
                    else -> null
                },
            )
        }

        private fun normalizeHm(raw: String): String {
            val trimmed = raw.trim()
            val withSeconds = Regex("^([01]\\d|2[0-3]):([0-5]\\d)(?::[0-5]\\d)?$").find(trimmed)
            if (withSeconds != null) {
                return "${withSeconds.groupValues[1]}:${withSeconds.groupValues[2]}"
            }
            val m = Regex("^([01]\\d|2[0-3]):([0-5]\\d)$").find(trimmed)
            return m?.value ?: "08:00"
        }
    }

    fun toJson(): JSONObject = JSONObject().apply {
        put("enabled", enabled)
        put("timezone", timezone)
        put("daysOfWeek", JSONArray(daysOfWeek.sorted()))
        put("onTime", onTime)
        put("offTime", offTime)
        put("keepAliveWhileOff", keepAliveWhileOff)
        put("keepAliveIntervalMinutes", keepAliveIntervalMinutes)
        if (forceMode != null) put("forceMode", forceMode) else put("forceMode", JSONObject.NULL)
    }

    fun withForceMode(mode: String?): DisplaySchedule = copy(forceMode = mode)

    /** true = exibir conteúdo; false = idle (tela preta). */
    fun isDisplayActiveNow(nowMs: Long = System.currentTimeMillis()): Boolean {
        when (forceMode) {
            "on" -> return true
            "off" -> return false
        }
        if (!enabled) return true

        val tz = try {
            TimeZone.getTimeZone(timezone)
        } catch (_: Exception) {
            TimeZone.getDefault()
        }
        val cal = Calendar.getInstance(tz)
        cal.timeInMillis = nowMs
        val day = cal.get(Calendar.DAY_OF_WEEK) // 1=Sun … 7=Sat
        val dayJs = when (day) {
            Calendar.SUNDAY -> 0
            Calendar.MONDAY -> 1
            Calendar.TUESDAY -> 2
            Calendar.WEDNESDAY -> 3
            Calendar.THURSDAY -> 4
            Calendar.FRIDAY -> 5
            Calendar.SATURDAY -> 6
            else -> 0
        }
        if (dayJs !in daysOfWeek) return false

        val nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        val onMins = parseHm(onTime)
        val offMins = parseHm(offTime)
        if (onMins < 0 || offMins < 0 || onMins == offMins) return true
        return if (offMins > onMins) {
            nowMins >= onMins && nowMins < offMins
        } else {
            nowMins >= onMins || nowMins < offMins
        }
    }

    private fun parseHm(value: String): Int {
        val m = Regex("^([01]\\d|2[0-3]):([0-5]\\d)$").find(value.trim()) ?: return -1
        return m.groupValues[1].toInt() * 60 + m.groupValues[2].toInt()
    }
}
