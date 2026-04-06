# MBC Receipt Generator

A self-contained, browser-based receipt generator for **Milton Badminton Club**. Generates professionally formatted PDF receipts for member fee payments — no backend required beyond a Cloudflare Worker for authentication.

---

## How it works

```
Browser (index.html)
  │
  ├─ Login → POST /send-otp   ──► Cloudflare Worker ──► MailChannels (email OTP)
  ├─ Login → POST /verify-otp ──► Cloudflare Worker ──► KV (validate + issue token)
  │
  └─ Fill form → Download PDF (all local, no upload)
```

- **Auth** — email + one-time code via Cloudflare Worker + KV. Session lasts 8 hours.
- **Receipt** — rendered live in the browser; exported as a PDF using html2pdf.js.
- **No data is stored** — all form data stays in-browser only.

---

## Files

```
mbc-receipts/
├── index.html      # Full app — UI, form, live preview, PDF export
├── worker.js       # Cloudflare Worker — OTP send/verify, session management
├── wrangler.toml   # Worker deployment config
└── README.md
```

---

## Using the receipt generator

### 1. Log in

Open `index.html` in a browser (or visit the hosted URL).

1. Enter your **authorised club email address** and click **Send code**
2. Check your inbox for a **6-digit code** (valid 10 minutes)
3. Enter the code — it submits automatically on the 6th digit
4. You are logged in for **8 hours** without needing to re-authenticate

> Only email addresses in the `ALLOWED_EMAILS` Worker secret can log in. Contact your admin to be added.

---

### 2. Fill in the receipt

The form panel on the left has three sections:

| Section | Fields | Notes |
|---------|--------|-------|
| **Receipt Info** | Issue Date, Receipt No. | Receipt number is auto-generated (`MBC-YYYYMMDD-XXX`); click ↺ to regenerate |
| **Club Details** | Locked — pre-filled | Organization, email, address, schedule |
| **Member Details** | Full Name, Email | The member receiving the receipt |
| **Transaction** | Period From/To, Payment Method, Transaction Date, Amount | All editable |

The **Live Preview** on the right updates instantly as you type.

---

### 3. Preview and download

- **Preview** — click Preview to open a full-screen modal of the final receipt
- **Download PDF** — click Download PDF (in the form panel or the preview modal) to save a PDF

The PDF filename is the receipt number, e.g. `MBC-20260406-247.pdf`.

---

## Deploying the Cloudflare Worker

> One-time setup. Skip if already deployed.

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- A Cloudflare account (free tier is fine)
- A domain with Cloudflare DNS for sending email via MailChannels (required for free MailChannels sending)

### Steps

**1. Install Wrangler**
```bash
npm install -g wrangler
wrangler login
```

**2. Create the KV namespace**
```bash
npx wrangler kv namespace create MBC_KV
```
Copy the `id` from the output and paste it into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "MBC_KV"
id      = "PASTE_YOUR_ID_HERE"
```

**3. Set secrets**
```bash
# Comma-separated list of authorised email addresses
npx wrangler secret put ALLOWED_EMAILS
# → admin@miltonbadmintonclub.com,coach@miltonbadmintonclub.com
```

**4. Update sender address in `wrangler.toml`**
```toml
[vars]
FROM_EMAIL = "receipts@miltonbadmintonclub.com"
FROM_NAME  = "Milton Badminton Club"
```
> `FROM_EMAIL` must be on a domain you control via Cloudflare DNS for MailChannels to send on your behalf. See [MailChannels + Cloudflare Workers](https://blog.cloudflare.com/sending-email-from-workers-with-mailchannels/).

**5. Deploy**
```bash
npx wrangler deploy
```
The CLI will print your Worker URL, e.g.:
```
https://mbc-receipt-auth.YOUR_SUBDOMAIN.workers.dev
```

**6. Set the Worker URL in `index.html`**

Open `index.html` and update line near the top of the `<script>` block:
```js
const WORKER_URL = 'https://mbc-receipt-auth.YOUR_SUBDOMAIN.workers.dev';
```

---

## Managing authorised users

Authorised emails are stored as a Cloudflare Worker secret (`ALLOWED_EMAILS`). To update the list:

```bash
npx wrangler secret put ALLOWED_EMAILS
# Enter the full comma-separated list when prompted:
# admin@miltonbadmintonclub.com,newperson@miltonbadmintonclub.com
```

> You must provide the **full list** each time — the secret is replaced, not appended.

---

## Worker API reference

All endpoints accept and return JSON. Deployed at your Worker URL.

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/send-otp` | `{ email }` | `{ ok: true }` |
| `POST` | `/verify-otp` | `{ email, otp }` | `{ ok: true, token }` or `{ ok: false, error }` |
| `POST` | `/verify-session` | `{ token }` | `{ ok: true, email }` or `{ ok: false }` |

- OTP is valid for **10 minutes**
- Session token is valid for **8 hours**
- Invalid emails return `{ ok: true }` from `/send-otp` (no user enumeration)

---

## Tech stack

| Component | Technology |
|-----------|-----------|
| UI + PDF | Vanilla HTML/CSS/JS · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) |
| Fonts | Google Fonts — Barlow, Inter |
| Auth backend | [Cloudflare Workers](https://workers.cloudflare.com/) + [Workers KV](https://developers.cloudflare.com/kv/) |
| Email delivery | [MailChannels](https://mailchannels.com/) (free via Cloudflare Workers) |
