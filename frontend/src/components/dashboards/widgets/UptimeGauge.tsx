import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Stack,
  Chip
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

export interface UptimeGaugeProps {
  title?: string;
  subheader?: React.ReactNode;
  value: number;
  label?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  extraStats?: { label: string; value: string | number }[];
  size?: number;
  sx?: SxProps<Theme>;
}

function formatPct(v: number): string {
  const safe = Math.max(0, Math.min(100, v));
  const int = Math.round(safe * 10) / 10;
  return `${Number.isInteger(int) ? int.toFixed(0) : int.toFixed(1)}%`;
}

export const UptimeGauge: React.FC<UptimeGaugeProps> = ({
  title,
  subheader,
  value,
  label,
  warningThreshold = 97,
  criticalThreshold = 90,
  extraStats,
  size = 170,
  sx
}) => {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, value));
  const offset = c - (safe / 100) * c;
  const ok = value >= warningThreshold;
  const warn = value < warningThreshold && value >= criticalThreshold;
  const crit = value < criticalThreshold;
  const color = crit ? '#E53935' : warn ? '#FB8C00' : '#43A047';
  const Icon = crit ? ErrorIcon : warn ? WarningIcon : CheckCircleIcon;
  const chipColor = crit ? 'error' : warn ? 'warning' : 'success';
  return (
    <Card variant="outlined" sx={sx}>
      {title ? <CardHeader title={title} subheader={subheader} /> : null}
      <CardContent>
        <Stack direction="row" spacing={3} useFlexGap alignItems="center" justifyContent="center">
          <Box
            sx={{
              width: size,
              height: size,
              position: 'relative',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width={size} height={size}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#F5F5F5"
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 400ms ease' }}
              />
            </svg>
            <Stack
              spacing={0.25}
              sx={{ position: 'absolute', textAlign: 'center' }}
              alignItems="center"
            >
              <Typography sx={{ fontSize: size > 140 ? 30 : 22, fontWeight: 800, color }}>
                {formatPct(safe)}
              </Typography>
              {label ? (
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              ) : null}
              <Chip
                size="small"
                variant="outlined"
                color={chipColor}
                label={crit ? 'Crítico' : warn ? 'Atenção' : 'Saúdavel'}
                sx={{ mt: 0.5 }}
                icon={<Icon fontSize="inherit" />}
              />
            </Stack>
          </Box>
          {extraStats && extraStats.length ? (
            <Stack spacing={1.5} minWidth={140} useFlexGap>
              {extraStats.map((s, i) => (
                <Box key={`${s.label}-${i}`}>
                  <Typography variant="caption" color="text.secondary">
                    {s.label}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default UptimeGauge;
