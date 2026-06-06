/**
 * Rotas protegidas acessíveis por admin no modo Studio.
 * heading: regex aplicado ao texto visível principal da página.
 */
export interface StudioRouteSpec {
  path: string;
  heading: RegExp;
  /** Se true, aceita redirect para /dashboard (recurso desligado no Studio). */
  allowDashboardRedirect?: boolean;
}

export const STUDIO_ADMIN_ROUTES: StudioRouteSpec[] = [
  { path: '/dashboard', heading: /Dashboard/i },
  { path: '/media', heading: /Biblioteca de Mídia|Mídia/i },
  { path: '/playlists', heading: /Playlists/i },
  { path: '/players', heading: /SmartvPlayer/i },
  { path: '/campaigns', heading: /Campanhas/i },
  { path: '/subscribers', heading: /Anunciantes/i },
  { path: '/publishers', heading: /Organização|Organizações|Sua organização/i },
  { path: '/contracts', heading: /Contrato|Anunciante|Organização/i },
  { path: '/billing', heading: /Faturamento|Cobrança|Planos|Assinaturas/i, allowDashboardRedirect: true },
  { path: '/settings', heading: /Configurações|Geral|Logs/i, allowDashboardRedirect: true },
  { path: '/ota-updates', heading: /Atualizações OTA/i },
  { path: '/users', heading: /Usuários|Users/i },
  { path: '/qr-codes', heading: /QR|Código/i },
  { path: '/reports', heading: /Relatório/i },
  { path: '/analytics', heading: /Analytics|Análise/i },
  { path: '/locals', heading: /Local|Locais/i },
  { path: '/smart-tvs', heading: /Smart TV|Televis/i, allowDashboardRedirect: true },
  { path: '/admin-tools', heading: /Admin Tools|Logs de Registro/i, allowDashboardRedirect: true },
  { path: '/publisher-contracts', heading: /Contrato|Organização/i },
  { path: '/subscriber-contracts', heading: /Contratos de anunciantes|Contrato|Anunciante/i },
  { path: '/smart-playlist', heading: /Smart Playlist|Playlist/i },
  { path: '/tags', heading: /Tag|Etiqueta/i, allowDashboardRedirect: true },
  { path: '/ai', heading: /IA|Inteligência|Assistente/i, allowDashboardRedirect: true },
  { path: '/network-topology', heading: /Rede|Topologia|Network/i, allowDashboardRedirect: true },
  { path: '/dispatcher-monitor', heading: /Dispatcher|Monitor/i, allowDashboardRedirect: true },
  { path: '/playlist-mix', heading: /Playlist Mix|Mix/i, allowDashboardRedirect: true },
];

/** Rotas que no dev server podem falhar lazy-load; validamos só URL + sessão. */
export const URL_ONLY_ROUTES = new Set(['/billing', '/settings', '/admin-tools']);

export const PUBLIC_ROUTES = [
  { path: '/login', heading: /Nome de Usuário|Entrar|Login/i },
  { path: '/forgot-password', heading: /Recuperar|Esqueci|Senha/i },
];
