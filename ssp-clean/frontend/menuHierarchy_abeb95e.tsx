/**
 * Menu Hierarchy Utility
 * Define estrutura hierárquica de menus por role
 */

import React from 'react';
import {
  Dashboard,
  People,
  Business,
  LocationOn,
  Tv,
  Computer,
  CloudUpload,
  Build,
  Payment,
  Assessment,
  Campaign,
  VideoLibrary,
  Settings,
  AdminPanelSettings,
  Warning,
  Link,
  QueueMusic,
  SmartToy,
  Shuffle,
  QrCode,
  AutoAwesome,
  Analytics,
  Description,
  Assignment,
  MonitorHeart,
  Timeline,
} from '@mui/icons-material';
import { UserRole, canAccess } from './rolePermissions';
import { UserFlags } from '../store/slices/authSlice';

export interface HierarchicalMenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  children?: HierarchicalMenuItem[];
  badge?: number;
  requiredFlag?: `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
}

/**
 * Filtra itens hierárquicos baseado em permissões (role e flags)
 */
function filterHierarchicalMenu(
  items: HierarchicalMenuItem[],
  userRole: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] {
  const filtered: HierarchicalMenuItem[] = [];
  
  for (const item of items) {
    // Verificar se o item principal tem acesso
    // canAccess(userRole, path, userFlags) - verifica role e flags automaticamente
    if (!canAccess(userRole, item.path, userFlags)) {
      continue; // Pular este item
    }
    
    // Verificar flag específica se necessário
    if (item.requiredFlag && userFlags && !userFlags[item.requiredFlag]) {
      continue; // Pular este item
    }

    // Filtrar children recursivamente
    let filteredChildren: HierarchicalMenuItem[] | undefined = undefined;
    if (item.children && item.children.length > 0) {
      filteredChildren = filterHierarchicalMenu(item.children, userRole, userFlags);
    }

    // Se não tem children ou todos foram filtrados, remover children
    if (!filteredChildren || filteredChildren.length === 0) {
      filtered.push({
        ...item,
        children: undefined, // Remover children vazios
      });
    } else {
      filtered.push({
        ...item,
        children: filteredChildren,
      });
    }
  }
  
  return filtered;
}

/**
 * Estrutura hierárquica de menus por role (com filtragem de permissões)
 */
export const getMenuHierarchyByRole = (
  role: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] => {
  let menu: HierarchicalMenuItem[] = [];
  
  switch (role) {
    case 'owner_system':
      menu = getOwnerSystemMenu();
      break;
    case 'admin_sql':
      menu = getAdminSqlMenu();
      break;
    case 'admin':
      menu = getAdminMenu();
      break;
    case 'operador_tecnico':
      menu = getOperadorTecnicoMenu();
      break;
    case 'operador_faturamento':
      menu = getOperadorFaturamentoMenu();
      break;
    case 'operador_comercial':
      menu = getOperadorComercialMenu();
      break;
    case 'operator':
      menu = getOperadorTecnicoMenu(); // Operator usa menu técnico
      break;
    case 'gerente_marketing':
    case 'editoracao':
    case 'visualizador':
      menu = getDefaultMenu(); // Usar menu padrão
      break;
    default:
      menu = getDefaultMenu();
  }

  // Aplicar filtragem baseada em permissões
  return filterHierarchicalMenu(menu, role, userFlags);
};

/**
 * Menu: OWNER_SYSTEM
 */
function getOwnerSystemMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard Sistema', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/admin',
      children: [
        {
          text: 'Usuários Sistema',
          icon: <People />,
          path: '/users',
          children: [
            { text: 'Listar Usuários', icon: <People />, path: '/users' },
            { text: 'Criar Usuário', icon: <People />, path: '/users/new' },
            { text: 'Gerenciar Roles', icon: <People />, path: '/users/roles' },
            { text: 'Gerenciar Flags', icon: <People />, path: '/users/flags' },
          ],
        },
        {
          text: '📢 Publicador',
          icon: <Business />,
          path: '/publishers',
          children: [
            { text: 'Manter Publicadores', icon: <Business />, path: '/publishers' },
            { text: 'Locais', icon: <LocationOn />, path: '/locals' },
            { text: 'Totens', icon: <Tv />, path: '/totems' },
            { text: 'Playlists de Totens', icon: <QueueMusic />, path: '/totem-playlists' },
            { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
          ],
        },
        {
          text: 'Assinantes',
          icon: <Business />,
          path: '/subscribers',
          children: [
            { text: 'Listar Assinantes', icon: <Business />, path: '/subscribers' },
            { text: 'Criar Assinante', icon: <Business />, path: '/subscribers/new' },
            { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
            { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
            { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
          ],
        },
        {
          text: 'Contratos',
          icon: <Description />,
          path: '/contracts',
          children: [
            { text: 'Listar Contratos', icon: <Description />, path: '/contracts' },
            { text: 'Contratos Ativos', icon: <Assignment />, path: '/contracts/active' },
            { text: 'Contratos Expirados', icon: <Warning />, path: '/contracts/expired' },
            { text: 'Contratos Assinantes', icon: <Description />, path: '/contracts?type=subscriber' },
            { text: 'Contratos Publicadores', icon: <Description />, path: '/contracts?type=publisher' },
          ],
        },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Assinantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        { text: 'Faturamento Assinantes', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento Publicador', icon: <Payment />, path: '/billing?type=publisher' },
        {
          text: 'Dispatcher-Totem',
          icon: <Shuffle />,
          path: '/dispatcher-manager',
          children: [
            { text: 'Gerenciar Dispatcher', icon: <Shuffle />, path: '/dispatcher-manager' },
            { text: 'Monitor Dispatcher', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
            { text: 'Timeline', icon: <Timeline />, path: '/dispatcher-manager?tab=timeline' },
          ],
        },
      ],
    },
    { text: 'Relatórios Globais', icon: <Assessment />, path: '/reports' },
    { text: 'Admin Tools', icon: <Build />, path: '/admin-tools' },
    { text: 'Configurações', icon: <Settings />, path: '/settings' },
  ];
}

/**
 * Menu: ADMIN_SQL
 */
function getAdminSqlMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/admin',
      children: [
        { text: 'Usuários Sistema', icon: <People />, path: '/users' },
        {
          text: '📢 Publicador',
          icon: <Business />,
          path: '/publishers',
          children: [
            { text: 'Manter Publicadores', icon: <Business />, path: '/publishers' },
            { text: 'Locais', icon: <LocationOn />, path: '/locals' },
            { text: 'Totens', icon: <Tv />, path: '/totems' },
            { text: 'Playlists de Totens', icon: <QueueMusic />, path: '/totem-playlists' },
            { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
          ],
        },
        {
          text: 'Assinantes',
          icon: <Business />,
          path: '/subscribers',
          children: [
            { text: 'Listar Assinantes', icon: <Business />, path: '/subscribers' },
            { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
            { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
          ],
        },
        {
          text: 'Contratos',
          icon: <Description />,
          path: '/contracts',
          children: [
            { text: 'Listar Contratos', icon: <Description />, path: '/contracts' },
            { text: 'Contratos Ativos', icon: <Assignment />, path: '/contracts/active' },
            { text: 'Contratos Expirados', icon: <Warning />, path: '/contracts/expired' },
            { text: 'Contratos Assinantes', icon: <Description />, path: '/contracts?type=subscriber' },
            { text: 'Contratos Publicadores', icon: <Description />, path: '/contracts?type=publisher' },
          ],
        },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Assinantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        { text: 'Faturamento Assinantes', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento Publicador', icon: <Payment />, path: '/billing?type=publisher' },
        {
          text: 'Dispatcher-Totem',
          icon: <Shuffle />,
          path: '/dispatcher-manager',
          children: [
            { text: 'Gerenciar Dispatcher', icon: <Shuffle />, path: '/dispatcher-manager' },
            { text: 'Monitor Dispatcher', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
            { text: 'Timeline', icon: <Timeline />, path: '/dispatcher-manager?tab=timeline' },
          ],
        },
      ],
    },
    { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
    { text: 'Admin Tools', icon: <Build />, path: '/admin-tools' },
    { text: 'Configurações', icon: <Settings />, path: '/settings' },
  ];
}

/**
 * Menu: ADMIN
 */
function getAdminMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/admin',
      children: [
        {
          text: 'Usuários Sistema',
          icon: <People />,
          path: '/users',
          children: [
            { text: 'Listar Usuários', icon: <People />, path: '/users' },
            { text: 'Criar Usuário', icon: <People />, path: '/users/new' },
            { text: 'Gerenciar Roles', icon: <People />, path: '/users/roles' },
            { text: 'Gerenciar Flags', icon: <People />, path: '/users/flags' },
          ],
        },
        {
          text: '📢 Publicador',
          icon: <Business />,
          path: '/publishers',
          children: [
            { text: 'Manter Publicadores', icon: <Business />, path: '/publishers' },
            { text: 'Locais', icon: <LocationOn />, path: '/locals' },
            { text: 'Totens', icon: <Tv />, path: '/totems' },
            { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
          ],
        },
        {
          text: 'Assinantes',
          icon: <Business />,
          path: '/subscribers',
          children: [
            { text: 'Listar Assinantes', icon: <Business />, path: '/subscribers' },
            { text: 'Criar Assinante', icon: <Business />, path: '/subscribers/new' },
            { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
            { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
            { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
          ],
        },
        {
          text: 'Contratos',
          icon: <Description />,
          path: '/contracts',
          children: [
            { text: 'Listar Contratos', icon: <Description />, path: '/contracts' },
            { text: 'Contratos Ativos', icon: <Assignment />, path: '/contracts/active' },
            { text: 'Contratos Expirados', icon: <Warning />, path: '/contracts/expired' },
            { text: 'Contratos Assinantes', icon: <Description />, path: '/contracts?type=subscriber' },
            { text: 'Contratos Publicadores', icon: <Description />, path: '/contracts?type=publisher' },
          ],
        },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Assinantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        {
          text: 'Acessos',
          icon: <Link />,
          path: '/subscriber-publisher-access',
          children: [
            { text: 'Acessos Subscriber-Publisher', icon: <AdminPanelSettings />, path: '/subscriber-publisher-access' },
            { text: 'Acessos Expirando', icon: <Warning />, path: '/subscriber-access-expiring' },
          ],
        },
        { text: 'Faturamento Assinantes', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento Publicador', icon: <Payment />, path: '/billing?type=publisher' },
      ],
    },
    { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
  ];
}

/**
 * Menu: OPERADOR_TECNICO
 */
function getOperadorTecnicoMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard Técnico', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Totens',
      icon: <Tv />,
      path: '/totems',
      requiredFlag: 'flag_smart_0',
      children: [
        { text: 'Listar Totens', icon: <Tv />, path: '/totems' },
        { text: 'Status Técnico', icon: <Tv />, path: '/totems/status' },
        { text: 'Configurações', icon: <Settings />, path: '/totems/config' },
      ],
    },
    {
      text: 'Smart TVs',
      icon: <Tv />,
      path: '/smart-tvs',
      requiredFlag: 'flag_smart_0',
      children: [
        { text: 'Listar Smart TVs', icon: <Tv />, path: '/smart-tvs' },
        { text: 'Status por Totem', icon: <Tv />, path: '/smart-tvs/by-totem' },
        { text: 'Configurações', icon: <Settings />, path: '/smart-tvs/config' },
      ],
    },
    {
      text: 'Players',
      icon: <Computer />,
      path: '/players',
      requiredFlag: 'flag_smart_0',
      children: [
        { text: 'Listar Players', icon: <Computer />, path: '/players' },
        { text: 'Status', icon: <Computer />, path: '/players/status' },
      ],
    },
    {
      text: 'OTA Updates',
      icon: <CloudUpload />,
      path: '/ota-updates',
      requiredFlag: 'flag_smart_1',
      children: [
        { text: 'Gerenciar Atualizações', icon: <CloudUpload />, path: '/ota-updates' },
        { text: 'Histórico', icon: <Assessment />, path: '/ota-updates/history' },
      ],
    },
    { text: 'Admin Tools', icon: <Build />, path: '/admin-tools', requiredFlag: 'flag_smart_2' },
    { text: 'Monitor Dispatcher', icon: <MonitorHeart />, path: '/dispatcher-monitor', requiredFlag: 'flag_smart_2' },
  ];
}

/**
 * Menu: OPERADOR_FATURAMENTO
 */
function getOperadorFaturamentoMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard Faturamento', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/admin',
      requiredFlag: 'flag_smart_3',
      children: [
        {
          text: 'Contratos',
          icon: <Description />,
          path: '/contracts',
          requiredFlag: 'flag_smart_5',
          children: [
            { text: 'Listar Contratos', icon: <Description />, path: '/contracts' },
            { text: 'Contratos Ativos', icon: <Assignment />, path: '/contracts/active' },
            { text: 'Contratos Expirados', icon: <Warning />, path: '/contracts/expired' },
            { text: 'Contratos Assinantes', icon: <Description />, path: '/contracts?type=subscriber' },
            { text: 'Contratos Publicadores', icon: <Description />, path: '/contracts?type=publisher' },
          ],
        },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Assinantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        { text: 'Faturamento Assinantes', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento Publicador', icon: <Payment />, path: '/billing?type=publisher' },
      ],
    },
    { text: 'Relatórios Financeiros', icon: <Assessment />, path: '/reports' },
  ];
}

/**
 * Menu: OPERADOR_COMERCIAL
 */
function getOperadorComercialMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard Comercial', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/admin',
      children: [
        {
          text: '📢 Publicador',
          icon: <Business />,
          path: '/publishers',
          children: [
            { text: 'Manter Publicadores', icon: <Business />, path: '/publishers' },
            { text: 'Detalhes', icon: <Business />, path: '/publishers/details' },
          ],
        },
        {
          text: 'Assinantes',
          icon: <Business />,
          path: '/subscribers',
          children: [
            { text: 'Listar Assinantes', icon: <Business />, path: '/subscribers' },
            { text: 'Criar Assinante', icon: <Business />, path: '/subscribers/new' },
            { text: 'Detalhes', icon: <Business />, path: '/subscribers/details' },
          ],
        },
        {
          text: 'Contratos',
          icon: <Description />,
          path: '/contracts',
          children: [
            { text: 'Listar Contratos', icon: <Description />, path: '/contracts' },
            { text: 'Contratos Ativos', icon: <Assignment />, path: '/contracts/active' },
            { text: 'Contratos Expirados', icon: <Warning />, path: '/contracts/expired' },
            { text: 'Contratos Assinantes', icon: <Description />, path: '/contracts?type=subscriber' },
            { text: 'Contratos Publicadores', icon: <Description />, path: '/contracts?type=publisher' },
          ],
        },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Assinantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        { text: 'Faturamento Assinantes', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento Publicador', icon: <Payment />, path: '/billing?type=publisher' },
      ],
    },
    {
      text: 'Campanhas',
      icon: <Campaign />,
      path: '/campaigns',
      children: [
        { text: 'Listar Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Estatísticas', icon: <Assessment />, path: '/campaigns/stats' },
      ],
    },
    { text: 'Relatórios Comerciais', icon: <Assessment />, path: '/reports' },
  ];
}

/**
 * Menu padrão (para roles não especificadas)
 */
function getDefaultMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Mídia', icon: <VideoLibrary />, path: '/media' },
    { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
    { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  ];
}
