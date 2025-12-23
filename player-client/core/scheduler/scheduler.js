/**
 * Scheduler - Core
 * Sistema de agendamento de conteúdo
 */

class Scheduler {
  constructor() {
    this.currentTime = new Date();
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Verifica se item deve ser exibido baseado no agendamento
   */
  shouldDisplay(item, currentTime = new Date()) {
    if (!item.schedule) {
      return true; // Sem agendamento = sempre exibir
    }

    const schedule = item.schedule;
    const now = this.getLocalTime(currentTime);

    // Verificar dias da semana
    if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
      const dayOfWeek = now.getDay();
      if (!schedule.daysOfWeek.includes(dayOfWeek)) {
        return false;
      }
    }

    // Verificar horário
    if (schedule.startTime && schedule.endTime) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = this.timeToMinutes(schedule.startTime);
      const endMinutes = this.timeToMinutes(schedule.endTime);

      if (startMinutes <= endMinutes) {
        // Horário normal (ex: 09:00 - 18:00)
        if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
          return false;
        }
      } else {
        // Horário que cruza meia-noite (ex: 22:00 - 06:00)
        if (currentMinutes < startMinutes && currentMinutes >= endMinutes) {
          return false;
        }
      }
    }

    // Verificar datas específicas
    if (schedule.startDate || schedule.endDate) {
      const currentDate = this.getDateOnly(now);
      if (schedule.startDate && currentDate < new Date(schedule.startDate)) {
        return false;
      }
      if (schedule.endDate && currentDate > new Date(schedule.endDate)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Filtra itens da playlist baseado no agendamento
   */
  filterScheduledItems(items, currentTime = new Date()) {
    return items.filter(item => this.shouldDisplay(item, currentTime));
  }

  /**
   * Converte string de tempo (HH:MM) para minutos
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Obtém data sem hora
   */
  getDateOnly(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Obtém hora local considerando timezone
   */
  getLocalTime(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: this.timezone }));
  }

  /**
   * Define timezone
   */
  setTimezone(timezone) {
    this.timezone = timezone;
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scheduler;
} else {
  window.Scheduler = Scheduler;
}

