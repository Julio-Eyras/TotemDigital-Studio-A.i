<template>
  <div class="holograph-view-wrap">
    <div ref="containerRef" class="holograph-view" />
    <div v-if="showLegend" class="legend">
      <span v-for="t in legendTypes" :key="t" class="legend-item">
        <span class="legend-dot" :style="{ background: nodeColor(t) }" />
        {{ nodeLabel(t) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'
import { applyForceLayout } from '../layout/ForceLayout'
import { defaultTheme } from '../themes/defaultTheme'
import type { GraphData, GraphNode, GraphEdge } from '../types'
import { NODE_TYPE_COLORS, NODE_TYPE_LABELS } from '../types'

const props = withDefaults(
  defineProps<{
    graph: GraphData
    theme?: Record<string, string>
    runLayout?: boolean
    showLegend?: boolean
  }>(),
  { runLayout: true, showLegend: true }
)

const legendTypes = ['publisher', 'location', 'totem', 'smarttv', 'subscriber', 'media', 'playlist', 'campaign']
const nodeColor = (type: string) => NODE_TYPE_COLORS[type] ?? 'rgba(158,158,158,0.7)'
const nodeLabel = (type: string) => NODE_TYPE_LABELS[type] ?? type

const emit = defineEmits<{
  nodeClick: [node: GraphNode]
  edgeClick: [edge: GraphEdge]
}>()

const containerRef = ref<HTMLElement | null>(null)
let simulation: d3.Simulation<GraphNode, undefined> | null = null
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null

const theme = () => ({ ...defaultTheme, ...props.theme })

function render() {
  const container = containerRef.value
  if (!container || !props.graph.nodes.length) return

  const { nodes, edges } = props.graph
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600
  const th = theme()

  container.innerHTML = ''
  svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', th.background)

  svg
    .append('defs')
    .append('filter')
    .attr('id', 'glow')
    .append('feGaussianBlur')
    .attr('stdDeviation', '4')
    .attr('result', 'coloredBlur')

  const g = svg.append('g')

  const edgesWithNodes = edges.map((e) => ({
    ...e,
    source: nodes.find((n) => n.id === e.from) ?? (e.from as unknown as GraphNode),
    target: nodes.find((n) => n.id === e.to) ?? (e.to as unknown as GraphNode)
  }))

  const getEdgeStroke = (d: { type?: string }) => (d.type === 'scheduled' ? 'rgba(255, 152, 0, 0.7)' : th.edgeColor)
  const link = g
    .append('g')
    .selectAll('line')
    .data(edgesWithNodes)
    .join('line')
    .attr('stroke', getEdgeStroke)
    .attr('stroke-opacity', 0.85)
    .attr('stroke-width', (d: { type?: string }) => (d.type === 'scheduled' ? 2 : 1.5))
    .style('cursor', 'pointer')
    .on('click', (_, e) => emit('edgeClick', e))

  const node = g
    .append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (ev, d) => {
          d.fx = d3.pointer(ev)[0]
          d.fy = d3.pointer(ev)[1]
        })
        .on('end', (event, d) => {
          if (!event.active && simulation) simulation.alphaTarget(0)
          d.fx = undefined
          d.fy = undefined
        })
    )
    .on('click', (_, n) => emit('nodeClick', n))

  const getNodeColor = (d: GraphNode) => NODE_TYPE_COLORS[d.type ?? ''] ?? th.nodeColor
  node
    .append('circle')
    .attr('r', 8)
    .attr('fill', getNodeColor)
    .attr('stroke', (d: GraphNode) => d3.color(getNodeColor(d))?.darker(0.3).toString() ?? 'rgba(0,255,255,0.6)')
    .attr('stroke-width', 1.5)

  node
    .append('text')
    .text((d) => d.label ?? d.id)
    .attr('x', 12)
    .attr('y', 4)
    .attr('fill', '#e0e0e0')
    .attr('font-size', '10px')

  function ticked() {
    link
      .attr('x1', (d) => (d as unknown as { source: GraphNode }).source.x ?? 0)
      .attr('y1', (d) => (d as unknown as { source: GraphNode }).source.y ?? 0)
      .attr('x2', (d) => (d as unknown as { target: GraphNode }).target.x ?? 0)
      .attr('y2', (d) => (d as unknown as { target: GraphNode }).target.y ?? 0)
    node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
  }

  if (props.runLayout) {
    simulation = applyForceLayout(
      { nodes, edges: edgesWithNodes },
      width,
      height
    ) as d3.Simulation<GraphNode, undefined>
    simulation.on('tick', ticked)
  } else {
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2
      n.x = width / 2 + 200 * Math.cos(angle)
      n.y = height / 2 + 200 * Math.sin(angle)
    })
    ticked()
  }

  zoomBehavior = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', (event) => {
    g.attr('transform', event.transform)
  })
  svg.call(zoomBehavior)
}

onMounted(() => {
  render()
  window.addEventListener('resize', render)
})

onUnmounted(() => {
  window.removeEventListener('resize', render)
  simulation?.stop()
  simulation = null
  svg = null
})

watch(
  () => props.graph,
  () => render(),
  { deep: true }
)
</script>

<style scoped>
.holograph-view-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
}
.holograph-view {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
.legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(10, 14, 23, 0.9);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 11px;
  color: #e0e0e0;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
</style>
