'use client';

import { supabase } from '@/lib/supabase';

const CLIENT_KEY_STORAGE = 'madness_lunar_client_key';

export function getOrCreateClientKey(): string {
  if (typeof window === 'undefined') return 'server';
  let existing = window.localStorage.getItem(CLIENT_KEY_STORAGE);
  if (!existing) {
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    existing = `client-${rand}`;
    window.localStorage.setItem(CLIENT_KEY_STORAGE, existing);
  }
  return existing;
}

export async function isClientBlocked(clientKey?: string): Promise<boolean> {
  const key = clientKey || getOrCreateClientKey();
  const { data, error } = await supabase
    .from('blocked_clients')
    .select('is_blocked')
    .eq('client_key', key)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(data.is_blocked);
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
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();

  void supabase.from('client_visits').upsert(
    {
      session_id: sessionId,
      client_key: clientKey,
      client_label: options.clientLabel || clientKey,
      gallery_slug: options.gallerySlug || null,
      duration_seconds: 0,
      started_at: nowIso,
      last_seen_at: nowIso,
    },
    { onConflict: 'session_id' }
  );

  const flushDuration = () => {
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    void supabase
      .from('client_visits')
      .update({
        duration_seconds: elapsedSeconds,
        last_seen_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId);
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

  await supabase.from('photo_downloads').insert({
    client_key: clientKey,
    client_label: options.clientLabel || clientKey,
    gallery_slug: options.gallerySlug || null,
    photo_name: options.photoName,
  });
}
