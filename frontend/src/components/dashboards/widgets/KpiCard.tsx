import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box,
  Tooltip,
  LinearProgress
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import type { SxProps, Theme } from '@mui/material/styles';

export interface KpiCardProps {
  title: string;
  value: number;
  unit?: string;
  previous?: number;
  delta?: number;
  deltaPercent?: number;
  trend?: 'up' | 'down' | 'flat';
  description?: string;
  progress?: number;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  sx?: SxProps<Theme>;
}

function formatNumber(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

const TREND_COLOR = {
  up: 'success.main',
  down: 'error.main',
  flat: 'text.secondary'
} as const;

const CHIP_COLOR = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info'
} as const;

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  unit,
  previous,
  delta,
  deltaPercent,
  trend,
  description,
  progress,
  color = 'primary',
  sx
}) => {
  const TrendIcon = trend === 'up' ? TrendingUpIcon : trend === 'down' ? TrendingDownIcon : TrendingFlatIcon;
  const valueStr = `${formatNumber(value)}${unit ? ` ${unit}` : ''}`;
  const deltaStr =
    typeof deltaPercent === 'number'
      ? `${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(2)}%`
      : typeof delta === 'number'
        ? `${delta >= 0 ? '+' : ''}${formatNumber(delta)}`
        : undefined;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, ...sx }}>
      <CardContent sx={{ pb: '16px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box minWidth={0} flex="1">
            <Typography variant="caption" color="text.secondary" noWrap>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }} noWrap>
              {valueStr}
            </Typography>
          </Box>
          {description ? (
            <Tooltip title={description} arrow placement="top">
              <Chip
                label={<TrendIcon fontSize="small" />}
                size="small"
                color={CHIP_COLOR[color]}
                variant="outlined"
                sx={{ minWidth: 32, flexShrink: 0 }}
              />
            </Tooltip>
          ) : null}
        </Stack>

        {deltaStr || typeof previous === 'number' ? (
          <Stack direction="row" spacing={1} alignItems="center" mt={1.5} useFlexGap>
            {trend ? (
              <TrendIcon sx={{ color: TREND_COLOR[trend], fontSize: 18 }} />
            ) : null}
            {deltaStr ? (
              <Typography
                variant="body2"
                sx={{ color: trend ? TREND_COLOR[trend] : 'text.primary', fontWeight: 600 }}
              >
                {deltaStr}
              </Typography>
            ) : null}
            {typeof previous === 'number' ? (
              <Typography variant="caption" color="text.secondary">
                vs. {formatNumber(previous)} anterior
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        {typeof progress === 'number' ? (
          <Box mt={2}>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, progress))}
              color={color === 'primary' ? 'primary' : color}
            />
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default KpiCard;
