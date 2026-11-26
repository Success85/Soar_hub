# Putting SOAR Hub online for free

Everything below uses free plans. You don't need a domain or a payment card: the site gets a free address like
`https://<your-project>.vercel.app`.

| Part | Free service | What it does |
|---|---|---|
| The website | **Vercel** (Hobby plan) | Runs the app, rebuilds automatically on every `git push` |
| Database and uploaded files | **Supabase** (Free plan) | PostgreSQL with pgvector (500 MB) and private file storage (1 GB) |
| Scheduled jobs | **cron-job.org** | Calls the app every 5 minutes / every hour (emails, reminders, closing deadlines, AI queue) |
| Email | your **Gmail** App Password | Same as on your laptop (about 500 emails a day) |
| Payments | **Flutterwave** | Same keys as on your laptop (test mode until you go live) |

**Limits of the free setup, so nothing surprises you:**
- **Vercel's Hobby plan is meant for personal, non-commercial projects.** It's fine for testing and showing SOAR Hub.
  Once you charge real members real money, Vercel's terms expect the Pro plan (or move hosts at that point).
- **Supabase pauses a free project after a week with no activity.** The cron-job.org calls below keep it active.
- **No virus scanning** (ClamAV needs a server of its own): uploads are marked "not scanned".
- The first visit after a quiet period can take a few seconds while the app wakes up.

