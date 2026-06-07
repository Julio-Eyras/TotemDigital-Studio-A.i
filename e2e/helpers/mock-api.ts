import { BrowserContext, Page } from '@playwright/test';

const mockAdminUser = {
  id: 1,
  username: 'totemdigital.admin',
  email: 'admin@smartsignage.local',
  role: 'admin',
  user_type: 'system_user',
  name: 'Admin Sistema',
  flag_smart_0: true,
  flag_smart_1: true,
  flag_smart_2: true,
  flag_smart_3: true,
  flag_smart_4: true,
  flag_smart_5: true,
  flag_smart_6: true,
  flag_smart_7: true,
  flag_smart_8: true,
  flag_smart_9: true,
  flags: {
    flag_smart_0: true,
    flag_smart_1: true,
    flag_smart_2: true,
    flag_smart_3: true,
    flag_smart_4: true,
    flag_smart_5: true,
    flag_smart_6: true,
    flag_smart_7: true,
    flag_smart_8: true,
    flag_smart_9: true,
  },
  publisherId: null,
  subscriberId: null,
};

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

const studioCapabilities = {
  profile: 'single_publisher' as const,
  totemDigitalCompact: true,
  multiAgency: false,
  publisherBillingForAdmins: true,
  stripeSubscriptions: true,
  playlistMixWorker: true,
  playlistEngineWorker: true,
  alertCron: true,
  bullExportQueues: false,
  subdomainTenancy: false,
  subscriberPortal: false,
  smartDisplayFx: false,
};

const billingDashboard = {
  pending: 0,
  overdue: 0,
  paid: 0,
  dueSoon: 0,
  contracts: { active: 1, dueSoon: 0, expired: 0 },
  publisherContracts: { active: 1, subscriptionActive: 1, dueSoon: 0 },
  revenueShare: { pending: 0, paidCampaignsWithoutPayout: 0, totalHistorical: 0 },
  publisher: { pending: 0, overdue: 0, paid: 0, dueSoon: 0 },
  subscriber: { pending: 0, overdue: 0, paid: 0, dueSoon: 0 },
};

const mockSubscriber = {
  subscriber_id: 1,
  name: 'Anunciante Demo E2E',
  email: 'demo@e2e.local',
  is_active: true,
};

const mockContract = {
  contract_id: 1,
  subscriber_id: 1,
  plan_id: 1,
  plan_name: 'Plano Silver',
  status: 'active',
  is_active: true,
};

const mockTotem = {
  totem_id: 1,
  identifier: 'TOTEM-E2E-01',
  name: 'Tela Demo',
  status: 'active',
  is_active: true,
};

const publishBoardLayouts: Record<string, Record<string, unknown>> = {
  promotion: {
    subscriberId: 1,
    preset: 'promotion',
    boardTitle: 'Promoção do dia',
    accentColor: '#e91e63',
    preferredOrientation: 'landscape',
    content: {
      headline: 'Oferta em destaque',
      offer: 'Promoção especial',
      price: 'R$ 29,90',
      urgency: 'Por tempo limitado',
    },
    blockOrder: ['headline', 'offer', 'price', 'urgency'],
    productOrder: [],
    showPrices: true,
  },
  menu: {
    subscriberId: 1,
    preset: 'menu',
    boardTitle: 'Cardápio',
    accentColor: '#ff9800',
    preferredOrientation: 'portrait',
    content: {},
    blockOrder: [],
    productOrder: [1],
    showPrices: true,
  },
  announcement: {
    subscriberId: 1,
    preset: 'announcement',
    boardTitle: 'Comunicado',
    accentColor: '#7b1fa2',
    preferredOrientation: 'landscape',
    content: {
      headline: 'Aviso importante',
      message: 'Comunicado para visitantes',
      eventInfo: 'Confira na recepção',
    },
    blockOrder: ['headline', 'message', 'eventInfo'],
    productOrder: [],
    showPrices: false,
  },
  institutional: {
    subscriberId: 1,
    preset: 'institutional',
    boardTitle: 'Institucional',
    accentColor: '#2e7d32',
    preferredOrientation: 'landscape',
    content: {
      headline: 'Presença de marca',
      message: 'Serviços de qualidade',
      line1: 'Atendimento',
      line2: 'Experiência',
      line3: 'Confiança',
    },
    blockOrder: ['headline', 'message', 'line1', 'line2', 'line3'],
    productOrder: [],
    showPrices: false,
  },
  ad: {
    subscriberId: 1,
    preset: 'ad',
    boardTitle: 'Anúncio indoor',
    accentColor: '#1976d2',
    preferredOrientation: 'landscape',
    content: {
      headline: 'Anúncio de impacto',
      brand: 'Sua marca',
      message: 'Mensagem objetiva',
      cta: 'Saiba mais',
    },
    blockOrder: ['headline', 'brand', 'message', 'cta'],
    productOrder: [],
    showPrices: false,
  },
};

