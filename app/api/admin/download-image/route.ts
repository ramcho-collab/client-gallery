import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const rawUrl = (req.nextUrl.searchParams.get('url') || '').trim();
  const rawName = (req.nextUrl.searchParams.get('name') || 'picture').trim();

  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json({ error: 'Invalid picture URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Failed to fetch picture: ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL did not return a picture' }, { status: 400 });
    }

    const extFromMime = contentType.split('/')[1]?.split(';')[0]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const safeBase = rawName.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'picture';
    const filename = safeBase.toLowerCase().endsWith(`.${extFromMime.toLowerCase()}`) ? safeBase : `${safeBase}.${extFromMime}`;

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
