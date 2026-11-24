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
    return NextResponse.json({ results: [], webResults: [], provider: 'Google' });
  }

  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (!serperKey || serperKey === 'your_serper_api_key_here') {
    return NextResponse.json(
      {
        error: 'SERPER_API_KEY is not set. Add your Serper Google API key to .env.local and Vercel production.',
        results: [],
        webResults: [],
        provider: 'Google',
      },
      { status: 503 }
    );
  }

  try {
    const [imgRes, webRes] = await Promise.all([
      fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 20 }),
        cache: 'no-store',
      }),
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 10 }),
        cache: 'no-store',
      }),
    ]);

    if (!imgRes.ok && !webRes.ok) {
      return NextResponse.json(
        {
          error: `Google search API returned ${imgRes.status || webRes.status}. Check SERPER_API_KEY.`,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google search failed';
    return NextResponse.json(
      { error: message, results: [], webResults: [], provider: 'Google' },
      { status: 500 }
    );
  }
}
