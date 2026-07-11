/**
 * PageHeader Component - SmartSignage Pro v2.1
 * Header padronizado para páginas com breadcrumbs e ações
 */

import React from 'react';
import { useMemo } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  NavigateNext,
  Refresh,
  Settings,
  MoreVert,
} from '@mui/icons-material';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
}

export interface PageHeaderAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: PageHeaderAction[];
  onRefresh?: () => void;
  loading?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions = [],
  onRefresh,
  loading = false,
}) => {
  const navigate = useNavigate();

  const normalizedBreadcrumbs = useMemo(() => {
    const defaultBreadcrumbs: BreadcrumbItem[] = [
      {
        label: 'Home',
        path: '/dashboard',
        onClick: () => navigate('/dashboard'),
      },
      {
        label: title,
      },
    ];

    const source = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : defaultBreadcrumbs;
    const compacted = source.filter((item) => String(item?.label || '').trim().length > 0);

    const deduped: BreadcrumbItem[] = [];
    compacted.forEach((item) => {
      const currentLabel = String(item.label).trim().toLowerCase();
      const prevLabel = deduped.length > 0 ? String(deduped[deduped.length - 1].label).trim().toLowerCase() : '';
      if (currentLabel !== prevLabel) {
        deduped.push(item);
      }
    });

    return deduped;
  }, [breadcrumbs, title, navigate]);

  return (
    <Box
      sx={{
        marginBottom: 2,
        paddingBottom: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Breadcrumbs */}
      {normalizedBreadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" />}
          sx={{
            marginBottom: 1,
            maxWidth: '100%',
            '& .MuiBreadcrumbs-ol': { flexWrap: 'wrap' },
          }}
        >
          {normalizedBreadcrumbs.map((item, index) => {
            const isLast = index === normalizedBreadcrumbs.length - 1;
            
            if (isLast || !item.path) {
              return (
                <Typography key={index} color="text.primary">
                  {item.label}
                </Typography>
              );
            }
            
            return (
              <Link
                key={index}
                component="button"
                variant="body2"
                onClick={item.onClick}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}

      {/* Title and Actions */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1} alignItems="center">
          {onRefresh && (
            <Tooltip title="Atualizar">
              <IconButton
                onClick={onRefresh}
                disabled={loading}
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
          )}

          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'contained'}
              color={action.color || 'primary'}
              startIcon={action.icon}
              onClick={action.onClick}
              size="small"
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default PageHeader;
