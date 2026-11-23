/**
 * TEST FIXTURES — synthetic round numbers for tests only.
 * These are NOT market data and must never be used as seeds or shown in the app.
 */
import type { DailyLayer, Decomposition, Poi, WeeklyLayer } from './types';

export const FIXTURE_SYMBOL = 'FIXTURE-ASSET';

export const fixturePoi = (over: Partial<Poi> = {}): Poi => ({
  id: 'poi-a', label: 'POI A', kind: 'FVG', side: 'SELL', high: 114, low: 112, mitigated: false, beyondInducement: true, ...over,
});

/** Bearish weekly context on synthetic prices. */
export const fixtureWeeklyBearish = (): WeeklyLayer => ({
  timeframe: 'WEEKLY',
  trend: { status: 'IDENTIFIED', value: { trend: 'BEARISH', lastExternalBos: 150 } },
  dealingRange: { status: 'IDENTIFIED', value: { high: 200, low: 60, currentPrice: 108 } },
  draw: { status: 'IDENTIFIED', value: { above: 200, below: 60 } },
  pois: { status: 'NOT_APPLICABLE' },
});

/** Bearish continuation daily read: range 80–120, price 108 (premium), POIs above the inducement at 110. */
export const fixtureDailyBearish = (over: Partial<DailyLayer> = {}): DailyLayer => ({
  timeframe: 'DAILY',
  structure: { status: 'IDENTIFIED', value: { trend: 'BEARISH', lastBos: 90, bosKind: 'EXTERNAL' } },
  dealingRange: { status: 'IDENTIFIED', value: { high: 120, low: 80, currentPrice: 108 } },
  phase: { status: 'IDENTIFIED', value: 'RETRACEMENT' },
  leg: { status: 'IDENTIFIED', value: { rangeVsAtr: true, closesInOuterPart: true, lowBodyOverlap: true, unmitigatedFvg: false } },
  candles: { status: 'IDENTIFIED', value: { read: 'REJECTION', closeLocation: 'LOW', liquidityEvent: true } },
  liquidity: {
    status: 'IDENTIFIED',
    value: {
      levels: [
        { id: 'ind', kind: 'INTERNAL_HIGH', price: 110, swept: false, label: 'Inducement' },
        { id: 'ext-low', kind: 'EXTERNAL_LOW', price: 78, swept: false },
      ],
      inducementId: 'ind',
    },
  },
  depth: { status: 'IDENTIFIED', value: 'SHALLOW' },
  pois: { status: 'IDENTIFIED', value: { primary: fixturePoi(), backup: fixturePoi({ id: 'poi-b', label: 'POI B', kind: 'ORDER_BLOCK', high: 118, low: 116 }) } },
  targetInvalidation: { status: 'IDENTIFIED', value: { target: 78, invalidation: 121 } },
  ...over,
});

export const fixtureDecomposition = (over: Partial<Decomposition> = {}): Decomposition => ({
  id: 'dec-1', deskId: 'desk-1', symbol: FIXTURE_SYMBOL, mode: 'LIVE', createdAt: '2026-11-23T10:00:00Z', layers: [], ...over,
});
