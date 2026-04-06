/**
 * MBC Receipt — OTP Auth Worker
 *
 * Routes:
 *   POST /send-otp    { email }              → generates + emails 6-digit OTP
 *   POST /verify-otp  { email, otp }         → validates OTP, returns session token
 *   POST /verify-session { token }           → checks if a session token is still valid
 *
 * KV bindings (set in wrangler.toml):
 *   MBC_KV  — stores  otp:{email}       (TTL 600 s)
 *                      session:{token}   (TTL 28800 s = 8 h)
 *
 * Environment variables / secrets:
 *   ALLOWED_EMAILS   comma-separated list of authorised emails
 *   FROM_EMAIL       sender address  e.g. receipts@miltonbadmintonclub.com
 *   FROM_NAME        sender display name  e.g. Milton Badminton Club
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

function otp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function token() {
  return crypto.randomUUID().replace(/-/g, '');
}

async function sendEmail(env, to, code) {
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: env.FROM_EMAIL, name: env.FROM_NAME || 'Milton Badminton Club' },
    subject: `Your login code: ${code}`,
    content: [
      {
        type: 'text/html',
        value: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-flex;align-items:center;justify-content:center;
                          width:48px;height:48px;background:#1a2a6c;border-radius:12px;margin-bottom:12px;">
                <span style="font-size:22px;">🏸</span>
              </div>
              <h2 style="margin:0;font-size:20px;color:#1c2340;font-weight:700;">Milton Badminton Club</h2>
              <p style="margin:4px 0 0;font-size:13px;color:#7a869a;">Receipt Generator — Login Code</p>
            </div>
            <div style="background:#f4f6ff;border-radius:12px;padding:28px;text-align:center;margin-bottom:20px;">
              <p style="margin:0 0 12px;font-size:13px;color:#3a4464;">Your one-time login code is:</p>
              <div style="font-size:38px;font-weight:800;letter-spacing:0.2em;color:#1a2a6c;font-family:monospace;">${code}</div>
              <p style="margin:12px 0 0;font-size:12px;color:#7a869a;">Valid for 10 minutes. Do not share this code.</p>
            </div>
            <p style="font-size:12px;color:#a0aec0;text-align:center;margin:0;">
              If you didn't request this, you can safely ignore it.<br>
              Milton Badminton Club · 2015 Pan Am Blvd, Milton, ON
            </p>
          </div>`,
      },
    ],
  };

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => '');
    throw new Error(`MailChannels ${res.status}: ${text}`);
  }
}

export default {
  async fetch(request, env) {
    // Preflight
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
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    // ── POST /send-otp ──────────────────────────────────────────────────────
    if (url.pathname === '/send-otp') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return json({ error: 'Email is required.' }, 400);

      if (allowed.length && !allowed.includes(email)) {
        // Return generic message — don't reveal whether email is registered
        return json({ ok: true });
      }

      const code = otp();
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
      const email = (body.email || '').trim().toLowerCase();
      const code  = (body.otp  || '').trim();
      if (!email || !code) return json({ error: 'Email and code are required.' }, 400);

      const stored = await env.MBC_KV.get(`otp:${email}`);
      if (!stored || stored !== code) {
        return json({ ok: false, error: 'Invalid or expired code.' }, 401);
      }

      // Consume OTP
      await env.MBC_KV.delete(`otp:${email}`);

      // Issue session token (8 hours)
      const sess = token();
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
