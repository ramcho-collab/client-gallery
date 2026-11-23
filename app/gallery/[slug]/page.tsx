'use client';

import { Suspense, use, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PhotoItem = {
  name: string;
  url: string;
};

function GalleryContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPhotos() {
      setLoading(true);
      setErrorMsg(null);

      const folder = decodeURIComponent(slug).trim();
      const { data, error } = await supabase.storage
        .from('galleries')
        .list(folder, {
          limit: 500,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (!active) return;

      if (error) {
        setErrorMsg(error.message);
        setPhotos([]);
        setLoading(false);
        return;
      }

      const items: PhotoItem[] = (data ?? [])
        .filter((file) => !file.name.startsWith('.') && Boolean(file.id || file.name))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
        )
        .map((file) => {
          const path = `${folder}/${file.name}`;
          const { data: pub } = supabase.storage.from('galleries').getPublicUrl(path);
          return {
            name: file.name,
            url: pub.publicUrl,
          };
        });

      setPhotos(items);
      setLoading(false);
    }

    loadPhotos();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!selectedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPhoto]);

  const filteredPhotos = useMemo(() => {
    const term = activeSearch.trim().toLowerCase();
    if (!term) return photos;
    return photos.filter((photo) => photo.name.toLowerCase().includes(term));
  }, [photos, activeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const handleDownload = async (photo: PhotoItem) => {
    try {
      setDownloadingName(photo.name);
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = photo.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingName(null);
    }
  };

  const folderTitle = decodeURIComponent(slug).replace(/-/g, ' ');

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 pb-10 pt-4 md:px-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-semibold capitalize">{folderTitle}</h1>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value === '') setActiveSearch('');
              }}
              placeholder="Search photo..."
              className="w-full md:w-64 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 shrink-0"
            >
              Search
            </button>
            {activeSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 shrink-0"
              >
                Clear
              </button>
            )}
          </form>
        </header>

        {loading && <p className="text-sm text-neutral-400">Loading...</p>}

        {!loading && errorMsg && (
          <p className="text-sm text-red-400">Could not load: {errorMsg}</p>
        )}

        {!loading && !errorMsg && photos.length === 0 && (
          <p className="text-sm text-neutral-400">No photos found.</p>
        )}

        {!loading && !errorMsg && photos.length > 0 && filteredPhotos.length === 0 && (
          <p className="text-sm text-neutral-400">
            No matches for &ldquo;{activeSearch}&rdquo;.
          </p>
        )}

        {!loading && !errorMsg && filteredPhotos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPhotos.map((photo) => (
              <button
                key={photo.name}
                type="button"
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-900 text-left focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="w-full px-4 pt-4 pb-3 bg-black/85 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-between gap-3 max-w-6xl mx-auto">
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="rounded-lg bg-white/15 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/25 z-10"
              >
                Close
              </button>

              <div className="flex-1 text-center">
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                  254Oslo
                </div>
                <div className="text-xs sm:text-sm font-medium tracking-widest uppercase text-neutral-400">
                  Madness Lunar
                </div>
              </div>

              <button
                type="button"
                disabled={downloadingName === selectedPhoto.name}
                onClick={() => handleDownload(selectedPhoto)}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-60 z-10"
              >
                {downloadingName === selectedPhoto.name ? 'Downloading...' : 'Download'}
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full w-auto h-auto object-contain select-none"
            />
          </div>

          <div
            className="w-full px-4 py-3 bg-black/85 border-t border-white/10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm sm:text-base font-medium text-neutral-200 truncate max-w-4xl mx-auto">
              {selectedPhoto.name}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ClientGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-950 text-neutral-100 p-10">
          <p className="text-sm text-neutral-400">Loading...</p>
        </main>
      }
    >
      <GalleryContent params={params} />
    </Suspense>
  );
}
