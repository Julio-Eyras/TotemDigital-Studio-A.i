import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Stack,
  useTheme
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import type { SxProps, Theme } from '@mui/material/styles';

export interface TimelinePoint {
  timestamp: string;
  value: number;
  label?: string;
  group?: string;
}

export interface TimelineChartProps {
  title?: string;
  subheader?: React.ReactNode;
  points: TimelinePoint[];
  kind?: 'line' | 'bar';
  xDataKey?: string;
  yLabel?: string;
  showLegend?: boolean;
  height?: number;
  colorByGroup?: Record<string, string>;
  emptyMessage?: string;
  sx?: SxProps<Theme>;
}

function defaultFormatTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return ts;
    const isSameDay = true;
    const day = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const hh = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    return isSameDay ? hh : `${day} ${hh}`;
  } catch {
    return ts;
  }
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  title,
  subheader,
  points,
  kind = 'line',
  xDataKey = 'timestamp',
  yLabel,
  showLegend,
  height = 280,
  colorByGroup,
  emptyMessage = 'Sem dados para exibir.',
  sx
}) => {
  const theme = useTheme();

  const groups = React.useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => set.add(p.group ?? 'default'));
    return Array.from(set);
  }, [points]);

  const normalized = React.useMemo(() => {
    if (groups.length <= 1) {
      return points.map((p) => ({
        [xDataKey]: p.label ?? defaultFormatTs(p.timestamp),
        value: p.value,
        default: p.value
      }));
    }
    const map = new Map<string, Record<string, unknown>>();
    points.forEach((p) => {
      const k = p.label ?? defaultFormatTs(p.timestamp);
      const rec = map.get(k) ?? { [xDataKey]: k };
      rec[p.group ?? 'default'] = p.value;
      rec[`_ts_${p.group ?? 'default'}`] = p.timestamp;
      map.set(k, rec);
    });
    return Array.from(map.values());
  }, [groups, points, xDataKey]);

  if (!points.length) {
    return (
      <Card variant="outlined" sx={sx}>
        {title ? <CardHeader title={title} subheader={subheader} /> : null}
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const palette = [
    theme.palette.primary.main,
    theme.palette.secondary?.main ?? '#7B1FA2',
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main
  ];

  return (
    <Card variant="outlined" sx={sx}>
      {title ? <CardHeader title={title} subheader={subheader} /> : null}
      <CardContent>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1 }}>
          {yLabel ? (
            <Typography variant="caption" color="text.secondary">
              {yLabel}
            </Typography>
          ) : null}
        </Stack>
        <Box sx={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'bar' ? (
              <BarChart data={normalized}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey={xDataKey} tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
                <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
                {groups.map((g, i) => (
                  <Bar
                    key={g}
                    dataKey={g}
                    name={g === 'default' ? yLabel ?? 'Valor' : g}
                    fill={colorByGroup?.[g] ?? palette[i % palette.length]}
                    radius={[6, 6, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={normalized}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey={xDataKey} tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
                <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
                {groups.map((g, i) => (
                  <Line
                    key={g}
                    type="monotone"
                    dataKey={g}
                    name={g === 'default' ? yLabel ?? 'Valor' : g}
                    stroke={colorByGroup?.[g] ?? palette[i % palette.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TimelineChart;
