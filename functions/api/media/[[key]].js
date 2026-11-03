// Public: serves uploaded photos from R2. Keys are random and immutable, so they cache hard.
export async function onRequestGet({ env, params }) {
  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  if (!env.MEDIA_BUCKET || !/^img\/[a-f0-9-]{36}\.jpg$/.test(key || '')) {
    return new Response('Not found', { status: 404 });
  }
  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
