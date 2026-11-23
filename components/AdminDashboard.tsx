'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface VisitRow {
  id: string;
  session_id: string;
  client_key: string;
  client_label: string | null;
  gallery_slug: string | null;
  duration_seconds: number;
  started_at: string;
  last_seen_at: string;
}

interface DownloadRow {
  id: string;
  client_key: string;
  client_label: string | null;
  gallery_slug: string | null;
  photo_name: string;
  downloaded_at: string;
}

interface BlockedClientRow {
  id: string;
  client_key: string;
  client_label: string | null;
  reason: string | null;
  is_blocked: boolean;
  updated_at: string;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function AdminDashboard() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [blockedMap, setBlockedMap] = useState<Record<string, BlockedClientRow>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [manualClientKey, setManualClientKey] = useState('');
  const [manualReason, setManualReason] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const [visitsRes, downloadsRes, blockedRes] = await Promise.all([
        supabase
          .from('client_visits')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(200),
        supabase
          .from('photo_downloads')
          .select('*')
          .order('downloaded_at', { ascending: false })
          .limit(300),
        supabase.from('blocked_clients').select('*'),
      ]);

      if (visitsRes.error) throw new Error(visitsRes.error.message);
      if (downloadsRes.error) throw new Error(downloadsRes.error.message);
      if (blockedRes.error) throw new Error(blockedRes.error.message);

      setVisits((visitsRes.data as VisitRow[]) || []);
      setDownloads((downloadsRes.data as DownloadRow[]) || []);

