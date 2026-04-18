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
} from '@mui/icons-material';
import { UserRole, canAccess } from './rolePermissions';
import { UserFlags } from '../store/slices/authSlice';
import { TOTEMDIGITAL_COMPACT } from '../config/featureFlags';

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

/**
 * Estrutura hierárquica de menus por role (com filtragem de permissões)
 */
export const getMenuHierarchyByRole = (
  role: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] => {
  if (TOTEMDIGITAL_COMPACT) {
    return getSystemAdminMenu();
  }

  let menu: HierarchicalMenuItem[] = [];
  
  switch (role) {
    case 'owner_system':
      menu = getSystemAdminMenu();
      break;
    case 'admin_sql':
      menu = getSystemAdminMenu();
      break;
    case 'admin':
      menu = getSystemAdminMenu();
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
function getSystemAdminMenu(): HierarchicalMenuItem[] {
  if (TOTEMDIGITAL_COMPACT) {
    return [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
      { text: 'Assinantes', icon: <People />, path: '/subscribers' },
      { text: 'Totens', icon: <Computer />, path: '/totems' },
      { text: 'Playlists por Totem', icon: <QueueMusic />, path: '/totem-playlists' },
      { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
      { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
      { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
      { text: 'Monitor Dispatcher', icon: <MonitorHeart />, path: '/dispatcher-monitor' },
      { text: 'Configurações', icon: <Settings />, path: '/settings' },
    ];
  }

  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },

    // Exibidores (Publicadores + operação de displays)
    {
      text: 'Exibidores',
      icon: <Tv />,
      path: '/publishers',
      children: [
        { text: 'Publicadores', icon: <Business />, path: '/publishers' },
        { text: 'Locais', icon: <LocationOn />, path: '/locals' },
        { text: 'Totens', icon: <Computer />, path: '/totems' },
        { text: 'Smart TVs', icon: <Tv />, path: '/smart-tvs' },
        { text: 'Playlists por Totem', icon: <QueueMusic />, path: '/totem-playlists' },
        { text: 'Rede Visual', icon: <Link />, path: '/network-topology' },
        { text: 'Contratos (Exibidores)', icon: <Description />, path: '/publisher-contracts' },
        {
          text: 'Playlist Mix',
          icon: <Shuffle />,
          path: '/playlist-mix',
          children: [
            { text: 'Visão Geral', icon: <Shuffle />, path: '/playlist-mix' },
            { text: 'Grupos', icon: <Assignment />, path: '/playlist-mix/groups' },
            { text: 'Regras', icon: <Build />, path: '/playlist-mix/rules' },
            { text: 'Analytics', icon: <Analytics />, path: '/playlist-mix/analytics' },
          ],
        },
        {
          text: 'Dispatcher',
          icon: <MonitorHeart />,
          path: '/dispatcher-manager',
          children: [
            { 
              text: 'Gerenciar', 
              icon: <Shuffle />, 
              path: '/dispatcher-manager',
              // Planejamento: ver campanhas elegíveis, timeline, simular exibição
            },
            { 
              text: 'Monitor', 
              icon: <MonitorHeart />, 
              path: '/dispatcher-monitor',
              // Histórico: ver decisões passadas, auditoria, análise
            },
            { 
              text: 'Debug Online', 
              icon: <BugReport />, 
              path: '/dispatcher-debug',
              // Diagnóstico técnico: Redis, queries SQL, mensagens em tempo real
            },
            { text: 'Timeline', icon: <ViewTimeline />, path: '/dispatcher-manager?tab=timeline' },
          ],
        },
      ],
    },

    // Assinantes (conteúdo + campanhas)
    {
      text: 'Assinantes',
      icon: <Campaign />,
      path: '/subscribers',
      children: [
        { text: 'Assinantes', icon: <People />, path: '/subscribers' },
        { text: 'Mídias', icon: <VideoLibrary />, path: '/media' },
        { text: 'Vinhetas', icon: <VideoLibrary />, path: '/vinhetas' },
        { text: 'Playlists', icon: <QueueMusic />, path: '/playlists' },
        { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
        { text: 'Rede Visual', icon: <Link />, path: '/network-topology?view=graph' },
        { text: 'Contratos (Assinantes)', icon: <Description />, path: '/subscriber-contracts' },
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
        { text: 'Acessos (Assinante → Exibidor)', icon: <Link />, path: '/subscriber-publisher-access' },
        { text: 'Faturamento (Anunciantes)', icon: <Payment />, path: '/billing?type=subscriber' },
        { text: 'Faturamento (Exibidores)', icon: <Payment />, path: '/billing?type=publisher' },
      ],
    },

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
        { text: 'SmartDisplayFX', icon: <AutoAwesome />, path: '/smartdisplayfx' },
        { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
        { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
        { text: 'Admin Tools', icon: <Build />, path: '/admin-tools' },
        { text: 'Configurações', icon: <Settings />, path: '/settings' },
      ],
    },
  ];
}

/**
 * Menu: OWNER_SYSTEM (legacy)
 */
function getOwnerSystemMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu();
}

/**
 * Menu: ADMIN_SQL
 */
function getAdminSqlMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu();
}

/**
 * Menu: ADMIN
 */
function getAdminMenu(): HierarchicalMenuItem[] {
  return getSystemAdminMenu();
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
      text: 'Financeiro',
      icon: <AdminPanelSettings />,
      path: '/admin',
      requiredFlag: 'flag_smart_3',
      children: [
        // Mantemos as 2 manutenções separadas, como acordado
        { text: 'Manutenção Contratos Assinantes', icon: <Description />, path: '/subscriber-contracts', requiredFlag: 'flag_smart_5' },
        { text: 'Manutenção Contratos Publicadores', icon: <Description />, path: '/publisher-contracts', requiredFlag: 'flag_smart_5' },
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
            { text: 'Manutenção Contratos Assinantes', icon: <Description />, path: '/subscriber-contracts' },
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
    { text: 'Configurações', icon: <Settings />, path: '/settings' },
  ];
}

/**
 * Menu: SUBSCRIBER_USER (portal/subdomínio subscriber)
 */
function getSubscriberUserMenu(): HierarchicalMenuItem[] {
  return [
    { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
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
    { text: 'Faturamento', icon: <Payment />, path: '/billing' },
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
    { text: 'Campanhas', icon: <Campaign />, path: '/campaigns' },
    { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  ];
}
