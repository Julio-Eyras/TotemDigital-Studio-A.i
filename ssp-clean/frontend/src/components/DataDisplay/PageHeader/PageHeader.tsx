/**
 * PageHeader Component - SmartSignage Pro v2.1
 * Header padronizado para páginas com breadcrumbs e ações
 */

import React from 'react';
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
  return (
    <Box
      sx={{
        marginBottom: 3,
        paddingBottom: 2,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNext fontSize="small" />}
          sx={{ marginBottom: 1 }}
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            
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
          <Typography variant="h4" component="h1" gutterBottom>
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
