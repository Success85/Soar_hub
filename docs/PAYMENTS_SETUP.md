# Membership payments with Flutterwave

Members pay through **Flutterwave** (card, bank transfer, USSD) to use everything beyond the home, About, Contact
and FAQ pages. Admin and reviewer accounts never pay. The price and length are set in **Admin → Settings →
Membership & payments** (default ₦25,000 for 12 months; 0 months = lifetime).

## How it works

1. A signed-up, verified member opens **/membership** and clicks **Pay ₦… and join**.
2. SOAR Hub creates a payment record and asks Flutterwave for a hosted checkout link, then sends the member there.
3. After paying, Flutterwave sends the member back to **/membership/callback**. SOAR Hub then **asks Flutterwave
   directly** whether that transaction succeeded, for the right amount, in NGN, for this order. Only then does the
   membership start. The link's query string and webhook bodies are never trusted on their own.
4. Flutterwave also calls the **webhook** (`/api/webhooks/flutterwave`). This activates the membership even if the
   member closes the browser before returning. Callback and webhook can't double-activate.
5. Paying again while a membership is active adds the new period after the current end date.

## 1. Get your keys (test mode first)

1. Create an account at **flutterwave.com** and open the dashboard.
2. Switch the dashboard to **Test mode** (toggle at the top).
3. Go to **Settings → API keys** and copy the **Secret key** (test keys start with `FLWSECK_TEST-`).
4. Go to **Settings → Webhooks**. Set the URL to `https://<your-domain>/api/webhooks/flutterwave`, type a long random
   **Secret hash** of your own, and save. Flutterwave sends this hash with every webhook so SOAR Hub can trust it.

## 2. Add them to `.env` (never commit this file)

```bash
FLW_SECRET_KEY=FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxx-X
FLW_SECRET_HASH=the-secret-hash-you-typed-in-the-dashboard
```

Restart the app. **Admin → Settings → Integrations** should show "Payments: Flutterwave (test mode), Active".

## 3. Test a payment

1. Register a new applicant account and verify the email.
2. Open `/membership` and click **Pay ₦25,000 and join**.
3. On Flutterwave's test checkout, pay with one of the **test cards** from Flutterwave's documentation (search
   "Flutterwave testing helpers"). No real money moves in test mode.
4. You're sent back to SOAR Hub: "Payment successful. Welcome!". The payment appears in **Admin → Payments & members**.

On your laptop, Flutterwave can't reach `localhost` with the webhook. That's fine: the return page confirms the payment
by itself. The webhook matters on the live site.

## 4. Go live

1. Complete Flutterwave's business verification (KYC) so live payments are enabled.
2. Switch the dashboard to **Live mode**, copy the **live** secret key (`FLWSECK-…`), and set up the webhook again in
   live mode (same URL; a secret hash, which may be different from the test one).
3. Put the live values in your host's environment variables (`FLW_SECRET_KEY`, `FLW_SECRET_HASH`) and make sure
   `APP_URL` is your real `https://` address. The return link is built from it.

## Admin tools

- **Admin → Payments & members:** every payment with its status, reference (`SOAR-…`), Flutterwave transaction ID,
  method and date; active member count and revenue. A **pending** payment can be re-checked by pasting its Flutterwave
  transaction ID (from the Flutterwave dashboard), e.g. if a member paid but the confirmation didn't arrive.
- **Admin → Applicants → (a person) → Membership:** grant months (or lifetime) without payment, e.g. for sponsored
  students or cash payments, or revoke access. Every grant, revoke and payment is in the audit log.
- **Admin → Settings → Membership & payments:** price, length, and a switch to turn the paywall off entirely.

## What members can and can't do without paying

- **Always open:** home, About, Contact, FAQ, Membership, Privacy, Terms, sign-up/sign-in, password reset, and the
  referee upload page (referees never need an account).
- **Open to signed-in non-members:** account **Settings** (password, notification preferences, data export, account
  deletion). These are privacy rights.
- **Members only:** the scholarship list and pages, eligibility checks, applications, planner, documents, essays,
  referees, the learning library (including the downloadable samples) and the application guide.
