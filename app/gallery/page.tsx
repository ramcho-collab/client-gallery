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
    <main className="min-h-full text-white px-6 pb-10 pt-5 md:px-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-center">
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full max-w-md">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (e.target.value === '') setActiveQuery('');
              }}
              placeholder="Search name..."
              className="w-full rounded-lg bg-white/90 border border-white px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white/80 shrink-0"
            >
              Search
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg bg-white/25 border border-white/50 px-3 py-2 text-sm text-white hover:bg-white/35 shrink-0"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {loading && (
          <p className="text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            Loading...
          </p>
        )}

        {!loading && errorMsg && (
          <p className="text-sm text-white bg-red-700/85 inline-block px-3 py-1.5 rounded-lg">
            Could not load: {errorMsg}
          </p>
        )}

        {!loading && !errorMsg && galleries.length === 0 && (
          <p className="text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            No items available yet.
          </p>
        )}

        {!loading && !errorMsg && galleries.length > 0 && filteredGalleries.length === 0 && (
          <p className="text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            No matches for &ldquo;{activeQuery}&rdquo;.
          </p>
        )}

        {!loading && !errorMsg && filteredGalleries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGalleries.map((gallery) => (
              <Link
                key={gallery.folder}
                href={`/gallery/${encodeURIComponent(gallery.folder)}`}
                className="group overflow-hidden rounded-2xl border-2 border-white/70 bg-white/15 backdrop-blur-xs hover:border-white transition block"
              >
                <div className="aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
                  {gallery.coverUrl ? (
                    <img
                      src={gallery.coverUrl}
                      alt={gallery.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-xs text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                      No photo yet
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="font-semibold capitalize text-base text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
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
