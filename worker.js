/**
 * MBC Receipt — OTP Auth Worker (Email via Resend)
 *
 * Routes:
 *   POST /send-otp       { email }            → generates + emails 6-digit OTP
 *   POST /verify-otp     { email, otp }       → validates OTP, returns session token
 *   POST /verify-session { token }            → checks if a session token is still valid
 *
 * KV bindings (set in wrangler.toml):
 *   MBC_KV  — stores  otp:{email}       (TTL 600 s)
 *                      session:{token}   (TTL 28800 s = 8 h)
 *
 * Secrets (set via: npx wrangler secret put <NAME>):
 *   ALLOWED_EMAILS    comma-separated emails e.g. admin@miltonbadmintonclub.com,you@gmail.com
 *   RESEND_API_KEY    your Resend API key  re_xxxxxxxxxxxx
 *   FROM_EMAIL        sender address on your verified Resend domain e.g. noreply@miltonbadmintonclub.com
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

function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function normaliseEmail(raw) {
  return raw.trim().toLowerCase();
}

async function sendEmail(env, to, code) {
  const from = env.FROM_EMAIL || 'noreply@miltonbadmintonclub.com';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Milton Badminton Club <${from}>`,
      to: [to],
      subject: 'Your MBC login code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1a1a1a;margin-bottom:8px">Milton Badminton Club</h2>
          <p style="color:#555;margin-bottom:24px">Your one-time login code:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a;
                      background:#f5f5f5;border-radius:8px;padding:16px 24px;display:inline-block">
            ${code}
          </div>
          <p style="color:#888;font-size:13px;margin-top:24px">
            Valid for 10 minutes. Do not share this code.
          </p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${text}`);
  }
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

    const allowed = (env.ALLOWED_EMAILS || '')
      .split(',').map(e => normaliseEmail(e)).filter(Boolean);

    // ── POST /send-otp ──────────────────────────────────────────────────────
    if (url.pathname === '/send-otp') {
      const raw = (body.email || '').trim();
      if (!raw) return json({ error: 'Email address is required.' }, 400);
      const email = normaliseEmail(raw);

      if (allowed.length && !allowed.includes(email)) {
        // Generic response — don't reveal whether address is registered
        return json({ ok: true });
      }

      const code = genOTP();
      await env.MBC_KV.put(`otp:${email}`, code, { expirationTtl: 600 });

      try {
        await sendEmail(env, email, code);
      } catch (e) {
        console.error('sendEmail failed:', e.message);
        return json({ error: 'Failed to send email. Please try again.' }, 500);
      }

      return json({ ok: true });
    }

    // ── POST /verify-otp ────────────────────────────────────────────────────
    if (url.pathname === '/verify-otp') {
      const email = normaliseEmail((body.email || '').trim());
      const code  = (body.otp || '').trim();
      if (!email || !code) return json({ error: 'Email and code are required.' }, 400);

      const stored = await env.MBC_KV.get(`otp:${email}`);
      if (!stored || stored !== code) {
        return json({ ok: false, error: 'Invalid or expired code.' }, 401);
      }

      await env.MBC_KV.delete(`otp:${email}`);

      const sess = genToken();
      await env.MBC_KV.put(`session:${sess}`, email, { expirationTtl: 28800 });

      return json({ ok: true, token: sess });
    }

    // ── POST /verify-session ────────────────────────────────────────────────
    if (url.pathname === '/verify-session') {
      const sess = (body.token || '').trim();
      if (!sess) return json({ ok: false }, 400);
      const email = await env.MBC_KV.get(`session:${sess}`);
      return json({ ok: !!email, email: email || null });
    }

    return json({ error: 'Not found' }, 404);
  },
};
