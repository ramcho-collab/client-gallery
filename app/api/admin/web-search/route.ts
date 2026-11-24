import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

export const maxDuration = 60;

export interface WebSearchLink {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

export interface WebImageResult {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
}

const REQUEST_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ||
  'https://github.com/Sparticuz/chromium/releases/latest/download/chromium-v133.0.0-pack.tar';

async function searchPexelsImages(query: string, apiKey: string): Promise<WebImageResult[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`,
    { headers: { Authorization: apiKey, Accept: 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Pexels API returned ${res.status}`);
  const data = await res.json();
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  return photos
    .map((photo: Record<string, unknown>, idx: number): WebImageResult | null => {
      const src = (photo.src as Record<string, unknown>) || {};
      const imageUrl = String(src.large2x || src.large || src.original || src.medium || '');
      if (!imageUrl) return null;
      return {
        id: `pexels-${String(photo.id ?? idx)}`,
        title: String(photo.alt || `Photo ${idx + 1}`),
        imageUrl,
        thumbnailUrl: String(src.medium || src.small || imageUrl),
        sourceUrl: String(photo.url || imageUrl),
        width: Number(photo.width || 0),
        height: Number(photo.height || 0),
      };
    })
    .filter((item: WebImageResult | null): item is WebImageResult => item !== null);
}

async function searchOpenverseImages(query: string): Promise<WebImageResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20`,
      { headers: { Accept: 'application/json', 'User-Agent': REQUEST_UA }, signal: controller.signal, cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`Openverse API returned ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.results) ? data.results : [];
    return items
      .map((item: Record<string, unknown>, idx: number): WebImageResult | null => {
        const imageUrl = String(item.url || '');
        if (!imageUrl) return null;
        return {
          id: `openverse-${String(item.id ?? idx)}`,
          title: String(item.title || `Image ${idx + 1}`),
          imageUrl,
          thumbnailUrl: String(item.thumbnail || imageUrl),
          sourceUrl: String(item.foreign_landing_url || item.url || imageUrl),
          width: Number(item.width || 0),
          height: Number(item.height || 0),
        };
      })
      .filter((item: WebImageResult | null): item is WebImageResult => item !== null);
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWikimediaCommonsImages(query: string): Promise<WebImageResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '20',
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
      iiurlwidth: '800',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': REQUEST_UA },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Wikimedia Commons API returned ${res.status}`);
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages as Record<string, Record<string, unknown>>) : [];
    return pages
      .map((page, idx): WebImageResult | null => {
        const infos = Array.isArray(page.imageinfo) ? (page.imageinfo as Record<string, unknown>[]) : [];
        const info = infos[0] || {};
        const mime = String(info.mime || '');
        if (!mime.startsWith('image/') || mime === 'image/svg+xml') return null;
        const imageUrl = String(info.url || '');
        if (!imageUrl) return null;
        const rawTitle = String(page.title || `Image ${idx + 1}`).replace(/^File:/i, '').replace(/\.[^.]+$/, '');
        return {
          id: `commons-${String(page.pageid ?? idx)}`,
          title: rawTitle,
          imageUrl,
          thumbnailUrl: String(info.thumburl || imageUrl),
          sourceUrl: String(info.descriptionurl || imageUrl),
          width: Number(info.width || 0),
          height: Number(info.height || 0),
        };
      })
      .filter((item: WebImageResult | null): item is WebImageResult => item !== null);
  } finally {
    clearTimeout(timeout);
  }
}

async function searchWithHeadlessChromium(query: string): Promise<WebImageResult[]> {
  const executablePath = process.env.CHROME_EXECUTABLE_PATH || (await chromium.executablePath(CHROMIUM_PACK_URL));
  const browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(REQUEST_UA);
    await page.setViewport({ width: 1280, height: 800 });
    const targetUrl = `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(query)}&title=Special:MediaSearch&type=image`;
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    const scraped = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .map((img, idx) => {
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || `Image ${idx + 1}`;
          return { id: `chrome-${idx}`, title: alt.trim() || `Image ${idx + 1}`, imageUrl: src, thumbnailUrl: src, sourceUrl: window.location.href, width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
        })
        .filter((item) => item.imageUrl.startsWith('http') && !item.imageUrl.includes('/static/images/') && !item.imageUrl.endsWith('.svg'));
    });
    return scraped.slice(0, 20);
  } finally {
    await browser.close();
  }
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!query) return NextResponse.json({ results: [], webResults: [], provider: 'None' });
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  const warnings: string[] = [];
  if (pexelsKey) {
    try {
      const results = await searchPexelsImages(query, pexelsKey);
      if (results.length > 0) return NextResponse.json({ results, webResults: [], provider: 'Pexels' });
    } catch (err) { warnings.push(err instanceof Error ? err.message : 'Pexels failed'); }
  }
  try {
    const results = await searchOpenverseImages(query);
    if (results.length > 0) return NextResponse.json({ results, webResults: [], provider: 'Openverse', ...(warnings.length ? { warning: warnings.join(' | ') } : {}) });
  } catch (err) { warnings.push(err instanceof Error ? err.message : 'Openverse failed'); }
  try {
    const results = await searchWikimediaCommonsImages(query);
    if (results.length > 0) return NextResponse.json({ results, webResults: [], provider: 'Wikimedia Commons', ...(warnings.length ? { warning: warnings.join(' | ') } : {}) });
  } catch (err) { warnings.push(err instanceof Error ? err.message : 'Wikimedia Commons failed'); }
  try {
    const results = await searchWithHeadlessChromium(query);
    return NextResponse.json({ results, webResults: [], provider: 'Headless Chromium', ...(warnings.length ? { warning: warnings.join(' | ') } : {}) });
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : 'Headless Chromium failed');
    return NextResponse.json({ error: warnings.join(' | '), results: [], webResults: [], provider: 'Error' }, { status: 502 });
  }
}
