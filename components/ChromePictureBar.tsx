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

export interface SearchInfoSummary {
  query: string;
  mode: 'url' | 'search';
  targetUrl: string;
  provider: string;
  pictureCount: number;
  optionCount: number;
  pageTitle?: string;
  description?: string;
}

export default function ChromePictureBar() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'pictures'>('info');
  const [info, setInfo] = useState<SearchInfoSummary | null>(null);
  const [pictures, setPictures] = useState<PictureOption[]>([]);
  const [options, setOptions] = useState<QuickOption[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  async function runSearch(rawQuery: string, pushHistory = true) {
    const q = rawQuery.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setActiveTab('info');
    try {
      const res = await fetch(`/api/admin/web-search?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Search failed (${res.status})`);
        setPictures([]);
        setOptions(Array.isArray(data?.webResults) ? data.webResults : []);
        setInfo(null);
        return;
      }
      const nextPictures = Array.isArray(data?.results) ? data.results : [];
      const nextOptions = Array.isArray(data?.webResults) ? data.webResults : [];
      setPictures(nextPictures);
      setOptions(nextOptions);
      setInfo(
        data?.info || {
          query: q,
          mode: /^https?:\/\//i.test(q) ? 'url' : 'search',
          targetUrl: String(data?.openedUrl || q),
          provider: String(data?.provider || 'Info'),
          pictureCount: nextPictures.length,
          optionCount: nextOptions.length,
        }
      );
      if (pushHistory) {
        setHistory((prev) => (prev[prev.length - 1] === q ? prev : [...prev, q]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInput(input.trim());
    runSearch(input, true);
  }

  function handleBack() {
    if (history.length <= 1 || loading) return;
    const nextHistory = history.slice(0, -1);
    const previousQuery = nextHistory[nextHistory.length - 1];
    setHistory(nextHistory);
    setInput(previousQuery);
    runSearch(previousQuery, false);
  }

  function handleOpenInPage(target: string) {
    setInput(target);
    runSearch(target, true);
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleBack}
          disabled={history.length <= 1 || loading}
          className="rounded-full border border-gray-300 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex flex-1 items-center rounded-full border border-gray-300 bg-gray-50 px-4 py-2.5 focus-within:border-blue-500 focus-within:bg-white">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Admin Browser
          </span>
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
                setInfo(null);
                setError(null);
                setActiveTab('info');
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
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {info && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  activeTab === 'info'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Page & Options ({options.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pictures')}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  activeTab === 'pictures'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pictures ({pictures.length})
              </button>
            </div>
            <span className="text-xs text-gray-500">Source: {info.provider}</span>
          </div>

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <div className="font-semibold text-gray-900">
                  {info.pageTitle || `Information for: ${info.query}`}
                </div>
                <div className="text-xs text-gray-600">
                  Mode: <strong className="uppercase">{info.mode}</strong> · Current Page:{' '}
                  <button
                    type="button"
                    onClick={() => handleOpenInPage(info.targetUrl)}
                    className="break-all text-left text-blue-600 underline hover:text-blue-800"
                  >
                    {info.targetUrl}
                  </button>
                </div>
                {info.description && (
                  <p className="pt-1 text-xs leading-relaxed text-gray-700">{info.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-gray-600">
                  <span>
                    Available Options: <strong>{options.length}</strong>
                  </span>
                  <span>
                    Detected Pictures: <strong>{pictures.length}</strong>
                  </span>
                  {pictures.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('pictures')}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      View Pictures ({pictures.length})
                    </button>
                  )}
                </div>
              </div>

              {options.length > 0 && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleOpenInPage(opt.url)}
                      className="rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-400 hover:bg-blue-50/40"
                    >
                      <div className="text-xs font-semibold text-blue-700">{opt.title}</div>
                      {opt.snippet && (
                        <div className="mt-1 text-xs text-gray-600">{opt.snippet}</div>
                      )}
                      <div className="mt-1.5 truncate text-[11px] text-gray-400">{opt.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pictures' && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pictures.map((pic) => (
                <div
                  key={pic.id}
                  className="flex flex-col justify-between rounded-lg border border-gray-200 p-2"
                >
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
                    href={`/api/admin/download-image?url=${encodeURIComponent(
                      pic.imageUrl
                    )}&name=${encodeURIComponent(pic.title || 'picture')}`}
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
      )}
    </div>
  );
}
