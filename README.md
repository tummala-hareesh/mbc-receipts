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

## Tech stack

| Component | Technology |
|-----------|-----------|
| UI + PDF | Vanilla HTML/CSS/JS · [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) |
| Fonts | Google Fonts — Barlow, Inter |
| Auth backend | [Cloudflare Workers](https://workers.cloudflare.com/) + [Workers KV](https://developers.cloudflare.com/kv/) |
| Email delivery | [MailChannels](https://mailchannels.com/) (free via Cloudflare Workers) |
