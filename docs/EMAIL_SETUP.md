# Sending real emails

SOAR Hub sends account emails (verification, the welcome email with the **member ID**, password resets), referee
requests, reminders and review updates. By default (`EMAIL_PROVIDER=console`) nothing leaves your computer: emails
appear at <http://localhost:3000/dev/mailbox>.

Two ways to send real emails:

| | Gmail (below) | Resend (further down) |
|---|---|---|
| Needs a domain? | **No** | Yes, to send to anyone |
| Sender shown | your Gmail address | e.g. `no-reply@soarhub.ng` |
| Daily limit | about 500 emails | depends on your Resend plan |
| Best for | now, until you own a domain | the long term |

## Option A: Gmail (no domain needed)

1. **Turn on 2-Step Verification** for the Gmail account: Google Account → **Security** → **2-Step Verification**.
   App Passwords only exist once this is on.
2. **Create an App Password**: open <https://myaccount.google.com/apppasswords>, type a name such as `SOAR Hub`, click
   **Create**, and copy the 16-character password Google shows (e.g. `abcd efgh ijkl mnop`). You only see it once.
   It's not your normal Gmail password, and you can revoke it any time on the same page.
3. **Edit `.env`** (`nano .env`) so the email lines read as below, with your Gmail address and App Password. Keep any
   other `EMAIL_PROVIDER=` line out (there must be only one):
   ```bash
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your.address@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop
   EMAIL_FROM="SOAR Hub <your.address@gmail.com>"
   ```
   `EMAIL_FROM` must use the same Gmail address: Gmail always sends as the account that signed in.
4. **Restart the app** (`Ctrl+C`, then `npm run dev`) and use **Admin → Settings → Send test email** with an address
   that is *not* your Gmail. The message should say "Sent to … via smtp".

If it says the login was rejected, the App Password is wrong or 2-Step Verification is off. Create a new App Password
and paste it again. Gmail limits you to about 500 emails a day. If emails land in spam, ask testers to mark them
"Not spam"; a verified domain (Option B) fixes this properly.

## Option B: Resend (needs your own domain to send to everyone)

### 1. Create a Resend account and an API key

1. Sign up at **resend.com**, using the email address you'll test with.
2. Go to **API Keys → Create API key**. Give it **Sending access**, then copy the key (it starts with `re_`). You only
   see it once.

### 2. Put the settings in `.env`

Never commit `.env`; it's already in `.gitignore`.

```bash
EMAIL_PROVIDER=resend
EMAIL_PROVIDER_API_KEY=re_your_key_here
EMAIL_FROM="SOAR Hub <onboarding@resend.dev>"
APP_URL=http://localhost:3000
```

Restart the app (`Ctrl+C`, then `npm run dev`) so it reads the new values.

> **Before you verify a domain**, Resend only accepts the shared sender `onboarding@resend.dev`, and only delivers to
> **the email address you signed up to Resend with**. Emails to anyone else are refused. In development, SOAR Hub keeps
> a copy of every email at **/dev/mailbox**, so verification and referee links still work during demos.

### 3. Check it works

1. Sign in as an admin → **Admin → Settings → Test email delivery**.
2. Type your Resend sign-up address and click **Send test email**. You should see "Sent to … via resend (id …)" and
   the email should arrive within a minute. Check spam too.
3. Register a new account with that same address. You'll receive the verification email, and after clicking it, the
   **"Welcome to SOAR Hub, your member ID is SOAR-26-XXXXXX"** email.

If sending fails, the message on the settings page includes Resend's reason, for example *"The domain is not verified"*
or *"You can only send testing emails to your own email address"*.

### 4. Send to everyone: verify your domain

You need a domain you control (for example `soarhub.ng`).

1. In Resend: **Domains → Add domain**, enter `soarhub.ng` (or a sub-domain such as `mail.soarhub.ng`).
2. Resend shows a few DNS records (SPF/DKIM, and optionally DMARC). Add them at your domain registrar's DNS settings,
   then click **Verify** in Resend. This can take from a few minutes to a few hours.
3. Change the sender in `.env` (and on your hosting provider) and restart:
   ```bash
   EMAIL_FROM="SOAR Hub <no-reply@soarhub.ng>"
   ```
4. Send a test email to a different address (e.g. a Gmail account) from **Admin → Settings**.

## 5. In production

- Set the same variables on your host (Vercel/Render/etc.), with `APP_URL` set to your real site address, such as
  `https://soarhub.ng`. Links in emails are built from `APP_URL`.
- Verification, welcome and password-reset emails are sent **immediately**. Reminders, referee updates and review
  emails are sent by the background jobs (Vercel cron, or `npm run worker` on other hosts; see `docs/DEPLOYMENT.md`).
  Locally, run `npm run worker` in a second terminal if you want those to go out too.
- Optional delivery receipts: in Resend → **Webhooks**, add `https://<your-domain>/api/webhooks/email` for the
  delivered/bounced/complained events, and put the signing secret (`whsec_…`) in `EMAIL_WEBHOOK_SECRET`. Bounces then
  show on **Admin → Notifications**.
- `/dev/mailbox` does not exist in production, and the local email copy is never written there.

## Member IDs

- Every member gets a permanent ID such as `SOAR-26-7K4QXM` **when their email is verified**: `SOAR`, the year they
  joined, and 6 characters that avoid look-alikes (no 0/O, 1/I/L).
- It's shown on the "Email verified" page (with a copy button), in the welcome email, and on the dashboard, profile and
  settings pages.
- Admins see it in **Applicants**, **Users** and the applicant's page, can **search by it** (typed in any form, e.g.
  `soar 26 7k4qxm`), and it's included in the applicants CSV export.
- Members verified before this feature got their IDs automatically during `npm run db:migrate`.
