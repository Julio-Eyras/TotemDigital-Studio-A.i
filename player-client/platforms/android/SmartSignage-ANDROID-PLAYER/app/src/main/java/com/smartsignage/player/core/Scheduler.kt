package com.smartsignage.player.core

import com.smartsignage.player.models.PlaylistItem
import com.smartsignage.player.models.Schedule
import java.util.*

/**
 * Scheduler - Android
 * Sistema de agendamento de conteúdo
 */
class Scheduler {
    private val timezone = TimeZone.getDefault()

    /**
     * Verifica se item deve ser exibido baseado no agendamento
     */
    fun shouldDisplay(item: PlaylistItem, currentTime: Date = Date()): Boolean {
        val schedule = item.schedule ?: return true // Sem agendamento = sempre exibir

        val calendar = Calendar.getInstance(timezone).apply {
            time = currentTime
        }

        // Verificar dias da semana
        schedule.daysOfWeek?.let { days ->
            val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
            if (!days.contains(dayOfWeek)) {
                return false
            }
        }

        // Verificar horário
        schedule.startTime?.let { startTime ->
            schedule.endTime?.let { endTime ->
                val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + 
                                    calendar.get(Calendar.MINUTE)
                val startMinutes = timeToMinutes(startTime)
                val endMinutes = timeToMinutes(endTime)

                if (startMinutes <= endMinutes) {
                    // Horário normal (ex: 09:00 - 18:00)
                    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
                        return false
                    }
                } else {
                    // Horário que cruza meia-noite (ex: 22:00 - 06:00)
                    if (currentMinutes < startMinutes && currentMinutes >= endMinutes) {
                        return false
                    }
                }
            }
        }

        // Verificar datas específicas
        schedule.startDate?.let { startDate ->
            val start = Date(startDate)
            if (currentTime.before(start)) {
                return false
            }
        }

        schedule.endDate?.let { endDate ->
            val end = Date(endDate)
            if (currentTime.after(end)) {
                return false
            }
        }

        return true
    }

    /**
     * Filtra itens da playlist baseado no agendamento
     */
    fun filterScheduledItems(items: List<PlaylistItem>, currentTime: Date = Date()): List<PlaylistItem> {
        return items.filter { shouldDisplay(it, currentTime) }
    }

    /**
     * Converte string de tempo (HH:MM) para minutos
     */
    private fun timeToMinutes(timeString: String): Int {
        val parts = timeString.split(":")
        if (parts.size != 2) return 0
        return parts[0].toIntOrNull()?.let { hours ->
            parts[1].toIntOrNull()?.let { minutes ->
                hours * 60 + minutes
            }
        } ?: 0
    }
}

