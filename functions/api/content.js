import { json } from '../_lib/auth.js';

// Public: the published content overrides, or 404 so the page falls back to site-content.json.
export async function onRequestGet({ env }) {
  if (!env.CONTENT_KV) return json({ error: 'Not configured.' }, 404);
  const published = await env.CONTENT_KV.get('published');
  if (!published) return json({ error: 'No published content.' }, 404);
  return new Response(published, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
  });
}
