import { menuPathMatches, buildAutoOpenMenus, menuKeyFromText } from './menuPathMatch';

const loc = (pathname: string, search = '') => ({ pathname, search });

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

  it('destaca Anunciantes com type=subscriber', () => {
    expect(
      menuPathMatches(
        '/billing?type=subscriber&view=invoices',
        loc('/billing', '?type=subscriber&view=invoices')
      )
    ).toBe(true);
    expect(
      menuPathMatches('/billing?type=subscriber', loc('/billing', '?type=subscriber'))
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
              { text: 'Anunciantes', path: '/billing?type=subscriber&view=invoices' },
            ],
          },
        ],
      },
    ];
    const open = buildAutoOpenMenus(items, loc('/billing', '?type=subscriber'));
    expect(open[menuKeyFromText('Admin')]).toBe(true);
    expect(open[menuKeyFromText('Faturamento e Cobrança')]).toBe(true);
  });
});
