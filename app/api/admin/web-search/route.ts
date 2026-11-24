import { NextRequest, NextResponse } from 'next/server';

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

async function searchPexelsImages(query: string, apiKey: string): Promise<WebImageResult[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20`,
    {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error(`Pexels API returned ${res.status}`);
  }

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
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      throw new Error(`Openverse API returned ${res.status}`);
    }

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

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!query) {
    return NextResponse.json({ results: [], webResults: [], provider: 'None' });
  }

  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  const serpApiKey = process.env.SERPAPI_KEY?.trim();
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();

  try {
    // 1. Pexels API (Reliable high-res photos for /admin gallery & downloads)
    if (pexelsKey) {
      const results = await searchPexelsImages(query, pexelsKey);
      return NextResponse.json({ results, webResults: [], provider: 'Pexels' });
    }

    // 2. SerpApi (if a valid key is configured)
    if (serpApiKey) {
      const [webRes, imgRes] = await Promise.all([
        fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(serpApiKey)}`),
        fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(serpApiKey)}`),
      ]);

      if (webRes.ok || imgRes.ok) {
        const webJson = webRes.ok ? await webRes.json() : {};
        const imgJson = imgRes.ok ? await imgRes.json() : {};

        const webResults: WebSearchLink[] = (Array.isArray(webJson?.organic_results) ? webJson.organic_results : [])
          .filter((item: Record<string, unknown>) => typeof item.link === 'string')
          .map((item: Record<string, unknown>, idx: number) => ({
            id: `serpapi-web-${idx}`,
            title: String(item.title || item.link),
            url: String(item.link),
            snippet: String(item.snippet || ''),
          }));

        const results: WebImageResult[] = (Array.isArray(imgJson?.images_results) ? imgJson.images_results : [])
          .filter((item: Record<string, unknown>) => typeof item.original === 'string')
          .map((item: Record<string, unknown>, idx: number) => ({
            id: `serpapi-img-${idx}`,
            title: String(item.title || `Image ${idx + 1}`),
            imageUrl: String(item.original),
            thumbnailUrl: String(item.thumbnail || item.original),
            sourceUrl: String(item.link || item.original),
            width: Number(item.original_width || 0),
            height: Number(item.original_height || 0),
          }));

        return NextResponse.json({ results, webResults, provider: 'SerpApi' });
      }
    }

    // 3. Serper (if a valid key is configured)
    if (serperKey && serperKey !== 'your_serper_api_key_here') {
      const [imgRes, webRes] = await Promise.all([
        fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 20 }),
        }),
        fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 10 }),
        }),
      ]);

      if (imgRes.ok || webRes.ok) {
        const imgData = imgRes.ok ? await imgRes.json() : { images: [] };
        const webData = webRes.ok ? await webRes.json() : { organic: [] };

        const results: WebImageResult[] = (Array.isArray(imgData.images) ? imgData.images : [])
          .filter((item: Record<string, unknown>) => typeof item.imageUrl === 'string')
          .map((item: Record<string, unknown>, idx: number) => ({
            id: `google-img-${idx}-${String(item.imageUrl).slice(-16)}`,
            title: String(item.title || `Image ${idx + 1}`),
            imageUrl: String(item.imageUrl),
            thumbnailUrl: String(item.thumbnailUrl || item.imageUrl),
            sourceUrl: String(item.link || item.imageUrl),
            width: Number(item.imageWidth || 0),
            height: Number(item.imageHeight || 0),
          }));

        const webResults: WebSearchLink[] = (Array.isArray(webData.organic) ? webData.organic : [])
          .filter((item: Record<string, unknown>) => typeof item.link === 'string')
          .map((item: Record<string, unknown>, idx: number) => ({
            id: `google-web-${idx}`,
            title: String(item.title || item.link),
            url: String(item.link),
            snippet: String(item.snippet || ''),
          }));

        return NextResponse.json({ results, webResults, provider: 'Google' });
      }
    }

    // 4. Brave Search (if a valid key is configured)
    if (braveKey) {
      const headers = {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'X-Subscription-Token': braveKey,
      };

      const [webRes, imgRes] = await Promise.all([
        fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, { headers }),
        fetch(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=20&safesearch=off`, { headers }),
      ]);

      if (webRes.ok || imgRes.ok) {
        const webJson = webRes.ok ? await webRes.json() : {};
        const imgJson = imgRes.ok ? await imgRes.json() : {};

        const webResults: WebSearchLink[] = (Array.isArray(webJson?.web?.results) ? webJson.web.results : [])
          .map((item: Record<string, unknown>, idx: number) => ({
            id: `brave-web-${idx}`,
            title: String(item.title || item.url || `Result ${idx + 1}`),
            url: String(item.url || ''),
            snippet: String(item.description || ''),
          }))
          .filter((r: WebSearchLink) => Boolean(r.url));

        const results: WebImageResult[] = (Array.isArray(imgJson?.results) ? imgJson.results : [])
          .map((item: Record<string, unknown>, idx: number): WebImageResult | null => {
            const props = (item.properties as Record<string, unknown>) || {};
            const thumb = (item.thumbnail as Record<string, unknown>) || {};
            const imageUrl = String(props.url || item.url || thumb.src || '');
            if (!imageUrl) return null;
            return {
              id: `brave-img-${idx}`,
              title: String(item.title || `Image ${idx + 1}`),
              imageUrl,
              thumbnailUrl: String(thumb.src || imageUrl),
              sourceUrl: String(item.url || imageUrl),
              width: Number(props.width || 0),
              height: Number(props.height || 0),
            };
          })
          .filter((item: WebImageResult | null): item is WebImageResult => item !== null);

        return NextResponse.json({ results, webResults, provider: 'Brave' });
      }
    }

    // 5. Openverse keyless image fallback (no API key needed)
    const results = await searchOpenverseImages(query);
    return NextResponse.json({ results, webResults: [], provider: 'Openverse' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message, results: [], webResults: [], provider: 'Error' }, { status: 500 });
  }
}
