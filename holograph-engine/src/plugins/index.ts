/**
 * Sistema de plugins do HoloGraph Engine.
 * Plugins podem estender layout, render, temas ou comportamentos.
 */
import type { GraphData } from '../types'

export interface HoloGraphPluginContext {
  graph: GraphData
  container: HTMLElement
  theme: Record<string, string>
}

export interface HoloGraphPlugin {
  name: string
  version?: string
  /** Chamado ao registrar o plugin */
  install?(ctx: HoloGraphPluginContext): void | Promise<void>
  /** Chamado antes de cada render (opcional) */
  beforeRender?(ctx: HoloGraphPluginContext): void
  /** Chamado após cada render (opcional) */
  afterRender?(ctx: HoloGraphPluginContext): void
}

const plugins = new Map<string, HoloGraphPlugin>()

export function registerPlugin(plugin: HoloGraphPlugin): void {
  plugins.set(plugin.name, plugin)
}

export function getPlugin(name: string): HoloGraphPlugin | undefined {
  return plugins.get(name)
}

export function getPlugins(): HoloGraphPlugin[] {
  return Array.from(plugins.values())
}
