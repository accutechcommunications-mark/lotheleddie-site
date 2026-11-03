import { json, requireEditor } from '../../_lib/auth.js';

const MAX_BYTES = 6 * 1024 * 1024;

// The editor converts every photo to JPEG in the browser; the server verifies that.
export async function onRequestPost(context) {
  const auth = await requireEditor(context);
  if (auth.response) return auth.response;

  const bytes = new Uint8Array(await context.request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) {
    return json({ error: 'Image must be under 6 MB.' }, 413);
  }
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return json({ error: 'Only JPEG images are accepted.' }, 415);
  }

  const key = `img/${crypto.randomUUID()}.jpg`;
  await context.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  return json({ ok: true, src: `/api/media/${key}` });
}
