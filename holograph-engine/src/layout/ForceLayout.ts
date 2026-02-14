import * as d3 from 'd3'

export function applyForceLayout(graph: any, width: number, height: number) {
  return d3.forceSimulation(graph.nodes)
    .force("link", d3.forceLink(graph.edges)
      .id((d: any) => d.id)
      .distance(180))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2))
}
