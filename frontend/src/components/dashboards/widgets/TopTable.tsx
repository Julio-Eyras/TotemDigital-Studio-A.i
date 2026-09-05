import React, { useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
  TableContainer,
  Typography,
  Chip,
  Box,
  LinearProgress
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface TopTableColumn<TRow> {
  key: keyof TRow | string;
  header: string;
  align?: 'left' | 'right' | 'center';
  format?: (row: TRow, value: unknown) => React.ReactNode;
  numeric?: boolean;
  sortable?: boolean;
  progressBar?: {
    minKey?: keyof TRow;
    maxKey?: keyof TRow;
    valueKey: keyof TRow;
    max?: number;
  };
  width?: number | string;
}

export interface TopTableProps<TRow extends object> {
  title?: string;
  subheader?: React.ReactNode;
  columns: TopTableColumn<TRow>[];
  rows: TRow[];
  defaultOrderBy?: keyof TRow | string;
  defaultOrder?: 'asc' | 'desc';
  maxRows?: number;
  emptyMessage?: string;
  sx?: SxProps<Theme>;
  stickyHeader?: boolean;
  dense?: boolean;
  sizeTag?: string;
}

type Order = 'asc' | 'desc';

function cmp(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

export function TopTable<TRow extends object>(props: TopTableProps<TRow>): JSX.Element {
  const {
    title,
    subheader,
    columns,
    rows,
    defaultOrderBy,
    defaultOrder = 'desc',
    maxRows,
    emptyMessage = 'Sem registros.',
    sx,
    stickyHeader = false,
    dense = true,
    sizeTag
  } = props;

  const [orderBy, setOrderBy] = React.useState<keyof TRow | string | undefined>(defaultOrderBy);
  const [order, setOrder] = React.useState<Order>(defaultOrder);

  const sortedRows = useMemo(() => {
    const base = [...rows];
    if (orderBy) {
      base.sort((a, b) => {
        const av = (a as Record<string, unknown>)[orderBy as string];
        const bv = (b as Record<string, unknown>)[orderBy as string];
        return order === 'asc' ? cmp(av, bv) : cmp(bv, av);
      });
    }
    return typeof maxRows === 'number' ? base.slice(0, maxRows) : base;
  }, [rows, orderBy, order, maxRows]);

  const toggleSort = (col: TopTableColumn<TRow>) => {
    if (!col.sortable) return;
    if (orderBy === col.key) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(col.key);
      setOrder(col.numeric ? 'desc' : 'asc');
    }
  };

  const renderCell = (col: TopTableColumn<TRow>, row: TRow): React.ReactNode => {
    const raw = (row as Record<string, unknown>)[col.key as string];
    if (col.format) return col.format(row, raw);
    if (col.progressBar) {
      const pb = col.progressBar;
      const v = Number((row as Record<string, unknown>)[pb.valueKey as string]) || 0;
      const min = pb.minKey ? Number((row as Record<string, unknown>)[pb.minKey as string]) || 0 : 0;
      const max = pb.maxKey ? Number((row as Record<string, unknown>)[pb.maxKey as string]) || 0 : pb.max ?? 100;
      const pct = max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0;
      return (
        <Box sx={{ minWidth: 120 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {typeof raw === 'number' ? (Number.isInteger(raw) ? raw : raw.toFixed(2)) : String(raw ?? '–')}
          </Typography>
          <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, borderRadius: 1 }} />
        </Box>
      );
    }
    if (typeof raw === 'number') {
      return Number.isInteger(raw) ? raw : raw.toFixed(2);
    }
    return String(raw ?? '–');
  };

  return (
    <Card variant="outlined" sx={sx}>
      {title || sizeTag ? (
        <CardHeader
          title={title}
          subheader={subheader}
          action={
            sizeTag ? (
              <Chip
                label={sizeTag}
                size="small"
                variant="outlined"
                color="primary"
              />
            ) : undefined
          }
        />
      ) : null}
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <TableContainer sx={{ maxHeight: stickyHeader ? 480 : undefined }}>
          <Table
            size={dense ? 'small' : 'medium'}
            stickyHeader={stickyHeader}
          >
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={String(col.key)}
                    align={col.align ?? (col.numeric ? 'right' : 'left')}
                    sortDirection={orderBy === col.key ? order : false}
                    sx={{
                      fontWeight: 700,
                      bgcolor: (t) => t.palette.action.hover,
                      width: col.width
                    }}
                  >
                    {col.sortable ? (
                      <TableSortLabel
                        active={orderBy === col.key}
                        direction={orderBy === col.key ? order : 'asc'}
                        onClick={() => toggleSort(col)}
                      >
                        {col.header}
                      </TableSortLabel>
                    ) : (
                      col.header
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={String(col.key)}
                        align={col.align ?? (col.numeric ? 'right' : 'left')}
                        sx={{ verticalAlign: 'middle' }}
                      >
                        {renderCell(col, row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default TopTable;
