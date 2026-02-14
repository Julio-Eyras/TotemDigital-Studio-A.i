export function adaptDatabaseSchema(schema: any) {
  const nodes = []
  const edges = []

  for (const table of schema.tables) {
    nodes.push({
      id: table.name,
      type: "table",
      meta: table
    })

    for (const relation of table.relations || []) {
      edges.push({
        from: table.name,
        to: relation.target,
        label: relation.type
      })
    }
  }

  return { nodes, edges }
}
