import * as d3 from 'd3'

export function createRenderer(container: HTMLElement) {
  const width = container.clientWidth
  const height = container.clientHeight

  const svg = d3.select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#000814")
    .style("mix-blend-mode", "screen")

  svg.append("defs")
    .append("filter")
    .attr("id", "glow")
    .append("feGaussianBlur")
    .attr("stdDeviation", "4")
    .attr("result", "coloredBlur")

  return svg
}
