# MBC Receipt Generator

A self-contained, browser-based receipt generator for **Milton Badminton Club**. Generates professionally formatted PDF receipts for member fee payments — no backend required beyond a Cloudflare Worker for authentication.

---

## How it works

```
Browser (index.html)
  │
  ├─ Login → POST /login          ──► Cloudflare Worker ──► validates password secret
  ├─ Login → POST /verify-session ──► Cloudflare Worker ──► KV (session token check)
  │
  └─ Fill form → Download PDF (all local, no upload)
```

- **Auth** — shared password validated by Cloudflare Worker. Session lasts 8 hours.
- **Receipt** — rendered live in the browser; exported as a fixed-width PDF using html2pdf.js.
- **No data is stored** — all form data stays in-browser only.

---

## Files

```
mbc-receipts/
├── index.html      # Full app — UI, form, live preview, PDF export
├── worker.js       # Cloudflare Worker — password login, session management
├── wrangler.toml   # Worker deployment config
└── README.md
```

---

## Using the receipt generator

### 1. Log in

Open `index.html` in a browser (or visit the hosted URL).

1. Enter the **club password** and click **Unlock**
2. You are logged in for **8 hours** without needing to re-authenticate

> Contact your admin for the password.

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

The PDF is rendered at a fixed A4 width regardless of your screen size.  
The filename is the receipt number, e.g. `MBC-20260406-247.pdf`.

---

## Deploying the Worker

### Prerequisites

- [Node.js](https://nodejs.org/) installed
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)

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

### Step 3 — Set the password secret

```bash
npx wrangler secret put ACCESS_PASSWORD
# enter your chosen password when prompted
```

---

### Step 4 — Deploy

```bash
npx wrangler deploy
```

Copy the Worker URL from the output (e.g. `https://mbc-receipt-auth.YOUR-SUBDOMAIN.workers.dev`).

---

### Step 5 — Update index.html

Open `index.html` and set `WORKER_URL` to your deployed Worker URL:

```js
const WORKER_URL = 'https://mbc-receipt-auth.YOUR-SUBDOMAIN.workers.dev';
```

---

## Changing the password

```bash
npx wrangler secret put ACCESS_PASSWORD
# enter the new password when prompted
npx wrangler deploy
```

---

## Worker API reference

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/login` | POST | `{ "password": "..." }` | `{ "ok": true, "token": "..." }` or `{ "ok": false, "error": "..." }` |
| `/verify-session` | POST | `{ "token": "..." }` | `{ "ok": true }` or `{ "ok": false }` |

---

## Tech stack

| Component | Technology |
|-----------|-----------|
| UI + PDF | Vanilla HTML/CSS/JS · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) |
| Fonts | Google Fonts — Barlow, Inter |
| Auth backend | [Cloudflare Workers](https://workers.cloudflare.com/) + [Workers KV](https://developers.cloudflare.com/kv/) |
