/**
 * useBreadcrumbs Hook
 * Hook para gerenciar breadcrumbs de navegação
 */

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BreadcrumbItem } from '../components/DataDisplay/PageHeader';
import { getProductTerminology, getPublishersPageTitle } from '../config/productTerminology';

export interface BreadcrumbConfig {
  path: string;
  label: string;
  parent?: string;
}

const breadcrumbConfig: BreadcrumbConfig[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/quick-publish', label: 'Publicar em Tela', parent: '/dashboard' },
  { path: '/publish-board', label: 'Criar conteúdo', parent: '/quick-publish' },
  { path: '/menu-catalog', label: 'Cardápio', parent: '/dashboard' },
  { path: '/subscribers', label: 'Anunciantes', parent: '/dashboard' },
  { path: '/publishers', label: '__publishers__', parent: '/dashboard' },
  { path: '/locals', label: '__units__', parent: '/dashboard' },
  { path: '/campaigns', label: 'Campanhas', parent: '/dashboard' },
  { path: '/publish-totem', label: 'Publicar em Totem', parent: '/publish-totem' },
  { path: '/media', label: 'Mídias', parent: '/publish-totem' },
  { path: '/playlists', label: 'Playlists', parent: '/dashboard' },
  { path: '/totems', label: 'Totens', parent: '/dashboard' },
  { path: '/users', label: 'Usuários', parent: '/dashboard' },
  { path: '/billing', label: 'Faturamento e Cobrança', parent: '/dashboard' },
  { path: '/subscriber-contracts', label: 'Contratos de anunciantes', parent: '/billing' },
  { path: '/publisher-contracts', label: '__org_contracts__', parent: '/billing' },
  { path: '/dispatcher-manager', label: 'Dispatcher', parent: '/dashboard' },
  { path: '/playlist-mix', label: 'Playlist Mix', parent: '/dashboard' },
  { path: '/reports', label: 'Relatórios', parent: '/dashboard' },
  { path: '/analytics', label: 'Analytics', parent: '/dashboard' },
  { path: '/settings', label: 'Configurações', parent: '/dashboard' },
];

function billingBreadcrumbLabel(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = params.get('view');
  const t = getProductTerminology();
  if (view === 'subscriptions') return 'Assinaturas';
  if (view === 'invoices' && params.get('type') === 'subscriber') return 'Faturas de anunciantes';
  if (view === 'invoices' && params.get('type') === 'publisher') {
    return `Faturas da ${t.organization.toLowerCase()}`;
  }
  if (params.get('type') === 'publisher') {
    return `Faturas da ${t.organization.toLowerCase()}`;
  }
  if (params.has('dueFilter') || params.get('subscriberId') || params.get('subscriber_id')) {
    return 'Faturas de anunciantes';
  }
  return 'Visão geral';
}

function resolveBreadcrumbLabel(path: string, raw: string): string {
  if (raw === '__publishers__') return getPublishersPageTitle();
  if (raw === '__units__') return getProductTerminology().units;
  if (raw === '__org_contracts__') return getProductTerminology().organizationContracts;
  return raw;
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
          currentPath === '/billing'
            ? billingBreadcrumbLabel(location.search)
            : resolveBreadcrumbLabel(currentPath, config.label);
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
