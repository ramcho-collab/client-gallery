'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clientName, setClientName] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Signing in...');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(`Login failed: ${error.message}`);
    } else {
      setUser(data.user);
      setStatus('');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0 || !clientName.trim()) return;

    setUploading(true);
    setStatus(`Uploading ${files.length} photo(s)...`);

    const slug = clientName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${slug}/${safeName}`;

      const { error } = await supabase.storage
        .from('galleries')
        .upload(filePath, file);

      if (!error) successCount++;
    }

    setUploading(false);
    setStatus(`Done! Uploaded ${successCount} of ${files.length} photos.`);
    setShareLink(`${window.location.origin}/gallery/${slug}`);
    setFiles(null);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Admin Login</h1>
          <input
            type="email"
            placeholder="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm"
          />
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 transition"
          >
            Sign In
          </button>
          {status && <p className="text-xs text-red-400">{status}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Upload Client Work</h1>
          <button onClick={handleLogout} className="text-xs text-zinc-400 hover:text-white">
            Sign Out
          </button>
        </div>

        <form onSubmit={handleUpload} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Client or Project Name</label>
            <input
              type="text"
              placeholder="e.g. Sarah Wedding"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Select Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(e.target.files)}
              required
              className="w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:text-white hover:file:bg-zinc-700"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 rounded-lg bg-white text-black font-medium text-sm hover:bg-zinc-200 disabled:opacity-50 transition"
          >
            {uploading ? 'Uploading...' : 'Upload Gallery'}
          </button>

          {status && <p className="text-sm text-emerald-400">{status}</p>}

          {shareLink && (
            <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 space-y-2">
              <p className="text-xs text-zinc-400">Client Gallery Link:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full text-xs bg-zinc-950 px-2.5 py-2 rounded border border-zinc-700"
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
      </div>
    </main>
  );
}