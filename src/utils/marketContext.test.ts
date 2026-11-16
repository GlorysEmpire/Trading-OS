import { describe, expect, it } from 'vitest';
import {
  applyFieldEdit,
  confirmField,
  contextSummary,
  emptyField,
  fieldAge,
  getLanes,
  isStale,
  isoToNyInput,
  lanesFromLegacy,
  needsConfirmation,
  nyInputToIso,
  templateLanes,
  upcomingDeskEvents,
  withLanes,
} from './marketContext';
import type { OperationalCalendarEvent } from '../types';

describe('templates', () => {
  it('gives crypto the four lanes plus events', () => {
    const lanes = templateLanes('CRYPTO');
    expect(lanes.map((l) => l.name)).toEqual(['Spot demand', 'Leverage', 'Forced', 'Macro', 'Events']);
    expect(lanes[1].fields.map((f) => f.label)).toEqual(['Open interest', 'Funding']);
    expect(lanes[1].fields[1].conceptNote).toMatch(/crowded side/);
  });
  it('gives each copy fresh ids', () => {
    const a = templateLanes('METALS');
    const b = templateLanes('METALS');
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe('legacy fields', () => {
  it('moves the old values into the matching lanes without losing any', () => {
    const lanes = lanesFromLegacy(
      { etfFlows: '-$643M', openInterest: '$53.2B', fundingRate: 'Positive', liquidations: 'Short-heavy', yields10Y: '4.9%', dxy: '> 102', macroNews: 'NFP Fri', updatedAt: '2026-11-02T10:00:00Z' },
      'CRYPTO',
    );
    const byLabel = Object.fromEntries(lanes.flatMap((l) => l.fields.map((f) => [f.label, f])));
    expect(byLabel['ETF net flows'].value).toBe('-$643M');
    expect(byLabel['Funding'].value).toBe('Positive');
    expect(byLabel['DXY'].value).toBe('> 102');
    expect(byLabel['Macro news'].value).toBe('NFP Fri');
    expect(byLabel['Open interest'].asOf).toBe('2026-11-02T10:00:00.000Z');
    expect(byLabel['Open interest'].source).toBe('Manual (before lanes)');
  });
  it('leaves the as-of empty when the old timestamp is unreadable', () => {
    const lanes = lanesFromLegacy({ dxy: '103', updatedAt: '16/11/2026, 09:55:00' }, 'FX');
    const dxy = lanes.flatMap((l) => l.fields).find((f) => f.label === 'DXY')!;
    expect(dxy.value).toBe('103');
    expect(dxy.asOf).toBe('');
  });
  it('prefers saved lanes over the old fields', () => {
    const saved = templateLanes('CRYPTO');
    expect(getLanes({ category: 'CRYPTO', externalContext: { updatedAt: '', dxy: '99', lanes: saved } })).toBe(saved);
  });
  it('keeps the old fields when lanes are saved', () => {
    const ctx = withLanes({ dxy: '99', updatedAt: '' }, [], new Date('2026-11-16T09:00:00Z'));
    expect(ctx.dxy).toBe('99');
    expect(ctx.version).toBe(2);
    expect(ctx.updatedAt).toBe('2026-11-16T09:00:00.000Z');
  });
});

describe('age and staleness', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  it('greys a value older than its limit', () => {
    const f = emptyField('OI', { value: '$41B', asOf: '2026-11-15T10:00:00Z', staleAfterHours: 24 });
    expect(isStale(f, now)).toBe(true);
    expect(isStale({ ...f, staleAfterHours: 48 }, now)).toBe(false);
  });
  it('never marks an empty or untimed value stale', () => {
    expect(isStale(emptyField('x', { staleAfterHours: 1 }), now)).toBe(false);
    expect(isStale(emptyField('x', { value: '1', staleAfterHours: 1 }), now)).toBe(false);
  });
  it('shows a short age', () => {
    expect(fieldAge(emptyField('x', { asOf: '2026-11-16T11:30:00Z' }), now)).toBe('now');
    expect(fieldAge(emptyField('x', { asOf: '2026-11-16T07:00:00Z' }), now)).toBe('5 h');
    expect(fieldAge(emptyField('x', { asOf: '2026-11-13T12:00:00Z' }), now)).toBe('3 d');
  });
});

describe('New York time input', () => {
  it('round-trips in winter (EST)', () => {
    expect(nyInputToIso('2026-11-16T03:55')).toBe('2026-11-16T08:55:00.000Z');
    expect(isoToNyInput('2026-11-16T08:55:00.000Z')).toBe('2026-11-16T03:55');
  });
  it('round-trips in summer (EDT)', () => {
    expect(nyInputToIso('2026-07-01T08:30')).toBe('2026-07-01T12:30:00.000Z');
    expect(isoToNyInput('2026-07-01T12:30:00.000Z')).toBe('2026-07-01T08:30');
  });
  it('rejects junk', () => {
    expect(nyInputToIso('tomorrow')).toBe('');
  });
});

describe('editing and AI drafts', () => {
  const now = new Date('2026-11-16T09:00:00Z');
  it('keeps the replaced value as previous', () => {
    const f = emptyField('OI', { value: '$53.2B', asOf: '2026-11-02T10:00:00Z' });
    const next = applyFieldEdit(f, { value: '$41B', asOf: '2026-11-16T08:00:00Z' }, now);
    expect(next.previous).toEqual({ value: '$53.2B', asOf: '2026-11-02T10:00:00Z' });
  });
  it('does not record a previous for a first value or an unchanged one', () => {
    expect(applyFieldEdit(emptyField('OI'), { value: '$41B' }, now).previous).toBeUndefined();
    const f = emptyField('OI', { value: '$41B' });
    expect(applyFieldEdit(f, { value: '$41B ', source: 'X' }, now).previous).toBeUndefined();
  });
  it('an AI draft waits for confirmation', () => {
    const draft = emptyField('Funding', { value: 'Negative', enteredBy: 'AI_DRAFT' });
    expect(needsConfirmation(draft)).toBe(true);
    const ok = confirmField(draft, now);
    expect(needsConfirmation(ok)).toBe(false);
    expect(ok.enteredBy).toBe('MANUAL');
  });
});

describe('summary and events', () => {
  it('summarises filled fields only', () => {
    const lanes = templateLanes('CRYPTO');
    lanes[1].fields[1].value = 'Negative';
    lanes[3].fields[3].value = '103.4';
    expect(contextSummary(lanes)).toBe('Funding Negative · DXY 103.4');
  });
  it('lists upcoming events linked to the desk, soonest first', () => {
    const ev = (id: string, date: string, asset: string, completed = false): OperationalCalendarEvent =>
      ({ id, title: id, type: 'NEWS', date, time: '08:30', assetOrCurrency: asset, completed });
    const list = upcomingDeskEvents(
      [ev('minutes', '2026-11-19', 'USD, BTC'), ev('sales', '2026-11-17', 'btc'), ev('old', '2026-11-10', 'BTC'), ev('eth', '2026-11-17', 'ETH'), ev('done', '2026-11-18', 'BTC', true), ev('all', '2026-11-18', 'All')],
      'BTC',
      '2026-11-16',
    );
    expect(list.map((e) => e.id)).toEqual(['sales', 'all', 'minutes']);
  });
});
