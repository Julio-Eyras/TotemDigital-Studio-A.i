/** Proporções alinhadas ao render PNG (publishBoardRenderService). */
export const PUBLISH_BOARD_LAYOUT = {
  headerHeightRatio: 0.11,
  paddingXRatio: 0.05,
  paddingYRatio: 0.03,
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
} as const;

export function boardAspectRatio(orientation: 'portrait' | 'landscape'): string {
  return orientation === 'portrait' ? '9 / 16' : '16 / 9';
}
