type Listener = (payload?: any) => void

export class EventBus {
  private listeners = new Map<string, Listener[]>()

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(fn)
  }

  emit(event: string, payload?: any) {
    this.listeners.get(event)?.forEach(fn => fn(payload))
  }
}
