'use client';

import { Suspense, useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';

interface PhotoItem {
  name: string;
  url: string;
}

function GalleryContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        setLoading(false);
        return;
      }

      const files = (data ?? []).filter((item) => item.name && !item.name.startsWith('.'));
      const items: PhotoItem[] = files.map((file) => {
        const path = `${folder}/${file.name}`;
        const { data: urlData } = supabase.storage.from('galleries').getPublicUrl(path);
        return { name: file.name, url: urlData.publicUrl };
      });

      setPhotos(items);
      setLoading(false);
    }

    loadPhotos();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleDownload = async (photo: PhotoItem) => {
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
          <p className="text-sm text-neutral-400">
            {loading ? 'Loading photos...' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
          </p>
        </header>

        {errorMsg && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">
            Could not load gallery: {errorMsg}
          </div>
        )}

        {!loading && !errorMsg && photos.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-8 text-center text-neutral-400">
            No photos found in this gallery yet.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div
              key={photo.name}
              className="group rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-neutral-950">
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-xs text-neutral-300 truncate">{photo.name}</span>
                <button
                  type="button"
                  onClick={() => handleDownload(photo)}
                  className="shrink-0 rounded-md bg-white text-black px-3 py-1.5 text-xs font-medium hover:bg-neutral-200 transition"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
