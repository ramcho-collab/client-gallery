'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type GalleryCard = {
  folder: string;
  title: string;
  coverUrl: string | null;
};

export default function GalleriesIndexPage() {
  const [galleries, setGalleries] = useState<GalleryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGalleries() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.storage
        .from('galleries')
        .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (!active) return;

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const folderNames = (data ?? [])
        .filter((item) => !item.name.startsWith('.') && !item.id)
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

      const cards: GalleryCard[] = await Promise.all(
        folderNames.map(async (folder) => {
          const { data: files } = await supabase.storage
            .from('galleries')
            .list(folder, { limit: 50, sortBy: { column: 'name', order: 'asc' } });

          const validFiles = (files ?? [])
            .filter((file) => !file.name.startsWith('.') && Boolean(file.id || file.name))
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
            );

          let coverUrl: string | null = null;
          if (validFiles.length > 0) {
            const firstPath = `${folder}/${validFiles[0].name}`;
            const { data: pub } = supabase.storage.from('galleries').getPublicUrl(firstPath);
            coverUrl = pub.publicUrl;
          }

          return {
            folder,
            title: folder.replace(/-/g, ' '),
            coverUrl,
          };
        })
      );

      if (!active) return;
      setGalleries(cards);
      setLoading(false);
    }

    loadGalleries();
    return () => {
      active = false;
    };
  }, []);

  const filteredGalleries = useMemo(() => {
    const term = activeQuery.trim().toLowerCase();
    if (!term) return galleries;
    return galleries.filter(
      (g) => g.title.toLowerCase().includes(term) || g.folder.toLowerCase().includes(term)
    );
  }, [galleries, activeQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    setActiveQuery('');
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-400">Client Galleries</p>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">Find Your Gallery</h1>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value === '') setActiveQuery('');
              }}
              placeholder="Search client or event name..."
              className="w-full md:w-72 rounded-lg bg-neutral-900 border border-neutral-800 px-3.5 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 shrink-0"
            >
              Search
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 shrink-0"
              >
                Clear
              </button>
            )}
          </form>
        </header>

        {loading && <p className="text-sm text-neutral-400">Loading galleries...</p>}

        {!loading && errorMsg && (
          <p className="text-sm text-red-400">Could not load galleries: {errorMsg}</p>
        )}

        {!loading && !errorMsg && galleries.length === 0 && (
          <p className="text-sm text-neutral-400">No client galleries available yet.</p>
        )}

        {!loading && !errorMsg && galleries.length > 0 && filteredGalleries.length === 0 && (
          <p className="text-sm text-neutral-400">
            No galleries matching &ldquo;{activeQuery}&rdquo;.
          </p>
        )}

        {!loading && !errorMsg && filteredGalleries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGalleries.map((gallery) => (
              <Link
                key={gallery.folder}
                href={`/gallery/${encodeURIComponent(gallery.folder)}`}
                className="group overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-neutral-600 transition block"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
                  {gallery.coverUrl ? (
                    <img
                      src={gallery.coverUrl}
                      alt={gallery.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-xs text-neutral-500">No photo yet</span>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="font-semibold capitalize text-base text-white group-hover:text-neutral-200">
                    {gallery.title}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
