// Verifies the Cloudflare Access JWT so admin endpoints fail closed even if the Access policy is misconfigured.
// Env: ACCESS_TEAM_DOMAIN (e.g. "myteam.cloudflareaccess.com"), ACCESS_AUD (Access application AUD tag).

let jwksCache = { at: 0, keys: [] };

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlToJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys(teamDomain, force) {
  if (!force && Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Unable to load Access signing keys.');
  const { keys } = await res.json();
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export async function getEditor(request, env) {
  // Local development only: honored solely for localhost requests when .dev.vars defines it.
  if (env.DEV_EDITOR_EMAIL && ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)) {
    return env.DEV_EDITOR_EMAIL;
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = b64urlToJson(parts[0]);
    const payload = b64urlToJson(parts[1]);
    if (header.alg !== 'RS256') return null;

    let jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN, false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await getKeys(env.ACCESS_TEAM_DOMAIN, true)).find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return null;

    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return null;
    if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;

    return payload.email || 'unknown';
  } catch {
    return null;
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Returns { editor } or { response } to return immediately.
export async function requireEditor(context) {
  const { request, env } = context;
  if (!env.CONTENT_KV || !env.MEDIA_BUCKET) {
    return { response: json({ error: 'Content storage is not configured.' }, 500) };
  }
  const editor = await getEditor(request, env);
  if (!editor) return { response: json({ error: 'Sign-in required.' }, 401) };
  return { editor };
}
