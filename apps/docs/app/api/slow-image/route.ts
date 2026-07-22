import { NextResponse } from 'next/server';

const MAX_DELAY_MS = 5_000;

/**
 * Demo-only delay proxy: waits, then streams the upstream image.
 * Emulates a slow network response so lightbox placeholders stay visible.
 * Allows same-origin static media (imported demo assets) only.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const target = searchParams.get('url');
  const ms = Math.min(
    Math.max(Number(searchParams.get('ms') ?? '500') || 0, 0),
    MAX_DELAY_MS,
  );

  if (!target) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = target.startsWith('/')
      ? new URL(target, requestUrl.origin)
      : new URL(target);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (parsed.origin !== requestUrl.origin) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
  }

  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  const upstream = await fetch(parsed, {
    cache: 'no-store',
    headers: { Accept: 'image/*' },
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'no-store',
    },
  });
}
