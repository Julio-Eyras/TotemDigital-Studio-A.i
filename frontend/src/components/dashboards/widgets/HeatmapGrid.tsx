import React, { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Tooltip,
  Stack
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface HeatmapCellData {
  x: string;
  y: string;
  value: number;
  count?: number;
}

export interface HeatmapGridProps {
  title?: string;
  subheader?: React.ReactNode;
  cells: HeatmapCellData[];
  xLabel?: string;
  yLabel?: string;
  valueLabel?: string;
  minColor?: string;
  maxColor?: string;
  sx?: SxProps<Theme>;
  cellSx?: SxProps<Theme>;
}

function scale01(v: number, min: number, max: number): number {
  if (max - min <= 0) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

function mixColor(a: string, b: string, t: number): string {
  const hex = (s: string, offset: number) => parseInt(s.slice(offset, offset + 2), 16);
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const r = Math.round(hex(ah, 0) * (1 - t) + hex(bh, 0) * t);
  const g = Math.round(hex(ah, 2) * (1 - t) + hex(bh, 2) * t);
  const bl = Math.round(hex(ah, 4) * (1 - t) + hex(bh, 4) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({
  title,
  subheader,
  cells,
  xLabel,
  yLabel,
  valueLabel = 'Valor',
  minColor = '#E3F2FD',
  maxColor = '#1565C0',
  sx,
  cellSx
}) => {
  const { xs, ys, min, max } = useMemo(() => {
    const xSet = new Set<string>();
    const ySet = new Set<string>();
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    cells.forEach((c) => {
      xSet.add(c.x);
      ySet.add(c.y);
      if (c.value < mn) mn = c.value;
      if (c.value > mx) mx = c.value;
    });
    return {
      xs: Array.from(xSet),
      ys: Array.from(ySet),
      min: Number.isFinite(mn) ? mn : 0,
      max: Number.isFinite(mx) ? mx : 0
    };
  }, [cells]);

  const matrix = useMemo(() => {
    const m = new Map<string, HeatmapCellData>();
    cells.forEach((c) => m.set(`${c.x}||${c.y}`, c));
    return m;
  }, [cells]);

  if (xs.length === 0 || ys.length === 0) {
    return (
      <Card variant="outlined" sx={sx}>
        {title ? <CardHeader title={title} subheader={subheader} /> : null}
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Sem dados para exibir.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={sx}>
      {title ? <CardHeader title={title} subheader={subheader} /> : null}
      <CardContent>
        <Box sx={{ overflowX: 'auto' }}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ minWidth: 'fit-content', ...(yLabel ? { pl: 10 } : { pl: 2 }) }}
          >
            <Box width={yLabel ? 40 : 0} />
            {xs.map((x) => (
              <Box key={x} sx={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {x}
                </Typography>
              </Box>
            ))}
            {xLabel ? (
              <Box sx={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {xLabel}
                </Typography>
              </Box>
            ) : null}
          </Stack>

          {ys.map((y) => (
            <Stack direction="row" spacing={1} key={y} useFlexGap sx={{ minWidth: 'fit-content', mt: 1 }}>
              <Box sx={{ width: yLabel ? 88 : 8, pr: 1, display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ width: '100%', textAlign: 'right' }}>
                  {yLabel ? `${yLabel}: ${y}` : y}
                </Typography>
              </Box>
              {xs.map((x) => {
                const cell = matrix.get(`${x}||${y}`);
                const t = scale01(cell?.value ?? 0, min, max);
                const bg = cell ? mixColor(minColor, maxColor, t) : '#F5F5F5';
                const fg = t > 0.5 ? '#FFFFFF' : '#101010';
                return (
                  <Tooltip
                    key={`${x}-${y}`}
                    title={
                      <Box>
                        <Typography variant="body2">
                          {x} × {y}
                        </Typography>
                        <Typography variant="caption">
                          {valueLabel}: {cell?.value ?? 0}
                          {typeof cell?.count === 'number' ? ` · (n=${cell.count})` : ''}
                        </Typography>
                      </Box>
                    }
                    arrow
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 32,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 0.5,
                        backgroundColor: bg,
                        color: fg,
                        fontSize: 11,
                        fontWeight: 600,
                        userSelect: 'none',
                        ...(cellSx as object)
                      }}
                    >
                      {typeof cell?.count === 'number' ? cell.count : cell?.value ?? '–'}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default HeatmapGrid;
