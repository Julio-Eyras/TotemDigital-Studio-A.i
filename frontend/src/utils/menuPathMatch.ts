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

/**
 * Verifica se o item de menu corresponde à rota atual (pathname + query relevante).
 */
export function menuPathMatches(
  menuPath: string,
  location: { pathname: string; search: string }
): boolean {
  const { pathname: menuPathname, search: menuSearch } = splitMenuPath(menuPath);
  if (location.pathname !== menuPathname) return false;

  if (!menuSearch) {
    if (menuPathname === '/billing') {
      const type = searchParamsFromQuery(location.search).get('type');
      return type == null || type === '';
    }
    return !location.search || location.search === '';
  }

  const menuParams = searchParamsFromQuery(menuSearch);
  const locParams = searchParamsFromQuery(location.search);
  for (const [key, value] of menuParams.entries()) {
    if (locParams.get(key) !== value) return false;
  }
  return true;
}

/** Item pai ativo se ele próprio ou algum filho corresponder. */
export function menuItemOrChildActive(
  item: { path: string; children?: { path: string }[] },
  location: { pathname: string; search: string }
): boolean {
  if (menuPathMatches(item.path, location)) return true;
  return (item.children ?? []).some((child) => menuPathMatches(child.path, location));
}
