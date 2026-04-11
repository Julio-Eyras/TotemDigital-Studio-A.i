/**
 * DataTable Component - SmartSignage Pro v2.1
 * Tabela avançada reutilizável com ordenação, filtros, seleção e exportação
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  Paper,
  Box,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Button,
  Stack,
  Typography,
  Chip,
  Pagination,
} from '@mui/material';
import {
  Search,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  GetApp,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';

export interface DataTableColumn<T = any> {
  id: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
}

export interface DataTableAction<T = any> {
  label: string;
  icon: React.ReactNode;
  onClick: (row: T) => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  show?: (row: T) => boolean;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  actions?: DataTableAction<T>[];
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  onExport?: (format: 'csv' | 'pdf' | 'excel') => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function DataTable<T extends { id?: number | string }>({
  data,
  columns,
  actions = [],
  selectable = false,
  onSelectionChange,
  sortable = true,
  filterable = false,
  exportable = false,
  onExport,
  pagination,
  loading = false,
  emptyMessage = 'Nenhum dado encontrado',
  onRowClick,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortBy || !sortable) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortBy];
      const bValue = (b as any)[sortBy];

      if (aValue === bValue) return 0;

      const comparison = aValue > bValue ? 1 : -1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortBy, sortOrder, sortable]);

  // Filtering
  const filteredData = useMemo(() => {
    if (!filterable || Object.keys(filters).length === 0) return sortedData;

    return sortedData.filter((row) => {
      return columns.every((col) => {
        if (!filters[col.id]) return true;
        const value = String((row as any)[col.id] || '').toLowerCase();
        return value.includes(filters[col.id].toLowerCase());
      });
    });
  }, [sortedData, filters, filterable, columns]);

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allIds = new Set(filteredData.map((row) => row.id || ''));
      setSelected(allIds);
      onSelectionChange?.(filteredData);
    } else {
      setSelected(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    const newSelected = new Set(selected);
    const rowId = row.id || '';

    if (checked) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }

    setSelected(newSelected);
    const selectedRows = filteredData.filter((r) => newSelected.has(r.id || ''));
    onSelectionChange?.(selectedRows);
  };

  const handleExport = (format: 'csv' | 'pdf' | 'excel') => {
    onExport?.(format);
    setExportMenuAnchor(null);
  };

  const isSelected = (row: T) => {
    return selected.has(row.id || '');
  };

  const selectedCount = selected.size;

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 2,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {filterable && (
            <TextField
              size="small"
              placeholder="Buscar..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />
          )}

          {selectable && selectedCount > 0 && (
            <Chip
              label={`${selectedCount} selecionado(s)`}
              onDelete={() => {
                setSelected(new Set());
                onSelectionChange?.([]);
              }}
              color="primary"
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          {exportable && (
            <>
              <Button
                startIcon={<GetApp />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                size="small"
              >
                Exportar
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
              >
                <MenuItem onClick={() => handleExport('csv')}>CSV</MenuItem>
                <MenuItem onClick={() => handleExport('excel')}>Excel</MenuItem>
                <MenuItem onClick={() => handleExport('pdf')}>PDF</MenuItem>
              </Menu>
            </>
          )}
        </Stack>
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedCount > 0 && selectedCount < filteredData.length}
                    checked={filteredData.length > 0 && selectedCount === filteredData.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}

              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  width={column.width}
                  sx={{ fontWeight: 600 }}
                >
                  {sortable && column.sortable !== false ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortOrder : 'asc'}
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}

              {actions.length > 0 && <TableCell align="right">Ações</TableCell>}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  align="center"
                  sx={{ padding: 4 }}
                >
                  <Typography color="text.secondary">Carregando...</Typography>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  align="center"
                  sx={{ padding: 4 }}
                >
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => {
                const rowSelected = isSelected(row);
                return (
                  <TableRow
                    key={row.id || Math.random()}
                    hover
                    selected={rowSelected}
                    onClick={() => onRowClick?.(row)}
                    sx={{
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={rowSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectRow(row, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}

                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.render
                          ? column.render((row as any)[column.id], row)
                          : String((row as any)[column.id] || '')}
                      </TableCell>
                    ))}

                    {actions.length > 0 && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {actions
                            .filter((action) => !action.show || action.show(row))
                            .map((action, index) => (
                              <Tooltip key={index} title={action.label}>
                                <IconButton
                                  size="small"
                                  color={action.color || 'default'}
                                  onClick={() => action.onClick(row)}
                                >
                                  {action.icon}
                                </IconButton>
                              </Tooltip>
                            ))}
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Mostrando {((pagination.page - 1) * pagination.limit) + 1} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
            {pagination.total} resultados
          </Typography>

          <Pagination
            count={Math.ceil(pagination.total / pagination.limit)}
            page={pagination.page}
            onChange={(_, page) => pagination.onPageChange(page)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
}

export default DataTable;
