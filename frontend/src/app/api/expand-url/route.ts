import { NextResponse } from 'next/server';

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return NextResponse.json({ error: 'Sin URL' }, { status: 400 });

  try {
    // HEAD para no descargar el body, solo seguir el redirect
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return NextResponse.json({ url: res.url });
  } catch {
    return NextResponse.json({ error: 'No se pudo expandir la URL' }, { status: 502 });
  }
}
