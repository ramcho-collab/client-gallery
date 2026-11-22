'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';

interface PhotoItem {
  name: string;
  url: string;
}

export default function ClientGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  useEffect(() => {
    async function loadPhotos() {
      const { data, error } = await supabase.storage.from('galleries').list(slug, {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (!error && data) {
        const items = data
          .filter((file) => file.name !== '.emptyFolderPlaceholder')
          .map((file) => {
            const { data: urlData } = supabase.storage
              .from('galleries')
              .getPublicUrl(`${slug}/${file.name}`);
            return { name: file.name, url: urlData.publicUrl };
          });
        setPhotos(items);
      }
      setLoading(false);
    }
    loadPhotos();
  }, [slug]);

  async function handleDownload(photo: PhotoItem) {
    const response = await fetch(photo.url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = photo.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-400">Client Gallery</p>
            <h1 className="text-2xl font-semibold capitalize">{slug.replace(/-/g, ' ')}</h1>
          </div>
          <span className="text-xs text-zinc-400">{photos.length} photos</span>
        </header>

        {loading ? (
          <p className="text-sm text-zinc-400">Loading photos...</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-zinc-400">No photos found in this gallery yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <div key={photo.name} className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                <img
                  src={photo.url}
                  alt={photo.name}
                  onClick={() => setSelectedPhoto(photo)}
                  className="w-full h-64 object-cover cursor-pointer hover:opacity-90 transition"
                />
                <div className="p-3 flex items-center justify-between bg-zinc-900">
                  <span className="text-xs text-zinc-400 truncate max-w-[65%]">{photo.name}</span>
                  <button
                    onClick={() => handleDownload(photo)}
                    className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-zinc-200 transition"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
        >
          <img
            src={selectedPhoto.url}
            alt={selectedPhoto.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleDownload(selectedPhoto)}
              className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium"
            >
              Download Full Size
            </button>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}