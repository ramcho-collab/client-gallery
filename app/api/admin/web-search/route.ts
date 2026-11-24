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
      const [webRes, imgRes] = await Promise.all([
        fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
          headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' },
          cache: 'no-store',
        }),
        fetch(`https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=20`, {
          headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' },
          cache: 'no-store',
        }),
      ]);

      if (!webRes.ok && !imgRes.ok) {
        return NextResponse.json(
          { error: `Brave Search API returned ${webRes.status || imgRes.status}. Check BRAVE_SEARCH_API_KEY.`, results: [], webResults: [], provider: 'Brave' },
          { status: 502 }
        );
      }

      const webJson = webRes.ok ? await webRes.json() : {};
      const imgJson = imgRes.ok ? await imgRes.json() : {};

      const webResults: WebSearchLink[] = (Array.isArray(webJson?.web?.results) ? webJson.web.results : []).map(
        (item: Record<string, unknown>, idx: number) => ({
          id: `brave-web-${idx}`,
          title: String(item.title || item.url || `Result ${idx + 1}`),
          url: String(item.url || ''),
          snippet: String(item.description || ''),
        })
      ).filter((r: WebSearchLink) => Boolean(r.url));

      const results: WebImageResult[] = (Array.isArray(imgJson?.results) ? imgJson.results : [])
        .map((item: Record<string, unknown>, idx: number) => {
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

    // 2. SerpApi (Google Web + Google Images)
    if (serpApiKey) {
      const [webRes, imgRes] = await Promise.all([
        fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(serpApiKey)}`, {
          cache: 'no-store',
        }),
        fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(serpApiKey)}`, {
          cache: 'no-store',
        }),
      ]);

      if (!webRes.ok && !imgRes.ok) {
        return NextResponse.json(
          { error: `SerpApi returned ${webRes.status || imgRes.status}. Check SERPAPI_KEY.`, results: [], webResults: [], provider: 'SerpApi' },
          { status: 502 }
        );
      }

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

    // 3. Serper (Google Web + Google Images)
    if (serperKey && serperKey !== 'your_serper_api_key_here') {
      const [imgRes, webRes] = await Promise.all([
        fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 20 }),
          cache: 'no-store',
        }),
        fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 10 }),
          cache: 'no-store',
        }),
      ]);

      if (!imgRes.ok && !webRes.ok) {
        const errBody = await (imgRes.ok ? webRes : imgRes).text().catch(() => '');
        return NextResponse.json(
          {
            error: `Google search API returned ${imgRes.status || webRes.status}. Check SERPER_API_KEY.${errBody ? ` Details: ${errBody.slice(0, 140)}` : ''}`,
            results: [],
            webResults: [],
            provider: 'Google',
          },
          { status: 502 }
        );
      }

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

    return NextResponse.json(
      {
        error: 'No search API key configured. Set BRAVE_SEARCH_API_KEY, SERPAPI_KEY, or SERPER_API_KEY in .env.local and Vercel.',
        results: [],
        webResults: [],
        provider: 'None',
      },
      { status: 503 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message, results: [], webResults: [], provider: 'Error' }, { status: 500 });
  }
}
