/**
 * Rede visual HoloGraph: publishers, subscribers, agendamentos (D3 + adapter SmartSignage).
 */
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Box, CircularProgress, Alert, Typography, Button } from '@mui/material';
import { networkTopologyApi } from '../../services/api';
import { smartSignageToGraph, NODE_TYPE_COLORS, NODE_TYPE_LABELS } from '@shared/holograph-adapter';
import type { GraphData, GraphNode, GraphEdge, SmartSignageNetwork } from '@shared/holograph-adapter';

export interface HoloGraphNetworkProps {
  /** Se não informado, busca da API /network/graph */
  network?: SmartSignageNetwork | null;
  dayOfWeek?: number;
  time?: string;
  width?: number | string;
  height?: number;
  onNodeClick?: (node: GraphNode, pathFromRoot?: GraphNode[]) => void;
  /** Nome do arquivo ao exportar imagem (sem extensão). */
  exportFilename?: string;
}

export const HoloGraphNetwork: React.FC<HoloGraphNetworkProps> = ({
  network: networkProp,
  dayOfWeek,
  time,
  width = '100%',
  height = 500,
  onNodeClick,
  exportFilename = 'rede-visual'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [loading, setLoading] = useState(!networkProp);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<SmartSignageNetwork | null>(networkProp ?? null);
  const [emptyGraph, setEmptyGraph] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [stats, setStats] = useState<{ nodes: number; edges: number; scheduled: number } | null>(null);

  const handleResetZoom = () => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (svgEl && zoomRef.current) {
      d3.select(svgEl).call(zoomRef.current.transform as any, d3.zoomIdentity);
    }
  };

  const handleExportPng = () => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const w = parseInt(svgEl.getAttribute('width') || '0', 10) || container.clientWidth || 800;
    const h = parseInt(svgEl.getAttribute('height') || '0', 10) || (typeof height === 'number' ? height : 500);
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = '#0a0e17';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.download = `${exportFilename}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const handleExportSvg = () => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${exportFilename}.svg`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (networkProp) {
      setNetwork(networkProp);
      setLoading(false);
      setRefetching(false);
      return;
    }
    let cancelled = false;
    const hadNetwork = !!network;
    if (!hadNetwork) {
      setLoading(true);
      setError(null);
    } else {
      setRefetching(true);
    }
    networkTopologyApi
      .getGraph({ dayOfWeek, time })
      .then((res) => {
        if (!cancelled && res?.data) {
          setNetwork(res.data);
          setError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e.response?.data?.error || e.message || 'Erro ao carregar grafo');
          setNetwork(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefetching(false);
        }
      });
    return () => { cancelled = true; };
  }, [networkProp, dayOfWeek, time]);

  useEffect(() => {
    if (!containerRef.current || !network || loading) return;
    const graph = smartSignageToGraph(network, {
      includeScheduleEdges: true,
      filterDayOfWeek: dayOfWeek,
      filterTime: time
    });
    if (!graph.nodes.length) {
      setEmptyGraph(true);
      setStats(null);
      if (containerRef.current) containerRef.current.innerHTML = '';
      return;
    }
    setEmptyGraph(false);
    setStats({
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      scheduled: graph.edges.filter((e: GraphEdge) => e.type === 'scheduled').length
    });

    const container = containerRef.current;
    const w = container.clientWidth || 800;
    const h = typeof height === 'number' ? height : container.clientHeight || 500;
    container.innerHTML = '';

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .style('background', '#0a0e17');

    const g = svg.append('g');
    const edgesWithNodes = graph.edges.map((e) => ({
      ...e,
      source: graph.nodes.find((n) => n.id === e.from) ?? e.from,
      target: graph.nodes.find((n) => n.id === e.to) ?? e.to
    }));

    const simulation = d3
      .forceSimulation<GraphNode>(graph.nodes)
      .force(
        'link',
        d3.forceLink(edgesWithNodes).id((d: any) => d.id).distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(w / 2, h / 2));

    const getColor = (d: GraphNode) => NODE_TYPE_COLORS[d.type ?? ''] ?? 'rgba(158,158,158,0.7)';

    const hierarchyEdgeTypes = new Set(['has-location', 'has-totem', 'has-smarttv', 'has-media', 'has-playlist', 'has-campaign', 'contains-media', 'uses-playlist']);
    const getPathToNode = (nodeId: string): GraphNode[] => {
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return [];
      const incoming = graph.edges.find((e) => e.to === nodeId && hierarchyEdgeTypes.has(e.type ?? ''));
      if (!incoming) return [node];
      const fromNode = graph.nodes.find((n) => n.id === incoming.from);
      if (!fromNode) return [node];
      return [...getPathToNode(incoming.from), node];
    };

    const link = g
      .append('g')
      .selectAll('line')
      .data(edgesWithNodes)
      .join('line')
      .attr('stroke', (d: any) => (d.type === 'scheduled' ? 'rgba(255, 152, 0, 0.6)' : 'rgba(0,255,255,0.35)'))
      .attr('stroke-width', (d: any) => (d.type === 'scheduled' ? 2 : 1))
      .attr('stroke-opacity', 0.85)
      .on('mouseover', function (ev, d: any) {
        d3.select(this).attr('stroke-width', (d.type === 'scheduled' ? 4 : 2.5)).attr('stroke-opacity', 1);
      })
      .on('mouseout', function (ev, d: any) {
        d3.select(this).attr('stroke-width', (d.type === 'scheduled' ? 2 : 1)).attr('stroke-opacity', 0.85);
      });
    link.append('title').text((d: any) => {
      if (d.type === 'scheduled') {
        const m = d.meta || {};
        const times = [m.startTime, m.endTime].filter(Boolean).join(' – ');
        return `Agendamento${times ? `: ${times}` : ''}`;
      }
      return 'Conexão';
    });

    const node = g
      .append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .style('pointer-events', 'all')
      .call(
        (
          d3
            .drag<SVGGElement, GraphNode>()
            .on('start', (ev, d) => {
              if (!ev.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on('drag', (ev, d) => {
              d.fx = ev.x;
              d.fy = ev.y;
            })
            .on('end', (ev, d) => {
              if (!ev.active) simulation.alphaTarget(0);
              d.fx = undefined;
              d.fy = undefined;
            })
        ) as (selection: d3.Selection<SVGGElement | d3.BaseType, GraphNode, SVGGElement, unknown>) => void
      )
      .on('click', (_, n) => onNodeClick?.(n, getPathToNode(n.id)))
      .on('dblclick', (ev, d) => {
        ev.stopPropagation();
        const cx = d.x ?? 0;
        const cy = d.y ?? 0;
        const scale = 1.8;
        const t = d3.zoomIdentity.translate(w / 2 - cx * scale, h / 2 - cy * scale).scale(scale);
        svg.call(zoomRef.current!.transform as any, t);
      });

    node
      .append('circle')
      .attr('r', 7)
      .attr('fill', getColor)
      .attr('stroke', (d) => d3.color(getColor(d))?.darker(0.3).toString() ?? '#fff')
      .attr('stroke-width', 1.5);

    node
      .append('text')
      .text((d) => d.label ?? d.id)
      .attr('x', 10)
      .attr('y', 4)
      .attr('fill', '#e0e0e0')
      .attr('font-size', '10px');
    node.append('title').text((d) => `${d.label ?? d.id} (${NODE_TYPE_LABELS[d.type ?? ''] ?? d.type ?? 'nó'})`);

    function ticked() {
      link
        .attr('x1', (d: any) => d.source.x ?? 0)
        .attr('y1', (d: any) => d.source.y ?? 0)
        .attr('x2', (d: any) => d.target.x ?? 0)
        .attr('y2', (d: any) => d.target.y ?? 0);
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    }
    simulation.on('tick', ticked);

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', (ev) => {
      g.attr('transform', ev.transform);
    });
    zoomRef.current = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    svg.on('dblclick.zoom', null);

    return () => {
      simulation.stop();
      container.innerHTML = '';
    };
  }, [network, loading, height, dayOfWeek, time, onNodeClick]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }
  if (!network) {
    return (
      <Typography color="text.secondary">Nenhum dado de rede disponível.</Typography>
    );
  }
  const noScheduled = stats != null && stats.nodes > 0 && stats.scheduled === 0;

  if (emptyGraph) {
    return (
      <Box
        sx={{
          width: '100%',
          height: typeof height === 'number' ? height : 400,
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          bgcolor: 'rgba(10,14,23,0.6)',
          border: '1px dashed rgba(255,255,255,0.2)'
        }}
      >
        <Typography color="text.secondary" textAlign="center" sx={{ px: 2 }}>
          Nenhum nó para exibir. Ajuste os filtros (dia/horário) ou verifique se há publicadores e assinantes cadastrados.
        </Typography>
      </Box>
    );
  }

  const legendTypes = ['publisher', 'location', 'totem', 'smarttv', 'subscriber', 'media', 'playlist', 'campaign'];

  return (
    <Box
      sx={{ position: 'relative', width, height: typeof height === 'number' ? height : '100%' }}
      role="img"
      aria-label={`Grafo da rede: ${stats ? `${stats.nodes} nós, ${stats.edges} conexões` : 'carregando'}`}
    >
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          borderRadius: 1,
          overflow: 'hidden'
        }}
      />
      {refetching && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(10,14,23,0.7)',
            borderRadius: 1,
            zIndex: 10
          }}
        >
          <Typography variant="body2" color="primary.light">Atualizando...</Typography>
        </Box>
      )}
      <Box sx={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={handleExportSvg}
          sx={{
            bgcolor: 'rgba(10,14,23,0.9)',
            color: '#e0e0e0',
            borderColor: 'rgba(255,255,255,0.3)',
            '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(30,41,59,0.95)' }
          }}
        >
          Exportar SVG
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleExportPng}
          sx={{
            bgcolor: 'rgba(10,14,23,0.9)',
            color: '#e0e0e0',
            borderColor: 'rgba(255,255,255,0.3)',
            '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(30,41,59,0.95)' }
          }}
        >
          Exportar PNG
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleResetZoom}
          sx={{
            bgcolor: 'rgba(10,14,23,0.9)',
            color: '#e0e0e0',
            borderColor: 'rgba(255,255,255,0.3)',
            '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(30,41,59,0.95)' }
          }}
        >
          Redefinir vista
        </Button>
      </Box>
      {stats != null && (
        <Typography
          component="span"
          variant="caption"
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            bgcolor: 'rgba(10,14,23,0.9)',
            color: '#e0e0e0',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid rgba(255,255,255,0.12)'
          }}
        >
          {stats.nodes} nós · {stats.edges} conexões
          {stats.scheduled > 0 && ` · ${stats.scheduled} agendamentos`}
        </Typography>
      )}
      {noScheduled && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: 12,
            right: 140,
            bgcolor: 'rgba(255, 152, 0, 0.15)',
            color: '#ffb74d',
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: '1px solid rgba(255, 152, 0, 0.4)'
          }}
        >
          Nenhum agendamento no filtro atual
        </Typography>
      )}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          bgcolor: 'rgba(10,14,23,0.9)',
          borderRadius: 1,
          px: 1.5,
          py: 1,
          border: '1px solid rgba(255,255,255,0.12)'
        }}
      >
        {legendTypes.map((t) => (
          <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: NODE_TYPE_COLORS[t] ?? '#999'
              }}
            />
            <Typography component="span" variant="caption" sx={{ color: '#e0e0e0' }}>
              {NODE_TYPE_LABELS[t] ?? t}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default HoloGraphNetwork;
