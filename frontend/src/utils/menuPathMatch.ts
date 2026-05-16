/**
 * Compara rotas de menu (podem incluir query) com location do React Router.
 */
export function splitMenuPath(path: string): { pathname: string; search: string } {
  const q = path.indexOf('?');
  if (q === -1) return { pathname: path, search: '' };
  return { pathname: path.slice(0, q), search: path.slice(q) };
}

function searchParamsFromQuery(search: string): URLSearchParams {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

export function menuKeyFromText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function billingOverviewLocation(locParams: URLSearchParams): boolean {
  const type = locParams.get('type');
  if (type != null && type !== '') return false;
  if (locParams.has('dueFilter')) return false;
  const rawId = locParams.get('subscriberId') ?? locParams.get('subscriber_id');
  if (rawId != null && rawId !== '') {
    const n = parseInt(String(rawId), 10);
    if (Number.isFinite(n) && n > 0) return false;
  }
  return true;
}

function pathnameSpecialMatch(
  menuPathname: string,
  menuParams: URLSearchParams,
  locParams: URLSearchParams,
  menuHasSearch: boolean
): boolean | null {
  if (menuPathname === '/billing') {
    if (!menuHasSearch) {
      return billingOverviewLocation(locParams);
    }
    const menuType = menuParams.get('type');
    if (menuType) {
      return locParams.get('type') === menuType;
    }
    return billingOverviewLocation(locParams);
  }

  if (menuPathname === '/dispatcher-manager') {
    if (!menuHasSearch) {
      const tab = locParams.get('tab');
      return tab == null || tab === '' || tab === 'campaigns';
    }
    const menuTab = menuParams.get('tab');
    if (menuTab) {
      return locParams.get('tab') === menuTab;
    }
    return true;
  }

  if (menuPathname === '/network-topology') {
    const menuView = menuParams.get('view');
    if (menuView) {
      return locParams.get('view') === menuView;
    }
    if (!menuHasSearch) {
      return !locParams.has('view') || locParams.get('view') === '';
    }
  }

  if (menuPathname === '/plan-publisher-access') {
    const menuType = menuParams.get('type');
    if (menuType) {
      return locParams.get('type') === menuType;
    }
    if (!menuHasSearch) {
      const locType = locParams.get('type');
      return locType == null || locType === '';
    }
  }

  return null;
}

/**
 * Verifica se o item de menu corresponde à rota atual (pathname + query relevante).
 */
export function menuPathMatches(
  menuPath: string,
  location: { pathname: string; search: string }
): boolean {
  const { pathname: menuPathname, search: menuSearch } = splitMenuPath(menuPath);
  if (location.pathname !== menuPathname) return false;

  const menuHasSearch = Boolean(menuSearch);
  const menuParams = menuHasSearch ? searchParamsFromQuery(menuSearch) : new URLSearchParams();
  const locParams = searchParamsFromQuery(location.search);

  const special = pathnameSpecialMatch(menuPathname, menuParams, locParams, menuHasSearch);
  if (special !== null) return special;

  if (!menuHasSearch) {
    return !location.search || location.search === '';
  }

  for (const [key, value] of menuParams.entries()) {
    if (locParams.get(key) !== value) return false;
  }
  return true;
}

/** Item pai ativo se ele próprio ou algum filho corresponder. */
export function menuItemOrChildActive(
  item: { path: string; children?: { path: string; children?: { path: string }[] }[] },
  location: { pathname: string; search: string }
): boolean {
  if (menuPathMatches(item.path, location)) return true;
  return (item.children ?? []).some((child) => menuItemOrChildActive(child, location));
}

/** Abre submenus ancestrais do item ativo (deep link / navegação direta). */
export function buildAutoOpenMenus(
  items: { text: string; path: string; children?: { path: string; children?: unknown[] }[] }[],
  location: { pathname: string; search: string }
): Record<string, boolean> {
  const state: Record<string, boolean> = {};

  const visit = (
    list: { text: string; path: string; children?: { path: string; children?: unknown[] }[] }[]
  ) => {
    for (const item of list) {
      const key = menuKeyFromText(item.text);
      if (item.children?.length) {
        if (menuItemOrChildActive(item, location)) {
          state[key] = true;
        }
        visit(item.children as typeof list);
      }
    }
  };

  visit(items);
  return state;
}
