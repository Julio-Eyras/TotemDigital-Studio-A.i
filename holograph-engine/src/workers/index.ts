/**
 * Workers do HoloGraph Engine.
 * Layout pesado pode ser executado em Web Worker para não bloquear a UI.
 * Uso futuro: force layout em worker, depois postMessage com posições.
 */

export const WORKER_LAYOUT_SCRIPT = `
  self.onmessage = function(e) {
    const { nodes, edges, width, height } = e.data
    // Layout simplificado no worker (ex.: posicionamento em grid)
    const centerX = width / 2, centerY = height / 2
    const radius = Math.min(width, height) * 0.35
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2
      n.x = centerX + radius * Math.cos(angle)
      n.y = centerY + radius * Math.sin(angle)
    })
    self.postMessage({ nodes })
  }
`

export function createLayoutWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  try {
    const blob = new Blob([WORKER_LAYOUT_SCRIPT], { type: 'application/javascript' })
    return new Worker(URL.createObjectURL(blob))
  } catch {
    return null
  }
}
