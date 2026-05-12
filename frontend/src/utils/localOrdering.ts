export interface LocalLike {
  local_id?: number | string;
  localId?: number | string;
  name?: string | null;
  category_segment?: string | null;
  categorySegment?: string | null;
}

const normalizeLocalText = (value?: unknown): string =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const getLocalId = (local?: LocalLike | null): number | undefined => {
  const raw = local?.local_id ?? local?.localId;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
};

export const getLocalName = (local?: LocalLike | null): string => String(local?.name || '');

export const isStockLocal = (local?: LocalLike | null): boolean => {
  const name = normalizeLocalText(local?.name);
  const category = normalizeLocalText(local?.category_segment ?? local?.categorySegment);
  return name.includes('estoque') || category === 'estoque';
};

export const compareLocalNames = (a?: string, b?: string): number =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true });

export const orderLocalsForSelect = <T extends LocalLike>(
  locals: T[],
  selectedLocalIds: Array<number | string | undefined | null> = []
): T[] => {
  const selected = new Set(
    selectedLocalIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  );

  return [...locals].sort((a, b) => {
    const aStock = isStockLocal(a);
    const bStock = isStockLocal(b);
    if (aStock !== bStock) return aStock ? -1 : 1;

    const aSelected = selected.has(Number(getLocalId(a)));
    const bSelected = selected.has(Number(getLocalId(b)));
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    return compareLocalNames(getLocalName(a), getLocalName(b));
  });
};

export const getLocalMenuItemSx = (local: LocalLike, isSelected = false) => {
  if (isStockLocal(local)) {
    return { color: 'error.main', fontWeight: 700 } as const;
  }
  if (isSelected) {
    return { color: 'success.main', fontWeight: 700 } as const;
  }
  return undefined;
};
