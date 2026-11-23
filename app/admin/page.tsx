'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type GalleryPhoto = {
  name: string;
  url: string;
};

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [clientName, setClientName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState('');

  const [folders, setFolders] = useState<string[]>([]);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const activeSlug = useMemo(() => toSlug(clientName), [clientName]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadFolders = useCallback(async () => {
    const { data, error } = await supabase.storage
      .from('galleries')
      .list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } });

    if (!error && data) {
      const folderNames = data
        .filter((item) => !item.name.startsWith('.') && !item.id)
        .map((item) => item.name);
      setFolders(folderNames);
    }
  }, []);

  const loadPhotosForSlug = useCallback(async (slugToLoad: string) => {
    const folder = decodeURIComponent(slugToLoad).trim();
    if (!folder) {
      setPhotos([]);
      return;
    }

    setLoadingPhotos(true);
    setErrorMessage(null);

    const { data, error } = await supabase.storage
      .from('galleries')
      .list(folder, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      setErrorMessage(`Could not load gallery "${folder}": ${error.message}`);
      setPhotos([]);
      setLoadingPhotos(false);
      return;
    }

    const items: GalleryPhoto[] = (data ?? [])
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
    setLoadingPhotos(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadFolders();
  }, [session, loadFolders]);

  useEffect(() => {
    if (!session) return;
    loadPhotosForSlug(activeSlug);
    if (activeSlug && typeof window !== 'undefined') {
      setShareLink(`${window.location.origin}/gallery/${encodeURIComponent(activeSlug)}`);
    } else {
      setShareLink('');
    }
  }, [session, activeSlug, loadPhotosForSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSigningIn(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
    }
    setSigningIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPhotos([]);
    setShareLink('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const folder = toSlug(clientName);
    if (!folder) {
      setErrorMessage('Please enter a client or project name first.');
      return;
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      setErrorMessage('Please choose at least one photo to upload.');
      return;
    }

    setUploading(true);
    let uploadedCount = 0;

    for (const file of Array.from(selectedFiles)) {
      const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const objectPath = `${folder}/${safeFileName}`;

      const { error } = await supabase.storage
        .from('galleries')
        .upload(objectPath, file, { upsert: false });

      if (error) {
        setErrorMessage(`Failed uploading ${file.name}: ${error.message}`);
        break;
      }
      uploadedCount += 1;
    }

    setUploading(false);

    if (uploadedCount > 0) {
      setStatusMessage(`Uploaded ${uploadedCount} ${uploadedCount === 1 ? 'photo' : 'photos'} to "${folder}".`);
      if (typeof window !== 'undefined') {
        setShareLink(`${window.location.origin}/gallery/${encodeURIComponent(folder)}`);
      }
      await loadFolders();
      await loadPhotosForSlug(folder);
    }
  };

  const handleDeletePhoto = async (fileName: string) => {
    const folder = toSlug(clientName);
    if (!folder || !fileName) return;

    setDeletingName(fileName);
    setErrorMessage(null);
    setStatusMessage(null);

    const { error } = await supabase.storage
      .from('galleries')
      .remove([`${folder}/${fileName}`]);

    if (error) {
      setErrorMessage(`Could not delete ${fileName}: ${error.message}`);
    } else {
      setPhotos((prev) => prev.filter((item) => item.name !== fileName));
      setStatusMessage(`Deleted "${fileName}" from "${folder}".`);
    }

    setDeletingName(null);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6">
        <p className="text-sm text-zinc-400">Checking session...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white p-6 flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold">Admin Sign In</h1>
          {authError && <p className="text-xs text-red-400">{authError}</p>}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm bg-neutral-950 px-3 py-2 rounded border border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-sm bg-neutral-950 px-3 py-2 rounded border border-zinc-700"
            />
          </div>
          <button
            type="submit"
            disabled={signingIn}
            className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Upload Client Work</h1>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Sign Out
          </button>
        </div>

        <form
          onSubmit={handleUpload}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Client or Project Name</label>
            <input
              type="text"
              placeholder="e.g. Sarah Wedding"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full text-sm bg-neutral-950 px-3 py-2 rounded border border-zinc-700"
            />
            {activeSlug && (
              <p className="text-[11px] text-zinc-400 mt-1">
                Gallery folder: <span className="text-zinc-200">{activeSlug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Select Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setSelectedFiles(e.target.files)}
              className="w-full text-xs text-zinc-300 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </button>

          {statusMessage && <p className="text-xs text-emerald-400">{statusMessage}</p>}
          {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}

          {shareLink && (
            <div className="pt-2 border-t border-zinc-800 space-y-1.5">
              <label className="block text-xs text-zinc-400">Client Gallery Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full text-xs bg-neutral-950 px-2.5 py-2 rounded border border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareLink)}
                  className="px-3 py-2 rounded bg-white text-black text-xs font-medium shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </form>

        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Client Gallery Contents</h2>
              <p className="text-xs text-zinc-400">
                {activeSlug
                  ? `Showing files in galleries/${activeSlug} (${photos.length})`
                  : 'Enter or select a client gallery above to view and delete photos.'}
              </p>
            </div>
            {activeSlug && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadPhotosForSlug(activeSlug)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
                >
                  Refresh
                </button>
                <a
                  href={`/gallery/${encodeURIComponent(activeSlug)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs"
                >
                  Open Client View
                </a>
              </div>
            )}
          </div>

          {folders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {folders.map((folderName) => {
                const isSelected = folderName === activeSlug;
                return (
                  <button
                    key={folderName}
                    type="button"
                    onClick={() => setClientName(folderName.replace(/-/g, ' '))}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      isSelected
                        ? 'bg-white text-black border-white font-medium'
                        : 'bg-neutral-950 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {folderName}
                  </button>
                );
              })}
            </div>
          )}

          {loadingPhotos && <p className="text-xs text-zinc-400">Loading gallery photos...</p>}

          {!loadingPhotos && activeSlug && photos.length === 0 && (
            <p className="text-xs text-zinc-400">No photos found in "{activeSlug}".</p>
          )}

          {!loadingPhotos && photos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.name}
                  className="bg-neutral-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-900">
                    <img
                      src={photo.url}
                      alt={photo.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-300 truncate" title={photo.name}>
                      {photo.name}
                    </span>
                    <button
                      type="button"
                      disabled={deletingName === photo.name}
                      onClick={() => handleDeletePhoto(photo.name)}
                      className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium shrink-0 disabled:opacity-50"
                    >
                      {deletingName === photo.name ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
