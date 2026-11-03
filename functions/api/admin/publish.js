import { json, requireEditor } from '../../_lib/auth.js';

// POST { action: "publish" } copies the draft live (keeping the old version).
// POST { action: "restore" } puts the previous published version live again.
export async function onRequestPost(context) {
  const auth = await requireEditor(context);
  if (auth.response) return auth.response;
  const kv = context.env.CONTENT_KV;

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    /* default action below */
  }

  if (body.action === 'restore') {
    const previous = await kv.get('previous');
    if (!previous) return json({ error: 'There is no previous version to restore.' }, 404);
    const current = await kv.get('published');
    await kv.put('published', previous);
    await kv.put('draft', previous);
    if (current) await kv.put('previous', current);
    return json({ ok: true, restored: true, published: JSON.parse(previous) });
  }

  const draft = await kv.get('draft');
  if (!draft) return json({ error: 'Nothing to publish. Save a draft first.' }, 400);
  const current = await kv.get('published');
  if (current) await kv.put('previous', current);
  await kv.put('published', draft);
  await kv.put('published_meta', JSON.stringify({ by: auth.editor, at: new Date().toISOString() }));
  return json({ ok: true, published: JSON.parse(draft) });
}
