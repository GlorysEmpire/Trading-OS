import { useState } from 'react';
import { measureCandle } from '../../decomposition/candleEvidence';
import { PriceField, fmtPrice } from './ui';

const fields = ['open', 'high', 'low', 'close'] as const;
type Field = typeof fields[number];

export function CandleEvidence() {
  const [prices, setPrices] = useState<Partial<Record<Field, number>>>({});
  const complete = fields.every((field) => prices[field] !== undefined);
  const evidence = complete ? measureCandle(prices as Record<Field, number>) : undefined;
  return (
    <details className="rounded-lg border border-line bg-raised px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-ink">Break down the candle (optional)</summary>
      <p className="mt-2 text-ink-2">Enter OHLC from the completed candle on your chart. Use the measurements to inform your own read below.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fields.map((field) => <PriceField key={field} label={field[0].toUpperCase() + field.slice(1)} value={prices[field]}
          onChange={(value) => setPrices((previous) => ({ ...previous, [field]: value }))} />)}
      </div>
      <div aria-live="polite">
        {complete && !evidence && <p className="mt-2 text-rose-300">High and low must contain the open and close.</p>}
        {evidence && <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {[
            ['Range', fmtPrice(evidence.range)],
            ['Body', `${fmtPrice(evidence.body)} (${evidence.bodyPercent.toFixed(0)}%)`],
            ['Upper wick', fmtPrice(evidence.upperWick)],
            ['Lower wick', fmtPrice(evidence.lowerWick)],
            ['Close location', evidence.closeLocation],
            ['Direction', evidence.direction],
          ].map(([label, value]) => <div key={label}><dt className="text-ink-3">{label}</dt><dd className="font-mono text-ink">{value}</dd></div>)}
        </dl>}
      </div>
    </details>
  );
}
