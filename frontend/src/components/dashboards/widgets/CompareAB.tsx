import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Box,
  Stack,
  LinearProgress,
  Chip,
  useTheme
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';

export interface CompareABEntry {
  label: string;
  before: number;
  after: number;
  deltaPercent?: number;
  metric?: string;
}

export interface CompareABProps {
  title?: string;
  subheader?: React.ReactNode;
  entries: CompareABEntry[];
  unit?: string;
  sx?: SxProps<Theme>;
}

function fmt(v: number, unit?: string): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M${unit ? ` ${unit}` : ''}`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}k${unit ? ` ${unit}` : ''}`;
  if (Number.isInteger(v)) return `${v}${unit ? ` ${unit}` : ''}`;
  return `${v.toFixed(2)}${unit ? ` ${unit}` : ''}`;
}

export const CompareAB: React.FC<CompareABProps> = ({
  title,
  subheader,
  entries,
  unit,
  sx
}) => {
  const theme = useTheme();
  if (!entries.length) {
    return (
      <Card variant="outlined" sx={sx}>
        {title ? <CardHeader title={title} subheader={subheader} /> : null}
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Sem comparações disponíveis.
          </Typography>
        </CardContent>
      </Card>
    );
  }
  const maxValue = Math.max(...entries.flatMap((e) => [Math.abs(e.before), Math.abs(e.after), 1]));
  return (
    <Card variant="outlined" sx={sx}>
      {title ? <CardHeader title={title} subheader={subheader} /> : null}
      <CardContent>
        <Stack spacing={2.5}>
          {entries.map((e, idx) => {
            const delta = e.deltaPercent ?? (e.before === 0 ? 0 : ((e.after - e.before) / Math.abs(e.before)) * 100);
            const up = delta > 0.01;
            const down = delta < -0.01;
            const color = up
              ? theme.palette.success.main
              : down
                ? theme.palette.error.main
                : theme.palette.text.secondary;
            const Icon = up ? ArrowUpwardIcon : down ? ArrowDownwardIcon : RemoveIcon;
            const beforePct = Math.max(6, (Math.abs(e.before) / maxValue) * 100);
            const afterPct = Math.max(6, (Math.abs(e.after) / maxValue) * 100);
            return (
              <Box key={`${e.label}-${idx}`}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                    {e.label}
                    {e.metric ? (
                      <Typography component="span" color="text.secondary" variant="caption" sx={{ ml: 0.75 }}>
                        · {e.metric}
                      </Typography>
                    ) : null}
                  </Typography>
                  <Chip
                    label={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Icon fontSize="inherit" />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {delta >= 0 ? '+' : ''}
                          {delta.toFixed(2)}%
                        </Typography>
                      </Stack>
                    }
                    size="small"
                    sx={{ color, borderColor: color, flexShrink: 0 }}
                    variant="outlined"
                  />
                </Stack>
                <Stack direction="row" spacing={3} mt={1} useFlexGap alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      Antes: {fmt(e.before, unit)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={beforePct}
                      color="inherit"
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        mt: 0.5,
                        bgcolor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': {
                          bgcolor: theme.palette.grey[500]
                        }
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      Depois: {fmt(e.after, unit)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={afterPct}
                      color="inherit"
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        mt: 0.5,
                        bgcolor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': { bgcolor: color }
                      }}
                    />
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default CompareAB;
