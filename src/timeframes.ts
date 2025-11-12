// Timeframe utilities
export const TIMEFRAME_MAP: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
};

export const VALID_TIMEFRAME_KEYS = Object.keys(TIMEFRAME_MAP);

export function parseTimeframe(tf: string): number {
  const minutes = TIMEFRAME_MAP[tf];
  if (!minutes) {
    throw new Error(`Unsupported timeframe '${tf}'. Valid: ${VALID_TIMEFRAME_KEYS.join(', ')}`);
  }
  return minutes;
}

export function timeframeToString(minutes: number): string {
  const entry = Object.entries(TIMEFRAME_MAP).find(([, v]) => v === minutes);
  return entry ? entry[0] : `${minutes}m`;
}

export const AGG_TIMEFRAMES = [5, 15, 60, 240];