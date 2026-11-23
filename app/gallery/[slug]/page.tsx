'use client';

import { Suspense, use, useEffect, useState } from 'react';
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
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPhotos() {
      setLoading(true);
      setErrorMsg(null);

      const folder = decodeURIComponent(slug);
      const { data, error } = await supabase.storage
        .from('galleries')
        .list(folder, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (!active) return;

      if (error) {
        setErrorMsg(error.message);
        setPhotos([]);
        setLoading(false);
        return;
      }

      const items: PhotoItem[] = (data ?? [])
        .filter((file) => !file.name.startsWith('.') && Boolean(file.id || file.name))
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

  const clientTitle = decodeURIComponent(slug).replace(/-/g, ' ');

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-400">Client Gallery</p>
            <h1 className="text-2xl md:text-3xl font-semibold capitalize mt-1">{clientTitle}</h1>
          </div>
          {!loading && !errorMsg && (
            <p className="text-sm text-neutral-400">
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
            </p>
          )}
        </header>

        {loading && <p className="text-sm text-neutral-400">Loading photos...</p>}

        {!loading && errorMsg && (
          <p className="text-sm text-red-400">Could not load gallery: {errorMsg}</p>
        )}

        {!loading && !errorMsg && photos.length === 0 && (
          <p className="text-sm text-neutral-400">No photos in this gallery yet.</p>
        )}

        {!loading && !errorMsg && photos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {photos.map((photo) => (
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
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 bg-black/80 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="rounded-lg bg-white/15 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/25"
            >
              Close
            </button>
            <span className="truncate text-xs sm:text-sm text-neutral-300">
              {selectedPhoto.name}
            </span>
            <button
              type="button"
              disabled={downloadingName === selectedPhoto.name}
              onClick={() => handleDownload(selectedPhoto)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
            >
              {downloadingName === selectedPhoto.name ? 'Downloading...' : 'Download'}
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full w-auto h-auto object-contain select-none"
            />
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
          <p className="text-sm text-neutral-400">Loading gallery...</p>
        </main>
      }
    >
      <GalleryContent params={params} />
    </Suspense>
  );
}
