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
  Extension,
  Warning,
  Link,
  QueueMusic,
  SmartToy,
  Shuffle,
  QrCode,
  AutoAwesome,
  Analytics,
  Description,
  Receipt,
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
import { getInstallationCapabilities, isSimpleTotemMode } from '../config/installationCapabilities';
import { isDirectTotemMode } from '../config/directTotemMode';
import { isStudioMode } from '../config/studioMode';
import { getProductTerminology, isSingleOrganizationProfile } from '../config/productTerminology';
import { isPathAllowedByInstallationModules } from './installationModuleAccess';

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
  /** Oculto no modo simples de totem (publicação via fila / quick-publish). */
  hiddenInSimpleTotemMode?: boolean;
}

/**
 * Filtra itens hierárquicos baseado em permissões (role, flags e módulos).
 * Secções com filhos: se algum filho sobreviver, a secção mantém-se mesmo que o
 * path do pai aponte para um módulo desligado (ex.: Administração sob /plans).
 */
function filterHierarchicalMenu(
  items: HierarchicalMenuItem[],
  userRole: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] {
  const filtered: HierarchicalMenuItem[] = [];
  const isAdminRole = userRole === 'owner_system' || userRole === 'admin_sql' || userRole === 'admin';

  for (const item of items) {
    if (isStudioMode() && item.hiddenInCompact) {
      continue;
    }
    if (isSimpleTotemMode() && item.hiddenInSimpleTotemMode) {
      continue;
    }
    if (isSimpleTotemMode() && item.path === '/campaigns') {
      continue;
    }

    if (item.requiredFlag && userFlags && !userFlags[item.requiredFlag] && !isAdminRole) {
      continue;
    }

    let filteredChildren: HierarchicalMenuItem[] | undefined;
    if (item.children && item.children.length > 0) {
      filteredChildren = filterHierarchicalMenu(item.children, userRole, userFlags);
    }

    const pathKey = (item.path || '').split('?')[0] || '/';
    const moduleOk = isPathAllowedByInstallationModules(pathKey);
    const roleOk = canAccess(userRole, pathKey, userFlags);
    const hasVisibleChildren = Boolean(filteredChildren && filteredChildren.length > 0);

    // Contentor: preservar se houver filhos visíveis (Complementos não pode desaparecer
    // porque o path-pai era /plan-publisher-access com plans off no lite).
    if (hasVisibleChildren) {
      filtered.push({
        ...item,
        children: filteredChildren,
      });
      continue;
    }

    if (!moduleOk || !roleOk) {
      continue;
    }

    filtered.push({
      ...item,
      children: undefined,
    });
  }

  return filtered;
}

function getDevicesMenuBlock(): HierarchicalMenuItem {
  const t = getProductTerminology();
  return {
    text: t.devices,
    icon: <Computer />,
    path: '/totems',
    children: [
      { text: t.totems, icon: <Computer />, path: '/totems' },
      { text: t.smartTvs, icon: <Tv />, path: '/smart-tvs' },
    ],
  };
}

/** Filhos do ramo Organizações (multi) ou itens planos em Administração (mono). */
function getOrganizationNavChildren(includeProExtras = false): HierarchicalMenuItem[] {
  const t = getProductTerminology();
  const single = isSingleOrganizationProfile();
  const children: HierarchicalMenuItem[] = [
    {
      text: single ? t.yourOrganization : t.organizationPlural,
      icon: <Business />,
      path: '/publishers',
    },
    { text: t.units, icon: <LocationOn />, path: '/locals' },
    getDevicesMenuBlock(),
    { text: t.organizationContracts, icon: <Description />, path: '/publisher-contracts' },
  ];
  if (includeProExtras && !single) {
    children.push(
      { text: t.totemPlaylists, icon: <QueueMusic />, path: '/totem-playlists' },
      { text: t.networkTopology, icon: <Link />, path: '/network-topology' }
    );
  }
  return children;
}

function getOrganizationTopLevelMenu(includeProExtras = false): HierarchicalMenuItem {
  const t = getProductTerminology();
  return {
    text: t.organizationPlural,
    icon: <Business />,
    path: '/publishers',
    children: getOrganizationNavChildren(includeProExtras),
  };
}

/** Itens organizacionais planos (mono) para embutir em Administração. */
function getOrganizationFlatAdminItems(): HierarchicalMenuItem[] {
  return getOrganizationNavChildren(false);
}

/** Subitens de Faturamento e Cobrança — contratos e faturas separados (Opção C). */
function getBillingMenuChildren(includePublisher: boolean): HierarchicalMenuItem[] {
  const t = getProductTerminology();
  const children: HierarchicalMenuItem[] = [
    { text: 'Visão geral', icon: <Payment />, path: '/billing?view=plans' },
    { text: 'Contratos de anunciantes', icon: <Description />, path: '/subscriber-contracts' },
    { text: 'Faturas de anunciantes', icon: <Receipt />, path: '/billing?type=subscriber&view=invoices' },
  ];
  if (includePublisher) {
    children.push(
      {
        text: t.organizationContracts,
        icon: <Description />,
        path: '/publisher-contracts',
      },
      {
        text: `Faturas da ${t.organization.toLowerCase()}`,
        icon: <Receipt />,
        path: '/billing?type=publisher&view=invoices',
      }
    );
  }
  return children;
}

