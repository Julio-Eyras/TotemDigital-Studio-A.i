import {
  menuPathMatches,
  buildAutoOpenMenus,
  menuKeyFromText,
  resolveMenuTitleForPath,
  resolveAppBarTitle,
  pathnameMatchesMenuBase,
} from './menuPathMatch';

const loc = (pathname: string, search = '') => ({ pathname, search });

const directTotemMenu = [
  { text: 'Publicar em Totem', path: '/publish-totem' },
  { text: 'Biblioteca Mídias', path: '/media' },
  { text: 'Configurações', path: '/settings' },
];

describe('pathnameMatchesMenuBase', () => {
  it('casa rota exata e filhos', () => {
    expect(pathnameMatchesMenuBase('/publish-totem', '/publish-totem')).toBe(true);
    expect(pathnameMatchesMenuBase('/publish-totem/2', '/publish-totem')).toBe(true);
    expect(pathnameMatchesMenuBase('/publish-totem/2/medias', '/publish-totem')).toBe(true);
  });

  it('não casa prefixo ambíguo nem raiz', () => {
    expect(pathnameMatchesMenuBase('/media-archive', '/media')).toBe(false);
    expect(pathnameMatchesMenuBase('/publish-totemX', '/publish-totem')).toBe(false);
    expect(pathnameMatchesMenuBase('/dashboard', '/')).toBe(false);
  });
});

describe('resolveMenuTitleForPath', () => {
  it('direct totem: rotas aninhadas usam título do menu pai', () => {
    expect(resolveMenuTitleForPath(directTotemMenu, '/publish-totem')).toBe('Publicar em Totem');
    expect(resolveMenuTitleForPath(directTotemMenu, '/publish-totem/2')).toBe('Publicar em Totem');
    expect(resolveMenuTitleForPath(directTotemMenu, '/publish-totem/99/edit')).toBe('Publicar em Totem');
    expect(resolveMenuTitleForPath(directTotemMenu, '/media')).toBe('Biblioteca Mídias');
    expect(resolveMenuTitleForPath(directTotemMenu, '/settings/general')).toBe('Configurações');
  });

  it('escolhe o prefixo mais específico em menus hierárquicos', () => {
    const items = [
      {
        text: 'Admin',
        path: '/admin',
        children: [
          { text: 'Totens', path: '/totems' },
          { text: 'Totem detalhe', path: '/totems/manage' },
        ],
      },
    ];
    expect(resolveMenuTitleForPath(items, '/totems/42')).toBe('Totens');
    expect(resolveMenuTitleForPath(items, '/totems/manage/7')).toBe('Totem detalhe');
  });

  it('retorna null para rota desconhecida', () => {
    expect(resolveMenuTitleForPath(directTotemMenu, '/dashboard')).toBeNull();
    expect(resolveMenuTitleForPath(directTotemMenu, '/foo/bar')).toBeNull();
  });
});

describe('resolveAppBarTitle', () => {
  it('prioriza rota filha e cai no match exato', () => {
    expect(resolveAppBarTitle(directTotemMenu, '/publish-totem/2')).toBe('Publicar em Totem');
    expect(resolveAppBarTitle(directTotemMenu, '/media')).toBe('Biblioteca Mídias');
  });
});

describe('menuPathMatches', () => {
  it('destaca Visão geral só em /billing sem query de foco', () => {
    expect(menuPathMatches('/billing', loc('/billing'))).toBe(true);
    expect(menuPathMatches('/billing?view=plans', loc('/billing', '?view=plans'))).toBe(true);
    expect(menuPathMatches('/billing?view=plans', loc('/billing', '?view=invoices&type=subscriber'))).toBe(
      false
    );
    expect(menuPathMatches('/billing', loc('/billing', '?type=subscriber'))).toBe(false);
    expect(menuPathMatches('/billing', loc('/billing', '?dueFilter=overdue'))).toBe(false);
    expect(menuPathMatches('/billing', loc('/billing', '?subscriberId=5'))).toBe(false);
  });

  it('destaca Faturas de anunciantes com type=subscriber', () => {
    expect(
      menuPathMatches(
        '/billing?type=subscriber&view=invoices',
        loc('/billing', '?type=subscriber&view=invoices')
      )
    ).toBe(true);
    expect(
      menuPathMatches(
        '/billing?type=subscriber&view=invoices',
        loc('/billing', '?type=subscriber&dueFilter=overdue')
      )
    ).toBe(true);
    expect(
      menuPathMatches('/billing?view=plans', loc('/billing', '?type=subscriber&view=invoices'))
    ).toBe(false);
  });

  it('destaca Contratos de anunciantes mesmo com query na rota', () => {
    expect(
      menuPathMatches('/subscriber-contracts', loc('/subscriber-contracts', '?subscriberId=5'))
    ).toBe(true);
    expect(menuPathMatches('/publisher-contracts', loc('/publisher-contracts'))).toBe(true);
  });

  it('destaca Timeline no dispatcher', () => {
    expect(
      menuPathMatches('/dispatcher-manager?tab=timeline', loc('/dispatcher-manager', '?tab=timeline'))
    ).toBe(true);
    expect(menuPathMatches('/dispatcher-manager', loc('/dispatcher-manager', '?tab=timeline'))).toBe(
      false
    );
  });
});

describe('buildAutoOpenMenus', () => {
  it('abre ramo pai quando filho está ativo', () => {
    const items = [
      {
        text: 'Admin',
        path: '/x',
        children: [
          {
            text: 'Faturamento e Cobrança',
            path: '/billing',
            children: [
              { text: 'Faturas de anunciantes', path: '/billing?type=subscriber&view=invoices' },
            ],
          },
        ],
      },
    ];
    const open = buildAutoOpenMenus(items, loc('/billing', '?type=subscriber&view=invoices'));
    expect(open[menuKeyFromText('Admin')]).toBe(true);
    expect(open[menuKeyFromText('Faturamento e Cobrança')]).toBe(true);
  });
});
