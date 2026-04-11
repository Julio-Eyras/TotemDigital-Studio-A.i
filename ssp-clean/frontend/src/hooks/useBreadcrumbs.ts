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
  { path: '/subscribers', label: 'Subscribers', parent: '/dashboard' },
  { path: '/publishers', label: 'Publishers', parent: '/dashboard' },
  { path: '/campaigns', label: 'Campanhas', parent: '/dashboard' },
  { path: '/media', label: 'Mídias', parent: '/dashboard' },
  { path: '/playlists', label: 'Playlists', parent: '/dashboard' },
  { path: '/totems', label: 'Totens', parent: '/dashboard' },
  { path: '/users', label: 'Usuários', parent: '/dashboard' },
  { path: '/billing', label: 'Faturamento', parent: '/dashboard' },
  { path: '/reports', label: 'Relatórios', parent: '/dashboard' },
  { path: '/analytics', label: 'Analytics', parent: '/dashboard' },
  { path: '/settings', label: 'Configurações', parent: '/dashboard' },
];

export function useBreadcrumbs(customItems?: BreadcrumbItem[]): BreadcrumbItem[] {
  const location = useLocation();
  const navigate = useNavigate();

  const breadcrumbs = useMemo(() => {
    // Se houver items customizados, usar eles
    if (customItems && customItems.length > 0) {
      return customItems;
    }

    // Construir breadcrumbs baseado na rota atual
    const items: BreadcrumbItem[] = [];
    const pathParts = location.pathname.split('/').filter(Boolean);

    // Sempre adicionar Home
    items.push({
      label: 'Home',
      path: '/dashboard',
      onClick: () => navigate('/dashboard'),
    });

    // Construir caminho incremental
    let currentPath = '';
    pathParts.forEach((part, index) => {
      currentPath += `/${part}`;
      
      // Buscar configuração para este path
      const config = breadcrumbConfig.find((c) => c.path === currentPath);
      
      if (config) {
        items.push({
          label: config.label,
          path: currentPath,
          onClick: () => navigate(currentPath),
        });
      } else {
        // Se não houver config, usar o nome do path capitalizado
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
  }, [location.pathname, navigate, customItems]);

  return breadcrumbs;
}
