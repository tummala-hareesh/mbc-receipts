/**
 * MBC Receipt — Password Auth Worker
 *
 * Routes:
 *   POST /login          { password }  → validates password, returns session token
 *   POST /verify-session { token }     → checks if a session token is still valid
 *
 * KV bindings (set in wrangler.toml):
 *   MBC_KV  — stores  session:{token}  (TTL 28800 s = 8 h)
 *
 * Secrets (set via: npx wrangler secret put <NAME>):
 *   ACCESS_PASSWORD    the shared password for the receipt generator
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

    // ── POST /login ─────────────────────────────────────────────────────────
    if (url.pathname === '/login') {
      const password = (body.password || '').trim();
      if (!password) return json({ error: 'Password is required.' }, 400);

      if (password !== env.ACCESS_PASSWORD) {
        return json({ ok: false, error: 'Incorrect password.' }, 401);
      }

      const token = genToken();
      await env.MBC_KV.put(`session:${token}`, '1', { expirationTtl: 28800 });
      return json({ ok: true, token });
    }

    // ── POST /verify-session ────────────────────────────────────────────────
    if (url.pathname === '/verify-session') {
      const sess = (body.token || '').trim();
      if (!sess) return json({ ok: false }, 400);
      const val = await env.MBC_KV.get(`session:${sess}`);
      return json({ ok: !!val });
    }

    return json({ error: 'Not found' }, 404);
  },
};