function mockPublishBoardLayout(preset: string) {
  return publishBoardLayouts[preset] || publishBoardLayouts.promotion;
}

async function fulfillApi(route: import('@playwright/test').Route): Promise<void> {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const method = route.request().method();

  if (path === '/api/auth/login' && method === 'POST') {
    const body = route.request().postDataJSON() as { username?: string; password?: string } | null;
    if (body?.username === 'invalido' || body?.password === 'senhaerrada') {
      return route.fulfill(json({ success: false, error: 'Credenciais inválidas' }, 401));
    }
    return route.fulfill(json({ token: 'e2e-mock-jwt-token', user: mockAdminUser }));
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    return route.fulfill(json({ success: true }));
  }

  if (path === '/api/dashboard/ui-context') {
    return route.fulfill(
      json({
        disableDirectCampaignTotem: true,
        totemDigitalCompact: true,
        installationProfile: 'single_publisher',
        capabilities: studioCapabilities,
      })
    );
  }

  if (path.startsWith('/api/dashboard')) {
    return route.fulfill(
      json({
        totalMedia: 0,
        totalPlaylists: 0,
        totalPlayers: 1,
        totalUsers: 1,
        activePlayers: 1,
        offlinePlayers: 0,
        commercialOverview: {
          totalScreens: 1,
          onlineScreens: 1,
          offlineScreens: 0,
          activeCampaigns: 0,
          recentPublications: 0,
          pendingActivations: 0,
        },
      })
    );
  }

  if (path.startsWith('/api/billing-control')) {
    return route.fulfill(json({ data: billingDashboard }));
  }

  if (path === '/api/ota-updates/stats') {
    return route.fulfill(
      json({
        success: true,
        data: {
          updates: { active: 0, total: 0 },
          totems: { upToDate: 1, updateAvailable: 0, installing: 0 },
        },
      })
    );
  }

  if (path.startsWith('/api/ota-updates')) {
    return route.fulfill(json({ success: true, data: [] }));
  }

  if (path.startsWith('/api/settings') || path.includes('system-settings')) {
    return route.fulfill(json({ data: [] }));
  }

  if (path.startsWith('/api/plans') || path.startsWith('/api/subscriptions')) {
    return route.fulfill(json({ data: [] }));
  }

  if (path.startsWith('/api/subscriber-billing') || path.startsWith('/api/publisher-billing')) {
    return route.fulfill(json({ data: [], total: 0 }));
  }

  if (path.startsWith('/api/publisher-contracts') || path.startsWith('/api/contracts')) {
    return route.fulfill(json({ data: [], total: 0 }));
  }

  if (path.startsWith('/api/financial')) {
    return route.fulfill(json({ success: true, data: billingDashboard }));
  }

  if (path.startsWith('/api/system') || path.startsWith('/api/admin-tools') || path.startsWith('/api/logs')) {
    return route.fulfill(json({ success: true, data: {} }));
  }

  if (path.startsWith('/api/alerts')) {
    return route.fulfill(json({ data: [], unread: 0 }));
  }

  if (path === '/api/subscribers' && method === 'GET') {
    return route.fulfill(json({ data: [mockSubscriber], total: 1, page: 1, limit: 1000 }));
  }

  const subscriberContractsMatch = path.match(/^\/api\/subscribers\/(\d+)\/contracts$/);
  if (subscriberContractsMatch && method === 'GET') {
    return route.fulfill(json({ success: true, data: [mockContract] }));
  }

  const subscriberTotemsMatch = path.match(/^\/api\/subscribers\/(\d+)\/totems$/);
  if (subscriberTotemsMatch && method === 'GET') {
    return route.fulfill(json({ success: true, data: [mockTotem] }));
  }

  const planLimitsMatch = path.match(/^\/api\/subscribers\/(\d+)\/validate\/plan-limits$/);
  if (planLimitsMatch && method === 'GET') {
    return route.fulfill(json({ valid: true, current: 0, limit: null, remaining: null, message: 'OK' }));
  }

  const storageMatch = path.match(/^\/api\/subscribers\/(\d+)\/validate\/storage$/);
  if (storageMatch && method === 'GET') {
    return route.fulfill(json({ valid: true, currentBytes: 0, limitBytes: null, message: 'OK' }));
  }

  const aiAssistMatch = path.match(/^\/api\/subscribers\/(\d+)\/publish-board\/ai-assist-status$/);
  if (aiAssistMatch && method === 'GET') {
    return route.fulfill(
      json({
        success: true,
        data: {
          available: false,
          enabled: false,
          provider: 'none',
          status: 'unconfigured',
          message: 'IA não configurada no servidor (E2E mock).',
        },
      })
    );
  }

  const layoutGetMatch = path.match(/^\/api\/subscribers\/(\d+)\/publish-board\/([a-z]+)\/layout$/);
  if (layoutGetMatch && method === 'GET') {
    const preset = layoutGetMatch[2];
    return route.fulfill(json({ success: true, data: mockPublishBoardLayout(preset) }));
  }

  if (layoutGetMatch && method === 'PUT') {
    const preset = layoutGetMatch[2];
    return route.fulfill(json({ success: true, data: mockPublishBoardLayout(preset) }));
  }

  const previewHtmlMatch = path.match(/^\/api\/subscribers\/(\d+)\/publish-board\/([a-z]+)\/preview-html$/);
  if (previewHtmlMatch && method === 'POST') {
    return route.fulfill(
      json({
        success: true,
        data: { html: '<!DOCTYPE html><html><body><div id="stage">Preview E2E</div></body></html>' },
      })
    );
  }

  const renderHtmlMatch = path.match(/^\/api\/subscribers\/(\d+)\/publish-board\/([a-z]+)\/render-html$/);
  if (renderHtmlMatch && method === 'POST') {
    return route.fulfill(
      json({
        success: true,
        data: { mediaId: 101, name: 'Animação HTML E2E', mediaType: 'html' },
        message: 'HTML gerado',
      })
    );
  }

  const menuCategoriesMatch = path.match(/^\/api\/subscribers\/(\d+)\/menu-catalog\/categories$/);
  if (menuCategoriesMatch && method === 'GET') {
    return route.fulfill(json({ success: true, data: [] }));
  }

  const menuProductsMatch = path.match(/^\/api\/subscribers\/(\d+)\/menu-catalog\/products$/);
  if (menuProductsMatch && method === 'GET') {
    return route.fulfill(
      json({
        success: true,
        data: [
          {
            productId: 1,
            name: 'Café expresso',
            price: 6.5,
            description: 'Tradicional',
            isAvailable: true,
          },
        ],
      })
    );
  }

  if (path === '/api/quick-publish' && method === 'POST') {
    return route.fulfill(
      json(
        {
          success: true,
          data: { message: 'Publicado (mock E2E)' },
          message: 'Conteúdo publicado com sucesso nas telas selecionadas.',
        },
        201
      )
    );
  }

  if (path.startsWith('/api/publish-templates')) {
    return route.fulfill(json({ success: true, data: [] }));
  }

  if (method === 'GET') {
    return route.fulfill(json({ data: [], total: 0, page: 1, limit: 20 }));
  }

  return route.fulfill(json({ success: true }));
}

export async function installMockApiOnContext(context: BrowserContext): Promise<void> {
  await context.route('**/api/**', fulfillApi);
}

export async function installMockApi(page: Page): Promise<void> {
  await page.route('**/api/**', fulfillApi);
}

export async function seedMockSession(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    if (sessionStorage.getItem('e2e_skip_seed') === '1') return;
    localStorage.setItem('token', 'e2e-mock-jwt-token');
    localStorage.setItem('user', JSON.stringify(user));
  }, mockAdminUser);
}

/** Impede re-seed automático no próximo reload (ex.: teste de logout). */
export async function disableMockSessionSeed(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.setItem('e2e_skip_seed', '1'));
}

export { mockAdminUser };