You'll do everything from your browser plus a few commands in your project folder. Keep a text file open to collect
the values marked **SAVE** (don't put it in the project folder or on GitHub).

---

## Step 1: Supabase (database and file storage)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**: name `soar-hub`, create a **strong database password** (**SAVE** it), region closest to Nigeria
   (e.g. *West EU (London)* or *Central EU (Frankfurt)*), plan **Free**. Wait ~2 minutes.
3. Click **Connect** (top of the project page). Under **Connection string → URI**, copy two strings and replace
   `[YOUR-PASSWORD]` in each with your database password. Add `?sslmode=require` at the end of both:
   - **Session pooler** (port `5432`): **SAVE** as *SETUP_URL* (your laptop uses this once).
   - **Transaction pooler** (port `6543`): **SAVE** as *APP_URL_DB* (the website uses this).
4. **Storage** (left menu) → **New bucket** → name `soar-documents`, leave **Public bucket OFF** → Create.
5. **Storage → Settings** (or **Project Settings → Storage**) → **S3 Connection**: make sure it's enabled.
   **SAVE** the **Endpoint** and **Region**. Click **New access key** → **SAVE** the **Access key ID** and
   **Secret access key** (the secret is shown only once).

## Step 2: Load the data into Supabase (from your laptop)

In your project folder (the one you `git pull` into), run these one at a time, pasting your *SETUP_URL* in the first:

```bash
export DATABASE_URL="paste-your-SETUP_URL-here"
npm run db:migrate
npm run db:seed
npm run db:import-scholarships
npm run db:import-resources
ADMIN_EMAIL=your@email.com ADMIN_FIRST_NAME=Your ADMIN_LAST_NAME=Name npm run db:create-admin
unset DATABASE_URL
```

`db:create-admin` prints a **one-time password** for your admin account: **SAVE** it. Don't run `db:seed:demo` here:
demo accounts have a public password. `unset` makes your laptop go back to its own local database afterwards.

## Step 3: Make two secrets

```bash
openssl rand -base64 48
```

Run it twice. **SAVE** the first as *SESSION_SECRET* and the second as *CRON_SECRET*.

## Step 4: Vercel (the website)

1. Go to **vercel.com** → **Sign up** → **Hobby** → continue with GitHub, and allow Vercel to see
   **this repository** (the one this guide is in).
2. **Add New… → Project** → import **this repository**. Framework: **Next.js** (detected). Root directory: leave as `./`.
3. Open **Environment Variables** and add these (name on the left, your value on the right):

   | Name | Value |
   |---|---|
   | `APP_URL` | `https://<your-project>.vercel.app` (you'll correct it after the first deploy if Vercel gives a different address) |
   | `DATABASE_URL` | your *APP_URL_DB* (Transaction pooler, port 6543) |
   | `DATABASE_POOL_MAX` | `3` |
   | `SESSION_SECRET` | your *SESSION_SECRET* |
   | `CRON_SECRET` | your *CRON_SECRET* |
   | `STORAGE_DRIVER` | `s3` |
   | `STORAGE_BUCKET` | `soar-documents` |
   | `S3_ENDPOINT` | the Supabase storage **Endpoint** |
   | `S3_REGION` | the Supabase storage **Region** |
   | `S3_ACCESS_KEY_ID` | the Supabase access key ID |
   | `S3_SECRET_ACCESS_KEY` | the Supabase secret access key |
   | `S3_FORCE_PATH_STYLE` | `true` |
   | `EMAIL_PROVIDER` | `smtp` |
   | `SMTP_USER` | your Gmail address |
   | `SMTP_PASSWORD` | your Gmail App Password |
   | `EMAIL_FROM` | `SOAR Hub <your Gmail address>` |
   | `FLW_SECRET_KEY` | your Flutterwave secret key (test mode for now) |
   | `FLW_SECRET_HASH` | your Flutterwave secret hash |
   | `AI_PROVIDER` / `AI_API_KEY` | optional: only if you have Anthropic API credit (each critique costs a few cents) |

4. Server code runs in **Dublin** (`dub1` in `vercel.json`), next to a Supabase project in West EU (Ireland). If your
   Supabase project is in another region, change it under **Settings → Functions → Function Region** to the closest
   one; far apart, pages time out (504).
5. Click **Deploy** and wait for "Congratulations". Click the preview to open your site and note its address.
6. If the address differs from what you put in `APP_URL`: **Settings → Environment Variables → APP_URL → Edit**,
   save, then **Deployments → ⋯ (latest) → Redeploy**. Links in emails and the Flutterwave return page use `APP_URL`.

## Step 5: cron-job.org (scheduled jobs)

1. Sign up free at **cron-job.org** → **Create cronjob**, twice:

   | Title | URL | Schedule |
   |---|---|---|
   | SOAR Hub frequent | `https://<your-site>/api/cron/frequent` | Every 5 minutes |
   | SOAR Hub hourly | `https://<your-site>/api/cron/hourly` | Every hour |

2. In each job, open **Advanced → Headers** → add header **`Authorization`** with value **`Bearer <your CRON_SECRET>`**
   (the word *Bearer*, a space, then the secret). Save.
3. Use **Test run**: it should answer `200` with a short JSON report. `401` means the header value is wrong.

The daily job (reminders, clean-up) is run by Vercel itself (`vercel.json`).

## Step 6: Flutterwave webhook

Flutterwave dashboard (Test mode) → **Settings → Webhooks** → URL
`https://<your-site>/api/webhooks/flutterwave`, Secret hash = the same value as `FLW_SECRET_HASH` → Save.

## Step 7: Check everything

1. Open your site, **Sign in** with your admin email and the one-time password → **Settings → change your password**.
2. **Admin → Settings → Integrations**: Email, Payments, File storage (S3) **Active**; SMS off; Malware scanning
   "not configured" (expected on the free setup).
3. **Admin → Settings → Membership & payments**: price **25000**, length **12**.
4. **Test email delivery** → send one to yourself.
5. In a private window: register a new account → verify → pay with a Flutterwave test card → you're a member.

## Updating the live site later

- **Code changes:** `git push` to `main`; Vercel rebuilds and publishes automatically (1–3 minutes).
- **Database changes** (when an update includes a new migration): run Step 2's `export DATABASE_URL=…`,
  `npm run db:migrate` and `unset DATABASE_URL` again.
- **Going live with payments:** finish Flutterwave's business verification, then replace `FLW_SECRET_KEY` and
  `FLW_SECRET_HASH` in Vercel with the **live** values, set the webhook again in **Live mode**, and Redeploy.
