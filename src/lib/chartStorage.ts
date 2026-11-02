import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/**
 * Chart screenshots live in a private Supabase Storage bucket, one folder per
 * user. Records store a short reference ("sb:trading-os-charts/<user>/<file>")
 * instead of the image itself; the app turns it into a temporary signed URL
 * when it needs to show it. Plain https links (e.g. TradingView snapshots)
 * and legacy inline data: URLs still display as they are.
 */
export const CHART_BUCKET = 'trading-os-charts';
const PREFIX = `sb:${CHART_BUCKET}/`;
const SIGNED_URL_SECONDS = 60 * 60;

export const isStorageRef = (src?: string): src is string => !!src && src.startsWith(PREFIX);
export const isInlineImage = (src?: string): src is string => !!src && src.startsWith('data:image/');

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Upload an image (data: URL or Blob) and return its storage reference. */
export async function uploadChart(image: string | Blob): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new Error('Sign in required to upload charts.');
  const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image;
  const type = blob.type || 'image/webp';
  const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : type === 'image/gif' ? 'gif' : 'webp';
  const path = `${userId}/${newId()}.${ext}`;
  const { error } = await supabase.storage.from(CHART_BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('Chart storage isn\'t set up yet. Run supabase/migrations/20261104000000_chart_storage.sql in the Supabase SQL Editor.');
    }
    throw new Error(error.message);
  }
  return PREFIX + path;
}

const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string>>();

/** Displayable URL for any stored chart value. */
export async function resolveChartUrl(src: string): Promise<string> {
  if (!isStorageRef(src)) return src;
  const hit = cache.get(src);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  const pending = inflight.get(src);
  if (pending) return pending;
  const promise = (async () => {
    const path = src.slice(PREFIX.length);
    const { data, error } = await supabase.storage.from(CHART_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not load chart');
    cache.set(src, { url: data.signedUrl, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
    return data.signedUrl;
  })().finally(() => inflight.delete(src));
  inflight.set(src, promise);
  return promise;
}

/** React hook: the displayable URL for a stored chart value (undefined while loading). */
export function useChartUrl(src?: string): { url?: string; error?: string } {
  const [state, setState] = useState<{ url?: string; error?: string }>(() =>
    !src ? {} : isStorageRef(src) ? { url: cache.get(src)?.url } : { url: src },
  );
  useEffect(() => {
    let alive = true;
    if (!src) { setState({}); return; }
    if (!isStorageRef(src)) { setState({ url: src }); return; }
    resolveChartUrl(src)
      .then((url) => alive && setState({ url }))
      .catch((e) => alive && setState({ error: e instanceof Error ? e.message : 'Could not load chart' }));
    return () => { alive = false; };
  }, [src]);
  return state;
}
