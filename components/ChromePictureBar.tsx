'use client';

import React, { useState } from 'react';

export interface PictureOption {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  width?: number;
  height?: number;
}

export interface QuickOption {
  id: string;
  title: string;
  url: string;
  snippet?: string;
}

export default function ChromePictureBar() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [openedUrl, setOpenedUrl] = useState<string>('');
  const [pictures, setPictures] = useState<PictureOption[]>([]);
  const [options, setOptions] = useState<QuickOption[]>([]);

  async function runSearch(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setOpenedUrl('');
    try {
      const res = await fetch(`/api/admin/web-search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Search failed (${res.status})`);
        setPictures([]);
        setOptions(Array.isArray(data?.webResults) ? data.webResults : []);
        return;
      }
      setPictures(Array.isArray(data?.results) ? data.results : []);
      setOptions(Array.isArray(data?.webResults) ? data.webResults : []);
      setProvider(String(data?.provider || ''));
      setOpenedUrl(String(data?.openedUrl || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(input);
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center rounded-full border border-gray-300 bg-gray-50 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Chrome</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search Google or type URL"
            aria-label="Search Google or type URL"
            className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-500 focus:outline-none"
          />
          {input && (
            <button
              type="button"
              onClick={() => {
                setInput('');
                setPictures([]);
                setOptions([]);
                setError(null);
              }}
              className="ml-2 text-xs text-gray-500 hover:text-gray-800"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {provider && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Source: <strong className="text-gray-900">{provider}</strong> · {pictures.length} picture options
          </span>
          {openedUrl && <span className="truncate text-gray-500">Opened: {openedUrl}</span>}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {options.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">More Options</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {options.map((opt) => (
              <a
                key={opt.id}
                href={opt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 p-2.5 text-left hover:border-blue-400 hover:bg-blue-50/40"
              >
                <div className="truncate text-xs font-medium text-blue-700">{opt.title}</div>
                {opt.snippet && <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">{opt.snippet}</div>}
              </a>
            ))}
          </div>
        </div>
      )}

      {pictures.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pictures.map((pic) => (
            <div key={pic.id} className="flex flex-col justify-between rounded-lg border border-gray-200 p-2">
              <div className="aspect-square w-full overflow-hidden rounded bg-gray-100">
                <img
                  src={pic.thumbnailUrl || pic.imageUrl}
                  alt={pic.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="mt-2 truncate text-xs font-medium text-gray-800" title={pic.title}>
                {pic.title}
              </div>
              <a
                href={`/api/admin/download-image?url=${encodeURIComponent(pic.imageUrl)}&name=${encodeURIComponent(pic.title || 'picture')}`}
                download
                className="mt-2 inline-flex w-full items-center justify-center rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