      const nextBlocked: Record<string, BlockedClientRow> = {};
      for (const row of (blockedRes.data as BlockedClientRow[]) || []) {
        nextBlocked[row.client_key] = row;
      }
      setBlockedMap(nextBlocked);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const setClientBlockState = async (
    clientKey: string,
    nextBlocked: boolean,
    clientLabel?: string | null,
    reason?: string | null
  ) => {
    const cleanKey = clientKey.trim();
    if (!cleanKey) return;

    setBusyKey(cleanKey);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('blocked_clients')
        .upsert(
          {
            client_key: cleanKey,
            client_label: clientLabel || blockedMap[cleanKey]?.client_label || cleanKey,
            reason: reason ?? blockedMap[cleanKey]?.reason ?? null,
            is_blocked: nextBlocked,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_key' }
        )
        .select('*')
        .single();

      if (error) throw new Error(error.message);

      setBlockedMap((prev) => ({
        ...prev,
        [cleanKey]: data as BlockedClientRow,
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update client block status.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleManualBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualClientKey.trim()) return;
    await setClientBlockState(
      manualClientKey,
      true,
      manualClientKey.trim(),
      manualReason.trim() || null
    );
    setManualClientKey('');
    setManualReason('');
  };

  const stats = useMemo(() => {
    const totalVisits = visits.length;
    const uniqueClients = new Set(visits.map((v) => v.client_key)).size;
    const totalSeconds = visits.reduce((acc, v) => acc + (v.duration_seconds || 0), 0);
    const avgSeconds = totalVisits > 0 ? Math.round(totalSeconds / totalVisits) : 0;
    const totalDownloads = downloads.length;

    const perPhotoCounts = new Map<string, number>();
    for (const d of downloads) {
      perPhotoCounts.set(d.photo_name, (perPhotoCounts.get(d.photo_name) || 0) + 1);
    }
    const topPhotos = Array.from(perPhotoCounts.entries())
      .map(([photoName, count]) => ({ photoName, count }))
      .sort((a, b) => b.count - a.count);

    const clientSummaryMap = new Map<
      string,
      {
        clientKey: string;
        clientLabel: string;
        visitCount: number;
        totalDurationSeconds: number;
        downloadCount: number;
        lastSeen: string;
      }
    >();

    for (const v of visits) {
      const current = clientSummaryMap.get(v.client_key) || {
        clientKey: v.client_key,
        clientLabel: v.client_label || v.client_key,
        visitCount: 0,
        totalDurationSeconds: 0,
        downloadCount: 0,
        lastSeen: v.last_seen_at || v.started_at,
      };
      current.visitCount += 1;
      current.totalDurationSeconds += v.duration_seconds || 0;
      if ((v.last_seen_at || v.started_at) > current.lastSeen) {
        current.lastSeen = v.last_seen_at || v.started_at;
      }
      clientSummaryMap.set(v.client_key, current);
    }

    for (const d of downloads) {
      const current = clientSummaryMap.get(d.client_key) || {
        clientKey: d.client_key,
        clientLabel: d.client_label || d.client_key,
        visitCount: 0,
        totalDurationSeconds: 0,
        downloadCount: 0,
        lastSeen: d.downloaded_at,
      };
      current.downloadCount += 1;
      if (d.downloaded_at > current.lastSeen) {
        current.lastSeen = d.downloaded_at;
      }
      clientSummaryMap.set(d.client_key, current);
    }

    for (const b of Object.values(blockedMap)) {
      if (!clientSummaryMap.has(b.client_key)) {
        clientSummaryMap.set(b.client_key, {
          clientKey: b.client_key,
          clientLabel: b.client_label || b.client_key,
          visitCount: 0,
          totalDurationSeconds: 0,
          downloadCount: 0,
          lastSeen: b.updated_at,
        });
      }
    }

    const clients = Array.from(clientSummaryMap.values()).sort((a, b) =>
      b.lastSeen.localeCompare(a.lastSeen)
    );

    return {
      totalVisits,
      uniqueClients,
      avgSeconds,
      totalDownloads,
      topPhotos,
      clients,
    };
  }, [visits, downloads, blockedMap]);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pb-16 text-white space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Client visits, session duration, individual photo downloads, and access control
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={loading}
          className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3.5 py-2 text-xs sm:text-sm font-medium text-white transition disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Stats'}
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Client Visits</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold">{stats.totalVisits}</div>
          <div className="mt-1 text-xs text-neutral-500">
            {stats.uniqueClients} unique client{stats.uniqueClients === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Avg Time Spent</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold">
            {formatDuration(stats.avgSeconds)}
          </div>
          <div className="mt-1 text-xs text-neutral-500">Per client session</div>
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Photos Downloaded</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold">{stats.totalDownloads}</div>
          <div className="mt-1 text-xs text-neutral-500">
            {stats.topPhotos.length} distinct photo{stats.topPhotos.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-400">Blocked Clients</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold">
            {Object.values(blockedMap).filter((b) => b.is_blocked).length}
          </div>
          <div className="mt-1 text-xs text-neutral-500">Instant block / unblock</div>
        </div>
      </div>

      <form
        onSubmit={handleManualBlockSubmit}
        className="rounded-xl bg-neutral-900 border border-neutral-800 p-4 flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          value={manualClientKey}
          onChange={(e) => setManualClientKey(e.target.value)}
          placeholder="Client ID / key to block (e.g. client-a1b2c3d4)"
          className="flex-1 rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
        />
        <input
          type="text"
          value={manualReason}
          onChange={(e) => setManualReason(e.target.value)}
          placeholder="Optional note / reason"
          className="sm:w-60 rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={!manualClientKey.trim() || busyKey === manualClientKey.trim()}
          className="rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          Block Client
        </button>
      </form>

      <div className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-base font-semibold">Clients &amp; Time Spent</h3>
          <span className="text-xs text-neutral-400">{stats.clients.length} tracked</span>
        </div>

        {stats.clients.length === 0 ? (
          <div className="p-6 text-sm text-neutral-400">
            No client visits recorded yet. Once clients open a gallery with telemetry enabled, they
            appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950/70 text-xs uppercase text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4">Client</th>
                  <th className="py-2.5 px-4">Visits</th>
                  <th className="py-2.5 px-4">Time Spent</th>
                  <th className="py-2.5 px-4">Downloads</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {stats.clients.map((client) => {
                  const isBlocked = Boolean(blockedMap[client.clientKey]?.is_blocked);
                  const isBusy = busyKey === client.clientKey;

                  return (
                    <tr key={client.clientKey} className="hover:bg-neutral-800/40">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{client.clientLabel}</div>
                        <div className="text-xs text-neutral-500 font-mono">{client.clientKey}</div>
                      </td>
                      <td className="py-3 px-4">{client.visitCount}</td>
                      <td className="py-3 px-4">{formatDuration(client.totalDurationSeconds)}</td>
                      <td className="py-3 px-4">{client.downloadCount}</td>
                      <td className="py-3 px-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center rounded-full bg-red-950 border border-red-700 px-2.5 py-0.5 text-xs font-medium text-red-300">
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-950 border border-emerald-700 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isBlocked ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void setClientBlockState(client.clientKey, false, client.clientLabel)
                            }
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                          >
                            {isBusy ? 'Updating...' : 'Unblock'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void setClientBlockState(client.clientKey, true, client.clientLabel)
                            }
                            className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                          >
                            {isBusy ? 'Updating...' : 'Block'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <h3 className="text-base font-semibold mb-3">Downloads Per Picture</h3>
          {stats.topPhotos.length === 0 ? (
            <p className="text-sm text-neutral-400">No individual photo downloads logged yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 text-sm">
              {stats.topPhotos.map((item) => (
                <li key={item.photoName} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs sm:text-sm text-neutral-200">
                    {item.photoName}
                  </span>
                  <span className="shrink-0 rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-white">
                    {item.count} {item.count === 1 ? 'download' : 'downloads'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
          <h3 className="text-base font-semibold mb-3">Recent Photo Download Log</h3>
          {downloads.length === 0 ? (
            <p className="text-sm text-neutral-400">No recent downloads recorded.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 text-sm max-h-80 overflow-y-auto">
              {downloads.slice(0, 30).map((d) => (
                <li key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs sm:text-sm text-white">
                      {d.photo_name}
                    </div>
                    <div className="text-xs text-neutral-400">
                      by {d.client_label || d.client_key}
                      {d.gallery_slug ? ` · ${d.gallery_slug}` : ''}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {new Date(d.downloaded_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
