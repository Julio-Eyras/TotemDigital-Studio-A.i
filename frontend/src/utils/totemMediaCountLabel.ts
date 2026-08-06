/**
 * Rótulo de contagem de mídias do totem (modo directo).
 * - Iguais / só total: "3 mídias"
 * - Diferentes: "2 ativas · 3 no totem" (playable vs ligadas, incl. desabilitadas)
 */
export function formatTotemMediaCountLabel(active: number, total?: number): string {
  const a = Math.max(0, Number(active) || 0);
  const t = total == null ? a : Math.max(0, Number(total) || 0);
  if (t <= 0 && a <= 0) return '0 mídias';
  if (t === a || total == null) {
    return `${a} ${a === 1 ? 'mídia' : 'mídias'}`;
  }
  const activePart = `${a} ${a === 1 ? 'ativa' : 'ativas'}`;
  return `${activePart} · ${t} no totem`;
}
