import { json, requireEditor } from '../../_lib/auth.js';

const MAX_TEXT = 4000;
const IMG_SRC = /^(assets\/[A-Za-z0-9._-]+|\/api\/media\/img\/[a-f0-9-]{36}\.jpg)$/;

// Accepts only the known shape so a bad save can never break the page.
function sanitize(input) {
  const out = { sections: {}, text: {}, images: {} };
  if (!input || typeof input !== 'object') return out;

  for (const [k, v] of Object.entries(input.sections || {})) {
    if (/^[a-z-]+$/.test(k) && v && typeof v.visible === 'boolean') out.sections[k] = { visible: v.visible };
  }
  for (const [k, v] of Object.entries(input.text || {})) {
    if (/^[a-zA-Z0-9.]+$/.test(k) && typeof v === 'string') out.text[k] = v.slice(0, MAX_TEXT);
  }
  for (const [k, v] of Object.entries(input.images || {})) {
    if (!/^[a-zA-Z0-9.]+$/.test(k) || !v || typeof v.src !== 'string' || !IMG_SRC.test(v.src)) continue;
    out.images[k] = { src: v.src, caption: typeof v.caption === 'string' ? v.caption.slice(0, 300) : '' };
  }
  return out;
}

export async function onRequestGet(context) {
  const auth = await requireEditor(context);
  if (auth.response) return auth.response;
  const { env } = context;
  const draft = await env.CONTENT_KV.get('draft');
  const published = await env.CONTENT_KV.get('published');
  const previous = await env.CONTENT_KV.get('previous');
  return json({
    editor: auth.editor,
    draft: draft ? JSON.parse(draft) : null,
    published: published ? JSON.parse(published) : null,
    canRestore: Boolean(previous)
  });
}

export async function onRequestPut(context) {
  const auth = await requireEditor(context);
  if (auth.response) return auth.response;
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400);
  }
  const clean = sanitize(body);
  await context.env.CONTENT_KV.put('draft', JSON.stringify(clean));
  return json({ ok: true, draft: clean });
}
