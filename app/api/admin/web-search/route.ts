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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractDdgUrl(rawHref: string): string {
  const cleaned = decodeHtmlEntities(rawHref);
  if (cleaned.startsWith('//')) {
    return `https:${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned.startsWith('http') ? cleaned : `https://duckduckgo.com${cleaned}`);
    const uddg = parsed.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : parsed.toString();
  } catch {
    return cleaned;
  }
}

async function searchDuckDuckGoWeb(query: string): Promise<WebSearchLink[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ClientGalleryAdmin/1.0)',
      Accept: 'text/html',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo returned ${res.status}`);
  }

  const html = await res.text();
  const linkMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];

  return linkMatches
    .slice(0, 10)
    .map((match, idx) => {
      const url = extractDdgUrl(match[1] || '');
      const title = decodeHtmlEntities(match[2] || '') || url;
      const rawSnippet = snippetMatches[idx]?.[1] || snippetMatches[idx]?.[2] || '';
      const snippet = decodeHtmlEntities(rawSnippet);
      return {
        id: `ddg-web-${idx}`,
        title,
        url,
        snippet,
      };
    })
    .filter((item) => item.url.startsWith('http'));
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!query) {
    return NextResponse.json({ results: [], webResults: [], provider: 'None' });
  }

  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const serpApiKey = process.env.SERPAPI_KEY?.trim();
  const serperKey = process.env.SERPER_API_KEY?.trim();

  try {
    // 1. Brave Search API (Web + Images)
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

    // 2. SerpApi (Google Web + Google Images)
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

    // 3. Serper (Google Web + Google Images)
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

    // 4. DuckDuckGo Web Search fallback (no API key required)
    const ddgWebResults = await searchDuckDuckGoWeb(query);
    return NextResponse.json({
      results: [],
      webResults: ddgWebResults,
      provider: 'DuckDuckGo',
      note: ddgWebResults.length === 0 ? 'DuckDuckGo returned no web links or challenged the request.' : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message, results: [], webResults: [], provider: 'Error' }, { status: 500 });
  }
}
