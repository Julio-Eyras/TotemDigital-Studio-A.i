export interface Node {
  id: string
  label?: string
  type?: string
  meta?: any
  x?: number
  y?: number
}

export interface Edge {
  from: string
  to: string
  label?: string
}

export class GraphEngine {
  nodes = new Map<string, Node>()
  edges: Edge[] = []

  addNode(node: Node) {
    this.nodes.set(node.id, node)
  }

  addEdge(edge: Edge) {
    this.edges.push(edge)
  }

  getGraph() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    }
  }

  clear() {
    this.nodes.clear()
    this.edges = []
  }
}
