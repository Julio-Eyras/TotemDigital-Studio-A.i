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
  ViewTimeline,
  BugReport,
  Traffic,
  Add,
  Storefront,
} from '@mui/icons-material';
import { UserRole, canAccess } from './rolePermissions';
import { UserFlags } from '../store/slices/authSlice';
import { DASHBOARD_COMMERCIAL_FOCUS } from '../config/featureFlags';
import { getInstallationCapabilities } from '../config/installationCapabilities';
import { isStudioMode } from '../config/studioMode';

/** Pro com dashboard comercial: menos ruído técnico no menu (alinhado à Fase 5 do roadmap V3x). */
const isCommercialProMenu = (): boolean => {
  const caps = getInstallationCapabilities();
  return DASHBOARD_COMMERCIAL_FOCUS && caps.multiAgency;
};

export interface HierarchicalMenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  children?: HierarchicalMenuItem[];
  badge?: number;
  requiredFlag?: `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
  /** Oculto no menu compacto (funcionalidade reservada para evolução Pro). */
  hiddenInCompact?: boolean;
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
    if (isStudioMode() && item.hiddenInCompact) {
      continue;
    }

    // Verificar se o item principal tem acesso
    // canAccess(userRole, path, userFlags) - verifica role e flags automaticamente
    const pathKey = (item.path || '').split('?')[0] || '/';
    if (!canAccess(userRole, pathKey, userFlags)) {
      continue; // Pular este item
    }
    
    // Verificar flag específica se necessário
    // Para roles administrativas (owner_system, admin_sql, admin), não bloquear por flag
    const isAdminRole = userRole === 'owner_system' || userRole === 'admin_sql' || userRole === 'admin';
    if (item.requiredFlag && userFlags && !userFlags[item.requiredFlag] && !isAdminRole) {
      continue; // Pular este item apenas se não for role administrativa
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

/** Subitens de Faturamento e Cobrança (anunciantes + exibidor/repasse quando includePublisher). */
function getBillingMenuChildren(includePublisher: boolean): HierarchicalMenuItem[] {
  const children: HierarchicalMenuItem[] = [
    { text: 'Visão geral', icon: <Payment />, path: '/billing?view=plans' },
    { text: 'Anunciantes', icon: <People />, path: '/billing?type=subscriber&view=invoices' },
  ];
  if (includePublisher) {
    children.push({
      text: 'Exibidores',
      icon: <Business />,
      path: '/billing?type=publisher&view=invoices',
    });
  }
  return children;
}

function getBillingMenuBlock(includePublisher: boolean): HierarchicalMenuItem {
  return {
    text: 'Faturamento e Cobrança',
    icon: <Payment />,
    path: '/billing',
    requiredFlag: 'flag_smart_3',
    children: getBillingMenuChildren(includePublisher),
  };
}

/** Submenus Playlist Mix (mix por totem, regras, analytics) — agrupados sob Dispatcher para debug. */
function getDispatcherPlaylistMixChildren(): HierarchicalMenuItem[] {
  return [
    { text: 'Mix por totem', icon: <Shuffle />, path: '/playlist-mix' },
    { text: 'Grupos', icon: <Assignment />, path: '/playlist-mix/groups' },
    { text: 'Regras', icon: <Build />, path: '/playlist-mix/rules' },
    { text: 'Analytics', icon: <Analytics />, path: '/playlist-mix/analytics' },
  ];
}

/**
 * Menu lateral modo TotemDigital Compact (mono publicador): ordem e rótulos pedidos pelo produto.
 * Sem ramo "Exibidores"; locais, totens e Smart TVs ficam em Administração. Planos & Acessos: item único como no compacto original.
 */
function getCompactReorganizedAdminMenu(): HierarchicalMenuItem[] {
  const dispatcherBlock: HierarchicalMenuItem = {
    text: 'Dispatcher',
    icon: <MonitorHeart />,
    path: '/dispatcher-manager',
    requiredFlag: 'flag_smart_2',
    children: [
      { text: 'Gerenciar', icon: <Shuffle />, path: '/dispatcher-manager' },
      { text: 'Monitor', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
      { text: 'Debug Online', icon: <BugReport />, path: '/dispatcher-debug' },
      { text: 'TimeLine', icon: <ViewTimeline />, path: '/dispatcher-manager?tab=timeline' },
      {
        text: 'Playlist Mix',
        icon: <Shuffle />,
        path: '/playlist-mix',
        children: getDispatcherPlaylistMixChildren(),
      },
      { text: 'SmartDisplayFX', icon: <AutoAwesome />, path: '/smartdisplayfx' },
      { text: 'IA', icon: <SmartToy />, path: '/ai' },
    ],
  };

  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Anunciantes',
      icon: <Campaign />,
      path: '/quick-publish',
      children: [
        { text: 'Publicar em tela', icon: <Add />, path: '/quick-publish' },
        { text: 'Estúdio visual', icon: <AutoAwesome />, path: '/publish-board' },
        { text: 'Cardápio por cliente', icon: <Storefront />, path: '/menu-catalog' },
        { text: 'Manutenção Anunciante', icon: <People />, path: '/subscribers' },
        { text: 'Manutenção de Contratos', icon: <Description />, path: '/subscriber-contracts' },
        { text: 'Biblioteca de Mídias', icon: <VideoLibrary />, path: '/media' },
        { text: 'Biblioteca de Vinhetas', icon: <VideoLibrary />, path: '/vinhetas' },
        { text: 'Listagem de Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Listagem de Campanhas', icon: <Campaign />, path: '/campaigns' },
      ],
    },
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/plan-publisher-access',
      children: [
        {
          text: 'Planos & Acessos',
          icon: <Assignment />,
          path: '/plan-publisher-access',
        },
        { text: 'Locais', icon: <LocationOn />, path: '/locals' },
        { text: 'Totens', icon: <Computer />, path: '/totems' },
        { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
        getBillingMenuBlock(true),
        {
          text: 'Contratos (Exibidores)',
          icon: <Description />,
          path: '/publisher-contracts',
        },
        { text: 'Manutenção Usuário', icon: <People />, path: '/users' },
        { text: 'Tags', icon: <Assignment />, path: '/tags' },
        { text: 'QR-Codes', icon: <QrCode />, path: '/qr-codes' },
        { text: 'Analíticos', icon: <Analytics />, path: '/analytics' },
        { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
        dispatcherBlock,
        {
          text: 'Configurações',
          icon: <Settings />,
          path: '/settings',
          children: [
            { text: 'OTA Update', icon: <CloudUpload />, path: '/ota-updates' },
            { text: 'Templates publicação', icon: <AutoAwesome />, path: '/publish-templates-admin' },
          ],
        },
      ],
    },
  ];
}

/**
 * Estrutura hierárquica de menus por role (com filtragem de permissões)
 */
export const getMenuHierarchyByRole = (
  role: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] => {
  if (isStudioMode()) {
    if (role === 'operador_tecnico' || role === 'operator') {
      return filterHierarchicalMenu(getOperadorTecnicoMenu(), role, userFlags);
    }
    if (role === 'operador_comercial') {
      return filterHierarchicalMenu(getOperadorComercialMenu(), role, userFlags);
    }
    if (role === 'operador_faturamento') {
      return filterHierarchicalMenu(getOperadorFaturamentoMenu(), role, userFlags);
    }
    if (role === 'gerente_marketing' || role === 'editoracao' || role === 'visualizador') {
      return filterHierarchicalMenu(getMarketingTeamMenu(), role, userFlags);
    }
    const menu = getSystemAdminMenu(role);
    const compactFullNav = role === 'owner_system' || role === 'admin_sql' || role === 'admin';
    if (compactFullNav) return menu;
    return filterHierarchicalMenu(menu, role, userFlags);
  }

  let menu: HierarchicalMenuItem[] = [];
  
  switch (role) {
    case 'owner_system':
      menu = getSystemAdminMenu(role);
      break;
    case 'admin_sql':
      menu = getSystemAdminMenu(role);
      break;
    case 'admin':
      menu = getSystemAdminMenu(role);
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
      menu = getMarketingTeamMenu();
      break;
    case 'publisher_user':
      menu = getPublisherUserMenu();
      break;
    case 'subscriber_user':
      menu = getSubscriberUserMenu();
      break;
    default:
      menu = getDefaultMenu();
  }

  // Para o momento: somente perfis de sistema (owner_system/admin_sql/admin) usarão o produto
  // e todas as opções devem estar sempre disponíveis.
  const isSystemAdmin = role === 'owner_system' || role === 'admin_sql' || role === 'admin';
  if (isSystemAdmin) return menu;

  // Aplicar filtragem baseada em permissões
  return filterHierarchicalMenu(menu, role, userFlags);
};

/**
 * Menu unificado (mais claro e lógico) para:
 * - owner_system
 * - admin_sql
 * - admin
 *
 * Premissas atuais:
 * - Apenas estes perfis usarão o sistema
 * - Todas as opções devem estar sempre disponíveis
 *
 * Terminologia:
 * - "Exibidores" substitui "Veículos de Mídia" na interface
 */
function getSystemAdminMenu(role?: UserRole | string): HierarchicalMenuItem[] {
  /** Mono: utilizador operacional (ex.: publisher_user) mantém menu curto; dono/admins/operador faturamento vê paridade com Pro. */
  const ownerLikeInCompact =
    isStudioMode() &&
    (role === 'owner_system' ||
      role === 'admin_sql' ||
      role === 'admin' ||
      role === 'operador_faturamento');

  if (isStudioMode() && !ownerLikeInCompact) {
    return [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
      { text: 'Planos', icon: <Assignment />, path: '/plan-publisher-access' },
      getBillingMenuBlock(false),
      { text: 'Locais', icon: <LocationOn />, path: '/locals' },
      { text: 'Totens', icon: <Computer />, path: '/totems' },
      { text: 'Nova publicação', icon: <Add />, path: '/quick-publish' },
      { text: 'Estúdio visual', icon: <AutoAwesome />, path: '/publish-board' },
      { text: 'Cardápio por cliente', icon: <Storefront />, path: '/menu-catalog' },
      { text: 'Anunciantes', icon: <People />, path: '/subscribers' },
      { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
      { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
      { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
      { text: 'Configurações', icon: <Settings />, path: '/settings' },
    ];
  }

  if (isStudioMode() && ownerLikeInCompact) {
    return getCompactReorganizedAdminMenu();
  }

  /** Tráfego servidor ↔ totens / publicidades — junto de Configurações (Administração) para monitorização. */
  const dispatcherMenuBlock: HierarchicalMenuItem = {
    text: 'Dispatcher',
    icon: <MonitorHeart />,
    path: '/dispatcher-manager',
    requiredFlag: 'flag_smart_2',
    children: [
      { text: 'Gerenciar', icon: <Shuffle />, path: '/dispatcher-manager' },
      { text: 'Monitor', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
      { text: 'Debug Online', icon: <BugReport />, path: '/dispatcher-debug' },
      { text: 'Timeline', icon: <ViewTimeline />, path: '/dispatcher-manager?tab=timeline' },
      {
        text: 'Playlist Mix',
        icon: <Shuffle />,
        path: '/playlist-mix',
        children: getDispatcherPlaylistMixChildren(),
      },
    ],
  };

  const exibidoresChildren: HierarchicalMenuItem[] = [
    { text: 'Publicadores', icon: <Business />, path: '/publishers' },
    { text: 'Locais', icon: <LocationOn />, path: '/locals' },
    { text: 'Totens', icon: <Computer />, path: '/totems' },
    { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
    { text: 'Playlists por Totem', icon: <QueueMusic />, path: '/totem-playlists' },
    { text: 'Rede Visual', icon: <Link />, path: '/network-topology' },
    { text: 'Contratos (Exibidores)', icon: <Description />, path: '/publisher-contracts' },
  ];

  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    ...(isCommercialProMenu()
      ? [{ text: 'Nova publicação', icon: <Add />, path: '/quick-publish' } as HierarchicalMenuItem]
      : []),

    // Exibidores (Publicadores + operação de displays)
    {
      text: 'Exibidores',
      icon: <Tv />,
      path: '/publishers',
      children: exibidoresChildren,
    },

    // Anunciantes (conteúdo + campanhas)
    {
      text: 'Anunciantes',
      icon: <Campaign />,
      path: '/subscribers',
      children: [
        { text: 'Publicar em Tela', icon: <Add />, path: '/quick-publish' },
        { text: 'Estúdio visual', icon: <AutoAwesome />, path: '/publish-board' },
        { text: 'Cardápio por cliente', icon: <Storefront />, path: '/menu-catalog' },
        { text: 'Anunciantes', icon: <People />, path: '/subscribers' },
        { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
        { text: 'Vinhetas', icon: <VideoLibrary />, path: '/vinhetas' },
        { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Rede Visual', icon: <Link />, path: '/network-topology?view=graph' },
        { text: 'Contratos (Anunciantes)', icon: <Description />, path: '/subscriber-contracts' },
        { text: 'Smart Playlist', icon: <AutoAwesome />, path: '/smart-playlist' },
        { text: 'IA', icon: <SmartToy />, path: '/ai' },
      ],
    },

    // Financeiro / Planos / Acessos
    {
      text: 'Planos & Acessos',
      icon: <Link />,
      path: '/plan-publisher-access',
      children: [
        { text: 'Planos', icon: <Link />, path: '/plan-publisher-access' },
        { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
        { text: 'Acessos (Anunciante → Exibidor)', icon: <Link />, path: '/subscriber-publisher-access' },
      ],
    },

    getBillingMenuBlock(true),

    // Operação / Administração
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/users',
      children: [
        { text: 'Usuários', icon: <People />, path: '/users' },
        { text: 'Tags', icon: <Assignment />, path: '/tags' },
        { text: 'QR Codes', icon: <QrCode />, path: '/qr-codes' },
        { text: 'OTA Updates', icon: <CloudUpload />, path: '/ota-updates' },
        {
          text: 'SmartDisplayFX',
          icon: <AutoAwesome />,
          path: '/smartdisplayfx',
          hiddenInCompact: true,
        },
        { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
        { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
        { text: 'Admin Tools', icon: <Build />, path: '/admin-tools' },
        dispatcherMenuBlock,
        { text: 'Configurações', icon: <Settings />, path: '/settings' },
      ],
    },
  ];
}

/**
 * Menu: OWNER_SYSTEM (legacy)
 */
function getOwnerSystemMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu('owner_system');
}

/**
 * Menu: ADMIN_SQL
 */
function getAdminSqlMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu('admin_sql');
}

/**
 * Menu: ADMIN
 */
function getAdminMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu('admin');
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
    { text: 'Rede Visual', icon: <Link />, path: '/network-topology?view=graph' },
    { text: 'Admin Tools', icon: <Build />, path: '/admin-tools', requiredFlag: 'flag_smart_2' },
    {
      text: 'Dispatcher',
      icon: <MonitorHeart />,
      path: '/dispatcher-manager',
      requiredFlag: 'flag_smart_2',
      children: [
        { text: 'Gerenciar', icon: <Shuffle />, path: '/dispatcher-manager' },
        { text: 'Monitor', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
        { text: 'Debug Online', icon: <BugReport />, path: '/dispatcher-debug' },
        { text: 'Timeline', icon: <ViewTimeline />, path: '/dispatcher-manager?tab=timeline' },
        {
          text: 'Playlist Mix',
          icon: <Shuffle />,
          path: '/playlist-mix',
          children: getDispatcherPlaylistMixChildren(),
        },
      ],
    },
  ];
}

/**
 * Menu: OPERADOR_FATURAMENTO
 */
function getOperadorFaturamentoMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard Faturamento', icon: <Dashboard />, path: '/dashboard' },
    {
      text: 'Financeiro',
      icon: <AdminPanelSettings />,
      path: '/admin',
      requiredFlag: 'flag_smart_3',
      children: [
        // Mantemos as 2 manutenções separadas, como acordado
        { text: 'Manutenção Contratos Anunciantes', icon: <Description />, path: '/subscriber-contracts', requiredFlag: 'flag_smart_5' },
        { text: 'Manutenção Contratos Publicadores', icon: <Description />, path: '/publisher-contracts', requiredFlag: 'flag_smart_5' },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: 'Manter Planos e Publicadores', icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Anunciantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        getBillingMenuBlock(true),
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
      text: 'Comercial',
      icon: <AdminPanelSettings />,
      path: '/admin',
      children: [
        {
          text: '📢 Veículos de Mídia',
          icon: <Business />,
          path: '/publishers',
          children: [
            { text: 'Manutenção Veículo de Mídia', icon: <Business />, path: '/publishers' },
            { text: 'Locais', icon: <LocationOn />, path: '/locals' },
            { text: 'Totens', icon: <Tv />, path: '/totems' },
            { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
            { text: 'Manutenção Contratos Publicadores', icon: <Description />, path: '/publisher-contracts' },
          ],
        },
        {
          text: 'Anunciantes',
          icon: <Business />,
          path: '/subscribers',
          children: [
            { text: 'Manter Anunciante', icon: <Business />, path: '/subscribers' },
            { text: 'Manutenção Contratos Anunciantes', icon: <Description />, path: '/subscriber-contracts' },
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
            { text: 'Planos Anunciantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: 'Planos Publicadores', icon: <Link />, path: '/plan-publisher-access?type=publisher' },
          ],
        },
        getBillingMenuBlock(true),
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
 * Menu: PUBLISHER_USER (portal/subdomínio publisher)
 */
function getPublisherUserMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    {
      text: '📢 Veículos de Mídia',
      icon: <Business />,
      path: '/locals',
      children: [
        { text: 'Locais', icon: <LocationOn />, path: '/locals' },
        { text: 'Totens', icon: <Tv />, path: '/totems' },
        { text: 'Playlists de Totens', icon: <QueueMusic />, path: '/totem-playlists' },
        { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
      ],
    },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
    {
      text: 'Faturamento e Cobrança',
      icon: <Payment />,
      path: '/billing?type=publisher',
      requiredFlag: 'flag_smart_3',
    },
    { text: 'Configurações', icon: <Settings />, path: '/settings' },
  ];
}

/**
 * Menu: SUBSCRIBER_USER (portal/subdomínio subscriber)
 */
function getMarketingTeamMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Publicar em tela', icon: <Add />, path: '/quick-publish' },
    { text: 'Estúdio visual', icon: <AutoAwesome />, path: '/publish-board' },
    { text: 'Cardápio', icon: <Storefront />, path: '/menu-catalog' },
    { text: 'Mídia', icon: <VideoLibrary />, path: '/media' },
    { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
    { text: 'Anunciantes', icon: <People />, path: '/subscribers' },
    { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
  ];
}

function getSubscriberUserMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Publicar', icon: <Add />, path: '/quick-publish' },
    { text: 'Estúdio', icon: <AutoAwesome />, path: '/publish-board' },
    { text: 'Cardápio', icon: <Storefront />, path: '/menu-catalog' },
    {
      text: 'Anunciantes',
      icon: <Business />,
      path: '/campaigns',
      children: [
        { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
        { text: 'Vinhetas', icon: <VideoLibrary />, path: '/vinhetas' },
        { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Rede Visual', icon: <Link />, path: '/network-topology?view=graph' },
      ],
    },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
    { text: 'Faturamento e Cobrança', icon: <Payment />, path: '/billing' },
    { text: 'Configurações', icon: <Settings />, path: '/settings' },
  ];
}

/**
 * Menu padrão (para roles não especificadas)
 */
function getDefaultMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Mídia', icon: <VideoLibrary />, path: '/media' },
    { text: 'Vinhetas', icon: <VideoLibrary />, path: '/vinhetas' },
    { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
    { text: 'Anunciantes', icon: <People />, path: '/subscribers' },
    { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  ];
}
