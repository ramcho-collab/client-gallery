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
    return NextResponse.json({ results: [], webResults: [] });
  }

  try {
    const serperKey = process.env.SERPER_API_KEY?.trim();
    if (serperKey && serperKey !== 'your_serper_api_key_here') {
      const [imgRes, webRes] = await Promise.all([
        fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 18 }),
          cache: 'no-store',
        }),
        fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, num: 10 }),
          cache: 'no-store',
        }),
      ]);

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

    // Free built-in search (works with zero API keys): Wikimedia Commons images + Wikipedia web search
    const wikiImgParams = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${query}`,
      gsrnamespace: '6',
      gsrlimit: '18',
      prop: 'imageinfo',
      iiprop: 'url|size',
      iiurlwidth: '480',
      format: 'json',
      origin: '*',
    });

    const wikiWebParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '8',
      format: 'json',
      origin: '*',
    });

    const [wikiImgRes, wikiWebRes] = await Promise.all([
      fetch(`https://commons.wikimedia.org/w/api.php?${wikiImgParams}`, {
        headers: { 'User-Agent': 'ClientGalleryAdmin/1.0' },
        cache: 'no-store',
      }),
      fetch(`https://en.wikipedia.org/w/api.php?${wikiWebParams}`, {
        headers: { 'User-Agent': 'ClientGalleryAdmin/1.0' },
        cache: 'no-store',
      }),
    ]);

    const wikiImgData = wikiImgRes.ok ? await wikiImgRes.json() : {};
    const pages = wikiImgData?.query?.pages ? Object.values(wikiImgData.query.pages) : [];
    const results: WebImageResult[] = (pages as Array<Record<string, unknown>>)
      .map((page, idx) => {
        const infoList = Array.isArray(page.imageinfo) ? page.imageinfo : [];
        const info = (infoList[0] as Record<string, unknown>) || {};
        const imageUrl = typeof info.url === 'string' ? info.url : '';
        if (!imageUrl) return null;
        const rawTitle = String(page.title || `Image ${idx + 1}`).replace(/^File:/i, '');
        return {
          id: `wiki-img-${String(page.pageid || idx)}`,
          title: rawTitle,
          imageUrl,
          thumbnailUrl: typeof info.thumburl === 'string' ? info.thumburl : imageUrl,
          sourceUrl: typeof info.descriptionurl === 'string' ? info.descriptionurl : imageUrl,
          width: Number(info.width || 0),
          height: Number(info.height || 0),
        };
      })
      .filter((item): item is WebImageResult => item !== null);

    const wikiWebData = wikiWebRes.ok ? await wikiWebRes.json() : {};
    const searchList = Array.isArray(wikiWebData?.query?.search) ? wikiWebData.query.search : [];
    const webResults: WebSearchLink[] = searchList.map(
      (item: Record<string, unknown>, idx: number) => {
        const title = String(item.title || `Result ${idx + 1}`);
        const snippet = String(item.snippet || '').replace(/<[^>]+>/g, '');
        return {
          id: `wiki-web-${String(item.pageid || idx)}`,
          title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
          snippet,
        };
      }
    );

    return NextResponse.json({ results, webResults, provider: 'Web Search' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message, results: [], webResults: [] }, { status: 500 });
  }
}
