'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function GalleriesIndexPage() {
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFolders() {
      setLoading(true);
      const { data, error } = await supabase.storage
        .from('galleries')
        .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (!active) return;

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const names = (data ?? [])
        .filter((item) => !item.name.startsWith('.') && !item.id)
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      setFolders(names);
      setLoading(false);
    }

    loadFolders();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-neutral-400">Client Galleries</p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-1">Select a Gallery</h1>
        </header>

        {loading && <p className="text-sm text-neutral-400">Loading galleries...</p>}
        {errorMsg && <p className="text-sm text-red-400">Could not load galleries: {errorMsg}</p>}

        {!loading && !errorMsg && folders.length === 0 && (
          <p className="text-sm text-neutral-400">No client galleries available yet.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {folders.map((folder) => (
            <Link
              key={folder}
              href={`/gallery/${encodeURIComponent(folder)}`}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600 transition"
            >
              <p className="font-medium capitalize">{folder.replace(/-/g, ' ')}</p>
              <p className="text-xs text-neutral-400 mt-1">/gallery/{folder}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
