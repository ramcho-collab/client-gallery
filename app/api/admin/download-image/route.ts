import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  const requestedName = req.nextUrl.searchParams.get('filename') || 'downloaded-picture.jpg';

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response('Invalid image URL', { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'ClientGalleryAdmin/1.0',
      },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return new Response(`Upstream image returned ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const safeFilename = requestedName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buffer = await upstream.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch image';
    return new Response(message, { status: 500 });
  }
}
