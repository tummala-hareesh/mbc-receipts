# MBC Receipt Generator

A self-contained, browser-based receipt generator for **Milton Badminton Club**. Generates professionally formatted PDF receipts for member fee payments — no backend required beyond a Cloudflare Worker for authentication.

---

## How it works

```
Browser (index.html)
  │
  ├─ Login → POST /send-otp   ──► Cloudflare Worker ──► Resend (email OTP)
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
├── index.html        # Full app — UI, form, live preview, PDF export
├── worker.js         # Cloudflare Worker — OTP send/verify, session management
├── wrangler.toml     # Worker deployment config
├── ALLOWEDEMAILS.md  # Authorised email addresses (reference only — set via Worker secret)
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

## Deploying the Worker

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- A [Resend account](https://resend.com) (free — 3,000 emails/month)
- Your domain's DNS managed by Cloudflare (for the verified sender address)

---

### Step 1 — Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

---

### Step 2 — Create the KV namespace

```bash
npx wrangler kv namespace create MBC_KV
```

Copy the `id` from the output and confirm it matches the value in `wrangler.toml`.

---

### Step 3 — Verify your domain in Resend

1. Go to [resend.com/domains](https://resend.com/domains) → **Add Domain**
2. Enter your domain (e.g. `miltonbadmintonclub.com`)
3. Add the DNS records Resend provides (SPF, DKIM, DMARC)
4. Click **Verify** — takes a few minutes to propagate

---

### Step 4 — Get a Resend API key

1. Go to [resend.com/api-keys](https://resend.com/api-keys) → **Create API Key**
2. Name it `mbc-worker`, permission: **Sending access**
3. Copy the key — it starts with `re_`

---

### Step 5 — Set Worker secrets

Run each command and paste the value when prompted:

```bash
# Comma-separated authorised email addresses
npx wrangler secret put ALLOWED_EMAILS
# e.g.  admin@miltonbadmintonclub.com,you@gmail.com

# Resend API key
npx wrangler secret put RESEND_API_KEY
# e.g.  re_xxxxxxxxxxxxxxxxxxxx

```

---

### Step 6 — Deploy

```bash
npx wrangler deploy
```

Copy the Worker URL from the output (e.g. `https://mbc-receipt-auth.YOUR-SUBDOMAIN.workers.dev`).

---

### Step 7 — Update index.html

Open `index.html` and set `WORKER_URL` to your deployed Worker URL:

```js
const WORKER_URL = 'https://mbc-receipt-auth.YOUR-SUBDOMAIN.workers.dev';
```

---

## Managing allowed users

The list of authorised emails is stored as a Worker secret (`ALLOWED_EMAILS`), not in any file.

To update the list, run:

```bash
npx wrangler secret put ALLOWED_EMAILS
# paste the full comma-separated list, e.g.:
# admin@miltonbadmintonclub.com,member@gmail.com,another@example.com
```

`ALLOWEDEMAILS.md` is a local reference only — it is not read by the Worker.

---

## Worker API reference

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/send-otp` | POST | `{ "email": "..." }` | `{ "ok": true }` |
| `/verify-otp` | POST | `{ "email": "...", "otp": "123456" }` | `{ "ok": true, "token": "..." }` or `{ "ok": false, "error": "..." }` |
| `/verify-session` | POST | `{ "token": "..." }` | `{ "ok": true, "email": "..." }` or `{ "ok": false }` |

---

## Tech stack

| Component | Technology |
|-----------|-----------|
| UI + PDF | Vanilla HTML/CSS/JS · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) |
| Fonts | Google Fonts — Barlow, Inter |
| Auth backend | [Cloudflare Workers](https://workers.cloudflare.com/) + [Workers KV](https://developers.cloudflare.com/kv/) |
| Email delivery | [Resend](https://resend.com) (3,000 emails/month free) |