/** Faturamento no portal da organização (sem itens de anunciante). */
function getPublisherBillingMenuChildren(): HierarchicalMenuItem[] {
  const t = getProductTerminology();
  return [
    { text: t.organizationContracts, icon: <Description />, path: '/publisher-contracts' },
    { text: `Faturas da ${t.organization.toLowerCase()}`, icon: <Receipt />, path: '/billing?type=publisher&view=invoices' },
  ];
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
 * Menu admin unificado — perfil mono (uma organização implícita).
 * Organização, unidades e dispositivos sob Administração.
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
      text: 'Complementos do sistema',
      icon: <Extension />,
      path: '/settings/system-modules',
    },
    {
      text: 'Anunciantes',
      icon: <People />,
      path: '/subscribers',
      children: [
        { text: 'Cadastro de Anunciantes', icon: <People />, path: '/subscribers' },
        { text: 'Anunciante ↔ Organização', icon: <Link />, path: '/subscriber-publisher-access' },
        { text: 'Publicar em tela', icon: <Add />, path: '/quick-publish' },
        { text: 'Criar conteúdo', icon: <AutoAwesome />, path: '/quick-publish?mode=create' },
        { text: 'Cardápio por cliente', icon: <Storefront />, path: '/menu-catalog' },
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
      path: '/settings',
      children: [
        {
          text: 'Planos & Acessos',
          icon: <Assignment />,
          path: '/plan-publisher-access',
        },
        ...getOrganizationFlatAdminItems(),
        getBillingMenuBlock(true),
        { text: 'Manutenção Usuário', icon: <People />, path: '/users' },
        { text: 'QR-Codes', icon: <QrCode />, path: '/qr-codes' },
        { text: 'OTA Updates', icon: <CloudUpload />, path: '/ota-updates' },
        { text: 'SmartDisplayFX', icon: <AutoAwesome />, path: '/smartdisplayfx' },
        { text: 'Analíticos', icon: <Analytics />, path: '/analytics' },
        { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
        { text: 'Admin Tools', icon: <Build />, path: '/admin-tools' },
        dispatcherBlock,
        { text: 'Complementos do sistema', icon: <Extension />, path: '/settings/system-modules' },
        { text: 'Configurações', icon: <Settings />, path: '/settings' },
        { text: 'Templates publicação', icon: <AutoAwesome />, path: '/publish-templates-admin' },
      ],
    },
  ];
}

