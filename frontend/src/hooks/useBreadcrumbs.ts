/**
 * useBreadcrumbs Hook
 * Hook para gerenciar breadcrumbs de navegação
 */

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BreadcrumbItem } from '../components/DataDisplay/PageHeader';

export interface BreadcrumbConfig {
  path: string;
  label: string;
  parent?: string;
}

const breadcrumbConfig: BreadcrumbConfig[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/quick-publish', label: 'Publicar em Tela', parent: '/dashboard' },
  { path: '/subscribers', label: 'Anunciantes', parent: '/dashboard' },
  { path: '/publishers', label: 'Publishers', parent: '/dashboard' },
  { path: '/campaigns', label: 'Campanhas', parent: '/dashboard' },
  { path: '/media', label: 'Mídias', parent: '/dashboard' },
  { path: '/playlists', label: 'Playlists', parent: '/dashboard' },
  { path: '/totems', label: 'Totens', parent: '/dashboard' },
  { path: '/users', label: 'Usuários', parent: '/dashboard' },
  { path: '/billing', label: 'Faturamento e Cobrança', parent: '/dashboard' },
  { path: '/dispatcher-manager', label: 'Dispatcher', parent: '/dashboard' },
  { path: '/playlist-mix', label: 'Playlist Mix', parent: '/dashboard' },
  { path: '/reports', label: 'Relatórios', parent: '/dashboard' },
  { path: '/analytics', label: 'Analytics', parent: '/dashboard' },
  { path: '/settings', label: 'Configurações', parent: '/dashboard' },
];

function billingBreadcrumbLabel(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const type = params.get('type');
  if (type === 'subscriber') return 'Faturamento — Anunciantes';
  if (type === 'publisher') return 'Faturamento — Exibidores';
  if (params.has('dueFilter') || params.get('subscriberId') || params.get('subscriber_id')) {
    return 'Faturamento — Anunciantes';
  }
  return 'Faturamento — Visão geral';
}

export function useBreadcrumbs(customItems?: BreadcrumbItem[]): BreadcrumbItem[] {
  const location = useLocation();
  const navigate = useNavigate();

  const breadcrumbs = useMemo(() => {
    if (customItems && customItems.length > 0) {
      return customItems;
    }

    const items: BreadcrumbItem[] = [];
    const pathParts = location.pathname.split('/').filter(Boolean);

    items.push({
      label: 'Home',
      path: '/dashboard',
      onClick: () => navigate('/dashboard'),
    });

    let currentPath = '';
    pathParts.forEach((part) => {
      currentPath += `/${part}`;

      const config = breadcrumbConfig.find((c) => c.path === currentPath);
      if (config) {
        const label =
          currentPath === '/billing' ? billingBreadcrumbLabel(location.search) : config.label;
        items.push({
          label,
          path: currentPath + (currentPath === '/billing' ? location.search : ''),
          onClick: () =>
            navigate(currentPath + (currentPath === '/billing' ? location.search : '')),
        });
      } else {
        const label = part
          .split('-')
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' ');
        items.push({
          label,
          path: currentPath,
          onClick: () => navigate(currentPath),
        });
      }
    });

    return items;
  }, [location.pathname, location.search, navigate, customItems]);

  return breadcrumbs;
}
