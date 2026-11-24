'use client';

import { supabase } from '@/lib/supabase';

const CLIENT_KEY_STORAGE = 'cg_client_key';
const LAST_ERROR_STORAGE = '__telemetry_last_error';

function recordError(step: string, error: unknown) {
  if (!error) return;
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error(`[Telemetry:${step}]`, error);
  try {
    window.localStorage.setItem(
      LAST_ERROR_STORAGE,
      `[${new Date().toLocaleTimeString()}] ${step}: ${message}`
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getOrCreateClientKey(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.localStorage.getItem(CLIENT_KEY_STORAGE);
  if (existing) return existing;
  const created =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(CLIENT_KEY_STORAGE, created);
  return created;
}

export async function isClientBlocked(clientKey?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const key = (clientKey || getOrCreateClientKey()).trim();
  if (!key) return false;

  try {
    const { data, error } = await supabase
      .from('blocked_clients')
      .select('client_key')
      .eq('client_key', key)
      .limit(1);

    if (error) {
      recordError('blocked_clients.select', error);
      return false;
    }

    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    recordError('blocked_clients.check', err);
    return false;
  }
}

export function startVisitTracker(options: {
  gallerySlug?: string;
  clientLabel?: string;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const clientKey = getOrCreateClientKey();
  const sessionId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = Date.now();
  const visitedAtIso = new Date(startedAt).toISOString();

  void supabase
    .from('client_visits')
    .insert({
      session_id: sessionId,
      client_key: clientKey,
      client_label: options.clientLabel || clientKey,
      gallery_slug: options.gallerySlug || null,
      duration_seconds: 0,
      visited_at: visitedAtIso,
      last_seen_at: visitedAtIso,
    })
    .then(({ error }) => {
      if (error) recordError('client_visits.insert', error);
    });

  const flushDuration = () => {
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    void supabase
      .from('client_visits')
      .update({
        duration_seconds: elapsedSeconds,
        last_seen_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .then(({ error }) => {
        if (error) recordError('client_visits.update', error);
      });
  };

  const interval = window.setInterval(flushDuration, 10000);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      flushDuration();
    }
  };

  window.addEventListener('beforeunload', flushDuration);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('beforeunload', flushDuration);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    flushDuration();
  };
}

export async function logPhotoDownload(options: {
  photoName: string;
  gallerySlug?: string;
  clientLabel?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const clientKey = getOrCreateClientKey();

  const { error } = await supabase.from('photo_downloads').insert({
    client_key: clientKey,
    client_label: options.clientLabel || clientKey,
    gallery_slug: options.gallerySlug || null,
    photo_name: options.photoName,
    downloaded_at: new Date().toISOString(),
  });

  if (error) recordError('photo_downloads.insert', error);
}