function getDirectTotemMenu(role: UserRole): HierarchicalMenuItem[] {
  const items: HierarchicalMenuItem[] = [
    { text: 'Publicar em Totem', icon: <Tv />, path: '/publish-totem' },
    { text: 'Biblioteca Mídias', icon: <VideoLibrary />, path: '/media' },
    { text: 'Sua organização', icon: <Business />, path: '/publishers' },
  ];

  const canManageUsers =
    role === 'owner_system' || role === 'admin' || role === 'admin_sql';
  if (canManageUsers) {
    items.push({
      text: 'Usuários e acessos',
      icon: <People />,
      path: '/users',
    });
  }

  if (role === 'owner_system' || role === 'admin_sql') {
    items.push({
      text: 'Complementos do sistema',
      icon: <Extension />,
      path: '/settings/system-modules',
    });
  }

  items.push({
    text: 'Dispatcher',
    icon: <MonitorHeart />,
    path: '/dispatcher-manager',
    requiredFlag: 'flag_smart_2',
    children: [
      { text: 'Gerenciar', icon: <Shuffle />, path: '/dispatcher-manager' },
      { text: 'Monitor', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
      { text: 'Debug Online', icon: <BugReport />, path: '/dispatcher-debug' },
      { text: 'Timeline', icon: <ViewTimeline />, path: '/dispatcher-manager?tab=timeline' },
    ],
  });

  items.push({ text: 'Configurações', icon: <Settings />, path: '/settings' });
  return items;
}

/**
 * Estrutura hierárquica de menus por role (com filtragem de permissões)
 */
export const getMenuHierarchyByRole = (
  role: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] => {
  if (isDirectTotemMode()) {
    const directTotemRoles: UserRole[] = ['owner_system', 'admin_sql', 'admin'];
    if (!directTotemRoles.includes(role)) {
      return [];
    }
    return filterHierarchicalMenu(getDirectTotemMenu(role), role, userFlags);
  }

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
 * Terminologia unificada: Organizações → Unidades (Locais) → Dispositivos (ver productTerminology.ts).
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
    const t = getProductTerminology();
    return [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
      { text: 'Planos', icon: <Assignment />, path: '/plan-publisher-access' },
      getBillingMenuBlock(true),
      { text: t.yourOrganization, icon: <Business />, path: '/publishers' },
      { text: t.units, icon: <LocationOn />, path: '/locals' },
      getDevicesMenuBlock(),
      { text: 'Nova publicação', icon: <Add />, path: '/quick-publish' },
      { text: 'Criar conteúdo', icon: <AutoAwesome />, path: '/quick-publish?mode=create' },
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

  const t = getProductTerminology();

  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    ...(role === 'owner_system' || role === 'admin_sql'
      ? [
          {
            text: 'Complementos do sistema',
            icon: <Extension />,
            path: '/settings/system-modules',
          } as HierarchicalMenuItem,
        ]
      : []),
    ...(isCommercialProMenu()
      ? [{ text: 'Nova publicação', icon: <Add />, path: '/quick-publish' } as HierarchicalMenuItem]
      : []),

    getOrganizationTopLevelMenu(true),

    // Anunciantes (conteúdo + campanhas)
    {
      text: 'Anunciantes',
      icon: <People />,
      path: '/subscribers',
      children: [
        { text: 'Cadastro de Anunciantes', icon: <People />, path: '/subscribers' },
        { text: 'Anunciante ↔ Organização', icon: <Link />, path: '/subscriber-publisher-access' },
        { text: 'Publicar em Tela', icon: <Add />, path: '/quick-publish' },
        { text: 'Criar conteúdo', icon: <AutoAwesome />, path: '/quick-publish?mode=create' },
        { text: 'Cardápio por cliente', icon: <Storefront />, path: '/menu-catalog' },
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
        { text: t.subscriberToOrgAccess, icon: <Link />, path: '/subscriber-publisher-access' },
      ],
    },

    getBillingMenuBlock(true),

    // Operação / Administração
    {
      text: 'Administração',
      icon: <AdminPanelSettings />,
      path: '/settings',
      children: [
        { text: 'Usuários', icon: <People />, path: '/users' },
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
        { text: 'Complementos do sistema', icon: <Extension />, path: '/settings/system-modules' },
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
        { text: getProductTerminology().organizationContractMaintenance, icon: <Description />, path: '/publisher-contracts', requiredFlag: 'flag_smart_5' },
        {
          text: 'Planos',
          icon: <Link />,
          path: '/plan-publisher-access',
          children: [
            { text: 'Criar Plano', icon: <Link />, path: '/plan-publisher-access/new' },
            { text: getProductTerminology().maintainPlansAndOrganizations, icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Anunciantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: getProductTerminology().plansForOrganization, icon: <Link />, path: '/plan-publisher-access?type=publisher' },
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
          ...getOrganizationTopLevelMenu(false),
          children: getOrganizationNavChildren(false),
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
            { text: getProductTerminology().maintainPlansAndOrganizations, icon: <Link />, path: '/plan-publisher-access' },
            { text: 'Planos Expirados', icon: <Warning />, path: '/plan-publisher-access/expired' },
            { text: 'Planos Anunciantes', icon: <Link />, path: '/plan-publisher-access?type=subscriber' },
            { text: getProductTerminology().plansForOrganization, icon: <Link />, path: '/plan-publisher-access?type=publisher' },
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
      ],
    },
    { text: 'Relatórios Comerciais', icon: <Assessment />, path: '/reports' },
  ];
}

/**
 * Menu: PUBLISHER_USER (portal/subdomínio publisher)
 */
function getPublisherUserMenu(): HierarchicalMenuItem[] {
  const t = getProductTerminology();
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
    { text: t.yourOrganization, icon: <Business />, path: '/publishers' },
    { text: t.units, icon: <LocationOn />, path: '/locals' },
    {
      text: t.devices,
      icon: <Computer />,
      path: '/totems',
      children: [
        { text: t.totems, icon: <Computer />, path: '/totems' },
        { text: t.totemPlaylists, icon: <QueueMusic />, path: '/totem-playlists' },
        { text: t.smartTvs, icon: <Tv />, path: '/smart-tvs' },
      ],
    },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
    {
      text: 'Faturamento e Cobrança',
      icon: <Payment />,
      path: '/billing?type=publisher&view=invoices',
      requiredFlag: 'flag_smart_3',
      children: getPublisherBillingMenuChildren(),
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
    { text: 'Criar conteúdo', icon: <AutoAwesome />, path: '/quick-publish?mode=create' },
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
    { text: 'Criar', icon: <AutoAwesome />, path: '/quick-publish?mode=create' },
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
    {
      text: 'Faturamento e Cobrança',
      icon: <Payment />,
      path: '/billing?type=subscriber&view=invoices',
      children: [
        { text: 'Faturas de anunciantes', icon: <Receipt />, path: '/billing?type=subscriber&view=invoices' },
      ],
    },
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
